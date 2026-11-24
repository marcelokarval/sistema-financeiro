'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PiggyBank,
  ShoppingCart,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { currencyFmt } from '@/lib/helpers';
// ─── Helpers ───────────────────────────────────────────────────────
const shortCurrency = (v: number) => {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v.toFixed(0);
};
const pctFmt = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
// ─── Types ─────────────────────────────────────────────────────────
interface MonthlyItem {
  month: string;
  income: number;
  expense: number;
  net: number;
  transactionCount: number;
  purchaseCount: number;
  avgDailySpend: number;
  savingsRate: number;
}
interface CategoryInfo {
  name: string;
  color: string;
  total: number;
  count: number;
}
interface ExpenseItem {
  id: string;
  description: string;
  amount: number;
  date: string;
}
interface ReportsData {
  monthlyData: MonthlyItem[];
  topExpenseCategory: CategoryInfo | null;
  topCategories: CategoryInfo[];
  avgDailySpend: number;
  highestExpense: ExpenseItem | null;
  lowestIncome: ExpenseItem | null;
  savingsRateTrend: { month: string; rate: number }[];
  ticketMedio: number;
}
// ─── Component ─────────────────────────────────────────────────────
export function FinancialReportsWidget() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('monthly');
  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/reports?months=6');
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error('Failed to fetch reports', e);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    fetchReports();
  }, [fetchReports]);
  return (
    <FinancialReportsContent
      data={data}
      loading={loading}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      fetchReports={fetchReports}
      onRetry={fetchReports}
    />
  );
}

