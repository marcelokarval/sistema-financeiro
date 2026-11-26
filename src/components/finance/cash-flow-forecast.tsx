'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from 'recharts';
import { useSafeLocale, useSafeTranslations } from '@/i18n/provider';
import { currencyFmt, shortCurrency } from '@/lib/helpers';
import { QueryPanel, type QueryPanelStatus } from '@/components/shared/query-panel';
import {
  FinanceChartTooltip,
  type FinanceChartTooltipRow,
} from '@/components/shared/finance-chart-tooltip';

// ─── Types ─────────────────────────────────────────────────────────
interface ForecastMonth {
  month: string;
  projectedIncome: number;
  projectedExpense: number;
  projectedNet: number;
  confidence: number;
}

interface TopCategory {
  name: string;
  color: string;
  averageMonthly: number;
}

interface ForecastData {
  forecastMonths: ForecastMonth[];
  topExpenseCategories: TopCategory[];
  riskAlerts: string[];
  trendDirection: 'improving' | 'stable' | 'declining';
}

// ─── Confidence Badge ──────────────────────────────────────────────
function ConfidenceBadge({ confidence }: { confidence: number }) {
  const t = useSafeTranslations('analytics');
  if (confidence >= 80) {
    return (
      <Badge className="bg-[var(--ds-accent-positive)]/10 text-[var(--ds-accent-positive)] border-[var(--ds-accent-positive)]/20 font-mono text-xs tabular-nums px-2 py-0.5 hover:bg-[var(--ds-accent-positive)]/15">
        {t('forecast.confidence', { value: confidence })}
      </Badge>
    );
  }
  if (confidence >= 50) {
    return (
      <Badge className="bg-[var(--ds-accent-warning)]/10 text-[var(--ds-accent-warning)] border-[var(--ds-accent-warning)]/20 font-mono text-xs tabular-nums px-2 py-0.5 hover:bg-[var(--ds-accent-warning)]/15">
        {t('forecast.confidence', { value: confidence })}
      </Badge>
    );
  }
  return (
    <Badge className="bg-[var(--ds-accent-danger)]/10 text-[var(--ds-accent-danger)] border-[var(--ds-accent-danger)]/20 font-mono text-xs tabular-nums px-2 py-0.5 hover:bg-[var(--ds-accent-danger)]/15">
      {t('forecast.confidence', { value: confidence })}
    </Badge>
  );
}

// ─── Trend Indicator ───────────────────────────────────────────────
function TrendIndicator({ direction }: { direction: string }) {
  const t = useSafeTranslations('analytics');
  if (direction === 'improving') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--ds-accent-positive)]/10 border border-[var(--ds-accent-positive)]/20">
        <TrendingUp className="w-3.5 h-3.5 text-[var(--ds-accent-positive)]" />
        <span className="text-xs font-medium text-[var(--ds-accent-positive)]">{t('forecast.trend.positive')}</span>
      </div>
    );
  }
  if (direction === 'declining') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--ds-accent-danger)]/10 border border-[var(--ds-accent-danger)]/20">
        <TrendingDown className="w-3.5 h-3.5 text-[var(--ds-accent-danger)]" />
        <span className="text-xs font-medium text-[var(--ds-accent-danger)]">{t('forecast.trend.negative')}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--ds-accent-warning)]/10 border border-[var(--ds-accent-warning)]/20">
      <Minus className="w-3.5 h-3.5 text-[var(--ds-accent-warning)]" />
      <span className="text-xs font-medium text-[var(--ds-accent-warning)]">{t('forecast.trend.stable')}</span>
    </div>
  );
}

type ForecastSeriesKey = 'income' | 'expense' | 'net';

const SERIES_KEY_TO_I18N: Record<string, ForecastSeriesKey> = {
  Receita: 'income',
  income: 'income',
  Despesa: 'expense',
  expense: 'expense',
  Saldo: 'net',
  net: 'net',
};

