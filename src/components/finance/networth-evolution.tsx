'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useSafeLocale, useSafeTranslations } from '@/i18n/provider';
import { currencyFmt, percentFmt } from '@/lib/helpers';
import {
  FinanceChartTooltip,
  type FinanceChartTooltipRow,
} from '@/components/shared/finance-chart-tooltip';
import { PROJECTION_MONTH_OPTIONS, formatNetworthAxis } from './analytics-i18n';

interface MonthlyDataPoint {
  month: string;
  netWorth: number;
  assets: number;
  liabilities: number;
  changePercent: number;
  changeAmount: number;
}
interface NetworthResponse {
  monthlyData: MonthlyDataPoint[];
}

export function NetworthEvolutionTooltip({
  active,
  payload,
  label,
  showValues = true,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: unknown; color?: string; dataKey?: string | number }>;
  label?: string;
  showValues?: boolean;
}) {
  const t = useSafeTranslations('analytics');
  const locale = useSafeLocale();
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;

  const rows: FinanceChartTooltipRow[] = payload.flatMap((entry) => {
    const key = entry?.dataKey != null ? String(entry.dataKey) : entry?.name;
    const rowLabel = entry?.dataKey === 'netWorth' ? t('networth.tooltip.netWorth') : entry?.name;
    if (typeof entry?.value !== 'number' || !Number.isFinite(entry.value) || !key || !rowLabel) {
      return [];
    }
    return [{
      key,
      label: rowLabel,
      value: currencyFmt(entry.value, locale),
      color: entry.color,
    }];
  });

  if (rows.length === 0) return null;

  return (
    <FinanceChartTooltip
      active={active}
      title={label}
      capitalizeTitle
      rows={rows}
      showValues={showValues}
    />
  );
}

export type NetworthRequest = { months: number };
export type NetworthStatus =
  | { status: 'ready'; data: NetworthResponse }
  | { status: 'error' };
export type NetworthResult = {
  request: NetworthRequest;
  result: NetworthStatus;
};

