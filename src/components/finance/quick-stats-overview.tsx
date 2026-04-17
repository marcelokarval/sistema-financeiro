'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  BarChart3,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { currencyFmt } from '@/lib/helpers';

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
  changes: {
    incomeVsLastMonth: number;
    expenseVsLastMonth: number;
    savingsVsLastMonth: number;
  };
}

// --- Animation variants ---
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

const slideIn = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } },
};

const headerVariants = {
  hidden: { opacity: 0, y: -10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } },
};

// --- Mini Sparkline ---
function MiniSparkline({
  data,
  strokeColor,
  fillColor,
}: {
  data: number[];
  strokeColor: string;
  fillColor: string;
}) {
  if (!data.length) return null;

  const chartData = data.map((v, i) => ({ v, i }));

  return (
    <ResponsiveContainer width="100%" height={32}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${strokeColor}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillColor} stopOpacity={0.35} />
            <stop offset="100%" stopColor={fillColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={strokeColor}
          strokeWidth={1.5}
          fill={`url(#grad-${strokeColor})`}
          dot={false}
          isAnimationActive={true}
          animationDuration={800}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// --- Change Indicator ---
function ChangeIndicator({ change }: { change: number }) {
  if (change === 0) return null;
  const isPositive = change > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${
        isPositive ? 'text-emerald-500' : 'text-rose-500'
      }`}
    >
      {isPositive ? (
        <ArrowUpRight className="w-3 h-3" />
      ) : (
        <ArrowDownRight className="w-3 h-3" />
      )}
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}

// --- Stat Card ---
function StatCard({
  label,
  value,
  icon: Icon,
  accentBg,
  accentText,
  badge,
  badgeVariant,
  sparklineData,
  sparklineStroke,
  sparklineFill,
  change,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  accentBg: string;
  accentText: string;
  badge?: string;
  badgeVariant?: string;
  sparklineData: number[];
  sparklineStroke: string;
  sparklineFill: string;
  change?: number;
}) {
  return (
    <motion.div
      variants={itemVariants}
      whileHover={{
        y: -3,
        transition: { type: 'spring', stiffness: 400, damping: 25 },
      }}
      className={`hover-scale-sm`}
    >
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow h-full">
        <CardContent className="p-4">
          {/* Header row */}
          <div className="flex items-center justify-between mb-2.5">
            <div
              className={`w-9 h-9 rounded-xl ${accentBg} flex items-center justify-center`}
            >
              <Icon className={`w-4 h-4 ${accentText}`} />
            </div>
            <div className="flex items-center gap-1.5">
              {badge && (
                <Badge
                  variant="outline"
                  className={`text-[10px] font-semibold border px-1.5 py-0 h-5 ${badgeVariant}`}
                >
                  {badge}
                </Badge>
              )}
              {change !== undefined && <ChangeIndicator change={change} />}
            </div>
          </div>

          {/* Value */}
          <p className="number-ticker text-lg font-bold leading-tight tracking-tight mb-0.5">
            {value}
          </p>

          {/* Label */}
          <p className="text-[11px] text-muted-foreground font-medium mb-2">
            {label}
          </p>

          {/* Sparkline */}
          <MiniSparkline
            data={sparklineData}
            strokeColor={sparklineStroke}
            fillColor={sparklineFill}
          />
        </CardContent>
      </Card>
    </motion.div>
  );
}

// --- Health Bar ---
function HealthBar({ savingsRate, balanceTrend }: { savingsRate: number; balanceTrend: 'up' | 'down' | 'stable' }) {
  // Color logic: <0% red, 0-15% amber, 15-30% cyan, >30% emerald
  const barColor =
    savingsRate < 0
      ? 'bg-rose-500'
      : savingsRate < 15
        ? 'bg-amber-500'
        : savingsRate < 30
          ? 'bg-cyan-500'
          : 'bg-emerald-500';

  const clampedRate = Math.max(-100, Math.min(100, savingsRate));
  // Map to 0-100 for bar width (0% → 50%, 30% → 80%, 50%+ → 100%, -30% → 20%)
  const barWidth = Math.max(4, Math.min(100, 50 + (clampedRate / 50) * 50));

  const trendLabel =
    balanceTrend === 'up'
      ? 'Tendência positiva'
      : balanceTrend === 'down'
        ? 'Tendência negativa'
        : 'Estável';

  const TrendIcon =
    balanceTrend === 'up'
      ? TrendingUp
      : balanceTrend === 'down'
        ? TrendingDown
        : Activity;

  const trendColor =
    balanceTrend === 'up'
      ? 'text-emerald-500'
      : balanceTrend === 'down'
        ? 'text-rose-500'
        : 'text-muted-foreground';

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" className="mt-4 pt-4 border-t border-border/40">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Saúde Financeira
        </span>
        <div className="flex items-center gap-1.5">
          <TrendIcon className={`w-3.5 h-3.5 ${trendColor}`} />
          <span className={`text-[11px] font-medium ${trendColor}`}>{trendLabel}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${barColor}`}
            initial={{ width: 0 }}
            animate={{ width: `${barWidth}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
          />
        </div>
        <span className="text-[11px] font-bold tabular-nums text-muted-foreground min-w-[40px] text-right">
          {savingsRate.toFixed(1)}%
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground/60 mt-1.5">
        Taxa de economia mensal — meta recomendada: 20%+
      </p>
    </motion.div>
  );
}

// --- Loading Skeleton ---
function LoadingSkeleton() {
  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <Skeleton className="w-9 h-9 rounded-xl" />
                <Skeleton className="w-12 h-5 rounded-full" />
              </div>
              <Skeleton className="h-6 w-28 mb-1" />
              <Skeleton className="h-3 w-20 mb-3" />
              <Skeleton className="h-8 w-full rounded" />
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-border/40">
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

// --- Main Component ---
export function QuickStatsOverview() {
  const [data, setData] = useState<QuickStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/quick-stats');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error('Erro ao carregar resumo rápido:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading || !data) {
    return <LoadingSkeleton />;
  }

  const { current, sparklines, changes } = data;

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
      label: 'Patrimônio Líquido',
      value: currencyFmt(current.netWorth),
      icon: Wallet,
      accentBg: 'bg-emerald-500/10',
      accentText: 'text-emerald-600 dark:text-emerald-400',
      badge: 'Total',
      badgeVariant:
        'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      sparklineData: sparklines.balance,
      sparklineStroke: '#10b981',
      sparklineFill: '#10b981',
      change: undefined,
    },
    {
      label: 'Receita Mensal',
      value: currencyFmt(current.monthlyIncome),
      icon: TrendingUp,
      accentBg: 'bg-emerald-500/10',
      accentText: 'text-emerald-600 dark:text-emerald-400',
      sparklineData: sparklines.income,
      sparklineStroke: '#10b981',
      sparklineFill: '#10b981',
      change: changes.incomeVsLastMonth,
    },
    {
      label: 'Despesa Mensal',
      value: currencyFmt(current.monthlyExpense),
      icon: TrendingDown,
      accentBg: 'bg-rose-500/10',
      accentText: 'text-rose-600 dark:text-rose-400',
      sparklineData: sparklines.expense,
      sparklineStroke: '#f43f5e',
      sparklineFill: '#f43f5e',
      change: changes.expenseVsLastMonth,
    },
    {
      label: 'Economia Mensal',
      value: currencyFmt(current.monthlySavings),
      icon: PiggyBank,
      accentBg: 'bg-cyan-500/10',
      accentText: 'text-cyan-600 dark:text-cyan-400',
      badge: `${current.savingsRate.toFixed(1)}%`,
      badgeVariant:
        current.savingsRate >= 0
          ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30'
          : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
      sparklineData: sparklines.balance.map((_, i, arr) => {
        // approximate savings per month
        if (i === 0) return 0;
        return arr[i] - arr[i - 1];
      }),
      sparklineStroke: '#06b6d4',
      sparklineFill: '#06b6d4',
      change: changes.savingsVsLastMonth,
    },
    {
      label: 'Investimentos',
      value: currencyFmt(current.investments),
      icon: BarChart3,
      accentBg: 'bg-violet-500/10',
      accentText: 'text-violet-600 dark:text-violet-400',
      badge: current.netWorth !== 0 ? `${investmentPct}%` : undefined,
      badgeVariant:
        'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
      sparklineData: sparklines.balance.map((_, i) => {
        // Approximate: use a fraction of balance as investment proxy if we don't have historical data
        return Math.round((current.investments / 6) * (i + 1));
      }),
      sparklineStroke: '#8b5cf6',
      sparklineFill: '#8b5cf6',
      change: undefined,
    },
    {
      label: 'Dívida em Cartões',
      value: currencyFmt(current.cardDebt),
      icon: CreditCard,
      accentBg: 'bg-orange-500/10',
      accentText: 'text-orange-600 dark:text-orange-400',
      sparklineData: sparklines.expense.map((v) =>
        // Approximate debt as fraction of expense
        Math.round(v * 0.6 * 100) / 100
      ),
      sparklineStroke: '#f97316',
      sparklineFill: '#f97316',
      change: undefined,
    },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <Card className="border-0 shadow-md card-glow relative overflow-hidden">
        {/* Gradient top border */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 to-cyan-500" />

        {/* Header */}
        <CardHeader className="pb-3">
          <motion.div variants={headerVariants} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base font-semibold">
                Resumo Rápido
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Métricas atualizadas em tempo real
              </p>
            </div>
          </motion.div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Stats grid */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
          >
            {statsConfig.map((stat, i) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </motion.div>

          {/* Health bar */}
          <HealthBar
            savingsRate={current.savingsRate}
            balanceTrend={balanceTrend}
          />
        </CardContent>
      </Card>
    </motion.div>
  );
}
