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
  expect(hasProgressBar(html, '40', 'Progresso de Gasto sintético')).toBe(true);
  expect(html).toContain('Precisa melhorar');
  expect(html).toContain('R$ 50,00');
  expect(html).toContain('Iniciar Desafio');
  expect(html).not.toMatch(/gradient|card-glow/);
});

const hasProgressBar = (html: string, value: string, label?: string) => {
  const labelPart = label ? `(?=[^>]*\\baria-label="${label}")` : '';
  return new RegExp(`<div\\b(?=[^>]*\\brole="progressbar")${labelPart}(?=[^>]*\\baria-valuenow="${value}")[^>]*>`).test(html);
};

test('meta ativa tem menu nomeado e concluída permite reabrir', () => {
  expect(BudgetUI).toHaveProperty('BudgetGoalRow');
  const goal = { id: 'g', name: 'Meta sintética', description: 'Descrição', targetAmount: 100, currentAmount: 25, categoryId: null, category: null, startDate: '2026-01-01', endDate: null, isCompleted: false };
  const noop = () => {};
  const row = (isCompleted: boolean) => renderToStaticMarkup(<BudgetUI.BudgetGoalRow goal={{ ...goal, isCompleted }} onEdit={noop} onDelete={noop} onToggle={noop} />);
  const active = row(false);
  expect(active).toContain('aria-label="Mais ações de Meta sintética"');
  expect(active).toContain('Marcar como concluída');
  expect(active).toContain('R$ 75,00');
  expect(hasProgressBar(active, '25', 'Progresso da meta Meta sintética')).toBe(true);
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
  expect(hasProgressBar(html, '67', 'Progresso de Medalha sintética')).toBe(true);
  expect(html).not.toMatch(/gradient|blur/);
});

test('saúde financeira mostra critérios do score e valores BRL da consulta', () => {
  expect(HealthUI).toHaveProperty('HealthBreakdown');
  const html = renderToStaticMarkup(<HealthUI.HealthBreakdown data={{ totalBalance: 2000, totalCardBalance: 0, totalCardLimit: 0, monthIncome: 1000, monthExpense: 800, recentTransactions: [], recentPurchases: [], expenseByCategory: [], monthlyTrend: [], accountBalances: [] }} />);
  expect(hasProgressBar(html, '61', 'Pontuação de saúde financeira')).toBe(true);
  expect(html).toContain('Regular');
  expect(html).toContain('Dados insuficientes');
  expect(html).toContain('R$ 200,00');
  expect(html).not.toMatch(/gradient|card-glow/);
});

