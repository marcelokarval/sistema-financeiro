/// <reference types="bun-types" />

import { expect, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuickStatsOverview } from './quick-stats-overview';
import { SmartInsights } from './smart-insights';
import { CashFlowForecast } from './cash-flow-forecast';
import { SpendingTimeline } from './spending-timeline';
import { ExpenseBreakdown } from './expense-breakdown';
import * as expenses from './expense-breakdown';
import { BalanceProjection } from './balance-projection';
import { renderWithIntl } from '@/test-utils/intl';
import { CANONICAL_LOCALES, type CanonicalLocale } from '@/i18n/config';
import { getMessagesForLocale } from '@/i18n/messages';
import { AppIntlBridgeContext } from '@/i18n/provider';

function withPtIntlDispatcher<T>(fn: () => T, locale: CanonicalLocale = 'pt'): T {
  const internals = (React as unknown as {
    __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown };
  }).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const previous = internals.H;
  internals.H = {
    useContext: (ctx: React.Context<unknown>) =>
      ctx === AppIntlBridgeContext
        ? { locale, messages: getMessagesForLocale(locale) }
        : (ctx as unknown as { _currentValue?: unknown })._currentValue,
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

test.each([
  [QuickStatsOverview, 'Resumo rápido', 'Carregando indicadores'],
  [SmartInsights, 'Insights inteligentes', 'Carregando análises'],
  [CashFlowForecast, 'Previsão de fluxo de caixa', 'Carregando previsão'],
  [SpendingTimeline, 'Linha do tempo', 'Carregando movimentações'],
  [ExpenseBreakdown, 'Detalhamento de despesas', 'Carregando despesas por categoria'],
  [BalanceProjection, 'Projeção de saldos', 'Carregando projeção de saldos'],
] as const)('mantém o painel identificável durante o carregamento: %p', (Widget, heading, status) => {
  const html = renderToStaticMarkup(<Widget />);
  expect(html).toMatch(/<section[^>]*aria-labelledby="[^"]+"[^>]*>/);
  expect(html).toMatch(new RegExp(`<h3[^>]*>${heading}</h3>`));
  expect(html).toMatch(new RegExp(`<p[^>]*role="status"[^>]*>${status}`));
  expect(html).not.toMatch(/bg-gradient|card-glow|R\$/);
});

const sixMonths = { months: '6' } as const;
const currentMonth = { months: '1' } as const;

function expenseResponse(totalExpense: number) {
  return Response.json({ categories: [], totalExpense, topCategory: null, monthlyData: [] });
}

test('despesas não reaproveitam valores de seis meses após falha do mês e permitem recuperar o mês', async () => {
  let settled: expenses.ExpenseBreakdownResult | null = null;
  const calls: Array<{ url: string; method: string }> = [];
  const replies = [expenseResponse(621), new Response(null, { status: 503 }), expenseResponse(0)];
  const fetcher = async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? 'GET' });
    return replies.shift()!;
  };
  const publish = (result: expenses.ExpenseBreakdownResult) => { settled = result; };
  expect(typeof expenses.requestExpenseBreakdown).toBe('function');
  await expenses.requestExpenseBreakdown(sixMonths, new AbortController().signal, publish, fetcher);
  expect(expenses.currentExpenseBreakdown(sixMonths, settled)).toMatchObject({ status: 'ready', data: { totalExpense: 621 } });
  expect(expenses.currentExpenseBreakdown(currentMonth, settled)).toEqual({ status: 'loading' });
  await expenses.requestExpenseBreakdown(currentMonth, new AbortController().signal, publish, fetcher);
  expect(expenses.currentExpenseBreakdown(currentMonth, settled)).toEqual({ status: 'error' });
  const retry = { months: '1' } as const;
  expect(expenses.currentExpenseBreakdown(retry, settled)).toEqual({ status: 'loading' });
  await expenses.requestExpenseBreakdown(retry, new AbortController().signal, publish, fetcher);
  expect(expenses.currentExpenseBreakdown(retry, settled)).toMatchObject({ status: 'ready', data: { totalExpense: 0 } });
  expect(calls).toEqual([
    { url: '/api/expense-breakdown?months=6', method: 'GET' },
    { url: '/api/expense-breakdown?months=1', method: 'GET' },
    { url: '/api/expense-breakdown?months=1', method: 'GET' },
  ]);
});

