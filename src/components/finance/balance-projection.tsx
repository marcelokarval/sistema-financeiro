'use client';

import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Shield,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import { currencyFmt } from '@/lib/helpers';
import { QueryPanel, type QueryPanelStatus } from '@/components/shared/query-panel';
import {
  FinanceChartTooltip,
  type FinanceChartTooltipRow,
} from '@/components/shared/finance-chart-tooltip';

// ─── Helpers ───────────────────────────────────────────────────────

const shortCurrency = (v: number) => {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v.toFixed(0);
};

// ─── Types ─────────────────────────────────────────────────────────
interface AccountProjection {
  accountId: string;
  accountName: string;
  accountColor: string;
  accountType: string;
  currentBalance: number;
  projectedBalances: number[];
  avgMonthlyIncome: number;
  avgMonthlyExpense: number;
  monthlyNet: number;
  trend: 'up' | 'down' | 'stable';
}

interface ProjectionData {
  accounts: AccountProjection[];
  monthLabels: string[];
  totalCurrentBalance: number;
  totalProjected: number;
  averageMonthlySavings: number;
  savingsRate: number;
  riskLevel: 'low' | 'medium' | 'high';
  months: number;
}

// ─── Risk Badge ────────────────────────────────────────────────────
function RiskBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  if (level === 'low') {
    return (
      <Badge className="bg-[var(--ds-accent-positive)]/10 text-[var(--ds-accent-positive)] border-[var(--ds-accent-positive)]/20 text-xs px-3 py-1 hover:bg-[var(--ds-accent-positive)]/15">
        <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
        Baixo
      </Badge>
    );
  }
  if (level === 'high') {
    return (
      <Badge className="bg-[var(--ds-accent-danger)]/10 text-[var(--ds-accent-danger)] border-[var(--ds-accent-danger)]/20 text-xs px-3 py-1 hover:bg-[var(--ds-accent-danger)]/15">
        <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
        Alto
      </Badge>
    );
  }
  return (
    <Badge className="bg-[var(--ds-accent-warning)]/10 text-[var(--ds-accent-warning)] border-[var(--ds-accent-warning)]/20 text-xs px-3 py-1 hover:bg-[var(--ds-accent-warning)]/15">
      <Shield className="w-3.5 h-3.5 mr-1.5" />
      Médio
    </Badge>
  );
}

