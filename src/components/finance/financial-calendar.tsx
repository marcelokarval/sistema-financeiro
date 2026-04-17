'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarRange,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingBag,
  Repeat,
  Clock,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  CircleDot,
  CalendarCheck2,
  Wallet,
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
import { ScrollArea } from '@/components/ui/scroll-area';

// ─── Helpers ───────────────────────────────────────────────────────
const currencyFmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

// ─── Types ─────────────────────────────────────────────────────────
interface CalendarEvent {
  id: string;
  type: 'transaction' | 'purchase' | 'recurring';
  description: string;
  amount: number;
  time?: string;
  category?: string;
  account?: string;
  isRecurring: boolean;
}

interface CalendarDay {
  date: string;
  dayOfWeek: string;
  income: number;
  expense: number;
  events: CalendarEvent[];
}

interface CalendarSummary {
  totalUpcoming: number;
  totalBills: number;
  totalIncome: number;
  totalExpense: number;
  upcomingBiggestExpense: { description: string; amount: number; date: string } | null;
  nextPaymentDate: string | null;
}

interface CalendarData {
  days: CalendarDay[];
  summary: CalendarSummary;
}

// ─── Animation Variants ────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

const cellVariants = {
  hidden: { opacity: 0, scale: 0.85 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
};

const FILTER_OPTIONS = [
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
] as const;

const WEEK_HEADERS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ─── Loading Skeleton ───────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <Card className="border-0 shadow-md overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500" />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-7 w-20 rounded-full" />
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Calendar grid skeleton */}
        <Skeleton className="h-48 w-full rounded-xl" />
        {/* Summary skeleton */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        {/* Event list skeleton */}
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ────────────────────────────────────────────────
export function FinancialCalendar() {
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeDays, setActiveDays] = useState(30);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  const fetchData = useCallback(async (days: number) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/financial-calendar?days=${days}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error('Erro ao buscar calendário financeiro:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(activeDays);
  }, [activeDays, fetchData]);

  // ─── Calendar Grid ────────────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  // Build activity map from data
  const activityMap = useMemo(() => {
    const map = new Map<string, { hasIncome: boolean; hasExpense: boolean }>();
    if (!data) return map;
    for (const day of data.days) {
      map.set(day.date, {
        hasIncome: day.income > 0,
        hasExpense: day.expense > 0,
      });
    }
    return map;
  }, [data]);

  // ─── Filtered events ─────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    if (!data) return [];
    if (selectedDate) {
      const dayData = data.days.find((d) => d.date === selectedDate);
      return dayData?.events || [];
    }
    // Show all upcoming events sorted by date, then time
    const allEvents: (CalendarEvent & { date: string })[] = [];
    for (const day of data.days) {
      for (const ev of day.events) {
        allEvents.push({ ...ev, date: day.date });
      }
    }
    return allEvents;
  }, [data, selectedDate]);

  const selectedDayData = selectedDate && data
    ? data.days.find((d) => d.date === selectedDate) || null
    : null;

  // ─── Handle today button ──────────────────────────────────────────
  const handleToday = () => {
    setSelectedDate(null);
    setCurrentMonth(new Date());
  };

  // ─── Render ───────────────────────────────────────────────────────
  if (loading) return <LoadingSkeleton />;

  if (!data) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">Erro ao carregar calendário financeiro.</p>
        </CardContent>
      </Card>
    );
  }

  const { summary } = data;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <Card className="border-0 shadow-md overflow-hidden card-glow">
        {/* Gradient top border */}
        <div className="h-1 bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500" />

        <CardHeader className="pb-2">
          <motion.div
            variants={itemVariants}
            className="flex items-center justify-between flex-wrap gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
                <CalendarRange className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  Calendário Financeiro
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Próximos pagamentos e receitas
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  onClick={() => {
                    setActiveDays(opt.days);
                    setSelectedDate(null);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 whitespace-nowrap ${
                    activeDays === opt.days
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 ml-1"
                onClick={() => fetchData(activeDays)}
              >
                <ChevronLeft className="w-3.5 h-3.5 rotate-[-90deg]" />
              </Button>
            </div>
          </motion.div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ═══════════════════════════════════════════════════════════
              MINI CALENDAR GRID
          ═══════════════════════════════════════════════════════════ */}
          <motion.div variants={itemVariants}>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 sm:p-4">
              {/* Month header */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                  className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </button>
                <span className="text-sm font-semibold capitalize">
                  {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                </span>
                <button
                  onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                  className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-muted-foreground rotate-180" />
                </button>
              </div>

              {/* Day of week headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEK_HEADERS.map((day) => (
                  <div
                    key={day}
                    className="text-center text-[10px] font-medium text-muted-foreground/70 py-1"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar cells */}
              <motion.div
                className="grid grid-cols-7 gap-1"
                variants={containerVariants}
                initial="hidden"
                animate="show"
              >
                {calendarDays.map((day, idx) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const inMonth = isSameMonth(day, currentMonth);
                  const today = isToday(day);
                  const activity = activityMap.get(dateStr);
                  const isSelected = selectedDate === dateStr;

                  return (
                    <motion.button
                      key={dateStr}
                      variants={cellVariants}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        if (activity) {
                          setSelectedDate(isSelected ? null : dateStr);
                        }
                      }}
                      className={`
                        relative flex flex-col items-center justify-center
                        h-8 sm:h-10 rounded-lg text-xs transition-all duration-200
                        ${!inMonth ? 'text-muted-foreground/25' : ''}
                        ${today ? 'ring-2 ring-primary ring-offset-1 ring-offset-background font-bold' : ''}
                        ${isSelected ? 'bg-primary text-primary-foreground shadow-sm' : ''}
                        ${activity && !isSelected && inMonth ? 'hover:bg-muted/60 cursor-pointer' : ''}
                        ${!activity && inMonth && !today ? 'cursor-default' : ''}
                      `}
                    >
                      <span className={`leading-none ${isSelected ? 'text-primary-foreground' : ''}`}>
                        {format(day, 'd')}
                      </span>

                      {/* Activity dot */}
                      {activity && inMonth && (
                        <div className="flex items-center gap-[2px] mt-0.5">
                          {activity.hasIncome && activity.hasExpense ? (
                            <div className="flex gap-[1px]">
                              <div className={`w-[4px] h-[4px] rounded-full ${isSelected ? 'bg-emerald-300' : 'bg-emerald-500'}`} />
                              <div className={`w-[4px] h-[4px] rounded-full ${isSelected ? 'bg-rose-300' : 'bg-rose-500'}`} />
                            </div>
                          ) : activity.hasIncome ? (
                            <div className={`w-[6px] h-[4px] rounded-full ${isSelected ? 'bg-emerald-300' : 'bg-emerald-500'}`} />
                          ) : (
                            <div className={`w-[6px] h-[4px] rounded-full ${isSelected ? 'bg-rose-300' : 'bg-rose-500'}`} />
                          )}
                        </div>
                      )}

                      {today && !isSelected && (
                        <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                      )}
                    </motion.button>
                  );
                })}
              </motion.div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 mt-3 pt-2 border-t border-border/30">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-muted-foreground">Receita</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="text-[10px] text-muted-foreground">Despesa</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 -ml-1.5" />
                  <span className="text-[10px] text-muted-foreground">Ambos</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ═══════════════════════════════════════════════════════════
              SUMMARY BAR
          ═══════════════════════════════════════════════════════════ */}
          <motion.div variants={itemVariants}>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {/* Bills count */}
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/30">
                <div className="w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center">
                  <CalendarCheck2 className="w-4 h-4 text-rose-500" />
                </div>
                <span className="text-[10px] text-muted-foreground font-medium text-center leading-tight">
                  Contas a pagar
                </span>
                <span className="text-sm font-bold text-rose-500">
                  {summary.totalBills}
                </span>
              </div>

              {/* Total expense */}
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/30">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 text-amber-500" />
                </div>
                <span className="text-[10px] text-muted-foreground font-medium text-center leading-tight">
                  Total despesas
                </span>
                <span className="text-sm font-bold text-amber-500">
                  {currencyFmt(summary.totalExpense)}
                </span>
              </div>

              {/* Next payment */}
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/30">
                <div className="w-7 h-7 rounded-lg bg-teal-500/10 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-teal-500" />
                </div>
                <span className="text-[10px] text-muted-foreground font-medium text-center leading-tight">
                  Próximo pgto.
                </span>
                <span className="text-xs font-bold text-teal-500">
                  {summary.nextPaymentDate
                    ? format(parseISO(summary.nextPaymentDate), "dd MMM", { locale: ptBR })
                    : '—'}
                </span>
              </div>
            </div>
          </motion.div>

          {/* ═══════════════════════════════════════════════════════════
              EVENT LIST
          ═══════════════════════════════════════════════════════════ */}
          <motion.div variants={itemVariants}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">
                  {selectedDate
                    ? format(parseISO(selectedDate), "EEEE, dd 'de' MMMM", { locale: ptBR })
                    : 'Todos os próximos eventos'}
                </h3>
                {selectedDate && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                    {selectedDayData?.events.length || 0} {selectedDayData?.events.length === 1 ? 'evento' : 'eventos'}
                  </Badge>
                )}
              </div>
              {selectedDate && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2 text-primary hover:text-primary"
                  onClick={handleToday}
                >
                  <CircleDot className="w-3 h-3 mr-1" />
                  Hoje
                </Button>
              )}
            </div>

            <ScrollArea className="max-h-[380px]">
              <AnimatePresence mode="wait">
                {filteredEvents.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex flex-col items-center justify-center py-8 text-center"
                  >
                    <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                      <CalendarRange className="w-6 h-6 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {selectedDate ? 'Nenhum evento neste dia' : 'Nenhum evento nos próximos dias'}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      {selectedDate
                        ? 'Este dia está livre de compromissos financeiros'
                        : 'Novos eventos aparecerão aqui automaticamente'}
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key={selectedDate || 'all'}
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="space-y-1.5 pr-1"
                  >
                    {filteredEvents.map((event, idx) => {
                      const ev = event as CalendarEvent & { date?: string };
                      const isIncome = ev.amount > 0;
                      const showDate = !selectedDate && ev.date;

                      return (
                        <motion.div
                          key={ev.id}
                          variants={itemVariants}
                          whileHover={{ x: 4, transition: { type: 'spring', stiffness: 400, damping: 30 } }}
                          className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl hover:bg-accent/30 transition-colors group"
                        >
                          {/* Type icon */}
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                              ev.type === 'purchase'
                                ? 'bg-violet-500/10'
                                : ev.type === 'recurring'
                                  ? isIncome
                                    ? 'bg-teal-500/10'
                                    : 'bg-amber-500/10'
                                  : isIncome
                                    ? 'bg-emerald-500/10'
                                    : 'bg-rose-500/10'
                            }`}
                          >
                            {ev.type === 'purchase' ? (
                              <ShoppingBag className="w-4 h-4 text-violet-500" />
                            ) : ev.type === 'recurring' ? (
                              <Repeat className={`w-4 h-4 ${isIncome ? 'text-teal-500' : 'text-amber-500'}`} />
                            ) : isIncome ? (
                              <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <ArrowDownRight className="w-4 h-4 text-rose-500" />
                            )}
                          </div>

                          {/* Description and details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                {ev.description}
                              </p>
                              {ev.isRecurring && (
                                <Repeat className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {ev.category && (
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                                  {ev.category}
                                </Badge>
                              )}
                              {ev.account && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                  <Wallet className="w-2.5 h-2.5" />
                                  {ev.account}
                                </span>
                              )}
                              {ev.time && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5" />
                                  {ev.time}
                                </span>
                              )}
                              {showDate && (
                                <span className="text-[10px] text-muted-foreground">
                                  {format(parseISO(ev.date!), 'dd/MM')}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Amount */}
                          <span
                            className={`text-sm font-bold whitespace-nowrap shrink-0 ml-2 ${
                              isIncome ? 'text-emerald-500' : 'text-rose-500'
                            }`}
                          >
                            {isIncome ? '+' : ''}
                            {currencyFmt(ev.amount)}
                          </span>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </ScrollArea>
          </motion.div>

          {/* ═══════════════════════════════════════════════════════════
              FOOTER: Biggest expense + totals
          ═══════════════════════════════════════════════════════════ */}
          <motion.div variants={itemVariants}>
            <div className="rounded-xl border border-border/60 bg-gradient-to-r from-muted/40 to-muted/20 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-xs text-muted-foreground">
                      Receitas:{' '}
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        {currencyFmt(summary.totalIncome)}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                    <span className="text-xs text-muted-foreground">
                      Despesas:{' '}
                      <span className="font-medium text-rose-600 dark:text-rose-400">
                        {currencyFmt(summary.totalExpense)}
                      </span>
                    </span>
                  </div>
                </div>
                {summary.upcomingBiggestExpense && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-2 py-0.5 h-5 border-rose-500/20 text-rose-500 bg-rose-500/5 shrink-0"
                  >
                    Maior despesa: {currencyFmt(summary.upcomingBiggestExpense.amount)}
                  </Badge>
                )}
              </div>
            </div>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
