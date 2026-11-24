/// <reference types="bun-types" />
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Presentation and wiring contracts; browser interaction is verified separately.
const widgets = [
  ['financial-calendar', 'Calendário Financeiro', 'Resumo do intervalo'],
  ['networth-evolution', 'Evolução Patrimonial', 'Indicadores patrimoniais'],
  ['debt-overview', 'Visão de Dívidas', 'Composição das dívidas'],
  ['transaction-analytics', 'Análise de Transações', 'Indicadores de transações'],
  ['financial-reports', 'Relatórios Financeiros', 'Indicadores do relatório'],
] as const;

function source(name: string) {
  return readFileSync(new URL(`./${name}.tsx`, import.meta.url), 'utf8');
}

for (const [name, title, group] of widgets) {
  test(`${title}: painel nomeado e grupo de dados sem ornamentação`, () => {
    const jsx = source(name);
    expect(jsx).toMatch(/<section aria-labelledby="[^"]+"/);
    expect(jsx).toContain(`aria-label="${group}"`);
    expect(jsx).not.toMatch(/bg-gradient|card-glow|<motion\./);
    expect(jsx).toMatch(/import \{ currencyFmt(?:, [^}]+)? \} from '@\/lib\/helpers';/);
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
  expect(hasControl('financial-calendar', 'Mês anterior', '{() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}')).toBe(true);
  expect(hasControl('financial-calendar', 'Próximo mês', '{() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}')).toBe(true);
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
  expect(html).toMatch(/role="progressbar"[^>]*aria-valuenow="20"/);
  expect(html).toContain('aria-valuemin="0"');
  expect(html).toContain('aria-valuemax="100"');
  expect(html).toMatch(/font-mono[^>]*tabular-nums[^>]*>R\$ 1\.500,00/);
  expect(html).toMatch(/font-mono[^>]*tabular-nums[^>]*>20\.0%/);
});

test('financial-calendar usa ChevronRight, botão retry no erro e tamanhos acessíveis', () => {
  const jsx = source('financial-calendar');
  expect(jsx).toContain('ChevronRight');
  expect(jsx).not.toContain('rotate-180');
  expect(jsx).not.toMatch(/\bh-7 w-7\b|\bh-7\b|\bsize-8\b|\bfont-bold\b/);

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