// ─── Trend Icon ────────────────────────────────────────────────────
// ─── Custom Tooltip ────────────────────────────────────────────────
export function BalanceProjectionTooltip({
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
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;

  const rows: FinanceChartTooltipRow[] = payload.flatMap((entry) => {
    const key = entry?.dataKey != null ? String(entry.dataKey) : entry?.name;
    const rowLabel = entry?.name ?? (entry?.dataKey != null ? String(entry.dataKey) : undefined);
    if (typeof entry?.value !== 'number' || !Number.isFinite(entry.value) || !key || !rowLabel) {
      return [];
    }
    return [{
      key,
      label: rowLabel,
      value: currencyFmt(entry.value),
      color: entry.color,
    }];
  });

  if (rows.length === 0) return null;

  return (
    <FinanceChartTooltip
      active={active}
      title={label}
      rows={rows}
      showValues={showValues}
    />
  );
}

// ─── Month Selector ────────────────────────────────────────────────
function MonthSelector({
  selected,
  onChange,
}: {
  selected: number;
  onChange: (m: number) => void;
}) {
  const options = [3, 6, 9, 12];
  return (
    <div role="group" aria-label="Horizonte da projeção" className="flex flex-wrap items-center gap-1 rounded-md bg-muted/40 p-0.5">
      {options.map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={selected === m}
          onClick={() => onChange(m)}
          className={`min-h-9 rounded-md px-2 text-xs font-medium ${
            selected === m
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
          }`}
        >
          {m} meses
        </button>
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────
export type BalanceProjectionRequest = { months: number };
export type BalanceProjectionStatus =
  | { status: 'ready'; data: ProjectionData }
  | { status: 'error' };
export type BalanceProjectionResult = {
  request: BalanceProjectionRequest;
  result: BalanceProjectionStatus;
};

export async function requestBalanceProjection(
  request: BalanceProjectionRequest,
  signal: AbortSignal,
  publish: (response: BalanceProjectionResult) => void,
  fetcher: (url: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<void> {
  let result: BalanceProjectionStatus;
  try {
    const response = await fetcher(`/api/balance-projection?months=${request.months}`, { signal });
    result = response.ok ? { status: 'ready', data: await response.json() } : { status: 'error' };
  } catch {
    result = { status: 'error' };
  }
  if (!signal.aborted) publish({ request, result });
}

export function currentBalanceProjection(
  request: BalanceProjectionRequest,
  settled: BalanceProjectionResult | null,
): BalanceProjectionStatus | { status: 'loading' } {
  // A new object identifies a new request even on retry or a return to the same period.
  return settled?.request === request ? settled.result : { status: 'loading' };
}

export function BalanceProjection() {
  const [request, setRequest] = useState<BalanceProjectionRequest>({ months: 6 });
  const [settled, setSettled] = useState<BalanceProjectionResult | null>(null);
  const query = currentBalanceProjection(request, settled);
  const data = query.status === 'ready' ? query.data : null;
  const loading = query.status === 'loading';
  const error = query.status === 'error';

  useEffect(() => {
    const controller = new AbortController();
    void requestBalanceProjection(request, controller.signal, setSettled);
    return () => controller.abort();
  }, [request]);

  return (
    <BalanceProjectionContent
      data={data}
      loading={loading}
      error={error}
      selectedMonths={request.months}
      onSelectMonths={(months) => {
        if (months !== request.months) setRequest({ months });
      }}
      onRetry={() => setRequest({ months: request.months })}
    />
  );
}

export function BalanceProjectionContent({
  data,
  loading,
  error,
  selectedMonths,
  onSelectMonths,
  onRetry,
  showValues = true,
}: {
  data: ProjectionData | null;
  loading: boolean;
  error?: boolean;
  selectedMonths: number;
  onSelectMonths: (months: number) => void;
  onRetry: () => void;
  showValues?: boolean;
}) {
  const status: QueryPanelStatus = loading
    ? 'loading'
    : error || (error === undefined && !data)
      ? 'error'
      : !data
        ? 'empty'
        : 'success';

  const controls = (
    <>
      <MonthSelector selected={selectedMonths} onChange={onSelectMonths} />
      <Button
        variant="outline"
        size="icon"
        className="size-9"
        aria-label="Atualizar projeção de saldos"
        onClick={onRetry}
      >
        <RefreshCw className="w-4 h-4" />
      </Button>
    </>
  );

  if (status !== 'success' || !data) {
    return (
      <QueryPanel
        titleId="quiet-balance-projection"
        title="Projeção de saldos"
        controls={controls}
        status={status}
        loadingMessage="Carregando projeção de saldos…"
        errorMessage="Não foi possível carregar a projeção de saldos."
        emptyMessage="Nenhuma projeção de saldos disponível."
        onRetry={onRetry}
      />
    );
  }

  // ─── Chart data (per account) ────────────────────────────────────
  const chartData = data.monthLabels.map((label, idx) => {
    const row: Record<string, string | number> = { month: label };
    data.accounts.forEach((acc) => {
      row[acc.accountName] = acc.projectedBalances[idx] || 0;
    });
    return row;
  });

  // ─── Risk assessment ─────────────────────────────────────────────
  const riskConfig = {
    low: {
      bgClass: 'bg-muted/20 border-border',
      textClass: 'text-[var(--ds-accent-positive)]',
      iconBg: 'bg-[var(--ds-accent-positive)]/10',
      message: 'Suas finanças estão saudáveis! Você mantém uma boa taxa de poupança acima de 20%.',
    },
    medium: {
      bgClass: 'bg-muted/20 border-border',
      textClass: 'text-[var(--ds-accent-warning)]',
      iconBg: 'bg-[var(--ds-accent-warning)]/10',
      message: 'Atenção: sua taxa de poupança está entre 0% e 20%. Considere reduzir gastos para aumentar suas economias.',
    },
    high: {
      bgClass: 'bg-muted/20 border-border',
      textClass: 'text-[var(--ds-accent-danger)]',
      iconBg: 'bg-[var(--ds-accent-danger)]/10',
      message: 'Alerta vermelho! Suas despesas superam suas receitas. Revise urgentemente seus gastos para evitar endividamento.',
    },
  };

  const currentRisk = riskConfig[data.riskLevel];
  const projectionChange = data.totalProjected - data.totalCurrentBalance;
  const projectionChangePct =
    data.totalCurrentBalance !== 0
      ? ((projectionChange / Math.abs(data.totalCurrentBalance)) * 100).toFixed(1)
      : '0.0';

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <QueryPanel
      titleId="quiet-balance-projection"
      title="Projeção de saldos"
      subtitle={`Estimativas por conta · ${data.months} meses`}
      controls={controls}
      status="success"
      loadingMessage="Carregando projeção de saldos…"
      errorMessage="Não foi possível carregar a projeção de saldos."
      emptyMessage="Nenhuma projeção de saldos disponível."
      onRetry={onRetry}
    >
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border lg:grid-cols-4">
        <div className="min-w-0 space-y-1 bg-card p-3">
          <dt className="text-xs text-muted-foreground">Saldo total atual</dt>
          <dd className="break-words font-mono text-sm font-semibold tabular-nums">{currencyFmt(data.totalCurrentBalance)}</dd>
        </div>
        <div className="min-w-0 space-y-1 bg-card p-3">
          <dt className="text-xs text-muted-foreground">Projeção em {data.months} meses</dt>
          <dd className="break-words font-mono text-sm font-semibold tabular-nums">{currencyFmt(data.totalProjected)}</dd>
          <dd className="text-xs text-muted-foreground">Variação: {projectionChange >= 0 ? '+' : ''}{projectionChangePct}%</dd>
        </div>
        <div className="min-w-0 space-y-1 bg-card p-3">
          <dt className="text-xs text-muted-foreground">Economia mensal média</dt>
          <dd className="break-words font-mono text-sm font-semibold tabular-nums">{data.averageMonthlySavings >= 0 ? '+' : ''}{currencyFmt(data.averageMonthlySavings)}</dd>
          <dd className="text-xs text-muted-foreground">Taxa: {data.savingsRate}%</dd>
        </div>
        <div className="min-w-0 space-y-1 bg-card p-3">
          <dt className="text-xs text-muted-foreground">Nível de risco</dt>
          <dd><RiskBadge level={data.riskLevel} /></dd>
        </div>
      </dl>

      {data.accounts.length > 0 ? (
        <figure className="min-w-0 border-t border-border pt-3">
          <figcaption className="text-xs font-medium">Saldos projetados por conta</figcaption>
          <div className="h-56 min-w-0 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={12}
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
                <RechartsTooltip content={<BalanceProjectionTooltip showValues={showValues} />} />
                <Legend
                  iconType="line"
                  iconSize={12}
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                />
                {/* Reference line at current month (index 0) */}
                <ReferenceLine
                  x={data.monthLabels[0]}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
                {data.accounts.map((acc) => (
                  <Area
                    key={acc.accountId}
                    type="monotone"
                    dataKey={acc.accountName}
                    stroke={acc.accountColor}
                    strokeWidth={2}
                    strokeDasharray="0"
                    fill="none"
                    isAnimationActive={false}
                    dot={{ r: 3, fill: acc.accountColor, strokeWidth: 2, stroke: 'var(--background)' }}
                    activeDot={{ r: 5, fill: acc.accountColor, strokeWidth: 2, stroke: 'var(--background)' }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </figure>
      ) : <p role="status" className="text-sm text-muted-foreground">Nenhuma conta para projetar.</p>}
      <div className={`rounded-lg border p-4 ${currentRisk.bgClass}`}>
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-lg ${currentRisk.iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
            {data.riskLevel === 'high' ? (
              <AlertTriangle className="w-5 h-5 text-[var(--ds-accent-danger)]" />
            ) : data.riskLevel === 'medium' ? (
              <Shield className="w-5 h-5 text-[var(--ds-accent-warning)]" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-[var(--ds-accent-positive)]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <p className={`text-sm font-semibold ${currentRisk.textClass}`}>
                {data.riskLevel === 'high'
                  ? 'Risco Alto — Ação Necessária'
                  : data.riskLevel === 'medium'
                    ? 'Risco Médio — Atenção Recomendada'
                    : 'Risco Baixo — Finanças Saudáveis'}
              </p>
              <RiskBadge level={data.riskLevel} />
            </div>
            <p className={`text-xs ${currentRisk.textClass} leading-relaxed`}>
              {currentRisk.message}
            </p>
            {/* Savings rate visual bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground font-medium">
                  Taxa de poupança
                </span>
                <span className={`font-mono text-xs font-semibold tabular-nums ${currentRisk.textClass}`}>
                  {data.savingsRate}%
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Taxa de poupança"
                aria-valuenow={Math.round(Math.max(0, Math.min(100, Math.abs(data.savingsRate))))}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuetext={`${data.savingsRate}%`}
                className="h-1.5 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(0, Math.min(100, Math.abs(data.savingsRate)))}%`,
                    backgroundColor:
                      data.riskLevel === 'low'
                        ? 'var(--ds-accent-positive)'
                        : data.riskLevel === 'medium'
                          ? 'var(--ds-accent-warning)'
                          : 'var(--ds-accent-danger)',
                  }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="font-mono text-xs tabular-nums text-muted-foreground">0%</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">100%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {data.accounts.length > 0 && (
        <div className="border-t border-border">
          <h4 className="px-2 py-3 text-xs font-semibold">Detalhes por conta · {data.accounts.length}</h4>
          <ul className="max-h-96 divide-y divide-border overflow-y-auto">
            {data.accounts.map((acc) => {
              const finalBalance = acc.projectedBalances[acc.projectedBalances.length - 1];
              return (
                <li key={acc.accountId} className="min-w-0 space-y-2 px-2 py-3">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: acc.accountColor }} />
                    <span className="min-w-0 break-words text-sm font-medium">{acc.accountName}</span>
                    <span className="text-xs text-muted-foreground">{acc.trend === 'up' ? 'Em alta' : acc.trend === 'down' ? 'Em queda' : 'Estável'}</span>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-xs md:grid-cols-5">
                    <div className="min-w-0"><dt className="text-muted-foreground">Saldo atual</dt><dd className="break-words font-mono tabular-nums">{currencyFmt(acc.currentBalance)}</dd></div>
                    <div className="min-w-0"><dt className="text-muted-foreground">Saldo projetado</dt><dd className="break-words font-mono tabular-nums">{currencyFmt(finalBalance)}</dd></div>
                    <div className="min-w-0"><dt className="text-muted-foreground">Receita/mês</dt><dd className="break-words font-mono tabular-nums">{currencyFmt(acc.avgMonthlyIncome)}</dd></div>
                    <div className="min-w-0"><dt className="text-muted-foreground">Despesa/mês</dt><dd className="break-words font-mono tabular-nums">{currencyFmt(acc.avgMonthlyExpense)}</dd></div>
                    <div className="min-w-0"><dt className="text-muted-foreground">Líquido/mês</dt><dd className="break-words font-mono tabular-nums">{acc.monthlyNet >= 0 ? '+' : ''}{currencyFmt(acc.monthlyNet)}</dd></div>
                  </dl>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </QueryPanel>
  );
}
