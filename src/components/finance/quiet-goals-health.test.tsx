/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AchievementBadges } from './achievement-badges';
import { BudgetGoalsWidget } from './budget-goals';
import { FinancialHealthScore } from './financial-health-score';
import { GoalsDashboard } from './goals-dashboard';
import * as SavingsUI from './savings-challenge';
import * as BudgetUI from './budget-goals';
import * as AchievementUI from './achievement-badges';
import * as HealthUI from './financial-health-score';
import * as GoalsUI from './goals-dashboard';
import { SavingsChallenge } from './savings-challenge';

describe('acompanhamento financeiro', () => {
  const panels = [
    ['Desafios de economia', SavingsChallenge],
    ['Central de metas', GoalsDashboard],
    ['Metas de orçamento', BudgetGoalsWidget],
    ['Conquistas', AchievementBadges],
    ['Saúde financeira', FinancialHealthScore],
  ] as const;

  for (const [name, Panel] of panels) {
    test(`${name}: região nomeada sinaliza carregamento sem exibir dados fictícios`, () => {
      const html = renderToStaticMarkup(<Panel />);
      expect(html).toContain(`aria-label="${name}"`);
      expect(html).toContain('aria-busy="true"');
      expect(html).not.toMatch(/gradient|card-glow|R\$/);
    });
  }
});

test('desafio mantém a ação local e expõe progresso, estado e limite', () => {
  expect(SavingsUI).toHaveProperty('ChallengeRow');
  const html = renderToStaticMarkup(<SavingsUI.ChallengeRow challenge={{ id: 'daily-spend', title: 'Gasto sintético', description: 'Descrição', current: 20, target: 50, progress: 40, unit: 'currency' }} />);
  expect(html).toMatch(/role="progressbar"[^>]*aria-valuenow="40"/);
  expect(html).toContain('Precisa melhorar');
  expect(html).toContain('R$ 50,00');
  expect(html).toContain('Iniciar Desafio');
  expect(html).not.toMatch(/gradient|card-glow/);
});

test('meta ativa tem menu nomeado e concluída permite reabrir', () => {
  expect(BudgetUI).toHaveProperty('BudgetGoalRow');
  const goal = { id: 'g', name: 'Meta sintética', description: 'Descrição', targetAmount: 100, currentAmount: 25, categoryId: null, category: null, startDate: '2026-01-01', endDate: null, isCompleted: false };
  const noop = () => {};
  const row = (isCompleted: boolean) => renderToStaticMarkup(<BudgetUI.BudgetGoalRow goal={{ ...goal, isCompleted }} onEdit={noop} onDelete={noop} onToggle={noop} />);
  const active = row(false);
  expect(active).toContain('aria-label="Mais ações de Meta sintética"');
  expect(active).toContain('Marcar como concluída');
  expect(active).toContain('R$ 75,00');
  expect(active).toMatch(/role="progressbar"[^>]*aria-valuenow="25"/);
  expect(row(true)).toContain('Reabrir meta');
  expect(row(true)).not.toContain('Mais ações de Meta sintética');
});