test('despesas ignoram sucesso e erro atrasados, inclusive ao voltar para seis meses', async () => {
  let settled: expenses.ExpenseBreakdownResult | null = null;
  const slowSuccess = Promise.withResolvers<Response>();
  const slowError = Promise.withResolvers<Response>();
  const first = new AbortController();
  const second = new AbortController();
  const latest = { months: '6' } as const;
  const publish = (result: expenses.ExpenseBreakdownResult) => { settled = result; };
  expect(typeof expenses.requestExpenseBreakdown).toBe('function');
  const a = expenses.requestExpenseBreakdown(sixMonths, first.signal, publish, () => slowSuccess.promise);
  first.abort();
  const b = expenses.requestExpenseBreakdown(currentMonth, second.signal, publish, () => slowError.promise);
  second.abort();
  await expenses.requestExpenseBreakdown(latest, new AbortController().signal, publish, async () => expenseResponse(875));
  slowSuccess.resolve(expenseResponse(111));
  slowError.resolve(new Response(null, { status: 503 }));
  await Promise.all([a, b]);
  expect(expenses.currentExpenseBreakdown(latest, settled)).toMatchObject({ status: 'ready', data: { totalExpense: 875 } });
});

import { readFileSync } from 'node:fs';
import { useAppStore } from '@/lib/store';
import * as smartInsights from './smart-insights';
import * as cashFlow from './cash-flow-forecast';
import * as balanceProj from './balance-projection';
import * as timeline from './spending-timeline';
import { FinanceRow } from '@/components/shared/finance-row';
import { FinanceChartTooltip } from '@/components/shared/finance-chart-tooltip';
import { Tooltip as RechartsTooltip } from 'recharts';

test('smart-insights conecta ação do insight à navegação da store e exibe erro com retry', () => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  expect(typeof (smartInsights as Record<string, any>).insightActionDestination).toBe('function');
  const dest = (smartInsights as Record<string, any>).insightActionDestination;
  expect(dest({ id: 'card-util-1', action: 'Pagar fatura' })).toBe('cards');
  expect(dest({ id: 'category-overspend', action: 'Ver detalhes da categoria' })).toBe('categories');
  expect(dest({ id: 'goal-1', action: 'Contribuir agora' })).toBe('savings');
  expect(dest({ id: 'income-vs-expense', action: 'Rever despesas' })).toBe('accounts');

  const Card = (smartInsights as Record<string, any>).InsightCard;
  expect(typeof Card).toBe('function');
  const el = withPtIntlDispatcher(() =>
    Card({
      insight: { id: 'card-util-1', type: 'danger', icon: 'CreditCard', title: 'Cartão', description: 'Desc', action: 'Pagar fatura' },
    }),
  );
  const findButton = (node: any): any => {
    if (!node || typeof node !== 'object') return undefined;
    if (typeof node.props?.onClick === 'function') return node;
    for (const child of React.Children.toArray(node.props?.children)) {
      const hit = findButton(child);
      if (hit) return hit;
    }
    return undefined;
  };
  const btn = findButton(el);
  expect(btn).toBeDefined();
  btn.props.onClick();
  expect(useAppStore.getState().currentView).toBe('cards');

  const Content = (smartInsights as Record<string, any>).SmartInsightsContent;
  expect(typeof Content).toBe('function');
  const errHtml = renderToStaticMarkup(<Content insights={[]} loading={false} error activeTab="all" onTabChange={() => {}} onRetry={() => {}} />);
  expect(errHtml).toContain('Tentar novamente');

  const src = readFileSync(new URL('./smart-insights.tsx', import.meta.url), 'utf8');
  expect(src).not.toContain('min-h-8');
});

