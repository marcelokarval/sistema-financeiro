/// <reference types="bun-types" />
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Presentation and wiring contracts; browser interaction is verified separately.
const widgets = [
  ['financial-calendar', 'Calendário Financeiro', "t('calendar.summaryAria')", 'financial-calendar'],
  ['networth-evolution', 'Evolução Patrimonial', "t('networth.indicatorsAria')", 'networth-evolution'],
  ['debt-overview', 'Visão de Dívidas', "t('debts.compositionAria')", 'debt-overview'],
  ['transaction-analytics', 'Análise de Transações', "t('transactions.overview.indicatorsAria')", 'transaction-analysis-tabs'],
  ['financial-reports', 'Relatórios Financeiros', "t('reports.indicatorsAria')", 'financial-report-tabs'],
] as const;

function source(name: string) {
  return readFileSync(new URL(`./${name}.tsx`, import.meta.url), 'utf8');
}

for (const [name, title, group, groupFile] of widgets) {
  test(`${title}: painel nomeado e grupo de dados sem ornamentação`, () => {
    const jsx = source(name);
    expect(jsx).toMatch(/<section aria-labelledby="[^"]+"/);
    expect(source(groupFile)).toContain(`aria-label={${group}}`);
    expect(jsx).not.toMatch(/bg-gradient|card-glow|<motion\./);
    expect(source(groupFile)).not.toMatch(/bg-gradient|card-glow|<motion\./);
    expect(source(groupFile)).toMatch(/import \{ currencyFmt(?:, [^}]+)? \} from '@\/lib\/helpers';/);
  });
}

function hasControl(name: string, labelKey: string, callback: string, attribute = 'onClick') {
  const file = ts.createSourceFile(name + '.tsx', source(name), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found = false;
  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const attrs = new Map(node.attributes.properties.flatMap((p) => ts.isJsxAttribute(p)
        ? [[p.name.getText(file), p.initializer?.getText(file)]] as const : []));
      if (attrs.get('aria-label') === `{${labelKey}}` && attrs.get(attribute) === callback) found = true;
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return found;
}

test('ações iconográficas mantêm seus callbacks e têm nome acessível', () => {
  expect(hasControl('financial-calendar', "t('calendar.refreshAria')", '{() => fetchData(activeDays)}')).toBe(true);
  expect(hasControl('financial-calendar-grid', "t('calendar.prevMonthAria')", '{() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}')).toBe(true);
  expect(hasControl('financial-calendar-grid', "t('calendar.nextMonthAria')", '{() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}')).toBe(true);
  expect(hasControl('networth-evolution', "t('networth.refreshAria')", '{() => fetchData(selectedMonths)}')).toBe(true);
  expect(hasControl('debt-overview', "t('debts.refreshAria')", '{fetchData}')).toBe(true);
  expect(hasControl('transaction-analytics', "t('transactions.refreshAria')", '{fetchData}')).toBe(true);
  expect(hasControl('financial-reports', "t('reports.refreshAria')", '{fetchReports}')).toBe(true);
});

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderWithIntl } from '@/test-utils/intl';
import { CANONICAL_LOCALES, type CanonicalLocale } from '@/i18n/config';
import { getMessagesForLocale } from '@/i18n/messages';
import { AppIntlBridgeContext } from '@/i18n/provider';

function ptUseContext(ctx: React.Context<unknown>, locale: CanonicalLocale = 'pt') {
  return ctx === AppIntlBridgeContext
    ? { locale, messages: getMessagesForLocale(locale) }
    : (ctx as unknown as { _currentValue?: unknown })._currentValue;
}

function withPtIntlDispatcher<T>(fn: () => T, locale: CanonicalLocale = 'pt'): T {
  const internals = (React as unknown as {
    __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown };
  }).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const previous = internals.H;
  internals.H = {
    useContext: (ctx: React.Context<unknown>) => ptUseContext(ctx, locale),
    useId: () => 'test-id',
    useMemo: (factory: () => unknown) => factory(),
    useCallback: (cb: unknown) => cb,
  };
  try {
    return fn();
  } finally {
    internals.H = previous;
  }
}
import * as reports from './financial-reports';
import * as analytics from './transaction-analytics';
import * as networth from './networth-evolution';
import * as debt from './debt-overview';
import * as calendar from './financial-calendar';

test('financial-reports mantém Tabs fora de CardHeader, exibe erro com retry e formata números com font-mono tabular-nums', () => {
  const jsx = source('financial-reports');
  const headerMatch = jsx.match(/<CardHeader[\s\S]*?<\/CardHeader>/g) ?? [];
  expect(headerMatch[0]).toBeDefined();
  expect(headerMatch[0]).not.toContain('<Tabs');
  expect(jsx).not.toMatch(/className="[^"]*\bh-8 w-8\b/);

  const ReportView = (reports as Record<string, any>).FinancialReportsContent;
  expect(typeof ReportView).toBe('function');

  const errorHtml = renderToStaticMarkup(<ReportView data={null} loading={false} activeTab="monthly" onTabChange={() => {}} onRetry={() => {}} />);
  expect(errorHtml).toContain('Tentar novamente');

  const readyHtml = renderToStaticMarkup(
    <ReportView
      loading={false}
      activeTab="analysis"
      onTabChange={() => {}}
      onRetry={() => {}}
      data={{
        monthlyData: [{ month: 'jan', income: 1000, expense: 400, net: 600, transactionCount: 2, purchaseCount: 1, avgDailySpend: 20, savingsRate: 60 }],
        topExpenseCategory: { name: 'Mercado', color: '#888', total: 400, count: 3 },
        topCategories: [{ name: 'Mercado', color: '#888', total: 400, count: 3 }],
        avgDailySpend: 20,
        highestExpense: { id: 'e1', description: 'Compra', amount: 400, date: '2026-01-01' },
        lowestIncome: { id: 'i1', description: 'Salário', amount: 1000, date: '2026-01-01' },
        savingsRateTrend: [{ month: 'jan', rate: 60 }],
        ticketMedio: 133.33,
      }}
    />,
  );
  expect(readyHtml).toMatch(/font-mono[^>]*tabular-nums[^>]*>R\$ 400,00/);
  expect(readyHtml).toMatch(/font-mono[^>]*tabular-nums[^>]*>60\.0%/);
});

test('transaction-analytics remove classe drop- quebrada e imports mortos, exibe erro com retry e tabular-nums', () => {
  const jsx = source('transaction-analytics');
  expect(jsx).not.toMatch(/\bdrop-\s|"[^"]*\bdrop-"/);
  expect(jsx).not.toMatch(/\bTrendingUp\b|\bTrendingDown\b/);
  expect(jsx).not.toMatch(/\bh-7\b|\bh-8 w-8\b/);

  const AnalyticsView = (analytics as Record<string, any>).TransactionAnalyticsContent;
  expect(typeof AnalyticsView).toBe('function');

  const errorHtml = renderToStaticMarkup(<AnalyticsView data={null} loading={false} typeFilter="ALL" onTypeFilterChange={() => {}} activeTab="overview" onTabChange={() => {}} onRetry={() => {}} />);
  expect(errorHtml).toContain('Tentar novamente');

  const readyHtml = renderToStaticMarkup(
    <AnalyticsView
      loading={false}
      typeFilter="ALL"
      onTypeFilterChange={() => {}}
      activeTab="overview"
      onTabChange={() => {}}
      onRetry={() => {}}
      data={{
        overview: {
          totalTransactions: 1, totalIncome: 500, totalExpense: 200, averagePerTransaction: 250,
          highestTransaction: { description: 'Aluguel', amount: 500, date: '2026-01-01', categoryName: 'Casa', type: 'INCOME' },
          lowestTransaction: { description: 'Café', amount: 15, date: '2026-01-02', categoryName: 'Lazer', type: 'EXPENSE' },
          mostFrequentCategory: null, weekdayBreakdown: [],
        },
        monthlyComparison: [], topMerchants: [], amountDistribution: [], dailyPattern: [],
      }}
    />,
  );
  expect(readyHtml).toMatch(/font-mono[^>]*tabular-nums[^>]*>R\$ 500,00/);
  expect(readyHtml).toMatch(/font-mono[^>]*tabular-nums[^>]*>R\$ 15,00/);
});

test('networth-evolution remove imports mortos, formata patrimônio com font-mono e adiciona role=progressbar', () => {
  const jsx = source('networth-evolution');
  expect(jsx).not.toMatch(/\bTrendingDown\b|\bTarget\b|transition-all/);

  const NetworthView = (networth as Record<string, any>).NetworthEvolutionContent;
  expect(typeof NetworthView).toBe('function');

  const errorHtml = renderToStaticMarkup(<NetworthView data={null} loading={false} selectedMonths={6} onSelectMonths={() => {}} onRetry={() => {}} />);
  expect(errorHtml).toContain('Tentar novamente');

  const readyHtml = renderToStaticMarkup(
    <NetworthView
      loading={false}
      selectedMonths={6}
      onSelectMonths={() => {}}
      onRetry={() => {}}
      data={{
        monthlyData: [
          { month: 'jan', netWorth: 20000, assets: 25000, liabilities: 5000, changePercent: 5, changeAmount: 1000 },
          { month: 'fev', netWorth: 25000, assets: 30000, liabilities: 5000, changePercent: 25, changeAmount: 5000 },
        ],
      }}
    />,
  );
  expect(readyHtml).toMatch(/role="progressbar"[^>]*aria-valuenow="25"/);
  expect(readyHtml).toContain('aria-valuemin="0"');
  expect(readyHtml).toContain('aria-valuemax="100"');
  expect(readyHtml).toMatch(/font-mono[^>]*tabular-nums[^>]*>R\$ 25\.000,00/);
  expect(readyHtml).toMatch(/font-mono[^>]*tabular-nums[^>]*>25\.0%/);
});

