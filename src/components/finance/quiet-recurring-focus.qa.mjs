// Execute somente dentro do preflight de navegador de 0019. O executor prova
// a fronteira do SO, não este script. Disponibilize QUIET_QA_SCRATCH (tmpfs privado)
// e QUIET_QA_BASELINE_RECURRING (arquivo RO do commit 70ed596250a2182d869b31fb0560a5bcfce04a5c).
// Não monte .git, o checkout inteiro, HOME do host, .env ou banco.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { access, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const baseRef = '70ed596250a2182d869b31fb0560a5bcfce04a5c';
const baselineSpec = {
  env: 'QUIET_QA_BASELINE_RECURRING',
  file: 'recurring-transactions.tsx',
  hash: '4788452fcf7490d5eed898379e0f201863eb35b595e6366fa9a8327ee5b3650c',
};

const source = fileURLToPath(import.meta.url);
const financeDir = dirname(source);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const recurringPath = join(financeDir, 'recurring-transactions.tsx');
const editorPath = join(financeDir, 'recurring-transaction-editor.tsx');
const deletePath = join(financeDir, 'recurring-delete-confirmation.tsx');
const shellPath = join(root, 'src/components/shared/finance-dialog-shell.tsx');

function installFixture(RecurringTransactionsWidget, createElement, createRoot, ThemeProvider, Toaster) {
  const initialEntries = [
    {
      id: 'a',
      description: 'Assinatura A',
      amount: 50,
      type: 'EXPENSE',
      frequency: 'MONTHLY',
      nextDate: '2026-12-01T00:00:00.000Z',
      isActive: true,
      categoryId: 'cat-1',
      accountId: 'acc-1',
      cardId: null,
      category: { id: 'cat-1', name: 'Serviços', color: '#888', icon: 'Tag' },
      account: { id: 'acc-1', name: 'Conta A', color: '#888', icon: 'Wallet' },
      card: null,
    },
    {
      id: 'b',
      description: 'Receita B',
      amount: 200,
      type: 'INCOME',
      frequency: 'MONTHLY',
      nextDate: '2026-12-05T00:00:00.000Z',
      isActive: true,
      categoryId: null,
      accountId: null,
      cardId: null,
      category: null,
      account: null,
      card: null,
    },
  ];

  const qa = window.qa = {
    calls: [],
    pending: {},
    unexpected: [],
    mode: null,
    deleted: false,
    readReleased: false,
    closePoint: null,
  };

  const held = (label) => new Promise((resolve, reject) => {
    qa.pending[label] = { resolve, reject };
  });

  const currentEntries = () => initialEntries.filter(({ id }) => !qa.deleted || id !== 'a');

  qa.reply = (label, outcome) => {
    const slot = qa.pending[label];
    if (!slot) throw new Error(`Sem resposta pendente: ${label}`);
    delete qa.pending[label];
    if (outcome === 'transport') return slot.reject(new Error('Rejeição sintética'));
    if (outcome === 'http') return slot.resolve(Response.json({ error: 'Indisponível' }, { status: 503 }));
    if (label === 'write') {
      if (qa.mode?.startsWith('delete-')) qa.deleted = true;
      return slot.resolve(Response.json({ success: true }, { status: 200 }));
    }
    if (label === 'read') {
      qa.readReleased = true;
      return slot.resolve(Response.json(currentEntries()));
    }
    throw new Error(`Reply não tratado: ${label}`);
  };

  window.fetch = async (url, init) => {
    const method = init?.method ?? 'GET';
    qa.calls.push({
      method,
      url,
      ...(init?.body ? { rawBody: init.body, body: JSON.parse(init.body) } : {}),
    });

    if (url === '/api/categories') {
      return Response.json([{ id: 'cat-1', name: 'Serviços', type: 'EXPENSE', color: '#888', icon: 'Tag' }]);
    }
    if (url === '/api/accounts') {
      return Response.json([{ id: 'acc-1', name: 'Conta A', color: '#888', icon: 'Wallet' }]);
    }
    if (url === '/api/cards') {
      return Response.json([{ id: 'card-1', name: 'Cartão A', color: '#888', lastFourDigits: '1234' }]);
    }

    if (url === '/api/recurring' && method === 'GET') {
      if (qa.mode === 'delete-late' && qa.deleted) {
        return held('read');
      }
      if (qa.mode === 'hold-read-after-write') {
        return held('read');
      }
      if (qa.deleted) {
        qa.readReleased = true;
      }
      return Response.json(currentEntries());
    }

    if (url === '/api/recurring' && ['POST', 'PUT', 'DELETE'].includes(method)) {
      if (qa.mode === 'http') return Response.json({ error: 'Falha sintética' }, { status: 503 });
      if (qa.mode === 'transport') throw new Error('Rejeição sintética');
      if (qa.mode === 'hold-write' || qa.mode === 'delete-late' || qa.mode === 'delete-early') {
        return held('write');
      }
      return Response.json({ success: true }, { status: method === 'POST' ? 201 : 200 });
    }

    qa.unexpected.push(`${method} ${url}`);
    throw new Error(`Requisição inesperada na fixture: ${method} ${url}`);
  };

  qa.mount = (theme) => {
    qa.calls = [];
    qa.pending = {};
    qa.unexpected = [];
    qa.mode = null;
    qa.deleted = false;
    qa.readReleased = false;
    qa.closePoint = null;

    createRoot(document.getElementById('root')).render(
      createElement(
        ThemeProvider,
        { attribute: 'class', forcedTheme: theme, disableTransitionOnChange: true },
        createElement(
          'main',
          { className: 'min-h-screen bg-background p-3', id: 'fixture' },
          createElement(RecurringTransactionsWidget),
          createElement(Toaster, { theme }),
        ),
      ),
    );
  };

  qa.focus = (node = document.activeElement) => ({
    role: node?.getAttribute('role') || (node?.tagName === 'BUTTON' ? 'button'
      : /^H[1-6]$/.test(node?.tagName) ? 'heading' : node?.tagName === 'BODY' ? 'body' : node?.tagName.toLowerCase() ?? null),
    name: node === document.body ? '' : (node?.getAttribute('aria-label') ?? node?.textContent ?? '').trim(),
    connected: !!node?.isConnected,
    focused: !!node && document.activeElement === node,
  });
}