test('widgets de fluxo e análise removem framer-motion, cores Tailwind fixas, sombras hardcoded e micro-tipografia', () => {
  for (const file of ['cash-flow-forecast.tsx', 'balance-projection.tsx', 'expense-breakdown.tsx', 'spending-timeline.tsx']) {
    const src = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
    expect(src).not.toMatch(/from 'framer-motion'|<motion\.|AnimatePresence/);
    expect(src).not.toMatch(/border-(emerald|amber|rose)-|bg-orange-|bg-violet-|text-violet-|rgba\(0,0,0,0\.15\)|hover:bg-accent\/30/);
    expect(src).not.toMatch(/text-\[(9|10|11)px\]/);
  }
  const expenseSrc = readFileSync(new URL('./expense-breakdown.tsx', import.meta.url), 'utf8');
  expect(expenseSrc).not.toMatch(/\bmaxMonthlyValue\b|\bgetCategoryMonthlyData\b/);
  expect(expenseSrc).not.toContain('min-h-8');
  const cashSrc = readFileSync(new URL('./cash-flow-forecast.tsx', import.meta.url), 'utf8');
  expect(cashSrc).not.toContain('shadow-lg');
  const balSrc = readFileSync(new URL('./balance-projection.tsx', import.meta.url), 'utf8');
  expect(balSrc).not.toMatch(/shadow-lg|\bmin-h-8\b|\bfont-bold\b/);

  const BalContent = (balanceProj as Record<string, any>).BalanceProjectionContent;
  expect(typeof BalContent).toBe('function');
  const balHtml = renderToStaticMarkup(
    <BalContent
      loading={false}
      selectedMonths={6}
      onSelectMonths={() => {}}
      onRetry={() => {}}
      data={{
        accounts: [],
        monthLabels: ['jan'],
        totalCurrentBalance: 1000,
        totalProjected: 1200,
        averageMonthlySavings: 200,
        savingsRate: 25,
        riskLevel: 'low',
        months: 6,
      }}
    />,
  );
  expect(balHtml).toMatch(/role="progressbar"[^>]*aria-valuenow="25"/);
  expect(balHtml).toContain('aria-valuemin="0"');
  expect(balHtml).toContain('aria-valuemax="100"');

  const CashContent = (cashFlow as Record<string, any>).CashFlowForecastContent;
  expect(typeof CashContent).toBe('function');

  const TimelineContent = (timeline as Record<string, any>).SpendingTimelineContent;
  expect(typeof TimelineContent).toBe('function');
  const tlErrHtml = renderToStaticMarkup(
    <TimelineContent
      data={[]}
      loading={false}
      error
      activeDays={30}
      expandedDay={null}
      onSelectDays={() => {}}
      onToggleDay={() => {}}
      onRetry={() => {}}
    />,
  );
  expect(tlErrHtml).toContain('Tentar novamente');
});

test('SpendingTimelineContent adota FinanceRow nos itens expandidos mantendo sinal, BRL, tokens e máscara', () => {
  const dayDetailsSrc = readFileSync(new URL('./spending-day-details.tsx', import.meta.url), 'utf8');
  expect(dayDetailsSrc).toContain("from '@/components/shared/finance-row'");

  const TimelineContent = timeline.SpendingTimelineContent;
  const html = renderToStaticMarkup(
    <TimelineContent
      data={[
        {
          date: '2026-01-15',
          income: 320,
          expense: 85.5,
          net: 234.5,
          count: 2,
          runningBalance: 1234.5,
          items: [
            { type: 'transaction', description: 'Freela', amount: 320, category: 'Renda Extra' },
            { type: 'purchase', description: 'Padaria Central', amount: -85.5, category: 'Alimentação' },
          ],
        },
      ]}
      loading={false}
      error={false}
      activeDays={30}
      expandedDay="2026-01-15"
      onSelectDays={() => {}}
      onToggleDay={() => {}}
      onRetry={() => {}}
    />,
  );
  expect(html).toContain('Freela');
  expect(html).toContain('Padaria Central');
  expect(html).toContain('Renda Extra');
  expect(html).toContain('Alimentação');
  expect(html).toContain('+R$');
  expect(html).toContain('−R$');
  expect(html).toContain('--ds-accent-positive');
  expect(html).toContain('--ds-accent-danger');
  expect(html).toMatch(/<ul[^>]*><li\b/);

  const maskedTimelineRow = renderToStaticMarkup(
    <ul>
      <FinanceRow
        variant="timeline"
        tone="negative"
        description="Padaria Central"
        metadata="Alimentação"
        amount={-85.5}
        showValues={false}
        ariaLabel="Padaria Central R$ 85,50"
      />
    </ul>,
  );
  expect(maskedTimelineRow).toContain('R$ ••••••');
  expect(maskedTimelineRow).not.toMatch(/85|50/);
});