test('debt-overview remove dark: redundante e hover:bg-accent, formata valores em font-mono e usa progressbar acessível', () => {
  const jsx = source('debt-overview');
  expect(jsx).not.toMatch(/dark:text-\[var\(--|hover:bg-accent\/30|\bh-8 w-8\b/);

  const DebtView = (debt as Record<string, any>).DebtOverviewContent;
  expect(typeof DebtView).toBe('function');

  const html = renderToStaticMarkup(
    <DebtView
      loading={false}
      expandedType={null}
      onToggleExpand={() => {}}
      onRetry={() => {}}
      data={{
        totalDebt: 1500, cardDebt: 500, installmentDebt: 1000, consortiumDebt: 0,
        debtToIncomeRatio: 20, monthlyIncome: 7500,
        cards: [], installments: [], consortiums: [],
      }}
    />,
  );
  expect(html).toMatch(/aria-valuenow="20"[^>]*role="progressbar"|role="progressbar"[^>]*aria-valuenow="20"/);
  expect(html).toContain('aria-valuemin="0"');
  expect(html).toContain('aria-valuemax="100"');
  expect(html).toMatch(/font-mono[^>]*tabular-nums[^>]*>R\$ 1\.500,00/);
  expect(html).toMatch(/font-mono[^>]*tabular-nums[^>]*>20\.0%/);
});

test('financial-calendar usa ChevronRight, botão retry no erro e tamanhos acessíveis', () => {
  const jsx = source('financial-calendar');
  const gridJsx = source('financial-calendar-grid');
  expect(gridJsx).toContain('ChevronRight');
  expect(jsx).not.toContain('rotate-180');
  expect(gridJsx).not.toContain('rotate-180');
  expect(jsx).not.toMatch(/\bh-7 w-7\b|\bh-7\b|\bsize-8\b|\bfont-bold\b/);
  expect(gridJsx).not.toMatch(/\bh-7 w-7\b|\bh-7\b|\bsize-8\b|\bfont-bold\b/);

  const CalendarView = (calendar as Record<string, any>).FinancialCalendarContent;
  expect(typeof CalendarView).toBe('function');

  const errorHtml = renderToStaticMarkup(
    <CalendarView
      data={null}
      loading={false}
      activeDays={30}
      selectedDate={null}
      currentMonth={new Date('2026-01-15T12:00:00Z')}
      onSelectDays={() => {}}
      onSelectDate={() => {}}
      onChangeMonth={() => {}}
      onToday={() => {}}
      onRetry={() => {}}
    />,
  );
  expect(errorHtml).toContain('Tentar novamente');
});

import { QueryPanel } from '@/components/shared/query-panel';
import { FinanceChartTooltip } from '@/components/shared/finance-chart-tooltip';
import { Tooltip as RechartsTooltip, YAxis } from 'recharts';
import * as balanceProj from './balance-projection';
import * as cashFlow from './cash-flow-forecast';
import * as expenseBk from './expense-breakdown';
import * as timeline from './spending-timeline';
import { currencyFmt } from '@/lib/helpers';

function findButtonByText(node: unknown, label: string): { props: Record<string, any> } | undefined {
  if (!node || typeof node !== 'object') return undefined;
  const el = node as { type?: unknown; props?: Record<string, any> };
  const text = React.Children.toArray(el.props?.children)
    .map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : ''))
    .join('');
  if (typeof el.props?.onClick === 'function' && text.includes(label)) {
    return el as { props: Record<string, any> };
  }
  if (typeof el.type === 'function') {
    const rendered = withPtIntlDispatcher(() => (el.type as (props: Record<string, any>) => unknown)(el.props ?? {}));
    const hit = findButtonByText(rendered, label);
    if (hit) return hit;
  }
  for (const branch of [el.props?.controls, el.props?.children]) {
    for (const child of React.Children.toArray(branch)) {
      const hit = findButtonByText(child, label);
      if (hit) return hit;
    }
  }
  return undefined;
}

function runWithReactHarness(
  renderComponent: () => React.ReactElement<Record<string, any>>,
  getLocale: () => CanonicalLocale = () => 'pt',
) {
  const reactInternals = (React as unknown as {
    __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown };
  }).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const previousDispatcher = reactInternals.H;
  const state: unknown[] = [];
  const refs: { current: unknown }[] = [];
  const effects: { deps: readonly unknown[] | undefined; cleanup?: void | (() => void) }[] = [];
  const callbacks: { deps: readonly unknown[]; fn: unknown }[] = [];
  const memos: { deps: readonly unknown[]; value: unknown }[] = [];
  const sameDeps = (a: readonly unknown[] | undefined, b: readonly unknown[] | undefined) =>
    Boolean(a && b && a.length === b.length && a.every((dep, idx) => Object.is(dep, b[idx])));

  function renderTree() {
    let s = 0, r = 0, e = 0, c = 0, m = 0;
    const pendingEffects: Array<{ idx: number; fn: () => void | (() => void); deps: readonly unknown[] | undefined }> = [];
    reactInternals.H = {
      useState(initial: unknown) {
        const i = s++;
        if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
        return [state[i], (next: unknown) => { state[i] = typeof next === 'function' ? next(state[i]) : next; }];
      },
      useRef: (current: unknown) => (refs[r++] ??= { current }),
      useCallback(fn: unknown, deps: readonly unknown[]) {
        const i = c++;
        if (!sameDeps(callbacks[i]?.deps, deps)) callbacks[i] = { fn, deps };
        return callbacks[i].fn;
      },
      useMemo(factory: () => unknown, deps: readonly unknown[]) {
        const i = m++;
        if (!sameDeps(memos[i]?.deps, deps)) memos[i] = { deps, value: factory() };
        return memos[i].value;
      },
      useDebugValue: () => {},
      useContext: (ctx: React.Context<unknown>) => ptUseContext(ctx, getLocale()),
      useId: () => 'test-query-id',
      useSyncExternalStore: (_sub: unknown, getSnapshot: () => unknown) => getSnapshot(),
      useEffect(fn: () => void | (() => void), deps?: readonly unknown[]) {
        const i = e++;
        if (!effects[i] || !sameDeps(effects[i].deps, deps)) {
          pendingEffects.push({ idx: i, fn, deps });
        }
      },
    };
    try {
      const tree = renderComponent();
      for (const item of pendingEffects) {
        if (typeof effects[item.idx]?.cleanup === 'function') {
          (effects[item.idx].cleanup as () => void)();
        }
        effects[item.idx] = { deps: item.deps, cleanup: item.fn() };
      }
      return tree as React.ReactElement<Record<string, any>>;
    } finally {
      reactInternals.H = previousDispatcher;
    }
  }

  function cleanupAll() {
    for (const eff of effects) {
      if (typeof eff?.cleanup === 'function') eff.cleanup();
    }
  }

  return { renderTree, cleanupAll };
}

test('QueryPanel distingue loading, error com Tentar novamente, empty e success com zero real', () => {
  const loadingHtml = renderToStaticMarkup(
    <QueryPanel
      titleId="qp-test"
      title="Painel sintético"
      status="loading"
      loadingMessage="Carregando painel…"
      controls={<button type="button">6 meses</button>}
    >
      <p>Conteúdo não deve aparecer</p>
    </QueryPanel>,
  );
  expect(loadingHtml).toContain('aria-labelledby="qp-test"');
  expect(loadingHtml).toContain('aria-busy="true"');
  expect(loadingHtml).toContain('Carregando painel…');
  expect(loadingHtml).toContain('6 meses');
  expect(loadingHtml).not.toContain('Conteúdo não deve aparecer');

  let retried = 0;
  const errorEl = (
    <QueryPanel
      titleId="qp-test"
      title="Painel sintético"
      status="error"
      errorMessage="Falha na consulta."
      onRetry={() => { retried++; }}
    >
      <p>Conteúdo não deve aparecer</p>
    </QueryPanel>
  );
  const errorHtml = renderToStaticMarkup(errorEl);
  expect(errorHtml).toContain('role="alert"');
  expect(errorHtml).toContain('Falha na consulta.');
  expect(errorHtml).toContain('Tentar novamente');
  expect(errorHtml).not.toContain('Conteúdo não deve aparecer');

  const retryBtn = findButtonByText(
    withPtIntlDispatcher(() =>
      QueryPanel({
        titleId: 'qp-test',
        title: 'Painel sintético',
        status: 'error',
        errorMessage: 'Falha na consulta.',
        onRetry: () => { retried++; },
        children: null,
      }),
    ),
    'Tentar novamente',
  );
  expect(retryBtn).toBeDefined();
  retryBtn!.props.onClick();
  expect(retried).toBe(1);

  const emptyHtml = renderToStaticMarkup(
    <QueryPanel
      titleId="qp-test"
      title="Painel sintético"
      status="empty"
      emptyMessage="Nenhum registro no período."
    >
      <p>Conteúdo não deve aparecer</p>
    </QueryPanel>,
  );
  expect(emptyHtml).toContain('Nenhum registro no período.');
  expect(emptyHtml).not.toContain('Tentar novamente');
  expect(emptyHtml).not.toContain('Conteúdo não deve aparecer');

  const zeroSuccessHtml = renderToStaticMarkup(
    <QueryPanel
      titleId="qp-test"
      title="Painel sintético"
      status="success"
      emptyMessage="Nenhum registro no período."
    >
      <p>{currencyFmt(0)}</p>
    </QueryPanel>,
  );
  expect(zeroSuccessHtml).toContain('R$ 0,00');
  expect(zeroSuccessHtml).not.toContain('Nenhum registro no período.');
});

