'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PiggyBank,
  CreditCard,
  ShoppingCart,
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
import { Progress } from '@/components/ui/progress';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

// ─── Helpers ───────────────────────────────────────────────────────
const currencyFmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

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
  scale: 1.01,
  transition: { type: 'spring', stiffness: 300, damping: 20 },
};

// ─── Component ─────────────────────────────────────────────────────
export function FinancialReportsWidget() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('monthly');

  const fetchReports = useCallback(async () => {
    try {
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

  // ─── Loading skeleton ────────────────────────────────────────────
  if (loading) {
    return (
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="h-9 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-64 w-full rounded-xl" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return <p className="text-sm text-muted-foreground">Erro ao carregar relatórios.</p>;

  // ─── Derived values ──────────────────────────────────────────────
  const chartData = data.monthlyData.map((m) => ({
    month: m.month,
    Receitas: m.income,
    Despesas: m.expense,
  }));

  const totalExpenseAcrossPeriod = data.topCategories.reduce((s, c) => s + c.total, 0);

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <motion.div variants={container} initial="hidden" animate="show">
      <Card className="border-0 shadow-md overflow-hidden">
        {/* Gradient top border */}
        <div className="h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />

        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Relatórios Financeiros</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Análise comparativa dos últimos {data.monthlyData.length} meses
                </p>
              </div>
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={fetchReports}>
              <BarChart3 className="w-4 h-4" />
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-3">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="monthly" className="text-xs">Visão Mensal</TabsTrigger>
              <TabsTrigger value="analysis" className="text-xs">Análise</TabsTrigger>
            </TabsList>

            {/* ═══════════════════════════════════════════════════════════
                TAB 1 — VISÃO MENSAL
            ═══════════════════════════════════════════════════════════ */}
            <TabsContent value="monthly" className="mt-4 space-y-4">
              {/* Bar Chart */}
              <motion.div variants={item} initial="hidden" animate="show">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barGap={2} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} tickFormatter={shortCurrency} />
                      <RechartsTooltip
                        formatter={(value: number, name: string) => [currencyFmt(value), name]}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '12px',
                          fontSize: '12px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        }}
                      />
                      <Bar dataKey="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Despesas" fill="#f97316" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              {/* Monthly detail list */}
              <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
                {data.monthlyData.map((m, idx) => {
                  const prev = idx > 0 ? data.monthlyData[idx - 1] : null;
                  const incomeChange = prev && prev.income > 0 ? ((m.income - prev.income) / prev.income) * 100 : null;
                  const expenseChange = prev && prev.expense > 0 ? ((m.expense - prev.expense) / prev.expense) * 100 : null;

                  return (
                    <motion.div
                      key={m.month}
                      variants={item}
                      whileHover={cardHover}
                      className="flex items-center gap-3 p-3 rounded-xl bg-accent/30 hover:bg-accent/50 transition-colors"
                    >
                      {/* Month label */}
                      <div className="w-16 shrink-0">
                        <p className="text-sm font-semibold">{m.month}</p>
                        <p className="text-[10px] text-muted-foreground">{m.transactionCount + m.purchaseCount} mov.</p>
                      </div>

                      {/* Income */}
                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-xs text-muted-foreground">Receitas</p>
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-sm font-semibold text-emerald-500">
                            {currencyFmt(m.income)}
                          </span>
                          {incomeChange !== null && (
                            <span className={`text-[10px] font-medium flex items-center gap-0.5 ${incomeChange >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {incomeChange >= 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                              {pctFmt(incomeChange)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Separator */}
                      <div className="w-px h-8 bg-border shrink-0" />

                      {/* Expense */}
                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-xs text-muted-foreground">Despesas</p>
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-sm font-semibold text-rose-500">
                            {currencyFmt(m.expense)}
                          </span>
                          {expenseChange !== null && (
                            <span className={`text-[10px] font-medium flex items-center gap-0.5 ${expenseChange <= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {expenseChange <= 0 ? <ArrowDownRight className="w-2.5 h-2.5" /> : <ArrowUpRight className="w-2.5 h-2.5" />}
                              {pctFmt(expenseChange)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Separator */}
                      <div className="w-px h-8 bg-border shrink-0" />

                      {/* Net */}
                      <div className="w-24 shrink-0 text-right">
                        <p className="text-xs text-muted-foreground">Líquido</p>
                        <span className={`text-sm font-bold ${m.net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {m.net >= 0 ? '+' : ''}{currencyFmt(m.net)}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </TabsContent>

            {/* ═══════════════════════════════════════════════════════════
                TAB 2 — ANÁLISE
            ═══════════════════════════════════════════════════════════ */}
            <TabsContent value="analysis" className="mt-4 space-y-4">
              {/* Key Metrics Cards */}
              <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Ticket Médio */}
                <motion.div variants={item} whileHover={cardHover}>
                  <Card className="bg-gradient-to-br from-violet-500/10 to-violet-500/5 border-violet-500/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                          <Receipt className="w-4 h-4 text-violet-500" />
                        </div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Ticket Médio</p>
                      </div>
                      <p className="text-lg font-bold">{currencyFmt(data.ticketMedio)}</p>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Gasto Médio/Dia */}
                <motion.div variants={item} whileHover={cardHover}>
                  <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                          <DollarSign className="w-4 h-4 text-amber-500" />
                        </div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Gasto Médio/dia</p>
                      </div>
                      <p className="text-lg font-bold text-rose-500">{currencyFmt(data.avgDailySpend)}</p>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Maior Despesa */}
                <motion.div variants={item} whileHover={cardHover}>
                  <Card className="bg-gradient-to-br from-rose-500/10 to-rose-500/5 border-rose-500/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                          <CreditCard className="w-4 h-4 text-rose-500" />
                        </div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Maior Despesa</p>
                      </div>
                      {data.highestExpense ? (
                        <>
                          <p className="text-lg font-bold text-rose-500">{currencyFmt(data.highestExpense.amount)}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{data.highestExpense.description}</p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Sem dados</p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Menor Receita */}
                <motion.div variants={item} whileHover={cardHover}>
                  <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                          <PiggyBank className="w-4 h-4 text-emerald-500" />
                        </div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Menor Receita</p>
                      </div>
                      {data.lowestIncome ? (
                        <>
                          <p className="text-lg font-bold text-emerald-500">{currencyFmt(data.lowestIncome.amount)}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{data.lowestIncome.description}</p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Sem dados</p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>

              {/* Top 3 Expense Categories */}
              <motion.div variants={item} initial="hidden" animate="show">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-muted-foreground" />
                      <CardTitle className="text-sm font-semibold">Top Categorias de Despesa</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {data.topCategories.length > 0 ? (
                      data.topCategories.map((cat, idx) => {
                        const percent = totalExpenseAcrossPeriod > 0 ? (cat.total / totalExpenseAcrossPeriod) * 100 : 0;
                        return (
                          <motion.div
                            key={cat.name}
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.4, delay: 0.1 + idx * 0.1 }}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: cat.color }} />
                                <span className="text-sm font-medium">{cat.name}</span>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {cat.count}x
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold">{currencyFmt(cat.total)}</span>
                                <span className="text-[10px] text-muted-foreground">{percent.toFixed(0)}%</span>
                              </div>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${percent}%` }}
                                transition={{ duration: 0.8, delay: 0.2 + idx * 0.1, ease: 'easeOut' }}
                                className="h-full rounded-full"
                                style={{ backgroundColor: cat.color }}
                              />
                            </div>
                          </motion.div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhuma categoria com despesas</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Savings Rate Trend */}
              <motion.div variants={item} initial="hidden" animate="show">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <PiggyBank className="w-4 h-4 text-muted-foreground" />
                        <CardTitle className="text-sm font-semibold">Taxa de Poupança</CardTitle>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">
                        {data.savingsRateTrend.length} meses
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {data.savingsRateTrend.map((s, idx) => {
                        const clampedRate = Math.min(Math.max(s.rate, -100), 100);
                        const color = clampedRate >= 30 ? 'bg-emerald-500' : clampedRate >= 0 ? 'bg-amber-500' : 'bg-rose-500';
                        const textColor = clampedRate >= 30 ? 'text-emerald-500' : clampedRate >= 0 ? 'text-amber-500' : 'text-rose-500';

                        return (
                          <motion.div
                            key={s.month}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.15 + idx * 0.06 }}
                            className="flex items-center gap-3"
                          >
                            <span className="text-xs text-muted-foreground w-16 shrink-0">{s.month}</span>
                            <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.max(Math.abs(clampedRate), 2)}%` }}
                                transition={{ duration: 0.7, delay: 0.25 + idx * 0.06, ease: 'easeOut' }}
                                className={`h-full rounded-full ${color}`}
                              />
                            </div>
                            <span className={`text-xs font-semibold w-14 text-right ${textColor}`}>
                              {s.rate.toFixed(1)}%
                            </span>
                          </motion.div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </Tabs>
        </CardHeader>
      </Card>
    </motion.div>
  );
}
