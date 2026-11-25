'use client';

import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FinanceMetric } from '@/components/shared/finance-metric';
import { QueryPanel, type QueryPanelStatus } from '@/components/shared/query-panel';
import { currencyFmt } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import {
  SpendingTimelineChart,
  SpendingTimelineDayRow,
  type TimelineDay,
} from './spending-day-details';

const FILTER_OPTIONS = [
  { label: '7 dias', days: 7 },
  { label: '15 dias', days: 15 },
  { label: '30 dias', days: 30 },
] as const;

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

export function SpendingTimeline() {
  const [request, setRequest] = useState<SpendingTimelineRequest>({ days: 30 });
  const [settled, setSettled] = useState<SpendingTimelineResult | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const query = currentSpendingTimeline(request, settled);
  const data = query.status === 'ready' ? query.data : [];
  const loading = query.status === 'loading';
  const error = query.status === 'error';

  useEffect(() => {
    const controller = new AbortController();
    void requestSpendingTimeline(request, controller.signal, setSettled);
    return () => controller.abort();
  }, [request]);

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
}: {
  data: TimelineDay[];
  loading: boolean;
  error: boolean;
  activeDays: number;
  expandedDay: string | null;
  onSelectDays: (days: number) => void;
  onToggleDay: (date: string) => void;
  onRetry: () => void;
}) {
  const totalIncome = data.reduce((sum, d) => sum + d.income, 0);
  const totalExpense = data.reduce((sum, d) => sum + d.expense, 0);
  const daysWithActivity = data.filter((d) => d.count > 0);
  const maxAbsNet = Math.max(...data.map((d) => Math.abs(d.net)), 1);
  const chartData = [...data].reverse();

  const status: QueryPanelStatus = loading ? 'loading' : error ? 'error' : 'success';

  const controls = !loading && !error ? (
    <div role="group" aria-label="Período da linha do tempo" className="flex flex-wrap items-center gap-1">
      {FILTER_OPTIONS.map((opt) => (
        <button
          key={opt.days}
          type="button"
          aria-pressed={activeDays === opt.days}
          onClick={() => onSelectDays(opt.days)}
          className={cn(
            'min-h-9 rounded-md px-2 text-xs font-medium whitespace-nowrap',
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
        className="size-9"
        aria-label="Atualizar linha do tempo"
        onClick={onRetry}
      >
        <RefreshCw className="w-3.5 h-3.5" />
      </Button>
    </div>
  ) : undefined;

  return (
    <QueryPanel
      titleId="quiet-timeline"
      title="Linha do tempo"
      subtitle={!loading && !error ? `Fluxo de caixa diário · ${daysWithActivity.length} dias com atividade` : undefined}
      controls={controls}
      status={status}
      loadingMessage="Carregando movimentações…"
      errorMessage="Não foi possível carregar a linha do tempo."
      onRetry={onRetry}
    >
      {data.length > 0 ? (
        <div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3">
            <FinanceMetric
              variant="cell"
              className="col-span-2 bg-card p-3 sm:col-span-1 sm:p-3"
              valueClassName="mt-0 text-sm sm:text-sm"
              label="Saldo acumulado"
              value={`${data[0].runningBalance >= 0 ? '+' : ''}${currencyFmt(data[0].runningBalance)}`}
            />
            <FinanceMetric
              variant="cell"
              className="bg-card p-3 sm:p-3"
              valueClassName="mt-0 text-sm font-normal sm:text-sm"
              label="Receitas"
              value={currencyFmt(totalIncome)}
            />
            <FinanceMetric
              variant="cell"
              className="bg-card p-3 sm:p-3"
              valueClassName="mt-0 text-sm font-normal sm:text-sm"
              label="Despesas"
              value={currencyFmt(totalExpense)}
            />
          </dl>
          <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-[var(--ds-accent-positive)]"
              style={{
                width: `${totalIncome + totalExpense > 0
                  ? (totalIncome / (totalIncome + totalExpense)) * 100
                  : 50}%`,
              }}
            />
          </div>
        </div>
      ) : (
        <p role="status" className="text-sm text-muted-foreground">Sem dados de movimentação para exibir.</p>
      )}

      {chartData.length > 0 && (
        <SpendingTimelineChart chartData={chartData} maxAbsNet={maxAbsNet} />
      )}

      <ScrollArea className="[&>[data-slot=scroll-area-viewport]]:max-h-[420px]">
        <ul className="divide-y divide-border pr-2">
          {data.map((day) => (
            <SpendingTimelineDayRow
              key={day.date}
              day={day}
              isExpanded={expandedDay === day.date}
              onToggleDay={onToggleDay}
            />
          ))}
        </ul>
      </ScrollArea>
    </QueryPanel>
  );
}