test('Projeção, Previsão e Despesas adotam QueryPanel preservando zero real e retry', () => {
  for (const file of ['balance-projection', 'cash-flow-forecast', 'expense-breakdown']) {
    expect(source(file)).toContain("from '@/components/shared/query-panel'");
  }

  const BalContent = (balanceProj as Record<string, any>).BalanceProjectionContent;
  const balZeroHtml = renderToStaticMarkup(
    <BalContent
      loading={false}
      selectedMonths={6}
      onSelectMonths={() => {}}
      onRetry={() => {}}
      data={{
        accounts: [],
        monthLabels: ['jan'],
        totalCurrentBalance: 0,
        totalProjected: 0,
        averageMonthlySavings: 0,
        savingsRate: 0,
        riskLevel: 'medium',
        months: 6,
      }}
    />,
  );
  expect(balZeroHtml).toContain('R$ 0,00');
  expect(balZeroHtml).toContain('0%');
  expect(balZeroHtml).toContain('Nenhuma conta para projetar.');

  const CashContent = (cashFlow as Record<string, any>).CashFlowForecastContent;
  const cashZeroHtml = renderToStaticMarkup(
    <CashContent
      loading={false}
      onRetry={() => {}}
      data={{
        forecastMonths: [{ month: 'jan', projectedIncome: 0, projectedExpense: 0, projectedNet: 0, confidence: 0 }],
        topExpenseCategories: [],
        riskAlerts: [],
        trendDirection: 'stable',
      }}
    />,
  );
  expect(cashZeroHtml).toContain('R$ 0,00');
  expect(cashZeroHtml).toContain('0% confiança');
  expect(renderToStaticMarkup(<CashContent loading={false} onRetry={() => {}} data={null} />)).toContain('Tentar novamente');
});

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

test('concorrência de período em expense-breakdown mantém B quando A resolve depois com sucesso ou falha', async () => {
  const originalFetch = globalThis.fetch;
  const req6 = Promise.withResolvers<Response>();
  const req1 = Promise.withResolvers<Response>();
  const req6Retry = Promise.withResolvers<Response>();
  const req1Again = Promise.withResolvers<Response>();
  const pendingByUrl = new Map<string, Promise<Response>[]>([
    ['/api/expense-breakdown?months=6', [req6.promise, req6Retry.promise]],
    ['/api/expense-breakdown?months=1', [req1.promise, req1Again.promise]],
  ]);
  globalThis.fetch = (async (url: string) => pendingByUrl.get(url)!.shift()!) as typeof fetch;

  const harness = runWithReactHarness(() => expenseBk.ExpenseBreakdown());
  try {
    let tree = harness.renderTree();
    const btn1 = findButtonByText(tree, 'Mês atual');
    expect(btn1).toBeDefined();
    btn1!.props.onClick();
    tree = harness.renderTree();

    req1.resolve(Response.json({ categories: [], totalExpense: 0, topCategory: null, monthlyData: [] }));
    await settle();

    // A (6 meses) resolve atrasada com sucesso: deve ser ignorada
    req6.resolve(Response.json({ categories: [], totalExpense: 999, topCategory: null, monthlyData: [] }));
    await settle();

    const htmlAfterLateSuccess = renderToStaticMarkup(harness.renderTree());
    expect(htmlAfterLateSuccess).toContain('R$ 0,00');
    expect(htmlAfterLateSuccess).not.toContain('R$ 999,00');

    // Novo ciclo: volta para 6 meses (A2 pendente) -> troca para 1 mês (B2 resolve) -> A2 falha atrasado
    const btn6 = findButtonByText(harness.renderTree(), '6 meses');
    btn6!.props.onClick();
    tree = harness.renderTree();
    findButtonByText(tree, 'Mês atual')!.props.onClick();
    harness.renderTree();

    req1Again.resolve(Response.json({ categories: [], totalExpense: 250, topCategory: null, monthlyData: [] }));
    await settle();

    req6Retry.resolve(new Response(null, { status: 503 }));
    await settle();

    const htmlAfterLateFailure = renderToStaticMarkup(harness.renderTree());
    expect(htmlAfterLateFailure).toContain('R$ 250,00');
    expect(htmlAfterLateFailure).not.toContain('Não foi possível carregar');
  } finally {
    harness.cleanupAll();
    globalThis.fetch = originalFetch;
  }
});

test('balance-projection descarta resposta e erro de selectedMonths anterior sem sobrescrever período vigente e permite retry', async () => {
  const originalFetch = globalThis.fetch;
  const makeProjection = (months: number, totalProjected: number) => Response.json({
    accounts: [],
    monthLabels: ['jan'],
    totalCurrentBalance: 1000,
    totalProjected,
    averageMonthlySavings: 100,
    savingsRate: 10,
    riskLevel: 'medium',
    months,
  });

  // Caso 1: A (6 meses) pendente -> troca para B (3 meses) -> B resolve -> A resolve depois com sucesso
  {
    const req6 = Promise.withResolvers<Response>();
    const req3 = Promise.withResolvers<Response>();
    const signals: Array<{ url: string; signal?: AbortSignal | null }> = [];
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      signals.push({ url, signal: init?.signal });
      if (url === '/api/balance-projection?months=6') return req6.promise;
      if (url === '/api/balance-projection?months=3') return req3.promise;
      throw new Error(`URL inesperada: ${url}`);
    }) as typeof fetch;

    const harness = runWithReactHarness(() => balanceProj.BalanceProjection());
    try {
      const initialTree = harness.renderTree();
      findButtonByText(initialTree, '3 meses')!.props.onClick();
      harness.renderTree();

      expect(signals[0]?.signal?.aborted).toBe(true);
      expect(signals[1]?.signal?.aborted).toBe(false);

      req3.resolve(makeProjection(3, 3333));
      await settle();
      expect(renderToStaticMarkup(harness.renderTree())).toContain('R$ 3.333,00');

      req6.resolve(makeProjection(6, 9999));
      await settle();

      const afterLateSuccess = renderToStaticMarkup(harness.renderTree());
      expect(afterLateSuccess).toContain('R$ 3.333,00');
      expect(afterLateSuccess).not.toContain('R$ 9.999,00');
      expect(afterLateSuccess).toContain('Estimativas por conta · 3 meses');
    } finally {
      harness.cleanupAll();
      globalThis.fetch = originalFetch;
    }
  }

  // Caso 2: A (6 meses) pendente -> troca para B (3 meses) -> B resolve -> A resolve depois com HTTP 503
  {
    const req6 = Promise.withResolvers<Response>();
    const req3 = Promise.withResolvers<Response>();
    globalThis.fetch = (async (url: string) => {
      if (url === '/api/balance-projection?months=6') return req6.promise;
      if (url === '/api/balance-projection?months=3') return req3.promise;
      throw new Error(`URL inesperada: ${url}`);
    }) as typeof fetch;

    const harness = runWithReactHarness(() => balanceProj.BalanceProjection());
    try {
      const initialTree = harness.renderTree();
      findButtonByText(initialTree, '3 meses')!.props.onClick();
      harness.renderTree();

      req3.resolve(makeProjection(3, 3333));
      await settle();
      expect(renderToStaticMarkup(harness.renderTree())).toContain('R$ 3.333,00');

      req6.resolve(new Response(null, { status: 503 }));
      await settle();

      const afterLateFailure = renderToStaticMarkup(harness.renderTree());
      expect(afterLateFailure).toContain('R$ 3.333,00');
      expect(afterLateFailure).not.toContain('Não foi possível carregar a projeção de saldos.');
    } finally {
      harness.cleanupAll();
      globalThis.fetch = originalFetch;
    }
  }

  // Caso 3: A (6 meses) pendente -> B (3 meses) resolve -> A rejeita tarde por erro de rede -> B falha depois -> retry reconsulta B
  {
    const req6First = Promise.withResolvers<Response>();
    const req3First = Promise.withResolvers<Response>();
    const req6Reopen = Promise.withResolvers<Response>();
    const req3Fail = Promise.withResolvers<Response>();
    const req3Retry = Promise.withResolvers<Response>();
    const queue = new Map<string, Array<Promise<Response>>>([
      ['/api/balance-projection?months=6', [req6First.promise, req6Reopen.promise]],
      ['/api/balance-projection?months=3', [req3First.promise, req3Fail.promise, req3Retry.promise]],
    ]);
    const requestedUrls: string[] = [];
    globalThis.fetch = (async (url: string) => {
      requestedUrls.push(url);
      return queue.get(url)!.shift()!;
    }) as typeof fetch;

    const harness = runWithReactHarness(() => balanceProj.BalanceProjection());
    try {
      let tree = harness.renderTree();
      findButtonByText(tree, '3 meses')!.props.onClick();
      harness.renderTree();

      req3First.resolve(makeProjection(3, 3333));
      await settle();
      expect(renderToStaticMarkup(harness.renderTree())).toContain('R$ 3.333,00');

      req6First.reject(new Error('network failure'));
      await settle();
      const afterLateReject = renderToStaticMarkup(harness.renderTree());
      expect(afterLateReject).toContain('R$ 3.333,00');
      expect(afterLateReject).not.toContain('Não foi possível carregar a projeção de saldos.');

      // Reabertura do mesmo horizonte (3 -> 6 -> 3): antiga 6m não vaza e 3m em erro permite retry no período atual
      findButtonByText(harness.renderTree(), '6 meses')!.props.onClick();
      tree = harness.renderTree();
      expect(renderToStaticMarkup(tree)).toContain('Carregando projeção de saldos…');
      findButtonByText(tree, '3 meses')!.props.onClick();
      harness.renderTree();

      req6Reopen.resolve(makeProjection(6, 8888));
      req3Fail.resolve(new Response(null, { status: 503 }));
      await settle();

      const errorTree = harness.renderTree();
      const errorHtml = renderToStaticMarkup(errorTree);
      expect(errorHtml).toContain('Não foi possível carregar a projeção de saldos.');
      expect(errorHtml).not.toContain('R$ 8.888,00');

      const retryBtn = findButtonByText(errorTree, 'Tentar novamente');
      expect(retryBtn).toBeDefined();
      retryBtn!.props.onClick();
      harness.renderTree();

      req3Retry.resolve(makeProjection(3, 4444));
      await settle();

      const recoveredHtml = renderToStaticMarkup(harness.renderTree());
      expect(recoveredHtml).toContain('R$ 4.444,00');
      expect(recoveredHtml).toContain('Estimativas por conta · 3 meses');
      expect(requestedUrls).toEqual([
        '/api/balance-projection?months=6',
        '/api/balance-projection?months=3',
        '/api/balance-projection?months=6',
        '/api/balance-projection?months=3',
        '/api/balance-projection?months=3',
      ]);
    } finally {
      harness.cleanupAll();
      globalThis.fetch = originalFetch;
    }
  }
});