test('visão geral identifica avanço, acumulado, alvo e restante das metas', () => {
  expect(GoalsUI).toHaveProperty('GoalsProgress');
  const html = renderToStaticMarkup(<GoalsUI.GoalsProgress summary={{ totalGoals: 2, completedGoals: 0, inProgressGoals: 2, totalTargetAmount: 250, totalCurrentAmount: 100, overallProgress: 40, estimatedCompletion: null }} />);
  expect(hasProgressBar(html, '40', 'Progresso geral das metas')).toBe(true);
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

import { FinanceProgress } from '@/components/shared/finance-progress';

test('FinanceProgress expõe descrição, faixa/unidade e valor acessível determinado em 0 e em valor não nulo', () => {
  const zeroHtml = renderToStaticMarkup(
    <FinanceProgress
      label="Progresso da meta"
      description="Reserva de emergência"
      value={0}
      min={0}
      max={100}
      unit="%"
      showRange
    />,
  );
  expect(zeroHtml).toContain('data-slot="progress"');
  expect(zeroHtml).toContain('data-slot="progress-indicator"');
  expect(zeroHtml).toContain('Progresso da meta');
  expect(zeroHtml).toContain('Reserva de emergência');
  expect(zeroHtml).toContain('0%');
  expect(zeroHtml).toContain('100%');
  expect(hasProgressBar(zeroHtml, '0', 'Progresso da meta')).toBe(true);
  expect(zeroHtml).toContain('aria-valuemin="0"');
  expect(zeroHtml).toContain('aria-valuemax="100"');

  const partialHtml = renderToStaticMarkup(
    <FinanceProgress
      label="Pontuação de saúde financeira"
      value={78}
      min={0}
      max={100}
      unit="pontos"
      valueText="78 de 100 pontos"
      showRange
    />,
  );
  expect(partialHtml).toContain('Pontuação de saúde financeira');
  expect(partialHtml).toContain('0 pontos');
  expect(partialHtml).toContain('100 pontos');
  expect(hasProgressBar(partialHtml, '78', 'Pontuação de saúde financeira')).toBe(true);
  expect(partialHtml).toContain('aria-valuetext="78 de 100 pontos"');
  expect(partialHtml).toContain('aria-valuemin="0"');
  expect(partialHtml).toContain('aria-valuemax="100"');
});

test('budget-goals e financial-health-score usam FinanceProgress com valor determinado em 0 e não nulo', () => {
  const budgetSrc = readFileSync(new URL('./budget-goals.tsx', import.meta.url), 'utf8');
  const healthSrc = readFileSync(new URL('./financial-health-score.tsx', import.meta.url), 'utf8');
  expect(budgetSrc).toContain("from '@/components/shared/finance-progress'");
  expect(healthSrc).toContain("from '@/components/shared/finance-progress'");

  const noop = () => {};
  const zeroGoal = {
    id: 'g0',
    name: 'Meta zerada',
    description: '',
    targetAmount: 200,
    currentAmount: 0,
    categoryId: null,
    category: null,
    startDate: '2026-01-01',
    endDate: null,
    isCompleted: false,
  };
  const zeroRowHtml = renderToStaticMarkup(<BudgetUI.BudgetGoalRow goal={zeroGoal} onEdit={noop} onDelete={noop} onToggle={noop} />);
  expect(hasProgressBar(zeroRowHtml, '0', 'Progresso da meta Meta zerada')).toBe(true);
  expect(zeroRowHtml).toContain('aria-valuemin="0"');
  expect(zeroRowHtml).toContain('aria-valuemax="100"');

  const partialRowHtml = renderToStaticMarkup(
    <BudgetUI.BudgetGoalRow goal={{ ...zeroGoal, currentAmount: 90 }} onEdit={noop} onDelete={noop} onToggle={noop} />,
  );
  expect(hasProgressBar(partialRowHtml, '45', 'Progresso da meta Meta zerada')).toBe(true);

  const zeroScoreHtml = renderToStaticMarkup(
    <HealthUI.HealthBreakdown
      data={{
        totalBalance: 0,
        totalCardBalance: 100,
        totalCardLimit: 100,
        monthIncome: 0,
        monthExpense: 500,
        recentTransactions: [],
        recentPurchases: [],
        expenseByCategory: [],
        monthlyTrend: [
          { month: 'jan', income: 0, expense: 100 },
          { month: 'fev', income: 0, expense: 100 },
          { month: 'mar', income: 0, expense: 200 },
        ],
        accountBalances: [],
      }}
    />,
  );
  expect(hasProgressBar(zeroScoreHtml, '0', 'Pontuação de saúde financeira')).toBe(true);
  expect(zeroScoreHtml).toContain('aria-valuemin="0"');
  expect(zeroScoreHtml).toContain('aria-valuemax="100"');
});

import type { ReactElement, ReactNode } from 'react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FinanceFormDialogShell } from '@/components/shared/finance-dialog-shell';
import { BudgetGoalEditor } from './budget-goal-editor';
import { MonthlyBudgetEditor } from './monthly-budget-editor';
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

type ViewElement = ReactElement<Record<string, any>>;
const findElement = (node: ReactNode, matches: (element: ViewElement) => boolean): ViewElement | undefined => {
  for (const child of React.Children.toArray(node)) {
    if (!React.isValidElement<Record<string, any>>(child)) continue;
    if (matches(child)) return child;
    let content = child.props.children;
    if (child.type === BudgetGoalEditor) {
      content = withPtIntlDispatcher(() => BudgetGoalEditor((child as ReactElement<React.ComponentProps<typeof BudgetGoalEditor>>).props));
    } else if (child.type === MonthlyBudgetEditor) {
      content = withPtIntlDispatcher(() => MonthlyBudgetEditor((child as ReactElement<React.ComponentProps<typeof MonthlyBudgetEditor>>).props));
    } else if (child.type === FinanceFormDialogShell) {
      content = withPtIntlDispatcher(() => FinanceFormDialogShell((child as ReactElement<React.ComponentProps<typeof FinanceFormDialogShell>>).props));
    } else if (child.type === BudgetUI.BudgetGoalsContent) {
      content = withPtIntlDispatcher(() => BudgetUI.BudgetGoalsContent((child as ReactElement<React.ComponentProps<typeof BudgetUI.BudgetGoalsContent>>).props));
    } else if (child.type === MonthlyBudgetUI.BudgetHeader) {
      content = withPtIntlDispatcher(() => MonthlyBudgetUI.BudgetHeader((child as ReactElement<React.ComponentProps<typeof MonthlyBudgetUI.BudgetHeader>>).props));
    }
    const nested = findElement(content, matches);
    if (nested) return nested;
  }
  return undefined;
};

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function exerciseWidget<T>(
  renderComponent: () => ReactNode,
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response>,
  run: (render: () => ReactNode, requests: [string, string, BodyInit | null | undefined][], feedback: Array<{ kind: 'success' | 'error'; message: string }>) => Promise<T>,
) {
  const dispatcher = (React as unknown as { __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown } }).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const { H } = dispatcher;
  const { success, error } = toast;
  const originalFetch = globalThis.fetch;
  const states: unknown[] = [];
  const refs: { current: unknown }[] = [];
  const callbacksState: Array<{ deps?: readonly unknown[]; fn: unknown }> = [];
  const effectsState: Array<{ deps?: readonly unknown[]; cleanup?: () => void }> = [];
  const requests: [string, string, BodyInit | null | undefined][] = [];
  const feedback: Array<{ kind: 'success' | 'error'; message: string }> = [];

  function depsChanged(prev: readonly unknown[] | undefined, next: readonly unknown[] | undefined) {
    return !prev || !next || prev.length !== next.length || next.some((d, j) => !Object.is(d, prev[j]));
  }

  function render() {
    let stateIndex = 0;
    let refIndex = 0;
    let callbackIndex = 0;
    let effectIndex = 0;
    const pendingEffects: Array<{ index: number; effect: () => void | (() => void); deps?: readonly unknown[] }> = [];
    dispatcher.H = {
      useId: () => ':qa-budget:',
      useState(initial: unknown) {
        const i = stateIndex++;
        if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
        return [states[i], (next: unknown) => { states[i] = typeof next === 'function' ? next(states[i]) : next; }];
      },
      useRef: (current: unknown) => (refs[refIndex++] ??= { current }),
      useCallback: (fn: unknown, deps?: readonly unknown[]) => {
        const idx = callbackIndex++;
        const prev = callbacksState[idx];
        if (!prev || depsChanged(prev.deps, deps)) {
          callbacksState[idx] = { deps, fn };
        }
        return callbacksState[idx].fn;
      },
      useMemo: (factory: () => unknown) => factory(),
      useContext: (ctx: React.Context<unknown>) => ptUseContext(ctx),
      useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
        const idx = effectIndex++;
        const prev = effectsState[idx];
        if (!prev || depsChanged(prev.deps, deps)) {
          pendingEffects.push({ index: idx, effect, deps });
        }
      },
    };
    try {
      const view = renderComponent();
      for (const { index, effect, deps } of pendingEffects) {
        effectsState[index]?.cleanup?.();
        const cleanup = effect();
        effectsState[index] = { deps, cleanup: typeof cleanup === 'function' ? cleanup : undefined };
      }
      return view;
    } finally {
      dispatcher.H = H;
    }
  }

  try {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      requests.push([method, url, init?.body]);
      return fetchImpl(url, init);
    }) as typeof fetch;
    toast.success = (msg: unknown) => { feedback.push({ kind: 'success', message: String(msg) }); return 'success'; };
    toast.error = (msg: unknown) => { feedback.push({ kind: 'error', message: String(msg) }); return 'error'; };
    render();
    await settle();
    return await run(render, requests, feedback);
  } finally {
    effectsState.forEach((entry) => entry?.cleanup?.());
    globalThis.fetch = originalFetch;
    toast.success = success;
    toast.error = error;
  }
}

