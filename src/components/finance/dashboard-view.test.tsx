/// <reference types="bun-types" />

import { readFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DashboardContent } from './dashboard-view';
import type { DashboardData, QueryResult } from './dashboard-query';
import { currencyFmt } from '@/lib/helpers';
import { UpcomingBillsPanel } from './upcoming-bills';
import { BudgetHeader } from './monthly-budget-tracker';
import { FinanceRow } from '@/components/shared/finance-row';
import { FinanceMetric } from '@/components/shared/finance-metric';

const data: DashboardData = {
  totalBalance: 9876.54, totalCardBalance: 320.24, totalCardLimit: 800,
  monthIncome: 1100, monthExpense: 350,
  monthlyTrend: [{ month: 'jan. de 26', income: 1100, expense: 350 }],
  accountBalances: [{ accountId: 'a1', accountName: 'Conta de teste', accountColor: '#888', balance: 9876.54 }],
  expenseByCategory: [{ categoryId: 'c1', categoryName: 'Alimentação', categoryColor: '#888', total: 350 }],
  recentTransactions: [{ id: 't1', type: 'INCOME', description: 'Entrada de teste', amount: 1100, date: '2026-01-12' }],
  recentPurchases: [{ id: 'p1', merchant: 'Compra de teste', totalAmount: 123.45, date: '2026-01-13', items: [{ id: 'i1', name: 'Item de teste', quantity: 1, totalPrice: 123.45 }] }],
};

function renderDashboard(status: 'ready' | 'loading' | 'error', showValues = true, fixture = data) {
  const query: QueryResult<DashboardData> = status === 'ready' ? { status, data: fixture } : { status };
  return renderToStaticMarkup(
    <DashboardContent query={query} showValues={showValues} retry={() => {}}>
      <p>Widget fornecido pela página</p>
    </DashboardContent>,
  );
}

test('organiza o saldo dominante, os quatro painéis e o acesso secundário', () => {
  const html = renderDashboard('ready');
  const labels = ['Saldo em contas', 'Saldo do período', 'Despesas do período', 'Próximos vencimentos', 'Entradas e saídas', 'Atividade recente', 'Orçamento mensal', 'Mais detalhes financeiros', 'Widget fornecido pela página'];
  expect(html).toContain('Saldo em contas');
  let cursor = -1;
  for (const label of labels) {
    const next = html.indexOf(label);
    expect(next).toBeGreaterThan(cursor);
    cursor = next;
  }
  expect(html).toContain(currencyFmt(9876.54));
  expect(html).toContain(currencyFmt(750));
  expect(html).toContain(currencyFmt(350));
  expect(html).toContain('Posição atual');
  expect(html).toContain('Agregação mensal');
  expect(html).toContain('Entrada de teste');
  expect(html).toContain('Compra de teste');
  expect(html).toContain('Item de teste');
});

test('mascara totais, valores da atividade e os detalhes das compras e da série', () => {
  const html = renderDashboard('ready', false);
  expect(html).toContain('R$ ••••••');
  for (const amount of [9876.54, 1100, 350, 750, 123.45, 320.24]) {
    expect(html).not.toContain(currencyFmt(amount));
  }
  expect(html).toContain('Série oculta');
  expect(html).toContain('Entrada de teste');
});

test('não confunde erro, carregamento, listas vazias e totais realmente zerados', () => {
  const pending = renderDashboard('loading');
  expect(pending).toContain('Carregando resumo');
  expect(pending).not.toContain(currencyFmt(0));
  const failed = renderDashboard('error');
  expect(failed).toContain('Não foi possível carregar o resumo');
  expect(failed).toContain('Tentar novamente');
  expect(failed).not.toContain(currencyFmt(0));
  expect(failed).toContain('Widget fornecido pela página');
  const empty = renderDashboard('ready', true, { ...data, totalBalance: 0, monthIncome: 0, monthExpense: 0, accountBalances: [], recentTransactions: [], recentPurchases: [] });
  expect(empty).toContain(currencyFmt(0));
  expect(empty).toContain('Nenhuma transação no período');
  expect(empty).toContain('Nenhuma compra no período');
});

test('mantém recorte e estado inicial dos dois widgets independentes', () => {
  const html = renderDashboard('loading');
  expect(html).toContain('Atrasados e próximos 30 dias');
  expect(html).toContain('Carregando vencimentos');
  expect(html).toContain('Mês atual');
  expect(html).toContain('Carregando orçamento');
});

