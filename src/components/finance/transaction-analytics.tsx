'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Trophy,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Store,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
// ─── Chart Colors ──────────────────────────────────────────────────
const DISTRIBUTION_COLORS = ['var(--ds-chart-1)', 'var(--ds-chart-2)', 'var(--ds-chart-3)', 'var(--ds-chart-5)', 'var(--ds-chart-4)'];
const tooltipStyle = {
  backgroundColor: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  fontSize: '12px',
  color: 'var(--card-foreground)',
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
  return (
    <TransactionAnalyticsContent
      data={data}
      loading={loading}
      typeFilter={typeFilter}
      onTypeFilterChange={setTypeFilter}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      fetchData={fetchData}
      onRetry={fetchData}
    />
  );
}

export function TransactionAnalyticsContent({
  data,
  loading,
  typeFilter,
  onTypeFilterChange,
  activeTab,
  onTabChange,
  fetchData,
  onRetry,
}: {
  data: AnalyticsData | null;
  loading: boolean;
  typeFilter: 'ALL' | 'INCOME' | 'EXPENSE';
  onTypeFilterChange: (t: 'ALL' | 'INCOME' | 'EXPENSE') => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  fetchData?: () => void;
  onRetry?: () => void;
}) {
  const handleRetry = onRetry ?? fetchData;
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
      <Card role="status" aria-label="Carregando análise de transações" className="min-w-0 gap-3 rounded-lg border-border bg-card py-4 shadow-none">
        <CardHeader className="px-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Skeleton className="max-w-full motion-reduce:animate-none w-9 h-9 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="max-w-full motion-reduce:animate-none h-5 w-48" />
                <Skeleton className="max-w-full motion-reduce:animate-none h-3 w-36" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="max-w-full motion-reduce:animate-none h-9 w-24" />
              <Skeleton className="max-w-full motion-reduce:animate-none size-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4 px-4 sm:px-5">
          {/* Tab skeleton */}
          <Skeleton className="max-w-full motion-reduce:animate-none h-9 w-80 rounded-lg" />
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 border-y border-border py-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="motion-reduce:animate-none h-24 rounded-lg" />
            ))}
          </div>
          {/* Chart skeleton */}
          <Skeleton className="max-w-full motion-reduce:animate-none h-48 rounded-lg" />
          {/* Table skeleton */}
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="motion-reduce:animate-none h-12 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  if (!data) {
    return (
      <section aria-labelledby="transaction-analytics-heading" className="min-w-0">
        <Card className="min-w-0 gap-3 rounded-lg border-border bg-card py-4 shadow-none">
          <CardHeader className="px-4 sm:px-5">
            <h3 id="transaction-analytics-heading" className="text-base font-semibold">Análise de Transações</h3>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3 px-4 sm:px-5">
            <p role="alert" className="text-sm text-muted-foreground">
              Não foi possível carregar a análise de transações.
            </p>
            <Button variant="outline" size="sm" className="min-h-9" onClick={handleRetry}>
              <RefreshCw aria-hidden="true" className="size-3.5" />
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }
  const { overview, monthlyComparison, topMerchants, amountDistribution, dailyPattern } = data;
  // ─── Stat Cards Data ───────────────────────────────────────────
  const statCards = [
    {
      label: 'Total de Transações',
      value: overview.totalTransactions.toLocaleString('pt-BR'),
    },
    {
      label: 'Total de receitas',
      value: currencyFmt(overview.totalIncome),
    },
    {
      label: 'Ticket Médio',
      value: currencyFmt(overview.averagePerTransaction),
    },
    {
      label: 'Maior Transação',
      value: overview.highestTransaction ? currencyFmt(overview.highestTransaction.amount) : '—',
    },
  ];
  return (
    <section aria-labelledby="transaction-analytics-heading" className="min-w-0">
      <Card className="min-w-0 gap-3 rounded-lg border-border bg-card py-4 shadow-none">
        <CardHeader className="px-4 sm:px-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="min-w-0">
              <h3 id="transaction-analytics-heading" className="text-base font-semibold">Análise de Transações</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Padrões e tendências detalhadas
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Type filter */}
              <div role="group" aria-label="Tipo de transação" className="flex flex-wrap items-center gap-1">
                {(['ALL', 'INCOME', 'EXPENSE'] as const).map((t) => (
                  <Button
                    key={t}
                    variant={typeFilter === t ? 'default' : 'ghost'}
                    size="sm"
                    className="min-h-9 text-xs px-2.5"
                    aria-pressed={typeFilter === t}
                    onClick={() => onTypeFilterChange(t)}
                  >
                    {typeLabels[t]}
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="size-9"
                aria-label="Atualizar análise"
                onClick={fetchData}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 px-4 sm:px-5">
          <Tabs value={activeTab} onValueChange={onTabChange}>
            <TabsList className="mb-3 grid h-auto w-full grid-cols-3 gap-0.5 p-1">
              <TabsTrigger value="overview" className="h-auto min-w-0 whitespace-normal px-1 py-1.5 text-xs leading-tight">
                Visão Geral
              </TabsTrigger>
              <TabsTrigger value="distribution" className="h-auto min-w-0 whitespace-normal px-1 py-1.5 text-xs leading-tight">
                Distribuição
              </TabsTrigger>
              <TabsTrigger value="patterns" className="h-auto min-w-0 whitespace-normal px-1 py-1.5 text-xs leading-tight">
                Padrões
              </TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-0 space-y-4">
              <dl aria-label="Indicadores de transações" className="grid grid-cols-2 gap-3 border-y border-border py-3 lg:grid-cols-4">
                {statCards.map((stat) => (
                  <div key={stat.label} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{stat.label}</dt>
                    <dd className="break-words font-mono text-sm font-semibold tabular-nums">{stat.value}</dd>
                  </div>
                ))}
              </dl>
              {/* Highest / Lowest side by side */}
              <div
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                {/* Highest transaction */}
                <div
                  className="min-w-0 border-t border-border pt-3"
                >
                  <div className="flex items-center gap-2 mb-3">
                                        <p className="text-xs font-semibold text-[var(--obligation)]">
                      Maior Transação
                    </p>
                  </div>
                  {overview.highestTransaction ? (
                    <div>
                      <p className="font-mono text-sm font-semibold tabular-nums">{currencyFmt(overview.highestTransaction.amount)}</p>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {overview.highestTransaction.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
                          {overview.highestTransaction.categoryName}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {dateFmt(overview.highestTransaction.date)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhuma transação encontrada</p>
                  )}
                </div>
                {/* Lowest transaction */}
                <div
                  className="min-w-0 border-t border-border pt-3"
                >
                  <div className="flex items-center gap-2 mb-3">
                                        <p className="text-xs font-semibold text-primary">
                      Menor Transação
                    </p>
                  </div>
                  {overview.lowestTransaction ? (
                    <div>
                      <p className="font-mono text-sm font-semibold tabular-nums">{currencyFmt(overview.lowestTransaction.amount)}</p>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {overview.lowestTransaction.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
                          {overview.lowestTransaction.categoryName}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {dateFmt(overview.lowestTransaction.date)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhuma transação encontrada</p>
                  )}
                </div>
              </div>
              {/* Most Frequent Category */}
              {overview.mostFrequentCategory && (
                <div
                  className="min-w-0 border-t border-border pt-3"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-primary" />
                      <p className="text-xs font-semibold text-primary">
                        Categoria Mais Frequente
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4 font-mono tabular-nums">
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
                        <p className="text-sm font-semibold font-mono tabular-nums shrink-0 ml-2">
                          {currencyFmt(overview.mostFrequentCategory.total)}
                        </p>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: "100%", backgroundColor: overview.mostFrequentCategory.categoryColor }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
            <TabsContent value="distribution" className="mt-0 space-y-5">
              {/* Amount Distribution - Horizontal Bar Chart */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Distribuição por Valor
                </p>
                <div className="space-y-2.5">
                  {amountDistribution.map((item, idx) => (
                    <div
                      key={item.range}
                      className="flex items-center gap-3"
                    >
                      <span className="text-xs font-medium text-muted-foreground w-16 shrink-0 text-right">
                        {item.range}
                      </span>
                      <div className="flex-1 h-8 rounded-lg bg-muted/50 overflow-hidden relative">
                        <div
                            style={{ width: item.count > 0 ? `${Math.max((item.count / maxDistCount) * 100, 4)}%` : '0%', backgroundColor: DISTRIBUTION_COLORS[idx] }}
                          className="h-full rounded-lg"
                        />
                        <div className="absolute inset-0 flex items-center px-3">
                          <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                            {item.count}
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto font-mono tabular-nums">
                            {item.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Weekday Breakdown - Income vs Expense stacked bar chart */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Gastos por Dia da Semana
                </p>
                <div className="h-52 min-w-0">
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
                      <Bar isAnimationActive={false} dataKey="income" name="income" stackId="a" fill="var(--ds-chart-1)" radius={[0, 0, 0, 0]} />
                      <Bar isAnimationActive={false} dataKey="expense" name="expense" stackId="a" fill="var(--ds-chart-4)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend */}
                <div className="flex items-center justify-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-[var(--money)]" />
                    <span className="text-xs text-muted-foreground">Receitas</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-[var(--debt)]" />
                    <span className="text-xs text-muted-foreground">Despesas</span>
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="patterns" className="mt-0 space-y-5">
              {/* Daily Pattern Bar Chart */}
              <div>
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
                      <Bar isAnimationActive={false} dataKey="count" fill="var(--ds-chart-2)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* Top 5 Merchants */}
              {topMerchants.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Store className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Top 5 Estabelecimentos
                    </p>
                  </div>
                  <div className="space-y-2.5">
                    {topMerchants.map((merchant, idx) => (
                      <div
                        key={merchant.name}
                        className="rounded-lg border border-border bg-card p-3"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-semibold text-muted-foreground w-4 shrink-0">
                              {idx + 1}
                            </span>
                            <span className="text-sm font-medium truncate">{merchant.name}</span>
                            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4 shrink-0">
                              {merchant.category}
                            </Badge>
                          </div>
                          <span className="text-sm font-semibold font-mono tabular-nums shrink-0 ml-2">
                            {currencyFmt(merchant.total)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                                style={{ width: `${Math.max((merchant.total / maxMerchantTotal) * 100, 3)}%` }}
                              className="h-full rounded-full bg-primary"
                            />
                          </div>
                          <span className="text-xs text-muted-foreground font-mono tabular-nums shrink-0">
                            {merchant.count}x
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Monthly Comparison Table */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Comparação Mensal
                </p>
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Comparação mensal de transações">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground">Mês</th>
                          <th className="text-right py-2.5 px-3 font-semibold text-[var(--money)]">Receitas</th>
                          <th className="text-right py-2.5 px-3 font-semibold text-[var(--debt)]">Despesas</th>
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
                            <tr
                              key={m.month}
                              className="border-t border-border/30 hover:bg-muted/30 transition-colors"
                            >
                              <td className="py-2.5 px-3 font-medium">{m.month}</td>
                              <td className="text-right py-2.5 px-3 font-mono tabular-nums text-[var(--money)]">
                                {currencyFmt(m.income)}
                              </td>
                              <td className="text-right py-2.5 px-3 font-mono tabular-nums text-[var(--debt)]">
                                {currencyFmt(m.expense)}
                              </td>
                              <td className={`text-right py-2.5 px-3 font-mono tabular-nums font-semibold ${m.net >= 0 ? 'text-[var(--money)]' : 'text-[var(--debt)]'}`}>
                                {currencyFmt(m.net)}
                              </td>
                              <td className="text-right py-2.5 px-3 font-mono tabular-nums">{m.count}</td>
                              <td className="text-right py-2.5 px-3 font-mono tabular-nums">{currencyFmt(m.avgPerTx)}</td>
                              <td className="text-right py-2.5 px-3">
                                {netChange !== null ? (
                                  <div className="inline-flex items-center gap-0.5">
                                    {netChange >= 0 ? (
                                      <ArrowUpRight className="w-3 h-3 text-[var(--money)]" />
                                    ) : (
                                      <ArrowDownRight className="w-3 h-3 text-[var(--debt)]" />
                                    )}
                                    <span className={`font-mono tabular-nums ${netChange >= 0 ? 'text-[var(--money)]' : 'text-[var(--debt)]'}`}>
                                      {Math.abs(netChange).toFixed(1)}%
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </section>
  );
}