test('BudgetGoalEditor adota FinanceFormDialogShell preservando retorno de foco, rascunho e pendência sem AlertDialog', () => {
  let cancelled = 0;
  let fieldChanged = null as [string, string] | null;
  const onCloseAutoFocus = () => {};
  const onSubmit = async () => {};
  const element = withPtIntlDispatcher(() =>
    BudgetGoalEditor({
      mode: 'edit',
      open: true,
      submitting: true,
      form: {
        name: 'Reserva',
        description: 'Fundo de emergência',
        targetAmount: '5000',
        currentAmount: '1200',
        categoryId: 'cat-1',
        endDate: '2026-12-31',
      },
      categories: [{ id: 'cat-1', name: 'Moradia', color: '#8b5cf6' }],
      onFieldChange: (field, value) => { fieldChanged = [field, value]; },
      onOpenChange: (open) => { if (!open) cancelled++; },
      onCloseAutoFocus,
      onSubmit,
    }),
  );

  expect(element.type).toBe(FinanceFormDialogShell);
  expect(element.props.closeLabel).toBe('Fechar formulário');
  expect(element.props.onCloseAutoFocus).toBe(onCloseAutoFocus);
  expect(findElement(element, (e) => e.type === AlertDialog)).toBeUndefined();
  const dialog = findElement(element, (e) => e.type === Dialog);
  expect(dialog).toBeDefined();
  const content = findElement(element, (e) => e.type === DialogContent);
  expect(content?.props.showCloseButton).toBe(false);
  expect(content?.props.onCloseAutoFocus).toBe(onCloseAutoFocus);
  expect(findElement(element, (e) => React.Children.toArray(e.props.children).includes('Editar Meta'))).toBeDefined();
  const submitBtn = findElement(element, (e) => e.props.onClick === onSubmit);
  expect(submitBtn?.props.disabled).toBe(true);

  const nameInput = findElement(element, (e) => e.props.id === 'goal-name');
  nameInput?.props.onChange({ target: { value: 'Nova Reserva' } });
  expect(fieldChanged).toEqual(['name', 'Nova Reserva']);

  dialog?.props.onOpenChange(false);
  expect(cancelled).toBe(1);
});

