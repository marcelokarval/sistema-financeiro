'use client';

import type { Dispatch, SetStateAction } from 'react';
import { format, isSameMonth, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock,
  Repeat,
  ShoppingBag,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FinanceRow } from '@/components/shared/finance-row';
import { cn } from '@/lib/utils';

export interface CalendarEvent {
  id: string;
  type: 'transaction' | 'purchase' | 'recurring';
  description: string;
  amount: number;
  time?: string;
  category?: string;
  account?: string;
  isRecurring: boolean;
}

export interface CalendarDay {
  date: string;
  dayOfWeek: string;
  income: number;
  expense: number;
  events: CalendarEvent[];
}

export interface CalendarSummary {
  totalUpcoming: number;
  totalBills: number;
  totalIncome: number;
  totalExpense: number;
  upcomingBiggestExpense: { description: string; amount: number; date: string } | null;
  nextPaymentDate: string | null;
}

export interface CalendarData {
  days: CalendarDay[];
  summary: CalendarSummary;
}

const WEEK_HEADERS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function CalendarDayCell({
  day,
  currentMonth,
  activity,
  isSelected,
  onSelectDate,
}: {
  day: Date;
  currentMonth: Date;
  activity: { hasIncome: boolean; hasExpense: boolean } | undefined;
  isSelected: boolean;
  onSelectDate: (date: string | null) => void;
}) {
  const dateStr = format(day, 'yyyy-MM-dd');
  const inMonth = isSameMonth(day, currentMonth);
  const today = isToday(day);
  const activitySuffix = activity?.hasIncome && activity.hasExpense
    ? ', receitas e despesas'
    : activity?.hasIncome
      ? ', receitas'
      : activity?.hasExpense
        ? ', despesas'
        : '';

  return (
    <button
      type="button"
      aria-label={`${format(day, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}${activitySuffix}`}
      aria-current={today ? 'date' : undefined}
      aria-pressed={isSelected}
      aria-disabled={!activity}
      onClick={() => {
        if (activity) {
          onSelectDate(isSelected ? null : dateStr);
        }
      }}
      className={cn(
        'relative flex flex-col items-center justify-center min-h-10 rounded-md text-xs tabular-nums focus-visible:outline-2 focus-visible:outline-primary',
        !inMonth && 'text-muted-foreground',
        today && 'ring-2 ring-primary ring-offset-1 ring-offset-background font-semibold',
        isSelected && 'bg-primary text-primary-foreground',
        activity && !isSelected && inMonth && 'hover:bg-muted/60 cursor-pointer',
        !activity && inMonth && !today && 'cursor-default',
      )}
    >
      <span className={cn('leading-none', isSelected && 'text-primary-foreground')}>
        {format(day, 'd')}
      </span>
      {activity && inMonth && (
        <span className="text-xs leading-none">
          {activity.hasIncome && activity.hasExpense ? '+/−' : activity.hasIncome ? '+' : activity.hasExpense ? '−' : ''}
        </span>
      )}
      {today && !isSelected && (
        <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
      )}
    </button>
  );
}

/** Month grid for FinancialCalendar preserving civil dates and keyboard navigation. */
export function FinancialCalendarGrid({
  currentMonth,
  calendarDays,
  activityMap,
  selectedDate,
  onSelectDate,
  setCurrentMonth,
}: {
  currentMonth: Date;
  calendarDays: Date[];
  activityMap: Map<string, { hasIncome: boolean; hasExpense: boolean }>;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  setCurrentMonth: Dispatch<SetStateAction<Date>>;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 sm:p-4">
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

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEK_HEADERS.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          return (
            <CalendarDayCell
              key={dateStr}
              day={day}
              currentMonth={currentMonth}
              activity={activityMap.get(dateStr)}
              isSelected={selectedDate === dateStr}
              onSelectDate={onSelectDate}
            />
          );
        })}
      </div>

      <p className="mt-3 border-t border-border pt-2 text-center text-xs text-muted-foreground">
        + Receita · − Despesa · +/− Ambos
      </p>
    </div>
  );
}

function CalendarEventLeading({
  event,
  isIncome,
}: {
  event: CalendarEvent;
  isIncome: boolean;
}) {
  const bgClass =
    event.type === 'purchase'
      ? 'bg-[var(--primary)]/10'
      : event.type === 'recurring'
        ? isIncome
          ? 'bg-[var(--money)]/10'
          : 'bg-[var(--obligation)]/10'
        : isIncome
          ? 'bg-[var(--money)]/10'
          : 'bg-[var(--debt)]/10';

  return (
    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', bgClass)}>
      {event.type === 'purchase' ? (
        <ShoppingBag className="w-4 h-4 text-primary" />
      ) : event.type === 'recurring' ? (
        <Repeat className={cn('w-4 h-4', isIncome ? 'text-[var(--money)]' : 'text-[var(--obligation)]')} />
      ) : isIncome ? (
        <ArrowUpRight className="w-4 h-4 text-[var(--money)]" />
      ) : (
        <ArrowDownRight className="w-4 h-4 text-[var(--debt)]" />
      )}
    </div>
  );
}

function CalendarEventRow({
  event,
  selectedDate,
}: {
  event: CalendarEvent & { date?: string };
  selectedDate: string | null;
}) {
  const isIncome = event.amount > 0;
  const showDate = !selectedDate && Boolean(event.date);

  return (
    <FinanceRow
      variant="compact"
      tone={isIncome ? 'positive' : 'negative'}
      className="px-1 py-2.5"
      leading={<CalendarEventLeading event={event} isIncome={isIncome} />}
      description={
        <span className="inline-flex items-center gap-2">
          <span>{event.description}</span>
          {event.isRecurring && <Repeat className="w-3 h-3 text-muted-foreground shrink-0" />}
        </span>
      }
      metadata={
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {event.category && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
              {event.category}
            </Badge>
          )}
          {event.account && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <Wallet className="w-2.5 h-2.5" />
              {event.account}
            </span>
          )}
          {event.time && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {event.time}
            </span>
          )}
          {showDate && event.date && (
            <span className="text-xs text-muted-foreground">
              {format(parseISO(event.date), 'dd/MM')}
            </span>
          )}
        </div>
      }
      amount={event.amount}
    />
  );
}

/** Agenda list for FinancialCalendar using FinanceRow for day events. */
export function FinancialCalendarAgenda({
  selectedDate,
  selectedDayData,
  filteredEvents,
  onToday,
}: {
  selectedDate: string | null;
  selectedDayData: CalendarDay | null;
  filteredEvents: Array<CalendarEvent & { date?: string }>;
  onToday: () => void;
}) {
  return (
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
          <div key="empty" className="flex flex-col items-center justify-center py-8 text-center">
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
          <ul key={selectedDate || 'all'} className="divide-y divide-border" role="list">
            {filteredEvents.map((event) => (
              <CalendarEventRow key={event.id} event={event} selectedDate={selectedDate} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
