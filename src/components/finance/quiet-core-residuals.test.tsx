/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { QuickStatsPanel } from './quick-stats-overview';
import { InvestmentEntries } from './investments-view';

describe('Wave 1 — remoção de framer-motion e residuais do core', () => {
  test('nenhum arquivo em src/ importa framer-motion', () => {
    for (const file of [
      '../../app/page.tsx',
      './global-search.tsx',
      './notification-panel.tsx',
    ]) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8');
      expect(source).not.toContain('framer-motion');
      expect(source).not.toMatch(/<motion\.|AnimatePresence|MotionConfig/);
    }
  });

  test('QuickStatsPanel consome séries históricas reais (monthlySavingsHistory, investmentsHistory, cardDebtHistory) da API', () => {
    const source = readFileSync(new URL('./quick-stats-overview.tsx', import.meta.url), 'utf8');
    expect(source).toContain('monthlySavingsHistory');
    expect(source).toContain('investmentsHistory');
    expect(source).toContain('cardDebtHistory');

    const html = renderToStaticMarkup(
      <QuickStatsPanel
        data={{
          current: {
            totalBalance: 5000,
            cardDebt: 800,
            investments: 12000,
            savingsGoals: 3000,
            netWorth: 19200,
            monthlyIncome: 6000,
            monthlyExpense: 3500,
            monthlySavings: 2500,
            savingsRate: 41.7,
          },
          sparklines: {
            balance: [1000, 2000, 3000, 4000, 4500, 5000],
            income: [5000, 5200, 5400, 5600, 5800, 6000],
            expense: [3000, 3100, 3200, 3300, 3400, 3500],
          },
          monthlySavingsHistory: [2000, 2100, 2200, 2300, 2400, 2500],
          investmentsHistory: [10000, 10400, 10800, 11200, 11600, 12000],
          cardDebtHistory: [500, 600, 700, 750, 780, 800],
          changes: {
            incomeVsLastMonth: 3.4,
            expenseVsLastMonth: 2.9,
            savingsVsLastMonth: 4.2,
          },
        }}
      />,
    );

    expect(html).toContain('Histórico de economia mensal');
    expect(html).toContain('Histórico de investimentos');
    expect(html).toContain('Histórico da dívida em cartões');
    expect(html).not.toContain('Estimativa sem histórico');
    expect(html).not.toContain('Proporção das despesas');
  });

  test('AccountsView expõe edição e exclusão inline de transações ligadas a PUT/DELETE /api/transactions', () => {
    const source = readFileSync(new URL('./accounts-view.tsx', import.meta.url), 'utf8');
    expect(source).toContain('Editar transação');
    expect(source).toContain('Excluir transação');
    expect(source).toContain("method: 'PUT'");
    expect(source).toContain('/api/transactions?id=');
    expect(source).toContain('Excluir transação?');
  });

  test('InvestmentEntries e InvestmentsView expõem edição e exclusão inline de transações de investimento', () => {
    const source = readFileSync(new URL('./investments-view.tsx', import.meta.url), 'utf8');
    expect(source).toContain('Editar transação');
    expect(source).toContain('Excluir transação');
    expect(source).toContain('/api/investments/transactions');
    expect(source).toContain("method: 'PUT'");
    expect(source).toContain('/api/investments/transactions?id=');

    const html = renderToStaticMarkup(
      <InvestmentEntries
        transactions={[{ id: 'tx-1', type: 'APORTE', amount: 500, date: '2026-05-01', description: 'Aporte mensal' }]}
        onNew={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(html).toContain('aria-label="Editar transação: Aporte mensal"');
    expect(html).toContain('aria-label="Excluir transação: Aporte mensal"');
  });
});
