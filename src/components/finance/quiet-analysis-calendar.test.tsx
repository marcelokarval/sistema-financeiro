/// <reference types="bun-types" />
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Presentation and wiring contracts; browser interaction is verified separately.
const widgets = [
  ['financial-calendar', 'Calendário Financeiro', 'Resumo do intervalo', 'financial-calendar'],
  ['networth-evolution', 'Evolução Patrimonial', 'Indicadores patrimoniais', 'networth-evolution'],
  ['debt-overview', 'Visão de Dívidas', 'Composição das dívidas', 'debt-overview'],
  ['transaction-analytics', 'Análise de Transações', 'Indicadores de transações', 'transaction-analysis-tabs'],
  ['financial-reports', 'Relatórios Financeiros', 'Indicadores do relatório', 'financial-report-tabs'],
] as const;

function source(name: string) {
  return readFileSync(new URL(`./${name}.tsx`, import.meta.url), 'utf8');
}

for (const [name, title, group, groupFile] of widgets) {
  test(`${title}: painel nomeado e grupo de dados sem ornamentação`, () => {
    const jsx = source(name);
    expect(jsx).toMatch(/<section aria-labelledby="[^"]+"/);
    expect(source(groupFile)).toContain(`aria-label="${group}"`);
    expect(jsx).not.toMatch(/bg-gradient|card-glow|<motion\./);
    expect(source(groupFile)).not.toMatch(/bg-gradient|card-glow|<motion\./);
    expect(source(groupFile)).toMatch(/import \{ currencyFmt(?:, [^}]+)? \} from '@\/lib\/helpers';/);
  });
}

function hasControl(name: string, label: string, callback: string, attribute = 'onClick') {
  const file = ts.createSourceFile(name + '.tsx', source(name), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found = false;
  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const attrs = new Map(node.attributes.properties.flatMap((p) => ts.isJsxAttribute(p)
        ? [[p.name.getText(file), p.initializer?.getText(file)]] as const : []));
      if (attrs.get('aria-label') === JSON.stringify(label) && attrs.get(attribute) === callback) found = true;
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return found;
}

test('ações iconográficas mantêm seus callbacks e têm nome acessível', () => {
  expect(hasControl('financial-calendar', 'Atualizar calendário', '{() => fetchData(activeDays)}')).toBe(true);
  expect(hasControl('financial-calendar-grid', 'Mês anterior', '{() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}')).toBe(true);
  expect(hasControl('financial-calendar-grid', 'Próximo mês', '{() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}')).toBe(true);
  expect(hasControl('networth-evolution', 'Atualizar patrimônio', '{() => fetchData(selectedMonths)}')).toBe(true);
  expect(hasControl('debt-overview', 'Atualizar dívidas', '{fetchData}')).toBe(true);
  expect(hasControl('transaction-analytics', 'Atualizar análise', '{fetchData}')).toBe(true);
  expect(hasControl('financial-reports', 'Atualizar relatórios', '{fetchReports}')).toBe(true);
});

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
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
import { Tooltip as RechartsTooltip } from 'recharts';
import * as balanceProj from './balance-projection';
import * as cashFlow from './cash-flow-forecast';
import * as expenseBk from './expense-breakdown';
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
    const rendered = (el.type as (props: Record<string, any>) => unknown)(el.props ?? {});
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

function runWithReactHarness(renderComponent: () => React.ReactElement) {
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
      return tree;
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
    QueryPanel({
      titleId: 'qp-test',
      title: 'Painel sintético',
      status: 'error',
      errorMessage: 'Falha na consulta.',
      onRetry: () => { retried++; },
      children: null,
    }),
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

test('caracterização eb76f7d (divergência aberta, não conformidade Quiet): balance-projection sem guarda em selectedMonths permite A atrasada sobrescrever B', async () => {
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

      req6.resolve(makeProjection(6, 9999));
      await settle();

      // Reproduz o comportamento observado em eb76f7d: A sobrescreve B mesmo com 3 meses selecionado
      const afterLateSuccess = renderToStaticMarkup(harness.renderTree());
      expect(afterLateSuccess).toContain('aria-pressed="true"');
      expect(afterLateSuccess).toContain('R$ 9.999,00');
      expect(afterLateSuccess).not.toContain('R$ 3.333,00');
    } finally {
      harness.cleanupAll();
      globalThis.fetch = originalFetch;
    }
  }

  // Caso 2: A (6 meses) pendente -> troca para B (3 meses) -> B resolve -> A resolve depois com falha
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

      // Reproduz o comportamento observado em eb76f7d: erro atrasado de A sobrescreve dados de B
      const afterLateFailure = renderToStaticMarkup(harness.renderTree());
      expect(afterLateFailure).toContain('Não foi possível carregar a projeção de saldos.');
      expect(afterLateFailure).not.toContain('R$ 3.333,00');
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
  const tree = NetworthView({
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
  });
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
      const rendered = (el.type as (p: Record<string, any>) => unknown)(el.props ?? {});
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
