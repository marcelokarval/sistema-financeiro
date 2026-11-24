// Só execute (inclusive bundle/help/version/cleanup) dentro do preflight aprovado de 0006.
// O supervisor prova isolamento do SO da árvore inteira e descarte do perfil.
// QUIET_QA_BASELINE_ACCOUNTS e QUIET_QA_BASELINE_CARDS: arquivos RO do commit a55192c0f2afed0bf26d4789dbee049a942561fc;
// QUIET_QA_SCRATCH: tmpfs privado.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { access, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const baseRef = 'a55192c0f2afed0bf26d4789dbee049a942561fc';
const baseHashes = {
  accounts: 'cc17f32e9385fbe8cba2ea48a7d835024748c00bf305d9cf686f101f0ed7875f',
  cards: 'cddea7b62500bac4c108c6158536922d83af3c94b98663a0bdcfd7f4650fc09f',
};
const source = fileURLToPath(import.meta.url);
const financeDir = dirname(source);
const accountsViewPath = join(financeDir, 'accounts-view.tsx');
const cardsViewPath = join(financeDir, 'cards-view.tsx');
const root = fileURLToPath(new URL('../../../', import.meta.url));
const hookPath = join(root, 'src/hooks/use-keyed-mutation-lock.ts');

function installFixture(AccountsView, CardsView, createElement, createRoot, ThemeProvider, Toaster) {
  const initialAccounts = ['a', 'b'].map((id) => ({
    id,
    name: `Conta ${id.toUpperCase()}`,
    type: 'CASH',
    balance: id === 'a' ? 100 : 250,
    color: '#22c55e',
    icon: 'wallet',
    isActive: true,
    _count: { transactions: id === 'a' ? 2 : 0 },
  }));
  const initialTxs = ['a', 'b'].map((id, idx) => ({
    id: `tx-${id}`,
    type: idx === 0 ? 'EXPENSE' : 'INCOME',
    amount: idx === 0 ? 15 : 40,
    description: `Transação ${id.toUpperCase()}`,
    date: '2026-01-15T00:00:00.000Z',
    categoryId: null,
    notes: '',
    category: null,
  }));
  const initialCards = ['a', 'b'].map((id) => ({
    id,
    name: `Cartão ${id.toUpperCase()}`,
    type: 'CREDIT',
    brand: 'VISA',
    lastFourDigits: id === 'a' ? '1111' : '2222',
    creditLimit: 1000,
    currentBalance: 100,
    closingDay: 1,
    dueDay: 10,
    color: '#8b5cf6',
    flag: '',
  }));

  const qa = window.qa = {
    calls: [],
    unexpected: [],
    entity: null,
    mode: null,
    pending: {},
    readReleased: false,
    closePoint: null,
    earlyJsonWhilePortalConnected: null,
    deletePortal: null,
  };
  let deleted = false;
  const readAccounts = () => initialAccounts.filter(({ id }) => !(qa.entity === 'account' && deleted && id === 'a'));
  const readTxs = () => initialTxs.filter(({ id }) => !(qa.entity === 'tx' && deleted && id === 'tx-a'));
  const readCards = () => initialCards.filter(({ id }) => !(qa.entity === 'card' && deleted && id === 'a'));
  const readRows = () => (qa.entity === 'account' ? readAccounts() : qa.entity === 'tx' ? readTxs() : readCards());
  const hold = (key) => new Promise((resolve) => { qa.pending[key] = resolve; });

  qa.release = (key) => {
    const resolve = qa.pending[key];
    if (!resolve) throw new Error(`Sem resposta pendente: ${key}`);
    delete qa.pending[key];
    if (key === 'write') {
      deleted = true;
      resolve(new Response(null, { status: 204 }));
    } else {
      qa.readReleased = true;
      resolve(Response.json(readRows()));
    }
  };

  window.fetch = async (url, init) => {
    const method = init?.method ?? 'GET';
    qa.calls.push({ method, url, body: init?.body ?? null });
    if (method === 'GET') {
      if (url === '/api/categories' || url.startsWith('/api/transactions?from=')) return Response.json([]);
      if (url === '/api/accounts') {
        if (qa.entity === 'account' && deleted) {
          if (qa.mode === 'late') return hold('read');
          if (qa.mode === 'early') {
            qa.readReleased = true;
            const rows = readAccounts();
            return {
              ok: true,
              json: () => {
                qa.earlyJsonWhilePortalConnected = qa.deletePortal?.isConnected === true;
                return Promise.resolve(rows);
              },
            };
          }
        }
        return Response.json(readAccounts());
      }
      if (url === '/api/transactions?accountId=a') {
        if (qa.entity === 'tx' && deleted) {
          if (qa.mode === 'late') return hold('read');
          if (qa.mode === 'early') {
            qa.readReleased = true;
            const rows = readTxs();
            return {
              ok: true,
              json: () => {
                qa.earlyJsonWhilePortalConnected = qa.deletePortal?.isConnected === true;
                return Promise.resolve(rows);
              },
            };
          }
        }
        return Response.json(readTxs());
      }
      if (url === '/api/cards') {
        if (qa.entity === 'card' && deleted) {
          if (qa.mode === 'late') return hold('read');
          if (qa.mode === 'early') {
            qa.readReleased = true;
            const rows = readCards();
            return {
              ok: true,
              json: () => {
                qa.earlyJsonWhilePortalConnected = qa.deletePortal?.isConnected === true;
                return Promise.resolve(rows);
              },
            };
          }
        }
        return Response.json(readCards());
      }
    }
    if (method === 'DELETE' && ['early', 'late', 'hold-write'].includes(qa.mode)) {
      if (
        (qa.entity === 'account' && url === '/api/accounts') ||
        (qa.entity === 'tx' && url.startsWith('/api/transactions?id=')) ||
        (qa.entity === 'card' && url === '/api/cards')
      ) {
        return hold('write');
      }
    }
    qa.unexpected.push(`${method} ${url}`);
    throw new Error(`Fetch fora da fixture de exclusão: ${method} ${url}`);
  };

  qa.mount = (entity, theme) => {
    qa.entity = entity;
    deleted = false;
    qa.calls = [];
    qa.unexpected = [];
    qa.mode = null;
    qa.pending = {};
    qa.readReleased = false;
    qa.closePoint = null;
    qa.earlyJsonWhilePortalConnected = null;
    qa.deletePortal = null;
    const viewElement = entity === 'card'
      ? createElement(CardsView)
      : createElement(AccountsView, { refreshCounter: 0, onLaunchClose() {} });
    createRoot(document.getElementById('root')).render(
      createElement(
        ThemeProvider,
        { attribute: 'class', forcedTheme: theme, disableTransitionOnChange: true },
        viewElement,
        createElement(Toaster),
      ),
    );
  };

  qa.focus = (node = document.activeElement) => ({
    role: node?.getAttribute('role') || (node?.tagName === 'BUTTON' ? 'button' :
      /^H[1-6]$/.test(node?.tagName) ? 'heading' : node?.tagName === 'BODY' ? 'body' : node?.tagName.toLowerCase() ?? null),
    name: node === document.body ? '' : (node?.getAttribute('aria-label') ?? node?.textContent ?? '').trim(),
    connected: !!node?.isConnected,
    focused: !!node && document.activeElement === node,
  });
}

