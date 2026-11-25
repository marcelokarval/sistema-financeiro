// Execute somente dentro do preflight único de navegador de 0016.
// QUIET_QA_SCRATCH: tmpfs privado, também pai de HOME/TMPDIR/XDG_*; sem .git ou banco.
// Variáveis RO do ref 55fa76d78c14c4410e515e27569b14c07e52eed2:
// QUIET_QA_BASELINE_PAGE, QUIET_QA_BASELINE_SEARCH,
// QUIET_QA_BASELINE_NOTIFICATIONS, QUIET_QA_BASELINE_ADVISOR.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { access, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const baseRef = '55fa76d78c14c4410e515e27569b14c07e52eed2';
const baselineSpecs = [
  {
    env: 'QUIET_QA_BASELINE_PAGE',
    pathSuffix: 'src/app/page.tsx',
    hash: '66c7c5e4bb2bff89f2f7e3cdefcf89bae73f1ac9a2caaac792beebe23d6f1d31',
  },
  {
    env: 'QUIET_QA_BASELINE_SEARCH',
    pathSuffix: 'src/components/finance/global-search.tsx',
    hash: '1065af12dea3388215b46231354ddf220817b04e4afa99f01384a61653f7bcbb',
  },
  {
    env: 'QUIET_QA_BASELINE_NOTIFICATIONS',
    pathSuffix: 'src/components/finance/notification-panel.tsx',
    hash: '1e0611614e1d667fd77981043555539d9ff69336b2844171ce992aa4f7d255ba',
  },
  {
    env: 'QUIET_QA_BASELINE_ADVISOR',
    pathSuffix: 'src/components/finance/ai-advisor.tsx',
    hash: '6f74ccf21fb919aefe304c3df73b74e5327abb2f320b0f883ba8d204c64bcc02',
  },
];

const source = fileURLToPath(import.meta.url);
const financeDir = dirname(source);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const pagePath = join(root, 'src/app/page.tsx');