test('MonthlyBudgetEditor adota FinanceFormDialogShell com closeLabel localizado, sem bloquear autoFocus padrão e com w-full nos triggers', () => {
  let closed = 0;
  const onSubmit = async () => {};
  const createEl = withPtIntlDispatcher(() =>
    MonthlyBudgetEditor({
      mode: 'create',
      open: true,
      submitting: false,
      fieldId: ':qa:',
      form: { categoryId: '', amount: '', month: '11', year: '2026' },
      categories: [{ id: 'cat-food', name: 'Alimentação', color: '#22c55e', icon: 'utensils' }],
      years: ['2025', '2026', '2027'],
      onFieldChange: () => {},
      onOpenChange: (open) => { if (!open) closed++; },
      onSubmit,
    }),
  );

  expect(createEl.type).toBe(FinanceFormDialogShell);
  expect(createEl.props.closeLabel).toBe('Fechar formulário');
  const content = findElement(createEl, (e) => e.type === DialogContent);
  expect(content?.props.showCloseButton).toBe(false);
  const fakeEvent = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
  content?.props.onCloseAutoFocus(fakeEvent);
  expect(fakeEvent.defaultPrevented).toBe(false);

  const disabledSubmit = findElement(createEl, (e) => e.props.onClick === onSubmit);
  expect(disabledSubmit?.props.disabled).toBe(true);

  const editEl = withPtIntlDispatcher(() =>
    MonthlyBudgetEditor({
      mode: 'edit',
      open: true,
      submitting: false,
      fieldId: ':qa:',
      form: { categoryId: 'cat-food', amount: '500', month: '11', year: '2026' },
      categories: [{ id: 'cat-food', name: 'Alimentação', color: '#22c55e', icon: 'utensils' }],
      years: ['2025', '2026', '2027'],
      onFieldChange: () => {},
      onOpenChange: (open) => { if (!open) closed++; },
      onSubmit,
    }),
  );
  expect(findElement(editEl, (e) => e.props.onClick === onSubmit)?.props.disabled).toBe(false);
  findElement(editEl, (e) => e.type === Dialog)?.props.onOpenChange(false);
  expect(closed).toBe(1);

  const editorSrc = readFileSync(new URL('./monthly-budget-editor.tsx', import.meta.url), 'utf8');
  for (const match of editorSrc.matchAll(/<SelectTrigger\b[^>]*>/g)) {
    expect(match[0]).toContain('w-full');
  }
});

test('BudgetGoalsWidget preserva diálogo, rascunho e ausência de GET em POST/PUT para 3 classes de falha', async () => {
  const sampleGoal = {
    id: 'g1',
    name: 'Reserva',
    description: 'Inicial',
    targetAmount: 1000,
    currentAmount: 200,
    categoryId: null,
    category: null,
    startDate: '2026-01-01',
    endDate: null,
    isCompleted: false,
  };

  for (const method of ['POST', 'PUT'] as const) {
    for (const failureMode of ['http-json', 'transport', 'invalid-json'] as const) {
      let currentMode = failureMode;
      await exerciseWidget(
        () => BudgetGoalsWidget(),
        async (url, init) => {
          if (!init?.method || init.method === 'GET') {
            if (url === '/api/budgets') return Response.json([sampleGoal]);
            return Response.json([]);
          }
          if (currentMode === 'transport') throw new Error('Falha de rede');
          if (currentMode === 'invalid-json') return new Response('não JSON', { status: 503 });
          return Response.json({ error: 'Erro específico da API' }, { status: 422 });
        },
        async (render, requests, feedback) => {
          const initialGets = requests.filter(([m]) => m === 'GET').length;
          if (method === 'POST') {
            findElement(render(), (e) => e.props.onClick && React.Children.toArray(e.props.children).some((c) => typeof c === 'string' && c.trim() === 'Nova Meta'))!.props.onClick({ currentTarget: null });
          } else {
            findElement(render(), (e) => e.type === BudgetUI.BudgetGoalRow)!.props.onEdit(sampleGoal, null);
          }

          const editor = findElement(render(), (e) => e.type === BudgetGoalEditor)!;
          expect(editor.props.open).toBe(true);
          editor.props.onFieldChange('name', 'Rascunho Meta');
          editor.props.onFieldChange('targetAmount', '2500');

          await findElement(render(), (e) => e.type === BudgetGoalEditor)!.props.onSubmit();
          const afterFail = findElement(render(), (e) => e.type === BudgetGoalEditor)!;
          expect(afterFail.props.open).toBe(true);
          expect(afterFail.props.form.name).toBe('Rascunho Meta');
          expect(afterFail.props.form.targetAmount).toBe('2500');
          expect(requests.filter(([m]) => m === 'GET').length).toBe(initialGets);
          expect(requests.filter(([m]) => m === method).length).toBe(1);
          expect(feedback).toEqual([
            {
              kind: 'error',
              message: failureMode === 'http-json' ? 'Erro específico da API' : 'Erro de conexão',
            },
          ]);
        },
      );
    }
  }
});

