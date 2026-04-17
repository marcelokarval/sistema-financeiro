'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarClock,
  CreditCard,
  Building2,
  RefreshCw,
  AlertTriangle,
  Clock,
  ChevronRight,
  CalendarDays,
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

// ─── Helpers ───────────────────────────────────────────────────────
const currencyFmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const dateFmt = (isoDate: string) => {
  const d = new Date(isoDate);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

const dayLabel = (days: number) => {
  if (days < 0) return `${Math.abs(days)} dia(s) atrasado`;
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Amanhã';
  return `Em ${days} dias`;
};

// ─── Types ─────────────────────────────────────────────────────────
interface Bill {
  id: string;
  type: 'installment' | 'consortium' | 'card' | 'recurring';
  title: string;
  amount: number;
  dueDate: string;
  daysUntilDue: number;
  status: 'overdue' | 'urgent' | 'upcoming' | 'later';
  source: string;
}

interface Summary {
  thisWeek: { count: number; amount: number };
  thisMonth: { count: number; amount: number };
  totalAmount: number;
  overdueCount: number;
  urgentCount: number;
  upcomingCount: number;
  laterCount: number;
}

interface UpcomingBillsData {
  bills: Bill[];
  summary: Summary;
}

// ─── Animation Variants ────────────────────────────────────────────
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

const listItem = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

const cardHover = {
  scale: 1.02,
  transition: { type: 'spring', stiffness: 300, damping: 20 },
};

// ─── Type Icon Helper ──────────────────────────────────────────────
function BillTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'card':
      return <CreditCard className="w-4 h-4 text-sky-500" />;
    case 'consortium':
      return <Building2 className="w-4 h-4 text-teal-500" />;
    case 'installment':
      return <CalendarClock className="w-4 h-4 text-violet-500" />;
    case 'recurring':
      return <RefreshCw className="w-4 h-4 text-amber-500" />;
    default:
      return <CalendarClock className="w-4 h-4 text-muted-foreground" />;
  }
}

// ─── Status Badge ──────────────────────────────────────────────────
function DaysBadge({ days, status }: { days: number; status: string }) {
  const config: Record<string, string> = {
    overdue: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    urgent: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    upcoming: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    later: 'bg-muted text-muted-foreground border-border/50',
  };
  return (
    <Badge className={`text-[10px] px-2 py-0 border whitespace-nowrap ${config[status] || config.later}`}>
      {dayLabel(days)}
    </Badge>
  );
}