// Serializado pelo CLI no sandbox. Não depende de globals Node na VM.
async function runCases(page, html, width, theme) {
  const url = 'https://finance-qa.invalid/';
  const rejected = [];
  const errors = [];
  const onError = (error) => errors.push(error.message);
  const routeAll = (route) => {
    const req = route.request();
    if (req.url() === url && req.method() === 'GET' && req.isNavigationRequest()) {
      return route.fulfill({ path: html, contentType: 'text/html; charset=utf-8' });
    }
    rejected.push(req.url());
    return route.abort();
  };

  await page.route('**/*', routeAll);
  page.on('pageerror', onError);

  try {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    page.setDefaultTimeout(4000);

    const results = [];
    const require = (value, message) => { if (!value) throw new Error(message); };
    const same = (value, want, message) => require(JSON.stringify(value) === JSON.stringify(want), `${message}: ${JSON.stringify(value)}`);
    const btn = (rootNode, name) => rootNode.getByRole('button', { name, exact: true });
    const frame = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const calls = () => page.evaluate(() => window.qa.calls);
    const sameFocus = (want, got) => want.role === got.role && want.name === got.name && got.connected && got.focused;

    const geometry = (selector) => page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error(`Superfície ausente: ${sel}`);
      const box = el.getBoundingClientRect();
      return {
        viewport: window.innerWidth,
        page: document.documentElement.scrollWidth,
        left: box.left,
        right: box.right,
        width: el.clientWidth,
        content: el.scrollWidth,
      };
    }, selector);

    const assertReflow = async (selector) => {
      const box = await geometry(selector);
      require(
        box.viewport === width && box.page <= width && box.left >= -1 && box.right <= width + 1 && box.content <= box.width + 1,
        `overflow: ${selector} ${JSON.stringify(box)}`,
      );
    };

    async function attachUnmountWatch(dialog) {
      await dialog.evaluate((portal) => {
        window.qa.closePoint = null;
        portal.addEventListener('focusScope.autoFocusOnUnmount', () => queueMicrotask(() => {
          window.qa.closePoint = {
            focus: window.qa.focus(),
            portalConnected: portal.isConnected,
            readReleased: window.qa.readReleased,
            pendingRead: !!window.qa.pending.read,
            aInList: Array.from(document.querySelectorAll('p')).some((el) => el.textContent?.trim() === 'Assinatura A'),
            bInList: Array.from(document.querySelectorAll('p')).some((el) => el.textContent?.trim() === 'Receita B'),
          };
        }), { once: true });
      });
    }

    async function closed(dialog) {
      await dialog.waitFor({ state: 'detached' });
      await page.waitForFunction(() => window.qa.closePoint !== null);
      await frame();
      const point = await page.evaluate(() => window.qa.closePoint);
      require(!point.portalConnected, `Portal ainda conectado em ${JSON.stringify(point)}`);
      return point;
    }

    async function scenario(name, run) {
      try {
        await page.goto(url);
        await page.waitForFunction(() => Boolean(window.qa));
        await page.evaluate((selectedTheme) => window.qa.mount(selectedTheme), theme);
        await btn(page, 'Editar Assinatura A').waitFor();
        await btn(page, 'Editar Receita B').waitFor();
        const observation = await run();
        same(await page.evaluate(() => window.qa.unexpected), [], 'requisições inesperadas');
        same(errors, [], 'erros no DOM');
        same(rejected, [], 'rede não autorizada');
        results.push({ name, ...observation });
      } catch (error) {
        throw new Error(`${width}/${theme} ${name}: ${error.message}`);
      }
    }

    // 1. Testemunha do tema e viewport
    await scenario('testemunha do tema e viewport', async () => {
      await assertReflow('#fixture');
      const witness = await page.evaluate((selected) => {
        const outer = document.getElementById('fixture');
        const rendered = getComputedStyle(outer).backgroundColor;
        const tokenProbe = document.createElement('i');
        tokenProbe.style.backgroundColor = 'var(--background)';
        outer.appendChild(tokenProbe);
        const expected = getComputedStyle(tokenProbe).backgroundColor;
        tokenProbe.remove();
        if (!document.documentElement.classList.contains(selected) || rendered !== expected || ['transparent', 'rgba(0, 0, 0, 0)'].includes(rendered)) {
          throw new Error('CSS real de tema não aplicado');
        }
        return {
          width: window.innerWidth,
          theme: selected,
          background: rendered,
          overflow: document.documentElement.scrollWidth > window.innerWidth,
        };
      }, theme);
      return { witness, violations: [] };
    });

    // 2. Foco inicial, Escape / Cancelar com iniciador conectado e zero mutações
    await scenario('recorrencias/foco-inicial-escape-cancelar', async () => {
      const observations = [];
      const cases = [
        { label: 'criar', trigger: btn(page, 'Nova transação recorrente'), role: 'dialog', title: 'Nova Transação Recorrente', ways: ['Escape', 'Cancelar', 'Fechar'] },
        { label: 'editar', trigger: btn(page, 'Editar Assinatura A'), role: 'dialog', title: 'Editar Transação Recorrente', ways: ['Escape', 'Cancelar'] },
        { label: 'excluir', trigger: btn(page, 'Excluir Assinatura A'), role: 'alertdialog', title: 'Excluir Transação Recorrente', ways: ['Escape', 'Cancelar'] },
      ];
      for (const item of cases) {
        for (const how of item.ways) {
          await item.trigger.focus();
          const before = await item.trigger.evaluate((node) => window.qa.focus(node));
          await page.keyboard.press('Enter');
          const dialog = page.getByRole(item.role, { name: item.title, exact: true });
          await dialog.waitFor();
          await assertReflow(`[role=${item.role}]`);
          const initialFocus = await page.evaluate(() => window.qa.focus());
          const insideDialog = await dialog.evaluate((node) => node.contains(document.activeElement));
          require(insideDialog, `${item.label}/${how}: foco inicial fora do diálogo: ${JSON.stringify(initialFocus)}`);
          if (item.role === 'dialog') {
            same(await dialog.getByRole('button', { name: 'Fechar', exact: true }).count(), 1, 'botão Fechar ausente');
          }
          await attachUnmountWatch(dialog);
          if (how === 'Escape') await page.keyboard.press('Escape');
          else await btn(dialog, how).click();
          const point = await closed(dialog);
          observations.push({
            case: `${item.label}/${how}`,
            initialFocus,
            returnedFocus: point.focus,
            matched: sameFocus(before, point.focus),
          });
        }
      }
      same((await calls()).filter((c) => c.method !== 'GET'), [], 'Escape/Cancelar gravou');
      return {
        observations,
        violations: observations.some((o) => !o.matched) ? ['retorno de foco não correspondeu ao iniciador conectado'] : [],
      };
    });

    // 3. Falha de gravação (http, transport) preservando diálogo e rascunho em POST e PUT
    await scenario('recorrencias/gravacao/falhas-preservam-rascunho', async () => {
      const points = [];
      for (const flow of ['create', 'edit']) {
        const trigger = btn(page, flow === 'create' ? 'Nova transação recorrente' : 'Editar Assinatura A');
        await trigger.focus();
        const beforeTrigger = await trigger.evaluate((node) => window.qa.focus(node));
        await trigger.click();
        const dialog = page.getByRole('dialog', {
          name: flow === 'create' ? 'Nova Transação Recorrente' : 'Editar Transação Recorrente',
          exact: true,
        });
        await dialog.waitFor();
        await dialog.getByLabel('Descrição', { exact: true }).fill('Rascunho preservado');
        await dialog.getByLabel('Valor (R$)', { exact: true }).fill('77.50');

        for (const mode of ['http', 'transport']) {
          const offset = (await calls()).length;
          await page.evaluate((m) => { window.qa.mode = m; }, mode);
          await btn(dialog, flow === 'create' ? 'Criar' : 'Salvar').click();
          await page.locator('[data-sonner-toast][data-type=error]').first().waitFor({ state: 'attached' });
          require(await dialog.isVisible(), `${flow}/${mode}: erro fechou diálogo`);
          same(await dialog.getByLabel('Descrição', { exact: true }).inputValue(), 'Rascunho preservado', `${flow}/${mode}: perdeu descrição`);
          same(await dialog.getByLabel('Valor (R$)', { exact: true }).inputValue(), '77.50', `${flow}/${mode}: perdeu valor`);
          same((await calls()).slice(offset).map((c) => c.method), [flow === 'create' ? 'POST' : 'PUT'], `${flow}/${mode}: disparou GET`);
          points.push({ flow, mode, open: true, focus: await page.evaluate(() => window.qa.focus()) });
        }

        await attachUnmountWatch(dialog);
        await btn(dialog, 'Cancelar').click();
        const closedPoint = await closed(dialog);
        require(sameFocus(beforeTrigger, closedPoint.focus), `${flow}: Cancelar após erro não retornou à origem`);
      }
      return { points, violations: [] };
    });

    // 4. Resposta tardia de A não fecha B já aberto e preserva rascunho de B
    await scenario('recorrencias/gravacao/A-tardia-nao-fecha-B', async () => {
      await btn(page, 'Editar Assinatura A').click();
      const dialogA = page.getByRole('dialog', { name: 'Editar Transação Recorrente', exact: true });
      await dialogA.waitFor();
      await dialogA.getByLabel('Descrição', { exact: true }).fill('Rascunho A');
      await page.evaluate(() => { window.qa.mode = 'hold-write'; });
      await btn(dialogA, 'Salvar').click();
      await page.waitForFunction(() => Boolean(window.qa.pending.write));

      await attachUnmountWatch(dialogA);
      await page.keyboard.press('Escape');
      await closed(dialogA);

      await btn(page, 'Editar Receita B').click();
      const dialogB = page.getByRole('dialog', { name: 'Editar Transação Recorrente', exact: true });
      await dialogB.waitFor();
      await dialogB.getByLabel('Descrição', { exact: true }).fill('Rascunho B');

      await page.evaluate(() => {
        window.qa.mode = 'hold-read-after-write';
        window.qa.reply('write', 'ok');
      });
      await page.waitForFunction(() => Boolean(window.qa.pending.read));
      await page.getByText('Transação recorrente atualizada!', { exact: true }).waitFor({ state: 'attached' });
      await frame();
      require(await dialogB.isVisible(), 'Resposta OK de A fechou diálogo B antes do GET');
      same(await dialogB.getByLabel('Descrição', { exact: true }).inputValue(), 'Rascunho B', 'B perdeu rascunho antes do GET');
      const focusWhileReadPending = await page.evaluate(() => window.qa.focus());
      require(await dialogB.evaluate((node) => node.contains(document.activeElement)), 'Foco saiu do diálogo B com GET pendente');

      await page.evaluate(() => window.qa.reply('read', 'ok'));
      await frame();
      require(await dialogB.isVisible(), 'Resposta OK de A fechou diálogo B após GET');
      same(await dialogB.getByLabel('Descrição', { exact: true }).inputValue(), 'Rascunho B', 'B perdeu rascunho após GET');
      const focusAfterRead = await page.evaluate(() => window.qa.focus());

      return { focusWhileReadPending, focusAfterRead, violations: [] };
    });

    // 5. Exclusão: falha HTTP/transporte preserva confirmação; early/late testam fallback e foco pós-GET
    await scenario('recorrencias/exclusao/falhas', async () => {
      const trigger = btn(page, 'Excluir Assinatura A');
      await trigger.focus();
      const before = await trigger.evaluate((node) => window.qa.focus(node));
      await trigger.click();
      const dialog = page.getByRole('alertdialog', { name: 'Excluir Transação Recorrente', exact: true });
      await dialog.waitFor();

      const failurePoints = [];
      for (const mode of ['http', 'transport']) {
        const offset = (await calls()).length;
        await page.evaluate((m) => { window.qa.mode = m; }, mode);
        await btn(dialog, 'Excluir').click();
        await page.locator('[data-sonner-toast][data-type=error]').first().waitFor({ state: 'attached' });
        require(await dialog.isVisible(), `DELETE ${mode}: fechou confirmação`);
        same((await calls()).slice(offset).map((c) => c.method), ['DELETE'], `DELETE ${mode}: disparou GET`);
        failurePoints.push({ mode, open: true, focus: await page.evaluate(() => window.qa.focus()) });
      }

      await attachUnmountWatch(dialog);
      await btn(dialog, 'Cancelar').click();
      const cancelled = await closed(dialog);
      require(sameFocus(before, cancelled.focus), 'Cancelar após falha de DELETE não retornou à origem');
      return { failurePoints, cancelledFocus: cancelled.focus, violations: [] };
    });

    for (const order of ['early', 'late']) {
      await scenario(`recorrencias/exclusao/${order}`, async () => {
        const trigger = btn(page, 'Excluir Assinatura A');
        await trigger.focus();
        await trigger.click();
        const dialog = page.getByRole('alertdialog', { name: 'Excluir Transação Recorrente', exact: true });
        await dialog.waitFor();
        await attachUnmountWatch(dialog);
        await page.evaluate((mode) => { window.qa.mode = mode; }, `delete-${order}`);

        const offset = (await calls()).length;
        await btn(dialog, 'Excluir').click();
        await page.waitForFunction(() => Boolean(window.qa.pending.write));
        require(await dialog.isVisible(), `${order}: DELETE pendente fechou confirmação`);

        await page.evaluate(() => window.qa.reply('write', 'ok'));
        const closePoint = await closed(dialog);
        const createFocus = await btn(page, 'Nova transação recorrente').evaluate((node) => window.qa.focus(node));

        if (order === 'late') {
          require(closePoint.pendingRead && !closePoint.readReleased && closePoint.aInList, `late: GET não ficou retido no fechamento: ${JSON.stringify(closePoint)}`);
          await page.evaluate(() => window.qa.reply('read', 'ok'));
        }

        await btn(page, 'Editar Assinatura A').waitFor({ state: 'detached' });
        await btn(page, 'Editar Receita B').waitFor();
        await frame();
        const afterReadFocus = await page.evaluate(() => window.qa.focus());

        const trace = (await calls()).slice(offset).map((c) => ({ method: c.method, url: c.url, ...(c.body ? { body: c.body } : {}) }));
        same(trace, [
          { method: 'DELETE', url: '/api/recurring', body: { id: 'a' } },
          { method: 'GET', url: '/api/recurring' },
        ], `${order}: sequência DELETE+GET`);

        const violations = [];
        if (!sameFocus(createFocus, closePoint.focus)) {
          violations.push('fechamento após limpar origem não focou fallback Nova transação recorrente');
        }
        if (!afterReadFocus.connected || !afterReadFocus.focused || afterReadFocus.role === 'body') {
          violations.push('foco não sobreviveu após GET de exclusão');
        }
        return { closePoint, afterReadFocus, createFocus, violations };
      });
    }

    return results;
  } finally {
    page.off('pageerror', onError);
    await page.unroute('**/*', routeAll);
  }
}

