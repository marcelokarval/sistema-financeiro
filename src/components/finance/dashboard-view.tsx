'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, parseISO, startOfMonth, startOfYear, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';
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
  PiggyBank,
  CircleDollarSign,
  Receipt,
  ShoppingBag,
  ArrowLeftRight,
  Eye,
  EyeOff,
  Calendar,
  Filter,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { BudgetGoalsWidget } from './budget-goals';
import { FinancialReportsWidget } from './financial-reports';
import { FinancialHealthScore } from './financial-health-score';
import { RecurringTransactionsWidget } from './recurring-transactions';
import { useScrollReveal } from '@/hooks/use-scroll-reveal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
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
  Area,
  AreaChart,
} from 'recharts';

const currencyFmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const shortCurrency = (v: number) => {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v.toFixed(0);
};

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

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return '☀️ Bom dia!';
  if (hour < 18) return '🌤️ Boa tarde!';
  return '🌙 Boa noite!';
};

// Quick filter presets
const QUICK_FILTERS = [
  { label: 'Este Mês', key: 'month' },
  { label: 'Últimos 3 Meses', key: 'quarter' },
  { label: 'Últimos 6 Meses', key: 'halfyear' },
  { label: 'Este Ano', key: 'year' },
  { label: 'Tudo', key: 'all' },
] as const;

type QuickFilterKey = typeof QUICK_FILTERS[number]['key'];

const getQuickFilterRange = (key: QuickFilterKey) => {
  const now = new Date();
  switch (key) {
    case 'month':
      return {
        from: startOfMonth(now),
        to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      };
    case 'quarter':
      return {
        from: startOfMonth(subMonths(now, 2)),
        to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      };
    case 'halfyear':
      return {
        from: startOfMonth(subMonths(now, 5)),
        to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      };
    case 'year':
      return {
        from: startOfYear(now),
        to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      };
    case 'all':
      return {
        from: new Date(2000, 0, 1),
        to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      };
  }
};