export async function requestNetworthEvolution(
  request: NetworthRequest,
  signal: AbortSignal,
  publish: (response: NetworthResult) => void,
  fetcher: (url: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<void> {
  let result: NetworthStatus;
  try {
    const res = await fetcher(`/api/networth?months=${request.months}`, { signal });
    result = res.ok ? { status: 'ready', data: await res.json() } : { status: 'error' };
  } catch {
    result = { status: 'error' };
  }
  if (!signal.aborted) publish({ request, result });
}

export function currentNetworthEvolution(
  request: NetworthRequest,
  settled: NetworthResult | null,
): NetworthStatus | { status: 'loading' } {
  // A new object identifies a new request even on retry or a return to the same period.
  return settled?.request === request ? settled.result : { status: 'loading' };
}

export function NetworthEvolution({ showValues = true }: { showValues?: boolean } = {}) {
  const locale = useSafeLocale();
  const [request, setRequest] = useState<NetworthRequest>({ months: 6 });
  const [settled, setSettled] = useState<NetworthResult | null>(null);
  const query = currentNetworthEvolution(request, settled);
  const data = query.status === 'ready' ? query.data : null;
  const loading = query.status === 'loading';

  const fetchData = useCallback((months: number) => {
    setRequest({ months });
  }, []);

  useEffect(() => {
    void locale;
    const controller = new AbortController();
    void requestNetworthEvolution(request, controller.signal, setSettled);
    return () => controller.abort();
  }, [request, locale]);

  return (
    <NetworthEvolutionContent
      data={data}
      loading={loading}
      selectedMonths={request.months}
      onSelectMonths={(months) => {
        if (months !== request.months) setRequest({ months });
      }}
      fetchData={fetchData}
      onRetry={() => setRequest({ months: request.months })}
      showValues={showValues}
    />
  );
}

export function NetworthEvolutionContent({
  data,
  loading,
  selectedMonths,
  onSelectMonths,
  fetchData,
  onRetry,
  showValues = true,
}: {
  data: NetworthResponse | null;
  loading: boolean;
  selectedMonths: number;
  onSelectMonths: (months: number) => void;
  fetchData: (months: number) => void;
  onRetry?: () => void;
  showValues?: boolean;
}) {
  const t = useSafeTranslations('analytics');
  const tShared = useSafeTranslations('shared');
  const locale = useSafeLocale();
  const maskedValue = tShared.has('maskedValue') ? tShared('maskedValue') : 'R$ ••••••';
  const money = (v: number) => (showValues ? currencyFmt(v, locale) : maskedValue);
  const handleRetry = onRetry ?? (() => fetchData(selectedMonths));

  if (loading) {
    return (
      <Card role="status" aria-label={t('networth.loadingAria')} className="min-w-0 gap-3 rounded-lg border-border bg-card py-4 shadow-none">
        <CardHeader className="px-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Skeleton className="max-w-full motion-reduce:animate-none w-9 h-9 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="max-w-full motion-reduce:animate-none h-5 w-48" />
                <Skeleton className="max-w-full motion-reduce:animate-none h-3 w-36" />
              </div>
            </div>
            <Skeleton className="max-w-full motion-reduce:animate-none h-9 w-40 rounded-lg" />
          </div>
        </CardHeader>
        <CardContent className="min-w-0 space-y-5 px-4 sm:px-5">
          <Skeleton className="max-w-full motion-reduce:animate-none h-72 w-full rounded-lg" />
          <div role="group" aria-label={t('networth.indicatorsAria')} className="grid grid-cols-1 gap-3 border-y border-border py-3 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="motion-reduce:animate-none h-24 w-full rounded-lg" />
            ))}
          </div>
          <Skeleton className="max-w-full motion-reduce:animate-none h-16 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }
  if (!data || !data.monthlyData.length) {
    return (
      <Card className="min-w-0 gap-3 rounded-lg border-border bg-card py-4 shadow-none">
        <CardContent className="space-y-3 px-4 py-4 text-sm">
          <Wallet className="w-10 h-10 text-muted-foreground" />
          <p role={!data ? 'alert' : 'status'} className="text-sm text-muted-foreground">
            {data ? t('networth.empty') : t('networth.error')}
          </p>
          <Button variant="outline" size="sm" className="min-h-9" onClick={handleRetry}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            {t('common.retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.monthlyData;
  const current = chartData[chartData.length - 1];
  const hasAnyNegative = chartData.some((d) => d.netWorth < 0);
  let highest = chartData[0];
  let lowest = chartData[0];
  for (const d of chartData) {
    if (d.netWorth > highest.netWorth) highest = d;
    if (d.netWorth < lowest.netWorth) lowest = d;
  }
  const milestoneTarget = 100_000;
  const milestoneProgress = Math.min(100, Math.max(0, (Math.max(0, current.netWorth) / milestoneTarget) * 100));

  return (
    <section aria-labelledby="networth-evolution-heading" className="min-w-0">
      <Card className="min-w-0 gap-3 rounded-lg border-border bg-card py-4 shadow-none">
        <CardHeader className="px-4 sm:px-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="min-w-0">
              <h3 id="networth-evolution-heading" className="text-base font-semibold">{t('networth.title')}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('networth.subtitle')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div role="group" aria-label={t('networth.periodAria')} className="flex items-center gap-1 rounded-md bg-muted/40 p-1">
                {PROJECTION_MONTH_OPTIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={selectedMonths === m}
                    aria-label={t('networth.monthsAria', { count: m })}
                    onClick={() => onSelectMonths(m)}
                    className={`min-h-9 px-3 py-1 rounded-md text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                      selectedMonths === m
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    }`}
                  >
                    {t('networth.monthsShort', { count: m })}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="size-9"
                aria-label={t('networth.refreshAria')}
                onClick={() => fetchData(selectedMonths)}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 space-y-5 px-4 sm:px-5">
          <div
            role="group"
            aria-label={t('networth.indicatorsAria')}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            <div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-muted-foreground font-medium">{t('networth.current')}</span>
                </div>
                <p className="font-mono text-base font-semibold tabular-nums text-foreground">
                  {money(current.netWorth)}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  {current.changeAmount >= 0 ? (
                    <ArrowUpRight className="w-3.5 h-3.5 text-[var(--money)]" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5 text-[var(--debt)]" />
                  )}
                  <span
                    className={`font-mono text-xs font-semibold tabular-nums ${
                      current.changePercent >= 0 ? 'text-[var(--money)]' : 'text-[var(--debt)]'
                    }`}
                  >
                    {showValues ? percentFmt(current.changePercent, locale) : '•••'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t('networth.vsPreviousMonth')}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-muted-foreground font-medium">{t('networth.highest')}</span>
                </div>
                <p className="font-mono text-base font-semibold tabular-nums text-[var(--money)]">
                  {money(highest.netWorth)}
                </p>
                <p className="text-xs text-muted-foreground mt-1 capitalize">
                  {highest.month}
                </p>
              </div>
            </div>
            <div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-muted-foreground font-medium">{t('networth.lowest')}</span>
                </div>
                <p className="font-mono text-base font-semibold tabular-nums text-[var(--debt)]">
                  {money(lowest.netWorth)}
                </p>
                <p className="text-xs text-muted-foreground mt-1 capitalize">
                  {lowest.month}
                </p>
              </div>
            </div>
          </div>
          <div>
            <div className="h-56 min-w-0 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={10}
                    angle={-15}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => (showValues ? formatNetworthAxis(v, locale) : '•••')}
                    domain={['dataMin - 5000', 'dataMax + 5000']}
                  />
                  <RechartsTooltip content={<NetworthEvolutionTooltip showValues={showValues} />} />
                  {hasAnyNegative && (
                    <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeWidth={1} />
                  )}
                  <Area
                    type="monotone"
                    dataKey="netWorth"
                    name={t('networth.series.netWorth')}
                    stroke="var(--ds-chart-2)"
                    strokeWidth={2.5}
                    fill="var(--ds-chart-2)" fillOpacity={0.12} isAnimationActive={false}
                    dot={(props: Record<string, unknown>) => {
                      const { cx, cy, index } = props as { cx: number; cy: number; index: number; payload?: { netWorth: number } };
                      const isActive = index === chartData.length - 1;
                      return (
                        <circle
                          key={`dot-${index}`}
                          cx={cx}
                          cy={cy}
                          r={isActive ? 5 : 3}
                          fill="var(--ds-chart-2)"
                          stroke="var(--background)"
                          strokeWidth={isActive ? 2.5 : 2}
                        />
                      );
                    }}
                    activeDot={{
                      r: 5,
                      fill: 'var(--ds-chart-2)',
                      stroke: 'var(--background)',
                      strokeWidth: 2,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <div className="border-t border-border pt-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {t('networth.milestone.title', { target: money(milestoneTarget) })}
                    </p>
                    <span className="font-mono text-xs font-semibold tabular-nums text-primary">
                      {showValues ? percentFmt(milestoneProgress, locale, { signed: false }) : '•••'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('networth.milestone.remaining', {
                      amount: money(Math.max(0, milestoneTarget - Math.max(0, current.netWorth))),
                    })}
                  </p>
                </div>
              </div>
              <div
                role="progressbar"
                aria-label={t('networth.milestone.progressAria', { target: money(milestoneTarget) })}
                aria-valuenow={Math.round(milestoneProgress)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuetext={showValues ? percentFmt(milestoneProgress, locale, { signed: false }) : '•••'}
                className="h-3 rounded-full bg-muted overflow-hidden"
              >
                <div className="h-full rounded-full bg-primary" style={{ width: `${showValues ? milestoneProgress : 0}%` }} />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="font-mono text-xs tabular-nums text-muted-foreground">{money(0)}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">{money(milestoneTarget)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
