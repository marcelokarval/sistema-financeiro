'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { QueryPanel } from '@/components/shared/query-panel';
import { useSafeLocale, useSafeTranslations } from '@/i18n/provider';
import { currencyFmt } from '@/lib/helpers';
import { cn } from '@/lib/utils';

// --- Types ---
interface QuickStatsData {
  current: {
    totalBalance: number;
    cardDebt: number;
    investments: number;
    savingsGoals: number;
    netWorth: number;
    monthlyIncome: number;
    monthlyExpense: number;
    monthlySavings: number;
    savingsRate: number;
  };
  sparklines: {
    balance: number[];
    income: number[];
    expense: number[];
  };
  monthlySavingsHistory?: number[];
  investmentsHistory?: number[];
  cardDebtHistory?: number[];
  changes: {
    incomeVsLastMonth: number;
    expenseVsLastMonth: number;
    savingsVsLastMonth: number;
  };
}

function MiniSparkline({ data, strokeColor, label }: { data: number[]; strokeColor: string; label: string }) {
  if (!data.length) return null;
  const chartData = data.map((v, i) => ({ v, i }));
  return (
    <figure className="min-w-0 space-y-1">
      <figcaption className="text-xs text-muted-foreground">{label}</figcaption>
      <div aria-hidden="true">
        <ResponsiveContainer width="100%" height={24}>
          <AreaChart data={chartData} accessibilityLayer={false} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <Area type="monotone" dataKey="v" stroke={strokeColor} strokeWidth={1.5} fill="none" dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

function ChangeIndicator({ change }: { change: number }) {
  const t = useSafeTranslations('dashboard');
  if (change === 0) return null;
  return (
    <span className="text-xs text-muted-foreground">
      <span className="font-mono tabular-nums">{change > 0 ? '+' : '−'}{Math.abs(change).toFixed(1)}%</span> {t('quickStats.vsLastMonth')}
    </span>
  );
}

function StatCard({ label, value, badge, sparklineData, sparklineStroke, sparklineLabel, change }: {
  label: string; value: string; badge?: string; sparklineData: number[]; sparklineStroke: string; sparklineLabel: string; change?: number;
}) {
  return (
    <div className="min-w-0 space-y-2 border-t border-border px-3 py-3 sm:px-4">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="space-y-2">
        <p className="break-words font-mono text-base font-semibold tabular-nums">{value}</p>
        {badge && <p className="text-xs text-muted-foreground">{badge}</p>}
        {change !== undefined && <ChangeIndicator change={change} />}
        <MiniSparkline data={sparklineData} strokeColor={sparklineStroke} label={sparklineLabel} />
      </dd>
    </div>
  );
}

// --- Health Bar ---
function HealthBar({ savingsRate, balanceTrend }: { savingsRate: number; balanceTrend: 'up' | 'down' | 'stable' }) {
  const t = useSafeTranslations('dashboard');
  // Color logic: <0% red, 0-15% amber, 15-30% cyan, >30% emerald
  const barColor =
    savingsRate < 0
      ? 'bg-[var(--ds-accent-danger)]'
      : savingsRate < 15
        ? 'bg-[var(--ds-accent-warning)]'
        : savingsRate < 30
          ? 'bg-[var(--ds-accent-info)]'
          : 'bg-[var(--ds-accent-positive)]';

  const clampedRate = Math.max(-100, Math.min(100, savingsRate));
  // Map to 0-100 for bar width (0% → 50%, 30% → 80%, 50%+ → 100%, -30% → 20%)
  const barWidth = Math.max(4, Math.min(100, 50 + (clampedRate / 50) * 50));

  const trendLabel =
    balanceTrend === 'up'
      ? t('quickStats.health.trendUp')
      : balanceTrend === 'down'
        ? t('quickStats.health.trendDown')
        : t('quickStats.health.trendStable');

  const TrendIcon =
    balanceTrend === 'up'
      ? TrendingUp
      : balanceTrend === 'down'
        ? TrendingDown
        : Activity;

  const trendColor =
    balanceTrend === 'up'
      ? 'text-[var(--ds-accent-positive)]'
      : balanceTrend === 'down'
        ? 'text-destructive'
        : 'text-muted-foreground';

  return (
    <div className="border-t border-border px-3 py-3 sm:px-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          {t('quickStats.health.title')}
        </span>
        <div className="flex items-center gap-1.5">
          <TrendIcon className={cn('w-3.5 h-3.5', trendColor)} />
          <span className={cn('text-[11px] font-medium', trendColor)}>{trendLabel}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div aria-hidden="true" className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={cn('h-full rounded-full', barColor)} style={{ width: `${barWidth}%` }} />
        </div>
        <span className="text-[11px] font-bold tabular-nums text-muted-foreground min-w-[40px] text-right">
          {savingsRate.toFixed(1)}%
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1.5">
        {t('quickStats.health.recommendedTarget')}
      </p>
    </div>
  );
}

// --- Main Component ---
export function QuickStatsOverview({ refreshCounter = 0 }: { refreshCounter?: number }) {
  const t = useSafeTranslations('dashboard');
  const [data, setData] = useState<QuickStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/quick-stats');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        setData(null);
      }
    } catch (e) {
      setData(null);
      console.error('Failed to load quick stats:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, refreshCounter]);

  if (loading || !data) {
    return (
      <QueryPanel
        titleId="quiet-quick-stats"
        title={t('quickStats.title')}
        status={loading ? 'loading' : 'error'}
        loadingMessage={t('quickStats.loading')}
        errorMessage={t('quickStats.error')}
        retryLabel={t('retry')}
        onRetry={() => void fetchStats()}
      />
    );
  }

  return <QuickStatsPanel data={data} />;
}

export function QuickStatsPanel({ data }: { data: QuickStatsData }) {
  const t = useSafeTranslations('dashboard');
  const locale = useSafeLocale();
  const { current, sparklines, changes } = data;
  const hasSavingsHistory = Array.isArray(data.monthlySavingsHistory) && data.monthlySavingsHistory.length > 0;
  const hasInvestmentsHistory = Array.isArray(data.investmentsHistory) && data.investmentsHistory.length > 0;
  const hasCardDebtHistory = Array.isArray(data.cardDebtHistory) && data.cardDebtHistory.length > 0;

  // Determine balance trend from last 2 sparkline points
  const bal = sparklines.balance;
  const balanceTrend: 'up' | 'down' | 'stable' =
    bal.length >= 2
      ? bal[bal.length - 1] > bal[bal.length - 2]
        ? 'up'
        : bal[bal.length - 1] < bal[bal.length - 2]
          ? 'down'
          : 'stable'
      : 'stable';

  const investmentPct =
    current.netWorth !== 0
      ? Math.round((current.investments / Math.abs(current.netWorth)) * 100)
      : 0;

  const statsConfig = [
    {
      key: 'netWorth',
      label: t('quickStats.metrics.netWorth'),
      value: currencyFmt(current.netWorth, locale),
      badge: t('quickStats.badges.currentPosition'),
      sparklineData: sparklines.balance,
      sparklineStroke: 'var(--primary)',
      sparklineLabel: t('quickStats.sparklines.balance'),
      change: undefined,
    },
    {
      key: 'monthlyIncome',
      label: t('quickStats.metrics.monthlyIncome'),
      value: currencyFmt(current.monthlyIncome, locale),
      sparklineData: sparklines.income,
      sparklineStroke: 'var(--ds-accent-positive)',
      sparklineLabel: t('quickStats.sparklines.income'),
      change: changes.incomeVsLastMonth,
    },
    {
      key: 'monthlyExpense',
      label: t('quickStats.metrics.monthlyExpense'),
      value: currencyFmt(current.monthlyExpense, locale),
      sparklineData: sparklines.expense,
      sparklineStroke: 'var(--ds-accent-danger)',
      sparklineLabel: t('quickStats.sparklines.expense'),
      change: changes.expenseVsLastMonth,
    },
    {
      key: 'monthlySavings',
      label: t('quickStats.metrics.monthlySavings'),
      value: currencyFmt(current.monthlySavings, locale),
      badge: t('quickStats.badges.savingsRate', { rate: current.savingsRate.toFixed(1) }),
      sparklineData: hasSavingsHistory
        ? data.monthlySavingsHistory!
        : sparklines.balance.map((_, i, arr) => {
            if (i === 0) return 0;
            return arr[i] - arr[i - 1];
          }),
      sparklineStroke: 'var(--primary)',
      sparklineLabel: hasSavingsHistory ? t('quickStats.sparklines.savingsHistory') : t('quickStats.sparklines.savingsEstimate'),
      change: changes.savingsVsLastMonth,
    },
    {
      key: 'investments',
      label: t('quickStats.metrics.investments'),
      value: currencyFmt(current.investments, locale),
      badge: current.netWorth !== 0 ? t('quickStats.badges.investmentPct', { pct: investmentPct }) : undefined,
      sparklineData: hasInvestmentsHistory
        ? data.investmentsHistory!
        : sparklines.balance.map((_, i) => Math.round((current.investments / 6) * (i + 1))),
      sparklineStroke: 'var(--primary)',
      sparklineLabel: hasInvestmentsHistory ? t('quickStats.sparklines.investmentsHistory') : t('quickStats.sparklines.investmentsEstimate'),
      change: undefined,
    },
    {
      key: 'cardDebt',
      label: t('quickStats.metrics.cardDebt'),
      value: currencyFmt(current.cardDebt, locale),
      sparklineData: hasCardDebtHistory
        ? data.cardDebtHistory!
        : sparklines.expense.map((v) => Math.round(v * 0.6 * 100) / 100),
      sparklineStroke: 'var(--ds-accent-warning)',
      sparklineLabel: hasCardDebtHistory ? t('quickStats.sparklines.cardDebtHistory') : t('quickStats.sparklines.cardDebtEstimate'),
      change: undefined,
    },
  ];

  return (
    <QueryPanel
      titleId="quiet-quick-stats"
      title={t('quickStats.title')}
      subtitle={t('quickStats.subtitle')}
      status="success"
      contentClassName="space-y-0 p-0 sm:p-0"
    >
      <dl className="grid grid-cols-2 sm:grid-cols-3 sm:[&>div:not(:nth-child(3n+1))]:border-l max-sm:[&>div:nth-child(even)]:border-l">
        {statsConfig.map(({ key, ...stat }) => <StatCard key={key} {...stat} />)}
      </dl>
      <HealthBar savingsRate={current.savingsRate} balanceTrend={balanceTrend} />
    </QueryPanel>
  );
}
