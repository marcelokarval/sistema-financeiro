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
import { useSafeLocale, useSafeTranslations } from '@/i18n/provider';
import { currencyFmt, shortCurrency } from '@/lib/helpers';
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

const pctFmt = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

type ReportSeriesKey = 'income' | 'expense';

const REPORT_SERIES_KEY_MAP: Record<string, ReportSeriesKey> = {
  Receitas: 'income',
  income: 'income',
  Despesas: 'expense',
  expense: 'expense',
};

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
  const t = useSafeTranslations('analytics');
  const locale = useSafeLocale();
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;

  const rows: FinanceChartTooltipRow[] = payload.flatMap((entry) => {
    const key = entry?.dataKey != null ? String(entry.dataKey) : entry?.name;
    const rawLabel = entry?.name ?? key;
    if (typeof entry?.value !== 'number' || !Number.isFinite(entry.value) || !key || !rawLabel) {
      return [];
    }
    const seriesKey = REPORT_SERIES_KEY_MAP[key];
    const rowLabel = seriesKey ? t(`reports.series.${seriesKey}`) : rawLabel;
    return [{
      key,
      label: rowLabel,
      value: currencyFmt(entry.value, locale),
      color: entry.color,
    }];
  });

  if (rows.length === 0) return null;

  return <FinanceChartTooltip active={active} title={label} rows={rows} showValues={showValues} />;
}

function MonthlyReportRow({
  item: m,
  prev,
  showValues = true,
}: {
  item: MonthlyItem;
  prev: MonthlyItem | null;
  showValues?: boolean;
}) {
  const t = useSafeTranslations('analytics');
  const tShared = useSafeTranslations('shared');
  const locale = useSafeLocale();
  const maskedValue = tShared.has('maskedValue') ? tShared('maskedValue') : 'R$ ••••••';
  const money = (v: number) => (showValues ? currencyFmt(v, locale) : maskedValue);
  const incomeChange = prev && prev.income > 0 ? ((m.income - prev.income) / prev.income) * 100 : null;
  const expenseChange = prev && prev.expense > 0 ? ((m.expense - prev.expense) / prev.expense) * 100 : null;

  return (
    <div
      role="listitem"
      className="grid min-w-0 grid-cols-2 items-start gap-2 py-2.5 sm:grid-cols-[minmax(4rem,1fr)_repeat(3,minmax(0,1fr))]"
    >
      <div className="w-16 shrink-0">
        <p className="text-sm font-semibold">{m.month}</p>
        <p className="text-xs text-muted-foreground">{t('reports.movementsShort', { count: m.transactionCount + m.purchaseCount })}</p>
      </div>

      <div className="flex-1 min-w-0 text-right">
        <p className="text-xs text-muted-foreground">{t('reports.incomeLabel')}</p>
        <div className="flex flex-wrap items-center justify-end gap-x-1">
          <span className="break-words font-mono text-sm font-semibold tabular-nums text-[var(--money)]">
            {money(m.income)}
          </span>
          {incomeChange !== null && (
            <span
              className={cn(
                'text-xs font-medium flex items-center gap-0.5',
                incomeChange >= 0 ? 'text-[var(--money)]' : 'text-[var(--debt)]',
              )}
            >
              {incomeChange >= 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
              {showValues ? pctFmt(incomeChange) : '•••'}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 text-right">
        <p className="text-xs text-muted-foreground">{t('reports.expenseLabel')}</p>
        <div className="flex flex-wrap items-center justify-end gap-x-1">
          <span className="break-words font-mono text-sm font-semibold tabular-nums text-[var(--debt)]">
            {money(m.expense)}
          </span>
          {expenseChange !== null && (
            <span
              className={cn(
                'text-xs font-medium flex items-center gap-0.5',
                expenseChange <= 0 ? 'text-[var(--money)]' : 'text-[var(--debt)]',
              )}
            >
              {expenseChange <= 0 ? <ArrowDownRight className="w-2.5 h-2.5" /> : <ArrowUpRight className="w-2.5 h-2.5" />}
              {showValues ? pctFmt(expenseChange) : '•••'}
            </span>
          )}
        </div>
      </div>

      <div className="min-w-0 text-right">
        <p className="text-xs text-muted-foreground">{t('reports.netLabel')}</p>
        <span
          className={cn(
            'break-words font-mono text-sm font-semibold tabular-nums',
            m.net >= 0 ? 'text-[var(--money)]' : 'text-[var(--debt)]',
          )}
        >
          {showValues ? `${m.net >= 0 ? '+' : ''}${currencyFmt(m.net, locale)}` : maskedValue}
        </span>
      </div>
    </div>
  );
}

/** Monthly bar chart and breakdown list tab for FinancialReportsContent. */
export function FinancialReportsMonthlyTab({ monthlyData, showValues = true }: { monthlyData: MonthlyItem[]; showValues?: boolean }) {
  const t = useSafeTranslations('analytics');
  const locale = useSafeLocale();
  const chartData = monthlyData.map((m) => ({
    month: m.month,
    Receitas: m.income,
    Despesas: m.expense,
  }));

  return (
    <TabsContent value="monthly" className="mt-4 space-y-4">
      {monthlyData.length === 0 && <p className="text-sm text-muted-foreground">{t('reports.monthlyEmpty')}</p>}
      <div>
        <div className="h-56 min-w-0 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={2} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} tickFormatter={(v) => (showValues ? shortCurrency(v, locale) : '•••')} />
              <RechartsTooltip content={<FinancialReportsTooltip showValues={showValues} />} />
              <Bar isAnimationActive={false} dataKey="Receitas" name={t('reports.series.income')} fill="var(--ds-chart-1)" radius={[4, 4, 0, 0]} />
              <Bar isAnimationActive={false} dataKey="Despesas" name={t('reports.series.expense')} fill="var(--ds-chart-3)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="divide-y divide-border border-y border-border" role="list" aria-label={t('reports.monthlyBreakdownAria')}>
        {monthlyData.map((m, idx) => (
          <MonthlyReportRow key={m.month} item={m} prev={idx > 0 ? monthlyData[idx - 1] : null} showValues={showValues} />
        ))}
      </div>
    </TabsContent>
  );
}

function ReportCategoryRow({
  category: cat,
  totalExpenseAcrossPeriod,
  showValues = true,
}: {
  category: CategoryInfo;
  totalExpenseAcrossPeriod: number;
  showValues?: boolean;
}) {
  const tShared = useSafeTranslations('shared');
  const locale = useSafeLocale();
  const maskedValue = tShared.has('maskedValue') ? tShared('maskedValue') : 'R$ ••••••';
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
          <span className="font-mono text-sm font-semibold tabular-nums">{showValues ? currencyFmt(cat.total, locale) : maskedValue}</span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{showValues ? `${percent.toFixed(0)}%` : '•••'}</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${showValues ? percent : 0}%`, backgroundColor: cat.color }} />
      </div>
    </div>
  );
}

function SavingsRateRow({ month, rate, showValues = true }: { month: string; rate: number; showValues?: boolean }) {
  const clampedRate = Math.min(Math.max(rate, -100), 100);
  const color = clampedRate >= 30 ? 'bg-[var(--money)]' : clampedRate >= 0 ? 'bg-[var(--obligation)]' : 'bg-[var(--debt)]';
  const textColor = clampedRate >= 30 ? 'text-[var(--money)]' : clampedRate >= 0 ? 'text-[var(--obligation)]' : 'text-[var(--debt)]';

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-16 shrink-0">{month}</span>
      <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${showValues ? Math.max(Math.abs(clampedRate), 2) : 0}%` }} />
      </div>
      <span className={cn('font-mono text-xs font-semibold tabular-nums w-14 text-right', textColor)}>
        {showValues ? `${rate.toFixed(1)}%` : '•••'}
      </span>
    </div>
  );
}

