'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart as LineChartIcon,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  RefreshCw,
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
import { Separator } from '@/components/ui/separator';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from 'recharts';

// ─── Helpers ───────────────────────────────────────────────────────
const currencyFmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const shortCurrency = (v: number) => {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v.toFixed(0);
};

// ─── Types ─────────────────────────────────────────────────────────
interface ForecastMonth {
  month: string;
  projectedIncome: number;
  projectedExpense: number;
  projectedNet: number;
  confidence: number;
}

interface TopCategory {
  name: string;
  color: string;
  averageMonthly: number;
}

interface ForecastData {
  forecastMonths: ForecastMonth[];
  topExpenseCategories: TopCategory[];
  riskAlerts: string[];
  trendDirection: 'improving' | 'stable' | 'declining';
}

// ─── Animation Variants ────────────────────────────────────────────
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

const cardHover = {
  scale: 1.015,
  transition: { type: 'spring', stiffness: 300, damping: 20 },
};

const alertItem = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

// ─── Confidence Badge ──────────────────────────────────────────────
function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 80) {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] px-2 py-0.5 hover:bg-emerald-500/15">
        {confidence}% confiança
      </Badge>
    );
  }
  if (confidence >= 50) {
    return (
      <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] px-2 py-0.5 hover:bg-amber-500/15">
        {confidence}% confiança
      </Badge>
    );
  }
  return (
    <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px] px-2 py-0.5 hover:bg-rose-500/15">
      {confidence}% confiança
    </Badge>
  );
}

// ─── Trend Indicator ───────────────────────────────────────────────
function TrendIndicator({ direction }: { direction: string }) {
  if (direction === 'improving') {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20"
      >
        <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
        <span className="text-[11px] font-medium text-emerald-600">Tendência positiva</span>
      </motion.div>
    );
  }
  if (direction === 'declining') {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20"
      >
        <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
        <span className="text-[11px] font-medium text-rose-600">Tendência negativa</span>
      </motion.div>
    );
  }
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20"
    >
      <Minus className="w-3.5 h-3.5 text-amber-500" />
      <span className="text-[11px] font-medium text-amber-600">Tendência estável</span>
    </motion.div>
  );
}

// ─── Custom Tooltip ────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-xl p-3 shadow-lg">
      <p className="text-xs font-medium mb-2 capitalize">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold">{currencyFmt(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────
