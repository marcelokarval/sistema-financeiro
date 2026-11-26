'use client';

import type { Dispatch, SetStateAction } from 'react';
import { format, isSameMonth, isToday } from 'date-fns';
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
import { useSafeLocale, useSafeTranslations } from '@/i18n/provider';
import { cn } from '@/lib/utils';
import {
  CALENDAR_DATE_FORMATS,
  WEEKDAY_HEADER_KEYS,
  getDateFnsLocale,
  parseCivilDate,
} from './analytics-i18n';

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
  const t = useSafeTranslations('analytics');
  const locale = useSafeLocale();
  const dateFnsLocale = getDateFnsLocale(locale);
  const fullDateFmt = CALENDAR_DATE_FORMATS[locale].fullDate;
  const dateStr = format(day, 'yyyy-MM-dd');
  const inMonth = isSameMonth(day, currentMonth);
  const today = isToday(day);
  const activitySuffix = activity?.hasIncome && activity.hasExpense
    ? t('calendar.activity.both')
    : activity?.hasIncome
      ? t('calendar.activity.income')
      : activity?.hasExpense
        ? t('calendar.activity.expense')
        : '';

  return (
    <button
      type="button"
      aria-label={`${format(day, fullDateFmt, { locale: dateFnsLocale })}${activitySuffix}`}
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
  const t = useSafeTranslations('analytics');
  const locale = useSafeLocale();
  const dateFnsLocale = getDateFnsLocale(locale);

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          aria-label={t('calendar.prevMonthAria')}
          onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
          className="grid size-9 place-items-center rounded-md hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <span className="text-sm font-semibold capitalize">
          {format(currentMonth, CALENDAR_DATE_FORMATS[locale].monthYear, { locale: dateFnsLocale })}
        </span>
        <button
          type="button"
          aria-label={t('calendar.nextMonthAria')}
          onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
          className="grid size-9 place-items-center rounded-md hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_HEADER_KEYS.map((dayKey) => (
          <div key={dayKey} className="text-center text-xs font-medium text-muted-foreground py-1">
            {t(`calendar.weekdays.${dayKey}`)}
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
        {t('calendar.legend')}
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
  const locale = useSafeLocale();
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
              {format(parseCivilDate(event.date), CALENDAR_DATE_FORMATS[locale].daySlashMonth)}
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
  const t = useSafeTranslations('analytics');
  const locale = useSafeLocale();
  const dateFnsLocale = getDateFnsLocale(locale);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          <h4 id="calendar-agenda-heading" className="text-sm font-semibold">
            {selectedDate
              ? format(parseCivilDate(selectedDate), CALENDAR_DATE_FORMATS[locale].dayMonthWeekday, { locale: dateFnsLocale })
              : t('calendar.allUpcoming')}
          </h4>
          {selectedDate && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
              {t('calendar.eventsCount', { count: selectedDayData?.events.length || 0 })}
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
            {t('calendar.today')}
          </Button>
        )}
      </div>

      <div className="max-h-96 overflow-y-auto" tabIndex={0} role="region" aria-labelledby="calendar-agenda-heading">
        {filteredEvents.length === 0 ? (
          <div key="empty" className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              {selectedDate ? t('calendar.emptyDayTitle') : t('calendar.emptyUpcomingTitle')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedDate
                ? t('calendar.emptyDaySubtitle')
                : t('calendar.emptyUpcomingSubtitle')}
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
