'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FinanceMetric } from '@/components/shared/finance-metric';
import { FinanceProgress } from '@/components/shared/finance-progress';
import { useSafeLocale, useSafeTranslations } from '@/i18n/provider';
import { currencyFmt, dateFmt } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { INVESTMENT_TYPE_KEYS, SAVINGS_TYPE_KEYS } from './analytics-i18n';

interface Summary {
  totalGoals: number;
  completedGoals: number;
  inProgressGoals: number;
  totalTargetAmount: number;
  totalCurrentAmount: number;
  overallProgress: number;
  estimatedCompletion: string | null;
}

interface BudgetGoalItem {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  progress: number;
  isCompleted: boolean;
  categoryName: string | null;
  categoryColor: string | null;
  startDate: string;
  endDate: string | null;
}

interface SavingsGoalItem {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  progress: number;
  isCompleted: boolean;
  monthlyContribution: number;
  type: string;
  color: string;
  startDate: string;
  targetDate: string | null;
  yieldRate: number;
}

interface InvestmentItem {
  id: string;
  name: string;
  type: string;
  currentAmount: number;
  totalInvested: number;
  returnRate: number;
  progress: number;
  ticker: string | null;
}

interface DashboardData {
  summary: Summary;
  budgetGoals: BudgetGoalItem[];
  savingsGoals: SavingsGoalItem[];
  investments: InvestmentItem[];
}

type ProgressLevelKey = 'excellent' | 'good' | 'inProgress' | 'start';

function getProgressLevelKey(value: number): ProgressLevelKey {
  if (value >= 90) return 'excellent';
  if (value >= 60) return 'good';
  if (value >= 25) return 'inProgress';
  return 'start';
}

interface CombinedGoal {
  id: string;
  source: 'budget' | 'savings';
  name: string;
  progress: number;
  isCompleted: boolean;
  currentAmount: number;
  targetAmount: number;
  categoryName: string | null;
  categoryColor: string | null;
  monthlyContribution: number;
  startDate: string;
  endDate: string | null;
  targetDate: string | null;
  type: string;
}

const panel = 'min-w-0 space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5';
const amount = 'break-words font-mono text-sm font-semibold tabular-nums';

export function GoalCategoryLabel({ color, label }: { color: string | null; label: string }) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-muted-foreground">
      {color && <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full border border-border" style={{ backgroundColor: color }} />}
      <span className="min-w-0 break-words">{label}</span>
    </span>
  );
}

export function GoalsProgress({ summary, showValues = true }: { summary: Summary; showValues?: boolean }) {
  const t = useSafeTranslations('goals');
  const locale = useSafeLocale();
  const maskedValue = t('maskedValue');
  const width = Math.min(100, Math.max(0, summary.overallProgress));
  const summaryMetrics = [
    [t('dashboard.progress.accumulated'), summary.totalCurrentAmount],
    [t('dashboard.progress.targetTotal'), summary.totalTargetAmount],
    [t('dashboard.progress.remaining'), Math.max(summary.totalTargetAmount - summary.totalCurrentAmount, 0)],
  ] as const;

  return (
    <div className="space-y-2 rounded-md border border-border px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-medium">{t('dashboard.progress.title')}</h3>
        <p className="text-xs">
          {t(`dashboard.progress.levels.${getProgressLevelKey(summary.overallProgress)}`)} ·{' '}
          <span className={amount}>{showValues ? `${Math.round(summary.overallProgress)}%` : '•••'}</span>
        </p>
      </div>
      <FinanceProgress
        label={t('dashboard.progress.ariaLabel')}
        value={width}
        min={0}
        max={100}
        unit="%"
        valueText={showValues ? `${Math.round(summary.overallProgress)}%` : '•••'}
        showHeader={false}
      />
      <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        {summaryMetrics.map(([label, value]) => (
          <FinanceMetric key={label} variant="compact" label={label} value={currencyFmt(value, locale)} showValues={showValues} maskedValue={maskedValue} valueClassName="text-sm" />
        ))}
      </dl>
      {summary.estimatedCompletion && (
        <p className="text-xs text-muted-foreground">
          {t('dashboard.progress.estimatedCompletion', { date: summary.estimatedCompletion })}
        </p>
      )}
    </div>
  );
}