function findTooltipNode(node: unknown): { props: Record<string, any> } | undefined {
  if (!node || typeof node !== 'object') return undefined;
  const el = node as { type?: unknown; props?: Record<string, any> };
  if (el.type === RechartsTooltip) return el as { props: Record<string, any> };
  for (const child of React.Children.toArray(el.props?.children)) {
    const hit = findTooltipNode(child);
    if (hit) return hit;
  }
  return undefined;
}

test('CashFlowForecastContent e BalanceProjectionContent adotam FinanceChartTooltip preservando formato, sinal, máscara e retorno nulo', () => {
  for (const file of ['cash-flow-forecast.tsx', 'balance-projection.tsx']) {
    const src = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
    expect(src).toContain("from '@/components/shared/finance-chart-tooltip'");
  }

  const tooltipSrc = readFileSync(new URL('../shared/finance-chart-tooltip.tsx', import.meta.url), 'utf8');
  expect(tooltipSrc).not.toMatch(/from 'framer-motion'|shadow-lg|\bmin-h-8\b|\bfont-bold\b|currencyFmt|shortCurrency/);
  expect(typeof FinanceChartTooltip).toBe('function');

  const CashContent = (cashFlow as Record<string, any>).CashFlowForecastContent;
  const cashTree = withPtIntlDispatcher(() =>
    CashContent({
      loading: false,
      onRetry: () => {},
      data: {
        forecastMonths: [{ month: 'março', projectedIncome: 4200, projectedExpense: 4550, projectedNet: -350, confidence: 85 }],
        topExpenseCategories: [],
        riskAlerts: [],
        trendDirection: 'declining',
      },
    }),
  );
  const cashTooltipNode = findTooltipNode(cashTree);
  expect(cashTooltipNode).toBeDefined();
  expect(cashTooltipNode?.props.content?.type).toBe((cashFlow as Record<string, any>).CashFlowForecastTooltip);

  const CashTooltip = (cashFlow as Record<string, any>).CashFlowForecastTooltip;
  expect(typeof CashTooltip).toBe('function');
  const cashActiveHtml = renderToStaticMarkup(
    <CashTooltip
      active
      label="março"
      payload={[
        { name: 'Receita', dataKey: 'Receita', value: 4200, color: 'var(--ds-accent-positive)' },
        { name: 'Saldo', dataKey: 'Saldo', value: -350, color: 'var(--primary)' },
      ]}
    />,
  );
  expect(cashActiveHtml).toContain('bg-card');
  expect(cashActiveHtml).toContain('border-border');
  expect(cashActiveHtml).toContain('março');
  expect(cashActiveHtml).toContain('Receita:');
  expect(cashActiveHtml).toContain('R$ 4.200,00');
  expect(cashActiveHtml).toContain('Saldo:');
  expect(cashActiveHtml).toContain('-R$ 350,00');

  expect(renderToStaticMarkup(<CashTooltip active={false} label="março" payload={[{ name: 'Receita', value: 4200 }]} />)).toBe('');
  expect(renderToStaticMarkup(<CashTooltip active label="março" payload={[]} />)).toBe('');
  expect(renderToStaticMarkup(<CashTooltip active label="março" payload={[{ name: 'Receita', value: undefined }]} />)).toBe('');

  const cashMaskedHtml = renderToStaticMarkup(
    <CashTooltip
      active
      label="março"
      showValues={false}
      payload={[
        { name: 'Receita', dataKey: 'Receita', value: 4200, color: 'var(--ds-accent-positive)' },
        { name: 'Saldo', dataKey: 'Saldo', value: -350, color: 'var(--primary)' },
      ]}
    />,
  );
  expect(cashMaskedHtml).toContain('R$ ••••••');
  expect(cashMaskedHtml).not.toMatch(/4\.200|350/);

  const BalContent = (balanceProj as Record<string, any>).BalanceProjectionContent;
  const balTree = withPtIntlDispatcher(() =>
    BalContent({
      loading: false,
      selectedMonths: 6,
      onSelectMonths: () => {},
      onRetry: () => {},
      data: {
        accounts: [
          {
            accountId: 'acc-1',
            accountName: 'Conta Corrente',
            accountColor: '#0ea5e9',
            accountType: 'CHECKING',
            currentBalance: 1000,
            projectedBalances: [1850.5],
            avgMonthlyIncome: 2000,
            avgMonthlyExpense: 1149.5,
            monthlyNet: 850.5,
            trend: 'up',
          },
        ],
        monthLabels: ['abr/26'],
        totalCurrentBalance: 1000,
        totalProjected: 1850.5,
        averageMonthlySavings: 850.5,
        savingsRate: 42.5,
        riskLevel: 'low',
        months: 6,
      },
    }),
  );
  const balTooltipNode = findTooltipNode(balTree);
  expect(balTooltipNode).toBeDefined();
  expect(balTooltipNode?.props.content?.type).toBe((balanceProj as Record<string, any>).BalanceProjectionTooltip);

  const BalTooltip = (balanceProj as Record<string, any>).BalanceProjectionTooltip;
  expect(typeof BalTooltip).toBe('function');
  const balActiveHtml = renderToStaticMarkup(
    <BalTooltip
      active
      label="abr/26"
      payload={[{ name: 'Conta Corrente', dataKey: 'Conta Corrente', value: 1850.5, color: '#0ea5e9' }]}
    />,
  );
  expect(balActiveHtml).toContain('abr/26');
  expect(balActiveHtml).toContain('Conta Corrente:');
  expect(balActiveHtml).toContain('R$ 1.850,50');

  expect(renderToStaticMarkup(<BalTooltip active={false} label="abr/26" payload={[{ name: 'Conta Corrente', dataKey: 'Conta Corrente', value: 1850.5 }]} />)).toBe('');
  expect(renderToStaticMarkup(<BalTooltip active label="abr/26" payload={[]} />)).toBe('');
  expect(renderToStaticMarkup(<BalTooltip active label="abr/26" payload={[{ name: 'Conta Corrente', dataKey: 'Conta Corrente', value: null }]} />)).toBe('');

  const balMaskedHtml = renderToStaticMarkup(
    <BalTooltip
      active
      label="abr/26"
      showValues={false}
      payload={[{ name: 'Conta Corrente', dataKey: 'Conta Corrente', value: 1850.5, color: '#0ea5e9' }]}
    />,
  );
  expect(balMaskedHtml).toContain('R$ ••••••');
  expect(balMaskedHtml).not.toMatch(/1\.850|50/);
});