function findElementByType(node: unknown, targetType: unknown): { props: Record<string, any> } | undefined {
  if (!node || typeof node !== 'object') return undefined;
  const el = node as { type?: unknown; props?: Record<string, any> };
  if (el.type === targetType) return el as { props: Record<string, any> };
  for (const child of React.Children.toArray(el.props?.children)) {
    const hit = findElementByType(child, targetType);
    if (hit) return hit;
  }
  return undefined;
}

test('FinanceChartTooltip renderiza ponto ativo formatado, preserva sinal/unidade/máscara e retorna null sem ponto ativo ou payload incompatível', () => {
  const inactiveHtml = renderToStaticMarkup(
    <FinanceChartTooltip
      active={false}
      title="fev"
      rows={[{ key: 'netWorth', label: 'Patrimônio', value: 'R$ 1.250,00', color: 'var(--ds-chart-2)' }]}
    />,
  );
  expect(inactiveHtml).toBe('');

  const emptyHtml = renderToStaticMarkup(
    <FinanceChartTooltip active title="fev" rows={[]} />,
  );
  expect(emptyHtml).toBe('');

  const invalidRowsHtml = renderToStaticMarkup(
    <FinanceChartTooltip
      active
      title="fev"
      rows={[{ key: 'netWorth', label: 'Patrimônio', value: '' }]}
    />,
  );
  expect(invalidRowsHtml).toBe('');

  const activeHtml = renderToStaticMarkup(
    <FinanceChartTooltip
      active
      title="fev"
      capitalizeTitle
      rows={[
        { key: 'income', label: 'Receita', value: '+R$ 1.250,00', color: 'var(--ds-accent-positive)' },
        { key: 'net', label: 'Saldo', value: '−R$ 400,00', color: 'var(--primary)' },
        { key: 'rate', label: 'Taxa', value: '25.0%' },
      ]}
    />,
  );
  expect(activeHtml).toContain('bg-card');
  expect(activeHtml).toContain('border-border');
  expect(activeHtml).toContain('fev');
  expect(activeHtml).toContain('+R$ 1.250,00');
  expect(activeHtml).toContain('−R$ 400,00');
  expect(activeHtml).toContain('25.0%');

  const maskedHtml = renderToStaticMarkup(
    <FinanceChartTooltip
      active
      title="fev"
      showValues={false}
      rows={[
        { key: 'income', label: 'Receita', value: '+R$ 1.250,00', color: 'var(--ds-accent-positive)' },
        { key: 'rate', label: 'Taxa', value: '25.0%', maskedValue: '•••' },
      ]}
    />,
  );
  expect(maskedHtml).toContain('R$ ••••••');
  expect(maskedHtml).toContain('•••');
  expect(maskedHtml).not.toMatch(/1\.250|25\.0/);

  const tooltipShellSrc = readFileSync(new URL('../shared/finance-chart-tooltip.tsx', import.meta.url), 'utf8');
  expect(tooltipShellSrc).not.toMatch(/from 'recharts'|currencyFmt|shortCurrency|useState|useEffect/);
});

test('NetworthEvolutionContent adota FinanceChartTooltip sem alterar séries, escalas ou recortes', () => {
  const nwSrc = source('networth-evolution');
  expect(nwSrc).toContain("from '@/components/shared/finance-chart-tooltip'");

  const NetworthView = (networth as Record<string, any>).NetworthEvolutionContent;
  const tree = withPtIntlDispatcher(() =>
    NetworthView({
      loading: false,
      selectedMonths: 6,
      onSelectMonths: () => {},
      fetchData: () => {},
      onRetry: () => {},
      data: {
        monthlyData: [
          { month: 'jan', netWorth: 20000, assets: 25000, liabilities: 5000, changePercent: 5, changeAmount: 1000 },
          { month: 'fev', netWorth: -5000, assets: 5000, liabilities: 10000, changePercent: -125, changeAmount: -25000 },
        ],
      },
    }),
  );
  const tooltipEl = findElementByType(tree, RechartsTooltip);
  expect(tooltipEl).toBeDefined();
  expect(tooltipEl?.props.content?.type).toBe((networth as Record<string, any>).NetworthEvolutionTooltip);

  const NetworthTooltip = (networth as Record<string, any>).NetworthEvolutionTooltip;
  expect(typeof NetworthTooltip).toBe('function');

  const activeHtml = renderToStaticMarkup(
    <NetworthTooltip
      active
      label="fev"
      payload={[{ name: 'Patrimônio Líquido', dataKey: 'netWorth', value: -5000, color: 'var(--ds-chart-2)' }]}
    />,
  );
  expect(activeHtml).toContain('fev');
  expect(activeHtml).toContain('Patrimônio:');
  expect(activeHtml).toContain('-R$ 5.000,00');

  expect(renderToStaticMarkup(<NetworthTooltip active={false} label="fev" payload={[{ name: 'Patrimônio Líquido', dataKey: 'netWorth', value: -5000 }]} />)).toBe('');
  expect(renderToStaticMarkup(<NetworthTooltip active label="fev" payload={[]} />)).toBe('');
  expect(renderToStaticMarkup(<NetworthTooltip active label="fev" payload={[{ name: 'Patrimônio Líquido', dataKey: 'netWorth', value: Number.NaN }]} />)).toBe('');

  const maskedHtml = renderToStaticMarkup(
    <NetworthTooltip
      active
      label="fev"
      showValues={false}
      payload={[{ name: 'Patrimônio Líquido', dataKey: 'netWorth', value: -5000, color: 'var(--ds-chart-2)' }]}
    />,
  );
  expect(maskedHtml).toContain('R$ ••••••');
  expect(maskedHtml).not.toMatch(/5\.000|5000/);
});

test('Task 0018: debt-overview, financial-reports e transaction-analytics adotam FinanceChartTooltip e FinanceMetric com máscara e retorno nulo', () => {
  for (const [file, mod] of [
    ['debt-sections', debt],
    ['financial-report-tabs', reports],
    ['transaction-analysis-tabs', analytics],
  ] as const) {
    expect(source(file)).toContain("from '@/components/shared/finance-chart-tooltip'");
    expect(typeof mod).toBe('object');
  }
  expect(source('financial-calendar')).toContain("from '@/components/shared/finance-metric'");
  expect(source('financial-report-tabs')).toContain("from '@/components/shared/finance-metric'");
  expect(source('transaction-analysis-tabs')).toContain("from '@/components/shared/finance-metric'");
  expect(source('financial-calendar-grid')).toContain("from '@/components/shared/finance-row'");
  expect(source('debt-sections')).toContain("from '@/components/shared/finance-progress'");
  expect(source('transaction-analysis-tabs')).toContain("from '@/components/shared/finance-progress'");

  const DebtTooltip = (debt as Record<string, any>).DebtChartTooltip;
  expect(typeof DebtTooltip).toBe('function');
  const debtTipHtml = renderToStaticMarkup(
    <DebtTooltip active payload={[{ name: 'Cartões', value: 1200, payload: { fill: 'var(--ds-chart-4)' } }]} />,
  );
  expect(debtTipHtml).toContain('Cartões:');
  expect(debtTipHtml).toContain('R$ 1.200,00');
  expect(renderToStaticMarkup(<DebtTooltip active={false} payload={[{ name: 'Cartões', value: 1200 }]} />)).toBe('');
  expect(renderToStaticMarkup(<DebtTooltip active payload={[]} />)).toBe('');
  const debtTipMasked = renderToStaticMarkup(
    <DebtTooltip active showValues={false} payload={[{ name: 'Cartões', value: 1200, payload: { fill: 'var(--ds-chart-4)' } }]} />,
  );
  expect(debtTipMasked).toContain('R$ ••••••');
  expect(debtTipMasked).not.toContain('1.200');

  const ReportTooltip = (reports as Record<string, any>).FinancialReportsTooltip;
  expect(typeof ReportTooltip).toBe('function');
  const reportTipHtml = renderToStaticMarkup(
    <ReportTooltip
      active
      label="fev"
      payload={[
        { name: 'Receitas', dataKey: 'Receitas', value: 3000, color: 'var(--ds-chart-1)' },
        { name: 'Despesas', dataKey: 'Despesas', value: 1450.5, color: 'var(--ds-chart-3)' },
      ]}
    />,
  );
  expect(reportTipHtml).toContain('fev');
  expect(reportTipHtml).toContain('Receitas:');
  expect(reportTipHtml).toContain('R$ 3.000,00');
  expect(reportTipHtml).toContain('Despesas:');
  expect(reportTipHtml).toContain('R$ 1.450,50');
  expect(renderToStaticMarkup(<ReportTooltip active={false} label="fev" payload={[{ name: 'Receitas', value: 3000 }]} />)).toBe('');
  const reportTipMasked = renderToStaticMarkup(
    <ReportTooltip active showValues={false} label="fev" payload={[{ name: 'Receitas', value: 3000 }]} />,
  );
  expect(reportTipMasked).toContain('R$ ••••••');
  expect(reportTipMasked).not.toContain('3.000');

  const AnalyticsTooltip = (analytics as Record<string, any>).TransactionAnalyticsTooltip;
  expect(typeof AnalyticsTooltip).toBe('function');
  const weekdayTipHtml = renderToStaticMarkup(
    <AnalyticsTooltip
      active
      mode="weekday"
      label="Seg"
      payload={[
        { name: 'income', dataKey: 'income', value: 500, color: 'var(--ds-chart-1)' },
        { name: 'expense', dataKey: 'expense', value: 210, color: 'var(--ds-chart-4)' },
      ]}
    />,
  );
  expect(weekdayTipHtml).toContain('Seg');
  expect(weekdayTipHtml).toContain('Receitas:');
  expect(weekdayTipHtml).toContain('R$ 500,00');
  expect(weekdayTipHtml).toContain('Despesas:');
  expect(weekdayTipHtml).toContain('R$ 210,00');

  const hourlyTipHtml = renderToStaticMarkup(
    <AnalyticsTooltip
      active
      mode="hourly"
      label="14h"
      payload={[{ name: 'count', dataKey: 'count', value: 7, color: 'var(--ds-chart-2)' }]}
    />,
  );
  expect(hourlyTipHtml).toContain('14h');
  expect(hourlyTipHtml).toContain('Transações:');
  expect(hourlyTipHtml).toContain('7');
  expect(renderToStaticMarkup(<AnalyticsTooltip active mode="hourly" label="14h" payload={[{ name: 'count', value: Number.NaN }]} />)).toBe('');
});