test('MonthlyBudgetTracker retém diálogo e rascunho sem GET em HTTP não OK (JSON ou não-JSON) e erro de transporte em POST/PUT', async () => {
  const sampleBudget = {
    id: 'mb-1',
    categoryId: 'cat-food',
    categoryName: 'Alimentação',
    categoryColor: '#22c55e',
    categoryIcon: 'utensils',
    amount: 500,
    spent: 100,
    remaining: 400,
    percentage: 20,
    isOverBudget: false,
  };

  for (const method of ['POST', 'PUT'] as const) {
    for (const failureMode of ['http-json', 'transport', 'invalid-json'] as const) {
      await exerciseWidget(
        () => MonthlyBudgetUI.MonthlyBudgetTracker({ showValues: true, refreshCounter: 0 }),
        async (url, init) => {
          if (!init?.method || init.method === 'GET') {
            if (url.startsWith('/api/monthly-budgets')) return Response.json({ budgets: [sampleBudget] });
            if (url === '/api/categories') return Response.json([{ id: 'cat-food', name: 'Alimentação', color: '#22c55e', icon: 'utensils', type: 'EXPENSE' }]);
            return Response.json([]);
          }
          if (failureMode === 'transport') throw new Error('Falha de rede');
          if (failureMode === 'invalid-json') return new Response('não JSON', { status: 503 });
          return Response.json({ error: 'Limite inválido' }, { status: 400 });
        },
        async (render, requests, feedback) => {
          const initialBudgetGets = requests.filter(([m, u]) => m === 'GET' && u.startsWith('/api/monthly-budgets')).length;
          if (method === 'POST') {
            findElement(render(), (e) => e.type === MonthlyBudgetUI.BudgetHeader)!.props.openCreateDialog();
          } else {
            findElement(render(), (e) => e.props.onEdit && e.props.budget?.id === 'mb-1')!.props.onEdit();
          }

          const editor = findElement(render(), (e) => e.type === MonthlyBudgetEditor)!;
          expect(editor.props.open).toBe(true);
          editor.props.onFieldChange('categoryId', 'cat-food');
          editor.props.onFieldChange('amount', '750');

          await findElement(render(), (e) => e.type === MonthlyBudgetEditor)!.props.onSubmit();
          await settle();

          const after = findElement(render(), (e) => e.type === MonthlyBudgetEditor)!;
          const budgetGets = requests.filter(([m, u]) => m === 'GET' && u.startsWith('/api/monthly-budgets')).length;
          const expectedMessage =
            failureMode === 'http-json'
              ? 'Limite inválido'
              : failureMode === 'invalid-json'
                ? method === 'POST'
                  ? 'Erro ao criar'
                  : 'Erro ao atualizar'
                : 'Erro de conexão';

          expect(after.props.open).toBe(true);
          expect(after.props.form.amount).toBe('750');
          expect(budgetGets).toBe(initialBudgetGets);
          expect(feedback).toEqual([{ kind: 'error', message: expectedMessage }]);
          expect(requests.filter(([m]) => m === method).length).toBe(1);
        },
      );
    }
  }
});

test('GoalsDashboard, SavingsChallenge e AchievementBadges adotam FinanceProgress e preservam critérios, vazio e zero', () => {
  for (const file of ['./goals-dashboard.tsx', './savings-challenge.tsx', './achievement-badges.tsx']) {
    const src = readFileSync(new URL(file, import.meta.url), 'utf8');
    expect(src).toContain("from '@/components/shared/finance-progress'");
  }

  const zeroGoalsHtml = renderToStaticMarkup(
    <GoalsUI.GoalsProgress
      summary={{
        totalGoals: 0,
        completedGoals: 0,
        inProgressGoals: 0,
        totalTargetAmount: 0,
        totalCurrentAmount: 0,
        overallProgress: 0,
        estimatedCompletion: null,
      }}
    />,
  );
  expect(zeroGoalsHtml).toContain('data-slot="progress"');
  expect(hasProgressBar(zeroGoalsHtml, '0', 'Progresso geral das metas')).toBe(true);
  expect(zeroGoalsHtml).toContain('R$ 0,00');

  const savingsZeroHtml = renderToStaticMarkup(
    <SavingsUI.SavingsChallengeContent
      loading={false}
      onRetry={() => {}}
      data={{
        currentMonthSavings: 0,
        dailyAverageExpense: 0,
        projectedMonthExpense: 0,
        projectedSavings: 0,
        savingsRate: 0,
        daysRemaining: 10,
        daysInMonth: 30,
        daysElapsed: 20,
        income: 0,
        totalExpenses: 0,
        todaySpending: 0,
        dailyTarget: 50,
        challengeTargets: [
          { id: 'c1', title: 'Desafio', description: 'Desc', current: 0, target: 100, progress: 0, unit: 'currency' },
        ],
      }}
    />,
  );
  expect(savingsZeroHtml).toContain('data-slot="progress"');
  expect(savingsZeroHtml).toContain('Nenhum gasto ainda');
  expect(hasProgressBar(savingsZeroHtml, '0', 'Uso da meta diária')).toBe(true);
});

test('Task 1.3: MonthlyBudgetTracker handleDelete trata resposta 503 não-JSON com fallback seguro sem releitura', async () => {
  const sampleBudget = {
    id: 'mb-1',
    categoryId: 'cat-food',
    categoryName: 'Alimentação',
    categoryColor: '#22c55e',
    categoryIcon: 'utensils',
    amount: 500,
    spent: 100,
    remaining: 400,
    percentage: 20,
    isOverBudget: false,
  };

  await exerciseWidget(
    () => MonthlyBudgetUI.MonthlyBudgetTracker({ showValues: true, refreshCounter: 0 }),
    async (url, init) => {
      if (!init?.method || init.method === 'GET') {
        if (url.startsWith('/api/monthly-budgets')) return Response.json({ budgets: [sampleBudget] });
        if (url === '/api/categories') return Response.json([{ id: 'cat-food', name: 'Alimentação', color: '#22c55e', icon: 'utensils', type: 'EXPENSE' }]);
        return Response.json([]);
      }
      return new Response('não JSON', { status: 503 });
    },
    async (render, requests, feedback) => {
      const initialGets = requests.filter(([m, u]) => m === 'GET' && u.startsWith('/api/monthly-budgets')).length;
      findElement(render(), (e) => e.props.onDelete && e.props.budget?.id === 'mb-1')!.props.onDelete();

      const deleteDialog = findElement(render(), (e) => e.type === AlertDialog)!;
      expect(deleteDialog.props.open).toBe(true);

      await findElement(render(), (e) => e.type === AlertDialogAction)!.props.onClick({ preventDefault() {} });
      await settle();

      const afterFailDialog = findElement(render(), (e) => e.type === AlertDialog)!;
      expect(afterFailDialog.props.open).toBe(true);
      expect(feedback).toEqual([{ kind: 'error', message: 'Erro ao excluir' }]);
      expect(requests.filter(([m]) => m === 'DELETE')).toHaveLength(1);
      expect(requests.filter(([m, u]) => m === 'GET' && u.startsWith('/api/monthly-budgets')).length).toBe(initialGets);
    },
  );
});

