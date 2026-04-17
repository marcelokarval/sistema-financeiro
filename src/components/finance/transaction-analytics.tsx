'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  BarChart3,
  Hash,
  CircleDollarSign,
  Calculator,
  Trophy,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Store,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { currencyFmt, dateFmt, shortCurrency } from '@/lib/helpers';

// ─── Types ─────────────────────────────────────────────────────────
interface OverviewData {
  totalTransactions: number;
  totalIncome: number;
  totalExpense: number;
  averagePerTransaction: number;
  highestTransaction: {
    description: string;
    amount: number;
    date: string;
    categoryName: string;
    type: string;
  } | null;
  lowestTransaction: {
    description: string;
    amount: number;
    date: string;
    categoryName: string;
    type: string;
  } | null;
  mostFrequentCategory: {
    categoryName: string;
    categoryColor: string;
    count: number;
    total: number;
  } | null;
  weekdayBreakdown: {
    day: string;
    income: number;
    expense: number;
    count: number;
  }[];
}

interface MonthlyItem {
  month: string;
  income: number;
  expense: number;
  net: number;
  count: number;
  avgPerTx: number;
}

interface MerchantItem {
  name: string;
  count: number;
  total: number;
  category: string;
}

interface DistributionItem {
  range: string;
  count: number;
  percentage: number;
}

interface DailyPatternItem {
  hour: string;
  count: number;
}

interface AnalyticsData {
  overview: OverviewData;
  monthlyComparison: MonthlyItem[];
  topMerchants: MerchantItem[];
  amountDistribution: DistributionItem[];
  dailyPattern: DailyPatternItem[];
}

// ─── Animation Variants ────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const slideIn = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

const cardHover = {
  scale: 1.01,
  transition: { type: 'spring', stiffness: 300, damping: 20 },
};

// ─── Chart Colors ──────────────────────────────────────────────────
const DISTRIBUTION_COLORS = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#f43f5e'];

const tooltipStyle = {
  backgroundColor: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  fontSize: '12px',
  color: 'var(--card-foreground)',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
};

