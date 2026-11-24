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
  isToday,
  parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowUpRight,
  ArrowDownRight,
  ShoppingBag,
  Repeat,
  Clock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CircleDot,
  Wallet,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { currencyFmt } from '@/lib/helpers';
// ─── Helpers ───────────────────────────────────────────────────────
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
const FILTER_OPTIONS = [
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
] as const;
const WEEK_HEADERS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
// ─── Loading Skeleton ───────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <Card role="status" aria-label="Carregando calendário financeiro" className="min-w-0 gap-3 rounded-xl border-border bg-card py-4 shadow-none">
      <CardHeader className="px-4 sm:px-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Skeleton className="max-w-full motion-reduce:animate-none w-9 h-9 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="max-w-full motion-reduce:animate-none h-5 w-48" />
              <Skeleton className="max-w-full motion-reduce:animate-none h-3 w-36" />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="motion-reduce:animate-none h-9 w-20 rounded-md" />
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4 px-4 sm:px-5">
        {/* Calendar grid skeleton */}
        <Skeleton className="max-w-full motion-reduce:animate-none h-48 w-full rounded-xl" />
        {/* Summary skeleton */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="motion-reduce:animate-none h-16 rounded-xl" />
          ))}
        </div>
        {/* Event list skeleton */}
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="motion-reduce:animate-none h-14 w-full rounded-xl" />
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
  return (
    <FinancialCalendarContent
      data={data}
      loading={loading}
      activeDays={activeDays}
      selectedDate={selectedDate}
      currentMonth={currentMonth}
      onSelectDays={(days) => {
        setActiveDays(days);
        setSelectedDate(null);
      }}
      onSelectDate={setSelectedDate}
      setCurrentMonth={setCurrentMonth}
      onToday={handleToday}
      fetchData={fetchData}
    />
  );
}