test('Task 0018: seções extraídas de dívidas, calendário, relatórios e análises preservam expansão, abas, zeros e datas civis', () => {
  const DebtView = debt.DebtOverviewContent;
  const debtExpandedHtml = renderToStaticMarkup(
    <DebtView
      loading={false}
      expandedType="cards"
      onToggleExpand={() => {}}
      onRetry={() => {}}
      data={{
        totalDebt: 2500, cardDebt: 1500, installmentDebt: 1000, consortiumDebt: 0,
        debtToIncomeRatio: 35, monthlyIncome: 7142.85,
        cards: [{ id: 'c1', name: 'Nubank', brand: 'Master', lastFourDigits: '4321', creditLimit: 5000, currentBalance: 1500, utilizationRate: 30, color: '#8b5cf6', dueDay: 10 }],
        installments: [{ id: 'i1', description: 'Notebook', totalAmount: 2000, paidAmount: 1000, remaining: 1000, installmentCount: 10, paidInstallments: 5, monthlyValue: 200, interestRate: 0, type: 'CARD_INSTALLMENT', status: 'ACTIVE', cardName: 'Nubank', nextPaymentDate: null }],
        consortiums: [],
      }}
    />,
  );
  expect(debtExpandedHtml).toContain('Nubank');
  expect(debtExpandedHtml).toContain('****4321');
  expect(debtExpandedHtml).toContain('Uso do limite do cartão Nubank');
  expect(debtExpandedHtml).toContain('35.0%');

  const CalendarView = calendar.FinancialCalendarContent;
  const calendarHtml = renderToStaticMarkup(
    <CalendarView
      loading={false}
      activeDays={30}
      selectedDate="2026-11-19"
      currentMonth={new Date('2026-11-15T12:00:00Z')}
      onSelectDays={() => {}}
      onSelectDate={() => {}}
      setCurrentMonth={() => {}}
      onToday={() => {}}
      fetchData={() => {}}
      data={{
        days: [
          {
            date: '2026-11-19',
            dayOfWeek: 'qui',
            income: 500,
            expense: 120,
            events: [
              { id: 'ev-1', type: 'transaction', description: 'Freela', amount: 500, category: 'Renda', isRecurring: false },
              { id: 'ev-2', type: 'purchase', description: 'Mercado', amount: -120, category: 'Casa', isRecurring: false },
            ],
          },
        ],
        summary: {
          totalUpcoming: 380,
          totalBills: 2,
          totalIncome: 500,
          totalExpense: 120,
          upcomingBiggestExpense: { description: 'Mercado', amount: 120, date: '2026-11-19' },
          nextPaymentDate: '2026-11-19',
        },
      }}
    />,
  );
  expect(calendarHtml).toContain('Resumo do intervalo');
  expect(calendarHtml).toContain('Freela');
  expect(calendarHtml).toContain('Mercado');
  expect(calendarHtml).toContain('+R$ 500,00');
  expect(calendarHtml).toContain('−R$ 120,00');
  expect(calendarHtml).toContain('19 nov');

  const calendarEmptyDayHtml = renderToStaticMarkup(
    <CalendarView
      loading={false}
      activeDays={30}
      selectedDate="2026-11-20"
      currentMonth={new Date('2026-11-15T12:00:00Z')}
      onSelectDays={() => {}}
      onSelectDate={() => {}}
      setCurrentMonth={() => {}}
      onToday={() => {}}
      fetchData={() => {}}
      data={{
        days: [],
        summary: {
          totalUpcoming: 0, totalBills: 0, totalIncome: 0, totalExpense: 0,
          upcomingBiggestExpense: null, nextPaymentDate: null,
        },
      }}
    />,
  );
  expect(calendarEmptyDayHtml).toContain('Nenhum evento neste dia');
  expect(calendarEmptyDayHtml).toContain('R$ 0,00');

  const AnalyticsView = analytics.TransactionAnalyticsContent;
  const patternsHtml = renderToStaticMarkup(
    <AnalyticsView
      loading={false}
      typeFilter="ALL"
      onTypeFilterChange={() => {}}
      activeTab="patterns"
      onTabChange={() => {}}
      onRetry={() => {}}
      data={{
        overview: {
          totalTransactions: 0, totalIncome: 0, totalExpense: 0, averagePerTransaction: 0,
          highestTransaction: null, lowestTransaction: null, mostFrequentCategory: null, weekdayBreakdown: [],
        },
        monthlyComparison: [{ month: 'jan', income: 1000, expense: 400, net: 600, count: 3, avgPerTx: 466.67 }],
        topMerchants: [{ name: 'Padaria', count: 4, total: 120, category: 'Alimentação' }],
        amountDistribution: [{ range: '0-100', count: 2, percentage: 100 }],
        dailyPattern: [{ hour: '10h', count: 2 }],
      }}
    />,
  );
  expect(patternsHtml).toContain('Padaria');
  expect(patternsHtml).toContain('Comparação Mensal');
  expect(patternsHtml).toContain('R$ 600,00');

  // Behavioral check: month navigation buttons in FinancialCalendarContent trigger setCurrentMonth
  let monthState = new Date('2026-11-15T12:00:00Z');
  const harness = runWithReactHarness(() => CalendarView({
    loading: false,
    activeDays: 30,
    selectedDate: null,
    currentMonth: monthState,
    onSelectDays: () => {},
    onSelectDate: () => {},
    setCurrentMonth: (updater: any) => { monthState = typeof updater === 'function' ? updater(monthState) : updater; },
    onToday: () => {},
    fetchData: () => {},
    data: {
      days: [],
      summary: { totalUpcoming: 0, totalBills: 0, totalIncome: 0, totalExpense: 0, upcomingBiggestExpense: null, nextPaymentDate: null },
    },
  }));
  const findByAriaLabel = (node: unknown, label: string): { props: Record<string, any> } | undefined => {
    if (!node || typeof node !== 'object') return undefined;
    const el = node as { type?: unknown; props?: Record<string, any> };
    if (el.props?.['aria-label'] === label && typeof el.props?.onClick === 'function') return el as { props: Record<string, any> };
    if (typeof el.type === 'function') {
      const rendered = withPtIntlDispatcher(() => (el.type as (p: Record<string, any>) => unknown)(el.props ?? {}));
      const hit = findByAriaLabel(rendered, label);
      if (hit) return hit;
    }
    for (const child of React.Children.toArray(el.props?.children)) {
      const hit = findByAriaLabel(child, label);
      if (hit) return hit;
    }
    return undefined;
  };
  try {
    const tree = harness.renderTree();
    findByAriaLabel(tree, 'Mês anterior')!.props.onClick();
    expect(monthState.getMonth()).toBe(9);
    findByAriaLabel(tree, 'Próximo mês')!.props.onClick();
    expect(monthState.getMonth()).toBe(10);
  } finally {
    harness.cleanupAll();
  }
});

