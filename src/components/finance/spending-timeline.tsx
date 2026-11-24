'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowUpRight,
  ArrowDownRight,
  ShoppingBag,
  ChevronDown,
  Minus,
  RefreshCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { currencyFmt } from '@/lib/helpers';

// ─── Helpers ───────────────────────────────────────────────────────

const formatDateHeader = (dateStr: string) => {
  try {
    const d = parseISO(dateStr);
    if (isToday(d)) return 'Hoje';
    if (isYesterday(d)) return 'Ontem';
    return format(d, "EEE, dd 'de' MMMM", { locale: ptBR });
  } catch {
    return dateStr;
  }
};

// ─── Types ─────────────────────────────────────────────────────────
interface TimelineItem {
  type: 'transaction' | 'purchase';
  description: string;
  amount: number;
  category: string;
}

interface TimelineDay {
  date: string;
  income: number;
  expense: number;
  net: number;
  count: number;
  runningBalance: number;
  items: TimelineItem[];
}

const FILTER_OPTIONS = [
  { label: '7 dias', days: 7 },
  { label: '15 dias', days: 15 },
  { label: '30 dias', days: 30 },
] as const;

// ─── Main Component ────────────────────────────────────────────────
export function SpendingTimeline() {
  const [data, setData] = useState<TimelineDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeDays, setActiveDays] = useState(30);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const fetchTimeline = useCallback(async (days: number) => {
    try {
      setLoading(true);
      setError(false);
      const res = await fetch(`/api/timeline?days=${days}`);
      if (!res.ok) {
        setError(true);
        return;
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error('Erro ao buscar linha do tempo:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTimeline(activeDays);
  }, [activeDays, fetchTimeline]);

  return (
    <SpendingTimelineContent
      data={data}
      loading={loading}
      error={error}
      activeDays={activeDays}
      expandedDay={expandedDay}
      onSelectDays={setActiveDays}
      onToggleDay={(date) => setExpandedDay((prev) => (prev === date ? null : date))}
      onRetry={() => fetchTimeline(activeDays)}
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
  // ─── Computed values ─────────────────────────────────────────────
  const totalIncome = data.reduce((sum, d) => sum + d.income, 0);
  const totalExpense = data.reduce((sum, d) => sum + d.expense, 0);
  const daysWithActivity = data.filter((d) => d.count > 0);
  const maxAbsNet = Math.max(
    ...data.map((d) => Math.abs(d.net)),
    1
  );

  // Reversed data for the bar chart (oldest first)
  const chartData = [...data].reverse();

  // ─── Loading Skeleton ─────────────────────────────────────────────
  if (loading) {
    return (
      <section aria-labelledby="quiet-timeline" className="min-w-0 rounded-lg border border-border bg-card text-card-foreground">
        <header className="px-3 py-3 sm:px-4"><h3 id="quiet-timeline" className="text-sm font-semibold">Linha do tempo</h3></header>
        <p role="status" className="border-t border-border px-3 py-3 text-sm text-muted-foreground sm:px-4">Carregando movimentações…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section aria-labelledby="quiet-timeline" className="min-w-0 rounded-lg border border-border bg-card text-card-foreground">
        <header className="px-3 py-3 sm:px-4"><h3 id="quiet-timeline" className="text-sm font-semibold">Linha do tempo</h3></header>
        <div className="flex flex-wrap items-center gap-3 border-t border-border px-3 py-3 sm:px-4">
          <p role="alert" className="text-sm text-muted-foreground">Não foi possível carregar a linha do tempo.</p>
          <Button variant="outline" size="sm" className="min-h-9" onClick={onRetry}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Tentar novamente
          </Button>
        </div>
      </section>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <section aria-labelledby="quiet-timeline" className="min-w-0 rounded-lg border border-border bg-card text-card-foreground">

      <header className="border-b border-border px-3 py-3 sm:px-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="min-w-0">
            <h3 id="quiet-timeline" className="text-sm font-semibold">Linha do tempo</h3>
            <p className="text-xs text-muted-foreground">Fluxo de caixa diário · {daysWithActivity.length} dias com atividade</p>
          </div>
          <div role="group" aria-label="Período da linha do tempo" className="flex flex-wrap items-center gap-1">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                type="button"
                aria-pressed={activeDays === opt.days}
                onClick={() => onSelectDays(opt.days)}
                className={`min-h-9 rounded-md px-2 text-xs font-medium whitespace-nowrap ${
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
              className="size-9"
              aria-label="Atualizar linha do tempo"
              onClick={onRetry}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="space-y-4 px-3 py-3 sm:px-4">
        {data.length > 0 ? (
          <div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3">
            <div className="col-span-2 min-w-0 bg-card p-3 sm:col-span-1">
              <dt className="text-xs text-muted-foreground">Saldo acumulado</dt>
              <dd className="break-words font-mono text-sm font-semibold tabular-nums">{data[0].runningBalance >= 0 ? '+' : ''}{currencyFmt(data[0].runningBalance)}</dd>
            </div>
            <div className="min-w-0 bg-card p-3">
              <dt className="text-xs text-muted-foreground">Receitas</dt>
              <dd className="break-words font-mono text-sm tabular-nums">{currencyFmt(totalIncome)}</dd>
            </div>
            <div className="min-w-0 bg-card p-3">
              <dt className="text-xs text-muted-foreground">Despesas</dt>
              <dd className="break-words font-mono text-sm tabular-nums">{currencyFmt(totalExpense)}</dd>
            </div>
          </dl>
          <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-[var(--ds-accent-positive)]"
              style={{ width: `${totalIncome + totalExpense > 0
                ? (totalIncome / (totalIncome + totalExpense)) * 100
                : 50}%` }}
            />
          </div>
          </div>
        ) : <p role="status" className="text-sm text-muted-foreground">Sem dados de movimentação para exibir.</p>}
        {chartData.length > 0 && (
          <div className="border-b border-border pb-3">
            <p className="mb-2 text-xs font-medium">Saldo líquido por dia</p>
            <div className="flex items-end justify-center gap-[3px] sm:gap-1 h-20">
              <div className="flex items-end justify-center gap-[3px] sm:gap-1 h-full w-full">
                {chartData.map((day) => {
                  const height = maxAbsNet > 0
                    ? Math.max(4, (Math.abs(day.net) / maxAbsNet) * 100)
                    : 4;
                  const isPositive = day.net >= 0;
                  const color = day.count === 0
                    ? 'bg-muted-foreground/15'
                    : isPositive
                      ? 'bg-[var(--ds-accent-positive)]'
                      : 'bg-[var(--ds-accent-danger)]';

                  return (
                    <div
                      key={day.date}
                      style={{ height: `${height}%`, minHeight: '3px' }}
                      className={`flex-1 max-w-[14px] rounded-t-sm ${color}`}
                      title={`${day.date}: ${currencyFmt(day.net)}${day.count === 0 ? ' · Sem atividade' : ''}`}
                    />
                  );
                })}
              </div>
            </div>
            {/* Legend */}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-[var(--ds-accent-positive)]" />
                <span className="text-xs text-muted-foreground">Positivo</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-[var(--ds-accent-danger)]" />
                <span className="text-xs text-muted-foreground">Negativo</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-muted-foreground/15" />
                <span className="text-xs text-muted-foreground">Sem atividade</span>
              </div>
            </div>
          </div>
        )}

        <ScrollArea className="[&>[data-slot=scroll-area-viewport]]:max-h-[420px]">
          <ul className="divide-y divide-border pr-2">
            {data.map((day) => {
              const isExpanded = expandedDay === day.date;
              const hasItems = day.count > 0;
              const isNetPositive = day.net >= 0;

              return (
                <li key={day.date}>
                  {/* Day header row */}
                  <button
                    type="button"
                    aria-expanded={isExpanded && hasItems}
                    onClick={() => onToggleDay(day.date)}
                    className="flex w-full flex-wrap items-center justify-between gap-2 rounded-sm px-2 py-3 text-left hover:bg-muted/30 focus-visible:outline-offset-[-2px]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Day indicator dot */}
                      <div
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          !hasItems
                            ? 'bg-muted-foreground/20'
                            : isNetPositive
                              ? 'bg-[var(--ds-accent-positive)]'
                              : 'bg-[var(--ds-accent-danger)]'
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold capitalize">
                            {formatDateHeader(day.date)}
                          </span>
                          {isToday(parseISO(day.date)) && (
                            <Badge className="text-xs px-1.5 py-0 h-5 bg-primary/10 text-primary border-primary/20">
                              Atual
                            </Badge>
                          )}
                        </div>
                        {hasItems && (
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2">
                            <span className="text-xs text-muted-foreground">
                              {day.count} {day.count === 1 ? 'movimento' : 'movimentos'}
                            </span>
                            {day.income > 0 && (
                              <span className="font-mono text-xs tabular-nums text-[var(--ds-accent-positive)] font-medium">
                                +{currencyFmt(day.income)}
                              </span>
                            )}
                            {day.expense > 0 && (
                              <span className="font-mono text-xs tabular-nums text-[var(--ds-accent-danger)] font-medium">
                                -{currencyFmt(day.expense)}
                              </span>
                            )}
                          </div>
                        )}
                        {!hasItems && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="w-4 h-4 rounded-full bg-muted/50 flex items-center justify-center">
                              <Minus className="w-2.5 h-2.5 text-muted-foreground/40" />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Sem movimentações
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {/* Net amount */}
                      {hasItems && (
                        <div className="text-right">
                          <span
                            className={`font-mono text-sm font-semibold tabular-nums ${
                              isNetPositive ? 'text-[var(--ds-accent-positive)]' : 'text-[var(--ds-accent-danger)]'
                            }`}
                          >
                            {isNetPositive ? '+' : ''}
                            {currencyFmt(day.net)}
                          </span>
                        </div>
                      )}
                      {/* Expand/collapse chevron */}
                      {hasItems && (
                        <ChevronDown className={`w-4 h-4 text-muted-foreground ${isExpanded ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </button>

                  {/* Expanded items */}
                  {isExpanded && hasItems && (
                    <div className="border-t border-border/40 bg-muted/20">
                      <div className="p-3 sm:p-4 space-y-1.5">
                        {day.items.map((txItem, idx) => {
                          const isIncomeItem = txItem.amount > 0;
                          return (
                            <div
                              key={`${day.date}-${idx}`}
                              className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/30"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {/* Type icon */}
                                <div
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                    txItem.type === 'transaction'
                                      ? isIncomeItem
                                        ? 'bg-[var(--ds-accent-positive)]/10'
                                        : 'bg-[var(--ds-accent-danger)]/10'
                                      : 'bg-primary/10'
                                  }`}
                                >
                                  {txItem.type === 'purchase' ? (
                                    <ShoppingBag className="w-4 h-4 text-primary" />
                                  ) : isIncomeItem ? (
                                    <ArrowUpRight className="w-4 h-4 text-[var(--ds-accent-positive)]" />
                                  ) : (
                                    <ArrowDownRight className="w-4 h-4 text-[var(--ds-accent-danger)]" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="break-words text-sm font-medium">
                                    {txItem.description}
                                  </p>
                                  <Badge
                                    variant="secondary"
                                    className="text-xs px-1.5 py-0 h-5 mt-0.5"
                                  >
                                    {txItem.category}
                                  </Badge>
                                </div>
                              </div>
                              <span
                                className={`font-mono text-sm font-semibold tabular-nums whitespace-nowrap ml-2 ${
                                  isIncomeItem ? 'text-[var(--ds-accent-positive)]' : 'text-[var(--ds-accent-danger)]'
                                }`}
                              >
                                {isIncomeItem ? '+' : ''}
                                {currencyFmt(txItem.amount)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </div>
    </section>
  );
}
