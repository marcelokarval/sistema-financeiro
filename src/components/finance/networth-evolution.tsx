'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Trophy,
  AlertTriangle,
  RefreshCw,
  Target,
  Wallet,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

// ─── Helpers ───────────────────────────────────────────────────────
const currencyFmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const shortCurrency = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${v < 0 ? '-' : ''}R$ ${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1000) return `${v < 0 ? '-' : ''}R$ ${(abs / 1000).toFixed(0)}k`;
  return `R$ ${abs.toFixed(0)}`;
};

// ─── Types ─────────────────────────────────────────────────────────
interface MonthlyDataPoint {
  month: string;
  netWorth: number;
  assets: number;
  liabilities: number;
  changePercent: number;
  changeAmount: number;
}

interface NetworthResponse {
  monthlyData: MonthlyDataPoint[];
}

// ─── Animation Variants ────────────────────────────────────────────
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
};

const cardHover = {
  scale: 1.02,
  transition: { type: 'spring', stiffness: 300, damping: 20 },
};

// ─── Custom Tooltip ────────────────────────────────────────────────
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-xl p-3 shadow-lg">
      <p className="text-xs font-medium mb-2 capitalize">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">
            {entry.dataKey === 'netWorth' ? 'Patrimônio' : entry.name}:
          </span>
          <span className="font-semibold">{currencyFmt(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────
export function NetworthEvolution() {
  const [data, setData] = useState<NetworthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonths, setSelectedMonths] = useState(6);

  const fetchData = useCallback(async (months: number) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/networth?months=${months}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error('Erro ao buscar patrimônio:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(selectedMonths);
  }, [selectedMonths, fetchData]);

  // ─── Loading Skeleton ─────────────────────────────────────────────
  if (loading) {
    return (
      <Card className="border-0 shadow-md">
        <div className="h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-purple-500" />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
            <Skeleton className="h-8 w-40 rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <Skeleton className="h-72 w-full rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-16 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.monthlyData.length) {
    return (
      <Card className="border-0 shadow-md">
        <div className="h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-purple-500" />
        <CardContent className="py-12 flex flex-col items-center justify-center gap-3">
          <Wallet className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar a evolução patrimonial.
          </p>
          <Button variant="outline" size="sm" onClick={() => fetchData(selectedMonths)}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ─── Computed values ─────────────────────────────────────────────
  const chartData = data.monthlyData;
  const current = chartData[chartData.length - 1];
  const hasAnyNegative = chartData.some((d) => d.netWorth < 0);

  // Highest and lowest
  let highest = chartData[0];
  let lowest = chartData[0];
  for (const d of chartData) {
    if (d.netWorth > highest.netWorth) highest = d;
    if (d.netWorth < lowest.netWorth) lowest = d;
  }

  // Milestone progress (R$ 100k)
  const milestoneTarget = 100_000;
  const milestoneProgress = Math.min(100, Math.max(0, (Math.max(0, current.netWorth) / milestoneTarget) * 100));

  // Month selector options
  const monthOptions = [3, 6, 9, 12];

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <motion.div variants={container} initial="hidden" animate="show">
      <Card className="border-0 shadow-md overflow-hidden">
        {/* Gradient top border */}
        <div className="h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-purple-500" />

        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  Evolução Patrimonial
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Acompanhe seu patrimônio líquido ao longo do tempo
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Month selector pills */}
              <div className="flex items-center gap-1 bg-muted/40 rounded-full p-1">
                {monthOptions.map((m) => (
                  <button
                    key={m}
                    onClick={() => setSelectedMonths(m)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                      selectedMonths === m
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
              <Badge variant="secondary" className="text-[10px] px-2 py-0.5 h-6 bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20">
                {selectedMonths} meses
              </Badge>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => fetchData(selectedMonths)}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* ═══════════════════════════════════════════════════════════
              AREA CHART — Net worth over time
          ═══════════════════════════════════════════════════════════ */}
          <motion.div variants={item}>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="networthGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="50%" stopColor="#d946ef" stopOpacity={0.1} />
                      <stop offset="100%" stopColor="#a855f7" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={shortCurrency}
                    domain={['dataMin - 5000', 'dataMax + 5000']}
                  />
                  <RechartsTooltip content={<ChartTooltip />} />
                  {/* Reference line at y=0 if any month is negative */}
                  {hasAnyNegative && (
                    <ReferenceLine
                      y={0}
                      stroke="var(--muted-foreground)"
                      strokeDasharray="4 4"
                      strokeWidth={1}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="netWorth"
                    name="Patrimônio Líquido"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    fill="url(#networthGradient)"
                    dot={(props: Record<string, unknown>) => {
                      const { cx, cy, index } = props as { cx: number; cy: number; index: number; payload?: { netWorth: number } };
                      const isActive = index === chartData.length - 1;
                      return (
                        <circle
                          key={`dot-${index}`}
                          cx={cx}
                          cy={cy}
                          r={isActive ? 5 : 3}
                          fill="#8b5cf6"
                          stroke="var(--background)"
                          strokeWidth={isActive ? 2.5 : 2}
                          className="transition-all duration-200"
                        />
                      );
                    }}
                    activeDot={{
                      r: 5,
                      fill: '#8b5cf6',
                      stroke: '#fff',
                      strokeWidth: 2,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* ═══════════════════════════════════════════════════════════
              STAT CARDS ROW — 3 cards
          ═══════════════════════════════════════════════════════════ */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            {/* Patrimônio Atual */}
            <motion.div variants={item} whileHover={cardHover}>
              <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-sm">
                    <Wallet className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">Patrimônio Atual</span>
                </div>
                <p className="text-lg font-bold text-foreground">
                  {currencyFmt(current.netWorth)}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  {current.changeAmount >= 0 ? (
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
                  )}
                  <span
                    className={`text-[11px] font-semibold ${
                      current.changePercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {current.changePercent >= 0 ? '+' : ''}
                    {current.changePercent.toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    vs mês anterior
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Maior Patrimônio */}
            <motion.div variants={item} whileHover={cardHover}>
              <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
                    <Trophy className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">Maior Patrimônio</span>
                </div>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {currencyFmt(highest.netWorth)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1 capitalize">
                  {highest.month}
                </p>
              </div>
            </motion.div>

            {/* Menor Patrimônio */}
            <motion.div variants={item} whileHover={cardHover}>
              <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-sm">
                    <AlertTriangle className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">Menor Patrimônio</span>
                </div>
                <p className="text-lg font-bold text-rose-600 dark:text-rose-400">
                  {currencyFmt(lowest.netWorth)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1 capitalize">
                  {lowest.month}
                </p>
              </div>
            </motion.div>
          </motion.div>

          {/* ═══════════════════════════════════════════════════════════
              MILESTONE PROGRESS — R$ 100k
          ═══════════════════════════════════════════════════════════ */}
          <motion.div variants={item}>
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Target className="w-4.5 h-4.5 text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">
                      Meta: {currencyFmt(milestoneTarget)}
                    </p>
                    <span className="text-xs font-bold text-violet-600 dark:text-violet-400">
                      {milestoneProgress.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Faltam {currencyFmt(Math.max(0, milestoneTarget - Math.max(0, current.netWorth)))} para alcançar a meta
                  </p>
                </div>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${milestoneProgress}%` }}
                  transition={{ duration: 1, delay: 0.4, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-purple-500"
                />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[9px] text-muted-foreground">{currencyFmt(0)}</span>
                <span className="text-[9px] text-muted-foreground">{currencyFmt(milestoneTarget)}</span>
              </div>
            </div>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