export function FinancialCalendarContent({
  data,
  loading,
  activeDays,
  selectedDate,
  currentMonth,
  onSelectDays,
  onSelectDate,
  setCurrentMonth,
  onToday,
  fetchData,
}: {
  data: CalendarData | null;
  loading: boolean;
  activeDays: number;
  selectedDate: string | null;
  currentMonth: Date;
  onSelectDays: (days: number) => void;
  onSelectDate: (date: string | null) => void;
  setCurrentMonth: React.Dispatch<React.SetStateAction<Date>>;
  onToday: () => void;
  fetchData: (days: number) => void;
}) {
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
  if (loading) return <LoadingSkeleton />;
  if (!data) {
    return (
      <section aria-labelledby="financial-calendar-heading" className="min-w-0">
        <Card className="min-w-0 gap-3 rounded-lg border-border bg-card py-4 shadow-none">
          <CardHeader className="px-4 sm:px-5">
            <h3 id="financial-calendar-heading" className="text-base font-semibold">Calendário Financeiro</h3>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3 px-4 sm:px-5">
            <p role="alert" className="text-sm text-muted-foreground">Não foi possível carregar o calendário financeiro.</p>
            <Button variant="outline" size="sm" className="min-h-9" onClick={() => fetchData(activeDays)}>
              <RefreshCw aria-hidden="true" className="size-3.5" />
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }
  const { summary } = data;
  return (
    <section aria-labelledby="financial-calendar-heading" className="min-w-0">
      <Card className="min-w-0 gap-3 rounded-lg border-border bg-card py-4 shadow-none">
        <CardHeader className="px-4 sm:px-5">
          <div
            className="flex items-center justify-between flex-wrap gap-3"
          >
            <div className="min-w-0">
              <h3 id="financial-calendar-heading" className="text-base font-semibold">Calendário Financeiro</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Próximos pagamentos e receitas
              </p>
            </div>
            <div role="group" aria-label="Intervalo do calendário" className="flex flex-wrap items-center gap-1.5">
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  type="button"
                  aria-pressed={activeDays === opt.days}
                  onClick={() => onSelectDays(opt.days)}
                  className={`min-h-9 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    activeDays === opt.days
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <Button
                variant="outline"
                size="icon"
                className="size-9 ml-1"
                aria-label="Atualizar calendário"
                onClick={() => fetchData(activeDays)}
              >
                <RefreshCw className="size-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4 px-4 sm:px-5">
          <dl aria-label="Resumo do intervalo" className="grid grid-cols-1 gap-x-4 gap-y-2 border-y border-border py-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 sm:block">
              <dt className="text-xs text-muted-foreground">Contas a pagar</dt>
              <dd className="font-mono text-sm font-semibold tabular-nums">{summary.totalBills}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 sm:block">
              <dt className="text-xs text-muted-foreground">Despesas do intervalo</dt>
              <dd className="font-mono text-sm font-semibold tabular-nums">{currencyFmt(summary.totalExpense)}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 sm:block">
              <dt className="text-xs text-muted-foreground">Receitas do intervalo</dt>
              <dd className="font-mono text-sm font-semibold tabular-nums">{currencyFmt(summary.totalIncome)}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 sm:block">
              <dt className="text-xs text-muted-foreground">Próximo pagamento</dt>
              <dd className="font-mono text-sm font-semibold tabular-nums">{summary.nextPaymentDate ? format(parseISO(summary.nextPaymentDate), "dd MMM", { locale: ptBR }) : "—"}</dd>
            </div>
            {summary.upcomingBiggestExpense && (
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 sm:block">
              <dt className="text-xs text-muted-foreground">Maior despesa prevista</dt>
              <dd className="font-mono text-sm font-semibold tabular-nums">{currencyFmt(summary.upcomingBiggestExpense.amount)}</dd>
            </div>
            )}
          </dl>
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(15rem,1fr)_minmax(0,1.2fr)]">
          <div>
            <div className="rounded-lg border border-border bg-muted/20 p-3 sm:p-4">
              {/* Month header */}
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  aria-label="Mês anterior"
                  onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                  className="grid size-9 place-items-center rounded-md hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </button>
                <span className="text-sm font-semibold capitalize">
                  {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                </span>
                <button
                  type="button"
                  aria-label="Próximo mês"
                  onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                  className="grid size-9 place-items-center rounded-md hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              {/* Day of week headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEK_HEADERS.map((day) => (
                  <div
                    key={day}
                    className="text-center text-xs font-medium text-muted-foreground py-1"
                  >
                    {day}
                  </div>
                ))}
              </div>
              {/* Calendar cells */}
              <div
                className="grid grid-cols-7 gap-1"
              >
                {calendarDays.map((day) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const inMonth = isSameMonth(day, currentMonth);
                  const today = isToday(day);
                  const activity = activityMap.get(dateStr);
                  const isSelected = selectedDate === dateStr;
                  return (
                    <button
                      key={dateStr}
                      type="button"
                      aria-label={`${format(day, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}${activity?.hasIncome && activity.hasExpense ? ", receitas e despesas" : activity?.hasIncome ? ", receitas" : activity?.hasExpense ? ", despesas" : ""}`}
                      aria-current={today ? "date" : undefined}
                      aria-pressed={isSelected}
                      aria-disabled={!activity}
                      onClick={() => {
                        if (activity) {
                          onSelectDate(isSelected ? null : dateStr);
                        }
                      }}
                      className={`
                        relative flex flex-col items-center justify-center
                        min-h-10 rounded-md text-xs tabular-nums focus-visible:outline-2 focus-visible:outline-primary
                        ${!inMonth ? 'text-muted-foreground' : ''}
                        ${today ? 'ring-2 ring-primary ring-offset-1 ring-offset-background font-semibold' : ''}
                        ${isSelected ? 'bg-primary text-primary-foreground' : ''}
                        ${activity && !isSelected && inMonth ? 'hover:bg-muted/60 cursor-pointer' : ''}
                        ${!activity && inMonth && !today ? 'cursor-default' : ''}
                      `}
                    >
                      <span className={`leading-none ${isSelected ? 'text-primary-foreground' : ''}`}>
                        {format(day, 'd')}
                      </span>
                      {activity && inMonth && (
                        <span className="text-xs leading-none">
                          {activity.hasIncome && activity.hasExpense ? "+/−" : activity.hasIncome ? "+" : activity.hasExpense ? "−" : ""}
                        </span>
                      )}
                      {today && !isSelected && (
                        <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Legend */}
              <p className="mt-3 border-t border-border pt-2 text-center text-xs text-muted-foreground">+ Receita · − Despesa · +/− Ambos</p>
            </div>
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                <h4 id="calendar-agenda-heading" className="text-sm font-semibold">
                  {selectedDate
                    ? format(parseISO(selectedDate), "EEEE, dd 'de' MMMM", { locale: ptBR })
                    : 'Todos os próximos eventos'}
                </h4>
                {selectedDate && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
                    {selectedDayData?.events.length || 0} {selectedDayData?.events.length === 1 ? 'evento' : 'eventos'}
                  </Badge>
                )}
              </div>
              {selectedDate && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-9 text-xs px-2 text-primary hover:text-primary"
                  onClick={onToday}
                >
                  <CircleDot className="w-3 h-3 mr-1" />
                  Hoje
                </Button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto" tabIndex={0} role="region" aria-labelledby="calendar-agenda-heading">
                {filteredEvents.length === 0 ? (
                  <div
                    key="empty"
                    className="flex flex-col items-center justify-center py-8 text-center"
                  >
                    <p className="text-sm font-medium text-muted-foreground">
                      {selectedDate ? 'Nenhum evento neste dia' : 'Nenhum evento nos próximos dias'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedDate
                        ? 'Este dia está livre de compromissos financeiros'
                        : 'Novos eventos aparecerão aqui automaticamente'}
                    </p>
                  </div>
                ) : (
                  <div
                    key={selectedDate || 'all'}
                    className="divide-y divide-border" role="list"
                  >
                    {filteredEvents.map((event) => {
                      const ev = event as CalendarEvent & { date?: string };
                      const isIncome = ev.amount > 0;
                      const showDate = !selectedDate && ev.date;
                      return (
                        <div
                          key={ev.id}
                          role="listitem" className="flex flex-wrap items-start gap-2 px-1 py-2.5"
                        >
                          {/* Type icon */}
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                              ev.type === 'purchase'
                                ? 'bg-[var(--primary)]/10'
                                : ev.type === 'recurring'
                                  ? isIncome
                                    ? 'bg-[var(--money)]/10'
                                    : 'bg-[var(--obligation)]/10'
                                  : isIncome
                                    ? 'bg-[var(--money)]/10'
                                    : 'bg-[var(--debt)]/10'
                            }`}
                          >
                            {ev.type === 'purchase' ? (
                              <ShoppingBag className="w-4 h-4 text-primary" />
                            ) : ev.type === 'recurring' ? (
                              <Repeat className={`w-4 h-4 ${isIncome ? 'text-[var(--money)]' : 'text-[var(--obligation)]'}`} />
                            ) : isIncome ? (
                              <ArrowUpRight className="w-4 h-4 text-[var(--money)]" />
                            ) : (
                              <ArrowDownRight className="w-4 h-4 text-[var(--debt)]" />
                            )}
                          </div>
                          {/* Description and details */}
                          <div className="min-w-0 flex-1 basis-28">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium break-words">
                                {ev.description}
                              </p>
                              {ev.isRecurring && (
                                <Repeat className="w-3 h-3 text-muted-foreground shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {ev.category && (
                                <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
                                  {ev.category}
                                </Badge>
                              )}
                              {ev.account && (
                                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                  <Wallet className="w-2.5 h-2.5" />
                                  {ev.account}
                                </span>
                              )}
                              {ev.time && (
                                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5" />
                                  {ev.time}
                                </span>
                              )}
                              {showDate && (
                                <span className="text-xs text-muted-foreground">
                                  {format(parseISO(ev.date!), 'dd/MM')}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Amount */}
                          <span
                            className={`font-mono text-sm font-semibold tabular-nums ${
                              isIncome ? 'text-[var(--money)]' : 'text-[var(--debt)]'
                            }`}
                          >
                            {isIncome ? '+' : ''}
                            {currencyFmt(ev.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
            </div>
          </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
