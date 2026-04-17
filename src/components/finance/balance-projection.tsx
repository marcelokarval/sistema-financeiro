'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Shield,
  PiggyBank,
  Target,
  Activity,
  ChevronRight,
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
  Legend,
  ReferenceLine,
} from 'recharts';

// ─── Helpers ───────────────────────────────────────────────────────
const currencyFmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const shortCurrency = (v: number) => {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v.toFixed(0);
};

// ─── Types ─────────────────────────────────────────────────────────
interface AccountProjection {
  accountId: string;
  accountName: string;
  accountColor: string;
  accountType: string;
  currentBalance: number;
  projectedBalances: number[];
  avgMonthlyIncome: number;
  avgMonthlyExpense: number;
  monthlyNet: number;
  trend: 'up' | 'down' | 'stable';
}

interface ProjectionData {
  accounts: AccountProjection[];
  monthLabels: string[];
  totalCurrentBalance: number;
  totalProjected: number;
  averageMonthlySavings: number;
  savingsRate: number;
  riskLevel: 'low' | 'medium' | 'high';
  months: number;
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

const listItem = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

// ─── Risk Badge ────────────────────────────────────────────────────
function RiskBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  if (level === 'low') {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs px-3 py-1 hover:bg-emerald-500/15">
        <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
        Baixo
      </Badge>
    );
  }
  if (level === 'high') {
    return (
      <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-xs px-3 py-1 hover:bg-rose-500/15">
        <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
        Alto
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-xs px-3 py-1 hover:bg-amber-500/15">
      <Shield className="w-3.5 h-3.5 mr-1.5" />
      Médio
    </Badge>
  );
}