const { QUIET_QA_SCRATCH, HOME, TMPDIR, CI } = process.env;
assert(isAbsolute(QUIET_QA_SCRATCH ?? '') && CI === '1',
  'Forneça scratch privado e CI=1 no sandbox aprovado; não execute no host.');
assert(isAbsolute(process.env[baselineSpec.env] ?? ''),
  `Forneça ${baselineSpec.env} absoluto com a fonte RO do ref ${baseRef}`);
const scratch = await realpath(QUIET_QA_SCRATCH);
for (const key of ['HOME', 'TMPDIR', 'XDG_CACHE_HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_RUNTIME_DIR']) {
  const val = process.env[key];
  assert(val && (await realpath(val)).startsWith(`${scratch}/`), `${key} fora do scratch privado`);
}
assert(HOME !== TMPDIR);
for (const forbidden of ['.git', '.env', 'prisma/.env', 'db']) {
  await assert.rejects(access(join(root, forbidden)), { code: 'ENOENT' }, `${forbidden} não deve ser montado`);
}
assert(!('DATABASE_URL' in process.env), 'Fixture não usa banco');

const digest = (contents) => createHash('sha256').update(contents).digest('hex');
const baselineContents = await readFile(process.env[baselineSpec.env], 'utf8');
assert.equal(digest(baselineContents), baselineSpec.hash, `SHA-256 inválido em ${baselineSpec.env} (${baselineSpec.file})`);

