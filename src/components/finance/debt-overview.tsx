'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  CreditCard,
  CalendarClock,
  Building2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  TrendingDown,
  Percent,
  Activity,
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
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';

// ─── Helpers ───────────────────────────────────────────────────────
const currencyFmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

// ─── Types ─────────────────────────────────────────────────────────
interface CardDebt {
  id: string;
  name: string;
  brand: string;
  lastFourDigits: string;
  creditLimit: number;
  currentBalance: number;
  utilizationRate: number;
  color: string;
  dueDay: number;
}

interface InstallmentDebt {
  id: string;
  description: string;
  totalAmount: number;
  paidAmount: number;
  remaining: number;
  installmentCount: number;
  paidInstallments: number;
  monthlyValue: number;
  interestRate: number;
  type: string;
  status: string;
  cardName: string | null;
  nextPaymentDate: string | null;
}

interface ConsortiumDebt {
  id: string;
  description: string;
  group: string;
  quota: string;
  administrator: string;
  totalAmount: number;
  fundedAmount: number;
  remaining: number;
  monthlyPayment: number;
  installmentCount: number;
  paidInstallments: number;
  startDate: string;
  endDate: string | null;
  status: string;
  progress: number;
}

interface DebtsData {
  totalDebt: number;
  cardDebt: number;
  installmentDebt: number;
  consortiumDebt: number;
  debtToIncomeRatio: number;
  monthlyIncome: number;
  cards: CardDebt[];
  installments: InstallmentDebt[];
  consortiums: ConsortiumDebt[];
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
  scale: 1.02,
  transition: { type: 'spring', stiffness: 300, damping: 20 },
};

const listItem = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

// ─── Donut Chart Colors ────────────────────────────────────────────
const PIE_COLORS = ['#f43f5e', '#f97316', '#f59e0b'];

// ─── Custom Tooltip ────────────────────────────────────────────────
function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { fill: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="bg-background border border-border rounded-xl p-3 shadow-lg">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.payload.fill }} />
        <span className="text-xs font-medium">{entry.name}</span>
      </div>
      <p className="text-sm font-bold">{currencyFmt(entry.value)}</p>
    </div>
  );
}

// ─── Donut Center Label ────────────────────────────────────────────
function DonutCenterLabel({ total }: { total: number }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
      <motion.p
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="text-lg sm:text-xl font-bold text-foreground"
      >
        {currencyFmt(total)}
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.3 }}
        className="text-[10px] sm:text-xs text-muted-foreground font-medium"
      >
        Total em Dívidas
      </motion.p>
    </div>
  );
}

// ─── Type Label Helper ─────────────────────────────────────────────
function typeLabel(type: string) {
  const map: Record<string, string> = {
    FINANCING: 'Financiamento',
    CARD_INSTALLMENT: 'Parcelamento Cartão',
    LOAN: 'Empréstimo',
    PERSONAL: 'Empréstimo Pessoal',
    RENTAL: 'Aluguel',
  };
  return map[type] || type;
}