test('Task 0018: spending-timeline adota QueryPanel/FinanceMetric e delega detalhes mantendo zeros e dias sem movimento', () => {
  const tlSrc = readFileSync(new URL('./spending-timeline.tsx', import.meta.url), 'utf8');
  expect(tlSrc).toContain("from '@/components/shared/query-panel'");
  expect(tlSrc).toContain("from '@/components/shared/finance-metric'");
  const dayDetailsSrc = readFileSync(new URL('./spending-day-details.tsx', import.meta.url), 'utf8');
  expect(dayDetailsSrc).toContain("from '@/components/shared/finance-row'");

  const emptyHtml = renderToStaticMarkup(
    <timeline.SpendingTimelineContent
      data={[]}
      loading={false}
      error={false}
      activeDays={30}
      expandedDay={null}
      onSelectDays={() => {}}
      onToggleDay={() => {}}
      onRetry={() => {}}
    />,
  );
  expect(emptyHtml).toContain('Sem dados de movimentação para exibir.');

  const zeroDayHtml = renderToStaticMarkup(
    <timeline.SpendingTimelineContent
      data={[{ date: '2026-01-14', income: 0, expense: 0, net: 0, count: 0, runningBalance: 0, items: [] }]}
      loading={false}
      error={false}
      activeDays={7}
      expandedDay={null}
      onSelectDays={() => {}}
      onToggleDay={() => {}}
      onRetry={() => {}}
    />,
  );
  expect(zeroDayHtml).toContain('Sem movimentações');
  expect(zeroDayHtml).toContain('+R$ 0,00');
});