test('restaura os agrupamentos expansíveis com os mesmos totais e critérios do painel anterior', () => {
  const fixture = (
    [
    { id: 'atrasado', title: 'Conta vencida', amount: 16.75, status: 'overdue', daysUntilDue: -1 },
    { id: 'urgente', title: 'Conta urgente', amount: 27.50, status: 'urgent', daysUntilDue: 3 },
    { id: 'proximo', title: 'Conta próxima', amount: 43.25, status: 'upcoming', daysUntilDue: 6 },
    { id: 'depois', title: 'Conta posterior', amount: 70, status: 'later', daysUntilDue: 9 },
  ] as const).map((bill) => ({ ...bill, type: 'card' as const, dueDate: '2026-01-03', source: 'Cartão sintético' }));
  const data = { bills: fixture, summary: { thisWeek: { count: 2, amount: 44.25 }, thisMonth: { count: 4, amount: 157.50 }, totalAmount: 157.50 } };
  const render = (showValues: boolean) => renderToStaticMarkup(<UpcomingBillsPanel query={{ status: 'ready', data }} refresh={() => {}} showValues={showValues} />);
  const markup = render(true);
  for (const [label, count, amount, members] of [
    ['Atrasados', 1, 16.75, ['Conta vencida']],
    ['Próximos (urgentes)', 1, 27.50, ['Conta urgente']],
    ['Este mês', 3, 87.50, ['Conta vencida', 'Conta urgente', 'Conta próxima']],
  ] as const) {
    const details = Array.from(markup.matchAll(/<details[^>]*>(.*?)<\/details>/g), (match) => match[1]);
    const group = details.find((detail) => detail.includes(`${label} (${count})`));
    expect(group).toBeDefined();
    expect(group).toContain(currencyFmt(amount));
    for (const bill of fixture) expect(group?.includes(bill.title)).toBe((members as readonly string[]).includes(bill.title));
  }
  expect(markup).toContain('Conta posterior');
  expect(render(false)).not.toContain(currencyFmt(87.50));
});

test('mantém a ação Novo limite e a nova tentativa após erro na leitura do orçamento', () => {
  const html = renderToStaticMarkup(<BudgetHeader status="error" monthLabel="janeiro 2026" openCreateDialog={() => {}} refreshBudgets={() => {}} />);
  expect(html).toContain('Não foi possível carregar o orçamento.');
  expect(html).toMatch(/<button[^>]*>(?:(?!<\/button>).)*Novo limite<\/button>/);
  expect(html).toContain('Tentar novamente');
});

test('nomeia variações monetárias sem atribuí-las às contagens de compras e transações', () => {
  const monthlyTrend = [{ month: 'dez. de 25', income: 1000, expense: 100 }, ...data.monthlyTrend];
  const html = renderDashboard('ready', true, { ...data, monthlyTrend });
  expect(html).toContain('Variação do saldo mensal: -15.0%');
  expect(html).toContain('Variação dos gastos mensais: 25.0%');
  expect(html).toContain('Variação do volume financeiro mensal: 31.8%');
});


test('explica a ambiguidade dos meses zerados devolvidos pela API sem esconder os totais', () => {
  const monthlyTrend = [
    { month: 'jan. de 26', income: 0, expense: 0 },
    { month: 'fev. de 26', income: 0, expense: 0 },
  ];
  const fixture = { ...data, monthIncome: 0, monthExpense: 0, monthlyTrend, recentTransactions: [], recentPurchases: [], expenseByCategory: [] };
  const note = 'Totais zerados podem indicar ausência de lançamentos ou valores que somaram zero.';
  const html = renderDashboard('ready', true, fixture);
  expect(html).toContain(note);
  expect(html).toContain('Valores por mês');
  expect(html).toContain(currencyFmt(0));
  expect(renderDashboard('ready', false, fixture)).not.toContain(note);
  expect(renderDashboard('ready')).not.toContain(note);
});