test('renderiza orçamento, metas e saúde financeira em pt, es e en sem chaves cruas', () => {
  const expected = {
    pt: { monthlyTitle: 'Orçamento mensal', goals: 'Metas de orçamento' },
    es: { monthlyTitle: 'Presupuesto mensual', goals: 'Metas de presupuesto' },
    en: { monthlyTitle: 'Monthly budget', goals: 'Budget goals' },
  } as const;

  for (const locale of CANONICAL_LOCALES) {
    const budgetHtml = renderWithIntl(<MonthlyBudgetUI.MonthlyBudgetTracker showValues refreshCounter={0} />, locale);
    expect(budgetHtml).toContain(expected[locale].monthlyTitle);
    expect(budgetHtml).not.toContain('MISSING_MESSAGE');

    const goalsHtml = renderWithIntl(
      <BudgetUI.BudgetGoalsContent
        goals={[]}
        loading={false}
        error={false}
        onRetry={() => {}}
        onCreate={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onToggle={() => {}}
      />,
      locale,
    );
    expect(goalsHtml).toContain(expected[locale].goals);
  }
});

test('desafios, metas, conquistas, saúde financeira e orçamento mascaram valores/percentuais com showValues=false', () => {
  const challengeRowHtml = renderToStaticMarkup(
    <SavingsUI.ChallengeRow
      showValues={false}
      challenge={{
        id: 'daily-spend',
        title: 'Meta R$500.00 / R$ 1.000,00 (0.0%)',
        description: 'Saldo atual R$0.00 de R$1,000.00 com 0.0% concluído',
        current: 20,
        target: 50,
        progress: 40,
        unit: 'currency',
      }}
    />,
  );
  const challengeVisible = challengeRowHtml.replace(/<[^>]+>/g, ' ');
  const challengeAriaLabels = [...challengeRowHtml.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]).join(' ');
  expect(challengeRowHtml).toContain('R$ ••••••');
  expect(challengeRowHtml).toContain('aria-valuetext="•••"');
  expect(challengeVisible).not.toMatch(/20|50|40|500|1\.000|1,000|0\.0|%/);
  expect(challengeAriaLabels).toContain('R$ ••••••');
  expect(challengeAriaLabels).not.toMatch(/\d|%/);

  const challengeVisibleHtml = renderToStaticMarkup(
    <SavingsUI.ChallengeRow
      showValues
      challenge={{
        id: 'daily-spend-visible',
        title: 'Meta R$500.00',
        description: 'Atual R$0.00 (0.0%) até R$1,000.00',
        current: 20,
        target: 50,
        progress: 40,
        unit: 'currency',
      }}
    />,
  );
  expect(challengeVisibleHtml).toContain('Meta R$500.00');
  expect(challengeVisibleHtml).toContain('Atual R$0.00 (0.0%) até R$1,000.00');

  const ChallengeContent = (SavingsUI as Record<string, any>).SavingsChallengeContent;
  const challengeHtml = renderToStaticMarkup(
    <ChallengeContent
      loading={false}
      onRetry={() => {}}
      showValues={false}
      data={{
        currentMonthSavings: 1500, dailyAverageExpense: 45.5, projectedMonthExpense: 1365,
        projectedSavings: 1800, savingsRate: 33, daysRemaining: 10, daysInMonth: 30, daysElapsed: 20,
        income: 3000, totalExpenses: 910, todaySpending: 25, dailyTarget: 60, challengeTargets: [],
      }}
    />,
  );
  expect(challengeHtml).toContain('R$ ••••••');
  expect(challengeHtml).toContain('•••');
  expect(challengeHtml.replace(/<[^>]+>/g, ' ')).not.toMatch(/1\.500|45,50|1\.800|33|25|60/);

  const goalHtml = renderToStaticMarkup(
    <BudgetUI.BudgetGoalRow
      showValues={false}
      goal={{
        id: 'g1', name: 'Meta sintética', description: '', targetAmount: 500, currentAmount: 125,
        categoryId: null, category: null, startDate: '2026-01-01', endDate: null, isCompleted: false,
      }}
      onEdit={() => {}}
      onDelete={() => {}}
      onToggle={() => {}}
    />,
  );
  expect(goalHtml).toContain('R$ ••••••');
  expect(goalHtml).toContain('aria-valuetext="•••"');
  expect(goalHtml.replace(/<[^>]+>/g, ' ')).not.toMatch(/500|125|375|25%/);

  const goalsProgressHtml = renderToStaticMarkup(
    <GoalsUI.GoalsProgress
      showValues={false}
      summary={{ totalGoals: 2, completedGoals: 0, inProgressGoals: 2, totalTargetAmount: 250, totalCurrentAmount: 100, overallProgress: 40, estimatedCompletion: null }}
    />,
  );
  expect(goalsProgressHtml).toContain('R$ ••••••');
  expect(goalsProgressHtml).toContain('aria-valuetext="•••"');
  expect(goalsProgressHtml.replace(/<[^>]+>/g, ' ')).not.toMatch(/250|100|150|40%/);

  const achHtml = renderToStaticMarkup(
    <AchievementUI.AchievementRow
      showValues={false}
      achievement={{
        id: 'a',
        title: 'Reserva R$ 1.000,00 / R$500.00 (0.0%)',
        description: 'Acumulado R$0.00 de R$1,000.00 — 0.0% atingido',
        icon: 'Target',
        category: 'controle',
        unlocked: false,
        progress: 67,
        currentValue: 67,
        targetValue: 100,
        unlockedAt: null,
      }}
    />,
  );
  const achVisible = achHtml.replace(/<[^>]+>/g, ' ');
  const achAriaLabels = [...achHtml.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]).join(' ');
  expect(achHtml).toContain('aria-valuetext="•••"');
  expect(achHtml).toContain('R$ ••••••');
  expect(achVisible).not.toMatch(/67|100|500|1\.000|1,000|0\.0|%/);
  expect(achAriaLabels).toContain('R$ ••••••');
  expect(achAriaLabels).not.toMatch(/\d|%/);

  const achVisibleHtml = renderToStaticMarkup(
    <AchievementUI.AchievementRow
      showValues
      achievement={{
        id: 'a-visible',
        title: 'Reserva R$ 1.000,00',
        description: 'Atual R$0.00 de R$500.00 (0.0%) / R$1,000.00',
        icon: 'Target',
        category: 'controle',
        unlocked: false,
        progress: 67,
        currentValue: 67,
        targetValue: 100,
        unlockedAt: null,
      }}
    />,
  );
  expect(achVisibleHtml).toContain('Reserva R$ 1.000,00');
  expect(achVisibleHtml).toContain('Atual R$0.00 de R$500.00 (0.0%) / R$1,000.00');

  const healthHtml = renderToStaticMarkup(
    <HealthUI.HealthBreakdown
      showValues={false}
      data={{
        totalBalance: 2000, totalCardBalance: 500, totalCardLimit: 2500,
        monthIncome: 3000, monthExpense: 1800,
        recentTransactions: [], recentPurchases: [], expenseByCategory: [], monthlyTrend: [], accountBalances: [],
      }}
    />,
  );
  expect(healthHtml).toContain('R$ ••••••');
  expect(healthHtml).toContain('aria-valuetext="•••"');
  expect(healthHtml.replace(/<[^>]+>/g, ' ')).not.toMatch(/2\.000|3\.000|1\.800|1\.200/);

  const monthlyBudgetMasked = renderToStaticMarkup(<MonthlyBudgetUI.MonthlyBudgetTracker showValues={false} refreshCounter={0} />);
  expect(monthlyBudgetMasked).not.toContain('MISSING_MESSAGE');
});

