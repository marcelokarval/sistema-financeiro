'use client';

import { useState, useEffect, useCallback, useMemo, type Dispatch, type SetStateAction } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FinanceMetric } from '@/components/shared/finance-metric';
import { currencyFmt } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import {
  FinancialCalendarAgenda,
  FinancialCalendarGrid,
  type CalendarData,
  type CalendarEvent,
} from './financial-calendar-grid';

const FILTER_OPTIONS = [
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
] as const;

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
        <Skeleton className="max-w-full motion-reduce:animate-none h-48 w-full rounded-xl" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="motion-reduce:animate-none h-16 rounded-xl" />
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="motion-reduce:animate-none h-14 w-full rounded-xl" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export type FinancialCalendarRequest = { days: number };
export type FinancialCalendarStatus =
  | { status: 'ready'; data: CalendarData }
  | { status: 'error' };
export type FinancialCalendarResult = {
  request: FinancialCalendarRequest;
  result: FinancialCalendarStatus;
};

export async function requestFinancialCalendar(
  request: FinancialCalendarRequest,
  signal: AbortSignal,
  publish: (response: FinancialCalendarResult) => void,
  fetcher: (url: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<void> {
  let result: FinancialCalendarStatus;
  try {
    const res = await fetcher(`/api/financial-calendar?days=${request.days}`, { signal });
    result = res.ok ? { status: 'ready', data: await res.json() } : { status: 'error' };
  } catch {
    result = { status: 'error' };
  }
  if (!signal.aborted) publish({ request, result });
}

export function currentFinancialCalendar(
  request: FinancialCalendarRequest,
  settled: FinancialCalendarResult | null,
): FinancialCalendarStatus | { status: 'loading' } {
  return settled?.request === request ? settled.result : { status: 'loading' };
}

export function FinancialCalendar() {
  const [request, setRequest] = useState<FinancialCalendarRequest>({ days: 30 });
  const [settled, setSettled] = useState<FinancialCalendarResult | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const query = currentFinancialCalendar(request, settled);
  const data = query.status === 'ready' ? query.data : null;
  const loading = query.status === 'loading';

  const fetchData = useCallback((days: number) => {
    setRequest({ days });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void requestFinancialCalendar(request, controller.signal, setSettled);
    return () => controller.abort();
  }, [request]);

  const handleToday = () => {
    setSelectedDate(null);
    setCurrentMonth(new Date());
  };

  return (
    <FinancialCalendarContent
      data={data}
      loading={loading}
      activeDays={request.days}
      selectedDate={selectedDate}
      currentMonth={currentMonth}
      onSelectDays={(days) => {
        if (days !== request.days) setRequest({ days });
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
  setCurrentMonth: Dispatch<SetStateAction<Date>>;
  onToday: () => void;
  fetchData: (days: number) => void;
}) {
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

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
  const metricClass = 'flex flex-wrap items-baseline justify-between gap-x-2 sm:block';

  return (
    <section aria-labelledby="financial-calendar-heading" className="min-w-0">
      <Card className="min-w-0 gap-3 rounded-lg border-border bg-card py-4 shadow-none">
        <CardHeader className="px-4 sm:px-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
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
                  className={cn(
                    'min-h-9 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                    activeDays === opt.days
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
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
            <FinanceMetric variant="compact" className={metricClass} valueClassName="text-sm" label="Contas a pagar" value={summary.totalBills} />
            <FinanceMetric variant="compact" className={metricClass} valueClassName="text-sm" label="Despesas do intervalo" value={currencyFmt(summary.totalExpense)} />
            <FinanceMetric variant="compact" className={metricClass} valueClassName="text-sm" label="Receitas do intervalo" value={currencyFmt(summary.totalIncome)} />
            <FinanceMetric
              variant="compact"
              className={metricClass}
              valueClassName="text-sm"
              label="Próximo pagamento"
              value={summary.nextPaymentDate ? format(parseISO(summary.nextPaymentDate), 'dd MMM', { locale: ptBR }) : '—'}
            />
            {summary.upcomingBiggestExpense && (
              <FinanceMetric
                variant="compact"
                className={metricClass}
                valueClassName="text-sm"
                label="Maior despesa prevista"
                value={currencyFmt(summary.upcomingBiggestExpense.amount)}
              />
            )}
          </dl>

          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(15rem,1fr)_minmax(0,1.2fr)]">
            <FinancialCalendarGrid
              currentMonth={currentMonth}
              calendarDays={calendarDays}
              activityMap={activityMap}
              selectedDate={selectedDate}
              onSelectDate={onSelectDate}
              setCurrentMonth={setCurrentMonth}
            />
            <FinancialCalendarAgenda
              selectedDate={selectedDate}
              selectedDayData={selectedDayData}
              filteredEvents={filteredEvents}
              onToday={onToday}
            />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