// ─── Component ─────────────────────────────────────────────────────
export function TransactionAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [activeTab, setActiveTab] = useState('overview');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ months: '6' });
      if (typeFilter !== 'ALL') params.set('type', typeFilter);
      const res = await fetch(`/api/transaction-analytics?${params}`);
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error('Erro ao buscar análise de transações', e);
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Max value for merchant progress bars
  const maxMerchantTotal = useMemo(() => {
    if (!data) return 0;
    return Math.max(...data.topMerchants.map((m) => m.total), 1);
  }, [data]);

  // Max value for amount distribution bars
  const maxDistCount = useMemo(() => {
    if (!data) return 0;
    return Math.max(...data.amountDistribution.map((d) => d.count), 1);
  }, [data]);

  const typeLabels: Record<string, string> = {
    ALL: 'Todos',
    INCOME: 'Receitas',
    EXPENSE: 'Despesas',
  };

  // ─── Loading Skeleton ──────────────────────────────────────────
  if (loading) {
    return (
      <Card className="border-0 shadow-md overflow-hidden card-glow">
        <div className="h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500" />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tab skeleton */}
          <Skeleton className="h-9 w-80 rounded-lg" />
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          {/* Chart skeleton */}
          <Skeleton className="h-48 rounded-xl" />
          {/* Table skeleton */}
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Erro ao carregar análise de transações.
      </p>
    );
  }

  const { overview, monthlyComparison, topMerchants, amountDistribution, dailyPattern } = data;

  // ─── Stat Cards Data ───────────────────────────────────────────
  const statCards = [
    {
      label: 'Total de Transações',
      value: overview.totalTransactions.toLocaleString('pt-BR'),
      icon: Hash,
      gradient: 'from-primary to-primary/70',
      shadowColor: 'shadow-primary/20',
    },
    {
      label: 'Volume Total',
      value: currencyFmt(overview.totalIncome),
      icon: CircleDollarSign,
      gradient: 'from-emerald-500 to-emerald-600',
      shadowColor: 'shadow-emerald-500/20',
    },
    {
      label: 'Ticket Médio',
      value: currencyFmt(overview.averagePerTransaction),
      icon: Calculator,
      gradient: 'from-violet-500 to-violet-600',
      shadowColor: 'shadow-violet-500/20',
    },
    {
      label: 'Maior Transação',
      value: overview.highestTransaction ? currencyFmt(overview.highestTransaction.amount) : '—',
      icon: Trophy,
      gradient: 'from-amber-500 to-amber-600',
      shadowColor: 'shadow-amber-500/20',
    },
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show">
      <Card className="border-0 shadow-md overflow-hidden card-glow">
        {/* Gradient top border */}
        <div className="h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500" />

        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  Análise de Transações
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Padrões e tendências detalhadas
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Type filter */}
              <div className="flex items-center bg-muted/50 rounded-lg p-0.5">
                {(['ALL', 'INCOME', 'EXPENSE'] as const).map((t) => (
                  <Button
                    key={t}
                    variant={typeFilter === t ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 text-[11px] px-2.5"
                    onClick={() => setTypeFilter(t)}
                  >
                    {typeLabels[t]}
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={fetchData}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-9 p-1 mb-4">
              <TabsTrigger value="overview" className="text-xs px-3 h-7">
                Visão Geral
              </TabsTrigger>
              <TabsTrigger value="distribution" className="text-xs px-3 h-7">
                Distribuição
              </TabsTrigger>
              <TabsTrigger value="patterns" className="text-xs px-3 h-7">
                Padrões
              </TabsTrigger>
            </TabsList>

            {/* ═══════════════════════════════════════════════════════
                TAB 1: VISÃO GERAL
            ═══════════════════════════════════════════════════════ */}
            <TabsContent value="overview" className="mt-0 space-y-4">
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-2 lg:grid-cols-4 gap-3"
              >
                {statCards.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <motion.div
                      key={stat.label}
                      variants={itemVariants}
                      whileHover={cardHover}
                      className="rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50 p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-md ${stat.shadowColor}`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-medium">{stat.label}</p>
                      <p className="text-sm font-bold mt-0.5 tabular-nums">{stat.value}</p>
                    </motion.div>
                  );
                })}
              </motion.div>

              {/* Highest / Lowest side by side */}
              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                {/* Highest transaction */}
                <motion.div
                  whileHover={cardHover}
                  className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-amber-500/10 p-4"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-amber-500" />
                    </div>
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                      Maior Transação
                    </p>
                  </div>
                  {overview.highestTransaction ? (
                    <div>
                      <p className="text-sm font-bold">{currencyFmt(overview.highestTransaction.amount)}</p>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {overview.highestTransaction.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          {overview.highestTransaction.categoryName}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {dateFmt(overview.highestTransaction.date)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhuma transação encontrada</p>
                  )}
                </motion.div>

                {/* Lowest transaction */}
                <motion.div
                  whileHover={cardHover}
                  className="rounded-xl border border-sky-500/20 bg-gradient-to-br from-sky-500/5 to-sky-500/10 p-4"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-sky-500/15 flex items-center justify-center">
                      <TrendingDown className="w-4 h-4 text-sky-500" />
                    </div>
                    <p className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                      Menor Transação
                    </p>
                  </div>
                  {overview.lowestTransaction ? (
                    <div>
                      <p className="text-sm font-bold">{currencyFmt(overview.lowestTransaction.amount)}</p>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {overview.lowestTransaction.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          {overview.lowestTransaction.categoryName}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {dateFmt(overview.lowestTransaction.date)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhuma transação encontrada</p>
                  )}
                </motion.div>
              </motion.div>

              {/* Most Frequent Category */}
              {overview.mostFrequentCategory && (
                <motion.div
                  variants={slideIn}
                  initial="hidden"
                  animate="show"
                  whileHover={cardHover}
                  className="rounded-xl border border-violet-500/20 bg-gradient-to-r from-violet-500/5 to-fuchsia-500/5 p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-violet-500" />
                      <p className="text-xs font-semibold text-violet-600 dark:text-violet-400">
                        Categoria Mais Frequente
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 tabular-nums">
                      {overview.mostFrequentCategory.count}x
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-8 rounded-sm shrink-0"
                      style={{ backgroundColor: overview.mostFrequentCategory.categoryColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold truncate">
                          {overview.mostFrequentCategory.categoryName}
                        </p>
                        <p className="text-sm font-bold tabular-nums shrink-0 ml-2">
                          {currencyFmt(overview.mostFrequentCategory.total)}
                        </p>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: '100%' }}
                          transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: overview.mostFrequentCategory.categoryColor }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </TabsContent>

            {/* ═══════════════════════════════════════════════════════
                TAB 2: DISTRIBUIÇÃO
            ═══════════════════════════════════════════════════════ */}
            <TabsContent value="distribution" className="mt-0 space-y-5">
              {/* Amount Distribution - Horizontal Bar Chart */}
              <motion.div variants={fadeUp} initial="hidden" animate="show">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Distribuição por Valor
                </p>
                <div className="space-y-2.5">
                  {amountDistribution.map((item, idx) => (
                    <motion.div
                      key={item.range}
                      variants={itemVariants}
                      initial="hidden"
                      animate="show"
                      transition={{ delay: idx * 0.05 }}
                      className="flex items-center gap-3"
                    >
                      <span className="text-[11px] font-medium text-muted-foreground w-16 shrink-0 text-right">
                        {item.range}
                      </span>
                      <div className="flex-1 h-7 rounded-lg bg-muted/50 overflow-hidden relative">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: item.count > 0 ? `${Math.max((item.count / maxDistCount) * 100, 4)}%` : '0%',
                          }}
                          transition={{ duration: 0.6, delay: 0.1 + idx * 0.06, ease: 'easeOut' }}
                          className="h-full rounded-lg"
                          style={{ backgroundColor: DISTRIBUTION_COLORS[idx] }}
                        />
                        <div className="absolute inset-0 flex items-center px-3">
                          <span className="text-[11px] font-semibold text-foreground drop-shadow-sm">
                            {item.count}
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
                            {item.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Weekday Breakdown - Income vs Expense stacked bar chart */}
              <motion.div variants={fadeUp} initial="hidden" animate="show">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Gastos por Dia da Semana
                </p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={overview.weekdayBreakdown} barCategoryGap="15%">
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 11 }}
                        stroke="var(--muted-foreground)"
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        stroke="var(--muted-foreground)"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={shortCurrency}
                        width={50}
                      />
                      <RechartsTooltip
                        formatter={(value: number, name: string) => [
                          currencyFmt(value),
                          name === 'income' ? 'Receitas' : 'Despesas',
                        ]}
                        contentStyle={tooltipStyle}
                      />
                      <Bar dataKey="income" name="income" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="expense" name="expense" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend */}
                <div className="flex items-center justify-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                    <span className="text-[11px] text-muted-foreground">Receitas</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-rose-500" />
                    <span className="text-[11px] text-muted-foreground">Despesas</span>
                  </div>
                </div>
              </motion.div>
            </TabsContent>

            {/* ═══════════════════════════════════════════════════════
                TAB 3: PADRÕES
            ═══════════════════════════════════════════════════════ */}
            <TabsContent value="patterns" className="mt-0 space-y-5">
              {/* Daily Pattern Bar Chart */}
              <motion.div variants={fadeUp} initial="hidden" animate="show">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Padrão Diário (por horário)
                  </p>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyPattern} barCategoryGap="20%">
                      <XAxis
                        dataKey="hour"
                        tick={{ fontSize: 10 }}
                        stroke="var(--muted-foreground)"
                        tickLine={false}
                        axisLine={false}
                        interval={1}
                      />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        stroke="var(--muted-foreground)"
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        width={30}
                      />
                      <RechartsTooltip
                        formatter={(value: number) => [value, 'Transações']}
                        contentStyle={tooltipStyle}
                      />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              {/* Top 5 Merchants */}
              {topMerchants.length > 0 && (
                <motion.div variants={fadeUp} initial="hidden" animate="show">
                  <div className="flex items-center gap-2 mb-3">
                    <Store className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Top 5 Estabelecimentos
                    </p>
                  </div>
                  <div className="space-y-2.5">
                    {topMerchants.map((merchant, idx) => (
                      <motion.div
                        key={merchant.name}
                        variants={itemVariants}
                        initial="hidden"
                        animate="show"
                        transition={{ delay: idx * 0.06 }}
                        whileHover={cardHover}
                        className="rounded-xl border border-border/50 bg-card p-3"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-semibold text-muted-foreground w-4 shrink-0">
                              {idx + 1}
                            </span>
                            <span className="text-sm font-medium truncate">{merchant.name}</span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                              {merchant.category}
                            </Badge>
                          </div>
                          <span className="text-sm font-bold tabular-nums shrink-0 ml-2">
                            {currencyFmt(merchant.total)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{
                                width: `${Math.max((merchant.total / maxMerchantTotal) * 100, 3)}%`,
                              }}
                              transition={{ duration: 0.6, delay: 0.15 + idx * 0.06, ease: 'easeOut' }}
                              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                            {merchant.count}x
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Monthly Comparison Table */}
              <motion.div variants={fadeUp} initial="hidden" animate="show">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Comparação Mensal
                </p>
                <div className="rounded-xl border border-border/50 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground">Mês</th>
                          <th className="text-right py-2.5 px-3 font-semibold text-emerald-600 dark:text-emerald-400">Receitas</th>
                          <th className="text-right py-2.5 px-3 font-semibold text-rose-600 dark:text-rose-400">Despesas</th>
                          <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Líquido</th>
                          <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Qtd</th>
                          <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Ticket</th>
                          <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Variação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyComparison.map((m, idx) => {
                          const prevNet = idx > 0 ? monthlyComparison[idx - 1].net : null;
                          const netChange = prevNet !== null && prevNet !== 0
                            ? ((m.net - prevNet) / Math.abs(prevNet)) * 100
                            : null;

                          return (
                            <motion.tr
                              key={m.month}
                              variants={itemVariants}
                              initial="hidden"
                              animate="show"
                              transition={{ delay: idx * 0.04 }}
                              className="border-t border-border/30 hover:bg-muted/30 transition-colors"
                            >
                              <td className="py-2.5 px-3 font-medium">{m.month}</td>
                              <td className="text-right py-2.5 px-3 tabular-nums text-emerald-600 dark:text-emerald-400">
                                {currencyFmt(m.income)}
                              </td>
                              <td className="text-right py-2.5 px-3 tabular-nums text-rose-600 dark:text-rose-400">
                                {currencyFmt(m.expense)}
                              </td>
                              <td className={`text-right py-2.5 px-3 tabular-nums font-semibold ${m.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {currencyFmt(m.net)}
                              </td>
                              <td className="text-right py-2.5 px-3 tabular-nums">{m.count}</td>
                              <td className="text-right py-2.5 px-3 tabular-nums">{currencyFmt(m.avgPerTx)}</td>
                              <td className="text-right py-2.5 px-3">
                                {netChange !== null ? (
                                  <div className="inline-flex items-center gap-0.5">
                                    {netChange >= 0 ? (
                                      <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                                    ) : (
                                      <ArrowDownRight className="w-3 h-3 text-rose-500" />
                                    )}
                                    <span className={`tabular-nums ${netChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                      {Math.abs(netChange).toFixed(1)}%
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
}