test('widgets de metas e saúde financeira refazem fetch ao trocar locale sem adicionar ?locale=', async () => {
  const internals = (React as unknown as {
    __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown };
  }).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const previous = internals.H;
  const originalFetch = globalThis.fetch;
  const requested: string[] = [];
  let activeLocale: CanonicalLocale = 'pt';
  const states: unknown[] = [];
  const callbacks: Array<{ deps?: readonly unknown[]; fn: unknown }> = [];
  const effects: Array<{ deps?: readonly unknown[]; cleanup?: () => void }> = [];
  const sameDeps = (a?: readonly unknown[], b?: readonly unknown[]) =>
    Boolean(a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i])));

  const renderHealth = () => {
    let s = 0, c = 0, e = 0;
    const pending: Array<{ idx: number; fn: () => void | (() => void); deps?: readonly unknown[] }> = [];
    internals.H = {
      useState(initial: unknown) {
        const i = s++;
        if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
        return [states[i], (next: unknown) => { states[i] = typeof next === 'function' ? next(states[i]) : next; }];
      },
      useCallback: (fn: unknown, deps?: readonly unknown[]) => {
        const i = c++;
        if (!callbacks[i] || !sameDeps(callbacks[i].deps, deps)) callbacks[i] = { deps, fn };
        return callbacks[i].fn;
      },
      useMemo: (f: () => unknown) => f(),
      useContext: (ctx: React.Context<unknown>) => ptUseContext(ctx, activeLocale),
      useEffect: (fn: () => void | (() => void), deps?: readonly unknown[]) => {
        const i = e++;
        if (!effects[i] || !sameDeps(effects[i].deps, deps)) pending.push({ idx: i, fn, deps });
      },
    };
    const tree = FinancialHealthScore({ showValues: true });
    for (const item of pending) {
      effects[item.idx]?.cleanup?.();
      const cleanup = item.fn();
      effects[item.idx] = { deps: item.deps, cleanup: typeof cleanup === 'function' ? cleanup : undefined };
    }
    return tree;
  };

  try {
    globalThis.fetch = (async (url: string) => {
      requested.push(String(url));
      return Response.json({
        totalBalance: 1000, totalCardBalance: 0, totalCardLimit: 0, monthIncome: 500, monthExpense: 200,
        recentTransactions: [], recentPurchases: [], expenseByCategory: [], monthlyTrend: [], accountBalances: [],
      });
    }) as typeof fetch;

    renderHealth();
    await settle();
    expect(requested).toEqual(['/api/dashboard']);

    activeLocale = 'es';
    renderHealth();
    await settle();
    expect(requested).toEqual(['/api/dashboard', '/api/dashboard']);
    expect(requested.every((url) => !url.includes('locale='))).toBe(true);
  } finally {
    effects.forEach((entry) => entry?.cleanup?.());
    internals.H = previous;
    globalThis.fetch = originalFetch;
  }
});

