'use client';
import { useState, useEffect, useCallback } from 'react';
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
import { currencyFmt } from '@/lib/helpers';
// ─── Helpers ───────────────────────────────────────────────────────
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
// ─── Donut Chart Colors ────────────────────────────────────────────
const PIE_COLORS = ['var(--ds-chart-4)', 'var(--ds-chart-3)', 'var(--ds-chart-2)'];
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
    <div className="bg-background border border-border rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.payload.fill }} />
        <span className="text-xs font-medium">{entry.name}</span>
      </div>
      <p className="font-mono text-sm font-semibold tabular-nums">{currencyFmt(entry.value)}</p>
    </div>
  );
}
// ─── Donut Center Label ────────────────────────────────────────────
function DonutCenterLabel({ total }: { total: number }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
      <p
        className="font-mono text-lg sm:text-xl font-semibold tabular-nums text-foreground"
      >
        {currencyFmt(total)}
      </p>
      <p
        className="text-xs sm:text-xs text-muted-foreground font-medium"
      >
        Total em Dívidas
      </p>
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
    ACTIVE: { label: 'Ativo', className: 'bg-[var(--money)]/10 text-[var(--money)] border-[var(--money)]/20' },
    OVERDUE: { label: 'Atrasado', className: 'bg-[var(--debt)]/10 text-[var(--debt)] border-[var(--debt)]/20' },
    COMPLETED: { label: 'Concluído', className: 'bg-[var(--primary)]/10 text-primary border-[var(--primary)]/20' },
    CONTEMPLATED: { label: 'Contemplado', className: 'bg-[var(--obligation)]/10 text-[var(--obligation)] border-[var(--obligation)]/20' },
  };
  const c = config[status] || config.ACTIVE;
  return <Badge className={`text-xs px-2 py-0 border ${c.className}`}>{c.label}</Badge>;
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
  return (
    <DebtOverviewContent
      data={data}
      loading={loading}
      expandedType={expandedType}
      onToggleExpand={(type) => setExpandedType((prev) => (prev === type ? null : type))}
      fetchData={fetchData}
      onRetry={fetchData}
    />
  );
}

