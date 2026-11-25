'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { currencyFmt } from '@/lib/helpers';
import { QueryPanel, type QueryPanelStatus } from '@/components/shared/query-panel';
import {
  ExpenseBreakdownTooltip,
  ExpenseCategoryList,
  type BreakdownData,
} from './expense-category-details';

export { ExpenseBreakdownTooltip } from './expense-category-details';

type ExpenseBreakdownRequest = { months: '1' | '6' };
type ExpenseBreakdownStatus = { status: 'ready'; data: BreakdownData } | { status: 'error' };
export type ExpenseBreakdownResult = { request: ExpenseBreakdownRequest; result: ExpenseBreakdownStatus };

export async function requestExpenseBreakdown(
  request: ExpenseBreakdownRequest,
  signal: AbortSignal,
  publish: (response: ExpenseBreakdownResult) => void,
  fetcher: (url: string, init?: RequestInit) => Promise<Response> = fetch,
) {
  let result: ExpenseBreakdownStatus;
  try {
    const response = await fetcher(`/api/expense-breakdown?months=${request.months}`, { signal });
    result = response.ok ? { status: 'ready', data: await response.json() } : { status: 'error' };
  } catch {
    result = { status: 'error' };
  }
  if (!signal.aborted) publish({ request, result });
}

export function currentExpenseBreakdown(request: ExpenseBreakdownRequest, settled: ExpenseBreakdownResult | null): ExpenseBreakdownStatus | { status: 'loading' } {
  // A new object identifies a new request even on retry or a return to the same period.
  return settled?.request === request ? settled.result : { status: 'loading' };
}

export function ExpenseBreakdown() {
  const [request, setRequest] = useState<ExpenseBreakdownRequest>({ months: '6' });
  const [settled, setSettled] = useState<ExpenseBreakdownResult | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const showCurrentMonth = request.months === '1';
  const query = currentExpenseBreakdown(request, settled);
  const data = query.status === 'ready' ? query.data : null;
  const refresh = () => setRequest({ months: request.months });

  useEffect(() => {
    const controller = new AbortController();
    void requestExpenseBreakdown(request, controller.signal, setSettled);
    return () => controller.abort();
  }, [request]);

  const selectPeriod = (months: ExpenseBreakdownRequest['months']) => {
    if (months === request.months) return;
    setActiveCategory(null);
    setExpandedCategory(null);
    setRequest({ months });
  };

  const chartData = useMemo(() => {
    if (!data) return [];
    const top = data.categories.slice(0, 8);
    const others = data.categories.slice(8);
    const othersTotal = others.reduce((s, c) => s + c.total, 0);

    const result = top.map((c) => ({
      name: c.categoryName,
      value: c.total,
      color: c.categoryColor,
      categoryId: c.categoryId,
      percentage: c.percentage,
    }));

    if (othersTotal > 0) {
      const othersPercentage = data.totalExpense > 0
        ? (othersTotal / data.totalExpense) * 100
        : 0;
      result.push({
        name: 'Outros',
        value: othersTotal,
        color: 'var(--muted-foreground)',
        categoryId: 'outros',
        percentage: othersPercentage,
      });
    }

    return result;
  }, [data]);

  const top3 = data?.categories.slice(0, 3) || [];

  const activeSlice = activeCategory
    ? chartData.find((d) => d.categoryId === activeCategory)
    : null;

  const panelStatus: QueryPanelStatus =
    query.status === 'loading'
      ? 'loading'
      : query.status === 'error' || !data
        ? 'error'
        : 'success';

  const controls = (
    <>
      <div role="group" aria-label="Período das despesas" className="flex flex-wrap items-center gap-1 rounded-md bg-muted/50 p-0.5">
        <Button
          aria-pressed={showCurrentMonth}
          variant={showCurrentMonth ? 'default' : 'ghost'}
          size="sm"
          className="min-h-9 px-2 text-xs"
          onClick={() => selectPeriod('1')}
        >
          Mês atual
        </Button>
        <Button
          aria-pressed={!showCurrentMonth}
          variant={!showCurrentMonth ? 'default' : 'ghost'}
          size="sm"
          className="min-h-9 px-2 text-xs"
          onClick={() => selectPeriod('6')}
        >
          6 meses
        </Button>
      </div>
      <Button
        variant="outline"
        size="icon"
        className="size-9"
        aria-label="Atualizar despesas por categoria"
        onClick={refresh}
      >
        <RefreshCw className="w-3.5 h-3.5" />
      </Button>
    </>
  );

  return (
    <QueryPanel
      titleId="quiet-expense-breakdown"
      title="Detalhamento de despesas"
      subtitle={`Distribuição por categoria · ${showCurrentMonth ? 'mês atual' : 'últimos 6 meses'}`}
      controls={controls}
      status={panelStatus}
      loadingMessage="Carregando despesas por categoria…"
      errorMessage="Não foi possível carregar as despesas do período selecionado."
      emptyMessage="Nenhuma despesa registrada no período selecionado."
      onRetry={refresh}
    >
      {data && (
        <>
          <div className="min-w-0 space-y-2">
            <p className="text-xs text-muted-foreground">Total de despesas</p>
            <p className="break-words font-mono text-lg font-semibold tabular-nums">{currencyFmt(data.totalExpense)}</p>
          </div>

          {chartData.length > 0 && (
            <figure className="flex min-w-0 flex-col items-center">
              <figcaption className="text-xs font-medium">Participação no total de despesas</figcaption>
              <div className="w-full max-w-[320px] h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                      strokeWidth={0}
                      isAnimationActive={false}
                      onMouseEnter={(_, idx) => {
                        setActiveCategory(chartData[idx].categoryId);
                      }}
                      onMouseLeave={() => {
                        setActiveCategory(null);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {chartData.map((entry, idx) => {
                        const isActive = activeSlice
                          ? entry.categoryId === activeSlice.categoryId
                          : true;
                        return (
                          <Cell
                            key={idx}
                            fill={entry.color}
                            opacity={isActive ? 1 : 0.25}
                            stroke="none"
                          />
                        );
                      })}
                    </Pie>
                    <RechartsTooltip content={<ExpenseBreakdownTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {activeSlice && (
                <p className="break-words text-center text-xs text-muted-foreground">
                  {activeSlice.name} ({activeSlice.percentage.toFixed(1)}%)
                </p>
              )}
            </figure>
          )}

          {data.categories.length === 0 && (
            <p role="status" className="text-sm text-muted-foreground">Nenhuma categoria com despesas para exibir.</p>
          )}

          <ExpenseCategoryList
            categories={data.categories}
            monthlyData={data.monthlyData}
            activeCategory={activeCategory}
            expandedCategory={expandedCategory}
            onSelectActive={setActiveCategory}
            onToggleExpand={(categoryId) => setExpandedCategory(expandedCategory === categoryId ? null : categoryId)}
          />

          {top3.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold">Categorias com maior despesa</h4>
              <ol className="grid gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-3">
                {top3.map((cat, idx) => (
                  <li key={cat.categoryId} className="min-w-0 space-y-1 bg-card p-3 text-xs">
                    <p className="break-words font-medium">{idx + 1}. {cat.categoryName}</p>
                    <p className="flex flex-wrap gap-x-2 font-mono tabular-nums">
                      {currencyFmt(cat.total)} <span className="text-muted-foreground">{cat.percentage.toFixed(1)}%</span>
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </QueryPanel>
  );
}
