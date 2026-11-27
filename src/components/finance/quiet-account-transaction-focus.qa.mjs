// Somente no sandbox autorizado pelo preflight de 0005 (inclusive bundle e CLI).
// QUIET_QA_BASELINE_VIEW: fonte RO de accounts-view.tsx do commit fixado abaixo.
// QUIET_QA_SCRATCH: tmpfs privado, também pai de HOME/TMPDIR/XDG_*; sem .git ou banco.
// O supervisor do executor prova a fronteira do SO e garante o teardown da árvore.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { access, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const baseRef = '25b44535c5068b99044afa03f7ecf318e7a9726f';
const baselineHash = '4cb86fd747b2388301c6d5ee7b91391fb8376376f705514d10dc472e0b1a1758';
const shellHash = '51f21def374a054cf61c5405ae2eb493e1143586646905d90103079925c74b95';
const source = fileURLToPath(import.meta.url);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const view = join(root, 'src/components/finance/accounts-view.tsx');
const shell = join(root, 'src/app/page.tsx');

function installFixture(Page, ThemeProvider, AppIntlProvider, getMessagesForLocale, createElement, createRoot) {
  const accounts = ['a', 'b'].map((id) => ({
    id, name: `Conta ${id.toUpperCase()}`, type: 'BANK', balance: 20, color: '#22c55e', icon: 'wallet', isActive: true,
  }));
  const transaction = [{ id: 'tx-a', description: 'Movimento sintético', amount: 7.25, type: 'EXPENSE', date: '2026-02-03' }];
  const qa = window.qa = { calls: [], unexpected: [], pending: null, revision: 0, listeners: new Set() };
  let empty = false;
  let hold = false;
  qa.refresh = () => {
    hold = true;
    qa.revision++;
    for (const update of qa.listeners) update();
  };
  qa.reply = () => {
    const resolve = qa.pending;
    if (!resolve) throw new Error('Releitura não está pendente');
    qa.pending = null;
    resolve(Response.json(transaction));
  };
  window.fetch = async (url, init) => {
    const method = init?.method ?? 'GET';
    qa.calls.push({ method, url });
    if (method === 'GET') {
      if (url === '/api/accounts') return Response.json(empty ? [] : accounts);
      if (url === '/api/categories') return Response.json([]);
      if (url === '/api/transactions?accountId=a') {
        if (hold) {
          hold = false;
          return new Promise((resolve) => { qa.pending = resolve; });
        }
        return Response.json(transaction);
      }
      if (url === '/api/transactions?accountId=b' || /^\/api\/transactions\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/.test(url)) {
        return Response.json([]);
      }
    }
    qa.unexpected.push(`${method} ${url}`);
    throw new Error('Fetch fora da fixture de foco');
  };
  qa.mount = (theme, isEmpty, locale = 'pt') => {
    empty = isEmpty;
    createRoot(document.getElementById('root')).render(
      createElement(
        ThemeProvider,
        { attribute: 'class', forcedTheme: theme, disableTransitionOnChange: true },
        createElement(AppIntlProvider, { locale, messages: getMessagesForLocale(locale) }, createElement(Page)),
      ),
    );
  };
}