test('encaminha o sinal realtime aos painéis sem remontá-los e limita a remontagem aos widgets legados', () => {
  function visit(node: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
    if (Array.isArray(node)) return node.flatMap(visit);
    if (!React.isValidElement<Record<string, unknown>>(node)) return [];
    return [node, ...visit(node.props.children as React.ReactNode)];
  }
  const children = <p>Widget fornecido pela página</p>;
  const render = (refreshCounter: number) => visit(DashboardContent({ query: { status: 'ready', data }, showValues: false, retry: () => {}, children, refreshCounter }));
  const find = (nodes: ReturnType<typeof visit>, name: string) => nodes.find(({ type }) => typeof type === 'function' && type.name === name);
  const first = render(1);
  const second = render(2);
  for (const name of ['UpcomingBills', 'MonthlyBudgetTracker']) {
    expect(find(first, name)?.props.refreshCounter).toBe(1);
    expect(find(second, name)?.props.refreshCounter).toBe(2);
    expect(find(first, name)?.key).toBeNull();
    expect(find(second, name)?.key).toBeNull();
  }
  for (const name of ['FinancialHealthScore', 'FinancialReportsWidget', 'RecurringTransactionsWidget', 'BudgetGoalsWidget']) {
    expect(find(first, name)?.key).toBe(`${name}-1`);
    expect(find(second, name)?.key).toBe(`${name}-2`);
  }
  expect(second.find(({ type }) => type === 'details')?.key).toBeNull();
  expect(second).toContain(children);
});

test('RecentTransactions aplica tokens semânticos positivos e negativos junto com símbolo monetário', () => {
  const fixture: DashboardData = {
    ...data,
    recentTransactions: [
      { id: 't-in', type: 'INCOME', description: 'Salário', amount: 5000, date: '2026-01-12' },
      { id: 't-out', type: 'EXPENSE', description: 'Mercado', amount: 250, date: '2026-01-13' },
    ],
  };
  const html = renderDashboard('ready', true, fixture);
  expect(html).toContain('--ds-accent-positive');
  expect(html).toContain('--ds-accent-danger');
  expect(html).toContain('+R$');
  expect(html).toContain('−R$');
});

test('FinanceRow e FinanceMetric suportam variantes, semântica, ações opcionais, hierarquia do saldo e privacidade', () => {
  const rowsHtml = renderToStaticMarkup(
    <ul>
      <FinanceRow
        variant="compact"
        tone="positive"
        description="Salário mensal"
        metadata="12/01/2026 · Trabalho"
        amount={5000}
      />
      <FinanceRow
        variant="default"
        tone="negative"
        description="Mercado"
        metadata="Despesa · 13/01/2026"
        amount={250.5}
        actions={<button type="button" aria-label="Editar transação Mercado">Editar</button>}
      />
    </ul>,
  );
  expect(rowsHtml).toMatch(/^<ul><li\b/);
  expect(rowsHtml).toContain('Salário mensal');
  expect(rowsHtml).toContain('12/01/2026 · Trabalho');
  expect(rowsHtml).toContain(`+${currencyFmt(5000)}`);
  expect(rowsHtml).toContain(`−${currencyFmt(250.5)}`);
  expect(rowsHtml).toContain('--ds-accent-positive');
  expect(rowsHtml).toContain('--ds-accent-danger');
  expect(rowsHtml).toContain('aria-label="Editar transação Mercado"');

  const maskedRowHtml = renderToStaticMarkup(
    <ul>
      <FinanceRow
        tone="negative"
        description="Aluguel"
        metadata="10/01/2026"
        amount={1987.65}
        showValues={false}
        ariaLabel="Aluguel R$ 1.987,65"
      />
    </ul>,
  );
  expect(maskedRowHtml).toContain('R$ ••••••');
  expect(maskedRowHtml).not.toMatch(/1\.?987|65/);

  const maskedMetricHtml = renderToStaticMarkup(
    <dl>
      <FinanceMetric label="Saldo" value={currencyFmt(4321.98)} showValues={false} ariaLabel="Saldo R$ 4.321,98" />
    </dl>,
  );
  expect(maskedMetricHtml).toContain('<dt');
  expect(maskedMetricHtml).toContain('<dd');
  expect(maskedMetricHtml).toContain('R$ ••••••');
  expect(maskedMetricHtml).not.toMatch(/4\.?321|98/);

  const dashHtml = renderDashboard('ready');
  expect(dashHtml).toMatch(/<dt[^>]*>Saldo em contas<\/dt><dd[^>]*text-4xl sm:text-5xl[^>]*>/);
  const dashSrc = readFileSync(new URL('./dashboard-view.tsx', import.meta.url), 'utf8');
  expect(dashSrc).toContain("from '@/components/shared/finance-row'");
});