export function DebtOverviewContent({
  data,
  loading,
  expandedType,
  onToggleExpand,
  fetchData,
  onRetry,
}: {
  data: DebtsData | null;
  loading: boolean;
  expandedType: string | null;
  onToggleExpand: (type: string) => void;
  fetchData?: () => void;
  onRetry?: () => void;
}) {
  const handleRetry = onRetry ?? fetchData;
  // ─── Loading Skeleton ─────────────────────────────────────────────
  if (loading) {
    return (
      <Card role="status" aria-label="Carregando visão de dívidas" className="min-w-0 gap-3 rounded-lg border-border bg-card py-4 shadow-none">
        <CardHeader className="px-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Skeleton className="max-w-full motion-reduce:animate-none w-9 h-9 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="max-w-full motion-reduce:animate-none h-5 w-48" />
                <Skeleton className="max-w-full motion-reduce:animate-none h-3 w-32" />
              </div>
            </div>
            <Skeleton className="max-w-full motion-reduce:animate-none h-9 w-36 rounded-lg" />
          </div>
        </CardHeader>
        <CardContent className="min-w-0 space-y-5 px-4 sm:px-5">
          <div className="flex flex-col sm:flex-row gap-6 items-center">
            <Skeleton className="max-w-full motion-reduce:animate-none h-56 w-56 sm:h-64 sm:w-64 rounded-full shrink-0" />
            <div className="min-w-0 divide-y divide-border border-y border-border">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="motion-reduce:animate-none h-28 w-full rounded-lg" />
              ))}
            </div>
          </div>
          <Skeleton className="max-w-full motion-reduce:animate-none h-32 w-full rounded-lg" />
          <Skeleton className="max-w-full motion-reduce:animate-none h-24 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }
  if (!data) {
    return (
      <Card className="min-w-0 gap-3 rounded-lg border-border bg-card py-4 shadow-none">
        <CardContent className="space-y-3 px-4 py-4 text-sm">
          <Activity className="w-10 h-10 text-muted-foreground" />
          <p role="alert" className="text-sm text-muted-foreground">
            Não foi possível carregar o painel de dívidas.
          </p>
          <Button variant="outline" size="sm" className="min-h-9" onClick={handleRetry}>
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
      barColor: 'var(--ds-chart-4)',
      bgClass: 'bg-[var(--debt)]/5 border-[var(--debt)]/20',
      textClass: 'text-[var(--debt)]',
      iconBg: 'bg-[var(--debt)]/10',
      label: 'Crítico',
      recommendation:
        'Suas dívidas comprometem mais de 30% da sua renda. Considere renegociar taxas, priorizar a quitação de cartões e evitar novas dívidas.',
    },
    warning: {
      barColor: 'var(--ds-chart-2)',
      bgClass: 'bg-[var(--obligation)]/5 border-[var(--obligation)]/20',
      textClass: 'text-[var(--obligation)]',
      iconBg: 'bg-[var(--obligation)]/10',
      label: 'Atenção',
      recommendation:
        'Suas dívidas estão entre 15% e 30% da sua renda. Mantenha o controle, evite novas aquisições e priorize o pagamento antecipado.',
    },
    healthy: {
      barColor: "var(--ds-chart-1)",
      bgClass: 'bg-[var(--money)]/5 border-[var(--money)]/20',
      textClass: 'text-[var(--money)]',
      iconBg: 'bg-[var(--money)]/10',
      label: 'Saudável',
      recommendation:
        'Ótimo! Suas dívidas estão abaixo de 15% da sua renda. Continue com esse controle financeiro e mantenha o equilíbrio.',
    },
  };
  const currentRatio = ratioConfig[ratioLevel];
  const clampedRatio = Math.min(ratio, 100);
  // ─── Toggle expand ───────────────────────────────────────────────
  const toggleExpand = onToggleExpand;
  // ─── Render ───────────────────────────────────────────────────────
  return (
    <section aria-labelledby="debt-overview-heading" className="min-w-0">
      <Card className="min-w-0 gap-3 rounded-lg border-border bg-card py-4 shadow-none">
        <CardHeader className="px-4 sm:px-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="min-w-0">
              <h3 id="debt-overview-heading" className="text-base font-semibold">Painel de Dívidas</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Acompanhe todas as suas obrigações financeiras
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                className={`font-mono text-xs tabular-nums px-3 py-1 border ${
                  data.totalDebt > 0
                    ? 'bg-[var(--debt)]/10 text-[var(--debt)] border-[var(--debt)]/20'
                    : 'bg-[var(--money)]/10 text-[var(--money)] border-[var(--money)]/20'
                }`}
              >
                <TrendingDown className="w-3.5 h-3.5 mr-1.5" />
                {currencyFmt(data.totalDebt)}
              </Badge>
              <Button
                variant="outline"
                size="icon"
                className="size-9"
                aria-label="Atualizar dívidas"
                onClick={fetchData}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 space-y-5 px-4 sm:px-5">
          <div>
            <div role="group" aria-label="Composição das dívidas" className="grid min-w-0 items-center gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              {/* Donut Chart */}
              <div className="relative mx-auto h-52 w-full max-w-64 lg:order-last">
                {hasDebt ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        isAnimationActive={false}
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius="55%"
                        outerRadius="80%"
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
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
                        isAnimationActive={false}
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
              <div className="min-w-0 divide-y divide-border border-y border-border">
                {/* Cartões de Crédito */}
                <div>
                  <button
                    aria-expanded={expandedType === "cards"}
                    aria-disabled={!data.cards.length}
                    onClick={() => data.cards.length > 0 && toggleExpand('cards')}
                    className={`grid w-full min-w-0 grid-cols-[1fr_auto] items-center gap-x-2 px-2 py-2.5 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${
                      expandedType === 'cards' ? 'ring-2 ring-[var(--debt)]/30' : ''
                    }`}
                  >
                    <div className="col-start-2 row-start-1 flex items-center justify-end gap-2">
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-xs px-1.5 py-0">
                          {data.cards.length}
                        </Badge>
                        {data.cards.length > 0 && (
                          expandedType === 'cards'
                            ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <p className="col-start-1 row-start-1 text-sm font-medium">
                      Cartões de Crédito
                    </p>
                    <p className="col-span-2 text-sm font-mono font-semibold tabular-nums">
                      {currencyFmt(data.cardDebt)}
                    </p>
                  </button>
                </div>
                {/* Parcelamentos */}
                <div>
                  <button
                    aria-expanded={expandedType === "installments"}
                    aria-disabled={!data.installments.length}
                    onClick={() => data.installments.length > 0 && toggleExpand('installments')}
                    className={`grid w-full min-w-0 grid-cols-[1fr_auto] items-center gap-x-2 px-2 py-2.5 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${
                      expandedType === 'installments' ? 'ring-2 ring-[var(--obligation)]/30' : ''
                    }`}
                  >
                    <div className="col-start-2 row-start-1 flex items-center justify-end gap-2">
                                            <div className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-xs px-1.5 py-0">
                          {data.installments.length}
                        </Badge>
                        {data.installments.length > 0 && (
                          expandedType === 'installments'
                            ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <p className="col-start-1 row-start-1 text-sm font-medium">
                      Parcelamentos
                    </p>
                    <p className="col-span-2 text-sm font-mono font-semibold tabular-nums">
                      {currencyFmt(data.installmentDebt)}
                    </p>
                  </button>
                </div>
                {/* Consórcios */}
                <div>
                  <button
                    aria-expanded={expandedType === "consortiums"}
                    aria-disabled={!data.consortiums.length}
                    onClick={() => data.consortiums.length > 0 && toggleExpand('consortiums')}
                    className={`grid w-full min-w-0 grid-cols-[1fr_auto] items-center gap-x-2 px-2 py-2.5 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${
                      expandedType === 'consortiums' ? 'ring-2 ring-[var(--obligation)]/30' : ''
                    }`}
                  >
                    <div className="col-start-2 row-start-1 flex items-center justify-end gap-2">
                                            <div className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-xs px-1.5 py-0">
                          {data.consortiums.length}
                        </Badge>
                        {data.consortiums.length > 0 && (
                          expandedType === 'consortiums'
                            ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <p className="col-start-1 row-start-1 text-sm font-medium">
                      Consórcios
                    </p>
                    <p className="col-span-2 text-sm font-mono font-semibold tabular-nums">
                      {currencyFmt(data.consortiumDebt)}
                    </p>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div>
            <div className={`rounded-lg border p-4 ${currentRatio.bgClass}`}>
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-lg ${currentRatio.iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
                  <Percent className="w-5 h-5" style={{ color: currentRatio.barColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className={`text-sm font-semibold ${currentRatio.textClass}`}>
                      Comprometimento de Renda
                    </p>
                    <Badge className={`text-xs px-2 py-0 border ${currentRatio.bgClass} ${currentRatio.textClass}`}>
                      {currentRatio.label}
                    </Badge>
                  </div>
                  <p className={`text-xs ${currentRatio.textClass} leading-relaxed mb-3`}>
                    {currentRatio.recommendation}
                  </p>
                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-medium">
                        Endividamento / Renda mensal
                      </span>
                      <span className={`font-mono text-xs font-semibold tabular-nums ${currentRatio.textClass}`}>
                        {ratio.toFixed(1)}%
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label="Comprometimento de renda com dívidas"
                      aria-valuenow={Math.round(clampedRatio)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuetext={`${ratio.toFixed(1)}%`}
                      className="h-3 rounded-full bg-muted overflow-hidden relative"
                    >
                      {/* 15% marker */}
                      <div
                        className="absolute top-0 bottom-0 w-px bg-[var(--money)]/40 z-10"
                        style={{ left: '15%' }}
                      />
                      {/* 30% marker */}
                      <div
                        className="absolute top-0 bottom-0 w-px bg-[var(--debt)]/40 z-10"
                        style={{ left: '30%' }}
                      />
                      <div
                        className="h-full rounded-full"
                        style={{ backgroundColor: currentRatio.barColor, width: `${clampedRatio}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">0%</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[var(--money)] font-medium">15%</span>
                        <span className="text-xs text-[var(--debt)] font-medium">30%</span>
                      </div>
                      <span className="text-xs text-muted-foreground">100%</span>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>Renda mensal:</span>
                    <span className="font-mono font-semibold tabular-nums text-foreground">{currencyFmt(data.monthlyIncome)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Cards Detail */}
            {expandedType === 'cards' && data.cards.length > 0 && (
              <div
                key="cards-list"
                className="overflow-hidden"
              >
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
                    <CreditCard className="w-4 h-4 text-[var(--debt)]" />
                    <span className="text-xs font-semibold">Cartões de Crédito</span>
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      {data.cards.length} cartão(ões)
                    </Badge>
                    <Badge className="font-mono text-xs tabular-nums px-2 py-0 bg-[var(--debt)]/10 text-[var(--debt)] border-[var(--debt)]/20">
                      {currencyFmt(data.cardDebt)}
                    </Badge>
                  </div>
                  <div
                    className="divide-y divide-border/40 max-h-96 overflow-y-auto"
                  >
                    {data.cards.map((card) => (
                      <div
                        key={card.id}
                        className="px-4 py-3 hover:bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: card.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium truncate">{card.name}</span>
                              <Badge variant="outline" className="text-xs px-1.5 py-0">
                                {card.brand}
                              </Badge>
                              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                ****{card.lastFourDigits}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              <span className="font-mono text-xs tabular-nums text-[var(--debt)] font-semibold">
                                {currencyFmt(card.currentBalance)}
                              </span>
                              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                Limite: {currencyFmt(card.creditLimit)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Vencimento: dia {card.dueDay}
                              </span>
                            </div>
                            {/* Utilization bar */}
                            <div className="mt-1.5 flex items-center gap-2">
                              <div
                                role="progressbar"
                                aria-label={`Uso do limite do cartão ${card.name}`}
                                aria-valuenow={Math.round(Math.min(100, card.utilizationRate))}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                className="h-1.5 flex-1 max-w-[120px] rounded-full bg-muted overflow-hidden"
                              >
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.min(100, card.utilizationRate)}%`,
                                    backgroundColor:
                                      card.utilizationRate > 80
                                        ? 'var(--ds-chart-4)'
                                        : card.utilizationRate > 50
                                          ? 'var(--ds-chart-2)'
                                          : "var(--ds-chart-1)",
                                  }}
                                />
                              </div>
                              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                {card.utilizationRate.toFixed(0)}% usado
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {/* Installments Detail */}
            {expandedType === 'installments' && data.installments.length > 0 && (
              <div
                key="installments-list"
                className="overflow-hidden"
              >
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
                    <CalendarClock className="w-4 h-4 text-[var(--obligation)]" />
                    <span className="text-xs font-semibold">Parcelamentos</span>
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      {data.installments.length} plano(s)
                    </Badge>
                    <Badge className="font-mono text-xs tabular-nums px-2 py-0 bg-[var(--obligation)]/10 text-[var(--obligation)] border-[var(--obligation)]/20">
                      {currencyFmt(data.installmentDebt)}
                    </Badge>
                  </div>
                  <div
                    className="divide-y divide-border/40 max-h-96 overflow-y-auto"
                  >
                    {data.installments.map((ip) => (
                      <div
                        key={ip.id}
                        className="px-4 py-3 hover:bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full shrink-0 bg-[var(--obligation)]" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium truncate">{ip.description}</span>
                              <Badge variant="outline" className="text-xs px-1.5 py-0">
                                {typeLabel(ip.type)}
                              </Badge>
                              {statusBadge(ip.status)}
                            </div>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              <span className="font-mono text-xs tabular-nums text-[var(--obligation)] font-semibold">
                                Restante: {currencyFmt(ip.remaining)}
                              </span>
                              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                {ip.paidInstallments}/{ip.installmentCount} parcelas
                              </span>
                              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                {currencyFmt(ip.monthlyValue)}/mês
                              </span>
                              {ip.interestRate > 0 && (
                                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                  Juros: {ip.interestRate}% a.m.
                                </span>
                              )}
                            </div>
                            {/* Progress bar */}
                            <div className="mt-1.5 flex items-center gap-2">
                              <div
                                role="progressbar"
                                aria-label={`Progresso do parcelamento ${ip.description}`}
                                aria-valuenow={ip.installmentCount > 0 ? Math.round((ip.paidInstallments / ip.installmentCount) * 100) : 0}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                className="h-1.5 flex-1 max-w-[160px] rounded-full bg-muted overflow-hidden"
                              >
                                <div
                                  style={{ width: `${ip.installmentCount > 0 ? (ip.paidInstallments / ip.installmentCount) * 100 : 0}%` }}
                                  className="h-full rounded-full bg-[var(--obligation)]"
                                />
                              </div>
                              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                {ip.installmentCount > 0
                                  ? Math.round((ip.paidInstallments / ip.installmentCount) * 100)
                                  : 0}
                                % pago
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {/* Consortiums Detail */}
            {expandedType === 'consortiums' && data.consortiums.length > 0 && (
              <div
                key="consortiums-list"
                className="overflow-hidden"
              >
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
                    <Building2 className="w-4 h-4 text-[var(--obligation)]" />
                    <span className="text-xs font-semibold">Consórcios</span>
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      {data.consortiums.length} consórcio(s)
                    </Badge>
                    <Badge className="font-mono text-xs tabular-nums px-2 py-0 bg-[var(--obligation)]/10 text-[var(--obligation)] border-[var(--obligation)]/20">
                      {currencyFmt(data.consortiumDebt)}
                    </Badge>
                  </div>
                  <div
                    className="divide-y divide-border/40 max-h-96 overflow-y-auto"
                  >
                    {data.consortiums.map((c) => (
                      <div
                        key={c.id}
                        className="px-4 py-3 hover:bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full shrink-0 bg-[var(--obligation)]" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium truncate">{c.description}</span>
                              {statusBadge(c.status)}
                            </div>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              <span className="font-mono text-xs tabular-nums text-[var(--obligation)] font-semibold">
                                Restante: {currencyFmt(c.remaining)}
                              </span>
                              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                {c.paidInstallments}/{c.installmentCount} parcelas
                              </span>
                              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                {currencyFmt(c.monthlyPayment)}/mês
                              </span>
                              {c.administrator && (
                                <span className="text-xs text-muted-foreground">
                                  Adm: {c.administrator}
                                </span>
                              )}
                            </div>
                            {/* Progress bar */}
                            <div className="mt-1.5 flex items-center gap-2">
                              <div
                                role="progressbar"
                                aria-label={`Progresso do consórcio ${c.description}`}
                                aria-valuenow={Math.round(Math.min(100, c.progress))}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                className="h-1.5 flex-1 max-w-[160px] rounded-full bg-muted overflow-hidden"
                              >
                                <div
                                  className="h-full rounded-full bg-[var(--obligation)]"
                                  style={{ width: `${Math.min(100, c.progress)}%` }}
                                />
                              </div>
                              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                {Math.round(c.progress)}% pago
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          {hasDebt && (
            <div>
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
                      <span className="font-mono text-xs font-semibold tabular-nums">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