// Função serializada para a VM do CLI: não depende de módulos/globals Node.
async function runCases(page, html, width, theme, localeFlagBodies) {
  const url = 'https://finance-qa.invalid/';
  const results = [];
  const errors = [];
  const blocked = [];
  const onError = (error) => errors.push(error.message);
  const routeAll = (route) => {
    const request = route.request();
    const reqUrl = request.url();
    if (reqUrl === url && request.method() === 'GET' && request.isNavigationRequest()) {
      return route.fulfill({ path: html, contentType: 'text/html; charset=utf-8' });
    }
    if (request.method() === 'GET' && reqUrl.startsWith(url)) {
      const reqPath = reqUrl.slice(url.length - 1);
      if (localeFlagBodies && Object.hasOwn(localeFlagBodies, reqPath)) {
        return route.fulfill({
          status: 200,
          contentType: 'image/svg+xml; charset=utf-8',
          body: localeFlagBodies[reqPath],
        });
      }
    }
    blocked.push(reqUrl);
    return route.abort();
  };
  const button = (name, within = page) => within.getByRole('button', { name, exact: true });
  const dialog = (name) => page.getByRole('dialog', { name, exact: true });
  const local = 'Nova transação';
  const global = 'Novo lançamento';
  const quick = 'Ações rápidas';
  const edit = 'Editar transação Movimento sintético';
  const newTx = 'Nova Transação';
  const editTx = 'Editar Transação';
  let witness;
  const invariant = (condition, message) => { if (!condition) throw new Error(message); };
  async function focused(name, phase) {
    const target = button(name);
    await target.waitFor();
    // Radix restaura o foco após o desmonte, via timer. Aguardar o estado observável.
    const handle = await target.elementHandle();
    try {
      await page.waitForFunction((node) => node.isConnected && document.activeElement === node, handle, { timeout: 1500 });
    } catch {
      // Retornar a divergência em vez de perder a observação do baseline.
    } finally { await handle.dispose(); }
    return target.evaluate((node, point) => ({
      phase: point, target: node.getAttribute('aria-label') ?? node.textContent.trim(),
      connected: node.isConnected, focused: document.activeElement === node,
      actual: document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName ?? null,
    }), phase);
  }
  async function ready(title, next) {
    const open = dialog(title);
    await open.waitFor();
    if (next) await button(next, open).waitFor();
    const geometry = await open.evaluate((node) => {
      const { left, right, top, bottom } = node.getBoundingClientRect();
      return { shell: document.documentElement.scrollWidth <= innerWidth + 1, dialog: node.scrollWidth <= node.clientWidth + 1,
        visible: left >= -1 && right <= innerWidth + 1 && top >= -1 && bottom <= innerHeight + 1 };
    });
    invariant(Object.values(geometry).every(Boolean), `Janela visual de ${title}: ${JSON.stringify(geometry)}`);
    return open;
  }
  async function detail() {
    await page.getByRole('button', { name: 'Contas', exact: true }).click();
    await button('Abrir conta Conta A').click();
    await button(edit).waitFor();
  }
  async function choose(origin, { empty = false } = {}) {
    if (origin === global) await button(global).click();
    else {
      await button(quick).click();
      await page.getByRole('menuitem', { name: 'Nova Transação', exact: true }).click();
    }
    const chooser = await ready(global, empty ? 'Cadastrar conta' : 'Conta B');
    invariant(await dialog(newTx).count() === 0, 'Conta escolhida antes da ação explícita');
    return chooser;
  }
  async function pickChooserOption(chooser, option) {
    const chooserNode = await chooser.elementHandle();
    invariant(chooserNode, 'Seletor sem nó DOM para aguardar desmonte');
    try {
      await button(option, chooser).click();
      await page.waitForFunction(
        (node) => !node.isConnected && !document.querySelector('[data-slot="dialog-content"][data-state="closed"], [data-slot="dialog-overlay"][data-state="closed"]'),
        chooserNode,
      );
    } finally {
      await chooserNode.dispose();
    }
  }
  async function close(title, how) {
    const editor = dialog(title);
    if (how === 'Escape') await page.keyboard.press('Escape');
    else await button('Cancelar', editor).click();
    await page.waitForFunction(() => !document.querySelector('[data-slot="dialog-content"]'));
  }
  async function scenario(name, run, empty = false) {
    await page.goto(url);
    await page.evaluate(({ theme, empty }) => window.qa.mount(theme, empty), { theme, empty });
    await button(global).waitFor();
    await page.waitForFunction((skin) => document.documentElement.classList.contains(skin), theme);
    const viewport = await page.evaluate(() => ({ width: innerWidth, background: getComputedStyle(document.body).backgroundColor }));
    invariant(viewport.width === width && viewport.background !== 'rgba(0, 0, 0, 0)', 'Viewport ou tema sem testemunha efetiva');
    witness ??= viewport;
    invariant(viewport.background === witness.background, 'Tema mudou entre cenários');
    const points = await run();
    const network = await page.evaluate(() => ({
      writes: window.qa.calls.filter(({ method }) => method !== 'GET'), unexpected: window.qa.unexpected,
    }));
    invariant(network.writes.length === 0 && network.unexpected.length === 0, `Rede de ${name}: ${JSON.stringify(network)}`);
    results.push({ name, points });
  }

  await page.setViewportSize({ width, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
  page.setDefaultTimeout(3500);
  page.on('pageerror', onError);
  await page.route('**/*', routeAll);
  try {
    for (const how of ['Cancelar', 'Escape']) {
      await scenario(`criação local / ${how}`, async () => {
        await detail();
        await button(local).click();
        const open = await ready(newTx, 'Registrar');
        await open.getByLabel('Descrição', { exact: true }).fill('Rascunho sintético');
        await close(newTx, how);
        return [await focused(local, 'após fechar')];
      });
      await scenario(`edição local / ${how}`, async () => {
        await detail();
        await button(edit).click();
        await ready(editTx, 'Salvar');
        await close(editTx, how);
        return [await focused(edit, 'após fechar')];
      });
      await scenario(`edição local sem origem / ${how}`, async () => {
        await detail();
        await button(edit).click();
        await ready(editTx, 'Salvar');
        const origin = await page.getByRole('button', { name: edit, exact: true, includeHidden: true }).elementHandle();
        try {
          await page.evaluate(() => window.qa.refresh());
          await page.waitForFunction(() => typeof window.qa.pending === 'function');
          await page.waitForFunction((node) => !node.isConnected, origin);
          await close(editTx, how);
          const fallback = await focused(local, 'origem desmontada, GET pendente');
          await page.evaluate(() => window.qa.reply());
          await button(edit).waitFor();
          return [fallback, await focused(local, 'após releitura')];
        } finally { await origin.dispose(); }
      });
      await scenario(`atalho direto / escolha de conta / ${how}`, async () => {
        // Começa com Conta A selecionada; o atalho ainda precisa pedir a conta.
        await detail();
        const chooser = await choose(global);
        await pickChooserOption(chooser, 'Conta B');
        const editor = await ready(newTx, 'Registrar');
        await editor.getByText('Registrar nova transação em Conta B', { exact: true }).waitFor();
        await close(newTx, how);
        return [await focused(global, 'após fechar')];
      });
      await scenario(`ações rápidas / seletor / ${how}`, async () => {
        await choose(quick);
        await close(global, how);
        return [await focused(quick, 'após fechar')];
      });
      await scenario(`ações rápidas / editor / ${how}`, async () => {
        const chooser = await choose(quick);
        await pickChooserOption(chooser, 'Conta A');
        await ready(newTx, 'Registrar');
        await close(newTx, how);
        return [await focused(quick, 'após fechar')];
      });
      await scenario(`ações rápidas sem iniciador / ${how}`, async () => {
        const chooser = await choose(quick);
        await pickChooserOption(chooser, 'Conta A');
        await ready(newTx, 'Registrar');
        const origin = page.getByRole('button', { name: quick, exact: true, includeHidden: true });
        // A origem fica montada no shell real; desconexão controlada somente na fixture.
        invariant(await origin.evaluate((node) => { node.remove(); return !node.isConnected; }), 'Iniciador ainda conectado');
        await close(newTx, how);
        return [await focused(global, 'fallback do shell')];
      });
      await scenario(`sem contas / cadastro / ${how}`, async () => {
        const chooser = await choose(global, { empty: true });
        await chooser.getByText('Cadastre uma conta antes de registrar um lançamento.', { exact: true }).waitFor();
        await pickChooserOption(chooser, 'Cadastrar conta');
        await ready('Nova Conta');
        await close('Nova Conta', how);
        return [await focused(global, 'após fechar cadastro')];
      }, true);
    }
    invariant(errors.length === 0 && blocked.length === 0, JSON.stringify({ errors, blocked }));
    return { witness, results };
  } finally {
    page.off('pageerror', onError);
    await page.unroute('**/*', routeAll);
  }
}

const { QUIET_QA_BASELINE_VIEW, QUIET_QA_SCRATCH, CI } = process.env;
assert(isAbsolute(QUIET_QA_BASELINE_VIEW ?? '') && isAbsolute(QUIET_QA_SCRATCH ?? '') && CI === '1',
  'Requer baseline RO, scratch privado e CI=1 na fronteira aprovada; não execute no host.');
const scratch = await realpath(QUIET_QA_SCRATCH);
for (const key of ['HOME', 'TMPDIR', 'XDG_CACHE_HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_RUNTIME_DIR']) {
  assert(process.env[key] && (await realpath(process.env[key])).startsWith(`${scratch}/`), `${key} fora do scratch`);
}
assert(process.env.HOME !== process.env.TMPDIR);
for (const forbidden of ['.git', '.env', 'prisma/.env', 'db']) {
  await assert.rejects(access(join(root, forbidden)), { code: 'ENOENT' });
}
assert(!('DATABASE_URL' in process.env), 'Fixture não usa banco');
const digest = (contents) => createHash('sha256').update(contents).digest('hex');
const baseline = await readFile(QUIET_QA_BASELINE_VIEW, 'utf8');
assert.equal(digest(baseline), baselineHash, 'Contas base não corresponde ao commit fixado');
assert.equal(digest(await readFile(shell)), shellHash, 'Shell mudou em relação ao commit fixado');

const dir = await mkdtemp(join(scratch, 'quiet-account-focus-'));
const session = `quiet-account-focus-${randomUUID()}`;
const errors = [];
let attemptedOpen = false;
let daemonPid;
async function cli(...args) {
  const proc = Bun.spawn(['playwright-cli', `-s=${session}`, ...args], {
    cwd: dir, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', timeout: 90000,
  });
  const [stdout, stderr, exit] = await Promise.all([
    new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited,
  ]);
  assert(exit === 0 && !/^### Error\b/m.test(stdout), `${args[0]} (exit ${exit}): ${stdout}\n${stderr}`);
  return stdout;
}

try {
  // Shell, Contas, store, navegação, React e portais reais; apenas superfícies fora da folha e transporte trocados.
  const emptyModules = new Map(Object.entries({
    'dashboard-view': 'DashboardView', 'quick-stats-overview': 'QuickStatsOverview', 'smart-insights': 'SmartInsights',
    'cash-flow-forecast': 'CashFlowForecast', 'spending-timeline': 'SpendingTimeline', 'savings-challenge': 'SavingsChallenge',
    'expense-breakdown': 'ExpenseBreakdown', 'balance-projection': 'BalanceProjection', 'financial-calendar': 'FinancialCalendar',
    'networth-evolution': 'NetworthEvolution', 'debt-overview': 'DebtOverview', 'transaction-analytics': 'TransactionAnalytics',
    'goals-dashboard': 'GoalsDashboard', 'receipt-generator': 'ReceiptGenerator', 'achievement-badges': 'AchievementBadges',
    'ai-advisor': 'AIAdvisor', 'cards-view': 'CardsView', 'purchases-view': 'PurchasesView', 'categories-view': 'CategoriesView',
    'investments-view': 'InvestmentsView', 'installments-view': 'InstallmentsView', 'consortiums-view': 'ConsortiumsView', 'savings-view': 'SavingsView',
  }));
  const entry = `import Page from ${JSON.stringify(shell)};
    import { createElement } from 'react'; import { createRoot } from 'react-dom/client';
    import { ThemeProvider } from 'next-themes';
    import { AppIntlProvider } from ${JSON.stringify(join(root, 'src/i18n/provider.tsx'))};
    import { getMessagesForLocale } from ${JSON.stringify(join(root, 'src/i18n/messages.ts'))};
    (${installFixture.toString()})(Page, ThemeProvider, AppIntlProvider, getMessagesForLocale, createElement, createRoot);`;
  const realtime = `import { useSyncExternalStore } from 'react';
    const subscribe = (cb) => { window.qa.listeners.add(cb); return () => window.qa.listeners.delete(cb); };
    const get = () => window.qa.revision;
    export function useRealtime() { return { isConnected: false, refreshCounter: useSyncExternalStore(subscribe, get, get), reconnect: () => {} }; }`;
  const { default: postcss } = await import('postcss');
  const { default: tailwindcss } = await import('@tailwindcss/postcss');
  const cssFile = join(root, 'src/app/globals.css');
  const { css } = await postcss([tailwindcss({ base: root })]).process(await readFile(cssFile, 'utf8'), { from: cssFile, map: false });
  assert(css.includes('--ds-focus') && css.includes('.bg-background'), 'CSS compilado sem tokens/utilitários');
  async function htmlFor(label, original) {
    const bundle = await Bun.build({
      entrypoints: [source], target: 'browser', format: 'iife', minify: true,
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{ name: 'fixture em memória de Contas', setup(build) {
        build.onLoad({ filter: /quiet-account-transaction-focus\.qa\.mjs$/ }, () => ({ contents: entry, loader: 'ts' }));
        build.onLoad({ filter: /\/use-realtime\.ts$/ }, () => ({ contents: realtime, loader: 'ts' }));
        build.onLoad({ filter: /\/components\/finance\/[\w-]+\.tsx$/ }, (args) => {
          if (original && args.path === view) return { contents: original, loader: 'tsx' };
          const component = emptyModules.get(args.path.split('/').at(-1).slice(0, -4));
          if (component) return { contents: `export function ${component}() { return null; }`, loader: 'ts' };
        });
      } }],
    });
    assert(bundle.success && bundle.outputs.length === 1, `Bundle incompleto: ${label}`);
    const html = join(dir, `${label}.html`);
    const script = (await bundle.outputs[0].text()).replace(/<\/script/gi, '<\\/script');
    await writeFile(html, `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><style>${css.replace(/<\/style/gi, '<\\/style')}</style><body class="antialiased bg-background text-foreground"><div id="root"></div><script>${script}</script></body></html>`);
    return html;
  }
  const html = { baseline: await htmlFor('baseline', baseline), candidate: await htmlFor('candidate') };
  console.log(JSON.stringify({ session, baseRef, baselineHash, shellHash, view: digest(await readFile(view)),
    fields: digest(await readFile(join(root, 'src/components/finance/account-transaction-fields.tsx'))) }));

  const version = JSON.parse(await cli('--version', '--json')).version;
  assert.equal(version, '0.1.22', 'Confirme as capacidades da versão efetiva antes de adaptar');
  assert.match(await cli('open', '--help'), /--idle-timeout/);
  attemptedOpen = true;
  const opened = JSON.parse(await cli('open', 'about:blank', '--browser=chrome', '--idle-timeout=120000', '--json'));
  assert.equal(opened.session, session);
  assert(Number.isInteger(opened.pid) && opened.pid > 1, 'Daemon sem PID verificável');
  daemonPid = opened.pid;
  await cli('snapshot');
  const localeFlagBodies = Object.fromEntries(
    await Promise.all(
      ['pt', 'es', 'en'].map(async (code) => [
        `/locale-flags/${code}.svg`,
        await readFile(join(root, 'public/locale-flags', `${code}.svg`), 'utf8'),
      ]),
    ),
  );
  const gaps = [];
  let count = 0;
  for (const width of [360, 390, 1440]) {
    const backgrounds = [];
    for (const theme of ['light', 'dark']) {
      const observed = {};
      for (const label of ['baseline', 'candidate']) {
        const report = await cli('run-code', `(page) => (${runCases.toString()})(page, ${JSON.stringify(html[label])}, ${width}, ${JSON.stringify(theme)}, ${JSON.stringify(localeFlagBodies)})`);
        const result = report.match(/^### Result\s*\n([^\n]+)/m)?.[1];
        assert(result, `${label}: resultado DOM ausente`);
        observed[label] = JSON.parse(result);
        assert.equal(observed[label].results.length, 16, `${label}: cenário não executado`);
      }
      count += observed.candidate.results.length;
      backgrounds.push(observed.candidate.witness.background);
      console.log(JSON.stringify({ width, theme, ...observed }));
      if (!Bun.deepEquals(observed.baseline, observed.candidate)) gaps.push(`${width}/${theme}: divergência pareada`);
      for (const { name, points } of observed.candidate.results) {
        if (!points.length || points.some((point) => !point.connected || !point.focused)) {
          gaps.push(`${width}/${theme}: ${name} fora do requisito de foco`);
        }
      }
    }
    assert.notEqual(backgrounds[0], backgrounds[1], `Fundos claro/escuro iguais em ${width}px`);
  }
  assert.deepEqual(gaps, [], 'Divergências de paridade ou foco (incluindo possível desvio preexistente)');
  console.log(`${count} cenários pareados; 0 skips.`);
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
    if (errors.length === before) console.log(`Sessão exclusiva encerrada: ${session}`);
  }
  await cleanup('scratch', () => rm(dir, { recursive: true, force: true }));
}
if (errors.length) throw new AggregateError(errors, 'QA de foco de Contas não concluído');