// ─── Custom Tooltip ────────────────────────────────────────────────
export function CashFlowForecastTooltip({
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

  const rows: FinanceChartTooltipRow[] = payload.flatMap((entry, index) => {
    if (typeof entry?.value !== 'number' || !Number.isFinite(entry.value) || !entry.name) {
      return [];
    }
    const rawKey = String(entry.dataKey ?? entry.name);
    const seriesKey = SERIES_KEY_TO_I18N[rawKey];
    const rowLabel = seriesKey ? t(`forecast.series.${seriesKey}`) : entry.name;
    return [{
      key: String(entry.dataKey ?? entry.name ?? index),
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

// ─── Main Component ────────────────────────────────────────────────
export function CashFlowForecast() {
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchForecast = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/forecast?months=3');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        setData(null);
      }
    } catch (e) {
      console.error('Erro ao buscar previsão:', e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  return <CashFlowForecastContent data={data} loading={loading} onRetry={fetchForecast} />;
}

export function CashFlowForecastContent({
  data,
  loading,
  error,
  onRetry,
  showValues = true,
}: {
  data: ForecastData | null;
  loading: boolean;
  error?: boolean;
  onRetry: () => void;
  showValues?: boolean;
}) {
  const t = useSafeTranslations('analytics');
  const locale = useSafeLocale();
  const status: QueryPanelStatus = loading
    ? 'loading'
    : error || (error === undefined && !data)
      ? 'error'
      : !data
        ? 'empty'
        : 'success';

  const controls = (
    <>
      {data && <TrendIndicator direction={data.trendDirection} />}
      <Button
        variant="outline"
        size="icon"
        className="size-9"
        aria-label={t('forecast.refreshAria')}
        onClick={onRetry}
      >
        <RefreshCw className="w-4 h-4" />
      </Button>
    </>
  );

  if (status !== 'success' || !data) {
    return (
      <QueryPanel
        titleId="quiet-forecast"
        title={t('forecast.title')}
        controls={controls}
        status={status}
        loadingMessage={t('forecast.loading')}
        errorMessage={t('forecast.error')}
        emptyMessage={t('forecast.empty')}
        retryLabel={t('common.retry')}
        onRetry={onRetry}
      />
    );
  }

  const chartData = data.forecastMonths.map((m) => ({
    month: m.month,
    Receita: Math.round(m.projectedIncome),
    Despesa: Math.round(m.projectedExpense),
    Saldo: Math.round(m.projectedNet),
  }));

  return (
    <QueryPanel
      titleId="quiet-forecast"
      title={t('forecast.title')}
      subtitle={t('forecast.subtitle')}
      controls={controls}
      status="success"
      loadingMessage={t('forecast.loading')}
      errorMessage={t('forecast.error')}
      emptyMessage={t('forecast.empty')}
      retryLabel={t('common.retry')}
      onRetry={onRetry}
    >
      {data.forecastMonths.length > 0 ? (
        <>
          <div className="grid gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-3">
            {data.forecastMonths.map((m) => (
              <article key={m.month} className="min-w-0 bg-card p-3">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-1">
                  <h4 className="text-sm font-semibold capitalize">{m.month}</h4>
                  <ConfidenceBadge confidence={m.confidence} />
                </div>
                <dl className="space-y-1.5 text-xs">
                  <div className="flex flex-wrap justify-between gap-x-2"><dt className="text-muted-foreground">{t('forecast.card.projectedIncome')}</dt><dd className="font-mono tabular-nums">{currencyFmt(m.projectedIncome, locale)}</dd></div>
                  <div className="flex flex-wrap justify-between gap-x-2"><dt className="text-muted-foreground">{t('forecast.card.projectedExpense')}</dt><dd className="font-mono tabular-nums">{currencyFmt(m.projectedExpense, locale)}</dd></div>
                  <div className="flex flex-wrap justify-between gap-x-2 border-t border-border pt-1.5"><dt className="font-medium">{t('forecast.card.projectedNet')}</dt><dd className="font-mono font-semibold tabular-nums">{m.projectedNet >= 0 ? '+' : ''}{currencyFmt(m.projectedNet, locale)}</dd></div>
                </dl>
              </article>
            ))}
          </div>
          <figure className="min-w-0 border-t border-border pt-3">
            <figcaption className="text-xs font-medium">{t('forecast.chartCaption')}</figcaption>
            <div className="h-56 min-w-0 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => shortCurrency(v, locale)}
                  />
                  <RechartsTooltip content={<CashFlowForecastTooltip showValues={showValues} />} />
                  <Legend iconType="line" iconSize={12} wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Area
                    type="monotone"
                    dataKey="Receita"
                    name={t('forecast.series.income')}
                    stroke="var(--ds-accent-positive)"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    fill="none"
                    isAnimationActive={false}
                    dot={{ r: 4, fill: 'var(--ds-accent-positive)', strokeWidth: 2, stroke: 'var(--background)' }}
                    activeDot={{ r: 6, fill: 'var(--ds-accent-positive)', strokeWidth: 2, stroke: 'var(--background)' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Despesa"
                    name={t('forecast.series.expense')}
                    stroke="var(--ds-accent-warning)"
                    strokeWidth={2}
                    strokeDasharray="2 3"
                    fill="none"
                    isAnimationActive={false}
                    dot={{ r: 4, fill: 'var(--ds-accent-warning)', strokeWidth: 2, stroke: 'var(--background)' }}
                    activeDot={{ r: 6, fill: 'var(--ds-accent-warning)', strokeWidth: 2, stroke: 'var(--background)' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Saldo"
                    name={t('forecast.series.net')}
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    fill="none"
                    isAnimationActive={false}
                    dot={{ r: 4, fill: 'var(--primary)', strokeWidth: 2, stroke: 'var(--background)' }}
                    activeDot={{ r: 6, fill: 'var(--primary)', strokeWidth: 2, stroke: 'var(--background)' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </figure>
        </>
      ) : <p role="status" className="text-sm text-muted-foreground">{t('forecast.emptyMonths')}</p>}
      {data.topExpenseCategories.length > 0 && (
        <div className="border-t border-border pt-3">
          <p className="text-xs font-semibold mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--ds-accent-warning)]" />
            {t('forecast.topCategoriesTitle')}
          </p>
          <div className="space-y-2.5">
            {data.topExpenseCategories.map((cat) => (
              <div key={cat.name} className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: cat.color }} />
                <span className="min-w-0 flex-1 break-words text-xs text-muted-foreground">{cat.name}</span>
                <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:block">
                  <div
                    style={{
                      width: `${Math.min(
                        100,
                        (cat.averageMonthly / (data.topExpenseCategories[0]?.averageMonthly || 1)) * 100,
                      )}%`,
                      backgroundColor: cat.color,
                    }}
                    className="h-full rounded-full"
                  />
                </div>
                <span className="shrink-0 text-right font-mono text-xs font-semibold tabular-nums">
                  {currencyFmt(cat.averageMonthly, locale)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.riskAlerts.length > 0 && (
        <div className="rounded-lg border border-[var(--ds-accent-warning)]/30 bg-[var(--ds-accent-warning)]/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-[var(--ds-accent-warning)]/10 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-[var(--ds-accent-warning)]" />
            </div>
            <p className="text-xs font-semibold text-[var(--ds-accent-warning)]">
              {t('forecast.riskAlertsTitle')}
            </p>
            <Badge variant="secondary" className="font-mono text-xs tabular-nums px-1.5 py-0 bg-[var(--ds-accent-warning)]/10 text-[var(--ds-accent-warning)] border-[var(--ds-accent-warning)]/20">
              {data.riskAlerts.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {data.riskAlerts.map((alert, idx) => (
              <div key={idx} className="flex items-start gap-2.5 py-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--ds-accent-warning)] mt-1.5 shrink-0" />
                <p className="text-xs text-[var(--ds-accent-warning)] leading-relaxed">{alert}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.riskAlerts.length === 0 && (
        <div className="rounded-lg border border-[var(--ds-accent-positive)]/30 bg-[var(--ds-accent-positive)]/5 p-4 flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-[var(--ds-accent-positive)] shrink-0" />
          <p className="text-xs text-[var(--ds-accent-positive)]">
            {t('forecast.noRiskAlerts')}
          </p>
        </div>
      )}
    </QueryPanel>
  );
}