function installFixture(Page, ThemeProvider, createElement, createRoot, useAppStore) {
  const accounts = [
    { id: 'acc-1', name: 'Conta Principal', type: 'BANK', balance: 2500, color: '#22c55e', icon: 'wallet', isActive: true },
    { id: 'acc-2', name: 'Conta Reserva', type: 'BANK', balance: 1200, color: '#3b82f6', icon: 'wallet', isActive: true },
  ];
  const cards = [
    {
      id: 'card-1', name: 'Cartão Violeta', type: 'CREDIT', brand: 'VISA', lastFourDigits: '4321',
      creditLimit: 5000, currentBalance: 750, closingDay: 5, dueDay: 15, color: '#8b5cf6', flag: 'Nubank',
    },
  ];
  const categories = [
    { id: 'cat-1', name: 'Alimentação', icon: 'utensils', type: 'EXPENSE', color: '#f97316' },
  ];
  const purchases = [
    {
      id: 'pur-1',
      merchant: 'Mercado Central',
      totalAmount: 180.5,
      date: '2026-11-10',
      cardId: 'card-1',
      card: { id: 'card-1', name: 'Cartão Violeta', lastFourDigits: '4321', color: '#8b5cf6' },
      categoryId: 'cat-1',
      category: categories[0],
      notes: 'Compra mensal sintética',
      items: [{ id: 'item-1', name: 'Arroz integral', quantity: 2, unitPrice: 90.25, totalPrice: 180.5 }],
    },
  ];
  const transactions = [
    {
      id: 'tx-1',
      description: 'Salário sintético',
      amount: 4500,
      type: 'INCOME',
      date: '2026-11-05',
      accountId: 'acc-1',
      category: categories[0],
    },
    {
      id: 'tx-missing-acc',
      description: 'Lançamento conta ausente',
      amount: 95,
      type: 'EXPENSE',
      date: '2026-11-06',
      accountId: 'acc-missing',
      category: categories[0],
    },
  ];

  const qa = window.qa = {
    calls: [],
    unexpected: [],
    ghostSearch: false,
    failNotificationsOnce: false,
    store: useAppStore,
    rootInstance: null,
  };

  window.fetch = async (input, init) => {
    const rawUrl = typeof input === 'string' ? input : input.url;
    const url = rawUrl.replace(/^https?:\/\/[^/]+/, '');
    const method = init?.method ?? 'GET';
    qa.calls.push({ method, url });

    if (method === 'GET') {
      if (url === '/api/transactions') {
        if (qa.failNotificationsOnce) {
          qa.failNotificationsOnce = false;
          return Response.json({ error: 'Falha sintética' }, { status: 503 });
        }
        return Response.json(transactions);
      }
      if (url === '/api/transactions?accountId=acc-1') {
        return Response.json([transactions[0]]);
      }
      if (url === '/api/transactions?accountId=acc-2' || url.startsWith('/api/transactions?from=')) {
        return Response.json([]);
      }
      if (url === '/api/accounts') {
        return Response.json(
          qa.ghostSearch
            ? [...accounts, { id: 'acc-missing', name: 'Conta Fantasma', type: 'BANK', balance: 10, color: '#64748b', icon: 'wallet', isActive: true }]
            : accounts,
        );
      }
      if (url === '/api/cards') {
        return Response.json(
          qa.ghostSearch
            ? [...cards, { id: 'card-missing', name: 'Cartão Fantasma', type: 'CREDIT', brand: 'MASTERCARD', lastFourDigits: '9999', creditLimit: 1000, currentBalance: 0, closingDay: 1, dueDay: 10, color: '#64748b', flag: '' }]
            : cards,
        );
      }
      if (url === '/api/purchases') {
        return Response.json(
          qa.ghostSearch
            ? [...purchases, { id: 'pur-missing', merchant: 'Loja Fantasma', totalAmount: 50, date: '2026-11-11', notes: '', items: [] }]
            : purchases,
        );
      }
      if (url === '/api/purchases?cardId=card-1') {
        return Response.json(purchases);
      }
      if (url === '/api/categories') {
        return Response.json(categories);
      }
      if (url === '/api/investments' || url === '/api/installments' || url === '/api/consortiums') {
        return Response.json([]);
      }
    }

    if (method === 'POST' && url === '/api/advisor') {
      return Response.json({ response: 'Resposta sintética do assistente.' });
    }

    qa.unexpected.push(`${method} ${url}`);
    throw new Error(`Fetch fora da fixture: ${method} ${url}`);
  };

  qa.mount = (theme) => {
    window.localStorage.removeItem('finance-notifications-read-at');
    useAppStore.setState({
      currentView: 'dashboard',
      selectedAccountId: null,
      selectedCardId: null,
      selectedPurchaseId: null,
      selectedInvestmentId: null,
      selectedInstallmentPlanId: null,
      selectedConsortiumId: null,
      sidebarOpen: false,
      aiAssistantVisible: false,
      newTransactionRequested: false,
      newGoalRequested: false,
    });
    const host = document.getElementById('root');
    if (qa.rootInstance) qa.rootInstance.unmount();
    qa.rootInstance = createRoot(host);
    qa.rootInstance.render(
      createElement(ThemeProvider, { attribute: 'class', forcedTheme: theme, disableTransitionOnChange: true }, createElement(Page)),
    );
  };
}

