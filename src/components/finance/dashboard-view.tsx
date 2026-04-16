'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const currencyFmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const dateFmt = (d: string) => {
  try { return format(parseISO(d), 'dd/MM/yyyy', { locale: ptBR }); }
  catch { return d; }
};

interface DashboardData {
  totalBalance: number;
  totalCardBalance: number;
  totalCardLimit: number;
  monthIncome: number;
  monthExpense: number;
  recentTransactions: any[];
  recentPurchases: any[];
  expenseByCategory: any[];
  monthlyTrend: any[];
  accountBalances: any[];
}

const COLORS = ['#22c55e', '#f97316', '#3b82f6', '#ef4444', '#a855f7', '#ec4899', '#f59e0b', '#64748b', '#06b6d4', '#84cc16', '#8b5cf6', '#94a3b8'];

export function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedPurchase, setExpandedPurchase] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error('Failed to fetch dashboard', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) return <p>Erro ao carregar dados.</p>;

  const netMonth = data.monthIncome - data.monthExpense;
  const cardAvailable = data.totalCardLimit - data.totalCardBalance;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total em Contas</p>
                <p className="text-2xl font-bold mt-1">{currencyFmt(data.totalBalance)}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Fatura Cartões</p>
                <p className="text-2xl font-bold mt-1">{currencyFmt(data.totalCardBalance)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Limite: {currencyFmt(data.totalCardLimit)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-rose-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Renda Mensal</p>
                <p className="text-2xl font-bold mt-1 text-emerald-500">{currencyFmt(data.monthIncome)}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Despesas Mensais</p>
                <p className="text-2xl font-bold mt-1 text-rose-500">{currencyFmt(data.monthExpense)}</p>
                <p className="text-xs mt-0.5 flex items-center gap-1">
                  {netMonth >= 0 ? (
                    <span className="text-emerald-500 font-medium">
                      <ArrowUpRight className="w-3 h-3 inline" /> Saldo: {currencyFmt(netMonth)}
                    </span>
                  ) : (
                    <span className="text-rose-500 font-medium">
                      <ArrowDownRight className="w-3 h-3 inline" /> Saldo: {currencyFmt(netMonth)}
                    </span>
                  )}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Receitas vs Despesas</CardTitle>
                <CardDescription>Últimos 6 meses</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={fetchDashboard}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlyTrend} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <RechartsTooltip
                    formatter={(value: number, name: string) => [
                      currencyFmt(value),
                      name === 'income' ? 'Receitas' : 'Despesas',
                    ]}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '13px',
                    }}
                  />
                  <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} name="Receitas" />
                  <Bar dataKey="expense" fill="#f97316" radius={[4, 4, 0, 0]} name="Despesas" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Despesas por Categoria</CardTitle>
            <CardDescription>Mês atual</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.expenseByCategory}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="total"
                    nameKey="categoryName"
                  >
                    {data.expenseByCategory.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value: number) => currencyFmt(value)}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '13px',
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value) => (
                      <span className="text-xs text-muted-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Account Balances */}
      {data.accountBalances.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Saldos das Contas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {data.accountBalances.map((acc: any) => (
                <div
                  key={acc.accountId}
                  className="p-3 rounded-lg border border-border bg-background"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: acc.accountColor }}
                    />
                    <span className="text-xs text-muted-foreground truncate">
                      {acc.accountName}
                    </span>
                  </div>
                  <p className="text-sm font-semibold">{currencyFmt(acc.balance)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions & Purchases */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Transações Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.recentTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma transação recente
                </p>
              ) : (
                data.recentTransactions.map((t: any) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          t.type === 'INCOME' ? 'bg-emerald-500/10' : 'bg-rose-500/10'
                        }`}
                      >
                        {t.type === 'INCOME' ? (
                          <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 text-rose-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {dateFmt(t.date)}
                          {t.category && ` · ${t.category.name}`}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-sm font-semibold whitespace-nowrap ml-2 ${
                        t.type === 'INCOME' ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {t.type === 'INCOME' ? '+' : '-'}
                      {currencyFmt(t.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Compras Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.recentPurchases.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma compra recente
                </p>
              ) : (
                data.recentPurchases.map((p: any) => (
                  <div key={p.id} className="border border-border rounded-lg">
                    <button
                      className="flex items-center justify-between w-full p-3 hover:bg-accent/30 transition-colors rounded-lg"
                      onClick={() =>
                        setExpandedPurchase(expandedPurchase === p.id ? null : p.id)
                      }
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0">
                          <CreditCard className="w-4 h-4 text-violet-500" />
                        </div>
                        <div className="min-w-0 text-left">
                          <p className="text-sm font-medium truncate">{p.merchant}</p>
                          <p className="text-xs text-muted-foreground">
                            {dateFmt(p.date)}
                            {p.card && ` · ${p.card.name}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-rose-500">
                          {currencyFmt(p.totalAmount)}
                        </span>
                        {expandedPurchase === p.id ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                    {expandedPurchase === p.id && p.items && p.items.length > 0 && (
                      <div className="border-t border-border px-3 pb-3 pt-2">
                        <div className="space-y-1.5">
                          {p.items.map((item: any) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between text-xs pl-11"
                            >
                              <span className="text-muted-foreground truncate">
                                {item.quantity}x {item.name}
                              </span>
                              <span className="font-medium whitespace-nowrap ml-2">
                                {currencyFmt(item.totalPrice)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