// ─── Month Progress Bar ────────────────────────────────────────────
function MonthProgress({ dueDate }: { dueDate: string }) {
  const d = new Date(dueDate);
  const dayOfMonth = d.getDate();
  const totalDays = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const pct = Math.min(100, Math.max(0, (dayOfMonth / totalDays) * 100));

  let barColor = 'bg-sky-500';
  if (pct > 80) barColor = 'bg-rose-500';
  else if (pct > 60) barColor = 'bg-amber-500';

  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="h-1 flex-1 max-w-[100px] rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className={`h-full rounded-full ${barColor}`}
        />
      </div>
      <span className="text-[9px] text-muted-foreground tabular-nums">
        {dayOfMonth}/{totalDays}
      </span>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────
export function UpcomingBills() {
  const [data, setData] = useState<UpcomingBillsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>('all');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/upcoming-bills');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error('Erro ao buscar próximos pagamentos:', e);
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
        <div className="h-1 bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-500" />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <Skeleton className="h-8 w-32 rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="border-0 shadow-md">
        <div className="h-1 bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-500" />
        <CardContent className="py-12 flex flex-col items-center justify-center gap-3">
          <Activity className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar os próximos pagamentos.
          </p>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { bills, summary } = data;
  const overdueBills = bills.filter((b) => b.status === 'overdue');
  const urgentBills = bills.filter((b) => b.status === 'urgent');
  const thisWeekBills = bills.filter((b) => {
    const bd = new Date(b.dueDate);
    const dayOfWeek = new Date().getDay();
    const endOfWeek = new Date();
    endOfWeek.setDate(endOfWeek.getDate() + (7 - dayOfWeek));
    return bd <= endOfWeek;
  });
  const thisMonthBills = bills.filter((b) => b.status !== 'later');

  const toggleSection = (section: string) => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <motion.div variants={container} initial="hidden" animate="show">
      <Card className="border-0 shadow-md overflow-hidden">
        {/* Gradient top border */}
        <div className="h-1 bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-500" />

        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
                <CalendarClock className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  Próximos Pagamentos
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Controle suas contas e vencimentos
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="text-xs px-3 py-1 border bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20">
                <CalendarDays className="w-3.5 h-3.5 mr-1.5" />
                Este mês: {currencyFmt(summary.thisMonth.amount)}
              </Badge>
              <Badge variant="secondary" className="text-xs px-2 py-1">
                {bills.length} contas
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

        <CardContent className="space-y-4">
          {/* ═══════════════════════════════════════════════════════════
              SUMMARY ROW - 3 Mini Cards
          ═══════════════════════════════════════════════════════════ */}
          <motion.div variants={item}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Esta Semana */}
              <motion.div variants={item} whileHover={cardHover}>
                <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm">
                      <Clock className="w-4 h-4 text-white" />
                    </div>
                    <Badge
                      className={`text-[10px] px-2 py-0 border ${
                        summary.thisWeek.count > 0
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                          : 'bg-muted text-muted-foreground border-border/50'
                      }`}
                    >
                      {summary.thisWeek.count} contas
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium mb-1">Esta Semana</p>
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                    {currencyFmt(summary.thisWeek.amount)}
                  </p>
                </div>
              </motion.div>

              {/* Este Mês */}
              <motion.div variants={item} whileHover={cardHover}>
                <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-blue-500 flex items-center justify-center shadow-sm">
                      <CalendarDays className="w-4 h-4 text-white" />
                    </div>
                    <Badge
                      className={`text-[10px] px-2 py-0 border ${
                        summary.thisMonth.count > 0
                          ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
                          : 'bg-muted text-muted-foreground border-border/50'
                      }`}
                    >
                      {summary.thisMonth.count} contas
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium mb-1">Este Mês</p>
                  <p className="text-lg font-bold text-sky-600 dark:text-sky-400">
                    {currencyFmt(summary.thisMonth.amount)}
                  </p>
                </div>
              </motion.div>

              {/* Próximos 30 dias */}
              <motion.div variants={item} whileHover={cardHover}>
                <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-sm">
                      <CalendarClock className="w-4 h-4 text-white" />
                    </div>
                    <Badge
                      className={`text-[10px] px-2 py-0 border ${
                        bills.length > 0
                          ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
                          : 'bg-muted text-muted-foreground border-border/50'
                      }`}
                    >
                      {bills.length} contas
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium mb-1">Próximos 30 dias</p>
                  <p className="text-lg font-bold text-cyan-600 dark:text-cyan-400">
                    {currencyFmt(summary.totalAmount)}
                  </p>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* ═══════════════════════════════════════════════════════════
              OVERDUE SECTION
          ═══════════════════════════════════════════════════════════ */}
          {overdueBills.length > 0 && (
            <motion.div variants={item}>
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleSection('overdue')}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-rose-500/5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                    <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">Atrasados</span>
                    <Badge className="text-[10px] px-2 py-0 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                      {overdueBills.length}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                      {currencyFmt(overdueBills.reduce((s, b) => s + b.amount, 0))}
                    </span>
                    <motion.div
                      animate={{ rotate: expandedSection === 'overdue' ? 90 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </motion.div>
                  </div>
                </button>
                <AnimatePresence>
                  {expandedSection === 'overdue' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="divide-y divide-rose-500/10 max-h-96 overflow-y-auto">
                        <motion.div variants={container} initial="hidden" animate="show">
                          {overdueBills.map((bill) => (
                            <motion.div
                              key={bill.id}
                              variants={listItem}
                              className="px-4 py-3 hover:bg-rose-500/5 transition-colors"
                            >
                              <BillItem bill={bill} />
                            </motion.div>
                          ))}
                        </motion.div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              NEXT 7 DAYS SECTION
          ═══════════════════════════════════════════════════════════ */}
          {urgentBills.length > 0 && (
            <motion.div variants={item}>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleSection('urgent')}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-amber-500/5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Próximos 7 dias</span>
                    <Badge className="text-[10px] px-2 py-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      {urgentBills.length}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      {currencyFmt(urgentBills.reduce((s, b) => s + b.amount, 0))}
                    </span>
                    <motion.div
                      animate={{ rotate: expandedSection === 'urgent' ? 90 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </motion.div>
                  </div>
                </button>
                <AnimatePresence>
                  {expandedSection === 'urgent' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="divide-y divide-amber-500/10 max-h-96 overflow-y-auto">
                        <motion.div variants={container} initial="hidden" animate="show">
                          {urgentBills.map((bill) => (
                            <motion.div
                              key={bill.id}
                              variants={listItem}
                              className="px-4 py-3 hover:bg-amber-500/5 transition-colors"
                            >
                              <BillItem bill={bill} />
                            </motion.div>
                          ))}
                        </motion.div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              THIS MONTH SECTION (upcoming + some later)
          ═══════════════════════════════════════════════════════════ */}
          {thisMonthBills.length > 0 && (
            <motion.div variants={item}>
              <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleSection('thisMonth')}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-sky-500/5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-sky-500" />
                    <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">Este Mês</span>
                    <Badge className="text-[10px] px-2 py-0 bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                      {thisMonthBills.length}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-sky-600 dark:text-sky-400">
                      {currencyFmt(thisMonthBills.reduce((s, b) => s + b.amount, 0))}
                    </span>
                    <motion.div
                      animate={{ rotate: expandedSection === 'thisMonth' ? 90 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </motion.div>
                  </div>
                </button>
                <AnimatePresence>
                  {expandedSection === 'thisMonth' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="divide-y divide-sky-500/10 max-h-96 overflow-y-auto">
                        <motion.div variants={container} initial="hidden" animate="show">
                          {thisMonthBills.map((bill) => (
                            <motion.div
                              key={bill.id}
                              variants={listItem}
                              className="px-4 py-3 hover:bg-sky-500/5 transition-colors"
                            >
                              <BillItem bill={bill} />
                            </motion.div>
                          ))}
                        </motion.div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              EMPTY STATE
          ═══════════════════════════════════════════════════════════ */}
          {bills.length === 0 && (
            <motion.div
              variants={item}
              className="flex flex-col items-center justify-center py-8 text-center"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                <CalendarClock className="w-7 h-7 text-emerald-500" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">
                Nenhum pagamento pendente
              </p>
              <p className="text-xs text-muted-foreground max-w-[240px]">
                Não há contas ou parcelas pendentes nos próximos 30 dias. Continue assim!
              </p>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Bill Item Sub-component ──────────────────────────────────────
function BillItem({ bill }: { bill: Bill }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 mt-0.5">
        <BillTypeIcon type={bill.type} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium truncate max-w-[200px]">{bill.title}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-bold tabular-nums">
              {currencyFmt(bill.amount)}
            </span>
            <DaysBadge days={bill.daysUntilDue} status={bill.status} />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className="text-[11px] text-muted-foreground">{bill.source}</span>
          <span className="text-[11px] text-muted-foreground">
            Vencimento: {dateFmt(bill.dueDate)}
          </span>
        </div>
        <MonthProgress dueDate={bill.dueDate} />
      </div>
    </div>
  );
}
