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
import { currencyFmt } from '@/lib/helpers';

// ─── Helpers ───────────────────────────────────────────────────────

const shortCurrency = (v: number) => {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v.toFixed(0);
};

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
  if (confidence >= 80) {
    return (
      <Badge className="bg-[var(--ds-accent-positive)]/10 text-[var(--ds-accent-positive)] border-[var(--ds-accent-positive)]/20 font-mono text-xs tabular-nums px-2 py-0.5 hover:bg-[var(--ds-accent-positive)]/15">
        {confidence}% confiança
      </Badge>
    );
  }
  if (confidence >= 50) {
    return (
      <Badge className="bg-[var(--ds-accent-warning)]/10 text-[var(--ds-accent-warning)] border-[var(--ds-accent-warning)]/20 font-mono text-xs tabular-nums px-2 py-0.5 hover:bg-[var(--ds-accent-warning)]/15">
        {confidence}% confiança
      </Badge>
    );
  }
  return (
    <Badge className="bg-[var(--ds-accent-danger)]/10 text-[var(--ds-accent-danger)] border-[var(--ds-accent-danger)]/20 font-mono text-xs tabular-nums px-2 py-0.5 hover:bg-[var(--ds-accent-danger)]/15">
      {confidence}% confiança
    </Badge>
  );
}

// ─── Trend Indicator ───────────────────────────────────────────────
function TrendIndicator({ direction }: { direction: string }) {
  if (direction === 'improving') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--ds-accent-positive)]/10 border border-[var(--ds-accent-positive)]/20">
        <TrendingUp className="w-3.5 h-3.5 text-[var(--ds-accent-positive)]" />
        <span className="text-xs font-medium text-[var(--ds-accent-positive)]">Tendência positiva</span>
      </div>
    );
  }
  if (direction === 'declining') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--ds-accent-danger)]/10 border border-[var(--ds-accent-danger)]/20">
        <TrendingDown className="w-3.5 h-3.5 text-[var(--ds-accent-danger)]" />
        <span className="text-xs font-medium text-[var(--ds-accent-danger)]">Tendência negativa</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--ds-accent-warning)]/10 border border-[var(--ds-accent-warning)]/20">
      <Minus className="w-3.5 h-3.5 text-[var(--ds-accent-warning)]" />
      <span className="text-xs font-medium text-[var(--ds-accent-warning)]">Tendência estável</span>
    </div>
  );
}

