'use client';

import {
  ArrowDownRight,
  ArrowUpRight,
  PiggyBank,
  ShoppingCart,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';
import {
  FinanceChartTooltip,
  type FinanceChartTooltipRow,
} from '@/components/shared/finance-chart-tooltip';
import { FinanceMetric } from '@/components/shared/finance-metric';
import { currencyFmt } from '@/lib/helpers';
import { cn } from '@/lib/utils';

export interface MonthlyItem {
  month: string;
  income: number;
  expense: number;
  net: number;
  transactionCount: number;
  purchaseCount: number;
  avgDailySpend: number;
  savingsRate: number;
}

export interface CategoryInfo {
  name: string;
  color: string;
  total: number;
  count: number;
}

export interface ExpenseItem {
  id: string;
  description: string;
  amount: number;
  date: string;
}

export interface ReportsData {
  monthlyData: MonthlyItem[];
  topExpenseCategory: CategoryInfo | null;
  topCategories: CategoryInfo[];
  avgDailySpend: number;
  highestExpense: ExpenseItem | null;
  lowestIncome: ExpenseItem | null;
  savingsRateTrend: { month: string; rate: number }[];
  ticketMedio: number;
}

const shortCurrency = (v: number) => {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v.toFixed(0);
};

const pctFmt = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

/** Recharts tooltip adapter for FinancialReports monthly comparison chart. */
export function FinancialReportsTooltip({
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
    const rowLabel = entry?.name ?? key;
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

  return <FinanceChartTooltip active={active} title={label} rows={rows} showValues={showValues} />;
}

function MonthlyReportRow({
  item: m,
  prev,
}: {
  item: MonthlyItem;
  prev: MonthlyItem | null;
}) {
  const incomeChange = prev && prev.income > 0 ? ((m.income - prev.income) / prev.income) * 100 : null;
  const expenseChange = prev && prev.expense > 0 ? ((m.expense - prev.expense) / prev.expense) * 100 : null;

  return (
    <div
      role="listitem"
      className="grid min-w-0 grid-cols-2 items-start gap-2 py-2.5 sm:grid-cols-[minmax(4rem,1fr)_repeat(3,minmax(0,1fr))]"
    >
      <div className="w-16 shrink-0">
        <p className="text-sm font-semibold">{m.month}</p>
        <p className="text-xs text-muted-foreground">{m.transactionCount + m.purchaseCount} mov.</p>
      </div>

      <div className="flex-1 min-w-0 text-right">
        <p className="text-xs text-muted-foreground">Receitas</p>
        <div className="flex flex-wrap items-center justify-end gap-x-1">
          <span className="break-words font-mono text-sm font-semibold tabular-nums text-[var(--money)]">
            {currencyFmt(m.income)}
          </span>
          {incomeChange !== null && (
            <span
              className={cn(
                'text-xs font-medium flex items-center gap-0.5',
                incomeChange >= 0 ? 'text-[var(--money)]' : 'text-[var(--debt)]',
              )}
            >
              {incomeChange >= 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
              {pctFmt(incomeChange)}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 text-right">
        <p className="text-xs text-muted-foreground">Despesas</p>
        <div className="flex flex-wrap items-center justify-end gap-x-1">
          <span className="break-words font-mono text-sm font-semibold tabular-nums text-[var(--debt)]">
            {currencyFmt(m.expense)}
          </span>
          {expenseChange !== null && (
            <span
              className={cn(
                'text-xs font-medium flex items-center gap-0.5',
                expenseChange <= 0 ? 'text-[var(--money)]' : 'text-[var(--debt)]',
              )}
            >
              {expenseChange <= 0 ? <ArrowDownRight className="w-2.5 h-2.5" /> : <ArrowUpRight className="w-2.5 h-2.5" />}
              {pctFmt(expenseChange)}
            </span>
          )}
        </div>
      </div>

      <div className="min-w-0 text-right">
        <p className="text-xs text-muted-foreground">Líquido</p>
        <span
          className={cn(
            'break-words font-mono text-sm font-semibold tabular-nums',
            m.net >= 0 ? 'text-[var(--money)]' : 'text-[var(--debt)]',
          )}
        >
          {m.net >= 0 ? '+' : ''}{currencyFmt(m.net)}
        </span>
      </div>
    </div>
  );
}

/** Monthly bar chart and breakdown list tab for FinancialReportsContent. */
export function FinancialReportsMonthlyTab({ monthlyData }: { monthlyData: MonthlyItem[] }) {
  const chartData = monthlyData.map((m) => ({
    month: m.month,
    Receitas: m.income,
    Despesas: m.expense,
  }));

  return (
    <TabsContent value="monthly" className="mt-4 space-y-4">
      {monthlyData.length === 0 && <p className="text-sm text-muted-foreground">Nenhum mês disponível no relatório.</p>}
      <div>
        <div className="h-56 min-w-0 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={2} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} tickFormatter={shortCurrency} />
              <RechartsTooltip content={<FinancialReportsTooltip />} />
              <Bar isAnimationActive={false} dataKey="Receitas" fill="var(--ds-chart-1)" radius={[4, 4, 0, 0]} />
              <Bar isAnimationActive={false} dataKey="Despesas" fill="var(--ds-chart-3)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="divide-y divide-border border-y border-border" role="list" aria-label="Detalhamento mensal">
        {monthlyData.map((m, idx) => (
          <MonthlyReportRow key={m.month} item={m} prev={idx > 0 ? monthlyData[idx - 1] : null} />
        ))}
      </div>
    </TabsContent>
  );
}

function ReportCategoryRow({
  category: cat,
  totalExpenseAcrossPeriod,
}: {
  category: CategoryInfo;
  totalExpenseAcrossPeriod: number;
}) {
  const percent = totalExpenseAcrossPeriod > 0 ? (cat.total / totalExpenseAcrossPeriod) * 100 : 0;

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: cat.color }} />
          <span className="text-sm font-medium">{cat.name}</span>
          <Badge variant="secondary" className="font-mono text-xs tabular-nums px-1.5 py-0">
            {cat.count}x
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold tabular-nums">{currencyFmt(cat.total)}</span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{percent.toFixed(0)}%</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: cat.color }} />
      </div>
    </div>
  );
}

function SavingsRateRow({ month, rate }: { month: string; rate: number }) {
  const clampedRate = Math.min(Math.max(rate, -100), 100);
  const color = clampedRate >= 30 ? 'bg-[var(--money)]' : clampedRate >= 0 ? 'bg-[var(--obligation)]' : 'bg-[var(--debt)]';
  const textColor = clampedRate >= 30 ? 'text-[var(--money)]' : clampedRate >= 0 ? 'text-[var(--obligation)]' : 'text-[var(--debt)]';

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-16 shrink-0">{month}</span>
      <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.max(Math.abs(clampedRate), 2)}%` }} />
      </div>
      <span className={cn('font-mono text-xs font-semibold tabular-nums w-14 text-right', textColor)}>
        {rate.toFixed(1)}%
      </span>
    </div>
  );
}

/** Indicators, top categories, and savings rate trend tab for FinancialReportsContent. */
export function FinancialReportsAnalysisTab({ data }: { data: ReportsData }) {
  const totalExpenseAcrossPeriod = data.topCategories.reduce((s, c) => s + c.total, 0);

  return (
    <TabsContent value="analysis" className="mt-4 space-y-4">
      <dl aria-label="Indicadores do relatório" className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border py-3 lg:grid-cols-4">
        <FinanceMetric
          variant="compact"
          valueClassName="mt-0.5 text-sm"
          label="Ticket médio"
          value={currencyFmt(data.ticketMedio)}
        />
        <FinanceMetric
          variant="compact"
          valueClassName="mt-0.5 text-sm"
          label="Gasto médio por dia"
          value={currencyFmt(data.avgDailySpend)}
        />
        <FinanceMetric
          variant="compact"
          valueClassName="mt-0.5 text-sm"
          label="Maior despesa"
          value={data.highestExpense ? currencyFmt(data.highestExpense.amount) : <span className="font-sans font-normal text-muted-foreground">Sem dados</span>}
          caption={data.highestExpense ? <span className="block break-words">{data.highestExpense.description}</span> : undefined}
        />
        <FinanceMetric
          variant="compact"
          valueClassName="mt-0.5 text-sm"
          label="Menor receita"
          value={data.lowestIncome ? currencyFmt(data.lowestIncome.amount) : <span className="font-sans font-normal text-muted-foreground">Sem dados</span>}
          caption={data.lowestIncome ? <span className="block break-words">{data.lowestIncome.description}</span> : undefined}
        />
      </dl>

      <Card className="min-w-0 gap-2 rounded-lg py-3 shadow-none">
        <CardHeader className="px-4 sm:px-5">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Top Categorias de Despesa</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4 px-4 sm:px-5">
          {data.topCategories.length > 0 ? (
            data.topCategories.map((cat) => (
              <ReportCategoryRow
                key={cat.name}
                category={cat}
                totalExpenseAcrossPeriod={totalExpenseAcrossPeriod}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma categoria com despesas</p>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0 gap-2 rounded-lg py-3 shadow-none">
        <CardHeader className="px-4 sm:px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PiggyBank className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Taxa de Poupança</CardTitle>
            </div>
            <Badge variant="secondary" className="text-xs">
              {data.savingsRateTrend.length} meses
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-5">
          <div className="space-y-3">
            {data.savingsRateTrend.map((s) => (
              <SavingsRateRow key={s.month} month={s.month} rate={s.rate} />
            ))}
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
