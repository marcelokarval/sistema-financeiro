/// <reference types="bun-types" />

import { expect, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuickStatsOverview } from './quick-stats-overview';
import { SmartInsights } from './smart-insights';
import { CashFlowForecast } from './cash-flow-forecast';
import { SpendingTimeline } from './spending-timeline';
import * as expenses from './expense-breakdown';
const { ExpenseBreakdown } = expenses;
import { BalanceProjection } from './balance-projection';

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
  const el = Card({
    insight: { id: 'card-util-1', type: 'danger', icon: 'CreditCard', title: 'Cartão', description: 'Desc', action: 'Pagar fatura' },
  });
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