test('cor configurada acompanha o nome da categoria na meta de orçamento', () => {
  const goal = { id: 'g', name: 'Meta sintética', description: '', targetAmount: 100, currentAmount: 25, categoryId: 'c', category: { id: 'c', name: 'Moradia', color: '#8b5cf6' }, startDate: '2026-01-01', endDate: null, isCompleted: false };
  const noop = () => {};
  const html = renderToStaticMarkup(<BudgetUI.BudgetGoalRow goal={goal} onEdit={noop} onDelete={noop} onToggle={noop} />);
  expect(html).toMatch(/aria-hidden="true"[^>]*background-color:#8b5cf6[^>]*><\/span><span[^>]*>Moradia<\/span>/);
});

test('central de metas mostra a cor configurada como marcador junto ao texto', () => {
  expect(GoalsUI).toHaveProperty('GoalCategoryLabel');
  const html = renderToStaticMarkup(<GoalsUI.GoalCategoryLabel color="#1a2b3c" label="Reserva" />);
  expect(html).toMatch(/aria-hidden="true"[^>]*background-color:#1a2b3c[^>]*><\/span><span[^>]*>Reserva<\/span>/);
  expect(renderToStaticMarkup(<GoalsUI.GoalCategoryLabel color={null} label="Orçamento" />)).not.toContain('background-color');
});

test('restauração de foco prioriza o acionador conectado e usa Nova Meta se ele saiu', () => {
  expect(BudgetUI).toHaveProperty('restoreBudgetGoalFocus');
  let focused = '';
  const origin = { isConnected: true, focus: () => { focused = 'acionador'; } };
  const create = { isConnected: true, focus: () => { focused = 'Nova Meta'; } };
  BudgetUI.restoreBudgetGoalFocus(origin, create);
  expect(focused).toBe('acionador');
  origin.isConnected = false;
  BudgetUI.restoreBudgetGoalFocus(origin, create);
  expect(focused).toBe('Nova Meta');
});

test('exclusão rápida encaminha foco só após a remoção e não interrompe outro controle', () => {
  expect(BudgetUI).toHaveProperty('restoreBudgetGoalFocusAfterDeletion');
  let focusCount = 0;
  const create = { isConnected: true, focus: () => { focusCount++; } };
  const body = { isConnected: true };
  const otherControl = { isConnected: true };
  const deletedId = 'meta-excluida';
  BudgetUI.restoreBudgetGoalFocusAfterDeletion(deletedId, [{ id: deletedId }], body, body, create);
  expect(focusCount).toBe(0);
  BudgetUI.restoreBudgetGoalFocusAfterDeletion(deletedId, [], otherControl, body, create);
  expect(focusCount).toBe(0);
  BudgetUI.restoreBudgetGoalFocusAfterDeletion(deletedId, [], body, body, create);
  expect(focusCount).toBe(1);
});

test('conquista bloqueada mantém categoria e progresso legíveis', () => {
  expect(AchievementUI).toHaveProperty('AchievementRow');
  const html = renderToStaticMarkup(<AchievementUI.AchievementRow achievement={{ id: 'a', title: 'Medalha sintética', description: 'Descrição', icon: 'Target', category: 'controle', unlocked: false, progress: 67, currentValue: 67, targetValue: 100, unlockedAt: null }} />);
  expect(html).toContain('Bloqueada');
  expect(html).toContain('Controle');
  expect(html).toMatch(/role="progressbar"[^>]*aria-valuenow="67"/);
  expect(html).not.toMatch(/gradient|blur/);
});

test('saúde financeira mostra critérios do score e valores BRL da consulta', () => {
  expect(HealthUI).toHaveProperty('HealthBreakdown');
  const html = renderToStaticMarkup(<HealthUI.HealthBreakdown data={{ totalBalance: 2000, totalCardBalance: 0, totalCardLimit: 0, monthIncome: 1000, monthExpense: 800, recentTransactions: [], recentPurchases: [], expenseByCategory: [], monthlyTrend: [], accountBalances: [] }} />);
  expect(html).toMatch(/role="progressbar"[^>]*aria-valuenow="61"/);
  expect(html).toContain('Regular');
  expect(html).toContain('Dados insuficientes');
  expect(html).toContain('R$ 200,00');
  expect(html).not.toMatch(/gradient|card-glow/);
});

test('visão geral identifica avanço, acumulado, alvo e restante das metas', () => {
  expect(GoalsUI).toHaveProperty('GoalsProgress');
  const html = renderToStaticMarkup(<GoalsUI.GoalsProgress summary={{ totalGoals: 2, completedGoals: 0, inProgressGoals: 2, totalTargetAmount: 250, totalCurrentAmount: 100, overallProgress: 40, estimatedCompletion: null }} />);
  expect(html).toMatch(/role="progressbar"[^>]*aria-valuenow="40"/);
  expect(html).toContain('Em andamento');
  expect(html).toContain('R$ 150,00');
  expect(html).not.toMatch(/gradient|card-glow/);
});

import { readFileSync } from 'node:fs';
import { UpcomingBillsPanel } from './upcoming-bills';
import * as MonthlyBudgetUI from './monthly-budget-tracker';

test('upcoming-bills remove texto interno de auditoria e alinha rounded-lg e h2', () => {
  const fixture = [
    { id: 'u1', type: 'card' as const, title: 'Fatura', amount: 50, dueDate: '2026-01-03', daysUntilDue: 2, status: 'urgent' as const, source: 'Cartão' },
  ];
  const html = renderToStaticMarkup(
    <UpcomingBillsPanel
      query={{ status: 'ready', data: { bills: fixture, summary: { thisWeek: { count: 1, amount: 50 }, thisMonth: { count: 1, amount: 50 }, totalAmount: 50 } } }}
      refresh={() => {}}
      showValues
    />,
  );
  expect(html).not.toContain('Agrupamento original por status');
  expect(html).toContain('<h2');
  expect(html).toContain('rounded-lg');
  expect(html).not.toContain('rounded-xl');
});

test('monthly-budget-tracker exige AlertDialog para exclusão, w-full nos SelectTrigger e alinha rounded-lg/h2', () => {
  const src = readFileSync(new URL('./monthly-budget-tracker.tsx', import.meta.url), 'utf8');
  expect(src).toContain('AlertDialogAction');
  expect(src).toContain('text-[var(--ds-destructive-fg)]');
  expect(src).not.toContain('rounded-xl');
  for (const match of src.matchAll(/<SelectTrigger\b[^>]*>/g)) {
    expect(match[0]).toContain('w-full');
  }
  const headerHtml = renderToStaticMarkup(
    <MonthlyBudgetUI.BudgetHeader status="ready" monthLabel="janeiro 2026" openCreateDialog={() => {}} refreshBudgets={() => {}} />,
  );
  expect(headerHtml).toContain('<h2');
});

test('budget-goals remove emoji do toast, usa grid responsivo e exibe retry em erro', () => {
  const src = readFileSync(new URL('./budget-goals.tsx', import.meta.url), 'utf8');
  expect(src).not.toContain('🎉');
  expect(src).not.toContain('grid-cols-2 gap-3');
  const Content = (BudgetUI as Record<string, any>).BudgetGoalsContent;
  expect(typeof Content).toBe('function');
  const errHtml = renderToStaticMarkup(
    <Content goals={[]} loading={false} error onCreate={() => {}} onEdit={() => {}} onDelete={() => {}} onToggle={() => {}} onRetry={() => {}} />,
  );
  expect(errHtml).toContain('Tentar novamente');
});

test('savings-challenge remove emojis mortos, exibe retry em erro e persiste desafio em localStorage', () => {
  const src = readFileSync(new URL('./savings-challenge.tsx', import.meta.url), 'utf8');
  expect(src).not.toMatch(/emoji:|🚀|💪|🎯|💡|⚠️/);
  const Content = (SavingsUI as Record<string, any>).SavingsChallengeContent;
  expect(typeof Content).toBe('function');
  const errHtml = renderToStaticMarkup(<Content data={null} loading={false} onRetry={() => {}} />);
  expect(errHtml).toContain('Tentar novamente');

  const store = new Map<string, string>();
  const origStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    },
  });
  try {
    expect(typeof (SavingsUI as Record<string, any>).acceptChallengeInStorage).toBe('function');
    (SavingsUI as Record<string, any>).acceptChallengeInStorage('daily-spend');
    const html = renderToStaticMarkup(
      <SavingsUI.ChallengeRow challenge={{ id: 'daily-spend', title: 'Gasto', description: 'Desc', current: 10, target: 50, progress: 20, unit: 'currency' }} />,
    );
    expect(html).toContain('Desafio aceito!');
  } finally {
    if (origStorage) Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: origStorage });
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('goals-dashboard, financial-health-score e achievement-badges exibem retry em erro, distinguem vazio de falha e evitam any[]', () => {
  const healthSrc = readFileSync(new URL('./financial-health-score.tsx', import.meta.url), 'utf8');
  expect(healthSrc).not.toContain('any[]');

  const GoalsContent = (GoalsUI as Record<string, any>).GoalsDashboardContent;
  expect(typeof GoalsContent).toBe('function');
  expect(renderToStaticMarkup(<GoalsContent data={null} loading={false} expandedGoal={null} onToggleExpand={() => {}} onRetry={() => {}} />)).toContain('Tentar novamente');

  const HealthContent = (HealthUI as Record<string, any>).FinancialHealthContent;
  expect(typeof HealthContent).toBe('function');
  expect(renderToStaticMarkup(<HealthContent data={null} loading={false} onRetry={() => {}} />)).toContain('Tentar novamente');

  const AchContent = (AchievementUI as Record<string, any>).AchievementBadgesContent;
  expect(typeof AchContent).toBe('function');
  const achErr = renderToStaticMarkup(<AchContent achievements={[]} loading={false} error activeFilter="todas" onFilterChange={() => {}} onRetry={() => {}} />);
  const achEmpty = renderToStaticMarkup(<AchContent achievements={[]} loading={false} error={false} activeFilter="todas" onFilterChange={() => {}} onRetry={() => {}} />);
  expect(achErr).toContain('Tentar novamente');
  expect(achErr).toContain('Não foi possível carregar');
  expect(achEmpty).toContain('Nenhuma conquista disponível');
});