test('Task 0018: expense-breakdown adota FinanceChartTooltip e delega detalhes de categoria mantendo top 3 simples', () => {
  const detailsSrc = readFileSync(new URL('./expense-category-details.tsx', import.meta.url), 'utf8');
  expect(detailsSrc).toContain("from '@/components/shared/finance-chart-tooltip'");

  const ExpenseTooltip = (expenses as Record<string, any>).ExpenseBreakdownTooltip;
  expect(typeof ExpenseTooltip).toBe('function');
  const activeHtml = renderToStaticMarkup(
    <ExpenseTooltip
      active
      payload={[{ name: 'Moradia', value: 1250, payload: { color: '#8b5cf6' } }]}
    />,
  );
  expect(activeHtml).toContain('Moradia:');
  expect(activeHtml).toContain('R$ 1.250,00');
  expect(renderToStaticMarkup(<ExpenseTooltip active={false} payload={[{ name: 'Moradia', value: 1250 }]} />)).toBe('');
  const maskedHtml = renderToStaticMarkup(
    <ExpenseTooltip active showValues={false} payload={[{ name: 'Moradia', value: 1250 }]} />,
  );
  expect(maskedHtml).toContain('R$ ••••••');
  expect(maskedHtml).not.toContain('1.250');
});

test('renderiza CashFlowForecastContent, BalanceProjectionContent e SpendingTimelineContent em pt, es e en e oculta dígitos', () => {
  const expected = {
    pt: { emptyTimeline: 'Sem dados de movimentação para exibir.', retry: 'Tentar novamente' },
    es: { emptyTimeline: 'Sin datos de movimientos para mostrar.', retry: 'Intentar de nuevo' },
    en: { emptyTimeline: 'No activity data to display.', retry: 'Try again' },
  } as const;
  const CashContent = (cashFlow as Record<string, any>).CashFlowForecastContent;

  for (const locale of CANONICAL_LOCALES) {
    const tlHtml = renderWithIntl(
      <timeline.SpendingTimelineContent
        data={[]}
        loading={false}
        error={false}
        activeDays={30}
        expandedDay={null}
        onSelectDays={() => {}}
        onToggleDay={() => {}}
        onRetry={() => {}}
      />,
      locale,
    );
    expect(tlHtml).toContain(expected[locale].emptyTimeline);
    expect(tlHtml).not.toContain('MISSING_MESSAGE');

    const cashErrHtml = renderWithIntl(<CashContent loading={false} onRetry={() => {}} data={null} />, locale);
    expect(cashErrHtml).toContain(expected[locale].retry);

    const maskedTooltip = renderWithIntl(
      <expenses.ExpenseBreakdownTooltip active showValues={false} payload={[{ name: 'Moradia', value: 1250 }]} />,
      locale,
    );
    expect(maskedTooltip).not.toMatch(/1\.?250/);
  }
});