function statusBadge(status: string) {
  const config: Record<string, { label: string; className: string }> = {
    ACTIVE: { label: 'Ativo', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
    OVERDUE: { label: 'Atrasado', className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
    COMPLETED: { label: 'Concluído', className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' },
    CONTEMPLATED: { label: 'Contemplado', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  };
  const c = config[status] || config.ACTIVE;
  return <Badge className={`text-[10px] px-2 py-0 border ${c.className}`}>{c.label}</Badge>;
}

// ─── Main Component ────────────────────────────────────────────────
export function DebtOverview() {
  const [data, setData] = useState<DebtsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedType, setExpandedType] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/debts');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error('Erro ao buscar dívidas:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Loading Skeleton ─────────────────────────────────────────────
  if (loading) {
    return (
      <Card className="border-0 shadow-md">
        <div className="h-1 bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500" />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <Skeleton className="h-8 w-36 rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col sm:flex-row gap-6 items-center">
            <Skeleton className="h-56 w-56 sm:h-64 sm:w-64 rounded-full shrink-0" />
            <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          </div>
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="border-0 shadow-md">
        <div className="h-1 bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500" />
        <CardContent className="py-12 flex flex-col items-center justify-center gap-3">
          <Activity className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar o painel de dívidas.
          </p>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ─── Pie chart data ──────────────────────────────────────────────
  const hasDebt = data.totalDebt > 0;
  const pieData = hasDebt
    ? [
        { name: 'Cartões', value: data.cardDebt },
        { name: 'Parcelas', value: data.installmentDebt },
        { name: 'Consórcios', value: data.consortiumDebt },
      ].filter((d) => d.value > 0)
    : [];

  // ─── Debt-to-income ratio ────────────────────────────────────────
  const ratio = data.debtToIncomeRatio;
  const ratioLevel =
    ratio > 30
      ? 'critical'
      : ratio > 15
        ? 'warning'
        : 'healthy';

  const ratioConfig = {
    critical: {
      barColor: '#f43f5e',
      bgClass: 'bg-rose-500/5 border-rose-500/20',
      textClass: 'text-rose-700 dark:text-rose-400',
      iconBg: 'bg-rose-500/10',
      label: 'Crítico',
      recommendation:
        'Suas dívidas comprometem mais de 30% da sua renda. Considere renegociar taxas, priorizar a quitação de cartões e evitar novas dívidas.',
    },
    warning: {
      barColor: '#f59e0b',
      bgClass: 'bg-amber-500/5 border-amber-500/20',
      textClass: 'text-amber-700 dark:text-amber-400',
      iconBg: 'bg-amber-500/10',
      label: 'Atenção',
      recommendation:
        'Suas dívidas estão entre 15% e 30% da sua renda. Mantenha o controle, evite novas aquisições e priorize o pagamento antecipado.',
    },
    healthy: {
      barColor: '#22c55e',
      bgClass: 'bg-emerald-500/5 border-emerald-500/20',
      textClass: 'text-emerald-700 dark:text-emerald-400',
      iconBg: 'bg-emerald-500/10',
      label: 'Saudável',
      recommendation:
        'Ótimo! Suas dívidas estão abaixo de 15% da sua renda. Continue com esse controle financeiro e mantenha o equilíbrio.',
    },
  };

  const currentRatio = ratioConfig[ratioLevel];
  const clampedRatio = Math.min(ratio, 100);

  // ─── Toggle expand ───────────────────────────────────────────────
  const toggleExpand = (type: string) => {
    setExpandedType((prev) => (prev === type ? null : type));
  };

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <motion.div variants={container} initial="hidden" animate="show">
      <Card className="border-0 shadow-md overflow-hidden">
        {/* Gradient top border */}
        <div className="h-1 bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500" />

        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-rose-500 to-orange-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  Painel de Dívidas
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Acompanhe todas as suas obrigações financeiras
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                className={`text-xs px-3 py-1 border ${
                  data.totalDebt > 0
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                }`}
              >
                <TrendingDown className="w-3.5 h-3.5 mr-1.5" />
                {currencyFmt(data.totalDebt)}
              </Badge>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={fetchData}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* ═══════════════════════════════════════════════════════════
              DONUT CHART + DEBT TYPE CARDS
          ═══════════════════════════════════════════════════════════ */}
          <motion.div variants={item}>
            <div className="flex flex-col lg:flex-row gap-6 items-center lg:items-start">
              {/* Donut Chart */}
              <div className="relative w-56 h-56 sm:w-64 sm:h-64 shrink-0">
                {hasDebt ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius="55%"
                        outerRadius="80%"
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                        animationBegin={200}
                        animationDuration={800}
                        animationEasing="ease-out"
                      >
                        {pieData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index]}
                            className="stroke-0"
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[{ name: 'Sem dívidas', value: 1 }]}
                          cx="50%"
                          cy="50%"
                          innerRadius="55%"
                          outerRadius="80%"
                          dataKey="value"
                          fill="var(--muted)"
                          strokeWidth={0}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <DonutCenterLabel total={data.totalDebt} />
              </div>

              {/* 3 Debt Type Cards */}
              <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Cartões de Crédito */}
                <motion.div variants={item} whileHover={cardHover}>
                  <button
                    onClick={() => data.cards.length > 0 && toggleExpand('cards')}
                    className={`w-full text-left rounded-xl border border-border/60 bg-card p-4 shadow-sm hover:shadow-md transition-all ${
                      expandedType === 'cards' ? 'ring-2 ring-rose-500/30' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center shadow-sm">
                        <CreditCard className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {data.cards.length}
                        </Badge>
                        {data.cards.length > 0 && (
                          expandedType === 'cards'
                            ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium mb-1">
                      Cartões de Crédito
                    </p>
                    <p className="text-lg font-bold text-rose-600 dark:text-rose-400">
                      {currencyFmt(data.cardDebt)}
                    </p>
                  </button>
                </motion.div>

                {/* Parcelamentos */}
                <motion.div variants={item} whileHover={cardHover}>
                  <button
                    onClick={() => data.installments.length > 0 && toggleExpand('installments')}
                    className={`w-full text-left rounded-xl border border-border/60 bg-card p-4 shadow-sm hover:shadow-md transition-all ${
                      expandedType === 'installments' ? 'ring-2 ring-orange-500/30' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-sm">
                        <CalendarClock className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {data.installments.length}
                        </Badge>
                        {data.installments.length > 0 && (
                          expandedType === 'installments'
                            ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium mb-1">
                      Parcelamentos
                    </p>
                    <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                      {currencyFmt(data.installmentDebt)}
                    </p>
                  </button>
                </motion.div>

                {/* Consórcios */}
                <motion.div variants={item} whileHover={cardHover}>
                  <button
                    onClick={() => data.consortiums.length > 0 && toggleExpand('consortiums')}
                    className={`w-full text-left rounded-xl border border-border/60 bg-card p-4 shadow-sm hover:shadow-md transition-all ${
                      expandedType === 'consortiums' ? 'ring-2 ring-amber-500/30' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-sm">
                        <Building2 className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {data.consortiums.length}
                        </Badge>
                        {data.consortiums.length > 0 && (
                          expandedType === 'consortiums'
                            ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium mb-1">
                      Consórcios
                    </p>
                    <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                      {currencyFmt(data.consortiumDebt)}
                    </p>
                  </button>
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* ═══════════════════════════════════════════════════════════
              DEBT-TO-INCOME RATIO GAUGE
          ═══════════════════════════════════════════════════════════ */}
          <motion.div variants={item}>
            <div className={`rounded-xl border p-4 ${currentRatio.bgClass}`}>
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-lg ${currentRatio.iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
                  <Percent className="w-5 h-5" style={{ color: currentRatio.barColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className={`text-sm font-semibold ${currentRatio.textClass}`}>
                      Comprometimento de Renda
                    </p>
                    <Badge className={`text-[10px] px-2 py-0 border ${currentRatio.bgClass} ${currentRatio.textClass}`}>
                      {currentRatio.label}
                    </Badge>
                  </div>
                  <p className={`text-xs ${currentRatio.textClass} leading-relaxed mb-3`}>
                    {currentRatio.recommendation}
                  </p>
                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground font-medium">
                        Endividamento / Renda mensal
                      </span>
                      <span className={`text-[11px] font-bold ${currentRatio.textClass}`}>
                        {ratio.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden relative">
                      {/* 15% marker */}
                      <div
                        className="absolute top-0 bottom-0 w-px bg-emerald-500/40 z-10"
                        style={{ left: '15%' }}
                      />
                      {/* 30% marker */}
                      <div
                        className="absolute top-0 bottom-0 w-px bg-rose-500/40 z-10"
                        style={{ left: '30%' }}
                      />
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${clampedRatio}%` }}
                        transition={{ duration: 1, delay: 0.4, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: currentRatio.barColor }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-muted-foreground">0%</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] text-emerald-500 font-medium">15%</span>
                        <span className="text-[9px] text-rose-500 font-medium">30%</span>
                      </div>
                      <span className="text-[9px] text-muted-foreground">100%</span>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span>Renda mensal:</span>
                    <span className="font-semibold text-foreground">{currencyFmt(data.monthlyIncome)}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ═══════════════════════════════════════════════════════════
              EXPANDABLE DEBT LISTS
          ═══════════════════════════════════════════════════════════ */}
          <AnimatePresence mode="wait">
            {/* Cards Detail */}
            {expandedType === 'cards' && data.cards.length > 0 && (
              <motion.div
                key="cards-list"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-rose-500" />
                    <span className="text-xs font-semibold">Cartões de Crédito</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {data.cards.length} cartão(ões)
                    </Badge>
                    <Badge className="text-[10px] px-2 py-0 bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20">
                      {currencyFmt(data.cardDebt)}
                    </Badge>
                  </div>
                  <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="divide-y divide-border/40 max-h-96 overflow-y-auto"
                  >
                    {data.cards.map((card) => (
                      <motion.div
                        key={card.id}
                        variants={listItem}
                        className="px-4 py-3 hover:bg-accent/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: card.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium truncate">{card.name}</span>
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                {card.brand}
                              </Badge>
                              <span className="text-[11px] text-muted-foreground">
                                ****{card.lastFourDigits}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                                {currencyFmt(card.currentBalance)}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                Limite: {currencyFmt(card.creditLimit)}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                Vencimento: dia {card.dueDay}
                              </span>
                            </div>
                            {/* Utilization bar */}
                            <div className="mt-1.5 flex items-center gap-2">
                              <div className="h-1.5 flex-1 max-w-[120px] rounded-full bg-muted overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.min(100, card.utilizationRate)}%` }}
                                  transition={{ duration: 0.6, delay: 0.2 }}
                                  className="h-full rounded-full"
                                  style={{
                                    backgroundColor:
                                      card.utilizationRate > 80
                                        ? '#f43f5e'
                                        : card.utilizationRate > 50
                                          ? '#f59e0b'
                                          : '#22c55e',
                                  }}
                                />
                              </div>
                              <span className="text-[9px] text-muted-foreground">
                                {card.utilizationRate.toFixed(0)}% usado
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                </div>
              </motion.div>
            )}

            {/* Installments Detail */}
            {expandedType === 'installments' && data.installments.length > 0 && (
              <motion.div
                key="installments-list"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-orange-500" />
                    <span className="text-xs font-semibold">Parcelamentos</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {data.installments.length} plano(s)
                    </Badge>
                    <Badge className="text-[10px] px-2 py-0 bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20">
                      {currencyFmt(data.installmentDebt)}
                    </Badge>
                  </div>
                  <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="divide-y divide-border/40 max-h-96 overflow-y-auto"
                  >
                    {data.installments.map((ip) => (
                      <motion.div
                        key={ip.id}
                        variants={listItem}
                        className="px-4 py-3 hover:bg-accent/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full shrink-0 bg-orange-400" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium truncate">{ip.description}</span>
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                {typeLabel(ip.type)}
                              </Badge>
                              {statusBadge(ip.status)}
                            </div>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              <span className="text-xs text-orange-600 dark:text-orange-400 font-semibold">
                                Restante: {currencyFmt(ip.remaining)}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {ip.paidInstallments}/{ip.installmentCount} parcelas
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                R$ {ip.monthlyValue.toFixed(2)}/mês
                              </span>
                              {ip.interestRate > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  Juros: {ip.interestRate}% a.m.
                                </span>
                              )}
                            </div>
                            {/* Progress bar */}
                            <div className="mt-1.5 flex items-center gap-2">
                              <div className="h-1.5 flex-1 max-w-[160px] rounded-full bg-muted overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{
                                    width: `${ip.installmentCount > 0 ? (ip.paidInstallments / ip.installmentCount) * 100 : 0}%`,
                                  }}
                                  transition={{ duration: 0.6, delay: 0.2 }}
                                  className="h-full rounded-full bg-orange-500"
                                />
                              </div>
                              <span className="text-[9px] text-muted-foreground">
                                {ip.installmentCount > 0
                                  ? Math.round((ip.paidInstallments / ip.installmentCount) * 100)
                                  : 0}
                                % pago
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                </div>
              </motion.div>
            )}

            {/* Consortiums Detail */}
            {expandedType === 'consortiums' && data.consortiums.length > 0 && (
              <motion.div
                key="consortiums-list"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-semibold">Consórcios</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {data.consortiums.length} consórcio(s)
                    </Badge>
                    <Badge className="text-[10px] px-2 py-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                      {currencyFmt(data.consortiumDebt)}
                    </Badge>
                  </div>
                  <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="divide-y divide-border/40 max-h-96 overflow-y-auto"
                  >
                    {data.consortiums.map((c) => (
                      <motion.div
                        key={c.id}
                        variants={listItem}
                        className="px-4 py-3 hover:bg-accent/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full shrink-0 bg-amber-400" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium truncate">{c.description}</span>
                              {statusBadge(c.status)}
                            </div>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                                Restante: {currencyFmt(c.remaining)}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {c.paidInstallments}/{c.installmentCount} parcelas
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                R$ {c.monthlyPayment.toFixed(2)}/mês
                              </span>
                              {c.administrator && (
                                <span className="text-[10px] text-muted-foreground">
                                  Adm: {c.administrator}
                                </span>
                              )}
                            </div>
                            {/* Progress bar */}
                            <div className="mt-1.5 flex items-center gap-2">
                              <div className="h-1.5 flex-1 max-w-[160px] rounded-full bg-muted overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.min(100, c.progress)}%` }}
                                  transition={{ duration: 0.6, delay: 0.2 }}
                                  className="h-full rounded-full bg-amber-500"
                                />
                              </div>
                              <span className="text-[9px] text-muted-foreground">
                                {Math.round(c.progress)}% pago
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ═══════════════════════════════════════════════════════════
              PIE CHART LEGEND
          ═══════════════════════════════════════════════════════════ */}
          {hasDebt && (
            <motion.div variants={item}>
              <div className="flex items-center justify-center gap-5 flex-wrap">
                {pieData.map((entry, index) => {
                  const pct =
                    data.totalDebt > 0
                      ? ((entry.value / data.totalDebt) * 100).toFixed(1)
                      : '0.0';
                  return (
                    <div key={entry.name} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[index] }}
                      />
                      <span className="text-xs text-muted-foreground">{entry.name}</span>
                      <span className="text-xs font-semibold">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
