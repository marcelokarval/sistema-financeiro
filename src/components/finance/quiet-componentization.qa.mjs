// Execute somente dentro do preflight único de navegador de 0023.
// QUIET_QA_SCRATCH: tmpfs privado, também pai de HOME/TMPDIR/XDG_*; sem .git, .env ou banco.
// Valida a árvore integrada candidata nas 6 células (360, 390, 1440 × light/dark)
// compilando src/app/globals.css com PostCSS + @tailwindcss/postcss.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { access, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(import.meta.url);
const financeDir = dirname(source);
const root = fileURLToPath(new URL('../../../', import.meta.url));

function installFixture(
  Page,
  FinancialCalendar,
  CashFlowForecastContent,
  CashFlowForecastTooltip,
  ThemeProvider,
  AppIntlProvider,
  getMessagesForLocale,
  Toaster,
  Fragment,
  createElement,
  createRoot,
  useAppStore,
) {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const day10 = `${ym}-10`;
  const day15 = `${ym}-15`;

  const accounts = [
    {
      id: 'acc-a',
      name: 'Conta Principal QA',
      type: 'BANK',
      balance: 9876.54,
      color: '#22c55e',
      icon: 'wallet',
      isActive: true,
      _count: { transactions: 1 },
    },
  ];

  const cards = [
    {
      id: 'card-a',
      name: 'Cartão A',
      type: 'CREDIT',
      brand: 'VISA',
      lastFourDigits: '4321',
      creditLimit: 5000,
      currentBalance: 320.24,
      closingDay: 5,
      dueDay: 15,
      color: '#8b5cf6',
      flag: 'QA',
    },
  ];

  const categories = [
    { id: 'cat-1', name: 'Alimentação', icon: 'utensils', type: 'EXPENSE', color: '#f97316', _count: { transactions: 1, purchases: 1 } },
  ];

  const investments = [
    {
      id: 'inv-a',
      name: 'Tesouro QA',
      type: 'TESOURO',
      description: 'Reserva sintética',
      investedAmount: 1000,
      currentBalance: 1120,
      yieldRate: 12,
      brokerage: 'Corretora QA',
      ticker: 'TD2029',
      accountId: 'acc-a',
      categoryId: 'cat-1',
      _count: { transactions: 1 },
    },
  ];

  const planSummary = {
    id: 'plan-a',
    description: 'Plano A',
    type: 'FINANCING',
    totalAmount: 1200,
    installmentCount: 4,
    monthlyValue: 300,
    paidInstallments: 0,
    interestRate: 0,
    startDate: '2026-01-10',
    status: 'ACTIVE',
    cardId: 'card-a',
    categoryId: 'cat-1',
    card: { id: 'card-a', name: 'Cartão A', lastFourDigits: '4321' },
    category: { id: 'cat-1', name: 'Alimentação', color: '#f97316' },
    installments: [
      { id: 'inst-1', installmentPlanId: 'plan-a', number: 1, dueDate: day10, paidDate: null, amount: 300, status: 'PENDING' },
      { id: 'inst-2', installmentPlanId: 'plan-a', number: 2, dueDate: day15, paidDate: null, amount: 300, status: 'PENDING' },
    ],
  };

  const dashboardData = {
    totalBalance: 9876.54,
    totalCardBalance: 320.24,
    totalCardLimit: 5000,
    monthIncome: 1100,
    monthExpense: 350,
    monthlyTrend: [{ month: 'nov. de 26', income: 1100, expense: 350 }],
    accountBalances: [{ accountId: 'acc-a', accountName: 'Conta Principal QA', accountColor: '#22c55e', balance: 9876.54 }],
    expenseByCategory: [{ categoryId: 'cat-1', categoryName: 'Alimentação', categoryColor: '#f97316', total: 350 }],
    recentTransactions: [{ id: 'tx-1', type: 'INCOME', description: 'Entrada sintética QA', amount: 1100, date: '2026-11-12' }],
    recentPurchases: [{
      id: 'pur-1',
      merchant: 'Mercado QA',
      totalAmount: 123.45,
      date: '2026-11-13',
      items: [{ id: 'it-1', name: 'Item QA', quantity: 1, unitPrice: 123.45, totalPrice: 123.45 }],
    }],
  };

  const upcomingBillsData = {
    bills: [
      { id: 'b-1', type: 'card', title: 'Fatura QA', amount: 320.24, dueDate: day15, daysUntilDue: 2, status: 'urgent', source: 'Cartão A' },
    ],
    summary: { thisWeek: { count: 1, amount: 320.24 }, thisMonth: { count: 1, amount: 320.24 }, totalAmount: 320.24 },
  };

  const monthlyBudgetsData = {
    budgets: [
      {
        id: 'mb-1',
        categoryId: 'cat-1',
        categoryName: 'Alimentação',
        categoryColor: '#f97316',
        categoryIcon: 'utensils',
        amount: 800,
        spent: 350,
        remaining: 450,
        percentage: 43.75,
        isOverBudget: false,
      },
    ],
  };

  const calendarData = {
    days: [
      {
        date: day10,
        dayOfWeek: 'ter',
        income: 500,
        expense: 120,
        events: [
          { id: 'ev-1', type: 'transaction', description: 'Freela QA', amount: 500, category: 'Renda', isRecurring: false },
        ],
      },
      {
        date: day15,
        dayOfWeek: 'dom',
        income: 0,
        expense: 300,
        events: [
          { id: 'ev-2', type: 'recurring', description: 'Energia QA', amount: -300, category: 'Moradia', isRecurring: true },
        ],
      },
    ],
    summary: {
      totalUpcoming: 80,
      totalBills: 2,
      totalIncome: 500,
      totalExpense: 420,
      upcomingBiggestExpense: { description: 'Energia QA', amount: 300, date: day15 },
      nextPaymentDate: day10,
    },
  };

  const forecastData = {
    forecastMonths: [
      { month: 'dezembro', projectedIncome: 4500, projectedExpense: 1800, projectedNet: 2700, confidence: 85 },
      { month: 'janeiro', projectedIncome: 4600, projectedExpense: 1900, projectedNet: 2700, confidence: 80 },
      { month: 'fevereiro', projectedIncome: 4700, projectedExpense: 2000, projectedNet: 2700, confidence: 75 },
    ],
    topExpenseCategories: [{ name: 'Alimentação', color: '#f97316', averageMonthly: 1800 }],
    riskAlerts: [],
    trendDirection: 'improving',
  };

  const qa = window.qa = {
    calls: [],
    mutations: [],
    unexpected: [],
    installmentDetailMode: 'ok',
    rootInstance: null,
  };

  window.fetch = async (input, init) => {
    const rawUrl = typeof input === 'string' ? input : input.url;
    const url = rawUrl.replace(/^https?:\/\/[^/]+/, '');
    const method = init?.method ?? 'GET';
    qa.calls.push({ method, url });
    if (method !== 'GET') qa.mutations.push({ method, url });

    if (method === 'GET') {
      if (url.startsWith('/api/dashboard')) return Response.json(dashboardData);
      if (url === '/api/upcoming-bills') return Response.json(upcomingBillsData);
      if (url.startsWith('/api/monthly-budgets')) return Response.json(monthlyBudgetsData);
      if (url === '/api/categories') return Response.json(categories);
      if (url === '/api/accounts') return Response.json(accounts);
      if (url === '/api/transactions' || url.startsWith('/api/transactions?')) return Response.json(dashboardData.recentTransactions);
      if (url === '/api/cards') return Response.json(cards);
      if (url.startsWith('/api/purchases')) return Response.json([]);
      if (url === '/api/investments') return Response.json(investments);
      if (url.startsWith('/api/investments/transactions')) return Response.json([]);
      if (url === '/api/installments') return Response.json([planSummary]);
      if (url.startsWith('/api/installments?id=')) {
        if (qa.installmentDetailMode === '503') {
          return Response.json({ error: 'Falha sintética na releitura' }, { status: 503 });
        }
        return Response.json(planSummary);
      }
      if (url.startsWith('/api/financial-calendar')) return Response.json(calendarData);
      if (url.startsWith('/api/forecast')) return Response.json(forecastData);
      if (url === '/api/quick-stats') {
        return Response.json({
          current: {
            totalBalance: 9876.54, cardDebt: 320.24, investments: 1120, savingsGoals: 500,
            netWorth: 11176.3, monthlyIncome: 1100, monthlyExpense: 350, monthlySavings: 750, savingsRate: 68.2,
          },
          sparklines: { balance: [9000, 9876.54], income: [1000, 1100], expense: [300, 350] },
          monthlySavingsHistory: [600, 750],
          investmentsHistory: [1000, 1120],
          cardDebtHistory: [200, 320.24],
          changes: { incomeVsLastMonth: 10, expenseVsLastMonth: 16.7, savingsVsLastMonth: 25 },
        });
      }
      if (url === '/api/insights') return Response.json([]);
      if (url.startsWith('/api/timeline')) return Response.json([]);
      if (url === '/api/savings-challenge') {
        return Response.json({
          currentMonthSavings: 750, dailyAverageExpense: 25, projectedMonthExpense: 750, projectedSavings: 350,
          savingsRate: 68.2, daysRemaining: 10, daysInMonth: 30, daysElapsed: 20, income: 1100,
          totalExpenses: 350, todaySpending: 0, dailyTarget: 35, challengeTargets: [],
        });
      }
      if (url.startsWith('/api/expense-breakdown')) {
        return Response.json({ categories: [], totalExpense: 0, topCategory: null, monthlyData: [] });
      }
      if (url.startsWith('/api/balance-projection')) {
        return Response.json({
          accounts: [], monthLabels: ['dez'], totalCurrentBalance: 9876.54, totalProjected: 10500,
          averageMonthlySavings: 750, savingsRate: 68.2, riskLevel: 'low', months: 6,
        });
      }
      if (url.startsWith('/api/networth')) return Response.json({ monthlyData: [] });
      if (url === '/api/debts') {
        return Response.json({
          totalDebt: 320.24, cardDebt: 320.24, installmentDebt: 0, consortiumDebt: 0,
          debtToIncomeRatio: 29.1, monthlyIncome: 1100, cards: [], installments: [], consortiums: [],
        });
      }
      if (url.startsWith('/api/reports')) {
        return Response.json({
          monthlyData: [], topExpenseCategory: null, topCategories: [], avgDailySpend: 0,
          highestExpense: null, lowestIncome: null, savingsRateTrend: [], ticketMedio: 0,
        });
      }
      if (url.startsWith('/api/transaction-analytics')) {
        return Response.json({
          overview: {
            totalTransactions: 1, totalIncome: 1100, totalExpense: 350, averagePerTransaction: 725,
            highestTransaction: null, lowestTransaction: null, mostFrequentCategory: null, weekdayBreakdown: [],
          },
          monthlyComparison: [], topMerchants: [], amountDistribution: [], dailyPattern: [],
        });
      }
      if (url === '/api/goals-dashboard') {
        return Response.json({
          summary: {
            totalGoals: 0, completedGoals: 0, inProgressGoals: 0, totalTargetAmount: 0,
            totalCurrentAmount: 0, overallProgress: 0, estimatedCompletion: null,
          },
          budgetGoals: [], savingsGoals: [], investments: [],
        });
      }
      if (url === '/api/achievements') return Response.json({ achievements: [] });
      if (url.startsWith('/api/')) return Response.json([]);
    }

    if (method === 'POST' && url === '/api/installments/pay') {
      return Response.json({ success: true });
    }

    qa.unexpected.push(`${method} ${url}`);
    throw new Error(`Fetch fora da fixture: ${method} ${url}`);
  };

  function ForecastHarness({ showValues }) {
    const tooltipPayload = [
      { dataKey: 'Receita', name: 'Receita', value: 4500, color: 'var(--ds-accent-positive)' },
      { dataKey: 'Despesa', name: 'Despesa', value: 1800, color: 'var(--ds-accent-warning)' },
      { dataKey: 'Saldo', name: 'Saldo', value: 2700, color: 'var(--primary)' },
    ];
    return createElement(
      'div',
      { id: 'forecast-harness', className: 'space-y-4 bg-background p-3' },
      createElement(CashFlowForecastContent, {
        data: forecastData,
        loading: false,
        error: false,
        onRetry: () => {},
        showValues,
      }),
      createElement('div', { id: 'tooltip-inactive' }, createElement(CashFlowForecastTooltip, { active: false, payload: tooltipPayload, label: 'dezembro', showValues })),
      createElement('div', { id: 'tooltip-active' }, createElement(CashFlowForecastTooltip, { active: true, payload: tooltipPayload, label: 'dezembro', showValues })),
    );
  }

  qa.mountShell = (theme, locale = 'pt') => {
    qa.calls = [];
    qa.mutations = [];
    qa.unexpected = [];
    qa.installmentDetailMode = 'ok';
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
      createElement(
        ThemeProvider,
        { attribute: 'class', forcedTheme: theme, disableTransitionOnChange: true },
        createElement(
          AppIntlProvider,
          { locale, messages: getMessagesForLocale(locale) },
          createElement(Fragment, null, createElement(Page), createElement(Toaster, { theme })),
        ),
      ),
    );
  };

  qa.mountSurface = (theme, surface, options = {}) => {
    qa.calls = [];
    qa.mutations = [];
    qa.unexpected = [];
    const host = document.getElementById('root');
    if (qa.rootInstance) qa.rootInstance.unmount();
    qa.rootInstance = createRoot(host);
    const body = surface === 'calendar'
      ? createElement('main', { id: 'fixture', className: 'min-h-screen bg-background p-3' }, createElement(FinancialCalendar))
      : createElement('main', { id: 'fixture', className: 'min-h-screen bg-background p-3' }, createElement(ForecastHarness, { showValues: options.showValues ?? true }));
    qa.rootInstance.render(
      createElement(ThemeProvider, { attribute: 'class', forcedTheme: theme, disableTransitionOnChange: true }, body),
    );
  };

  qa.focus = (node = document.activeElement) => ({
    tag: node?.tagName ?? null,
    role: node?.getAttribute('role') || (node?.tagName === 'BUTTON' ? 'button' : node?.tagName === 'BODY' ? 'body' : null),
    name: node === document.body ? '' : (node?.getAttribute('aria-label') ?? node?.textContent ?? '').trim(),
    connected: Boolean(node?.isConnected),
    focused: Boolean(node && document.activeElement === node),
  });
}