// ─── Trend Icon ────────────────────────────────────────────────────
function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') return <TrendingUp className="w-4 h-4 text-emerald-500" />;
  if (trend === 'down') return <TrendingDown className="w-4 h-4 text-rose-500" />;
  return <Minus className="w-4 h-4 text-amber-500" />;
}

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
      <p className="text-xs font-medium mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold">{currencyFmt(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Month Selector ────────────────────────────────────────────────
function MonthSelector({
  selected,
  onChange,
}: {
  selected: number;
  onChange: (m: number) => void;
}) {
  const options = [3, 6, 9, 12];
  return (
    <div className="flex items-center gap-1 bg-muted/40 rounded-full p-1">
      {options.map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
            selected === m
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
          }`}
        >
          {m} meses
        </button>
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────
export function BalanceProjection() {
  const [data, setData] = useState<ProjectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonths, setSelectedMonths] = useState(6);

  const fetchData = useCallback(async (months: number) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/balance-projection?months=${months}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error('Erro ao buscar projeção:', e);
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
        <div className="h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-56" />
                <Skeleton className="h-3 w-44" />
              </div>
            </div>
            <Skeleton className="h-8 w-48 rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <Skeleton className="h-72 w-full rounded-xl" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-28 w-full rounded-xl" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="border-0 shadow-md">
        <div className="h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />
        <CardContent className="py-12 flex flex-col items-center justify-center gap-3">
          <Activity className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar a projeção de saldos.
          </p>
          <Button variant="outline" size="sm" onClick={() => fetchData(selectedMonths)}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ─── Chart data (per account) ────────────────────────────────────
  const chartData = data.monthLabels.map((label, idx) => {
    const row: Record<string, string | number> = { month: label };
    data.accounts.forEach((acc) => {
      row[acc.accountName] = acc.projectedBalances[idx] || 0;
    });
    return row;
  });

  // ─── Risk assessment ─────────────────────────────────────────────
  const riskConfig = {
    low: {
      color: 'emerald',
      bgClass: 'bg-emerald-500/5 border-emerald-500/20',
      textClass: 'text-emerald-700 dark:text-emerald-400',
      iconBg: 'bg-emerald-500/10',
      message: 'Suas finanças estão saudáveis! Você mantém uma boa taxa de poupança acima de 20%.',
    },
    medium: {
      color: 'amber',
      bgClass: 'bg-amber-500/5 border-amber-500/20',
      textClass: 'text-amber-700 dark:text-amber-400',
      iconBg: 'bg-amber-500/10',
      message: 'Atenção: sua taxa de poupança está entre 0% e 20%. Considere reduzir gastos para aumentar suas economias.',
    },
    high: {
      color: 'rose',
      bgClass: 'bg-rose-500/5 border-rose-500/20',
      textClass: 'text-rose-700 dark:text-rose-400',
      iconBg: 'bg-rose-500/10',
      message: 'Alerta vermelho! Suas despesas superam suas receitas. Revise urgentemente seus gastos para evitar endividamento.',
    },
  };

  const currentRisk = riskConfig[data.riskLevel];
  const projectionChange = data.totalProjected - data.totalCurrentBalance;
  const projectionChangePct =
    data.totalCurrentBalance !== 0
      ? ((projectionChange / Math.abs(data.totalCurrentBalance)) * 100).toFixed(1)
      : '0.0';

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <motion.div variants={container} initial="hidden" animate="show">
      <Card className="border-0 shadow-md overflow-hidden">
        {/* Gradient top border */}
        <div className="h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />

        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  Projeção de Saldos
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Previsão futura baseada nos seus padrões financeiros
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MonthSelector selected={selectedMonths} onChange={setSelectedMonths} />
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
              AREA CHART — Projected balances per account
          ═══════════════════════════════════════════════════════════ */}
          <motion.div variants={item}>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    {data.accounts.map((acc) => (
                      <linearGradient
                        key={acc.accountId}
                        id={`grad-${acc.accountId}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor={acc.accountColor} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={acc.accountColor} stopOpacity={0.02} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    vertical={false}
                  />
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
                  {/* Reference line at current month (index 0) */}
                  <ReferenceLine
                    x={data.monthLabels[0]}
                    stroke="var(--muted-foreground)"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                  />
                  {data.accounts.map((acc) => (
                    <Area
                      key={acc.accountId}
                      type="monotone"
                      dataKey={acc.accountName}
                      stroke={acc.accountColor}
                      strokeWidth={2}
                      strokeDasharray="0"
                      fill={`url(#grad-${acc.accountId})`}
                      dot={{ r: 3, fill: acc.accountColor, strokeWidth: 2, stroke: 'var(--background)' }}
                      activeDot={{ r: 5, fill: acc.accountColor, strokeWidth: 2, stroke: '#fff' }}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* ═══════════════════════════════════════════════════════════
              SUMMARY CARDS ROW
          ═══════════════════════════════════════════════════════════ */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          >
            {/* Saldo Total Atual */}
            <motion.div variants={item} whileHover={cardHover}>
              <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-sm">
                    <PiggyBank className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">Saldo Total Atual</span>
                </div>
                <p className="text-lg font-bold text-foreground">
                  {currencyFmt(data.totalCurrentBalance)}
                </p>
              </div>
            </motion.div>

            {/* Projeção em N Meses */}
            <motion.div variants={item} whileHover={cardHover}>
              <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
                    <Target className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Projeção em {data.months} meses
                  </span>
                </div>
                <p className="text-lg font-bold text-foreground">
                  {currencyFmt(data.totalProjected)}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  {projectionChange >= 0 ? (
                    <TrendingUp className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-rose-500" />
                  )}
                  <span
                    className={`text-[10px] font-medium ${
                      projectionChange >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {projectionChange >= 0 ? '+' : ''}
                    {projectionChangePct}%
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Economia Mensal Média */}
            <motion.div variants={item} whileHover={cardHover}>
              <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
                    <TrendingUp className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Economia Mensal
                  </span>
                </div>
                <p
                  className={`text-lg font-bold ${
                    data.averageMonthlySavings >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {data.averageMonthlySavings >= 0 ? '+' : ''}
                  {currencyFmt(data.averageMonthlySavings)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Taxa de poupança: {data.savingsRate}%
                </p>
              </div>
            </motion.div>

            {/* Nível de Risco */}
            <motion.div variants={item} whileHover={cardHover}>
              <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm">
                    <Shield className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Nível de Risco
                  </span>
                </div>
                <div className="mt-1">
                  <RiskBadge level={data.riskLevel} />
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* ═══════════════════════════════════════════════════════════
              RISK ASSESSMENT SECTION
          ═══════════════════════════════════════════════════════════ */}
          <motion.div variants={item}>
            <div className={`rounded-xl border p-4 ${currentRisk.bgClass}`}>
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-lg ${currentRisk.iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
                  {data.riskLevel === 'high' ? (
                    <AlertTriangle className="w-5 h-5 text-rose-500" />
                  ) : data.riskLevel === 'medium' ? (
                    <Shield className="w-5 h-5 text-amber-500" />
                  ) : (
                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className={`text-sm font-semibold ${currentRisk.textClass}`}>
                      {data.riskLevel === 'high'
                        ? 'Risco Alto — Ação Necessária'
                        : data.riskLevel === 'medium'
                          ? 'Risco Médio — Atenção Recomendada'
                          : 'Risco Baixo — Finanças Saudáveis'}
                    </p>
                    <RiskBadge level={data.riskLevel} />
                  </div>
                  <p className={`text-xs ${currentRisk.textClass} leading-relaxed`}>
                    {currentRisk.message}
                  </p>
                  {/* Savings rate visual bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-muted-foreground font-medium">
                        Taxa de poupança
                      </span>
                      <span className={`text-[11px] font-bold ${currentRisk.textClass}`}>
                        {data.savingsRate}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.max(0, Math.min(100, Math.abs(data.savingsRate)))}%`,
                        }}
                        transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{
                          backgroundColor:
                            data.riskLevel === 'low'
                              ? '#22c55e'
                              : data.riskLevel === 'medium'
                                ? '#f59e0b'
                                : '#ef4444',
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[9px] text-muted-foreground">0%</span>
                      <span className="text-[9px] text-muted-foreground">100%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ═══════════════════════════════════════════════════════════
              ACCOUNT DETAIL LIST
          ═══════════════════════════════════════════════════════════ */}
          <motion.div variants={item}>
            <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
                <span className="text-xs font-semibold">Detalhes por Conta</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {data.accounts.length}
                </Badge>
              </div>
              <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="divide-y divide-border/40 max-h-96 overflow-y-auto"
              >
                {data.accounts.map((acc) => {
                  const finalBalance = acc.projectedBalances[acc.projectedBalances.length - 1];
                  const change = finalBalance - acc.currentBalance;
                  return (
                    <motion.div
                      key={acc.accountId}
                      variants={listItem}
                      className="px-4 py-3 hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {/* Color dot */}
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: acc.accountColor }}
                        />
                        {/* Account info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{acc.accountName}</span>
                            <TrendIcon trend={acc.trend} />
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[11px] text-muted-foreground">
                              Atual: {currencyFmt(acc.currentBalance)}
                            </span>
                            <span className="text-[11px] text-muted-foreground">→</span>
                            <span
                              className={`text-[11px] font-medium ${
                                change >= 0 ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              {change >= 0 ? '+' : ''}
                              {currencyFmt(finalBalance)}
                            </span>
                          </div>
                        </div>
                        {/* Mini stats */}
                        <div className="hidden sm:flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground">Receita/mês</p>
                            <p className="text-xs font-semibold text-emerald-600">
                              {currencyFmt(acc.avgMonthlyIncome)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground">Despesa/mês</p>
                            <p className="text-xs font-semibold text-rose-600">
                              {currencyFmt(acc.avgMonthlyExpense)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground">Líquido/mês</p>
                            <p
                              className={`text-xs font-bold ${
                                acc.monthlyNet >= 0 ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              {acc.monthlyNet >= 0 ? '+' : ''}
                              {currencyFmt(acc.monthlyNet)}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
