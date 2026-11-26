'use client';

import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FinanceMetric } from '@/components/shared/finance-metric';
import { QueryPanel, type QueryPanelStatus } from '@/components/shared/query-panel';
import { useSafeLocale, useSafeTranslations } from '@/i18n/provider';
import { currencyFmt } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { TIMELINE_FILTER_DAYS } from './analytics-i18n';
import {
  SpendingTimelineChart,
  SpendingTimelineDayRow,
  type TimelineDay,
} from './spending-day-details';

export type SpendingTimelineRequest = { days: number };
export type SpendingTimelineStatus =
  | { status: 'ready'; data: TimelineDay[] }
  | { status: 'error' };
export type SpendingTimelineResult = {
  request: SpendingTimelineRequest;
  result: SpendingTimelineStatus;
};

export async function requestSpendingTimeline(
  request: SpendingTimelineRequest,
  signal: AbortSignal,
  publish: (response: SpendingTimelineResult) => void,
  fetcher: (url: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<void> {
  let result: SpendingTimelineStatus;
  try {
    const res = await fetcher(`/api/timeline?days=${request.days}`, { signal });
    result = res.ok ? { status: 'ready', data: await res.json() } : { status: 'error' };
  } catch {
    result = { status: 'error' };
  }
  if (!signal.aborted) publish({ request, result });
}

export function currentSpendingTimeline(
  request: SpendingTimelineRequest,
  settled: SpendingTimelineResult | null,
): SpendingTimelineStatus | { status: 'loading' } {
  return settled?.request === request ? settled.result : { status: 'loading' };
}

export function SpendingTimeline({ showValues = true }: { showValues?: boolean } = {}) {
  const locale = useSafeLocale();
  const [request, setRequest] = useState<SpendingTimelineRequest>({ days: 30 });
  const [settled, setSettled] = useState<SpendingTimelineResult | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const query = currentSpendingTimeline(request, settled);
  const data = query.status === 'ready' ? query.data : [];
  const loading = query.status === 'loading';
  const error = query.status === 'error';

  useEffect(() => {
    void locale;
    const controller = new AbortController();
    void requestSpendingTimeline(request, controller.signal, setSettled);
    return () => controller.abort();
  }, [request, locale]);

  return (
    <SpendingTimelineContent
      data={data}
      loading={loading}
      error={error}
      activeDays={request.days}
      expandedDay={expandedDay}
      onSelectDays={(days) => {
        if (days !== request.days) setRequest({ days });
      }}
      onToggleDay={(date) => setExpandedDay((prev) => (prev === date ? null : date))}
      onRetry={() => setRequest({ days: request.days })}
      showValues={showValues}
    />
  );
}

export function SpendingTimelineContent({
  data,
  loading,
  error,
  activeDays,
  expandedDay,
  onSelectDays,
  onToggleDay,
  onRetry,
  showValues = true,
}: {
  data: TimelineDay[];
  loading: boolean;
  error: boolean;
  activeDays: number;
  expandedDay: string | null;
  onSelectDays: (days: number) => void;
  onToggleDay: (date: string) => void;
  onRetry: () => void;
  showValues?: boolean;
}) {
  const t = useSafeTranslations('analytics');
  const tShared = useSafeTranslations('shared');
  const locale = useSafeLocale();
  const maskedValue = tShared.has('maskedValue') ? tShared('maskedValue') : 'R$ ••••••';
  const totalIncome = data.reduce((sum, d) => sum + d.income, 0);
  const totalExpense = data.reduce((sum, d) => sum + d.expense, 0);
  const daysWithActivity = data.filter((d) => d.count > 0);
  const maxAbsNet = Math.max(...data.map((d) => Math.abs(d.net)), 1);
  const chartData = [...data].reverse();

  const status: QueryPanelStatus = loading ? 'loading' : error ? 'error' : 'success';

  const controls = !loading && !error ? (
    <div role="group" aria-label={t('timeline.periodAria')} className="flex flex-wrap items-center gap-1">
      {TIMELINE_FILTER_DAYS.map((days) => (
        <button
          key={days}
          type="button"
          aria-pressed={activeDays === days}
          onClick={() => onSelectDays(days)}
          className={cn(
            'min-h-9 rounded-md px-2 text-xs font-medium whitespace-nowrap',
            activeDays === days
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          {t('timeline.filterDays', { count: days })}
        </button>
      ))}
      <Button
        variant="outline"
        size="icon"
        className="size-9"
        aria-label={t('timeline.refreshAria')}
        onClick={onRetry}
      >
        <RefreshCw className="w-3.5 h-3.5" />
      </Button>
    </div>
  ) : undefined;

  return (
    <QueryPanel
      titleId="quiet-timeline"
      title={t('timeline.title')}
      subtitle={!loading && !error ? t('timeline.subtitle', { count: daysWithActivity.length }) : undefined}
      controls={controls}
      status={status}
      loadingMessage={t('timeline.loading')}
      errorMessage={t('timeline.error')}
      retryLabel={t('common.retry')}
      onRetry={onRetry}
    >
      {data.length > 0 ? (
        <div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3">
            <FinanceMetric
              variant="cell"
              className="col-span-2 bg-card p-3 sm:col-span-1 sm:p-3"
              valueClassName="mt-0 text-sm sm:text-sm"
              label={t('timeline.metrics.runningBalance')}
              value={`${data[0].runningBalance >= 0 ? '+' : ''}${currencyFmt(data[0].runningBalance, locale)}`}
              showValues={showValues}
              maskedValue={maskedValue}
            />
            <FinanceMetric
              variant="cell"
              className="bg-card p-3 sm:p-3"
              valueClassName="mt-0 text-sm font-normal sm:text-sm"
              label={t('timeline.metrics.income')}
              value={currencyFmt(totalIncome, locale)}
              showValues={showValues}
              maskedValue={maskedValue}
            />
            <FinanceMetric
              variant="cell"
              className="bg-card p-3 sm:p-3"
              valueClassName="mt-0 text-sm font-normal sm:text-sm"
              label={t('timeline.metrics.expense')}
              value={currencyFmt(totalExpense, locale)}
              showValues={showValues}
              maskedValue={maskedValue}
            />
          </dl>
          <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-[var(--ds-accent-positive)]"
              style={{
                width: `${showValues ? (totalIncome + totalExpense > 0
                  ? (totalIncome / (totalIncome + totalExpense)) * 100
                  : 50) : 0}%`,
              }}
            />
          </div>
        </div>
      ) : (
        <p role="status" className="text-sm text-muted-foreground">{t('timeline.empty')}</p>
      )}

      {chartData.length > 0 && (
        <SpendingTimelineChart chartData={chartData} maxAbsNet={maxAbsNet} showValues={showValues} />
      )}

      <ScrollArea className="[&>[data-slot=scroll-area-viewport]]:max-h-[420px]">
        <ul className="divide-y divide-border pr-2">
          {data.map((day) => (
            <SpendingTimelineDayRow
              key={day.date}
              day={day}
              isExpanded={expandedDay === day.date}
              onToggleDay={onToggleDay}
              showValues={showValues}
            />
          ))}
        </ul>
      </ScrollArea>
    </QueryPanel>
  );
}
