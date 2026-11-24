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
import { currencyFmt } from '@/lib/helpers';
// ─── Helpers ───────────────────────────────────────────────────────
const shortCurrency = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${v < 0 ? '-' : ''}R$ ${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1000) return `${v < 0 ? '-' : ''}R$ ${(abs / 1000).toFixed(0)}k`;
  return `R$ ${abs.toFixed(0)}`;
};
// ─── Types ─────────────────────────────────────────────────────────
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
// ─── Custom Tooltip ────────────────────────────────────────────────
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-xl p-3">
      <p className="text-xs font-medium mb-2 capitalize">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">
            {entry.dataKey === 'netWorth' ? 'Patrimônio' : entry.name}:
          </span>
          <span className="font-mono font-semibold tabular-nums">{currencyFmt(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}
// ─── Main Component ────────────────────────────────────────────────
export function NetworthEvolution() {
  const [data, setData] = useState<NetworthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonths, setSelectedMonths] = useState(6);
  const fetchData = useCallback(async (months: number) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/networth?months=${months}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error('Erro ao buscar patrimônio:', e);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    fetchData(selectedMonths);
  }, [selectedMonths, fetchData]);
  return (
    <NetworthEvolutionContent
      data={data}
      loading={loading}
      selectedMonths={selectedMonths}
      onSelectMonths={setSelectedMonths}
      fetchData={fetchData}
      onRetry={() => fetchData(selectedMonths)}
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
}: {
  data: NetworthResponse | null;
  loading: boolean;
  selectedMonths: number;
  onSelectMonths: (months: number) => void;
  fetchData: (months: number) => void;
  onRetry?: () => void;
}) {
  const handleRetry = onRetry ?? (() => fetchData(selectedMonths));
  // ─── Loading Skeleton ─────────────────────────────────────────────
  if (loading) {
    return (
      <Card role="status" aria-label="Carregando evolução patrimonial" className="min-w-0 gap-3 rounded-lg border-border bg-card py-4 shadow-none">
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
          <div role="group" aria-label="Indicadores patrimoniais" className="grid grid-cols-1 gap-3 border-y border-border py-3 sm:grid-cols-3">
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
            {data ? "Nenhum mês disponível para este intervalo." : "Não foi possível carregar a evolução patrimonial."}
          </p>
          <Button variant="outline" size="sm" className="min-h-9" onClick={handleRetry}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }
  // ─── Computed values ─────────────────────────────────────────────
  const chartData = data.monthlyData;
  const current = chartData[chartData.length - 1];
  const hasAnyNegative = chartData.some((d) => d.netWorth < 0);
  // Highest and lowest
  let highest = chartData[0];
  let lowest = chartData[0];
  for (const d of chartData) {
    if (d.netWorth > highest.netWorth) highest = d;
    if (d.netWorth < lowest.netWorth) lowest = d;
  }
  // Milestone progress (R$ 100k)
  const milestoneTarget = 100_000;
  const milestoneProgress = Math.min(100, Math.max(0, (Math.max(0, current.netWorth) / milestoneTarget) * 100));
  // Month selector options
  const monthOptions = [3, 6, 9, 12];
  // ─── Render ───────────────────────────────────────────────────────
  return (
    <section aria-labelledby="networth-evolution-heading" className="min-w-0">
      <Card className="min-w-0 gap-3 rounded-lg border-border bg-card py-4 shadow-none">
        <CardHeader className="px-4 sm:px-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="min-w-0">
              <h3 id="networth-evolution-heading" className="text-base font-semibold">Evolução Patrimonial</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Acompanhe seu patrimônio líquido ao longo do tempo
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Month selector */}
              <div role="group" aria-label="Período da evolução patrimonial" className="flex items-center gap-1 rounded-md bg-muted/40 p-1">
                {monthOptions.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={selectedMonths === m}
                    aria-label={`${m} meses`}
                    onClick={() => onSelectMonths(m)}
                    className={`min-h-9 px-3 py-1 rounded-md text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                      selectedMonths === m
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="size-9"
                aria-label="Atualizar patrimônio"
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
            aria-label="Indicadores patrimoniais"
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            {/* Patrimônio no último mês */}
            <div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-muted-foreground font-medium">Patrimônio Atual</span>
                </div>
                <p className="font-mono text-base font-semibold tabular-nums text-foreground">
                  {currencyFmt(current.netWorth)}
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
                    {current.changePercent >= 0 ? '+' : ''}
                    {current.changePercent.toFixed(1)}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    vs mês anterior
                  </span>
                </div>
              </div>
            </div>
            {/* Maior Patrimônio */}
            <div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-muted-foreground font-medium">Maior Patrimônio</span>
                </div>
                <p className="font-mono text-base font-semibold tabular-nums text-[var(--money)]">
                  {currencyFmt(highest.netWorth)}
                </p>
                <p className="text-xs text-muted-foreground mt-1 capitalize">
                  {highest.month}
                </p>
              </div>
            </div>
            {/* Menor Patrimônio */}
            <div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-muted-foreground font-medium">Menor Patrimônio</span>
                </div>
                <p className="font-mono text-base font-semibold tabular-nums text-[var(--debt)]">
                  {currencyFmt(lowest.netWorth)}
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
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    vertical={false}
                  />
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
                    tickFormatter={shortCurrency}
                    domain={['dataMin - 5000', 'dataMax + 5000']}
                  />
                  <RechartsTooltip content={<ChartTooltip />} />
                  {/* Reference line at y=0 if any month is negative */}
                  {hasAnyNegative && (
                    <ReferenceLine
                      y={0}
                      stroke="var(--muted-foreground)"
                      strokeDasharray="4 4"
                      strokeWidth={1}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="netWorth"
                    name="Patrimônio Líquido"
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
                      Meta: {currencyFmt(milestoneTarget)}
                    </p>
                    <span className="font-mono text-xs font-semibold tabular-nums text-primary">
                      {milestoneProgress.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Faltam {currencyFmt(Math.max(0, milestoneTarget - Math.max(0, current.netWorth)))} para alcançar a meta
                  </p>
                </div>
              </div>
              <div
                role="progressbar"
                aria-label={`Progresso para meta de ${currencyFmt(milestoneTarget)}`}
                aria-valuenow={Math.round(milestoneProgress)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuetext={`${milestoneProgress.toFixed(1)}%`}
                className="h-3 rounded-full bg-muted overflow-hidden"
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${milestoneProgress}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="font-mono text-xs tabular-nums text-muted-foreground">{currencyFmt(0)}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">{currencyFmt(milestoneTarget)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
