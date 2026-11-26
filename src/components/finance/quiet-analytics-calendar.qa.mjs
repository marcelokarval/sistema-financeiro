// Execute somente dentro do preflight único de navegador de 0018.
// QUIET_QA_SCRATCH: tmpfs privado, também pai de HOME/TMPDIR/XDG_*; sem .git ou banco.
// Variáveis RO do ref 30147767ffd244b7167ab817525086d5be6e9bf7:
// QUIET_QA_BASELINE_DEBT (debt-overview.tsx),
// QUIET_QA_BASELINE_CALENDAR (financial-calendar.tsx),
// QUIET_QA_BASELINE_REPORTS (financial-reports.tsx),
// QUIET_QA_BASELINE_EXPENSE (expense-breakdown.tsx),
// QUIET_QA_BASELINE_TIMELINE (spending-timeline.tsx),
// QUIET_QA_BASELINE_ANALYTICS (transaction-analytics.tsx),
// QUIET_QA_BASELINE_BILLS (upcoming-bills.tsx).
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { access, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const baseRef = '30147767ffd244b7167ab817525086d5be6e9bf7';
const baselineSpecs = [
  {
    env: 'QUIET_QA_BASELINE_DEBT',
    file: 'debt-overview.tsx',
    hash: 'ccc494330d5ed2fd461ae8db8b870c89810b9a2269733a2708366f09cad3317c',
  },
  {
    env: 'QUIET_QA_BASELINE_CALENDAR',
    file: 'financial-calendar.tsx',
    hash: 'a80829fd68030290b759db8691066b61c002f7c62725188089521af07de696f8',
  },
  {
    env: 'QUIET_QA_BASELINE_REPORTS',
    file: 'financial-reports.tsx',
    hash: 'ef22d5ad944d07b8723c1ec3d3431fb0ffaecd0c3fb4a62f2730cfbbeb320c92',
  },
  {
    env: 'QUIET_QA_BASELINE_EXPENSE',
    file: 'expense-breakdown.tsx',
    hash: '8f492182e7802a546efeca460edcbcf24c37f7cc210a34f669d1244353d2132a',
  },
  {
    env: 'QUIET_QA_BASELINE_TIMELINE',
    file: 'spending-timeline.tsx',
    hash: '0effd8ad29f670c23e9158b60c4579a7d2acb90a7817a1444282526127479ddc',
  },
  {
    env: 'QUIET_QA_BASELINE_ANALYTICS',
    file: 'transaction-analytics.tsx',
    hash: '4cefb15cd999da78dac40e7c40f89635906687d661d3c61ee390e4392ba4f68d',
  },
  {
    env: 'QUIET_QA_BASELINE_BILLS',
    file: 'upcoming-bills.tsx',
    hash: 'ae7eeeea85f2017cf4df506fdc9401736fbf7993d9e266bc3227d589dc81e762',
  },
];

const source = fileURLToPath(import.meta.url);
const financeDir = dirname(source);
const root = fileURLToPath(new URL('../../../', import.meta.url));

function installFixture(
  DebtOverview,
  FinancialCalendar,
  FinancialReportsWidget,
  ExpenseBreakdown,
  SpendingTimeline,
  TransactionAnalytics,
  UpcomingBills,
  AppIntlProvider,
  getMessagesForLocale,
  createElement,
  createRoot,
  ThemeProvider,
  useState,
) {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const day10 = `${ym}-10`;
  const day15 = `${ym}-15`;

  const calendar30 = {
    days: [
      {
        date: day10,
        dayOfWeek: 'ter',
        income: 500,
        expense: 120,
        events: [
          { id: 'ev-1', type: 'transaction', description: 'Freela QA', amount: 500, category: 'Renda', isRecurring: false },
          { id: 'ev-2', type: 'purchase', description: 'Mercado QA', amount: -120, category: 'Casa', isRecurring: false },
        ],
      },
      {
        date: day15,
        dayOfWeek: 'dom',
        income: 0,
        expense: 300,
        events: [
          { id: 'ev-3', type: 'recurring', description: 'Energia QA', amount: -300, category: 'Moradia', isRecurring: true },
        ],
      },
    ],
    summary: {
      totalUpcoming: 80,
      totalBills: 3,
      totalIncome: 500,
      totalExpense: 420,
      upcomingBiggestExpense: { description: 'Energia QA', amount: 300, date: day15 },
      nextPaymentDate: day10,
    },
  };

  const calendar7 = {
    days: [],
    summary: {
      totalUpcoming: 0,
      totalBills: 0,
      totalIncome: 0,
      totalExpense: 0,
      upcomingBiggestExpense: null,
      nextPaymentDate: null,
    },
  };

  const debtsData = {
    totalDebt: 2500,
    cardDebt: 1500,
    installmentDebt: 1000,
    consortiumDebt: 0,
    debtToIncomeRatio: 25,
    monthlyIncome: 10000,
    cards: [
      {
        id: 'card-a',
        name: 'Cartão A',
        brand: 'VISA',
        lastFourDigits: '1111',
        creditLimit: 5000,
        currentBalance: 1500,
        utilizationRate: 30,
        color: '#8b5cf6',
        dueDay: 10,
      },
    ],
    installments: [
      {
        id: 'inst-a',
        description: 'Plano A',
        totalAmount: 2000,
        paidAmount: 1000,
        remaining: 1000,
        installmentCount: 10,
        paidInstallments: 5,
        monthlyValue: 200,
        interestRate: 0,
        type: 'CARD_INSTALLMENT',
        status: 'ACTIVE',
        cardName: 'Cartão A',
        nextPaymentDate: day15,
      },
    ],
    consortiums: [],
  };

  const reportsData = {
    monthlyData: [
      { month: 'jan', income: 4000, expense: 2000, net: 2000, transactionCount: 8, purchaseCount: 4, avgDailySpend: 66.7, savingsRate: 50 },
      { month: 'fev', income: 4500, expense: 1800, net: 2700, transactionCount: 9, purchaseCount: 3, avgDailySpend: 60.0, savingsRate: 60 },
    ],
    topExpenseCategory: { name: 'Moradia', color: '#8b5cf6', total: 1200, count: 3 },
    topCategories: [
      { name: 'Moradia', color: '#8b5cf6', total: 1200, count: 3 },
      { name: 'Alimentação', color: '#0ea5e9', total: 600, count: 5 },
    ],
    avgDailySpend: 63.3,
    highestExpense: { id: 'e1', description: 'Aluguel QA', amount: 1200, date: '2026-02-05' },
    lowestIncome: { id: 'i1', description: 'Freela QA', amount: 500, date: '2026-02-10' },
    savingsRateTrend: [
      { month: 'jan', rate: 50 },
      { month: 'fev', rate: 60 },
    ],
    ticketMedio: 250,
  };

  const expense6 = {
    categories: [
      { categoryId: 'cat-1', categoryName: 'Moradia', categoryColor: '#8b5cf6', total: 1200, percentage: 66.7, transactionCount: 2, purchaseCount: 1 },
      { categoryId: 'cat-2', categoryName: 'Alimentação', categoryColor: '#0ea5e9', total: 600, percentage: 33.3, transactionCount: 3, purchaseCount: 2 },
    ],
    totalExpense: 1800,
    topCategory: { categoryId: 'cat-1', categoryName: 'Moradia', categoryColor: '#8b5cf6', total: 1200, percentage: 66.7, transactionCount: 2, purchaseCount: 1 },
    monthlyData: [
      { month: 'jan', monthKey: '2026-01', total: 900 },
      { month: 'fev', monthKey: '2026-02', total: 900 },
    ],
  };

  const expense1 = {
    categories: [],
    totalExpense: 0,
    topCategory: null,
    monthlyData: [],
  };

  const timelineData = [
    {
      date: day10,
      income: 500,
      expense: 120,
      net: 380,
      count: 2,
      runningBalance: 1380,
      items: [
        { type: 'transaction', description: 'Freela Timeline', amount: 500, category: 'Renda' },
        { type: 'purchase', description: 'Padaria Timeline', amount: -120, category: 'Alimentação' },
      ],
    },
    {
      date: day15,
      income: 0,
      expense: 0,
      net: 0,
      count: 0,
      runningBalance: 1380,
      items: [],
    },
  ];

  const analyticsAll = {
    overview: {
      totalTransactions: 12,
      totalIncome: 4500,
      totalExpense: 1800,
      averagePerTransaction: 525,
      highestTransaction: { description: 'Salário QA', amount: 4000, date: '2026-02-01', categoryName: 'Renda', type: 'INCOME' },
      lowestTransaction: { description: 'Café QA', amount: 15, date: '2026-02-03', categoryName: 'Alimentação', type: 'EXPENSE' },
      mostFrequentCategory: { categoryName: 'Alimentação', categoryColor: '#0ea5e9', count: 5, total: 600 },
      weekdayBreakdown: [{ day: 'Seg', income: 500, expense: 120, count: 2 }],
    },
    monthlyComparison: [{ month: 'fev', income: 4500, expense: 1800, net: 2700, count: 12, avgPerTx: 525 }],
    topMerchants: [{ name: 'Mercado QA', count: 4, total: 600, category: 'Alimentação' }],
    amountDistribution: [{ range: '0-100', count: 4, percentage: 33.3 }],
    dailyPattern: [{ hour: '10h', count: 3 }],
  };

  const analyticsExpense = {
    ...analyticsAll,
    overview: { ...analyticsAll.overview, totalTransactions: 6, totalIncome: 0, totalExpense: 1800, averagePerTransaction: 300 },
  };

  const billsData = {
    bills: [
      { id: 'b-1', type: 'recurring', title: 'Conta Vencida QA', amount: 100, dueDate: '2026-11-10', daysUntilDue: -2, status: 'overdue', source: 'Energia' },
      { id: 'b-2', type: 'card', title: 'Fatura Cartão QA', amount: 250, dueDate: '2026-11-18', daysUntilDue: 2, status: 'urgent', source: 'Cartão A' },
    ],
    summary: { thisWeek: { count: 2, amount: 350 }, thisMonth: { count: 2, amount: 350 }, totalAmount: 350 },
  };

  const qa = window.qa = {
    calls: [],
    unexpected: [],
    rootInstance: null,
    day10,
    day15,
  };

  window.fetch = async (input, init) => {
    const rawUrl = typeof input === 'string' ? input : input.url;
    const url = rawUrl.replace(/^https?:\/\/[^/]+/, '');
    const method = init?.method ?? 'GET';
    qa.calls.push({ method, url });

    if (method === 'GET') {
      if (url === '/api/financial-calendar?days=7') return Response.json(calendar7);
      if (url.startsWith('/api/financial-calendar')) return Response.json(calendar30);
      if (url === '/api/debts') return Response.json(debtsData);
      if (url.startsWith('/api/reports')) return Response.json(reportsData);
      if (url === '/api/expense-breakdown?months=1') return Response.json(expense1);
      if (url.startsWith('/api/expense-breakdown')) return Response.json(expense6);
      if (url.startsWith('/api/timeline')) return Response.json(timelineData);
      if (url === '/api/transaction-analytics?months=6&type=EXPENSE') return Response.json(analyticsExpense);
      if (url.startsWith('/api/transaction-analytics')) return Response.json(analyticsAll);
      if (url === '/api/upcoming-bills') return Response.json(billsData);
    }

    qa.unexpected.push(`${method} ${url}`);
    throw new Error(`Fetch fora da fixture: ${method} ${url}`);
  };

  function BillsHarness() {
    const [showValues, setShowValues] = useState(true);
    return createElement(
      'div',
      { className: 'space-y-3' },
      createElement(
        'button',
        {
          type: 'button',
          id: 'qa-toggle-privacy',
          className: 'min-h-9 rounded-md border border-border px-3 text-xs',
          onClick: () => setShowValues((v) => !v),
        },
        showValues ? 'Ocultar valores' : 'Mostrar valores',
      ),
      createElement(UpcomingBills, { showValues }),
    );
  }

  function SuiteView({ domain }) {
    if (domain === 'calendar') return createElement(FinancialCalendar);
    if (domain === 'debt') return createElement(DebtOverview);
    if (domain === 'reports') return createElement(FinancialReportsWidget);
    if (domain === 'expense') return createElement(ExpenseBreakdown);
    if (domain === 'timeline') return createElement(SpendingTimeline);
    if (domain === 'analytics') return createElement(TransactionAnalytics);
    return createElement(BillsHarness);
  }

  qa.mount = (theme, domain) => {
    qa.calls = [];
    qa.unexpected = [];
    const host = document.getElementById('root');
    if (qa.rootInstance) qa.rootInstance.unmount();
    qa.rootInstance = createRoot(host);
    qa.rootInstance.render(
      createElement(
        ThemeProvider,
        { attribute: 'class', forcedTheme: theme, disableTransitionOnChange: true },
        createElement(
          AppIntlProvider,
          { locale: 'pt', messages: getMessagesForLocale('pt') },
          createElement('main', { id: 'fixture', className: 'min-h-screen bg-background p-3' }, createElement(SuiteView, { domain })),
        ),
      ),
    );
  };

  qa.focus = (node = document.activeElement) => ({
    role: node?.getAttribute('role') || (node?.tagName === 'BUTTON' ? 'button'
      : /^H[1-6]$/.test(node?.tagName) ? 'heading' : node?.tagName === 'BODY' ? 'body' : node?.tagName?.toLowerCase() ?? null),
    name: node === document.body ? '' : (node?.getAttribute('aria-label') ?? node?.textContent ?? '').trim(),
    connected: !!node?.isConnected,
    focused: !!node && document.activeElement === node,
  });
}

async function runCases(page, html, width, theme, phase) {
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

    const assertReflow = async () => {
      const box = await page.evaluate(() => {
        const el = document.getElementById('fixture');
        if (!el) throw new Error('Superfície #fixture ausente');
        const r = el.getBoundingClientRect();
        return {
          viewport: window.innerWidth,
          page: document.documentElement.scrollWidth,
          left: r.left,
          right: r.right,
          width: el.clientWidth,
          content: el.scrollWidth,
        };
      });
      require(
        box.viewport === width && box.page <= width && box.left >= -1 && box.right <= width + 1 && box.content <= box.width + 1,
        `overflow em ${width}/${theme}: ${JSON.stringify(box)}`,
      );
    };

    const tabUntilFocused = async (target, maxSteps = 20) => {
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      for (let i = 0; i < maxSteps; i++) {
        await page.keyboard.press('Tab');
        if (await target.evaluate((node) => node === document.activeElement)) return;
      }
      throw new Error('Tab não alcançou o controle esperado');
    };

    const mountDomain = async (domain, readyCheck) => {
      await page.goto(url);
      await page.waitForFunction(() => Boolean(window.qa));
      await page.evaluate(([t, d]) => window.qa.mount(t, d), [theme, domain]);
      await readyCheck();
      await frame();
    };

    const record = async (name, run) => {
      try {
        const obs = await run();
        same(await page.evaluate(() => window.qa.unexpected), [], 'requisições inesperadas');
        same(errors, [], 'erros no DOM');
        same(rejected, [], 'rede não autorizada');
        results.push({ name, ...obs });
      } catch (error) {
        throw new Error(`${width}/${theme} ${name}: ${error.message}`);
      }
    };

    if (phase === 'witness-calendar') {
      await record('testemunha do tema e viewport', async () => {
        await mountDomain('calendar', () => page.getByRole('heading', { name: 'Calendário Financeiro' }).waitFor());
        await assertReflow();
        const witness = await page.evaluate((selected) => {
          const outer = document.getElementById('fixture');
          const rendered = getComputedStyle(outer).backgroundColor;
          const probe = document.createElement('i');
          probe.style.backgroundColor = 'var(--background)';
          outer.appendChild(probe);
          const expected = getComputedStyle(probe).backgroundColor;
          probe.remove();
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

      await record('calendario/teclado-dia-mes-recorte', async () => {
        await mountDomain('calendar', () => page.getByText('Freela QA').waitFor());
        await assertReflow();

        const btn7 = btn(page, '7 dias');
        await tabUntilFocused(btn7);
        await page.keyboard.press('Enter');
        await page.getByText('Nenhum evento nos próximos dias').waitFor();
        await frame();
        const zeroPressed = await btn7.getAttribute('aria-pressed');
        const zeroBillsText = await page.locator('dl[aria-label="Resumo do intervalo"]').textContent();
        require(zeroPressed === 'true' && zeroBillsText?.includes('0'), 'Recorte 7 dias não atualizou para zero');

        await btn(page, '30 dias').click();
        await page.getByText('Freela QA').waitFor();
        await frame();

        const day10Btn = page.locator('button[aria-pressed]').filter({ hasText: /^10/ }).first();
        await tabUntilFocused(day10Btn, 45);
        await page.keyboard.press('Enter');
        await frame();
        const dayPressed = await day10Btn.getAttribute('aria-pressed');
        const dayFocus = await page.evaluate(() => window.qa.focus());
        const agendaHeading = await page.locator('#calendar-agenda-heading').textContent();
        const agendaText = await page.locator('[aria-labelledby="calendar-agenda-heading"]').textContent();
        require(dayPressed === 'true', 'Enter não selecionou dia 10');
        require(agendaText?.includes('Freela QA') && agendaText?.includes('Mercado QA') && !agendaText?.includes('Energia QA'), 'Agenda do dia 10 incorreta');

        const prevMonth = btn(page, 'Mês anterior');
        const monthTextBefore = await prevMonth.locator('..').locator('span').first().textContent();
        await prevMonth.focus();
        await page.keyboard.press('Enter');
        await frame();
        const monthTextPrev = await prevMonth.locator('..').locator('span').first().textContent();
        const focusPrev = await page.evaluate(() => window.qa.focus());
        require(monthTextPrev !== monthTextBefore, 'Mês anterior não alterou mês exibido');

        const nextMonth = btn(page, 'Próximo mês');
        await nextMonth.focus();
        await page.keyboard.press('Enter');
        await frame();
        const monthTextNext = await nextMonth.locator('..').locator('span').first().textContent();
        const focusNext = await page.evaluate(() => window.qa.focus());
        require(monthTextNext === monthTextBefore, 'Próximo mês não restaurou mês inicial');

        await assertReflow();
        return {
          zeroPressed,
          dayPressed,
          dayFocus,
          agendaHasDate: Boolean(agendaHeading?.includes('10')),
          focusPrev,
          focusNext,
          violations: [],
        };
      });
    }

    if (phase === 'analytics-disclosure') {
      await record('dividas/expansao-teclado', async () => {
        await mountDomain('debt', () => page.getByRole('heading', { name: 'Painel de Dívidas' }).waitFor());
        await assertReflow();

        const cardsToggle = page.locator('button[aria-expanded]').filter({ hasText: 'Cartões de Crédito' });
        await tabUntilFocused(cardsToggle, 20);
        await page.keyboard.press('Enter');
        await page.getByText('Cartão A').waitFor();
        await frame();
        const expandedTrue = await cardsToggle.getAttribute('aria-expanded');
        const focusExpanded = await page.evaluate(() => window.qa.focus());

        await page.keyboard.press('Enter');
        await page.getByText('Cartão A').waitFor({ state: 'detached' });
        await frame();
        const expandedFalse = await cardsToggle.getAttribute('aria-expanded');

        const consortiumDisabled = await page.locator('button[aria-expanded]').filter({ hasText: 'Consórcios' }).getAttribute('aria-disabled');
        require(expandedTrue === 'true' && expandedFalse === 'false' && consortiumDisabled === 'true', 'Expansão de dívidas divergente');
        await assertReflow();
        return { expandedTrue, expandedFalse, consortiumDisabled, focusExpanded, violations: [] };
      });

      await record('relatorios/abas-teclado', async () => {
        await mountDomain('reports', () => page.getByRole('heading', { name: 'Relatórios Financeiros' }).waitFor());
        await assertReflow();

        const monthlyTab = page.getByRole('tab', { name: 'Visão Mensal', exact: true });
        await tabUntilFocused(monthlyTab, 15);
        await page.keyboard.press('ArrowRight');
        await page.getByText('Top Categorias de Despesa').waitFor();
        await frame();
        const analysisSelected = await page.getByRole('tab', { name: 'Análise', exact: true }).getAttribute('aria-selected');
        const focusAnalysis = await page.evaluate(() => window.qa.focus());
        const indicatorsText = await page.locator('dl[aria-label="Indicadores do relatório"]').textContent();
        require(analysisSelected === 'true' && indicatorsText?.includes('Ticket médio'), 'Aba Análise não abriu por teclado');

        await page.keyboard.press('ArrowLeft');
        await page.locator('[aria-label="Detalhamento mensal"]').waitFor();
        await frame();
        const monthlySelected = await monthlyTab.getAttribute('aria-selected');
        await assertReflow();
        return { analysisSelected, monthlySelected, focusAnalysis, violations: [] };
      });

      await record('despesas/periodo-categoria-zero', async () => {
        await mountDomain('expense', () => page.getByRole('heading', { name: 'Detalhamento de despesas' }).waitFor());
        await assertReflow();

        const moradiaBtn = page.locator('button[aria-expanded]').filter({ hasText: 'Moradia' });
        await tabUntilFocused(moradiaBtn, 20);
        await page.keyboard.press('Enter');
        await page.getByText('Estimativa mensal pela participação da categoria').waitFor();
        await frame();
        const expanded = await moradiaBtn.getAttribute('aria-expanded');

        const monthBtn = btn(page, 'Mês atual');
        await monthBtn.click();
        await page.getByText('Nenhuma categoria com despesas para exibir.').waitFor();
        await frame();
        const pressed = await monthBtn.getAttribute('aria-pressed');
        const zeroPresent = (await page.locator('#fixture').textContent())?.includes('0,00');
        require(expanded === 'true' && pressed === 'true' && zeroPresent, 'Despesas mês atual sem estado zero');
        await assertReflow();
        return { expanded, pressed, zeroPresent, violations: [] };
      });

      await record('timeline/dia-expansao', async () => {
        await mountDomain('timeline', () => page.getByRole('heading', { name: 'Linha do tempo' }).waitFor());
        await assertReflow();

        const dayBtn = page.locator('button[aria-expanded]').first();
        await tabUntilFocused(dayBtn, 20);
        await page.keyboard.press('Enter');
        await page.getByText('Freela Timeline').waitFor();
        await frame();
        const expanded = await dayBtn.getAttribute('aria-expanded');
        const emptyVisible = await page.getByText('Sem movimentações').isVisible();
        require(expanded === 'true' && emptyVisible, 'Timeline não preservou expansão e dia sem movimento');
        await assertReflow();
        return { expanded, emptyVisible, violations: [] };
      });

      await record('analises/abas-filtro', async () => {
        await mountDomain('analytics', () => page.getByRole('heading', { name: 'Análise de Transações' }).waitFor());
        await assertReflow();

        const expBtn = btn(page, 'Despesas');
        await expBtn.click();
        await page.waitForFunction(() => window.qa.calls.some((c) => c.url.includes('type=EXPENSE')));
        await frame();
        const expPressed = await expBtn.getAttribute('aria-pressed');

        const overviewTab = page.getByRole('tab', { name: 'Visão Geral', exact: true });
        await tabUntilFocused(overviewTab, 20);
        await page.keyboard.press('ArrowRight');
        await page.getByText('Distribuição por Valor').waitFor();
        await frame();
        await page.keyboard.press('ArrowRight');
        await page.getByText('Top 5 Estabelecimentos').waitFor();
        await frame();
        const patternsSelected = await page.getByRole('tab', { name: 'Padrões', exact: true }).getAttribute('aria-selected');
        const focusPatterns = await page.evaluate(() => window.qa.focus());
        require(expPressed === 'true' && patternsSelected === 'true', 'Filtro/abas de Análises falhou');
        await assertReflow();
        return { expPressed, patternsSelected, focusPatterns, violations: [] };
      });

      await record('vencimentos/disclosure-mascara', async () => {
        await mountDomain('bills', () => page.getByRole('heading', { name: 'Próximos vencimentos' }).waitFor());
        await assertReflow();

        const totalsSummary = page.locator('summary', { hasText: 'Totais de vencimentos' });
        await totalsSummary.click();
        await frame();
        const visibleTotal = await page.getByText('Até o fim da semana, incluindo atrasados (2)').isVisible();

        await page.locator('#qa-toggle-privacy').click();
        await frame();
        const maskedText = await page.locator('section[aria-label="Próximos vencimentos"]').textContent();
        const hasMask = Boolean(maskedText?.includes('R$ ••••••'));
        const leakedAmount = Boolean(maskedText && /100,00|250,00|350,00/.test(maskedText));
        require(visibleTotal && hasMask && !leakedAmount, 'Vencimentos falhou disclosure ou máscara');
        await assertReflow();
        return { visibleTotal, hasMask, leakedAmount, violations: [] };
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
for (const spec of baselineSpecs) {
  assert(isAbsolute(process.env[spec.env] ?? ''),
    `Forneça ${spec.env} absoluto com a fonte RO do ref ${baseRef}`);
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
const baselineContents = {};
for (const spec of baselineSpecs) {
  const contents = await readFile(process.env[spec.env], 'utf8');
  assert.equal(digest(contents), spec.hash, `SHA-256 inválido em ${spec.env} (${spec.file})`);
  baselineContents[spec.file] = contents;
}

const dir = await mkdtemp(join(scratch, 'quiet-analytics-calendar-'));
const session = `quiet-analytics-calendar-${randomUUID()}`;
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
    import { DebtOverview } from ${JSON.stringify(join(financeDir, 'debt-overview.tsx'))};
    import { FinancialCalendar } from ${JSON.stringify(join(financeDir, 'financial-calendar.tsx'))};
    import { FinancialReportsWidget } from ${JSON.stringify(join(financeDir, 'financial-reports.tsx'))};
    import { ExpenseBreakdown } from ${JSON.stringify(join(financeDir, 'expense-breakdown.tsx'))};
    import { SpendingTimeline } from ${JSON.stringify(join(financeDir, 'spending-timeline.tsx'))};
    import { TransactionAnalytics } from ${JSON.stringify(join(financeDir, 'transaction-analytics.tsx'))};
    import { UpcomingBills } from ${JSON.stringify(join(financeDir, 'upcoming-bills.tsx'))};
    import { AppIntlProvider } from ${JSON.stringify(join(root, 'src/i18n/provider.tsx'))};
    import { getMessagesForLocale } from ${JSON.stringify(join(root, 'src/i18n/messages.ts'))};
    import { createElement, useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { ThemeProvider } from 'next-themes';
    (${installFixture.toString()})(
      DebtOverview,
      FinancialCalendar,
      FinancialReportsWidget,
      ExpenseBreakdown,
      SpendingTimeline,
      TransactionAnalytics,
      UpcomingBills,
      AppIntlProvider,
      getMessagesForLocale,
      createElement,
      createRoot,
      ThemeProvider,
      useState,
    );
  `;

  async function htmlFor(label, useBaseline) {
    const intercepted = new Set();
    const baselineByPath = new Map(baselineSpecs.map((spec) => [join(financeDir, spec.file), spec.file]));
    const bundle = await Bun.build({
      entrypoints: [source],
      target: 'browser',
      format: 'iife',
      minify: true,
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{
        name: 'fixture-analytics-calendar',
        setup(build) {
          build.onLoad({ filter: /quiet-analytics-calendar\.qa\.mjs$/ }, () => ({ contents: entry, loader: 'ts' }));
          if (useBaseline) {
            build.onLoad({ filter: /\/src\/components\/finance\/[^/]+\.tsx$/ }, (args) => {
              const file = baselineByPath.get(args.path);
              if (!file) return undefined;
              intercepted.add(file);
              return { contents: baselineContents[file], loader: 'tsx' };
            });
          }
        },
      }],
    });
    assert(bundle.success && bundle.outputs.length === 1, `Bundle incompleto: ${label}`);
    if (useBaseline) assert.equal(intercepted.size, baselineSpecs.length, 'Baseline não interceptou todos os 7 módulos');
    const file = join(dir, `${label}.html`);
    const script = (await bundle.outputs[0].text()).replace(/<\/script/gi, '<\\/script');
    await writeFile(
      file,
      `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><style>${css.replace(/<\/style/gi, '<\\/style')}</style><body class="antialiased bg-background text-foreground"><div id="root"></div><script>${script}</script></body></html>`,
    );
    return file;
  }

  const html = { baseline: await htmlFor('baseline', true), candidate: await htmlFor('candidate', false) };
  const candidateHashes = {};
  for (const file of [
    'debt-overview.tsx', 'debt-sections.tsx',
    'financial-calendar.tsx', 'financial-calendar-grid.tsx',
    'financial-reports.tsx', 'financial-report-tabs.tsx',
    'expense-breakdown.tsx', 'expense-category-details.tsx',
    'spending-timeline.tsx', 'spending-day-details.tsx',
    'transaction-analytics.tsx', 'transaction-analysis-tabs.tsx',
    'upcoming-bills.tsx',
  ]) {
    candidateHashes[file] = digest(await readFile(join(financeDir, file)));
  }
  console.log(JSON.stringify({ session, baseRef, candidateHashes }));

  attemptedOpen = true;
  const opened = JSON.parse(await cli('open', 'about:blank', '--browser=chrome', '--idle-timeout=120000', '--json'));
  assert.equal(opened.session, session);
  assert(Number.isInteger(opened.pid) && opened.pid > 1, 'Daemon sem PID verificável');
  daemonPid = opened.pid;
  await cli('snapshot');

  const gaps = [];
  const preexistingQuietDivergences = [];
  let count = 0;

  async function runPhase(width, theme, phase, expectedCount) {
    const observed = {};
    for (const label of ['baseline', 'candidate']) {
      const outcome = await cli('run-code', `(page) => (${runCases.toString()})(page, ${JSON.stringify(html[label])}, ${width}, ${JSON.stringify(theme)}, ${JSON.stringify(phase)})`);
      const result = outcome.match(/^### Result\s*\n([^\n]+)/m)?.[1];
      assert(result, `${label}/${phase}: ausência de resultado do DOM`);
      observed[label] = JSON.parse(result);
      assert.equal(observed[label].length, expectedCount, `${label}/${phase}: cenário incompleto (${observed[label].length} vs ${expectedCount})`);
    }
    count += observed.candidate.length;
    console.log(JSON.stringify({ session, baseRef, width, theme, phase, scenarios: observed.candidate.length }));

    const parity = Bun.deepEquals(observed.baseline, observed.candidate);
    if (!parity) gaps.push(`${width}/${theme}/${phase}: divergência de paridade`);

    for (const entryResult of observed.candidate) {
      const baseEntry = observed.baseline.find(({ name }) => name === entryResult.name);
      for (const violation of entryResult.violations) {
        if (baseEntry?.violations.includes(violation)) {
          preexistingQuietDivergences.push({ cell: `${width}/${theme}`, scenario: entryResult.name, violation, parityConfirmed: parity });
        } else {
          gaps.push(`${width}/${theme} ${entryResult.name}: ${violation}`);
        }
      }
    }
    return observed;
  }

  for (const width of [360, 390, 1440]) {
    const backgrounds = [];
    for (const theme of ['light', 'dark']) {
      const obsWitness = await runPhase(width, theme, 'witness-calendar', 2);
      const witness = obsWitness.candidate.find(({ name }) => name === 'testemunha do tema e viewport')?.witness;
      assert(witness && witness.width === width && witness.theme === theme && !witness.overflow, `Testemunha inválida em ${width}/${theme}`);
      backgrounds.push(witness.background);
      await runPhase(width, theme, 'analytics-disclosure', 6);
    }
    if (backgrounds[0] === backgrounds[1]) gaps.push(`${width}: fundo claro/escuro idêntico`);
  }

  if (preexistingQuietDivergences.length) {
    console.log(JSON.stringify({
      warning: 'AVISO: divergência Quiet preexistente aberta (NÃO constitui conformidade Quiet).',
      quietCompliant: false,
      preexistingQuietDivergences,
    }));
  }

  assert.deepEqual(gaps, [], 'Falha no contrato Quiet/paridade');
  console.log(`${count} cenários pareados; 0 skips.${preexistingQuietDivergences.length ? ` Divergências Quiet preexistentes abertas: ${preexistingQuietDivergences.length}.` : ''}`);
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

if (failures.length) throw new AggregateError(failures, 'QA de Análises e Calendário não concluído');