function CombinedGoalRow({ goal, isExpanded, onToggleExpand, showValues = true }: {
  goal: CombinedGoal;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  showValues?: boolean;
}) {
  const t = useSafeTranslations('goals');
  const locale = useSafeLocale();
  const maskedValue = t('maskedValue');
  const money = (v: number) => (showValues ? currencyFmt(v, locale) : maskedValue);
  const width = Math.min(100, Math.max(0, goal.progress));
  const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);
  const deadline = goal.endDate || goal.targetDate;

  return (
    <li className="min-w-0 space-y-2 py-3">
      <Button variant="ghost" type="button" aria-expanded={isExpanded} onClick={() => onToggleExpand(goal.id)} className="h-auto min-h-9 w-full justify-between whitespace-normal px-2 py-1.5 text-left">
        <span className="min-w-0 break-words">{goal.name}</span><ChevronDown aria-hidden="true" className={cn(isExpanded && 'rotate-180')} />
      </Button>
      <div className="space-y-1.5 px-2 text-xs">
        <div className="flex flex-wrap justify-between gap-x-2">
          <p className="flex min-w-0 flex-wrap gap-x-2 gap-y-1 break-words">
            <span>{goal.isCompleted ? t('dashboard.combined.completed') : t('dashboard.combined.inProgress')}</span>
            {goal.source === 'budget' && <span className="text-muted-foreground">{t('dashboard.budgetTag')}</span>}
            {goal.categoryName && <GoalCategoryLabel color={goal.categoryColor} label={goal.categoryName} />}
          </p>
          <span className="font-mono tabular-nums">{showValues ? `${Math.round(goal.progress)}%` : '•••'}</span>
        </div>
        <FinanceProgress
          label={t('dashboard.combined.progressAria', { name: goal.name })}
          value={width}
          min={0}
          max={100}
          unit="%"
          valueText={showValues ? `${Math.round(goal.progress)}%` : '•••'}
          showHeader={false}
        />
        <p className="break-words text-muted-foreground">
          {t('dashboard.combined.currentAndTarget', {
            current: money(goal.currentAmount),
            target: money(goal.targetAmount),
          })}
        </p>
      </div>
      {isExpanded && (
        <dl className="grid grid-cols-2 gap-2 border-t border-border px-2 pt-2 text-xs sm:grid-cols-4">
          <FinanceMetric variant="compact" label={t('dashboard.combined.remaining')} value={currencyFmt(remaining, locale)} showValues={showValues} maskedValue={maskedValue} valueClassName="text-sm" />
          {goal.monthlyContribution > 0 && (
            <FinanceMetric
              variant="compact"
              label={t('dashboard.combined.monthlyContribution')}
              value={t('dashboard.combined.perMonth', { value: currencyFmt(goal.monthlyContribution, locale) })}
              caption={remaining > 0 ? t('dashboard.combined.approxMonths', { count: Math.ceil(remaining / goal.monthlyContribution) }) : undefined}
              showValues={showValues}
              maskedValue={maskedValue}
              valueClassName="text-sm"
            />
          )}
          {goal.startDate && <div><dt className="text-muted-foreground">{t('dashboard.combined.startDate')}</dt><dd>{dateFmt(goal.startDate, locale)}</dd></div>}
          {deadline && <div><dt className="text-muted-foreground">{t('dashboard.combined.deadline')}</dt><dd>{dateFmt(deadline, locale)}</dd></div>}
        </dl>
      )}
    </li>
  );
}

function GoalInvestmentRow({ inv, showValues = true }: { inv: InvestmentItem; showValues?: boolean }) {
  const t = useSafeTranslations('goals');
  const locale = useSafeLocale();
  const maskedValue = t('maskedValue');
  const typeKey = INVESTMENT_TYPE_KEYS[inv.type] || 'other';
  const isPositive = inv.returnRate >= 0;
  const profit = inv.currentAmount - inv.totalInvested;
  return (
    <li className="grid min-w-0 gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-4">
      <div className="min-w-0">
        <h3 className="break-words text-sm font-medium">{inv.name}</h3>
        <p className="break-words text-xs text-muted-foreground">
          {t(`dashboard.investmentTypes.${typeKey}`)}{inv.ticker && ` · ${inv.ticker}`}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <FinanceMetric variant="compact" label={t('dashboard.investmentsList.currentValue')} value={currencyFmt(inv.currentAmount, locale)} showValues={showValues} maskedValue={maskedValue} valueClassName="text-sm" />
        <FinanceMetric variant="compact" label={t('dashboard.investmentsList.invested')} value={currencyFmt(inv.totalInvested, locale)} showValues={showValues} maskedValue={maskedValue} valueClassName="text-sm" />
        <FinanceMetric variant="compact" label={t('dashboard.investmentsList.result')} value={`${profit >= 0 ? '+' : ''}${currencyFmt(profit, locale)}`} showValues={showValues} maskedValue={maskedValue} valueClassName="text-sm" />
        <FinanceMetric variant="compact" label={t('dashboard.investmentsList.returnRate')} value={`${isPositive ? '+' : ''}${inv.returnRate.toFixed(1)}%`} showValues={showValues} maskedValue="•••" valueClassName="text-sm" />
      </dl>
    </li>
  );
}