export function CashFlowForecast() {
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchForecast = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/forecast?months=3');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error('Erro ao buscar previsão:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  // ─── Loading Skeleton ─────────────────────────────────────────────
  if (loading) {
    return (
      <Card className="border-0 shadow-md">
        <div className="h-1 bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500" />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-52" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <Skeleton className="h-7 w-32 rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-72 w-full rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-20 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="border-0 shadow-md">
        <div className="h-1 bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500" />
        <CardContent className="py-12 flex flex-col items-center justify-center gap-3">
          <LineChartIcon className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar a previsão de fluxo de caixa.
          </p>
          <Button variant="outline" size="sm" onClick={fetchForecast}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ─── Chart data ───────────────────────────────────────────────────
  const chartData = data.forecastMonths.map((m) => ({
    month: m.month,
    Receita: Math.round(m.projectedIncome),
    Despesa: Math.round(m.projectedExpense),
    Saldo: Math.round(m.projectedNet),
  }));

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <motion.div variants={container} initial="hidden" animate="show">
      <Card className="border-0 shadow-md overflow-hidden">
        {/* Gradient top border */}
        <div className="h-1 bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500" />

        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
                <LineChartIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  Previsão de Fluxo de Caixa
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Projeção baseada nos seus padrões de gastos
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrendIndicator direction={data.trendDirection} />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={fetchForecast}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* ═══════════════════════════════════════════════════════════
              LINE CHART
          ═══════════════════════════════════════════════════════════ */}
          <motion.div variants={item}>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    {/* Income gradient */}
                    <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                    </linearGradient>
                    {/* Expense gradient */}
                    <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
                    </linearGradient>
                    {/* Net gradient */}
                    <linearGradient id="gradNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
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
                  />
                  <RechartsTooltip content={<ChartTooltip />} />
                  <Legend
                    iconType="line"
                    iconSize={12}
                    wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  />
                  {/* Income — green dashed */}
                  <Area
                    type="monotone"
                    dataKey="Receita"
                    stroke="#22c55e"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    fill="url(#gradIncome)"
                    dot={{ r: 4, fill: '#22c55e', strokeWidth: 2, stroke: 'var(--background)' }}
                    activeDot={{ r: 6, fill: '#22c55e', strokeWidth: 2, stroke: '#fff' }}
                  />
                  {/* Expense — orange dashed */}
                  <Area
                    type="monotone"
                    dataKey="Despesa"
                    stroke="#f97316"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    fill="url(#gradExpense)"
                    dot={{ r: 4, fill: '#f97316', strokeWidth: 2, stroke: 'var(--background)' }}
                    activeDot={{ r: 6, fill: '#f97316', strokeWidth: 2, stroke: '#fff' }}
                  />
                  {/* Net — cyan solid */}
                  <Area
                    type="monotone"
                    dataKey="Saldo"
                    stroke="#06b6d4"
                    strokeWidth={2.5}
                    fill="url(#gradNet)"
                    dot={{ r: 4, fill: '#06b6d4', strokeWidth: 2, stroke: 'var(--background)' }}
                    activeDot={{ r: 6, fill: '#06b6d4', strokeWidth: 2, stroke: '#fff' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* ═══════════════════════════════════════════════════════════
              FORECAST MONTHS CARDS
          ═══════════════════════════════════════════════════════════ */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            {data.forecastMonths.map((m) => (
              <motion.div
                key={m.month}
                variants={item}
                whileHover={cardHover}
                className="rounded-xl border border-border/60 bg-card p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold capitalize text-foreground/80">
                    {m.month}
                  </p>
                  <ConfidenceBadge confidence={m.confidence} />
                </div>

                <div className="space-y-2">
                  {/* Income */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Receita</span>
                    <span className="text-sm font-semibold text-emerald-500">
                      {currencyFmt(m.projectedIncome)}
                    </span>
                  </div>
                  {/* Expense */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Despesa</span>
                    <span className="text-sm font-semibold text-orange-500">
                      {currencyFmt(m.projectedExpense)}
                    </span>
                  </div>

                  <Separator className="my-1" />

                  {/* Net */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-muted-foreground">Saldo projetado</span>
                    <span
                      className={`text-sm font-bold ${
                        m.projectedNet >= 0 ? 'text-cyan-600' : 'text-rose-600'
                      }`}
                    >
                      {m.projectedNet >= 0 ? '+' : ''}
                      {currencyFmt(m.projectedNet)}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* ═══════════════════════════════════════════════════════════
              TOP EXPENSE CATEGORIES
          ═══════════════════════════════════════════════════════════ */}
          {data.topExpenseCategories.length > 0 && (
            <motion.div variants={item} initial="hidden" animate="show">
              <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                <p className="text-xs font-semibold mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-400" />
                  Top Categorias de Despesa (média mensal)
                </p>
                <div className="space-y-2.5">
                  {data.topExpenseCategories.map((cat, idx) => (
                    <motion.div
                      key={cat.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.35, delay: 0.1 + idx * 0.08 }}
                      className="flex items-center gap-3"
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-xs text-muted-foreground flex-1 truncate">
                        {cat.name}
                      </span>
                      <div className="h-2 rounded-full bg-muted overflow-hidden w-24">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${Math.min(
                              100,
                              (cat.averageMonthly /
                                (data.topExpenseCategories[0]?.averageMonthly || 1)) *
                                100
                            )}%`,
                          }}
                          transition={{ duration: 0.7, delay: 0.2 + idx * 0.08, ease: 'easeOut' }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                      </div>
                      <span className="text-xs font-semibold w-24 text-right">
                        {currencyFmt(cat.averageMonthly)}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              RISK ALERTS
          ═══════════════════════════════════════════════════════════ */}
          {data.riskAlerts.length > 0 && (
            <motion.div variants={item} initial="hidden" animate="show">
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  </div>
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    Alertas de Risco
                  </p>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 border-amber-500/20">
                    {data.riskAlerts.length}
                  </Badge>
                </div>
                <motion.div
                  variants={container}
                  initial="hidden"
                  animate="show"
                  className="space-y-2"
                >
                  {data.riskAlerts.map((alert, idx) => (
                    <motion.div
                      key={idx}
                      variants={alertItem}
                      className="flex items-start gap-2.5 py-1.5"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                      <p className="text-xs text-amber-700 dark:text-amber-300/90 leading-relaxed">
                        {alert}
                      </p>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* Empty alerts — positive message */}
          {data.riskAlerts.length === 0 && (
            <motion.div variants={item} initial="hidden" animate="show">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-emerald-500 shrink-0" />
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Nenhum alerta de risco identificado. Suas finanças estão em boa saúde!
                </p>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