test('#8 e #13: BudgetGoalEditor e MonthlyBudgetEditor localizam closeLabel nos 3 idiomas e MonthlyBudgetTracker restaura foco no fechamento', async () => {
  const expectedClose = {
    pt: 'Fechar formulário',
    es: 'Cerrar formulario',
    en: 'Close form',
  } as const;

  for (const locale of CANONICAL_LOCALES) {
    const goalEl = withPtIntlDispatcher(
      () =>
        BudgetGoalEditor({
          mode: 'create',
          open: true,
          submitting: false,
          form: { name: '', description: '', targetAmount: '', currentAmount: '0', categoryId: '', endDate: '' },
          categories: [],
          onFieldChange: () => {},
          onOpenChange: () => {},
          onCloseAutoFocus: () => {},
          onSubmit: async () => {},
        }),
      locale,
    );
    expect(goalEl.props.closeLabel).toBe(expectedClose[locale]);

    const budgetEl = withPtIntlDispatcher(
      () =>
        MonthlyBudgetEditor({
          mode: 'create',
          open: true,
          submitting: false,
          fieldId: ':qa:',
          form: { categoryId: '', amount: '', month: '11', year: '2026' },
          categories: [],
          years: ['2026'],
          onFieldChange: () => {},
          onOpenChange: () => {},
          onSubmit: async () => {},
        }),
      locale,
    );
    expect(budgetEl.props.closeLabel).toBe(expectedClose[locale]);
  }

  let focusCalls: string[] = [];
  const createBtn = { isConnected: true, focus: () => focusCalls.push('create') } as unknown as HTMLButtonElement;
  const rowMenuBtn = { isConnected: true, focus: () => focusCalls.push('row') } as unknown as HTMLButtonElement;
  const disconnectedBtn = { isConnected: false, focus: () => focusCalls.push('disconnected') } as unknown as HTMLButtonElement;

  await exerciseWidget(
    () => MonthlyBudgetUI.MonthlyBudgetTracker({ showValues: true, refreshCounter: 0 }),
    async (url) => {
      if (String(url).startsWith('/api/monthly-budgets')) {
        return Response.json({
          budgets: [
            { id: 'mb-1', categoryId: 'cat-1', categoryName: 'Moradia', categoryColor: '#8b5cf6', categoryIcon: 'home', amount: 1000, spent: 200, remaining: 800, percentage: 20, isOverBudget: false },
          ],
        });
      }
      if (String(url).startsWith('/api/categories')) {
        return Response.json([{ id: 'cat-1', name: 'Moradia', color: '#8b5cf6', icon: 'home', type: 'EXPENSE' }]);
      }
      throw new Error(`Unexpected GET ${url}`);
    },
    async (render) => {
      await settle();
      const tree = render();
      const header = findElement(tree, (e) => e.type === MonthlyBudgetUI.BudgetHeader)!;
      const createRef = header.props.createButtonRef as { current: HTMLButtonElement | null };
      createRef.current = createBtn;

      // 1) Abrir pelo gatilho da linha -> restaura foco ao gatilho da linha conectado
      const row = findElement(tree, (e) => typeof e.type === 'function' && e.type.name === 'BudgetRow')!;
      row.props.onEdit(rowMenuBtn);
      const editorAfterRow = findElement(render(), (e) => e.type === MonthlyBudgetEditor)!;
      expect(typeof editorAfterRow.props.onCloseAutoFocus).toBe('function');
      const rowEvt = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
      editorAfterRow.props.onCloseAutoFocus(rowEvt);
      expect(rowEvt.defaultPrevented).toBe(true);
      expect(focusCalls).toEqual(['row']);

      // 2) Se gatilho desconectado, faz fallback ao createButtonRef conectado
      focusCalls = [];
      row.props.onEdit(disconnectedBtn);
      const editorAfterDisconnect = findElement(render(), (e) => e.type === MonthlyBudgetEditor)!;
      const fallbackEvt = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
      editorAfterDisconnect.props.onCloseAutoFocus(fallbackEvt);
      expect(fallbackEvt.defaultPrevented).toBe(true);
      expect(focusCalls).toEqual(['create']);
    },
  );
});