const dir = await mkdtemp(join(scratch, 'quiet-recurring-focus-'));
const session = `quiet-recurring-focus-${randomUUID()}`;
const failures = [];
let attemptedOpen = false;
let daemonPid;
const deadline = Date.now() + 420_000;

async function cli(...args) {
  const cleanup = ['close', 'list'].includes(args[0]);
  const timeout = cleanup ? 5000 : Math.min(120_000, deadline - Date.now());
  assert(timeout > 0, 'Prazo do controlador encerrado');
  const cmd = Bun.spawn(['playwright-cli', `-s=${session}`, ...args], {
    cwd: dir, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', timeout,
  });
  const [stdout, stderr, exit] = await Promise.all([
    new Response(cmd.stdout).text(), new Response(cmd.stderr).text(), cmd.exited,
  ]);
  assert(exit === 0 && !/^### Error\b/m.test(stdout), `${args[0]} (exit ${exit}): ${stdout}\n${stderr}`);
  return stdout;
}

try {
  assert.equal(JSON.parse(await cli('--version', '--json')).version, '0.1.22', 'Versão do CLI exige revisão de capacidades');
  assert.match(await cli('open', '--help'), /--idle-timeout/);

  const { default: postcss } = await import('postcss');
  const { default: tailwindcss } = await import('@tailwindcss/postcss');
  const cssFile = join(root, 'src/app/globals.css');
  const { css } = await postcss([tailwindcss({ base: root })]).process(await readFile(cssFile, 'utf8'), { from: cssFile, map: false });
  assert(css.includes('--ds-focus') && css.includes('.bg-background'), 'CSS compilado sem tokens/utilitários');

  const entry = `import { RecurringTransactionsWidget } from ${JSON.stringify(recurringPath)};
    import { createElement } from 'react';
    import { createRoot } from 'react-dom/client';
    import { ThemeProvider } from 'next-themes';
    import { Toaster } from 'sonner';
    (${installFixture.toString()})(RecurringTransactionsWidget, createElement, createRoot, ThemeProvider, Toaster);`;

  async function htmlFor(label, useBaseline) {
    let intercepted = false;
    const bundle = await Bun.build({
      entrypoints: [source],
      target: 'browser',
      format: 'iife',
      minify: true,
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{
        name: 'fixture-recurring-focus',
        setup(build) {
          build.onLoad({ filter: /quiet-recurring-focus\.qa\.mjs$/ }, () => ({ contents: entry, loader: 'ts' }));
          if (useBaseline) {
            build.onLoad(
              { filter: /\/recurring-transactions\.tsx$/ },
              (args) => {
                if (args.path !== recurringPath) return undefined;
                intercepted = true;
                return { contents: baselineContents, loader: 'tsx' };
              },
            );
          }
        },
      }],
    });
    assert(bundle.success && bundle.outputs.length === 1, `Bundle incompleto: ${label}`);
    if (useBaseline) assert(intercepted, 'Baseline não interceptou recurring-transactions.tsx');
    const file = join(dir, `${label}.html`);
    const script = (await bundle.outputs[0].text()).replace(/<\/script/gi, '<\\/script');
    await writeFile(
      file,
      `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><style>${css.replace(/<\/style/gi, '<\\/style')}</style><body class="antialiased bg-background text-foreground"><div id="root"></div><script>${script}</script></body></html>`,
    );
    return file;
  }

  const html = { baseline: await htmlFor('baseline', true), candidate: await htmlFor('candidate', false) };
  const candidateHashes = {
    'recurring-transactions.tsx': digest(await readFile(recurringPath)),
    'recurring-transaction-editor.tsx': digest(await readFile(editorPath)),
    'recurring-delete-confirmation.tsx': digest(await readFile(deletePath)),
    'finance-dialog-shell.tsx': digest(await readFile(shellPath)),
  };
  console.log(JSON.stringify({ session, baseRef, candidateHashes }));

  attemptedOpen = true;
  const opened = JSON.parse(await cli('open', 'about:blank', '--browser=chrome', '--idle-timeout=120000', '--json'));
  assert.equal(opened.session, session);
  assert(Number.isInteger(opened.pid) && opened.pid > 1, 'Daemon sem PID verificável');
  daemonPid = opened.pid;
  await cli('snapshot');

  const gaps = [];
  let count = 0;
  const expectedCount = 7;

  for (const width of [360, 390, 1440]) {
    const backgrounds = [];
    for (const theme of ['light', 'dark']) {
      const observed = {};
      for (const label of ['baseline', 'candidate']) {
        const outcome = await cli('run-code', `(page) => (${runCases.toString()})(page, ${JSON.stringify(html[label])}, ${width}, ${JSON.stringify(theme)})`);
        const result = outcome.match(/^### Result\s*\n([^\n]+)/m)?.[1];
        assert(result, `${label}: ausência de resultado do DOM`);
        observed[label] = JSON.parse(result);
        assert.equal(observed[label].length, expectedCount, `${label}: cenário incompleto (${observed[label].length} vs ${expectedCount})`);
      }

      count += observed.candidate.length;
      console.log(JSON.stringify({ session, baseRef, width, theme, scenarios: observed.candidate.length }));

      if (!Bun.deepEquals(observed.baseline, observed.candidate)) {
        gaps.push(`${width}/${theme}: divergência de paridade`);
      }

      for (const entryResult of observed.candidate) {
        const baseEntry = observed.baseline.find(({ name }) => name === entryResult.name);
        for (const violation of entryResult.violations) {
          gaps.push(`${width}/${theme} ${entryResult.name}: ${baseEntry?.violations.includes(violation) ? 'preexistente: ' : ''}${violation}`);
        }
      }

      const witness = observed.candidate.find(({ name }) => name === 'testemunha do tema e viewport')?.witness;
      assert(witness && witness.width === width && witness.theme === theme && !witness.overflow, `Testemunha inválida em ${width}/${theme}`);
      backgrounds.push(witness.background);
    }
    if (backgrounds[0] === backgrounds[1]) gaps.push(`${width}: fundo claro/escuro idêntico`);
  }

  assert.deepEqual(gaps, [], 'Falha no contrato Quiet/paridade');
  console.log(`${count} cenários pareados; 0 skips.`);
} catch (error) {
  failures.push(error);
} finally {
  const cleanup = async (label, action) => {
    try { await action(); } catch (error) { failures.push(new Error(`${label}: ${error.message}`, { cause: error })); }
  };
  if (attemptedOpen) {
    const beforeCleanup = failures.length;
    await cleanup('close', async () => {
      const closed = JSON.parse(await cli('close', '--json'));
      assert.equal(closed.session, session);
      assert.equal(closed.status, 'closed', 'Fechamento da sessão não comprovado');
    });
    await cleanup('list', async () => {
      const { browsers } = JSON.parse(await cli('list', '--json'));
      assert(Array.isArray(browsers) && !browsers.some(({ name }) => name === session), 'Sessão ainda ativa');
    });
    await cleanup('daemon', async () => {
      assert(Number.isInteger(daemonPid), 'PID não observado ao abrir');
      for (let attempt = 0; attempt < 20; attempt++) {
        try { await access(`/proc/${daemonPid}`); } catch (error) {
          if (error.code === 'ENOENT') return;
          throw error;
        }
        await delay(50);
      }
      throw new Error('Daemon ainda presente');
    });
    if (failures.length === beforeCleanup) console.log(`Sessão exclusiva encerrada: ${session}`);
  }
  await cleanup('scratch', () => rm(dir, { recursive: true, force: true }));
}

if (failures.length) throw new AggregateError(failures, 'QA de Recorrências não concluído');