export function GoalsDashboard({ showValues = true }: { showValues?: boolean } = {}) {
  const locale = useSafeLocale();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/goals-dashboard');
      if (res.ok) {
        setData(await res.json());
      } else {
        setData(null);
      }
    } catch (e) {
      console.error('Erro ao carregar central de metas', e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void locale;
    fetchData();
  }, [fetchData, locale]);

  return (
    <GoalsDashboardContent
      data={data}
      loading={loading}
      expandedGoal={expandedGoal}
      onToggleExpand={(id) => setExpandedGoal((prev) => (prev === id ? null : id))}
      onRetry={fetchData}
      showValues={showValues}
    />
  );
}

export function GoalsDashboardContent({
  data,
  loading,
  expandedGoal,
  onToggleExpand,
  onRetry,
  showValues = true,
}: {
  data: DashboardData | null;
  loading: boolean;
  expandedGoal: string | null;
  onToggleExpand: (id: string) => void;
  onRetry: () => void;
  showValues?: boolean;
}) {
  const t = useSafeTranslations('goals');
  const locale = useSafeLocale();
  const maskedValue = t('maskedValue');
  const money = (v: number) => (showValues ? currencyFmt(v, locale) : maskedValue);

  if (loading) {
    return (
      <section data-qa="quiet-goals-dashboard" aria-label={t('dashboard.title')} aria-busy="true" className={panel}>
        <h2 className="font-semibold">{t('dashboard.title')}</h2>
        <p role="status" className="text-sm text-muted-foreground">{t('dashboard.loading')}</p>
      </section>
    );
  }
  if (!data) {
    return (
      <section data-qa="quiet-goals-dashboard" aria-label={t('dashboard.title')} className={panel}>
        <h2 className="font-semibold">{t('dashboard.title')}</h2>
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
          <p role="alert" className="text-sm text-muted-foreground">{t('dashboard.error')}</p>
          <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={onRetry}>{t('common.retry')}</Button>
        </div>
      </section>
    );
  }

  const { summary, budgetGoals, savingsGoals, investments } = data;
  const resolveSavingsLabel = (type: string) => {
    const key = SAVINGS_TYPE_KEYS[type];
    return key ? t(`dashboard.savingsTypes.${key}`) : type;
  };

  const combinedGoals: CombinedGoal[] = [
    ...budgetGoals.map((g) => ({
      id: g.id,
      source: 'budget' as const,
      name: g.name,
      progress: g.progress,
      isCompleted: g.isCompleted,
      currentAmount: g.currentAmount,
      targetAmount: g.targetAmount,
      categoryName: g.categoryName,
      categoryColor: g.categoryColor,
      monthlyContribution: 0,
      startDate: g.startDate,
      endDate: g.endDate,
      targetDate: g.endDate,
      type: 'budget',
    })),
    ...savingsGoals.map((g) => ({
      id: g.id,
      source: 'savings' as const,
      name: g.name,
      progress: g.progress,
      isCompleted: g.isCompleted,
      currentAmount: g.currentAmount,
      targetAmount: g.targetAmount,
      categoryName: resolveSavingsLabel(g.type),
      categoryColor: g.color,
      monthlyContribution: g.monthlyContribution,
      startDate: g.startDate,
      endDate: null,
      targetDate: g.targetDate,
      type: g.type,
    })),
  ].sort((a, b) => a.progress - b.progress);

  const recentGoals = [
    ...budgetGoals.map((g) => ({ ...g, source: 'budget' as const })),
    ...savingsGoals.map((g) => ({ ...g, source: 'savings' as const })),
  ].slice(0, 3);

  const investmentResult = investments.reduce((s, i) => s + (i.currentAmount - i.totalInvested), 0);
  const topMetrics = [
    [t('dashboard.metrics.totalGoals'), summary.totalGoals, true],
    [t('dashboard.metrics.inProgress'), summary.inProgressGoals, true],
    [t('dashboard.metrics.completed'), summary.completedGoals, true],
    [t('dashboard.metrics.totalAccumulated'), currencyFmt(summary.totalCurrentAmount, locale), showValues],
  ] as const;

  return (
    <section data-qa="quiet-goals-dashboard" aria-label={t('dashboard.title')} className={panel}>
      <header><h2 className="font-semibold">{t('dashboard.title')}</h2><p className="text-xs text-muted-foreground">{t('dashboard.subtitle')}</p></header>
      <dl className="grid grid-cols-2 gap-3 border-y border-border py-3 text-xs sm:grid-cols-4">
        {topMetrics.map(([label, value, visible]) => (
          <FinanceMetric key={label} variant="compact" label={label} value={value} showValues={visible} maskedValue={maskedValue} valueClassName="text-sm" />
        ))}
      </dl>
      <Tabs defaultValue="overview" className="min-w-0">
        <TabsList aria-label={t('dashboard.tabsAria')} className="grid h-auto w-full grid-cols-3">
          <TabsTrigger value="overview" className="min-h-9 whitespace-normal text-center text-xs">{t('dashboard.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="goals" className="min-h-9 whitespace-normal text-center text-xs">{t('dashboard.tabs.goals')}</TabsTrigger>
          <TabsTrigger value="investments" className="min-h-9 whitespace-normal text-center text-xs">{t('dashboard.tabs.investments')}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="min-w-0 space-y-4 pt-2">
          <GoalsProgress summary={summary} showValues={showValues} />
          <dl aria-label={t('dashboard.groupsAria')} className="grid grid-cols-2 gap-3 border-b border-border pb-3 text-xs sm:grid-cols-4">
            <FinanceMetric variant="compact" label={t('dashboard.groups.budgetGoals')} value={currencyFmt(budgetGoals.reduce((s, g) => s + g.currentAmount, 0), locale)} caption={t('dashboard.groups.goalsCount', { count: budgetGoals.length })} showValues={showValues} maskedValue={maskedValue} valueClassName="text-sm" />
            <FinanceMetric variant="compact" label={t('dashboard.groups.savings')} value={currencyFmt(savingsGoals.reduce((s, g) => s + g.currentAmount, 0), locale)} caption={t('dashboard.groups.goalsCount', { count: savingsGoals.length })} showValues={showValues} maskedValue={maskedValue} valueClassName="text-sm" />
            <FinanceMetric variant="compact" label={t('dashboard.groups.investments')} value={currencyFmt(investments.reduce((s, i) => s + i.currentAmount, 0), locale)} caption={t('dashboard.groups.investmentsCount', { count: investments.length })} showValues={showValues} maskedValue={maskedValue} valueClassName="text-sm" />
            <FinanceMetric variant="compact" label={t('dashboard.groups.investmentResult')} value={currencyFmt(investmentResult, locale)} showValues={showValues} maskedValue={maskedValue} valueClassName="text-sm" />
          </dl>
          <div className="space-y-1">
            <h3 className="text-sm font-medium">{t('dashboard.recentTitle')}</h3>
            {recentGoals.length === 0 ? <p className="text-sm text-muted-foreground">{t('dashboard.recentEmpty')}</p> : (
              <ul className="divide-y divide-border">
                {recentGoals.map((goal) => (
                  <li key={goal.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,auto)] gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="break-words font-medium">{goal.name}</p>
                      <p className="text-xs text-muted-foreground">
                        <GoalCategoryLabel
                          color={goal.source === 'budget' ? goal.categoryColor : goal.color}
                          label={goal.source === 'budget' ? t('dashboard.budgetGoalLabel') : (SAVINGS_TYPE_KEYS[goal.type] ? resolveSavingsLabel(goal.type) : t('dashboard.savingsGoalLabel'))}
                        />
                      </p>
                    </div>
                    <div className="min-w-0 text-right"><p className={amount}>{money(goal.currentAmount)}</p><p className="font-mono text-xs tabular-nums">{showValues ? `${Math.round(goal.progress)}%` : '•••'}</p></div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>
        <TabsContent value="goals" className="min-w-0 pt-2">
          {combinedGoals.length === 0 ? <p className="py-2 text-sm text-muted-foreground">{t('dashboard.combined.empty')}</p> : (
            <ul className="divide-y divide-border">
              {combinedGoals.map((goal) => (
                <CombinedGoalRow
                  key={goal.id}
                  goal={goal}
                  isExpanded={expandedGoal === goal.id}
                  onToggleExpand={onToggleExpand}
                  showValues={showValues}
                />
              ))}
            </ul>
          )}
        </TabsContent>
        <TabsContent value="investments" className="min-w-0 pt-2">
          {investments.length === 0 ? <p className="py-2 text-sm text-muted-foreground">{t('dashboard.investmentsList.empty')}</p> : (
            <ul className="divide-y divide-border">
              {investments.map((inv) => (
                <GoalInvestmentRow key={inv.id} inv={inv} showValues={showValues} />
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