test('Task 1.1: request*/current* em networth, financial-calendar, transaction-analytics e spending-timeline descartam abortados e limpam dado em erro', async () => {
  const nwReqA = { months: 6 };
  const nwReqB = { months: 12 };
  const nwReqASame = { months: 6 };
  const nwCtrlA = new AbortController();
  const nwPublished: Array<Record<string, any>> = [];

  expect((networth as Record<string, any>).currentNetworthEvolution(nwReqA, null)).toEqual({ status: 'loading' });
  nwCtrlA.abort();
  await (networth as Record<string, any>).requestNetworthEvolution(
    nwReqA,
    nwCtrlA.signal,
    (res: Record<string, any>) => nwPublished.push(res),
    async () => Response.json({ monthlyData: [{ month: 'jan', netWorth: 999, assets: 999, liabilities: 0, changePercent: 0, changeAmount: 0 }] }),
  );
  await (networth as Record<string, any>).requestNetworthEvolution(
    nwReqA,
    nwCtrlA.signal,
    (res: Record<string, any>) => nwPublished.push(res),
    async () => {
      throw new Error('late network error');
    },
  );
  expect(nwPublished).toEqual([]);

  const nwCtrlB = new AbortController();
  await (networth as Record<string, any>).requestNetworthEvolution(
    nwReqB,
    nwCtrlB.signal,
    (res: Record<string, any>) => nwPublished.push(res),
    async () => new Response(null, { status: 503 }),
  );
  expect(nwPublished).toHaveLength(1);
  expect((networth as Record<string, any>).currentNetworthEvolution(nwReqB, nwPublished[0])).toEqual({ status: 'error' });
  expect((networth as Record<string, any>).currentNetworthEvolution(nwReqASame, nwPublished[0])).toEqual({ status: 'loading' });

  const calReqA = { days: 30 };
  const calReqB = { days: 7 };
  const calCtrlA = new AbortController();
  const calPublished: Array<Record<string, any>> = [];
  calCtrlA.abort();
  await (calendar as Record<string, any>).requestFinancialCalendar(
    calReqA,
    calCtrlA.signal,
    (res: Record<string, any>) => calPublished.push(res),
    async () => new Response(null, { status: 503 }),
  );
  expect(calPublished).toEqual([]);
  expect((calendar as Record<string, any>).currentFinancialCalendar(calReqB, {
    request: calReqA,
    result: { status: 'ready', data: { days: [], summary: { totalUpcoming: 0, totalBills: 0, totalIncome: 0, totalExpense: 0, upcomingBiggestExpense: null, nextPaymentDate: null } } },
  })).toEqual({ status: 'loading' });

  const taReqA = { typeFilter: 'ALL' as const };
  const taReqB = { typeFilter: 'EXPENSE' as const };
  const taCtrlA = new AbortController();
  const taPublished: Array<Record<string, any>> = [];
  taCtrlA.abort();
  await (analytics as Record<string, any>).requestTransactionAnalytics(
    taReqA,
    taCtrlA.signal,
    (res: Record<string, any>) => taPublished.push(res),
    async () => Response.json({ overview: {}, monthlyComparison: [], topMerchants: [], amountDistribution: [], dailyPattern: [] }),
  );
  expect(taPublished).toEqual([]);
  expect((analytics as Record<string, any>).currentTransactionAnalytics(taReqB, {
    request: taReqA,
    result: { status: 'error' },
  })).toEqual({ status: 'loading' });

  const stReqA = { days: 30 };
  const stReqB = { days: 15 };
  const stCtrlA = new AbortController();
  const stPublished: Array<Record<string, any>> = [];
  stCtrlA.abort();
  await (timeline as Record<string, any>).requestSpendingTimeline(
    stReqA,
    stCtrlA.signal,
    (res: Record<string, any>) => stPublished.push(res),
    async () => {
      throw new Error('aborted');
    },
  );
  expect(stPublished).toEqual([]);
  expect((timeline as Record<string, any>).currentSpendingTimeline(stReqB, {
    request: stReqA,
    result: { status: 'ready', data: [] },
  })).toEqual({ status: 'loading' });
});

test('Task 1.1: NetworthEvolution, FinancialCalendar, TransactionAnalytics e SpendingTimeline descartam respostas tardias e limpam dado antigo em falha subsequente', async () => {
  const originalFetch = globalThis.fetch;

  // 1. NetworthEvolution: A (6m) pendente -> B (12m) resolve -> A (6m) resolve atrasada (503) -> B falha no refresh -> limpa dado e recupera
  {
    const req6 = Promise.withResolvers<Response>();
    const req12First = Promise.withResolvers<Response>();
    const req12Fail = Promise.withResolvers<Response>();
    const req12Retry = Promise.withResolvers<Response>();
    const signals: Array<AbortSignal | null | undefined> = [];
    const queue = new Map<string, Array<Promise<Response>>>([
      ['/api/networth?months=6', [req6.promise]],
      ['/api/networth?months=12', [req12First.promise, req12Fail.promise, req12Retry.promise]],
    ]);
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      signals.push(init?.signal);
      return queue.get(url)!.shift()!;
    }) as typeof fetch;

    const makeNw = (value: number) => Response.json({
      monthlyData: [{ month: 'fev', netWorth: value, assets: value + 1000, liabilities: 1000, changePercent: 10, changeAmount: 500 }],
    });

    const harness = runWithReactHarness(() => networth.NetworthEvolution());
    try {
      let tree = harness.renderTree();
      tree.props.onSelectMonths(12);
      tree = harness.renderTree();
      expect(signals[0]?.aborted).toBe(true);
      expect(signals[1]?.aborted).toBe(false);

      req12First.resolve(makeNw(42000));
      await settle();
      expect(renderToStaticMarkup(harness.renderTree())).toContain('R$ 42.000,00');

      req6.resolve(new Response(null, { status: 503 }));
      await settle();
      const afterLate = renderToStaticMarkup(harness.renderTree());
      expect(afterLate).toContain('R$ 42.000,00');
      expect(afterLate).not.toContain('Não foi possível carregar a evolução patrimonial.');

      // Nova tentativa falha com 503 -> deve limpar R$ 42.000,00 e exibir erro
      harness.renderTree().props.fetchData(12);
      harness.renderTree();
      req12Fail.resolve(new Response(null, { status: 503 }));
      await settle();
      const failedHtml = renderToStaticMarkup(harness.renderTree());
      expect(failedHtml).toContain('Não foi possível carregar a evolução patrimonial.');
      expect(failedHtml).not.toContain('R$ 42.000,00');

      harness.renderTree().props.onRetry();
      harness.renderTree();
      req12Retry.resolve(makeNw(55000));
      await settle();
      expect(renderToStaticMarkup(harness.renderTree())).toContain('R$ 55.000,00');
    } finally {
      harness.cleanupAll();
      globalThis.fetch = originalFetch;
    }
  }

  // 2. FinancialCalendar: A (30d) pendente -> B (7d) resolve -> A (30d) resolve atrasada (200 OK) -> B falha -> limpa dado antigo e recupera
  {
    const req30 = Promise.withResolvers<Response>();
    const req7First = Promise.withResolvers<Response>();
    const req7Fail = Promise.withResolvers<Response>();
    const req7Retry = Promise.withResolvers<Response>();
    const signals: Array<AbortSignal | null | undefined> = [];
    const queue = new Map<string, Array<Promise<Response>>>([
      ['/api/financial-calendar?days=30', [req30.promise]],
      ['/api/financial-calendar?days=7', [req7First.promise, req7Fail.promise, req7Retry.promise]],
    ]);
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      signals.push(init?.signal);
      return queue.get(url)!.shift()!;
    }) as typeof fetch;

    const makeCal = (expense: number) => Response.json({
      days: [],
      summary: {
        totalUpcoming: expense,
        totalBills: 1,
        totalIncome: 0,
        totalExpense: expense,
        upcomingBiggestExpense: null,
        nextPaymentDate: null,
      },
    });

    const harness = runWithReactHarness(() => calendar.FinancialCalendar());
    try {
      let tree = harness.renderTree();
      tree.props.onSelectDays(7);
      tree = harness.renderTree();
      expect(signals[0]?.aborted).toBe(true);

      req7First.resolve(makeCal(777));
      await settle();
      expect(renderToStaticMarkup(harness.renderTree())).toContain('R$ 777,00');

      req30.resolve(makeCal(999));
      await settle();
      const afterLate = renderToStaticMarkup(harness.renderTree());
      expect(afterLate).toContain('R$ 777,00');
      expect(afterLate).not.toContain('R$ 999,00');

      harness.renderTree().props.fetchData(7);
      harness.renderTree();
      req7Fail.reject(new Error('offline'));
      await settle();
      const failedHtml = renderToStaticMarkup(harness.renderTree());
      expect(failedHtml).toContain('Não foi possível carregar o calendário financeiro.');
      expect(failedHtml).not.toContain('R$ 777,00');

      harness.renderTree().props.fetchData(7);
      harness.renderTree();
      req7Retry.resolve(makeCal(888));
      await settle();
      expect(renderToStaticMarkup(harness.renderTree())).toContain('R$ 888,00');
    } finally {
      harness.cleanupAll();
      globalThis.fetch = originalFetch;
    }
  }

  // 3. TransactionAnalytics: A (ALL) pendente -> B (EXPENSE) resolve -> A rejeita atrasada -> B falha -> limpa dado antigo e recupera
  {
    const reqAll = Promise.withResolvers<Response>();
    const reqExpFirst = Promise.withResolvers<Response>();
    const reqExpFail = Promise.withResolvers<Response>();
    const reqExpRetry = Promise.withResolvers<Response>();
    const signals: Array<AbortSignal | null | undefined> = [];
    const queue = new Map<string, Array<Promise<Response>>>([
      ['/api/transaction-analytics?months=6', [reqAll.promise]],
      ['/api/transaction-analytics?months=6&type=EXPENSE', [reqExpFirst.promise, reqExpFail.promise, reqExpRetry.promise]],
    ]);
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      signals.push(init?.signal);
      return queue.get(url)!.shift()!;
    }) as typeof fetch;

    const makeAnalytics = (totalExpense: number) => Response.json({
      overview: {
        totalTransactions: 1,
        totalIncome: 0,
        totalExpense,
        averagePerTransaction: totalExpense,
        highestTransaction: null,
        lowestTransaction: null,
        mostFrequentCategory: null,
        weekdayBreakdown: [],
      },
      monthlyComparison: [],
      topMerchants: [],
      amountDistribution: [],
      dailyPattern: [],
    });

    const harness = runWithReactHarness(() => analytics.TransactionAnalytics());
    try {
      let tree = harness.renderTree();
      tree.props.onTypeFilterChange('EXPENSE');
      tree = harness.renderTree();
      expect(signals[0]?.aborted).toBe(true);

      reqExpFirst.resolve(makeAnalytics(321));
      await settle();
      expect(renderToStaticMarkup(harness.renderTree())).toContain('R$ 321,00');

      reqAll.reject(new Error('late reject'));
      await settle();
      const afterLate = renderToStaticMarkup(harness.renderTree());
      expect(afterLate).toContain('R$ 321,00');
      expect(afterLate).not.toContain('Não foi possível carregar a análise de transações.');

      harness.renderTree().props.fetchData();
      harness.renderTree();
      reqExpFail.resolve(new Response(null, { status: 503 }));
      await settle();
      const failedHtml = renderToStaticMarkup(harness.renderTree());
      expect(failedHtml).toContain('Não foi possível carregar a análise de transações.');
      expect(failedHtml).not.toContain('R$ 321,00');

      harness.renderTree().props.onRetry();
      harness.renderTree();
      reqExpRetry.resolve(makeAnalytics(654));
      await settle();
      expect(renderToStaticMarkup(harness.renderTree())).toContain('R$ 654,00');
    } finally {
      harness.cleanupAll();
      globalThis.fetch = originalFetch;
    }
  }

  // 4. SpendingTimeline: A (30d) pendente -> B (7d) resolve -> A (30d) falha atrasada -> B falha -> limpa dado antigo e recupera
  {
    const req30 = Promise.withResolvers<Response>();
    const req7First = Promise.withResolvers<Response>();
    const req7Fail = Promise.withResolvers<Response>();
    const req7Retry = Promise.withResolvers<Response>();
    const signals: Array<AbortSignal | null | undefined> = [];
    const queue = new Map<string, Array<Promise<Response>>>([
      ['/api/timeline?days=30', [req30.promise]],
      ['/api/timeline?days=7', [req7First.promise, req7Fail.promise, req7Retry.promise]],
    ]);
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      signals.push(init?.signal);
      return queue.get(url)!.shift()!;
    }) as typeof fetch;

    const makeTimeline = (income: number) => Response.json([
      { date: '2026-11-19', dayLabel: '19 nov', income, expense: 100, net: income - 100, runningBalance: income - 100, count: 1, items: [] },
    ]);

    const harness = runWithReactHarness(() => timeline.SpendingTimeline());
    try {
      let tree = harness.renderTree();
      tree.props.onSelectDays(7);
      tree = harness.renderTree();
      expect(signals[0]?.aborted).toBe(true);

      req7First.resolve(makeTimeline(1200));
      await settle();
      expect(renderToStaticMarkup(harness.renderTree())).toContain('R$ 1.200,00');

      req30.resolve(new Response(null, { status: 503 }));
      await settle();
      const afterLate = renderToStaticMarkup(harness.renderTree());
      expect(afterLate).toContain('R$ 1.200,00');
      expect(afterLate).not.toContain('Não foi possível carregar a linha do tempo.');

      harness.renderTree().props.onRetry();
      harness.renderTree();
      req7Fail.resolve(new Response(null, { status: 503 }));
      await settle();
      const failedHtml = renderToStaticMarkup(harness.renderTree());
      expect(failedHtml).toContain('Não foi possível carregar a linha do tempo.');
      expect(failedHtml).not.toContain('R$ 1.200,00');

      harness.renderTree().props.onRetry();
      harness.renderTree();
      req7Retry.resolve(makeTimeline(2400));
      await settle();
      expect(renderToStaticMarkup(harness.renderTree())).toContain('R$ 2.400,00');
    } finally {
      harness.cleanupAll();
      globalThis.fetch = originalFetch;
    }
  }
});