// Função serializada para a VM do Playwright CLI: não depende de módulos Node.
async function runCases(page, html, width, theme, phase) {
  const url = 'https://finance-qa.invalid/';
  const results = [];
  const errors = [];
  const blocked = [];
  const onError = (error) => errors.push(error.message);
  const routeAll = (route) => {
    const request = route.request();
    if (request.url() === url && request.method() === 'GET' && request.isNavigationRequest()) {
      return route.fulfill({ path: html, contentType: 'text/html; charset=utf-8' });
    }
    blocked.push(request.url());
    return route.abort();
  };

  const require = (condition, message) => { if (!condition) throw new Error(message); };
  const btn = (name, within = page) => within.getByRole('button', { name, exact: true });
  const heading = (level, name) => page.getByRole('heading', { level, name, exact: true });

  async function mountFresh() {
    await page.goto(url);
    await page.evaluate((skin) => window.qa.mount(skin), theme);
    await btn('Abrir busca global').waitFor();
    await page.waitForFunction((skin) => document.documentElement.classList.contains(skin), theme);
    const witness = await page.evaluate(() => {
      const mobileNav = document.querySelector('nav[aria-label="Navegação móvel"]');
      const bg = getComputedStyle(document.body).backgroundColor;
      return {
        width: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        themeClass: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
        background: bg,
        mobileNavDisplay: mobileNav ? getComputedStyle(mobileNav).display : null,
      };
    });
    require(witness.width === width, `Largura inesperada: ${witness.width} vs ${width}`);
    require(witness.scrollWidth <= width + 1, `Overflow horizontal no shell: ${witness.scrollWidth} > ${width}`);
    require(witness.themeClass === theme, `Tema não aplicado: ${witness.themeClass}`);
    require(witness.background && witness.background !== 'rgba(0, 0, 0, 0)', 'Fundo transparente');
    if (width < 768) require(witness.mobileNavDisplay && witness.mobileNavDisplay !== 'none', 'MobileNav oculta em viewport móvel');
    else require(witness.mobileNavDisplay === 'none', 'MobileNav visível em desktop');
    return witness;
  }

  async function waitSearchClosed() {
    await page.waitForFunction(() => !document.querySelector('[data-slot="dialog-content"]'));
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }

  async function openSearchAndPick(term, groupTitle, buttonTextMatcher) {
    await btn('Abrir busca global').click();
    const searchDialog = page.getByRole('dialog', { name: 'Busca Global', exact: true });
    await searchDialog.waitFor();
    const input = searchDialog.getByLabel('Buscar nas finanças', { exact: true });
    await page.waitForFunction((el) => document.activeElement === el, await input.elementHandle());
    await input.fill(term);
    const groupSection = searchDialog.locator('section').filter({ has: page.getByRole('heading', { level: 3, name: groupTitle, exact: true }) });
    const resultBtn = groupSection.locator('button[data-result-index]').filter({ hasText: buttonTextMatcher }).first();
    await resultBtn.waitFor();
    await page.evaluate(() => { window.qa.ghostSearch = false; });
    await resultBtn.click();
    await waitSearchClosed();
  }

  await page.setViewportSize({ width, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
  page.setDefaultTimeout(4000);
  page.on('pageerror', onError);
  await page.route('**/*', routeAll);

  try {
    if (phase === 'search-routes') {
      const witness = await mountFresh();
      results.push({ name: 'testemunha-viewport-tema', witness, violations: [] });

      // Navegação pelos 9 destinos da SPA (Sidebar em 1440; MobileNav + Mais em 360/390)
      const visitedViews = [];
      for (const label of ['Resumo', 'Contas', 'Cartões', 'Compras', 'Categorias', 'Investimentos', 'Parcelas', 'Consórcios', 'Caixinhas']) {
        if (width < 768) {
          if (['Resumo', 'Contas', 'Cartões', 'Compras'].includes(label)) {
            await page.locator('nav[aria-label="Navegação móvel"]').getByRole('button', { name: label, exact: true }).click();
          } else {
            await page.locator('nav[aria-label="Navegação móvel"]').getByRole('button', { name: /Mais/ }).click();
            const sheet = page.getByRole('dialog', { name: 'Mais destinos', exact: true });
            await sheet.waitFor();
            await sheet.getByRole('button', { name: label, exact: true }).click();
            await page.waitForFunction(() => !document.querySelector('[data-slot="sheet-content"]'));
          }
        } else {
          await page.locator('#desktop-navigation').getByRole('button', { name: label, exact: true }).click();
        }
        visitedViews.push(await page.evaluate(() => window.qa.store.getState().currentView));
      }
      require(visitedViews.length === 9 && new Set(visitedViews).size === 9, `Destinos SPA incompletos: ${JSON.stringify(visitedViews)}`);
      results.push({ name: 'navegacao-nove-destinos', visitedViews, violations: [] });

      // Busca Global: registros existentes
      await mountFresh();
      await openSearchAndPick('Conta Principal', 'Contas', 'Conta Principal');
      await btn('Voltar para contas').waitFor();
      await heading(2, 'Conta Principal').waitFor();
      results.push({
        name: 'busca-accounts-existente',
        view: await page.evaluate(() => window.qa.store.getState().currentView),
        detailOpened: true,
        violations: [],
      });

      await mountFresh();
      await openSearchAndPick('Salário sintético', 'Transações', 'Salário sintético');
      await btn('Voltar para contas').waitFor();
      await heading(2, 'Conta Principal').waitFor();
      results.push({
        name: 'busca-transactions-accountId-valido',
        view: await page.evaluate(() => window.qa.store.getState().currentView),
        detailOpened: true,
        violations: [],
      });

      await mountFresh();
      await openSearchAndPick('Cartão Violeta', 'Cartões', 'Cartão Violeta');
      await btn('Voltar para cartões').waitFor();
      await heading(2, 'Cartão Violeta').waitFor();
      results.push({
        name: 'busca-cards-existente',
        view: await page.evaluate(() => window.qa.store.getState().currentView),
        detailOpened: true,
        violations: [],
      });

      await mountFresh();
      await openSearchAndPick('Mercado Central', 'Compras', 'Mercado Central');
      const expandedBtn = btn('Itens da compra: Mercado Central');
      await expandedBtn.waitFor();
      await page.waitForFunction((node) => node.getAttribute('aria-expanded') === 'true', await expandedBtn.elementHandle());
      await page.getByRole('heading', { level: 4, name: 'Itens da compra (1)', exact: true }).waitFor();
      results.push({
        name: 'busca-purchases-existente',
        view: await page.evaluate(() => window.qa.store.getState().currentView),
        expanded: true,
        violations: [],
      });

      await mountFresh();
      await openSearchAndPick('Alimentação', 'Categorias', 'Alimentação');
      await heading(2, 'Categorias').waitFor();
      await page.getByText('Alimentação', { exact: true }).waitFor();
      results.push({
        name: 'busca-categories-somente-destino',
        view: await page.evaluate(() => window.qa.store.getState().currentView),
        detailOpened: false,
        violations: [],
      });

      // Busca Global: IDs inexistentes não abrem outro registro
      await mountFresh();
      await page.evaluate(() => { window.qa.ghostSearch = true; });
      await openSearchAndPick('Conta Fantasma', 'Contas', 'Conta Fantasma');
      await btn('Abrir conta Conta Principal').waitFor();
      require((await btn('Voltar para contas').count()) === 0, 'ID inexistente de conta abriu detalhe');
      results.push({ name: 'busca-accounts-inexistente', detailOpened: false, violations: [] });

      await mountFresh();
      await openSearchAndPick('Lançamento conta ausente', 'Transações', 'Lançamento conta ausente');
      await btn('Abrir conta Conta Principal').waitFor();
      require((await btn('Voltar para contas').count()) === 0, 'Transação com accountId inexistente abriu detalhe');
      results.push({ name: 'busca-transactions-accountId-inexistente', detailOpened: false, violations: [] });

      await mountFresh();
      await page.evaluate(() => { window.qa.ghostSearch = true; });
      await openSearchAndPick('Cartão Fantasma', 'Cartões', 'Cartão Fantasma');
      await btn('Abrir cartão Cartão Violeta').waitFor();
      require((await btn('Voltar para cartões').count()) === 0, 'ID inexistente de cartão abriu detalhe');
      results.push({ name: 'busca-cards-inexistente', detailOpened: false, violations: [] });

      await mountFresh();
      await page.evaluate(() => { window.qa.ghostSearch = true; });
      await openSearchAndPick('Loja Fantasma', 'Compras', 'Loja Fantasma');
      await btn('Itens da compra: Mercado Central').waitFor();
      require((await page.locator('button[aria-expanded="true"]').count()) === 0, 'ID inexistente de compra expandiu outra linha');
      results.push({ name: 'busca-purchases-inexistente', expanded: false, violations: [] });
    }

    if (phase === 'focus-services') {
      // Escape na Busca: 4 origens
      await mountFresh();
      const notifBtn = btn('Notificações');
      await notifBtn.focus();
      await page.keyboard.press('Control+k');
      await page.getByRole('dialog', { name: 'Busca Global', exact: true }).waitFor();
      await page.keyboard.press('Escape');
      await waitSearchClosed();
      const connectedFocus = await page.evaluate(() => ({
        label: document.activeElement?.getAttribute('aria-label') ?? null,
        connected: document.activeElement?.isConnected ?? false,
      }));
      require(connectedFocus.label === 'Notificações' && connectedFocus.connected, `Origem conectada falhou: ${JSON.stringify(connectedFocus)}`);
      results.push({ name: 'busca-escape-origem-conectada', focus: connectedFocus, violations: [] });

      // Origem = document.body
      await mountFresh();
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      require(await page.evaluate(() => document.activeElement === document.body), 'activeElement não estava em body');
      await page.keyboard.press('Control+k');
      await page.getByRole('dialog', { name: 'Busca Global', exact: true }).waitFor();
      await page.keyboard.press('Escape');
      await waitSearchClosed();
      const bodyFallback = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? null);
      require(bodyFallback === 'Abrir busca global', `Fallback de body falhou: ${bodyFallback}`);
      results.push({ name: 'busca-escape-origem-body', focusLabel: bodyFallback, violations: [] });

      // Origem ausente (null)
      await mountFresh();
      await page.evaluate(() => {
        Object.defineProperty(document, 'activeElement', { configurable: true, get: () => null });
      });
      await page.keyboard.press('Control+k');
      await page.evaluate(() => { delete document.activeElement; });
      await page.getByRole('dialog', { name: 'Busca Global', exact: true }).waitFor();
      await page.keyboard.press('Escape');
      await waitSearchClosed();
      const absentFallback = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? null);
      require(absentFallback === 'Abrir busca global', `Fallback de origem ausente falhou: ${absentFallback}`);
      results.push({ name: 'busca-escape-origem-ausente', focusLabel: absentFallback, violations: [] });

      // Origem desconectada
      await mountFresh();
      await page.evaluate(() => {
        const temp = document.createElement('button');
        temp.id = 'qa-temp-origin';
        temp.textContent = 'Origem temporária';
        document.querySelector('main')?.appendChild(temp);
        temp.focus();
      });
      await page.keyboard.press('Control+k');
      await page.getByRole('dialog', { name: 'Busca Global', exact: true }).waitFor();
      await page.evaluate(() => { document.getElementById('qa-temp-origin')?.remove(); });
      await page.keyboard.press('Escape');
      await waitSearchClosed();
      const disconnectedFallback = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? null);
      require(disconnectedFallback === 'Abrir busca global', `Fallback de origem desconectada falhou: ${disconnectedFallback}`);
      results.push({ name: 'busca-escape-origem-desconectada', focusLabel: disconnectedFallback, violations: [] });

      // Notificações: sem role=dialog, erro com Tentar novamente, sucesso e Escape
      await mountFresh();
      await page.evaluate(() => { window.qa.failNotificationsOnce = true; });
      await btn('Notificações').click();
      const notifPanel = page.locator('[data-quiet-notifications]');
      await notifPanel.waitFor();
      const notifRoleInfo = await notifPanel.evaluate((node) => ({
        role: node.getAttribute('role'),
        hasDialogRole: node.getAttribute('role') === 'dialog' || Boolean(node.closest('[role="dialog"]')),
      }));
      require(!notifRoleInfo.hasDialogRole, `Notificações não pode usar papel de dialog: ${JSON.stringify(notifRoleInfo)}`);
      await notifPanel.getByText('Não foi possível carregar as notificações.', { exact: true }).waitFor();
      await btn('Tentar novamente', notifPanel).click();
      await notifPanel.getByText('Salário sintético', { exact: true }).waitFor();
      const readAllBtn = btn('Ler tudo', notifPanel);
      await readAllBtn.waitFor();
      await readAllBtn.focus();
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('[data-quiet-notifications]'));
      const notifFocus = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? null);
      require(notifFocus === 'Notificações', `Foco após fechar notificações: ${notifFocus}`);
      results.push({ name: 'notificacoes-retry-e-sem-dialog', notifRoleInfo, focusLabel: notifFocus, violations: [] });

      // Assistente IA sob demanda: dialog nativo, não montado antes, Escape fecha e devolve foco
      await mountFresh();
      const beforeDemand = await page.evaluate(() => ({
        advisorMounted: Boolean(document.querySelector('[data-quiet-advisor]')),
        dialogOpen: Boolean(document.querySelector('dialog[open]')),
      }));
      require(!beforeDemand.advisorMounted && !beforeDemand.dialogOpen, `AIAdvisor montado antes da demanda: ${JSON.stringify(beforeDemand)}`);
      await btn('Abrir assistente financeiro IA').click();
      const advisorDialog = page.locator('dialog[open]');
      await advisorDialog.waitFor();
      await advisorDialog.locator('[data-quiet-advisor]').waitFor();
      await page.keyboard.press('Control+k');
      require((await page.getByRole('dialog', { name: 'Busca Global', exact: true }).count()) === 0, 'Ctrl+K abriu Busca sobre diálogo já aberto');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('dialog[open]'));
      const afterEscape = await page.evaluate(() => ({
        focusLabel: document.activeElement?.getAttribute('aria-label') ?? null,
        inert: document.querySelector('dialog')?.hasAttribute('inert') ?? false,
      }));
      require(afterEscape.focusLabel === 'Abrir assistente financeiro IA' && afterEscape.inert, `Retorno de foco/inert do AIAdvisor falhou: ${JSON.stringify(afterEscape)}`);
      results.push({ name: 'assistente-ia-sob-demanda', beforeDemand, afterEscape, violations: [] });
    }

    const unexpected = await page.evaluate(() => window.qa.unexpected);
    require(errors.length === 0 && blocked.length === 0 && unexpected.length === 0, JSON.stringify({ errors, blocked, unexpected }));
    return results;
  } finally {
    page.off('pageerror', onError);
    await page.unroute('**/*', routeAll);
  }
}