export function DashboardView() {
  useScrollReveal();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedPurchase, setExpandedPurchase] = useState<string | null>(null);
  const [showValues, setShowValues] = useState(true);
  const [activeFilter, setActiveFilter] = useState<QuickFilterKey>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Compute effective date range from active filter or custom dates
  const dateRange = useMemo(() => {
    if (customFrom && customTo) {
      return { from: new Date(customFrom), to: new Date(customTo) };
    }
    return getQuickFilterRange(activeFilter);
  }, [activeFilter, customFrom, customTo]);

  // Format the active range for display
  const filterLabel = useMemo(() => {
    const from = dateRange.from;
    const to = dateRange.to;
    const fromStr = format(from, 'MMM/yy', { locale: ptBR });
    const toStr = format(to, 'MMM/yy', { locale: ptBR });
    if (fromStr === toStr) return fromStr;
    return `${fromStr} - ${toStr}`;
  }, [dateRange]);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const fromISO = dateRange.from.toISOString().split('T')[0];
      const toISO = dateRange.to.toISOString().split('T')[0];
      const res = await fetch(`/api/dashboard?from=${fromISO}&to=${toISO}`);
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error('Failed to fetch dashboard', e);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const handleQuickFilter = (key: QuickFilterKey) => {
    setActiveFilter(key);
    setCustomFrom('');
    setCustomTo('');
  };

  const handleCustomFilter = () => {
    if (customFrom && customTo) {
      setActiveFilter('all'); // Deselect quick filters
    }
  };

  if (loading) {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <motion.div key={i} variants={item}>
              <Skeleton className="h-36 rounded-2xl" />
            </motion.div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </motion.div>
    );
  }

  if (!data) return <p>Erro ao carregar dados.</p>;

  const netMonth = data.monthIncome - data.monthExpense;
  const cardUsagePercent = data.totalCardLimit > 0
    ? (data.totalCardBalance / data.totalCardLimit) * 100 : 0;
  const savingsRate = data.monthIncome > 0
    ? ((data.monthIncome - data.monthExpense) / data.monthIncome) * 100 : 0;

  const mask = (v: string) => showValues ? v : 'R$ ••••••';

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Greeting Banner */}
      <motion.div
        variants={item}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/90 via-primary/80 to-violet-600/90 p-6 sm:p-8 text-primary-foreground shadow-xl shadow-primary/10 glass-enhanced"
      >
        {/* Background decoration with animated mesh */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 animate-breathe" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/10 animate-breathe" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/3 right-1/4 w-16 h-16 rounded-full bg-white/5 animate-breathe" style={{ animationDelay: '0.5s' }} />
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: 'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }} />
        </div>
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary-foreground/80">
              {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold mt-1 tracking-tight">
              {getGreeting()}
            </h2>
            <p className="text-sm text-primary-foreground/70 mt-1.5">
              {data && (
                <>Saldo total: <span className="font-semibold text-white">{mask(currencyFmt(data.totalBalance))}</span>
                {netMonth >= 0 ? (
                  <span className="ml-2 inline-flex items-center gap-1 text-emerald-200">
                    <TrendingUp className="w-3 h-3" /> Superávit de {mask(currencyFmt(netMonth))} este mês
                  </span>
                ) : (
                  <span className="ml-2 inline-flex items-center gap-1 text-rose-200">
                    <TrendingDown className="w-3 h-3" /> Déficit de {mask(currencyFmt(Math.abs(netMonth)))} este mês
                  </span>
                )}
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setShowValues(!showValues)} className="bg-white/10 border-white/20 text-primary-foreground hover:bg-white/20 hover:text-white">
              {showValues ? <Eye className="w-4 h-4 mr-1.5" /> : <EyeOff className="w-4 h-4 mr-1.5" />}
              {showValues ? 'Ocultar' : 'Mostrar'}
            </Button>
            <Button variant="outline" size="icon" onClick={fetchDashboard} className="bg-white/10 border-white/20 text-primary-foreground hover:bg-white/20 hover:text-white">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Date Range Filter Bar */}
      <motion.div
        variants={item}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.35, delay: 0.1 } }}
      >
        <Card className="border shadow-sm bg-card/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Quick filter pills */}
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                {QUICK_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => handleQuickFilter(f.key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 whitespace-nowrap ${
                      activeFilter === f.key && !customFrom && !customTo
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Separator */}
              <div className="hidden sm:block w-px h-6 bg-border shrink-0" />

              {/* Custom date inputs */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <label htmlFor="date-from" className="text-xs text-muted-foreground font-medium">De</label>
                  <input
                    id="date-from"
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="h-8 px-2 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <label htmlFor="date-to" className="text-xs text-muted-foreground font-medium">Até</label>
                  <input
                    id="date-to"
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="h-8 px-2 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleCustomFilter}
                  disabled={!customFrom || !customTo}
                  className="h-8 px-3 text-xs gap-1.5"
                >
                  <Filter className="w-3 h-3" />
                  Filtrar
                </Button>
              </div>

              {/* Active filter indicator */}
              {(customFrom && customTo) || activeFilter !== 'month' ? (
                <div className="flex items-center gap-1.5 ml-auto shrink-0">
                  <Calendar className="w-3 h-3 text-primary" />
                  <span className="text-xs text-primary font-medium">
                    Filtrado: {filterLabel}
                  </span>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 reveal-stagger">
        <motion.div variants={item} className="reveal-on-scroll">
          <Card className="overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 card-glow">
            <div className="h-1 bg-gradient-to-r from-emerald-500 to-emerald-400" />
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total em Contas</p>
                  <p className="text-2xl font-bold mt-2 tracking-tight tabular-nums">{mask(currencyFmt(data.totalBalance))}</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Wallet className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4">
                {data.accountBalances.slice(0, 3).map((acc: any) => (
                  <div key={acc.accountId} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.accountColor }} />
                    <span className="text-[10px] text-muted-foreground">{acc.accountName.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item} className="reveal-on-scroll">
          <Card className="overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 card-glow">
            <div className="h-1 bg-gradient-to-r from-rose-500 to-pink-500" />
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Fatura Cartões</p>
                  <p className="text-2xl font-bold mt-2 tracking-tight tabular-nums text-rose-500">
                    {mask(currencyFmt(data.totalCardBalance))}
                  </p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Limite usado</span>
                  <span className="font-medium">{cardUsagePercent.toFixed(0)}%</span>
                </div>
                <Progress value={cardUsagePercent} className="h-1.5" />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Disponível: {mask(currencyFmt(data.totalCardLimit - data.totalCardBalance))}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item} className="reveal-on-scroll">
          <Card className="overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 card-glow">
            <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-400" />
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Renda Mensal</p>
                  <p className="text-2xl font-bold mt-2 tracking-tight tabular-nums text-emerald-500">
                    {mask(currencyFmt(data.monthIncome))}
                  </p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-3">
                <div className="w-5 h-5 rounded-md bg-emerald-500/10 flex items-center justify-center">
                  <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                </div>
                <span className="text-xs text-foreground/60 font-medium">Entradas do mês</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item} className="reveal-on-scroll">
          <Card className="overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 card-glow">
            <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-400" />
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Despesas Mensais</p>
                  <p className="text-2xl font-bold mt-2 tracking-tight tabular-nums text-rose-500">
                    {mask(currencyFmt(data.monthExpense))}
                  </p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <TrendingDown className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 min-w-0">
                <Badge variant={netMonth >= 0 ? 'default' : 'destructive'} className="text-[10px] shrink-0">
                  {netMonth >= 0 ? 'Superávit' : 'Déficit'}: {mask(currencyFmt(Math.abs(netMonth)))}
                </Badge>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  Poupança: {savingsRate.toFixed(0)}%
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 card-elevated hover-lift focus-gradient">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center transition-all duration-300">
              <PiggyBank className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Patrimônio Total</p>
              <p className="text-sm font-bold">{mask(currencyFmt(data.totalBalance - data.totalCardBalance))}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-violet-500/10 to-violet-500/5 border-violet-500/20 card-elevated hover-lift focus-gradient">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center transition-all duration-300">
              <Receipt className="w-4 h-4 text-violet-500" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Compras no Mês</p>
              <p className="text-sm font-bold">{data.recentPurchases.length} compras</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20 card-elevated hover-lift focus-gradient">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center transition-all duration-300">
              <ArrowLeftRight className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Transações</p>
              <p className="text-sm font-bold">{data.recentTransactions.length} recentes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20 card-elevated hover-lift focus-gradient">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center transition-all duration-300">
              <CircleDollarSign className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Gasto Médio/dia</p>
              <p className="text-sm font-bold">{mask(currencyFmt(data.monthExpense / new Date().getDate()))}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Month-over-Month Trend */}
      {data.monthlyTrend.length >= 2 && (
        <motion.div variants={item}>
          <Card className="border-0 shadow-md hover:shadow-xl transition-all duration-300 card-glow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <ArrowLeftRight className="w-4 h-4 text-primary" />
                    Comparativo Mensal
                  </CardTitle>
                  <CardDescription>Variação mês a mês nos últimos 6 meses</CardDescription>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {data.monthlyTrend.length} meses
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {data.monthlyTrend.map((m: any, idx: number) => {
                  const prevIdx = idx - 1;
                  const incomeChange = prevIdx >= 0 && data.monthlyTrend[prevIdx].income > 0
                    ? ((m.income - data.monthlyTrend[prevIdx].income) / data.monthlyTrend[prevIdx].income) * 100
                    : 0;
                  const expenseChange = prevIdx >= 0 && data.monthlyTrend[prevIdx].expense > 0
                    ? ((m.expense - data.monthlyTrend[prevIdx].expense) / data.monthlyTrend[prevIdx].expense) * 100
                    : 0;

                  return (
                    <div key={m.month} className="text-center p-3 rounded-xl bg-muted/30 border border-border/30">
                      <p className="text-xs text-muted-foreground font-medium truncate">{m.month}</p>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-[9px] text-emerald-500">↑</span>
                          <span className="text-xs font-bold text-emerald-500">
                            {incomeChange >= 0 ? '+' : ''}{incomeChange.toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex items-center justify-center gap-1">
                          <span className={`text-[9px] ${expenseChange <= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {expenseChange <= 0 ? '↓' : '↑'}
                          </span>
                          <span className={`text-xs font-bold ${expenseChange <= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {expenseChange >= 0 ? '+' : ''}{expenseChange.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-1.5">
                        {mask(currencyFmt(m.income - m.expense))}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Financial Health Score */}
      <motion.div variants={item}>
        <FinancialHealthScore />
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={item} className="lg:col-span-2">
          <Card className="border-0 shadow-md hover:shadow-xl transition-all duration-300 card-glow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Receitas vs Despesas</CardTitle>
                  <CardDescription>Evolução nos últimos 6 meses</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.monthlyTrend}>
                    <defs>
                      <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} tickFormatter={shortCurrency} />
                    <RechartsTooltip
                      formatter={(value: number, name: string) => [currencyFmt(value), name === 'income' ? 'Receitas' : 'Despesas']}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                    />
                    <Area type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2.5} fillOpacity={1} fill="url(#colorIncome)" name="Receitas" dot={{ r: 3, fill: '#22c55e', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#22c55e', strokeWidth: 2, stroke: '#fff' }} />
                    <Area type="monotone" dataKey="expense" stroke="#f97316" strokeWidth={2.5} fillOpacity={1} fill="url(#colorExpense)" name="Despesas" dot={{ r: 3, fill: '#f97316', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#f97316', strokeWidth: 2, stroke: '#fff' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="border-0 shadow-md h-full hover:shadow-xl transition-all duration-300 card-glow">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Despesas por Categoria</CardTitle>
              <CardDescription>Distribuição no mês</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.expenseByCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="total"
                      nameKey="categoryName"
                      strokeWidth={0}
                    >
                      {data.expenseByCategory.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value: number) => currencyFmt(value)}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-2">
                {data.expenseByCategory.slice(0, 4).map((cat: any, idx: number) => (
                  <div key={cat.categoryId} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="text-muted-foreground">{cat.categoryName}</span>
                    </div>
                    <span className="font-medium">{mask(currencyFmt(cat.total))}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Account Balances */}
      {data.accountBalances.length > 0 && (
        <motion.div variants={item}>
          <Card className="border-0 shadow-md hover:shadow-xl transition-all duration-300 card-glow">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Distribuição por Conta</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.accountBalances.map((acc: any) => {
                  const percent = data.totalBalance > 0 ? (acc.balance / data.totalBalance) * 100 : 0;
                  return (
                    <div key={acc.accountId} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${acc.accountColor}15` }}>
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: acc.accountColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium truncate">{acc.accountName}</span>
                          <span className="text-sm font-semibold">{mask(currencyFmt(acc.balance))}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percent}%` }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: acc.accountColor }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Recent Transactions & Purchases */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={item}>
          <Card className="border-0 shadow-md hover:shadow-xl transition-all duration-300 card-glow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Últimas Transações</CardTitle>
                <Badge variant="secondary" className="text-[10px]">{data.recentTransactions.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                {data.recentTransactions.map((t: any) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-accent/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${t.type === 'INCOME' ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                        {t.type === 'INCOME' ? (
                          <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 text-rose-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.description}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {dateFmt(t.date)}
                          {t.category && (
                            <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ backgroundColor: `${t.category.color}15`, color: t.category.color }}>
                              {t.category.name}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold whitespace-nowrap ml-2 ${t.type === 'INCOME' ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {t.type === 'INCOME' ? '+' : '-'}{mask(currencyFmt(t.amount))}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="border-0 shadow-md hover:shadow-xl transition-all duration-300 card-glow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Compras Recentes</CardTitle>
                <Badge variant="secondary" className="text-[10px]">{data.recentPurchases.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {data.recentPurchases.map((p: any) => (
                  <div key={p.id} className="border border-border/50 rounded-xl overflow-hidden">
                    <button
                      className="flex items-center justify-between w-full p-3 hover:bg-accent/30 transition-colors"
                      onClick={() => setExpandedPurchase(expandedPurchase === p.id ? null : p.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                          <ShoppingBag className="w-4 h-4 text-violet-500" />
                        </div>
                        <div className="min-w-0 text-left">
                          <p className="text-sm font-medium truncate">{p.merchant}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {dateFmt(p.date)}
                            {p.card && <span className="ml-1">· {p.card.name}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold">{mask(currencyFmt(p.totalAmount))}</span>
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {p.items?.length || 0} itens
                        </span>
                        {expandedPurchase === p.id ? (
                          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                    {expandedPurchase === p.id && p.items && p.items.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-border/50"
                      >
                        <div className="p-3 bg-muted/30 space-y-1">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            Itens da Compra
                          </p>
                          {p.items.map((it: any) => (
                            <div key={it.id} className="flex items-center justify-between text-xs pl-3 py-0.5">
                              <span className="text-muted-foreground truncate flex-1">
                                <span className="text-foreground/60 mr-1">{it.quantity}x</span>
                                {it.name}
                              </span>
                              <span className="font-medium whitespace-nowrap ml-3 text-[11px]">
                                {mask(currencyFmt(it.totalPrice))}
                              </span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Financial Reports Widget */}
      <motion.div variants={item}>
        <FinancialReportsWidget />
      </motion.div>

      {/* Recurring Transactions Widget */}
      <motion.div variants={item}>
        <RecurringTransactionsWidget />
      </motion.div>

      {/* Budget Goals Widget */}
      <motion.div variants={item}>
        <BudgetGoalsWidget />
      </motion.div>
    </motion.div>
  );
}
