'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { FinanceMetric } from '@/components/shared/finance-metric';
import { FinanceProgress } from '@/components/shared/finance-progress';
import { useSafeLocale, useSafeTranslations } from '@/i18n/provider';
import { currencyFmt } from '@/lib/helpers';

type ScoreLabelKey = 'excellent' | 'good' | 'regular' | 'attention' | 'critical';

function getScoreLabelKey(score: number): ScoreLabelKey {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'regular';
  if (score >= 30) return 'attention';
  return 'critical';
}

// --- Scoring functions ---
interface ScoreBreakdown {
  savingsPoints: number;
  savingsMax: number;
  savingsDetail: { key: 'savingsRate'; rate: string } | { key: 'noIncome' };
  creditPoints: number;
  creditMax: number;
  creditDetail: { key: 'creditUsed'; rate: string } | { key: 'noCards' };
  diversificationPoints: number;
  diversificationMax: number;
  accountCount: number;
  netWorthPoints: number;
  netWorthMax: number;
  netWorth: number;
  trendPoints: number;
  trendMax: number;
  trendDetail:
    | { key: 'expensesLower' | 'expensesHigher'; pct: string }
    | { key: 'expensesStable' | 'insufficientData' };
}

function calculateScore(data: DashboardData): { total: number; breakdown: ScoreBreakdown } {
  const income = data.monthIncome;
  const expense = data.monthExpense;
  const totalCardBalance = data.totalCardBalance;
  const totalCardLimit = data.totalCardLimit;
  const totalBalance = data.totalBalance;
  const accountCount = data.accountBalances.length;
  const monthlyTrend = data.monthlyTrend;

  // 1. Savings Rate (0-30 points)
  let savingsPoints = 0;
  let savingsDetail: ScoreBreakdown['savingsDetail'] = { key: 'noIncome' };
  if (income > 0) {
    const savingsRate = ((income - expense) / income) * 100;
    if (savingsRate >= 30) {
      savingsPoints = 30;
    } else if (savingsRate > 0) {
      savingsPoints = Math.round((savingsRate / 30) * 30);
    }
    savingsDetail = { key: 'savingsRate', rate: savingsRate.toFixed(0) };
  }

  // 2. Credit Utilization (0-25 points) — lower is better
  let creditPoints = 0;
  let creditDetail: ScoreBreakdown['creditDetail'] = { key: 'noCards' };
  if (totalCardLimit > 0) {
    const utilization = (totalCardBalance / totalCardLimit) * 100;
    creditDetail = { key: 'creditUsed', rate: utilization.toFixed(0) };
    if (utilization <= 10) {
      creditPoints = 25;
    } else if (utilization <= 30) {
      creditPoints = Math.round(25 - ((utilization - 10) / 20) * 7);
    } else if (utilization <= 60) {
      creditPoints = Math.round(18 - ((utilization - 30) / 30) * 8);
    } else if (utilization <= 90) {
      creditPoints = Math.round(10 - ((utilization - 60) / 30) * 8);
    } else {
      creditPoints = Math.max(0, Math.round(2 - ((utilization - 90) / 10) * 2));
    }
  } else {
    creditPoints = 25;
  }

  // 3. Account Diversification (0-15 points)
  let diversificationPoints = 0;
  if (accountCount >= 5) {
    diversificationPoints = 15;
  } else if (accountCount >= 4) {
    diversificationPoints = 13;
  } else if (accountCount >= 3) {
    diversificationPoints = 10;
  } else if (accountCount >= 2) {
    diversificationPoints = 7;
  } else if (accountCount >= 1) {
    diversificationPoints = 4;
  }

  // 4. Positive Net Worth (0-20 points)
  const netWorth = totalBalance - totalCardBalance;
  let netWorthPoints = 0;
  if (income > 0) {
    const ratio = netWorth / income;
    if (ratio >= 6) {
      netWorthPoints = 20;
    } else if (ratio >= 3) {
      netWorthPoints = Math.round(14 + ((ratio - 3) / 3) * 6);
    } else if (ratio >= 1) {
      netWorthPoints = Math.round(8 + ((ratio - 1) / 2) * 6);
    } else if (ratio >= 0) {
      netWorthPoints = Math.round((ratio / 1) * 8);
    }
  } else if (netWorth > 0) {
    netWorthPoints = 12;
  }

  // 5. Recent Trend (0-10 points) — are expenses decreasing?
  let trendPoints = 0;
  let trendDetail: ScoreBreakdown['trendDetail'] = { key: 'insufficientData' };
  if (monthlyTrend.length >= 3) {
    const last3 = monthlyTrend.slice(-3);
    const firstExp = last3[0]?.expense || 0;
    const lastExp = last3[2]?.expense || 0;

    if (firstExp > 0 && lastExp < firstExp) {
      const decreasePercent = ((firstExp - lastExp) / firstExp) * 100;
      if (decreasePercent >= 15) {
        trendPoints = 10;
        trendDetail = { key: 'expensesLower', pct: decreasePercent.toFixed(0) };
      } else if (decreasePercent >= 5) {
        trendPoints = Math.round(6 + ((decreasePercent - 5) / 10) * 4);
        trendDetail = { key: 'expensesLower', pct: decreasePercent.toFixed(0) };
      } else {
        trendPoints = Math.round((decreasePercent / 5) * 6);
        trendDetail = { key: 'expensesStable' };
      }
    } else if (lastExp <= firstExp * 1.05) {
      trendPoints = 4;
      trendDetail = { key: 'expensesStable' };
    } else {
      const increasePercent = ((lastExp - firstExp) / firstExp) * 100;
      trendPoints = 0;
      trendDetail = { key: 'expensesHigher', pct: increasePercent.toFixed(0) };
    }
  } else {
    trendPoints = 5;
  }

  const total = savingsPoints + creditPoints + diversificationPoints + netWorthPoints + trendPoints;

  return {
    total: Math.min(100, Math.max(0, total)),
    breakdown: {
      savingsPoints,
      savingsMax: 30,
      savingsDetail,
      creditPoints,
      creditMax: 25,
      creditDetail,
      diversificationPoints,
      diversificationMax: 15,
      accountCount,
      netWorthPoints,
      netWorthMax: 20,
      netWorth,
      trendPoints,
      trendMax: 10,
      trendDetail,
    },
  };
}