// Serializado para a VM do CLI. As leituras DOM correm dentro da página.
async function runCases(page, html, width, theme) {
  const url = 'https://finance-qa.invalid/';
  const results = [];
  const errors = [];
  const blocked = [];
  const pageError = (error) => errors.push(error.message);
  const routeAll = (route) => {
    const req = route.request();
    if (req.url() === url && req.method() === 'GET' && req.isNavigationRequest()) {
      return route.fulfill({ path: html, contentType: 'text/html; charset=utf-8' });
    }
    blocked.push(req.url());
    return route.abort();
  };
  const invariant = (ok, message) => { if (!ok) throw new Error(message); };
  const button = (root, name) => root.getByRole('button', { name, exact: true });
  const heading = (name) => page.getByRole('heading', { name, exact: true });

  const specs = {
    account: {
      dialogTitle: 'Excluir conta?',
      triggerName: 'Excluir conta Conta A',
      fallbackName: 'Nova conta',
      aLabel: 'Abrir conta Conta A',
      bLabel: 'Abrir conta Conta B',
      readUrl: '/api/accounts',
      deleteMethod: 'DELETE',
      deleteUrl: '/api/accounts',
      deleteBody: '{"id":"a"}',
    },
    tx: {
      dialogTitle: 'Excluir transação?',
      triggerName: 'Excluir transação Transação A',
      fallbackName: 'Nova transação',
      aLabel: 'Excluir transação Transação A',
      bLabel: 'Excluir transação Transação B',
      readUrl: '/api/transactions?accountId=a',
      deleteMethod: 'DELETE',
      deleteUrl: '/api/transactions?id=tx-a',
      deleteBody: '{"id":"tx-a"}',
    },
    card: {
      dialogTitle: 'Excluir cartão?',
      triggerName: 'Excluir cartão Cartão A',
      fallbackName: 'Novo cartão',
      aLabel: 'Abrir cartão Cartão A',
      bLabel: 'Abrir cartão Cartão B',
      readUrl: '/api/cards',
      deleteMethod: 'DELETE',
      deleteUrl: '/api/cards',
      deleteBody: '{"id":"a"}',
    },
  };

  async function witnessTheme() {
    return page.evaluate(() => ({
      width: innerWidth,
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      background: getComputedStyle(document.body).backgroundColor,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
  }

  async function checkFixture() {
    const unexpected = await page.evaluate(() => window.qa.unexpected);
    invariant(errors.length === 0 && blocked.length === 0 && unexpected.length === 0, JSON.stringify({ errors, blocked, unexpected }));
  }

  function requestsFor(entity) {
    const readUrl = specs[entity].readUrl;
    return page.evaluate((targetReadUrl) => ({
      writes: window.qa.calls.filter(({ method }) => method !== 'GET'),
      reads: window.qa.calls.filter(({ method, url }) => method === 'GET' && url === targetReadUrl).length,
      unexpected: window.qa.unexpected,
    }), readUrl);
  }

  function sameFocus(want, got) {
    return want.role === got.role && want.name === got.name && got.connected && got.focused;
  }

  async function openDeleteDialog(entity, triggerOverride) {
    const spec = specs[entity];
    const trigger = button(page, triggerOverride ?? spec.triggerName);
    await trigger.focus();
    const before = await trigger.evaluate((node) => window.qa.focus(node));
    invariant(before.focused && before.connected && before.role === 'button', `${entity}: origem inválida ${JSON.stringify(before)}`);
    const originHandle = await trigger.elementHandle();
    await trigger.click();
    const dialog = page.getByRole('alertdialog', { name: spec.dialogTitle, exact: true });
    await dialog.waitFor();
    await dialog.evaluate((portal, readUrl) => {
      window.qa.closePoint = null;
      window.qa.deletePortal = portal;
      portal.addEventListener('focusScope.autoFocusOnUnmount', () => queueMicrotask(() => {
        const labels = Array.from(document.querySelectorAll('button')).map((el) => el.getAttribute('aria-label'));
        const snap = readUrl === '/api/accounts'
          ? { aInList: !!document.querySelector('[data-account-detail="a"]'), bInList: !!document.querySelector('[data-account-detail="b"]') }
          : readUrl === '/api/cards'
            ? { aInList: !!document.querySelector('[data-card-detail="a"]'), bInList: !!document.querySelector('[data-card-detail="b"]') }
            : { aInList: labels.includes('Excluir transação Transação A'), bInList: labels.includes('Excluir transação Transação B') };
        window.qa.closePoint = {
          focus: window.qa.focus(),
          portalConnected: portal.isConnected,
          ...snap,
          txLoading: document.body.textContent?.includes('Carregando transações…') ?? false,
          readReleased: window.qa.readReleased,
          pendingRead: !!window.qa.pending.read,
          earlyJsonWhilePortalConnected: window.qa.earlyJsonWhilePortalConnected ?? null,
        };
      }), { once: true });
    }, spec.readUrl);
    return { dialog, originHandle, before };
  }

  async function reset(entity) {
    if (results.length) await checkFixture();
    await page.goto(url);
    await page.evaluate(([kind, name]) => window.qa.mount(kind, name), [entity, theme]);
    const spec = specs[entity];
    if (entity === 'tx') {
      await button(page, 'Abrir conta Conta A').waitFor();
      await button(page, 'Abrir conta Conta A').click();
      await heading('Conta A').waitFor();
      await button(page, 'Nova transação').waitFor();
    }
    await button(page, spec.aLabel).waitFor();
    await button(page, spec.bLabel).waitFor();
    return openDeleteDialog(entity);
  }

  async function closed(dialog) {
    await dialog.waitFor({ state: 'detached' });
    await page.waitForFunction(() => window.qa.closePoint !== null);
    const point = await page.evaluate(() => window.qa.closePoint);
    invariant(!point.portalConnected, `Portal ainda conectado em ${JSON.stringify(point)}`);
    return point;
  }

  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ colorScheme: theme });
  page.on('pageerror', pageError);
  await page.route('**/*', routeAll);

  try {
    for (const entity of ['account', 'tx', 'card']) {
      const spec = specs[entity];
      for (const how of ['Escape', 'Cancelar']) {
        const { dialog, originHandle, before } = await reset(entity);
        try {
          if (how === 'Escape') await page.keyboard.press('Escape');
          else await button(dialog, 'Cancelar').click();
          const point = await closed(dialog);
          const originFocus = await originHandle.evaluate((node) => window.qa.focus(node));
          const readback = await requestsFor(entity);
          const violations = [];
          if (!sameFocus(before, point.focus) || !originFocus.focused || !originFocus.connected) {
            violations.push('cancelamento não voltou à origem');
          }
          invariant(readback.writes.length === 0 && readback.reads === 1, `${entity}/${how}: enviou gravação ou releitura`);
          results.push({ name: `${entity}/Excluir/${how}`, before, point, originFocus, violations });
        } finally {
          await originHandle.dispose();
        }
      }

      for (const order of ['early', 'late']) {
        const { dialog, originHandle, before } = await reset(entity);
        try {
          await page.evaluate((mode) => { window.qa.mode = mode; }, order);
          await button(dialog, 'Excluir').click();
          await page.waitForFunction(() => !!window.qa.pending.write);
          invariant(
            await dialog.isVisible() && await button(dialog, 'Excluir').getAttribute('aria-disabled') === 'true',
            `${entity}/${order}: alerta não guardou a exclusão em voo`,
          );
          await page.evaluate(() => window.qa.release('write'));
          const point = await closed(dialog);
          const originAtClose = await originHandle.evaluate((node) => window.qa.focus(node));
          const fallbackAtClose = await button(page, spec.fallbackName).evaluate((node) => window.qa.focus(node));
          if (order === 'early') {
            invariant(point.bInList, `${entity}/${order}: B ausente no fechamento`);
            invariant(
              point.earlyJsonWhilePortalConnected && point.readReleased && !point.pendingRead && !point.aInList,
              `${entity}/${order}: entrega do JSON/remoção de A antes do retorno de foco não comprovadas: ${JSON.stringify(point)}`,
            );
          } else if (entity === 'tx') {
            // Na releitura de transações, txLoading=true desmonta a <ul> inteira durante o GET pendente.
            invariant(
              point.pendingRead && !point.readReleased && !point.aInList && !point.bInList && point.txLoading,
              `${entity}/${order}: estado de carregamento/GET retido não comprovado no fechamento: ${JSON.stringify(point)}`,
            );
            await page.evaluate(() => window.qa.release('read'));
          } else {
            invariant(point.bInList, `${entity}/${order}: B ausente no fechamento`);
            invariant(
              point.pendingRead && !point.readReleased && point.aInList,
              `${entity}/${order}: GET não retido no retorno de foco: ${JSON.stringify(point)}`,
            );
            await page.evaluate(() => window.qa.release('read'));
          }
          await button(page, spec.aLabel).waitFor({ state: 'detached' });
          await button(page, spec.bLabel).waitFor();
          const afterRead = await page.evaluate((readUrl) => {
            const labels = Array.from(document.querySelectorAll('button')).map((el) => el.getAttribute('aria-label'));
            const snap = readUrl === '/api/accounts'
              ? { aInList: !!document.querySelector('[data-account-detail="a"]'), bInList: !!document.querySelector('[data-account-detail="b"]') }
              : readUrl === '/api/cards'
                ? { aInList: !!document.querySelector('[data-card-detail="a"]'), bInList: !!document.querySelector('[data-card-detail="b"]') }
                : { aInList: labels.includes('Excluir transação Transação A'), bInList: labels.includes('Excluir transação Transação B') };
            return {
              ...snap,
              readReleased: window.qa.readReleased,
              pendingRead: !!window.qa.pending.read,
            };
          }, spec.readUrl);
          invariant(!afterRead.aInList && afterRead.bInList && afterRead.readReleased && !afterRead.pendingRead,
            `${entity}/${order}: GET não removeu somente A: ${JSON.stringify(afterRead)}`);
          const afterFocus = await page.evaluate(() => window.qa.focus());
          const originAfterRead = await originHandle.evaluate((node) => window.qa.focus(node));
          const fallbackFocus = await button(page, spec.fallbackName).evaluate((node) => window.qa.focus(node));
          const { reads, writes } = await requestsFor(entity);
          invariant(
            reads === 2 && writes.length === 1 && writes[0].method === spec.deleteMethod &&
            writes[0].url === spec.deleteUrl && writes[0].body === spec.deleteBody,
            `${entity}/${order}: DELETE incorreto ${JSON.stringify({ writes, reads })}`,
          );
          const violations = [];
          if (order === 'late' && entity !== 'tx') {
            if (!sameFocus(before, point.focus) || !originAtClose.connected || !originAtClose.focused) {
              violations.push('fechamento com GET retido não restaurou a origem conectada');
            }
          } else if (!sameFocus(fallbackAtClose, point.focus)) {
            violations.push('fechamento sem origem conectada não restaurou o fallback previsto');
          }
          // Um acionador conectado durante o GET retido não prova foco sobrevivente após o commit que remove a linha.
          if (!afterFocus.connected || !afterFocus.focused || afterFocus.role === 'body') {
            violations.push('foco não sobreviveu à remoção da linha');
          }
          results.push({
            name: `${entity}/Excluir/${order}`,
            before,
            point,
            originAtClose,
            afterRead,
            afterFocus,
            originAfterRead,
            fallbackFocus,
            violations,
          });
        } finally {
          await originHandle.dispose();
        }
      }
    }

    // Guarda de abertura A->B + clique síncrono duplo na exclusão de transação (complementa quiet-accounts-cards.qa.mjs).
    const { dialog: dialogA, originHandle: originA, before: beforeA } = await reset('tx');
    let originB;
    try {
      await page.evaluate(() => { window.qa.mode = 'hold-write'; });
      await button(dialogA, 'Excluir').evaluate((el) => { el.click(); el.click(); });
      await page.waitForFunction(() => !!window.qa.pending.write);
      const pendingCalls = await requestsFor('tx');
      invariant(pendingCalls.writes.length === 1, `tx/Excluir/A->B: esperado 1 DELETE, veio ${pendingCalls.writes.length}`);
      invariant(await button(dialogA, 'Excluir').getAttribute('aria-disabled') === 'true', 'tx/Excluir/A->B: aria-disabled ausente');
      await button(dialogA, 'Cancelar').click();
      const closePointA = await closed(dialogA);
      const { dialog: dialogB, originHandle: hB, before: beforeB } = await openDeleteDialog('tx', 'Excluir transação Transação B');
      originB = hB;
      await page.evaluate(() => window.qa.release('write'));
      await page.getByText('Transação excluída!', { exact: true }).waitFor({ state: 'visible' });
      await page.waitForFunction(() => !Array.from(document.querySelectorAll('button'))
        .some((el) => el.getAttribute('aria-label') === 'Excluir transação Transação A'));
      invariant(await dialogB.isVisible(), 'tx/Excluir/A->B: resposta antiga fechou a confirmação B');
      await button(dialogB, 'Cancelar').click();
      const closePointB = await closed(dialogB);
      await button(page, 'Excluir transação Transação B').waitFor();
      const fallbackB = await button(page, 'Nova transação').evaluate((node) => window.qa.focus(node));
      const violations = [];
      if (!sameFocus(beforeA, closePointA.focus)) violations.push('cancelamento de A não voltou à origem');
      if (!sameFocus(fallbackB, closePointB.focus)) {
        violations.push('cancelamento de B após releitura de A não restaurou foco sobrevivente');
      }
      results.push({ name: 'tx/Excluir/A->B', beforeA, closePointA, beforeB, closePointB, fallbackB, violations });
    } finally {
      await originA.dispose();
      if (originB) await originB.dispose();
    }

    const witness = await witnessTheme();
    invariant(witness.width === width && witness.theme === theme && witness.background !== 'rgba(0, 0, 0, 0)', 'Viewport/tema não aplicado');
    await checkFixture();
    return { results, witness };
  } finally {
    page.off('pageerror', pageError);
    await page.unroute('**/*', routeAll);
  }
}

const { QUIET_QA_BASELINE_ACCOUNTS, QUIET_QA_BASELINE_CARDS, QUIET_QA_SCRATCH, CI } = process.env;
assert(
  isAbsolute(QUIET_QA_BASELINE_ACCOUNTS ?? '') &&
  isAbsolute(QUIET_QA_BASELINE_CARDS ?? '') &&
  isAbsolute(QUIET_QA_SCRATCH ?? '') &&
  CI === '1',
  'Somente dentro da fronteira autorizada com QUIET_QA_BASELINE_ACCOUNTS, QUIET_QA_BASELINE_CARDS, QUIET_QA_SCRATCH e CI=1',
);
const scratch = await realpath(QUIET_QA_SCRATCH);
for (const key of ['HOME', 'TMPDIR', 'XDG_CACHE_HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_RUNTIME_DIR']) {
  assert(process.env[key] && (await realpath(process.env[key])).startsWith(`${scratch}/`), `${key} fora do scratch`);
}
for (const forbidden of ['.git', '.env', 'prisma/.env', 'db']) {
  await assert.rejects(access(join(root, forbidden)), { code: 'ENOENT' });
}
assert(!('DATABASE_URL' in process.env));
const digest = (contents) => createHash('sha256').update(contents).digest('hex');
const baselineAccounts = await readFile(QUIET_QA_BASELINE_ACCOUNTS, 'utf8');
const baselineCards = await readFile(QUIET_QA_BASELINE_CARDS, 'utf8');
assert.equal(digest(baselineAccounts), baseHashes.accounts);
assert.equal(digest(baselineCards), baseHashes.cards);

const dir = await mkdtemp(join(scratch, 'quiet-keyed-deletion-'));
const session = `quiet-keyed-deletion-${randomUUID()}`;
const errors = [];
let attemptedOpen = false;
let daemonPid;
const deadline = Date.now() + 420_000;
async function cli(...args) {
  const cleanup = ['close', 'list'].includes(args[0]);
  const timeout = cleanup ? 5000 : Math.min(45_000, deadline - Date.now());
  assert(timeout > 0, 'Prazo do controlador encerrado');
  const cmd = Bun.spawn(['playwright-cli', `-s=${session}`, ...args],
    { cwd: dir, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', timeout });
  const [stdout, stderr, exit] = await Promise.all([
    new Response(cmd.stdout).text(), new Response(cmd.stderr).text(), cmd.exited,
  ]);
  assert(exit === 0 && !/^### Error\b/m.test(stdout), `${args[0]} (exit ${exit}): ${stdout}\n${stderr}`);
  return stdout;
}

try {
  const { default: postcss } = await import('postcss');
  const { default: tailwind } = await import('@tailwindcss/postcss');
  const cssFile = join(root, 'src/app/globals.css');
  const { css } = await postcss([tailwind({ base: root })]).process(await readFile(cssFile, 'utf8'), { from: cssFile, map: false });
  assert(css.includes('--ds-focus') && css.includes('.bg-background'));

  const entry = `import { AccountsView } from ${JSON.stringify(accountsViewPath)};
    import { CardsView } from ${JSON.stringify(cardsViewPath)};
    import { createElement } from 'react'; import { createRoot } from 'react-dom/client';
    import { Toaster } from 'sonner'; import { ThemeProvider } from 'next-themes';
    (${installFixture.toString()})(AccountsView, CardsView, createElement, createRoot, ThemeProvider, Toaster);`;

  async function htmlFor(label, baselines) {
    const bundle = await Bun.build({
      entrypoints: [source],
      target: 'browser',
      format: 'iife',
      minify: true,
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{
        name: 'fixture sintética de exclusão Contas e Cartões',
        setup(build) {
          build.onLoad({ filter: /quiet-keyed-deletion-focus\.qa\.mjs$/ }, () => ({ contents: entry, loader: 'ts' }));
          if (baselines) {
            build.onLoad({ filter: /\/accounts-view\.tsx$/ }, (args) => {
              assert.equal(args.path, accountsViewPath);
              return { contents: baselines.accounts, loader: 'tsx' };
            });
            build.onLoad({ filter: /\/cards-view\.tsx$/ }, (args) => {
              assert.equal(args.path, cardsViewPath);
              return { contents: baselines.cards, loader: 'tsx' };
            });
          }
        },
      }],
    });
    assert(bundle.success && bundle.outputs.length === 1, `Bundle incompleto: ${label}`);
    const file = join(dir, `${label}.html`);
    const script = (await bundle.outputs[0].text()).replace(/<\/script/gi, '<\\/script');
    await writeFile(
      file,
      `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><style>${css.replace(/<\/style/gi, '<\\/style')}</style><body class="antialiased bg-background text-foreground"><div id="root"></div><script>${script}</script></body></html>`,
    );
    return file;
  }

  const html = {
    baseline: await htmlFor('baseline', { accounts: baselineAccounts, cards: baselineCards }),
    candidate: await htmlFor('candidate'),
  };
  const candidate = {
    'accounts-view.tsx': digest(await readFile(accountsViewPath)),
    'cards-view.tsx': digest(await readFile(cardsViewPath)),
    'use-keyed-mutation-lock.ts': digest(await readFile(hookPath)),
    'quiet-keyed-deletion-focus.qa.mjs': digest(await readFile(source)),
  };
  console.log(JSON.stringify({ session, baseRef, baseHashes, candidate }));
  assert.equal(JSON.parse(await cli('--version', '--json')).version, '0.1.22', 'Versão do CLI exige revisão de capacidades');
  assert.match(await cli('open', '--help'), /--idle-timeout/);
  attemptedOpen = true;
  const opened = JSON.parse(await cli('open', 'about:blank', '--browser=chrome', '--idle-timeout=120000', '--json'));
  assert.equal(opened.session, session);
  assert(Number.isInteger(opened.pid) && opened.pid > 1, 'Daemon sem PID verificável');
  daemonPid = opened.pid;
  await cli('snapshot');

  const gaps = [];
  const preexistingQuietDivergences = [];
  let total = 0;
  for (const width of [360, 390, 1440]) {
    const backgrounds = [];
    for (const theme of ['light', 'dark']) {
      const observed = {};
      for (const label of ['baseline', 'candidate']) {
        const report = await cli('run-code', `(page) => (${runCases.toString()})(page, ${JSON.stringify(html[label])}, ${width}, ${JSON.stringify(theme)})`);
        const result = report.match(/^### Result\s*\n([^\n]+)/m)?.[1];
        assert(result, `${label}: resultado DOM ausente`);
        observed[label] = JSON.parse(result);
        assert.equal(observed[label].results.length, 13, `${label}: cenário não executado`);
      }
      total += observed.candidate.results.length;
      backgrounds.push(observed.candidate.witness.background);
      console.log(JSON.stringify({ width, theme, ...observed }));
      const parityConfirmed = Bun.deepEquals(observed.baseline, observed.candidate);
      if (!parityConfirmed) gaps.push(`${width}/${theme}: divergência de paridade`);
      for (const result of observed.candidate.results) {
        const base = observed.baseline.results.find(({ name }) => name === result.name);
        for (const violation of result.violations) {
          const isPreexistingLateFocus =
            result.name.endsWith('/Excluir/late') &&
            violation === 'foco não sobreviveu à remoção da linha' &&
            base?.violations.includes(violation);
          if (isPreexistingLateFocus) {
            preexistingQuietDivergences.push({
              cell: `${width}/${theme}`,
              scenario: result.name,
              violation,
              parityConfirmed,
            });
          } else {
            gaps.push(`${width}/${theme} ${result.name}: ${base?.violations.includes(violation) ? 'preexistente: ' : ''}${violation}`);
          }
        }
      }
      if (observed.candidate.witness.overflow) gaps.push(`${width}/${theme}: rolagem horizontal`);
    }
    if (backgrounds[0] === backgrounds[1]) gaps.push(`${width}: fundo claro/escuro idêntico`);
  }

  if (preexistingQuietDivergences.length) {
    console.log(JSON.stringify({
      warning: 'AVISO: divergência Quiet preexistente aberta (NÃO constitui conformidade Quiet; ver Decisão 6 e task-0006).',
      quietCompliant: false,
      preexistingQuietDivergences,
    }));
  }
  assert.deepEqual(gaps, [], 'Falha no contrato Quiet; paridade não isenta divergência preexistente');
  console.log(`${total} cenários pareados; 0 skips.${preexistingQuietDivergences.length ? ` Divergências Quiet preexistentes abertas: ${preexistingQuietDivergences.length} (não conformidade Quiet).` : ''}`);
} catch (error) {
  errors.push(error);
} finally {
  async function cleanup(label, action) {
    try { await action(); } catch (error) { errors.push(new Error(`${label}: ${error.message}`, { cause: error })); }
  }
  if (attemptedOpen) {
    const before = errors.length;
    await cleanup('close', async () => {
      const closed = JSON.parse(await cli('close', '--json'));
      assert.equal(closed.session, session);
      assert.equal(closed.status, 'closed');
    });
    await cleanup('list', async () => {
      const { browsers } = JSON.parse(await cli('list', '--json'));
      assert(Array.isArray(browsers) && !browsers.some(({ name }) => name === session));
    });
    await cleanup('daemon', async () => {
      assert(Number.isInteger(daemonPid), 'PID não observado à abertura');
      for (let attempt = 0; attempt < 20; attempt++) {
        try { await access(`/proc/${daemonPid}`); } catch (error) {
          if (error.code === 'ENOENT') return;
          throw error;
        }
        await delay(50);
      }
      throw new Error('Daemon ainda presente');
    });
    if (errors.length === before) console.log(`Sessão exclusiva encerrada: ${session}`);
  }
  await cleanup('scratch', () => rm(dir, { recursive: true, force: true }));
}
if (errors.length) throw new AggregateError(errors, 'QA de exclusão/foco Contas e Cartões não concluído');
