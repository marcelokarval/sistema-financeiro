'use client';

import { format, isToday, isYesterday } from 'date-fns';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  Minus,
  ShoppingBag,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { FinanceRow } from '@/components/shared/finance-row';
import { useSafeLocale, useSafeTranslations } from '@/i18n/provider';
import { currencyFmt } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import {
  CALENDAR_DATE_FORMATS,
  getDateFnsLocale,
  parseCivilDate,
} from './analytics-i18n';

export interface TimelineItem {
  type: 'transaction' | 'purchase';
  description: string;
  amount: number;
  category: string;
}

export interface TimelineDay {
  date: string;
  income: number;
  expense: number;
  net: number;
  count: number;
  runningBalance: number;
  items: TimelineItem[];
}

/** Mini daily net balance bar chart for SpendingTimelineContent. */
export function SpendingTimelineChart({
  chartData,
  maxAbsNet,
}: {
  chartData: TimelineDay[];
  maxAbsNet: number;
}) {
  const t = useSafeTranslations('analytics');
  const locale = useSafeLocale();
  return (
    <div className="border-b border-border pb-3">
      <p className="mb-2 text-xs font-medium">{t('timeline.chartTitle')}</p>
      <div className="flex items-end justify-center gap-[3px] sm:gap-1 h-20">
        <div className="flex items-end justify-center gap-[3px] sm:gap-1 h-full w-full">
          {chartData.map((day) => {
            const height = maxAbsNet > 0 ? Math.max(4, (Math.abs(day.net) / maxAbsNet) * 100) : 4;
            const color = day.count === 0
              ? 'bg-muted-foreground/15'
              : day.net >= 0
                ? 'bg-[var(--ds-accent-positive)]'
                : 'bg-[var(--ds-accent-danger)]';

            return (
              <div
                key={day.date}
                style={{ height: `${height}%`, minHeight: '3px' }}
                className={cn('flex-1 max-w-[14px] rounded-t-sm', color)}
                title={`${day.date}: ${currencyFmt(day.net, locale)}${day.count === 0 ? t('timeline.noActivitySuffix') : ''}`}
              />
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-[var(--ds-accent-positive)]" />
          <span className="text-xs text-muted-foreground">{t('timeline.legend.positive')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-[var(--ds-accent-danger)]" />
          <span className="text-xs text-muted-foreground">{t('timeline.legend.negative')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-muted-foreground/15" />
          <span className="text-xs text-muted-foreground">{t('timeline.legend.noActivity')}</span>
        </div>
      </div>
    </div>
  );
}

function SpendingDayItems({ date, items }: { date: string; items: TimelineItem[] }) {
  return (
    <div className="border-t border-border/40 bg-muted/20">
      <ul className="space-y-1.5 p-3 sm:p-4">
        {items.map((txItem, idx) => {
          const isIncomeItem = txItem.amount > 0;
          return (
            <FinanceRow
              key={`${date}-${idx}`}
              variant="timeline"
              tone={isIncomeItem ? 'positive' : 'negative'}
              description={txItem.description}
              metadata={
                <Badge variant="secondary" className="h-5 px-1.5 py-0 text-xs">
                  {txItem.category}
                </Badge>
              }
              amount={txItem.amount}
              leading={
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    txItem.type === 'purchase'
                      ? 'bg-primary/10'
                      : isIncomeItem
                        ? 'bg-[var(--ds-accent-positive)]/10'
                        : 'bg-[var(--ds-accent-danger)]/10',
                  )}
                >
                  {txItem.type === 'purchase' ? (
                    <ShoppingBag aria-hidden="true" className="h-4 w-4 text-primary" />
                  ) : isIncomeItem ? (
                    <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-[var(--ds-accent-positive)]" />
                  ) : (
                    <ArrowDownRight aria-hidden="true" className="h-4 w-4 text-[var(--ds-accent-danger)]" />
                  )}
                </div>
              }
            />
          );
        })}
      </ul>
    </div>
  );
}

/** Expandable day row for SpendingTimelineContent delegating line items to FinanceRow. */
export function SpendingTimelineDayRow({
  day,
  isExpanded,
  onToggleDay,
}: {
  day: TimelineDay;
  isExpanded: boolean;
  onToggleDay: (date: string) => void;
}) {
  const t = useSafeTranslations('analytics');
  const locale = useSafeLocale();
  const hasItems = day.count > 0;
  const isNetPositive = day.net >= 0;

  let formattedHeader = day.date;
  let parsedDay: Date | null = null;
  try {
    parsedDay = parseCivilDate(day.date);
    if (isToday(parsedDay)) formattedHeader = t('timeline.today');
    else if (isYesterday(parsedDay)) formattedHeader = t('timeline.yesterday');
    else formattedHeader = format(parsedDay, CALENDAR_DATE_FORMATS[locale].shortDayMonthWeekday, { locale: getDateFnsLocale(locale) });
  } catch {
    formattedHeader = day.date;
  }

  return (
    <li>
      <button
        type="button"
        aria-expanded={isExpanded && hasItems}
        onClick={() => onToggleDay(day.date)}
        className="flex w-full flex-wrap items-center justify-between gap-2 rounded-sm px-2 py-3 text-left hover:bg-muted/30 focus-visible:outline-offset-[-2px]"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              'w-2.5 h-2.5 rounded-full shrink-0',
              !hasItems
                ? 'bg-muted-foreground/20'
                : isNetPositive
                  ? 'bg-[var(--ds-accent-positive)]'
                  : 'bg-[var(--ds-accent-danger)]',
            )}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold capitalize">
                {formattedHeader}
              </span>
              {parsedDay && isToday(parsedDay) && (
                <Badge className="text-xs px-1.5 py-0 h-5 bg-primary/10 text-primary border-primary/20">
                  {t('timeline.currentBadge')}
                </Badge>
              )}
            </div>
            {hasItems ? (
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2">
                <span className="text-xs text-muted-foreground">
                  {t('timeline.movementsCount', { count: day.count })}
                </span>
                {day.income > 0 && (
                  <span className="font-mono text-xs tabular-nums text-[var(--ds-accent-positive)] font-medium">
                    +{currencyFmt(day.income, locale)}
                  </span>
                )}
                {day.expense > 0 && (
                  <span className="font-mono text-xs tabular-nums text-[var(--ds-accent-danger)] font-medium">
                    -{currencyFmt(day.expense, locale)}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-4 h-4 rounded-full bg-muted/50 flex items-center justify-center">
                  <Minus className="w-2.5 h-2.5 text-muted-foreground/40" />
                </div>
                <p className="text-xs text-muted-foreground">{t('timeline.noMovements')}</p>
              </div>
            )}
          </div>
        </div>

        {hasItems && (
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="text-right">
              <span
                className={cn(
                  'font-mono text-sm font-semibold tabular-nums',
                  isNetPositive ? 'text-[var(--ds-accent-positive)]' : 'text-[var(--ds-accent-danger)]',
                )}
              >
                {isNetPositive ? '+' : ''}
                {currencyFmt(day.net, locale)}
              </span>
            </div>
            <ChevronDown className={cn('w-4 h-4 text-muted-foreground', isExpanded && 'rotate-180')} />
          </div>
        )}
      </button>

      {isExpanded && hasItems && <SpendingDayItems date={day.date} items={day.items} />}
    </li>
  );
}