/** Indicators, top categories, and savings rate trend tab for FinancialReportsContent. */
export function FinancialReportsAnalysisTab({ data, showValues = true }: { data: ReportsData; showValues?: boolean }) {
  const t = useSafeTranslations('analytics');
  const tShared = useSafeTranslations('shared');
  const locale = useSafeLocale();
  const maskedValue = tShared.has('maskedValue') ? tShared('maskedValue') : 'R$ ••••••';
  const totalExpenseAcrossPeriod = data.topCategories.reduce((s, c) => s + c.total, 0);

  return (
    <TabsContent value="analysis" className="mt-4 space-y-4">
      <dl aria-label={t('reports.indicatorsAria')} className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border py-3 lg:grid-cols-4">
        <FinanceMetric
          variant="compact"
          valueClassName="mt-0.5 text-sm"
          label={t('reports.metrics.avgTicket')}
          value={currencyFmt(data.ticketMedio, locale)}
          showValues={showValues}
          maskedValue={maskedValue}
        />
        <FinanceMetric
          variant="compact"
          valueClassName="mt-0.5 text-sm"
          label={t('reports.metrics.avgDailySpend')}
          value={currencyFmt(data.avgDailySpend, locale)}
          showValues={showValues}
          maskedValue={maskedValue}
        />
        <FinanceMetric
          variant="compact"
          valueClassName="mt-0.5 text-sm"
          label={t('reports.metrics.highestExpense')}
          value={data.highestExpense ? currencyFmt(data.highestExpense.amount, locale) : <span className="font-sans font-normal text-muted-foreground">{t('reports.metrics.noData')}</span>}
          caption={data.highestExpense ? <span className="block break-words">{data.highestExpense.description}</span> : undefined}
          showValues={showValues || !data.highestExpense}
          maskedValue={maskedValue}
        />
        <FinanceMetric
          variant="compact"
          valueClassName="mt-0.5 text-sm"
          label={t('reports.metrics.lowestIncome')}
          value={data.lowestIncome ? currencyFmt(data.lowestIncome.amount, locale) : <span className="font-sans font-normal text-muted-foreground">{t('reports.metrics.noData')}</span>}
          caption={data.lowestIncome ? <span className="block break-words">{data.lowestIncome.description}</span> : undefined}
          showValues={showValues || !data.lowestIncome}
          maskedValue={maskedValue}
        />
      </dl>

      <Card className="min-w-0 gap-2 rounded-lg py-3 shadow-none">
        <CardHeader className="px-4 sm:px-5">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">{t('reports.topCategoriesTitle')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4 px-4 sm:px-5">
          {data.topCategories.length > 0 ? (
            data.topCategories.map((cat) => (
              <ReportCategoryRow
                key={cat.name}
                category={cat}
                totalExpenseAcrossPeriod={totalExpenseAcrossPeriod}
                showValues={showValues}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">{t('reports.topCategoriesEmpty')}</p>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0 gap-2 rounded-lg py-3 shadow-none">
        <CardHeader className="px-4 sm:px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PiggyBank className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">{t('reports.savingsRateTitle')}</CardTitle>
            </div>
            <Badge variant="secondary" className="text-xs">
              {t('reports.monthsBadge', { count: data.savingsRateTrend.length })}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-5">
          <div className="space-y-3">
            {data.savingsRateTrend.map((s) => (
              <SavingsRateRow key={s.month} month={s.month} rate={s.rate} showValues={showValues} />
            ))}
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