interface DashboardData {
  totalBalance: number;
  totalCardBalance: number;
  totalCardLimit: number;
  monthIncome: number;
  monthExpense: number;
  recentTransactions: Record<string, unknown>[];
  recentPurchases: Record<string, unknown>[];
  expenseByCategory: Record<string, unknown>[];
  monthlyTrend: { month: string; income: number; expense: number }[];
  accountBalances: { accountId: string; accountName: string; accountColor: string; balance: number }[];
}

const panel = 'min-w-0 space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5';

export function HealthBreakdown({ data, showValues = true }: { data: DashboardData; showValues?: boolean }) {
  const t = useSafeTranslations('goals');
  const locale = useSafeLocale();
  const { total: score, breakdown } = calculateScore(data);
  const maskedValue = t('maskedValue');
  const money = (v: number) => (showValues ? currencyFmt(v, locale) : maskedValue);
  const scoreLabel = t(`health.scoreLabels.${getScoreLabelKey(score)}`);
  const savingsLabel = breakdown.savingsDetail.key === 'savingsRate'
    ? t('health.details.savingsRate', { rate: showValues ? breakdown.savingsDetail.rate : '•••' })
    : t('health.details.noIncome');
  const creditLabel = breakdown.creditDetail.key === 'creditUsed'
    ? t('health.details.creditUsed', { rate: showValues ? breakdown.creditDetail.rate : '•••' })
    : t('health.details.noCards');
  const diversificationLabel = showValues
    ? t('health.details.accountsCount', { count: breakdown.accountCount })
    : '•••';
  const netWorthLabel = money(breakdown.netWorth);
  const trendLabel = breakdown.trendDetail.key === 'expensesLower' || breakdown.trendDetail.key === 'expensesHigher'
    ? t(`health.details.${breakdown.trendDetail.key}`, { pct: showValues ? breakdown.trendDetail.pct : '•••' })
    : t(`health.details.${breakdown.trendDetail.key}`);

  const criteria = [
    [t('health.criteria.savings'), breakdown.savingsPoints, breakdown.savingsMax, savingsLabel],
    [t('health.criteria.credit'), breakdown.creditPoints, breakdown.creditMax, creditLabel],
    [t('health.criteria.diversification'), breakdown.diversificationPoints, breakdown.diversificationMax, diversificationLabel],
    [t('health.criteria.netWorth'), breakdown.netWorthPoints, breakdown.netWorthMax, netWorthLabel],
    [t('health.criteria.trend'), breakdown.trendPoints, breakdown.trendMax, trendLabel],
  ] as const;
  const balance = data.monthIncome - data.monthExpense;

  return (
    <>
      <div className="grid min-w-0 gap-4 border-y border-border py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h3 className="text-sm font-medium">{t('health.scoreTitle')}</h3>
            <p className="text-xs">{scoreLabel}</p>
          </div>
          <p className="font-mono text-2xl font-semibold tabular-nums">
            {showValues ? score : '•••'}
            {showValues && <span className="text-sm text-muted-foreground">{t('health.scoreMaxUnit')}</span>}
          </p>
          <FinanceProgress
            label={t('health.scoreProgressLabel')}
            value={score}
            min={0}
            max={100}
            unit={t('health.pointsUnit')}
            valueText={showValues ? t('health.scoreValueText', { score, label: scoreLabel }) : '•••'}
            showHeader={false}
          />
        </div>
        <dl aria-label={t('health.monthlySummaryAria')} className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 sm:border-l sm:border-border sm:pl-4">
          <FinanceMetric variant="compact" label={t('health.monthlyIncome')} value={currencyFmt(data.monthIncome, locale)} showValues={showValues} maskedValue={maskedValue} valueClassName="text-sm" />
          <FinanceMetric variant="compact" label={t('health.monthlyExpense')} value={currencyFmt(data.monthExpense, locale)} showValues={showValues} maskedValue={maskedValue} valueClassName="text-sm" />
          <FinanceMetric variant="compact" label={balance >= 0 ? t('health.monthlyBalance') : t('health.monthlyDeficit')} value={currencyFmt(balance, locale)} showValues={showValues} maskedValue={maskedValue} valueClassName="text-sm" />
        </dl>
      </div>
      <div>
        <h3 className="text-sm font-medium">{t('health.criteriaTitle')}</h3>
        <dl className="divide-y divide-border text-sm">
          {criteria.map(([label, points, maxPoints, detail]) => (
            <div key={label} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto]">
              <dt className="break-words">{label}</dt>
              <dd className="col-start-1 row-start-2 break-words text-xs text-muted-foreground sm:col-start-2 sm:row-start-1">{detail}</dd>
              <dd className="col-start-2 row-start-1 whitespace-nowrap font-mono text-xs tabular-nums sm:col-start-3">
                {showValues ? t('health.pointsFraction', { points, maxPoints }) : '•••'}
              </dd>
              <dd aria-hidden="true" className="col-span-full">
                <FinanceProgress
                  label={label}
                  value={points}
                  min={0}
                  max={maxPoints}
                  unit={t('health.pointsUnit')}
                  valueText={showValues ? undefined : '•••'}
                  showHeader={false}
                  trackClassName="h-1"
                />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  );
}

export function FinancialHealthScore({ showValues = true }: { showValues?: boolean } = {}) {
  const locale = useSafeLocale();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard');
      if (res.ok) setData(await res.json());
      else setData(null);
    } catch (e) {
      console.error('Erro ao carregar dados da saúde financeira', e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void locale;
    fetchDashboard();
  }, [fetchDashboard, locale]);

  return <FinancialHealthContent data={data} loading={loading} onRetry={fetchDashboard} showValues={showValues} />;
}

export function FinancialHealthContent({
  data,
  loading,
  onRetry,
  showValues = true,
}: {
  data: DashboardData | null;
  loading: boolean;
  onRetry: () => void;
  showValues?: boolean;
}) {
  const t = useSafeTranslations('goals');
  return (
    <section data-qa="quiet-financial-health" aria-label={t('health.title')} aria-busy={loading || undefined} className={panel}>
      <header>
        <h2 className="font-semibold">{t('health.title')}</h2>
        <p className="text-xs text-muted-foreground">{t('health.subtitle')}</p>
      </header>
      {loading ? <p role="status" className="text-sm text-muted-foreground">{t('health.loading')}</p>
        : !data ? (
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
            <p role="alert" className="text-sm text-muted-foreground">{t('health.error')}</p>
            <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={onRetry}>{t('common.retry')}</Button>
          </div>
        ) : <HealthBreakdown data={data} showValues={showValues} />}
    </section>
  );
}