// Serializado pelo CLI no sandbox; não depende de globals Node na VM.
async function runCases(page, html, width, theme, phase, localeFlagBodies) {
  const url = 'https://finance-qa.invalid/';
  const errors = [];
  const blocked = [];
  const results = [];
  const onError = (error) => errors.push(error.message);
  const routeAll = (route) => {
    const req = route.request();
    const reqUrl = req.url();
    if (reqUrl === url && req.method() === 'GET' && req.isNavigationRequest()) {
      return route.fulfill({ path: html, contentType: 'text/html; charset=utf-8' });
    }
    if (req.method() === 'GET' && reqUrl.startsWith(url)) {
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

  const ensure = (ok, msg) => { if (!ok) throw new Error(msg); };
  const btn = (name, within = page) => within.getByRole('button', { name, exact: true });
  const frame = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const focusInfo = () => page.evaluate(() => window.qa.focus());

  const assertNoOverflow = async (selector = 'html') => {
    const box = await page.evaluate((sel) => {
      const el = sel === 'html' ? document.documentElement : document.querySelector(sel);
      if (!el) throw new Error(`Superfície ausente: ${sel}`);
      const r = el.getBoundingClientRect();
      return {
        viewport: window.innerWidth,
        pageScroll: document.documentElement.scrollWidth,
        pageClient: document.documentElement.clientWidth,
        elScroll: el.scrollWidth,
        elClient: el.clientWidth,
        left: r.left,
        right: r.right,
      };
    }, selector);
    ensure(
      box.viewport === width
      && box.pageScroll <= box.pageClient + 1
      && box.elScroll <= box.elClient + 1
      && box.left >= -1
      && box.right <= width + 1,
      `Overflow em ${selector} (${width}/${theme}): ${JSON.stringify(box)}`,
    );
  };

  const tabUntil = async (target, maxSteps = 45) => {
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    for (let i = 0; i < maxSteps; i++) {
      await page.keyboard.press('Tab');
      if (await target.evaluate((el) => el === document.activeElement)) return;
    }
    throw new Error(`Tab não alcançou controle em ${maxSteps} passos`);
  };

  const waitPortalClosed = async (role = 'dialog') => {
    await page.waitForFunction((r) => !document.querySelector(`[role="${r}"]`), role);
    await page.waitForFunction(() => !document.querySelector('[data-slot="dialog-content"][data-state="closed"], [data-slot="alert-dialog-content"][data-state="closed"], [data-slot="sheet-content"][data-state="closed"]'));
    await frame();
  };

  const navigateTo = async (label) => {
    if (width < 768) {
      if (['Resumo', 'Contas', 'Cartões', 'Compras'].includes(label)) {
        await page.locator('nav[aria-label="Navegação móvel"]').getByRole('button', { name: label, exact: true }).click();
      } else {
        await page.locator('nav[aria-label="Navegação móvel"]').getByRole('button', { name: /Mais/ }).click();
        const sheet = page.getByRole('dialog', { name: 'Mais destinos', exact: true });
        await sheet.waitFor();
        await sheet.getByRole('button', { name: label, exact: true }).click();
        await waitPortalClosed('dialog');
      }
    } else {
      await page.locator('#desktop-navigation').getByRole('button', { name: label, exact: true }).click();
    }
    await frame();
  };

  const mountShell = async () => {
    await page.goto(url);
    await page.waitForFunction(() => Boolean(window.qa));
    await page.evaluate((skin) => window.qa.mountShell(skin), theme);
    await page.getByRole('heading', { name: 'Resumo financeiro', level: 2, exact: true }).waitFor();
    await page.waitForFunction((skin) => document.documentElement.classList.contains(skin), theme);
    await frame();
  };

  const checkWitness = async () => {
    await assertNoOverflow();
    const witness = await page.evaluate((skin) => {
      const bgEl = document.querySelector('.bg-background');
      const mobileNav = document.querySelector('nav[aria-label="Navegação móvel"]');
      if (!bgEl || !mobileNav) throw new Error('Testemunhas de layout ausentes no shell');
      const renderedBg = getComputedStyle(bgEl).backgroundColor;
      const probe = document.createElement('i');
      probe.style.backgroundColor = 'var(--background)';
      bgEl.appendChild(probe);
      const tokenBg = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return {
        width: window.innerWidth,
        theme: skin,
        hasThemeClass: document.documentElement.classList.contains(skin),
        renderedBg,
        tokenBg,
        mobileNavDisplay: getComputedStyle(mobileNav).display,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    }, theme);
    ensure(witness.width === width, `Largura inesperada: ${witness.width}`);
    ensure(witness.hasThemeClass, `Classe html.${theme} ausente`);
    ensure(!['transparent', 'rgba(0, 0, 0, 0)'].includes(witness.renderedBg), `Fundo transparente: ${witness.renderedBg}`);
    ensure(witness.renderedBg === witness.tokenBg, `Fundo ${witness.renderedBg} diverge de --background (${witness.tokenBg})`);
    if (width < 768) ensure(witness.mobileNavDisplay !== 'none', `md:hidden oculta em ${width}px`);
    else ensure(witness.mobileNavDisplay === 'none', `md:hidden visível em ${width}px: ${witness.mobileNavDisplay}`);
    return witness;
  };

  const runScenario = async (name, fn) => {
    try {
      const data = await fn();
      ensure((await page.evaluate(() => window.qa.unexpected)).length === 0, 'requisição inesperada');
      ensure(errors.length === 0, `erros no DOM: ${JSON.stringify(errors)}`);
      ensure(blocked.length === 0, `rede externa tentada: ${JSON.stringify(blocked)}`);
      results.push({ name, ...(data ?? {}) });
    } catch (error) {
      throw new Error(`${width}/${theme} [${name}]: ${error.message}`);
    }
  };

  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
  page.setDefaultTimeout(4000);
  page.on('pageerror', onError);
  await page.route('**/*', routeAll);

  try {
    if (phase === 'shell-ops') {
      await runScenario('testemunha-css-breakpoint-tema', async () => {
        await mountShell();
        return { witness: await checkWitness() };
      });

      await runScenario('resumo-hierarquia-e-mascara', async () => {
        await mountShell();
        const hideBtn = btn('Ocultar valores');
        await tabUntil(hideBtn, 25);
        await page.keyboard.press('Enter');
        await btn('Mostrar valores').waitFor();
        await frame();
        const audit = await page.evaluate(() => {
          const coveredSelectors = [
            'section[aria-label="Indicadores principais"]',
            'section[aria-label="Entradas e saídas"]',
            'section[aria-label="Atividade recente"]',
            'section[aria-label="Próximos vencimentos"]',
          ];
          const nodes = coveredSelectors
            .map((sel) => document.querySelector(sel))
            .filter(Boolean);
          const budgetHeading = Array.from(document.querySelectorAll('section h2')).find((h) => h.textContent?.trim() === 'Orçamento mensal');
          const budgetSection = budgetHeading?.closest('section');
          if (budgetSection) nodes.push(budgetSection);
          const text = nodes.map((el) => el.textContent ?? '').join(' ');
          const ariaLabels = nodes
            .flatMap((el) => Array.from(el.querySelectorAll('[aria-label]')))
            .map((el) => el.getAttribute('aria-label') ?? '')
            .join(' ');
          const dominantDd = document.querySelector('section[aria-label="Indicadores principais"] dl dd');
          return {
            coveredCount: nodes.length,
            hasMask: text.includes('R$ ••••••'),
            leakedAmount: /9\.?876,54|1\.?100,00|350,00|320,24|800,00|450,00/.test(`${text} ${ariaLabels}`),
            dominantClass: dominantDd?.className ?? '',
          };
        });
        ensure(audit.coveredCount >= 5 && audit.hasMask && !audit.leakedAmount, `Falha de máscara no Resumo: ${JSON.stringify(audit)}`);
        ensure(audit.dominantClass.includes('text-4xl'), `Hierarquia dominante ausente: ${audit.dominantClass}`);
        await assertNoOverflow();
        return audit;
      });

      await runScenario('busca-tab-e-escape', async () => {
        await mountShell();
        const searchBtn = btn('Abrir busca global');
        await tabUntil(searchBtn, 20);
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog', { name: 'Busca Global', exact: true });
        await dialog.waitFor();
        await assertNoOverflow('[role="dialog"]');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Escape');
        await waitPortalClosed('dialog');
        const focusAfterBtn = await focusInfo();
        ensure(focusAfterBtn.connected && focusAfterBtn.name === 'Abrir busca global', `Escape não devolveu foco à origem: ${JSON.stringify(focusAfterBtn)}`);

        await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
        await page.keyboard.press('Control+k');
        await dialog.waitFor();
        await page.keyboard.press('Escape');
        await waitPortalClosed('dialog');
        const focusAfterBody = await focusInfo();
        ensure(focusAfterBody.connected && focusAfterBody.name === 'Abrir busca global', `Fallback de body falhou: ${JSON.stringify(focusAfterBody)}`);
        return { focusAfterBtn, focusAfterBody };
      });

      await runScenario('contas-criacao-cancelar-e-foco', async () => {
        await mountShell();
        await navigateTo('Contas');
        const createBtn = btn('Nova conta');
        await createBtn.waitFor();
        await tabUntil(createBtn, 30);
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog', { name: 'Nova Conta', exact: true });
        await dialog.waitFor();
        await assertNoOverflow('[role="dialog"]');
        await btn('Cancelar', dialog).click();
        await waitPortalClosed('dialog');
        const focusCancel = await focusInfo();
        ensure(focusCancel.connected && focusCancel.name === 'Nova conta', `Contas Cancelar foco: ${JSON.stringify(focusCancel)}`);

        await page.keyboard.press('Enter');
        await dialog.waitFor();
        await page.keyboard.press('Escape');
        await waitPortalClosed('dialog');
        const focusEscape = await focusInfo();
        ensure(focusEscape.connected && focusEscape.name === 'Nova conta', `Contas Escape foco: ${JSON.stringify(focusEscape)}`);
        ensure((await page.evaluate(() => window.qa.mutations.length)) === 0, 'Contas cancelamento gerou mutação');
        await assertNoOverflow();
        return { focusCancel, focusEscape };
      });

      await runScenario('cartoes-confirmacao-e-foco', async () => {
        await mountShell();
        await navigateTo('Cartões');
        const delBtn = btn('Excluir cartão Cartão A');
        await delBtn.waitFor();
        await tabUntil(delBtn, 35);
        await page.keyboard.press('Enter');
        const alertDialog = page.getByRole('alertdialog', { name: 'Excluir cartão?', exact: true });
        await alertDialog.waitFor();
        await assertNoOverflow('[role="alertdialog"]');
        await btn('Cancelar', alertDialog).click();
        await waitPortalClosed('alertdialog');
        const focusReturn = await focusInfo();
        ensure(focusReturn.connected && focusReturn.name === 'Excluir cartão Cartão A', `Cartões confirmação foco: ${JSON.stringify(focusReturn)}`);
        ensure((await page.evaluate(() => window.qa.mutations.length)) === 0, 'Cartões cancelamento gerou mutação');
        await assertNoOverflow();
        return { focusReturn };
      });
    }

    if (phase === 'domain-charts') {
      await runScenario('investimentos-editor-e-foco', async () => {
        await mountShell();
        await navigateTo('Investimentos');
        const newInvBtn = btn('Novo investimento');
        await newInvBtn.waitFor();
        await tabUntil(newInvBtn, 30);
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog', { name: 'Novo Investimento', exact: true });
        await dialog.waitFor();
        await assertNoOverflow('[role="dialog"]');
        await page.keyboard.press('Escape');
        await waitPortalClosed('dialog');
        const focusReturn = await focusInfo();
        ensure(focusReturn.connected && focusReturn.name === 'Novo investimento', `Investimentos editor foco: ${JSON.stringify(focusReturn)}`);
        ensure((await page.evaluate(() => window.qa.mutations.length)) === 0, 'Investimentos cancelamento gerou mutação');
        await assertNoOverflow();
        return { focusReturn };
      });

      await runScenario('parcelas-indisponivel-focavel-e-inacionavel', async () => {
        await mountShell();
        await navigateTo('Parcelas');
        await btn('Abrir plano: Plano A').click();
        await btn('Pagar parcela 1 de 4').waitFor();
        await page.evaluate(() => { window.qa.installmentDetailMode = '503'; });
        await btn('Pagar parcela 1 de 4').click();
        await page.getByText('Não foi possível carregar os detalhes do plano.').waitFor();
        const delPlanBtn = btn('Excluir plano');
        await delPlanBtn.waitFor();
        await tabUntil(delPlanBtn, 25);
        const disabledAttr = await delPlanBtn.getAttribute('aria-disabled');
        ensure(disabledAttr === 'true', `Excluir plano sem aria-disabled="true": ${disabledAttr}`);
        const mutationsBefore = await page.evaluate(() => window.qa.mutations.length);
        await page.keyboard.press('Enter');
        await frame();
        ensure(await page.getByRole('alertdialog').count() === 0, 'Excluir plano indisponível abriu confirmação');
        ensure((await page.evaluate(() => window.qa.mutations.length)) === mutationsBefore, 'Excluir plano indisponível disparou DELETE');
        await assertNoOverflow();
        return { focus: await focusInfo(), ariaDisabled: disabledAttr };
      });

      await runScenario('calendario-navegacao-dia-teclado', async () => {
        await page.goto(url);
        await page.waitForFunction(() => Boolean(window.qa));
        await page.evaluate((skin) => window.qa.mountSurface(skin, 'calendar'), theme);
        await page.getByText('Freela QA').waitFor();
        await assertNoOverflow('#fixture');
        const day10Btn = page.locator('button[aria-pressed]').filter({ hasText: /^10/ }).first();
        await tabUntil(day10Btn, 50);
        await page.keyboard.press('Enter');
        await frame();
        const dayPressed = await day10Btn.getAttribute('aria-pressed');
        const agendaText = await page.locator('[aria-labelledby="calendar-agenda-heading"]').textContent();
        ensure(dayPressed === 'true' && agendaText?.includes('Freela QA') && !agendaText?.includes('Energia QA'), 'Calendário não filtrou agenda do dia 10');
        await assertNoOverflow('#fixture');
        return { dayPressed, dayFocus: await focusInfo() };
      });

      await runScenario('previsao-tooltip-ponto-e-mascara', async () => {
        await page.goto(url);
        await page.waitForFunction(() => Boolean(window.qa));
        await page.evaluate((skin) => window.qa.mountSurface(skin, 'forecast', { showValues: true }), theme);
        await page.locator('#forecast-harness .recharts-wrapper').waitFor();
        await assertNoOverflow('#fixture');

        const visibleProbe = await page.evaluate(() => ({
          inactiveText: document.getElementById('tooltip-inactive')?.textContent ?? '',
          activeText: document.getElementById('tooltip-active')?.textContent ?? '',
        }));
        ensure(visibleProbe.inactiveText === '', `Tooltip renderizou sem ponto ativo: ${visibleProbe.inactiveText}`);
        ensure(visibleProbe.activeText.includes('4.500,00') && visibleProbe.activeText.includes('1.800,00'), `Tooltip ativo sem BRL: ${visibleProbe.activeText}`);

        await page.evaluate((skin) => window.qa.mountSurface(skin, 'forecast', { showValues: false }), theme);
        await page.locator('#forecast-harness .recharts-wrapper').waitFor();
        await assertNoOverflow('#fixture');
        const maskedProbe = await page.evaluate(() => {
          const active = document.getElementById('tooltip-active');
          const text = active?.textContent ?? '';
          const aria = Array.from(active?.querySelectorAll('[aria-label]') ?? []).map((el) => el.getAttribute('aria-label') ?? '').join(' ');
          return {
            inactiveText: document.getElementById('tooltip-inactive')?.textContent ?? '',
            activeText: text,
            hasMask: text.includes('R$ ••••••'),
            leakedAmount: /4\.?500|1\.?800|2\.?700/.test(`${text} ${aria}`),
          };
        });
        ensure(maskedProbe.inactiveText === '' && maskedProbe.hasMask && !maskedProbe.leakedAmount, `Tooltip mascarado vazou valor: ${JSON.stringify(maskedProbe)}`);
        return { visibleProbe, maskedProbe };
      });
    }

    return results;
  } finally {
    page.off('pageerror', onError);
    await page.unroute('**/*', routeAll);
  }
}

const { QUIET_QA_SCRATCH, HOME, TMPDIR, CI } = process.env;
assert(isAbsolute(QUIET_QA_SCRATCH ?? '') && CI === '1', 'Forneça scratch privado e CI=1 no sandbox aprovado; não execute no host.');
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

const dir = await mkdtemp(join(scratch, 'quiet-componentization-'));
const session = `quiet-componentization-${randomUUID()}`;
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

  const entry = `
    import Page from ${JSON.stringify(join(root, 'src/app/page.tsx'))};
    import { FinancialCalendar } from ${JSON.stringify(join(financeDir, 'financial-calendar.tsx'))};
    import { CashFlowForecastContent, CashFlowForecastTooltip } from ${JSON.stringify(join(financeDir, 'cash-flow-forecast.tsx'))};
    import { Fragment, createElement } from 'react';
    import { createRoot } from 'react-dom/client';
    import { ThemeProvider } from 'next-themes';
    import { Toaster } from 'sonner';
    import { AppIntlProvider } from ${JSON.stringify(join(root, 'src/i18n/provider.tsx'))};
    import { getMessagesForLocale } from ${JSON.stringify(join(root, 'src/i18n/messages.ts'))};
    import { useAppStore } from ${JSON.stringify(join(root, 'src/lib/store.ts'))};
    (${installFixture.toString()})(
      Page,
      FinancialCalendar,
      CashFlowForecastContent,
      CashFlowForecastTooltip,
      ThemeProvider,
      AppIntlProvider,
      getMessagesForLocale,
      Toaster,
      Fragment,
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
      name: 'fixture-componentization-matrix',
      setup(build) {
        build.onLoad({ filter: /quiet-componentization\.qa\.mjs$/ }, () => ({ contents: entry, loader: 'ts' }));
        build.onLoad({ filter: /\/use-realtime\.ts$/ }, () => ({ contents: realtime, loader: 'ts' }));
      },
    }],
  });
  assert(bundle.success && bundle.outputs.length === 1, 'Bundle de fechamento incompleto');
  const html = join(dir, 'matrix.html');
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

  let totalScenarios = 0;
  for (const width of [360, 390, 1440]) {
    const backgrounds = [];
    for (const theme of ['light', 'dark']) {
      const shellOut = await cli('run-code', `(page) => (${runCases.toString()})(page, ${JSON.stringify(html)}, ${width}, ${JSON.stringify(theme)}, "shell-ops", ${JSON.stringify(localeFlagBodies)})`);
      const shellJson = shellOut.match(/^### Result\s*\n([^\n]+)/m)?.[1];
      assert(shellJson, `${width}/${theme}/shell-ops: sem resultado`);
      const shellRes = JSON.parse(shellJson);
      assert.equal(shellRes.length, 5);
      const witness = shellRes.find((item) => item.name === 'testemunha-css-breakpoint-tema')?.witness;
      assert(witness, `${width}/${theme}: testemunha ausente`);
      backgrounds.push(witness.renderedBg);

      const domainOut = await cli('run-code', `(page) => (${runCases.toString()})(page, ${JSON.stringify(html)}, ${width}, ${JSON.stringify(theme)}, "domain-charts", ${JSON.stringify(localeFlagBodies)})`);
      const domainJson = domainOut.match(/^### Result\s*\n([^\n]+)/m)?.[1];
      assert(domainJson, `${width}/${theme}/domain-charts: sem resultado`);
      const domainRes = JSON.parse(domainJson);
      assert.equal(domainRes.length, 4);

      const cellCount = shellRes.length + domainRes.length;
      totalScenarios += cellCount;
      console.log(JSON.stringify({ session, width, theme, scenarios: cellCount, renderedBg: witness.renderedBg, mobileNavDisplay: witness.mobileNavDisplay }));
    }
    assert.notEqual(backgrounds[0], backgrounds[1], `${width}: fundo light e dark idênticos (${backgrounds[0]})`);
  }

  console.log(`${totalScenarios} cenários executados nas 6 células (360/390/1440 × light/dark); 0 skips.`);
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

if (failures.length) throw new AggregateError(failures, 'QA de fechamento da componentização não concluído');