const { QUIET_QA_SCRATCH, HOME, TMPDIR, CI } = process.env;
assert(isAbsolute(QUIET_QA_SCRATCH ?? '') && CI === '1',
  'Requer QUIET_QA_SCRATCH absoluto e CI=1 no sandbox aprovado; não execute no host.');
for (const { env } of baselineSpecs) {
  assert(isAbsolute(process.env[env] ?? ''), `Forneça ${env} absoluto com a fonte RO do ref ${baseRef}`);
}
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
const baselineByPath = new Map();
for (const spec of baselineSpecs) {
  const contents = await readFile(process.env[spec.env], 'utf8');
  assert.equal(digest(contents), spec.hash, `SHA-256 inválido em ${spec.env} (${spec.pathSuffix})`);
  baselineByPath.set(join(root, spec.pathSuffix), contents);
}

const dir = await mkdtemp(join(scratch, 'quiet-search-parity-'));
const session = `quiet-search-parity-${randomUUID()}`;
const failures = [];
let attemptedOpen = false;
let daemonPid;
const deadline = Date.now() + 420_000;

async function cli(...args) {
  const cleanup = ['close', 'list'].includes(args[0]);
  const timeout = cleanup ? 5000 : Math.min(120_000, deadline - Date.now());
  assert(timeout > 0, 'Prazo do runner encerrado');
  const proc = Bun.spawn(['playwright-cli', `-s=${session}`, ...args], {
    cwd: dir, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', timeout,
  });
  const [stdout, stderr, exit] = await Promise.all([
    new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited,
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

  const emptyModules = new Map(Object.entries({
    'dashboard-view': 'DashboardView',
    'quick-stats-overview': 'QuickStatsOverview',
    'smart-insights': 'SmartInsights',
    'cash-flow-forecast': 'CashFlowForecast',
    'spending-timeline': 'SpendingTimeline',
    'savings-challenge': 'SavingsChallenge',
    'expense-breakdown': 'ExpenseBreakdown',
    'balance-projection': 'BalanceProjection',
    'financial-calendar': 'FinancialCalendar',
    'networth-evolution': 'NetworthEvolution',
    'debt-overview': 'DebtOverview',
    'transaction-analytics': 'TransactionAnalytics',
    'goals-dashboard': 'GoalsDashboard',
    'receipt-generator': 'ReceiptGenerator',
    'achievement-badges': 'AchievementBadges',
    'investments-view': 'InvestmentsView',
    'installments-view': 'InstallmentsView',
    'consortiums-view': 'ConsortiumsView',
    'savings-view': 'SavingsView',
  }));

  const entry = `import Page from ${JSON.stringify(pagePath)};
    import { createElement } from 'react';
    import { createRoot } from 'react-dom/client';
    import { ThemeProvider } from 'next-themes';
    import { useAppStore } from ${JSON.stringify(join(root, 'src/lib/store.ts'))};
    (${installFixture.toString()})(Page, ThemeProvider, createElement, createRoot, useAppStore);`;

  const realtime = `export function useRealtime() { return { isConnected: true, refreshCounter: 0, reconnect: () => {} }; }`;

  async function htmlFor(label, useBaseline) {
    const intercepted = new Set();
    const bundle = await Bun.build({
      entrypoints: [source],
      target: 'browser',
      format: 'iife',
      minify: true,
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{
        name: 'fixture-search-parity',
        setup(build) {
          build.onLoad({ filter: /quiet-search-parity\.qa\.mjs$/ }, () => ({ contents: entry, loader: 'ts' }));
          build.onLoad({ filter: /\/use-realtime\.ts$/ }, () => ({ contents: realtime, loader: 'ts' }));
          build.onLoad({ filter: /\/src\/app\/page\.tsx$|\/src\/components\/finance\/[\w-]+\.tsx$/ }, (args) => {
            if (useBaseline && baselineByPath.has(args.path)) {
              intercepted.add(args.path);
              return { contents: baselineByPath.get(args.path), loader: 'tsx' };
            }
            const name = args.path.split('/').at(-1).slice(0, -4);
            const component = emptyModules.get(name);
            if (component) return { contents: `export function ${component}() { return null; }`, loader: 'ts' };
          });
        },
      }],
    });
    assert(bundle.success && bundle.outputs.length === 1, `Bundle incompleto: ${label}`);
    if (useBaseline) {
      assert.equal(intercepted.size, baselineSpecs.length, `Baseline não interceptou todas as 4 fontes (${intercepted.size}/${baselineSpecs.length})`);
    }
    const html = join(dir, `${label}.html`);
    const script = (await bundle.outputs[0].text()).replace(/<\/script/gi, '<\\/script');
    await writeFile(
      html,
      `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><style>${css.replace(/<\/style/gi, '<\\/style')}</style><body class="antialiased bg-background text-foreground"><div id="root"></div><script>${script}</script></body></html>`,
    );
    return html;
  }

  const html = { baseline: await htmlFor('baseline', true), candidate: await htmlFor('candidate', false) };
  const candidateHashes = {};
  for (const rel of [
    'src/app/page.tsx',
    'src/components/finance/app-header.tsx',
    'src/components/finance/app-overlays.tsx',
    'src/components/finance/global-search.tsx',
    'src/components/finance/global-search-result.tsx',
    'src/components/finance/notification-panel.tsx',
    'src/components/finance/ai-advisor.tsx',
    'src/components/finance/advisor-composer.tsx',
  ]) {
    candidateHashes[rel] = digest(await readFile(join(root, rel)));
  }
  console.log(JSON.stringify({ session, baseRef, candidateHashes }));

  attemptedOpen = true;
  const opened = JSON.parse(await cli('open', 'about:blank', '--browser=chrome', '--idle-timeout=120000', '--json'));
  assert.equal(opened.session, session);
  assert(Number.isInteger(opened.pid) && opened.pid > 1, 'Daemon sem PID verificável');
  daemonPid = opened.pid;
  await cli('snapshot');

  const gaps = [];
  let count = 0;
  const phases = ['search-routes', 'focus-services'];

  for (const width of [360, 390, 1440]) {
    const backgrounds = [];
    for (const theme of ['light', 'dark']) {
      const observed = { baseline: [], candidate: [] };
      for (const phase of phases) {
        for (const label of ['baseline', 'candidate']) {
          const outcome = await cli(
            'run-code',
            `(page) => (${runCases.toString()})(page, ${JSON.stringify(html[label])}, ${width}, ${JSON.stringify(theme)}, ${JSON.stringify(phase)})`,
          );
          const result = outcome.match(/^### Result\s*\n([^\n]+)/m)?.[1];
          assert(result, `${label}/${phase}: resultado DOM ausente`);
          observed[label].push(...JSON.parse(result));
        }
      }
      assert.equal(observed.baseline.length, 17, `baseline: cenários incompletos (${observed.baseline.length}/17)`);
      assert.equal(observed.candidate.length, 17, `candidate: cenários incompletos (${observed.candidate.length}/17)`);
      count += observed.candidate.length;

      const cellParity = Bun.deepEquals(observed.baseline, observed.candidate);
      if (!cellParity) gaps.push(`${width}/${theme}: divergência de paridade`);

      const witness = observed.candidate.find(({ name }) => name === 'testemunha-viewport-tema')?.witness;
      assert(witness, `Testemunha ausente em ${width}/${theme}`);
      backgrounds.push(witness.background);

      console.log(JSON.stringify({ session, baseRef, width, theme, scenarios: observed.candidate.length, cellParity, witness }));
    }
    assert.notEqual(backgrounds[0], backgrounds[1], `Fundos claro/escuro iguais em ${width}px`);
  }

  console.log(JSON.stringify({ totalScenarios: count }));
  assert.deepEqual(gaps, [], 'Divergências de paridade na Busca/Shell/Serviços');
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
    if (failures.length === beforeCleanup) console.log(`Sessão exclusiva encerrada: ${session}`);
  }
  await cleanup('scratch', () => rm(dir, { recursive: true, force: true }));
}

if (failures.length) throw new AggregateError(failures, 'QA de paridade da Busca/Shell não concluído');