export function FinancialReportsContent({
  data,
  loading,
  activeTab,
  onTabChange,
  fetchReports,
  onRetry,
}: {
  data: ReportsData | null;
  loading: boolean;
  activeTab: string;
  onTabChange: (tab: string) => void;
  fetchReports?: () => void;
  onRetry?: () => void;
}) {
  const handleRetry = onRetry ?? fetchReports;
  // ─── Loading skeleton ────────────────────────────────────────────
  if (loading) {
    return (
      <Card role="status" aria-label="Carregando relatórios financeiros" className="min-w-0 gap-3 rounded-lg border-border bg-card py-4 shadow-none">
        <CardHeader className="px-4 sm:px-5">
          <div className="flex items-center gap-3">
            <Skeleton className="max-w-full motion-reduce:animate-none w-9 h-9 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="max-w-full motion-reduce:animate-none h-5 w-44" />
              <Skeleton className="max-w-full motion-reduce:animate-none h-3 w-32" />
            </div>
          </div>
          <Skeleton className="max-w-full motion-reduce:animate-none h-9 w-64 mt-2" />
        </CardHeader>
        <CardContent className="min-w-0 space-y-4 px-4 sm:px-5">
          <Skeleton className="max-w-full motion-reduce:animate-none h-64 w-full rounded-lg" />
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
      <section aria-labelledby="financial-reports-heading" className="min-w-0">
        <Card className="min-w-0 gap-3 rounded-lg border-border bg-card py-4 shadow-none">
          <CardHeader className="px-4 sm:px-5">
            <h3 id="financial-reports-heading" className="text-base font-semibold">Relatórios Financeiros</h3>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3 px-4 sm:px-5">
            <p role="alert" className="text-sm text-muted-foreground">Não foi possível carregar os relatórios financeiros.</p>
            <Button variant="outline" size="sm" className="min-h-9" onClick={handleRetry}>
              <RefreshCw aria-hidden="true" className="size-3.5" />
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }
  // ─── Derived values ──────────────────────────────────────────────
  const chartData = data.monthlyData.map((m) => ({
    month: m.month,
    Receitas: m.income,
    Despesas: m.expense,
  }));
  const totalExpenseAcrossPeriod = data.topCategories.reduce((s, c) => s + c.total, 0);
  // ─── Render ──────────────────────────────────────────────────────
  return (
    <section aria-labelledby="financial-reports-heading" className="min-w-0">
      <Card className="min-w-0 gap-3 rounded-lg border-border bg-card py-4 shadow-none">
        <CardHeader className="px-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 id="financial-reports-heading" className="text-base font-semibold">Relatórios Financeiros</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Análise comparativa dos últimos {data.monthlyData.length} meses
              </p>
            </div>
            <Button variant="outline" size="icon" className="size-9" aria-label="Atualizar relatórios" onClick={fetchReports}>
              <BarChart3 className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 px-4 sm:px-5">
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={onTabChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="monthly" className="min-h-9 text-xs">Visão Mensal</TabsTrigger>
              <TabsTrigger value="analysis" className="min-h-9 text-xs">Análise</TabsTrigger>
            </TabsList>
            <TabsContent value="monthly" className="mt-4 space-y-4">
              {data.monthlyData.length === 0 && <p className="text-sm text-muted-foreground">Nenhum mês disponível no relatório.</p>}
              {/* Bar Chart */}
              <div>
                <div className="h-56 min-w-0 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barGap={2} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} tickFormatter={shortCurrency} />
                      <RechartsTooltip
                        formatter={(value: number, name: string) => [currencyFmt(value), name]}
                        contentStyle={{
                          backgroundColor: 'var(--card)',
                          border: '1px solid var(--border)',
                          borderRadius: '12px',
                          fontSize: '12px',
                          color: 'var(--card-foreground)',
                          }}
                      />
                      <Bar isAnimationActive={false} dataKey="Receitas" fill="var(--ds-chart-1)" radius={[4, 4, 0, 0]} />
                      <Bar isAnimationActive={false} dataKey="Despesas" fill="var(--ds-chart-3)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* Monthly detail list */}
              <div className="divide-y divide-border border-y border-border" role="list" aria-label="Detalhamento mensal">
                {data.monthlyData.map((m, idx) => {
                  const prev = idx > 0 ? data.monthlyData[idx - 1] : null;
                  const incomeChange = prev && prev.income > 0 ? ((m.income - prev.income) / prev.income) * 100 : null;
                  const expenseChange = prev && prev.expense > 0 ? ((m.expense - prev.expense) / prev.expense) * 100 : null;
                  return (
                    <div
                      key={m.month}
                      role="listitem"
                      className="grid min-w-0 grid-cols-2 items-start gap-2 py-2.5 sm:grid-cols-[minmax(4rem,1fr)_repeat(3,minmax(0,1fr))]"
                    >
                      {/* Month label */}
                      <div className="w-16 shrink-0">
                        <p className="text-sm font-semibold">{m.month}</p>
                        <p className="text-xs text-muted-foreground">{m.transactionCount + m.purchaseCount} mov.</p>
                      </div>
                      {/* Income */}
                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-xs text-muted-foreground">Receitas</p>
                        <div className="flex flex-wrap items-center justify-end gap-x-1">
                          <span className="break-words font-mono text-sm font-semibold tabular-nums text-[var(--money)]">
                            {currencyFmt(m.income)}
                          </span>
                          {incomeChange !== null && (
                            <span className={`text-xs font-medium flex items-center gap-0.5 ${incomeChange >= 0 ? 'text-[var(--money)]' : 'text-[var(--debt)]'}`}>
                              {incomeChange >= 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                              {pctFmt(incomeChange)}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Expense */}
                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-xs text-muted-foreground">Despesas</p>
                        <div className="flex flex-wrap items-center justify-end gap-x-1">
                          <span className="break-words font-mono text-sm font-semibold tabular-nums text-[var(--debt)]">
                            {currencyFmt(m.expense)}
                          </span>
                          {expenseChange !== null && (
                            <span className={`text-xs font-medium flex items-center gap-0.5 ${expenseChange <= 0 ? 'text-[var(--money)]' : 'text-[var(--debt)]'}`}>
                              {expenseChange <= 0 ? <ArrowDownRight className="w-2.5 h-2.5" /> : <ArrowUpRight className="w-2.5 h-2.5" />}
                              {pctFmt(expenseChange)}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Net */}
                      <div className="min-w-0 text-right">
                        <p className="text-xs text-muted-foreground">Líquido</p>
                        <span className={`break-words font-mono text-sm font-semibold tabular-nums ${m.net >= 0 ? 'text-[var(--money)]' : 'text-[var(--debt)]'}`}>
                          {m.net >= 0 ? '+' : ''}{currencyFmt(m.net)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
            <TabsContent value="analysis" className="mt-4 space-y-4">
              {/* Key Metrics Cards */}
              <dl aria-label="Indicadores do relatório" className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border py-3 lg:grid-cols-4">
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Ticket médio</dt>
                  <dd className="mt-0.5 break-words font-mono text-sm font-semibold tabular-nums">{currencyFmt(data.ticketMedio)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Gasto médio por dia</dt>
                  <dd className="mt-0.5 break-words font-mono text-sm font-semibold tabular-nums">{currencyFmt(data.avgDailySpend)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Maior despesa</dt>
                  <dd className="mt-0.5 break-words font-mono text-sm font-semibold tabular-nums">{data.highestExpense ? (
                    <>
                      {currencyFmt(data.highestExpense.amount)}
                      <span className="block break-words font-sans text-xs font-normal text-muted-foreground">{data.highestExpense.description}</span>
                    </>
                  ) : <span className="font-sans font-normal text-muted-foreground">Sem dados</span>}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Menor receita</dt>
                  <dd className="mt-0.5 break-words font-mono text-sm font-semibold tabular-nums">{data.lowestIncome ? (
                    <>
                      {currencyFmt(data.lowestIncome.amount)}
                      <span className="block break-words font-sans text-xs font-normal text-muted-foreground">{data.lowestIncome.description}</span>
                    </>
                  ) : <span className="font-sans font-normal text-muted-foreground">Sem dados</span>}</dd>
                </div>
              </dl>
              {/* Top 3 Expense Categories */}
              <div>
                <Card className="min-w-0 gap-2 rounded-lg py-3 shadow-none">
                  <CardHeader className="px-4 sm:px-5">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-muted-foreground" />
                      <CardTitle className="text-sm font-semibold">Top Categorias de Despesa</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="min-w-0 space-y-4 px-4 sm:px-5">
                    {data.topCategories.length > 0 ? (
                      data.topCategories.map((cat) => {
                        const percent = totalExpenseAcrossPeriod > 0 ? (cat.total / totalExpenseAcrossPeriod) * 100 : 0;
                        return (
                          <div
                            key={cat.name}
                          >
                            <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: cat.color }} />
                                <span className="text-sm font-medium">{cat.name}</span>
                                <Badge variant="secondary" className="font-mono text-xs tabular-nums px-1.5 py-0">
                                  {cat.count}x
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-semibold tabular-nums">{currencyFmt(cat.total)}</span>
                                <span className="font-mono text-xs tabular-nums text-muted-foreground">{percent.toFixed(0)}%</span>
                              </div>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${percent}%`, backgroundColor: cat.color }}
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhuma categoria com despesas</p>
                    )}
                  </CardContent>
                </Card>
              </div>
              {/* Savings Rate Trend */}
              <div>
                <Card className="min-w-0 gap-2 rounded-lg py-3 shadow-none">
                  <CardHeader className="px-4 sm:px-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <PiggyBank className="w-4 h-4 text-muted-foreground" />
                        <CardTitle className="text-sm font-semibold">Taxa de Poupança</CardTitle>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {data.savingsRateTrend.length} meses
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 sm:px-5">
                    <div className="space-y-3">
                      {data.savingsRateTrend.map((s) => {
                        const clampedRate = Math.min(Math.max(s.rate, -100), 100);
                        const color = clampedRate >= 30 ? 'bg-[var(--money)]' : clampedRate >= 0 ? 'bg-[var(--obligation)]' : 'bg-[var(--debt)]';
                        const textColor = clampedRate >= 30 ? 'text-[var(--money)]' : clampedRate >= 0 ? 'text-[var(--obligation)]' : 'text-[var(--debt)]';
                        return (
                          <div
                            key={s.month}
                            className="flex items-center gap-3"
                          >
                            <span className="text-xs text-muted-foreground w-16 shrink-0">{s.month}</span>
                            <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full ${color}`}
                                style={{ width: `${Math.max(Math.abs(clampedRate), 2)}%` }}
                              />
                            </div>
                            <span className={`font-mono text-xs font-semibold tabular-nums w-14 text-right ${textColor}`}>
                              {s.rate.toFixed(1)}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </section>
  );
}