// ─── Custom Tooltip ────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-lg p-3">
      <p className="text-xs font-medium mb-2 capitalize">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-mono font-semibold tabular-nums">{currencyFmt(entry.value)}</span>
        </div>
      ))}
    </div>
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
  onRetry,
}: {
  data: ForecastData | null;
  loading: boolean;
  onRetry: () => void;
}) {
  // ─── Loading Skeleton ─────────────────────────────────────────────
  if (loading) {
    return (
      <section aria-labelledby="quiet-forecast" className="min-w-0 rounded-lg border border-border bg-card text-card-foreground">
        <header className="px-3 py-3 sm:px-4"><h3 id="quiet-forecast" className="text-sm font-semibold">Previsão de fluxo de caixa</h3></header>
        <p role="status" className="border-t border-border px-3 py-3 text-sm text-muted-foreground sm:px-4">Carregando previsão…</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section aria-labelledby="quiet-forecast" className="min-w-0 rounded-lg border border-border bg-card text-card-foreground">
        <header className="px-3 py-3 sm:px-4"><h3 id="quiet-forecast" className="text-sm font-semibold">Previsão de fluxo de caixa</h3></header>
        <div className="flex flex-wrap items-center gap-3 border-t border-border p-4">
          <p role="alert" className="text-sm text-muted-foreground">
            Não foi possível carregar a previsão de fluxo de caixa.
          </p>
          <Button variant="outline" size="sm" className="min-h-9" onClick={onRetry}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Tentar novamente
          </Button>
        </div>
      </section>
    );
  }

  // ─── Chart data ───────────────────────────────────────────────────
  const chartData = data.forecastMonths.map((m) => ({
    month: m.month,
    Receita: Math.round(m.projectedIncome),
    Despesa: Math.round(m.projectedExpense),
    Saldo: Math.round(m.projectedNet),
  }));

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <section aria-labelledby="quiet-forecast" className="min-w-0 rounded-lg border border-border bg-card text-card-foreground">

      <header className="border-b border-border px-3 py-3 sm:px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="min-w-0">
            <h3 id="quiet-forecast" className="text-sm font-semibold">Previsão de fluxo de caixa</h3>
            <p className="text-xs text-muted-foreground">Estimativas para os próximos 3 meses, com base no histórico</p>
          </div>
          <div className="flex items-center gap-2">
            <TrendIndicator direction={data.trendDirection} />
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              aria-label="Atualizar previsão"
              onClick={onRetry}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="space-y-4 px-3 py-3 sm:px-4">
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
                    <div className="flex flex-wrap justify-between gap-x-2"><dt className="text-muted-foreground">Receita projetada</dt><dd className="font-mono tabular-nums">{currencyFmt(m.projectedIncome)}</dd></div>
                    <div className="flex flex-wrap justify-between gap-x-2"><dt className="text-muted-foreground">Despesa projetada</dt><dd className="font-mono tabular-nums">{currencyFmt(m.projectedExpense)}</dd></div>
                    <div className="flex flex-wrap justify-between gap-x-2 border-t border-border pt-1.5"><dt className="font-medium">Saldo projetado</dt><dd className="font-mono font-semibold tabular-nums">{m.projectedNet >= 0 ? '+' : ''}{currencyFmt(m.projectedNet)}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
            <figure className="min-w-0 border-t border-border pt-3">
              <figcaption className="text-xs font-medium">Receita, despesa e saldo projetados por mês</figcaption>
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
                  tickFormatter={shortCurrency}
                />
                <RechartsTooltip content={<ChartTooltip />} />
                <Legend
                  iconType="line"
                  iconSize={12}
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                />
                {/* Income — green dashed */}
                <Area
                  type="monotone"
                  dataKey="Receita"
                  stroke="var(--ds-accent-positive)"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  fill="none"
                  isAnimationActive={false}
                  dot={{ r: 4, fill: 'var(--ds-accent-positive)', strokeWidth: 2, stroke: 'var(--background)' }}
                  activeDot={{ r: 6, fill: 'var(--ds-accent-positive)', strokeWidth: 2, stroke: 'var(--background)' }}
                />
                {/* Expense — orange dashed */}
                <Area
                  type="monotone"
                  dataKey="Despesa"
                  stroke="var(--ds-accent-warning)"
                  strokeWidth={2}
                  strokeDasharray="2 3"
                  fill="none"
                  isAnimationActive={false}
                  dot={{ r: 4, fill: 'var(--ds-accent-warning)', strokeWidth: 2, stroke: 'var(--background)' }}
                  activeDot={{ r: 6, fill: 'var(--ds-accent-warning)', strokeWidth: 2, stroke: 'var(--background)' }}
                />
                {/* Net — cyan solid */}
                <Area
                  type="monotone"
                  dataKey="Saldo"
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
        ) : <p role="status" className="text-sm text-muted-foreground">Nenhum mês disponível para a previsão.</p>}
        {data.topExpenseCategories.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--ds-accent-warning)]" />
              Principais categorias de despesa · média mensal
            </p>
            <div className="space-y-2.5">
              {data.topExpenseCategories.map((cat) => (
                <div
                  key={cat.name}
                  className="flex items-center gap-3"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="min-w-0 flex-1 break-words text-xs text-muted-foreground">
                    {cat.name}
                  </span>
                  <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:block">
                    <div
                      style={{
                        width: `${Math.min(
                          100,
                          (cat.averageMonthly /
                            (data.topExpenseCategories[0]?.averageMonthly || 1)) *
                            100
                        )}%`,
                        backgroundColor: cat.color,
                      }}
                      className="h-full rounded-full"
                    />
                  </div>
                  <span className="shrink-0 text-right font-mono text-xs font-semibold tabular-nums">
                    {currencyFmt(cat.averageMonthly)}
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
                Alertas de Risco
              </p>
              <Badge variant="secondary" className="font-mono text-xs tabular-nums px-1.5 py-0 bg-[var(--ds-accent-warning)]/10 text-[var(--ds-accent-warning)] border-[var(--ds-accent-warning)]/20">
                {data.riskAlerts.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {data.riskAlerts.map((alert, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 py-1.5"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--ds-accent-warning)] mt-1.5 shrink-0" />
                  <p className="text-xs text-[var(--ds-accent-warning)] leading-relaxed">
                    {alert}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty alerts — positive message */}
        {data.riskAlerts.length === 0 && (
          <div className="rounded-lg border border-[var(--ds-accent-positive)]/30 bg-[var(--ds-accent-positive)]/5 p-4 flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-[var(--ds-accent-positive)] shrink-0" />
            <p className="text-xs text-[var(--ds-accent-positive)]">
              Nenhum alerta de risco identificado nesta previsão.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