test('Task 1.4: DebtOverview e FinancialReportsWidget limpam dado antigo em falha subsequente e recuperam no retry', async () => {
  const originalFetch = globalThis.fetch;

  // 1. DebtOverview: 200 OK -> refresh 503 limpa R$ 1.500,00 e exibe role="alert" -> retry 200 OK recupera
  {
    const req1 = Promise.withResolvers<Response>();
    const req2Fail = Promise.withResolvers<Response>();
    const req3Retry = Promise.withResolvers<Response>();
    const queue = [req1.promise, req2Fail.promise, req3Retry.promise];
    const signals: Array<AbortSignal | null | undefined> = [];
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      signals.push(init?.signal);
      return queue.shift()!;
    }) as typeof fetch;

    const makeDebts = (totalDebt: number) => Response.json({
      totalDebt,
      cardDebt: totalDebt,
      installmentDebt: 0,
      consortiumDebt: 0,
      debtToIncomeRatio: 20,
      monthlyIncome: 7500,
      cards: [],
      installments: [],
      consortiums: [],
    });

    const harness = runWithReactHarness(() => debt.DebtOverview());
    try {
      harness.renderTree();
      req1.resolve(makeDebts(1500));
      await settle();
      expect(renderToStaticMarkup(harness.renderTree())).toContain('R$ 1.500,00');

      // Refresh falha com 503 -> deve limpar R$ 1.500,00 e exibir erro
      harness.renderTree().props.fetchData();
      harness.renderTree();
      req2Fail.resolve(new Response(null, { status: 503 }));
      await settle();
      const failedTree = harness.renderTree();
      expect(failedTree.props.data).toBeNull();
      const failedHtml = renderToStaticMarkup(failedTree);
      expect(failedHtml).toContain('role="alert"');
      expect(failedHtml).toContain('Não foi possível carregar o painel de dívidas.');
      expect(failedHtml).toContain('Tentar novamente');
      expect(failedHtml).not.toContain('R$ 1.500,00');

      failedTree.props.onRetry();
      harness.renderTree();
      req3Retry.resolve(makeDebts(2200));
      await settle();
      expect(renderToStaticMarkup(harness.renderTree())).toContain('R$ 2.200,00');
      expect(signals.every((s) => s instanceof AbortSignal)).toBe(true);
    } finally {
      harness.cleanupAll();
      globalThis.fetch = originalFetch;
    }
  }

  // 2. FinancialReportsWidget: 200 OK -> refresh rejeita -> limpa dado antigo e exibe role="alert" -> retry recupera
  {
    const req1 = Promise.withResolvers<Response>();
    const req2Reject = Promise.withResolvers<Response>();
    const req3Retry = Promise.withResolvers<Response>();
    const queue = [req1.promise, req2Reject.promise, req3Retry.promise];
    const signals: Array<AbortSignal | null | undefined> = [];
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      signals.push(init?.signal);
      return queue.shift()!;
    }) as typeof fetch;

    const makeReports = (expense: number) => Response.json({
      monthlyData: [{ month: 'jan', income: 2000, expense, net: 2000 - expense, transactionCount: 2, purchaseCount: 0, avgDailySpend: 10, savingsRate: 50 }],
      topExpenseCategory: null,
      topCategories: [],
      avgDailySpend: 10,
      highestExpense: null,
      lowestIncome: null,
      savingsRateTrend: [{ month: 'jan', rate: 50 }],
      ticketMedio: 100,
    });

    const harness = runWithReactHarness(() => reports.FinancialReportsWidget());
    try {
      harness.renderTree();
      req1.resolve(makeReports(450));
      await settle();
      expect(renderToStaticMarkup(harness.renderTree())).toContain('R$ 450,00');

      harness.renderTree().props.fetchReports();
      harness.renderTree();
      req2Reject.reject(new Error('network error'));
      await settle();
      const failedTree = harness.renderTree();
      expect(failedTree.props.data).toBeNull();
      const failedHtml = renderToStaticMarkup(failedTree);
      expect(failedHtml).toContain('role="alert"');
      expect(failedHtml).toContain('Não foi possível carregar os relatórios financeiros.');
      expect(failedHtml).toContain('Tentar novamente');
      expect(failedHtml).not.toContain('R$ 450,00');

      failedTree.props.onRetry();
      harness.renderTree();
      req3Retry.resolve(makeReports(780));
      await settle();
      expect(renderToStaticMarkup(harness.renderTree())).toContain('R$ 780,00');
      expect(signals.every((s) => s instanceof AbortSignal)).toBe(true);
    } finally {
      harness.cleanupAll();
      globalThis.fetch = originalFetch;
    }
  }
});

