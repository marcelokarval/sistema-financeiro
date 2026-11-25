/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import React, { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { QuickStatsOverview, QuickStatsPanel } from './quick-stats-overview';
import { SmartInsightsContent } from './smart-insights';
import { InvestmentEntries } from './investments-view';
import { AdvisorComposer } from './advisor-composer';
import { NotificationPanel } from './notification-panel';
import { QueryPanel } from '@/components/shared/query-panel';

describe('Wave 1 — remoção de framer-motion e residuais do core', () => {
  test('nenhum arquivo em src/ importa framer-motion', () => {
    for (const file of [
      '../../app/page.tsx',
      './app-header.tsx',
      './app-overlays.tsx',
      './global-search.tsx',
      './global-search-result.tsx',
      './notification-panel.tsx',
      './ai-advisor.tsx',
      './advisor-composer.tsx',
    ]) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8');
      expect(source).not.toContain('framer-motion');
      expect(source).not.toMatch(/<motion\.|AnimatePresence|MotionConfig/);
    }
  });

  test('AdvisorComposer separa sugestões e envio com validação de rascunho e estado pendente', () => {
    const emptyHtml = renderToStaticMarkup(
      <AdvisorComposer
        suggestions={['Como economizar mais?', 'Meta de investimento']}
        inputValue="   "
        isLoading={false}
        inputRef={createRef()}
        onInputChange={() => {}}
        onSubmit={() => {}}
        onSuggestionClick={() => {}}
        onKeyDown={() => {}}
      />,
    );
    expect(emptyHtml).toContain('Sugestões de perguntas');
    expect(emptyHtml).toContain('Como economizar mais?');
    expect(emptyHtml).toContain('aria-label="Sua dúvida financeira"');
    expect(emptyHtml).toMatch(/<button[^>]*type="submit"[^>]*aria-label="Enviar mensagem"[^>]*disabled/);

    const readyHtml = renderToStaticMarkup(
      <AdvisorComposer
        suggestions={['Como economizar mais?']}
        inputValue="Resumo do mês"
        isLoading={false}
        onInputChange={() => {}}
        onSubmit={() => {}}
        onSuggestionClick={() => {}}
        onKeyDown={() => {}}
      />,
    );
    expect(readyHtml).not.toMatch(/<button[^>]*type="submit"[^>]*disabled/);
  });

  test('NotificationPanel adota QueryPanel preservando seção sem role=dialog e estado de carregamento', () => {
    const html = renderToStaticMarkup(<NotificationPanel isOpen onClose={() => {}} />);
    expect(html).toContain('<section');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Carregando atividades…');
    expect(html).not.toContain('role="dialog"');
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

describe('Task 0017 — SmartInsights e QuickStatsOverview com QueryPanel preservando cálculos, zero e sparkline', () => {
  test('SmartInsightsContent adota QueryPanel distinguindo carregamento, erro com retry, vazio e sucesso filtrado', () => {
    const src = readFileSync(new URL('./smart-insights.tsx', import.meta.url), 'utf8');
    expect(src).toContain("from '@/components/shared/query-panel'");
    expect(src).toContain('<QueryPanel');

    const tree = SmartInsightsContent({
      insights: [],
      loading: false,
      error: false,
      activeTab: 'all',
      onTabChange: () => {},
      onRetry: () => {},
    });
    expect(React.isValidElement(tree)).toBe(true);
    expect((tree as React.ReactElement).type).toBe(QueryPanel);

    const emptyHtml = renderToStaticMarkup(tree);
    expect(emptyHtml).toContain('Nenhuma análise disponível');
    expect(emptyHtml).not.toContain('Tentar novamente');

    const errHtml = renderToStaticMarkup(
      <SmartInsightsContent
        insights={[]}
        loading={false}
        error={true}
        activeTab="all"
        onTabChange={() => {}}
        onRetry={() => {}}
      />,
    );
    expect(errHtml).toContain('role="alert"');
    expect(errHtml).toContain('Tentar novamente');
  });

  test('QuickStatsOverview e QuickStatsPanel adotam QueryPanel preservando refreshCounter, zero real, sparkline e HealthBar', () => {
    const src = readFileSync(new URL('./quick-stats-overview.tsx', import.meta.url), 'utf8');
    expect(src).toContain("from '@/components/shared/query-panel'");
    expect(src).toContain('<QueryPanel');
    expect(src).toContain('refreshCounter');
    expect(src).toContain('Tentar novamente');

    const loadingHtml = renderToStaticMarkup(<QuickStatsOverview refreshCounter={2} />);
    expect(loadingHtml).toContain('aria-busy="true"');
    expect(loadingHtml).toContain('Carregando indicadores…');

    const zeroPanelEl = QuickStatsPanel({
      data: {
        current: {
          totalBalance: 0,
          cardDebt: 0,
          investments: 0,
          savingsGoals: 0,
          netWorth: 0,
          monthlyIncome: 0,
          monthlyExpense: 0,
          monthlySavings: 0,
          savingsRate: 0,
        },
        sparklines: {
          balance: [0, 0],
          income: [],
          expense: [],
        },
        changes: {
          incomeVsLastMonth: 0,
          expenseVsLastMonth: 0,
          savingsVsLastMonth: 0,
        },
      },
    });
    expect(React.isValidElement(zeroPanelEl)).toBe(true);
    expect((zeroPanelEl as React.ReactElement).type).toBe(QueryPanel);

    const zeroHtml = renderToStaticMarkup(zeroPanelEl);
    expect(zeroHtml).toContain('R$ 0,00');
    expect(zeroHtml).toContain('0.0%');
    expect(zeroHtml).toContain('Estável');
    expect(zeroHtml).not.toContain('do patrimônio (valor absoluto)');
  });
});
