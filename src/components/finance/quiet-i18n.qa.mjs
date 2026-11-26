import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { access, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(import.meta.url);
const root = fileURLToPath(new URL('../../../', import.meta.url));

function installFixture(
  Page,
  ThemeProvider,
  AppIntlProvider,
  getMessagesForLocale,
  Toaster,
  createElement,
  createRoot,
  useAppStore,
) {
  const accounts = [
    { id: 'a1', name: 'Conta Corrente', type: 'BANK', balance: 5400, color: '#22c55e', icon: 'wallet', isActive: true },
  ];
  const cards = [
    { id: 'c1', name: 'Cartão Principal', type: 'CREDIT', brand: 'VISA', lastFourDigits: '4321', creditLimit: 6000, currentBalance: 750, color: '#8b5cf6', closingDay: 5, dueDay: 15, flag: 'Banco QA' },
  ];
  const categories = [
    { id: 'cat1', name: 'Alimentação', type: 'EXPENSE', color: '#22c55e', icon: 'utensils', _count: { transactions: 1, purchases: 1 } },
  ];
  const transactions = [
    { id: 't1', type: 'INCOME', amount: 3000, description: 'Salário QA', date: '2026-11-10T12:00:00.000Z', accountId: 'a1', categoryId: 'cat1' },
  ];
  const purchases = [
    { id: 'p1', merchant: 'Mercado QA', totalAmount: 250, date: '2026-11-12', cardId: 'c1', card: cards[0], categoryId: 'cat1', category: categories[0], items: [{ id: 'i1', name: 'Item QA', quantity: 1, unitPrice: 250, totalPrice: 250 }] },
  ];
  const investments = [
    { id: 'inv1', name: 'Tesouro QA', type: 'CDB', investedAmount: 4000, currentBalance: 4400, yieldRate: 10 },
  ];
  const goals = [
    { id: 'g1', name: 'Reserva QA', type: 'EMERGENCY_FUND', targetAmount: 10000, currentAmount: 3500, isCompleted: false, color: '#10b981' },
  ];

  const qa = (window.qa = { unexpected: [], calls: [] });

  window.fetch = async (input, init) => {
    const rawUrl = typeof input === 'string' ? input : input?.url ?? '';
    const url = rawUrl.replace(/^https:\/\/finance-qa\.invalid/, '');
    const method = (init?.method ?? 'GET').toUpperCase();
    qa.calls.push(`${method} ${url}`);
    if (method !== 'GET') return Response.json({ ok: true });
    if (url.startsWith('/api/dashboard')) {
      return Response.json({
        totalBalance: 5400,
        totalCardBalance: 750,
        totalCardLimit: 6000,
        monthIncome: 3000,
        monthExpense: 250,
        monthlyTrend: [{ month: 'nov. de 26', income: 3000, expense: 250 }],
        accountBalances: [{ accountId: 'a1', accountName: 'Conta Corrente', accountColor: '#22c55e', balance: 5400 }],
        expenseByCategory: [{ categoryId: 'cat1', categoryName: 'Alimentação', categoryColor: '#22c55e', total: 250 }],
        recentTransactions: transactions,
        recentPurchases: purchases,
      });
    }
    if (url.startsWith('/api/accounts')) return Response.json(accounts);
    if (url.startsWith('/api/cards')) return Response.json(cards);
    if (url.startsWith('/api/categories')) return Response.json(categories);
    if (url.startsWith('/api/transactions')) return Response.json(transactions);
    if (url.startsWith('/api/purchases')) return Response.json(purchases);
    if (url.startsWith('/api/investments/transactions')) return Response.json([]);
    if (url.startsWith('/api/investments')) return Response.json(investments);
    if (url.startsWith('/api/installments')) return Response.json([]);
    if (url.startsWith('/api/consortiums')) return Response.json([]);
    if (url.startsWith('/api/savings-challenge')) {
      return Response.json({
        currentMonthSavings: 2750, dailyAverageExpense: 25, projectedMonthExpense: 750, projectedSavings: 2250,
        savingsRate: 91.7, daysRemaining: 10, daysInMonth: 30, daysElapsed: 20, income: 3000,
        totalExpenses: 250, todaySpending: 0, dailyTarget: 35, challengeTargets: [],
      });
    }
    if (url.startsWith('/api/savings')) return Response.json(goals);
    if (url.startsWith('/api/recurring')) return Response.json([]);
    if (url.startsWith('/api/budget-goals')) return Response.json([]);
    if (url.startsWith('/api/budgets')) return Response.json([]);
    if (url.startsWith('/api/monthly-budgets')) return Response.json({ budgets: [] });
    if (url.startsWith('/api/insights')) return Response.json([]);
    if (url.startsWith('/api/quick-stats')) {
      return Response.json({
        current: { totalBalance: 5400, cardDebt: 750, investments: 4400, savingsGoals: 3500, netWorth: 12550, monthlyIncome: 3000, monthlyExpense: 250, monthlySavings: 2750, savingsRate: 91.7 },
        sparklines: { balance: [5000, 5400], income: [2800, 3000], expense: [200, 250] },
        changes: { incomeVsLastMonth: 7.1, expenseVsLastMonth: 25.0, savingsVsLastMonth: 5.8 },
      });
    }
    if (url.startsWith('/api/upcoming-bills')) {
      return Response.json({ upcoming: [], summary: { totalUpcoming: 0, totalBills: 0, totalIncome: 0, totalExpense: 0, upcomingBiggestExpense: null, nextPaymentDate: null } });
    }
    if (url.startsWith('/api/forecast')) {
      return Response.json({ forecastMonths: [{ month: 'dez/26', projectedIncome: 3000, projectedExpense: 250, projectedNet: 2750, confidence: 80 }], topExpenseCategories: [], riskAlerts: [], trendDirection: 'improving' });
    }
    if (url.startsWith('/api/balance-projection')) {
      return Response.json({ accounts: [], monthLabels: [], totalCurrentBalance: 5400, totalProjected: 8150, averageMonthlySavings: 2750, savingsRate: 91.7, riskLevel: 'low', months: 6 });
    }
    if (url.startsWith('/api/timeline')) return Response.json([]);
    if (url.startsWith('/api/expense-breakdown')) return Response.json({ categories: [], totalExpense: 250, topCategory: null, monthlyData: [] });
    if (url.startsWith('/api/networth')) return Response.json({ monthlyData: [] });
    if (url.startsWith('/api/debts')) return Response.json({ totalDebt: 750, cardsDebt: 750, installmentDebt: 0, consortiumDebt: 0, debtToIncomeRatio: 25, monthlyIncome: 3000, cards: [], installments: [], consortiums: [] });
    if (url.startsWith('/api/financial-calendar')) return Response.json({ days: [], summary: { totalUpcoming: 0, totalBills: 0, totalIncome: 0, totalExpense: 0, upcomingBiggestExpense: null, nextPaymentDate: null } });
    if (url.startsWith('/api/reports')) return Response.json({ monthlyData: [], topExpenseCategory: null, topCategories: [], avgDailySpend: 0, highestExpense: null, lowestIncome: null, savingsRateTrend: [], ticketMedio: 0 });
    if (url.startsWith('/api/transaction-analytics')) return Response.json({ overview: { totalTransactions: 1, totalIncome: 3000, totalExpense: 250, averagePerTransaction: 1625, highestTransaction: null, lowestTransaction: null, mostFrequentCategory: null, weekdayBreakdown: [] }, monthlyComparison: [], topMerchants: [], amountDistribution: [], dailyPattern: [] });
    if (url.startsWith('/api/goals-dashboard')) return Response.json({ summary: { totalGoals: 0, completedGoals: 0, inProgressGoals: 0, totalTargetAmount: 0, totalCurrentAmount: 0, overallProgress: 0, estimatedCompletion: null }, budgetGoals: [], savingsGoals: [], investments: [] });
    if (url.startsWith('/api/financial-health')) return Response.json({ score: 85, pillars: [] });
    if (url.startsWith('/api/achievements')) return Response.json({ achievements: [] });
    if (url.startsWith('/api/notifications')) return Response.json([]);
    if (url.startsWith('/api/search')) return Response.json({ transactions: [], purchases: [], accounts: [], cards: [], categories: [], investments: [], installmentPlans: [], savingsGoals: [] });
    qa.unexpected.push(`${method} ${url}`);
    return Response.json([]);
  };

  qa.mount = (theme, locale, view = 'dashboard') => {
    qa.calls = [];
    qa.unexpected = [];
    document.documentElement.lang = locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US';
    document.cookie = `NEXT_LOCALE=${locale}; path=/`;
    useAppStore.setState({
      currentView: view,
      showValues: true,
      sidebarOpen: false,
      aiAssistantVisible: false,
      newTransactionRequested: false,
      newGoalRequested: false,
      selectedAccountId: null,
      selectedCardId: null,
      selectedPurchaseId: null,
      selectedInvestmentId: null,
      selectedInstallmentPlanId: null,
      selectedConsortiumId: null,
    });
    const host = document.getElementById('root');
    if (qa.rootInstance) qa.rootInstance.unmount();
    qa.rootInstance = createRoot(host);
    qa.rootInstance.render(
      createElement(
        ThemeProvider,
        { attribute: 'class', forcedTheme: theme, disableTransitionOnChange: true },
        createElement(
          AppIntlProvider,
          { locale, messages: getMessagesForLocale(locale) },
          createElement(Page),
          createElement(Toaster, { theme }),
        ),
      ),
    );
  };

  qa.setView = (view) => {
    useAppStore.getState().setCurrentView(view);
  };

  qa.setAiVisible = (visible) => {
    useAppStore.getState().setAiAssistantVisible(visible);
  };
}

async function runCases(page, html, width, theme, flagBodies) {
  const url = 'https://finance-qa.invalid/';
  const errors = [];
  const blocked = [];
  const onError = (err) => errors.push(err.message);
  const routeAll = (route) => {
    const req = route.request();
    const reqUrl = req.url();
    if (reqUrl === url && req.method() === 'GET' && req.isNavigationRequest()) {
      return route.fulfill({ path: html, contentType: 'text/html; charset=utf-8' });
    }
    if (req.method() === 'GET' && reqUrl.startsWith(`${url}locale-flags/`)) {
      const path = reqUrl.slice(url.length - 1);
      const body = flagBodies[path];
      if (body) {
        return route.fulfill({ status: 200, contentType: 'image/svg+xml; charset=utf-8', body });
      }
    }
    blocked.push(reqUrl);
    return route.abort();
  };

  const ensure = (cond, msg) => { if (!cond) throw new Error(msg); };
  const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const waitText = (text) => page.waitForFunction(
    (expected) => (document.body?.innerText ?? '').toLowerCase().includes(expected.toLowerCase()),
    text,
    { timeout: 5000 },
  );

  const specs = {
    pt: {
      dashboardHeading: 'Resumo financeiro',
      balanceLabel: 'Saldo em contas',
      moreDetails: 'Mais detalhes financeiros',
      detailHeadings: ['Relatórios Financeiros', 'Metas de orçamento', 'Gerador de recibos'],
      currencyPattern: /R\$/,
      views: [
        { view: 'accounts', heading: 'Contas', expectBrl: true },
        { view: 'cards', heading: 'Cartões', expectBrl: true },
        { view: 'purchases', heading: 'Compras', expectBrl: true },
        { view: 'investments', heading: 'Investimentos', expectBrl: true },
        { view: 'savings', heading: 'Caixinhas', expectBrl: true },
      ],
      notifTrigger: 'Notificações',
      notifTitle: 'Notificações',
      aiTrigger: 'Assistente IA',
      aiHeading: 'Assistente Financeiro',
    },
    es: {
      dashboardHeading: 'Resumen financiero',
      balanceLabel: 'Saldo en cuentas',
      moreDetails: 'Más detalles financieros',
      detailHeadings: ['Informes Financieros', 'Metas de presupuesto', 'Generador de recibos'],
      currencyPattern: /BRL/,
      views: [
        { view: 'accounts', heading: 'Cuentas', expectBrl: true },
        { view: 'cards', heading: 'Tarjetas', expectBrl: true },
        { view: 'purchases', heading: 'Compras', expectBrl: true },
        { view: 'investments', heading: 'Inversiones', expectBrl: true },
        { view: 'savings', heading: 'Alcancías', expectBrl: true },
      ],
      notifTrigger: 'Notificaciones',
      notifTitle: 'Notificaciones',
      aiTrigger: 'Asistente IA',
      aiHeading: 'Asistente Financiero',
    },
    en: {
      dashboardHeading: 'Financial overview',
      balanceLabel: 'Account balance',
      moreDetails: 'More financial details',
      detailHeadings: ['Financial Reports', 'Budget goals', 'Receipt generator'],
      currencyPattern: /R\$/,
      views: [
        { view: 'accounts', heading: 'Accounts', expectBrl: true },
        { view: 'cards', heading: 'Cards', expectBrl: true },
        { view: 'purchases', heading: 'Purchases', expectBrl: true },
        { view: 'investments', heading: 'Investments', expectBrl: true },
        { view: 'savings', heading: 'Savings Boxes', expectBrl: true },
      ],
      notifTrigger: 'Notifications',
      notifTitle: 'Notifications',
      aiTrigger: 'AI Assistant',
      aiHeading: 'Financial Assistant',
    },
  };

  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
  page.setDefaultTimeout(5000);
  page.on('pageerror', onError);
  await page.route('**/*', routeAll);

  const cellSummary = [];
  try {
    let renderedBg = null;
    for (const locale of ['pt', 'es', 'en']) {
      const spec = specs[locale];
      await page.goto(url);
      await page.evaluate(({ t, l }) => window.qa.mount(t, l, 'dashboard'), { t: theme, l: locale });
      await waitText(spec.dashboardHeading);
      await waitText(spec.balanceLabel);
      await frame();

      const dashProbe = await page.evaluate(() => {
        const text = document.body.innerText ?? '';
        const bg = getComputedStyle(document.body).backgroundColor;
        const overflow = document.documentElement.scrollWidth > window.innerWidth + 1;
        return { text, bg, overflow, scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth };
      });
      if (!renderedBg) renderedBg = dashProbe.bg;
      ensure(!dashProbe.overflow, `${width}/${theme}/${locale} dashboard overflow: ${dashProbe.scrollWidth} > ${dashProbe.innerWidth}`);
      ensure(spec.currencyPattern.test(dashProbe.text), `${width}/${theme}/${locale} missing BRL format on dashboard`);
      ensure(!/MISSING_MESSAGE/.test(dashProbe.text), `${width}/${theme}/${locale} MISSING_MESSAGE leaked on dashboard`);
      ensure(!/(?:dashboard|accounts|cards|receipts|investments|goals|analytics|notifications|advisor)\.[a-zA-Z]+\.[a-zA-Z]+/.test(dashProbe.text), `${width}/${theme}/${locale} raw key leaked on dashboard`);
      ensure(!dashProbe.text.includes('€') && !/(?:^|\s)\$\d/.test(dashProbe.text), `${width}/${theme}/${locale} non-BRL currency leaked`);

      // Expand secondary financial details (Analytics, Budget Goals, Receipts)
      await page.getByText(spec.moreDetails, { exact: false }).first().click();
      for (const heading of spec.detailHeadings) {
        await waitText(heading);
      }
      await frame();
      const detailsProbe = await page.evaluate(() => ({
        text: document.body.innerText ?? '',
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      ensure(detailsProbe.scrollWidth <= detailsProbe.innerWidth + 1, `${width}/${theme}/${locale} details overflow`);
      ensure(!/MISSING_MESSAGE/.test(detailsProbe.text), `${width}/${theme}/${locale} details MISSING_MESSAGE`);
      ensure(!/(?:dashboard|accounts|cards|receipts|investments|goals|analytics|notifications|advisor)\.[a-zA-Z]+\.[a-zA-Z]+/.test(detailsProbe.text), `${width}/${theme}/${locale} details raw key leaked`);

      for (const item of spec.views) {
        await page.evaluate((v) => window.qa.setView(v), item.view);
        await waitText(item.heading);
        await frame();
        const viewProbe = await page.evaluate(() => ({
          text: document.body.innerText ?? '',
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        ensure(viewProbe.scrollWidth <= viewProbe.innerWidth + 1, `${width}/${theme}/${locale}/${item.view} overflow: ${viewProbe.scrollWidth} > ${viewProbe.innerWidth}`);
        ensure(!/MISSING_MESSAGE/.test(viewProbe.text), `${width}/${theme}/${locale}/${item.view} MISSING_MESSAGE leaked`);
        ensure(!/(?:dashboard|accounts|cards|receipts|investments|goals|analytics|notifications|advisor)\.[a-zA-Z]+\.[a-zA-Z]+/.test(viewProbe.text), `${width}/${theme}/${locale}/${item.view} raw key leaked`);
        if (item.expectBrl) {
          ensure(spec.currencyPattern.test(viewProbe.text), `${width}/${theme}/${locale}/${item.view} missing BRL formatting`);
        }
      }

      // Open NotificationPanel via header button
      await page.evaluate(() => window.qa.setView('dashboard'));
      await frame();
      await page.getByRole('button', { name: spec.notifTrigger }).first().click();
      await waitText(spec.notifTitle);
      await frame();

      // Open AIAdvisor via store
      await page.evaluate(() => window.qa.setAiVisible(true));
      await waitText(spec.aiHeading);
      await frame();

      const overlayProbe = await page.evaluate(() => ({
        text: document.body.innerText ?? '',
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      }));
      ensure(!overlayProbe.overflow, `${width}/${theme}/${locale} overlay overflow`);
      ensure(!/MISSING_MESSAGE/.test(overlayProbe.text), `${width}/${theme}/${locale} overlay MISSING_MESSAGE`);
      await page.evaluate(() => window.qa.setAiVisible(false));

      cellSummary.push({ locale, viewsChecked: spec.views.length + 3 });
    }

    ensure((await page.evaluate(() => window.qa.unexpected)).length === 0, 'unexpected request in fixture');
    ensure(errors.length === 0, `pageerror: ${JSON.stringify(errors)}`);
    ensure(blocked.length === 0, `blocked external network: ${JSON.stringify(blocked)}`);
    return { width, theme, renderedBg, locales: cellSummary };
  } catch (err) {
    const diag = await page.evaluate(() => ({
      text: (document.body?.innerText ?? '').slice(0, 300),
      unexpected: window.qa?.unexpected ?? null,
    })).catch(() => null);
    throw new Error(`${width}/${theme}: ${err.message} | diag=${JSON.stringify({ errors, blocked, diag })}`);
  } finally {
    page.off('pageerror', onError);
    await page.unroute('**/*', routeAll);
  }
}

const { QUIET_QA_SCRATCH, HOME, TMPDIR, CI } = process.env;
assert(isAbsoluteCheck(QUIET_QA_SCRATCH) && CI === '1', 'Execute apenas no sandbox bwrap com QUIET_QA_SCRATCH absoluto e CI=1.');
function isAbsoluteCheck(val) {
  return typeof val === 'string' && val.startsWith('/');
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

const dir = await mkdtemp(join(scratch, 'quiet-i18n-qa-'));
const session = `quiet-i18n-${randomUUID()}`;
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
  assert.equal(JSON.parse(await cli('--version', '--json')).version, '0.1.22');
  const { default: postcss } = await import('postcss');
  const { default: tailwindcss } = await import('@tailwindcss/postcss');
  const cssFile = join(root, 'src/app/globals.css');
  const { css } = await postcss([tailwindcss({ base: root })]).process(await readFile(cssFile, 'utf8'), { from: cssFile, map: false });
  assert(css.includes('--ds-focus') && css.includes('.bg-background'));

  const entry = `
    import Page from ${JSON.stringify(join(root, 'src/app/page.tsx'))};
    import { createElement } from 'react';
    import { createRoot } from 'react-dom/client';
    import { ThemeProvider } from 'next-themes';
    import { Toaster } from 'sonner';
    import { AppIntlProvider } from ${JSON.stringify(join(root, 'src/i18n/provider.tsx'))};
    import { getMessagesForLocale } from ${JSON.stringify(join(root, 'src/i18n/messages.ts'))};
    import { useAppStore } from ${JSON.stringify(join(root, 'src/lib/store.ts'))};
    (${installFixture.toString()})(
      Page,
      ThemeProvider,
      AppIntlProvider,
      getMessagesForLocale,
      Toaster,
      createElement,
      createRoot,
      useAppStore,
    );
  `;

  const realtime = `export function useRealtime() { return { isConnected: true, refreshCounter: 0, reconnect: () => {} }; }`;

  const bundle = await Bun.build({
    entrypoints: [source],
    target: 'browser',
    format: 'iife',
    minify: true,
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{
      name: 'fixture-quiet-i18n',
      setup(build) {
        build.onLoad({ filter: /quiet-i18n\.qa\.mjs$/ }, () => ({ contents: entry, loader: 'ts' }));
        build.onLoad({ filter: /\/use-realtime\.ts$/ }, () => ({ contents: realtime, loader: 'ts' }));
      },
    }],
  });
  assert(bundle.success && bundle.outputs.length === 1);
  const html = join(dir, 'i18n.html');
  const script = (await bundle.outputs[0].text()).replace(/<\/script/gi, '<\\/script');
  await writeFile(
    html,
    `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><style>${css.replace(/<\/style/gi, '<\\/style')}</style><body class="antialiased bg-background text-foreground"><div id="root"></div><script>${script}</script></body></html>`,
  );

  const cssHash = createHash('sha256').update(css).digest('hex');
  console.log(JSON.stringify({ session, cssHash }));

  attemptedOpen = true;
  const opened = JSON.parse(await cli('open', 'about:blank', '--browser=chrome', '--idle-timeout=120000', '--json'));
  assert.equal(opened.session, session);
  assert(Number.isInteger(opened.pid) && opened.pid > 1);
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

  let totalScenarios = 0;
  for (const width of [360, 390, 1440]) {
    const backgrounds = [];
    for (const theme of ['light', 'dark']) {
      const out = await cli('run-code', `(page) => (${runCases.toString()})(page, ${JSON.stringify(html)}, ${width}, ${JSON.stringify(theme)}, ${JSON.stringify(localeFlagBodies)})`);
      const jsonLine = out.match(/^### Result\s*\n([^\n]+)/m)?.[1];
      assert(jsonLine, `${width}/${theme}: sem resultado`);
      const cell = JSON.parse(jsonLine);
      backgrounds.push(cell.renderedBg);
      totalScenarios += cell.locales.length;
      console.log(JSON.stringify({ session, width, theme, locales: cell.locales, renderedBg: cell.renderedBg }));
    }
    assert.notEqual(backgrounds[0], backgrounds[1], `${width}: fundo light e dark idênticos`);
  }

  console.log(`${totalScenarios} combinações de idioma executadas nas 6 células (360/390/1440 × light/dark); 0 skips.`);
} catch (error) {
  failures.push(error);
} finally {
  if (attemptedOpen) {
    try { await cli('close', '--json'); } catch (error) { failures.push(error); }
    try {
      const { browsers } = JSON.parse(await cli('list', '--json'));
      assert(Array.isArray(browsers) && !browsers.some(({ name }) => name === session));
    } catch (error) { failures.push(error); }
    if (Number.isInteger(daemonPid)) {
      for (let attempt = 0; attempt < 20; attempt++) {
        try { await access(`/proc/${daemonPid}`); await delay(50); } catch (err) {
          if (err.code === 'ENOENT') break;
        }
      }
    }
  }
  await rm(dir, { recursive: true, force: true });
  if (failures.length > 0) {
    throw new AggregateError(failures, `${failures.length} falha(s) em quiet-i18n.qa.mjs`);
  }
}