test('renderiza relatórios, análises, patrimônio, dívidas e calendário em pt, es e en sem vazar chaves', () => {
  const ReportView = (reports as Record<string, any>).FinancialReportsContent;
  const AnalyticsView = (analytics as Record<string, any>).TransactionAnalyticsContent;
  const NetworthView = (networth as Record<string, any>).NetworthEvolutionContent;
  const DebtView = (debt as Record<string, any>).DebtOverviewContent;
  const CalendarView = (calendar as Record<string, any>).FinancialCalendarContent;
  const expected = {
    pt: { retry: 'Tentar novamente', calendarTitle: 'Carregando calendário financeiro' },
    es: { retry: 'Intentar de nuevo', calendarTitle: 'Cargando calendario financiero' },
    en: { retry: 'Try again', calendarTitle: 'Loading financial calendar' },
  } as const;

  for (const locale of CANONICAL_LOCALES) {
    for (const errHtml of [
      renderWithIntl(<ReportView data={null} loading={false} activeTab="monthly" onTabChange={() => {}} onRetry={() => {}} />, locale),
      renderWithIntl(<AnalyticsView data={null} loading={false} typeFilter="ALL" onTypeFilterChange={() => {}} activeTab="overview" onTabChange={() => {}} onRetry={() => {}} />, locale),
      renderWithIntl(<NetworthView data={null} loading={false} selectedMonths={6} onSelectMonths={() => {}} onRetry={() => {}} />, locale),
      renderWithIntl(<DebtView data={null} loading={false} onRetry={() => {}} />, locale),
    ]) {
      expect(errHtml).toContain(expected[locale].retry);
      expect(errHtml).not.toContain('MISSING_MESSAGE');
    }
    const calHtml = renderWithIntl(<CalendarView loading onRetry={() => {}} />, locale);
    expect(calHtml).toContain(expected[locale].calendarTitle);
  }
});

function findYAxisList(node: unknown): Array<{ props: Record<string, any> }> {
  if (!node || typeof node !== 'object') return [];
  const el = node as { type?: unknown; props?: Record<string, any> };
  const own = el.type === YAxis ? [el as { props: Record<string, any> }] : [];
  const nested = React.Children.toArray(el.props?.children).flatMap(findYAxisList);
  return [...own, ...nested];
}

test('TransactionAnalytics e TransactionAnalysisTabs aplicam min-w-0 e sub-widgets ocultam valores e YAxis com showValues=false', () => {
  const taSrc = source('transaction-analytics');
  const taTabsSrc = source('transaction-analysis-tabs');
  expect(taSrc).toMatch(/<Tabs[^>]*className="min-w-0"/);
  expect(taTabsSrc).toContain('<TabsContent value="overview" className="mt-0 min-w-0 space-y-4">');
  expect(taTabsSrc).toContain('<TabsContent value="distribution" className="mt-0 min-w-0 space-y-5">');
  expect(taTabsSrc).toContain('<TabsContent value="patterns" className="mt-0 min-w-0 space-y-5">');
  expect(taTabsSrc).toContain('min-w-0 rounded-lg border border-border overflow-hidden');

  const ReportView = reports.FinancialReportsContent;
  const reportHtml = renderToStaticMarkup(
    <ReportView
      loading={false}
      activeTab="monthly"
      onTabChange={() => {}}
      onRetry={() => {}}
      showValues={false}
      data={{
        monthlyData: [
          { month: 'jan', income: 1000, expense: 400, net: 600, transactionCount: 2, purchaseCount: 1, avgDailySpend: 20, savingsRate: 60 },
          { month: 'fev', income: 1200, expense: 500, net: 700, transactionCount: 3, purchaseCount: 2, avgDailySpend: 25, savingsRate: 58.3 },
        ],
        topExpenseCategory: { name: 'Mercado', color: '#888', total: 400, count: 3 },
        topCategories: [{ name: 'Mercado', color: '#888', total: 400, count: 3 }],
        avgDailySpend: 20,
        highestExpense: { id: 'e1', description: 'Compra', amount: 400, date: '2026-01-01' },
        lowestIncome: { id: 'i1', description: 'Salário', amount: 1000, date: '2026-01-01' },
        savingsRateTrend: [{ month: 'jan', rate: 60 }],
        ticketMedio: 133.33,
      }}
    />,
  );
  expect(reportHtml).toContain('R$ ••••••');
  expect(reportHtml).toContain('•••');
  expect(reportHtml).not.toMatch(/1\.000|1\.200|400|600|700/);

  const AnalyticsView = analytics.TransactionAnalyticsContent;
  for (const tab of ['overview', 'distribution', 'patterns'] as const) {
    const html = renderToStaticMarkup(
      <AnalyticsView
        loading={false}
        typeFilter="ALL"
        onTypeFilterChange={() => {}}
        activeTab={tab}
        onTabChange={() => {}}
        onRetry={() => {}}
        showValues={false}
        data={{
          overview: {
            totalTransactions: 9, totalIncome: 5000, totalExpense: 2000, averagePerTransaction: 777,
            highestTransaction: { description: 'Aluguel', amount: 1500, date: '2026-01-01', categoryName: 'Casa', type: 'EXPENSE' },
            lowestTransaction: { description: 'Café', amount: 15, date: '2026-01-02', categoryName: 'Lazer', type: 'EXPENSE' },
            mostFrequentCategory: { categoryName: 'Casa', categoryColor: '#888', count: 4, total: 1500 },
            weekdayBreakdown: [{ day: 'Seg', income: 500, expense: 200, count: 2 }],
          },
          monthlyComparison: [{ month: 'jan', income: 1000, expense: 400, net: 600, count: 3, avgPerTx: 466.67 }],
          topMerchants: [{ name: 'Padaria', count: 4, total: 120, category: 'Alimentação' }],
          amountDistribution: [{ range: '0-100', count: 2, percentage: 100 }],
          dailyPattern: [{ hour: '10h', count: 7 }],
        }}
      />,
    );
    expect(html).not.toMatch(/5\.000|2\.000|1\.500|777|466|120/);
  }

  const NetworthView = networth.NetworthEvolutionContent;
  const nwProps = {
    loading: false,
    selectedMonths: 6,
    onSelectMonths: () => {},
    fetchData: () => {},
    onRetry: () => {},
    showValues: false,
    data: {
      monthlyData: [
        { month: 'jan', netWorth: 20000, assets: 25000, liabilities: 5000, changePercent: 5, changeAmount: 1000 },
        { month: 'fev', netWorth: 25000, assets: 30000, liabilities: 5000, changePercent: 25, changeAmount: 5000 },
      ],
    },
  };
  const nwTree = withPtIntlDispatcher(() => NetworthView(nwProps));
  expect(findElementByType(nwTree, RechartsTooltip)?.props.content?.props.showValues).toBe(false);
  for (const y of findYAxisList(nwTree)) expect(y.props.tickFormatter(25000)).toBe('•••');
  const nwHtml = renderToStaticMarkup(<NetworthView {...nwProps} />);
  expect(nwHtml).toContain('aria-valuetext="•••"');
  expect(nwHtml).not.toMatch(/25\.000|30\.000|5\.000|25\.0%/);

  const DebtView = debt.DebtOverviewContent;
  const debtHtml = renderToStaticMarkup(
    <DebtView
      loading={false}
      expandedType="cards"
      onToggleExpand={() => {}}
      onRetry={() => {}}
      showValues={false}
      data={{
        totalDebt: 2500, cardDebt: 1500, installmentDebt: 1000, consortiumDebt: 0,
        debtToIncomeRatio: 35, monthlyIncome: 7142.85,
        cards: [{ id: 'c1', name: 'Nubank', brand: 'Master', lastFourDigits: '4321', creditLimit: 5000, currentBalance: 1500, utilizationRate: 30, color: '#8b5cf6', dueDay: 10 }],
        installments: [],
        consortiums: [],
      }}
    />,
  );
  expect(debtHtml).toContain('R$ ••••••');
  expect(debtHtml).toContain('•••');
  expect(debtHtml.replace(/<[^>]+>/g, ' ')).not.toMatch(/2\.500|1\.500|1\.000|5\.000|35\.0%|30% usado/);

  const CalendarView = calendar.FinancialCalendarContent;
  const calHtml = renderToStaticMarkup(
    <CalendarView
      loading={false}
      activeDays={30}
      selectedDate="2026-11-19"
      currentMonth={new Date('2026-11-15T12:00:00Z')}
      onSelectDays={() => {}}
      onSelectDate={() => {}}
      setCurrentMonth={() => {}}
      onToday={() => {}}
      fetchData={() => {}}
      showValues={false}
      data={{
        days: [{
          date: '2026-11-19', dayOfWeek: 'qui', income: 500, expense: 120,
          events: [{ id: 'ev-1', type: 'transaction', description: 'Freela', amount: 500, category: 'Renda', isRecurring: false }],
        }],
        summary: {
          totalUpcoming: 380, totalBills: 2, totalIncome: 500, totalExpense: 120,
          upcomingBiggestExpense: { description: 'Mercado', amount: 120, date: '2026-11-19' }, nextPaymentDate: '2026-11-19',
        },
      }}
    />,
  );
  expect(calHtml).toContain('R$ ••••••');
  expect(calHtml).not.toMatch(/380|500|120/);
});

test('widgets de análise refazem fetch ao trocar locale mantendo URLs /api/... exatas', async () => {
  const originalFetch = globalThis.fetch;
  const requested: string[] = [];
  let activeLocale: CanonicalLocale = 'pt';
  globalThis.fetch = (async (url: string) => {
    requested.push(String(url));
    return Response.json({
      totalDebt: 0, cardDebt: 0, installmentDebt: 0, consortiumDebt: 0,
      debtToIncomeRatio: 0, monthlyIncome: 0, cards: [], installments: [], consortiums: [],
    });
  }) as typeof fetch;

  const harness = runWithReactHarness(() => debt.DebtOverview(), () => activeLocale);
  try {
    harness.renderTree();
    await settle();
    expect(requested).toEqual(['/api/debts']);

    activeLocale = 'en';
    harness.renderTree();
    await settle();
    expect(requested).toEqual(['/api/debts', '/api/debts']);
    expect(requested.every((url) => !url.includes('locale='))).toBe(true);
  } finally {
    harness.cleanupAll();
    globalThis.fetch = originalFetch;
  }
});
