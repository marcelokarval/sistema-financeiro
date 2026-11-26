'use client';

import { ArrowDownRight, ArrowUpRight, Clock, Store, Trophy } from 'lucide-react';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { TabsContent } from '@/components/ui/tabs';
import {
  FinanceChartTooltip,
  type FinanceChartTooltipRow,
} from '@/components/shared/finance-chart-tooltip';
import { FinanceMetric } from '@/components/shared/finance-metric';
import { FinanceProgress } from '@/components/shared/finance-progress';
import { useSafeLocale, useSafeTranslations } from '@/i18n/provider';
import { currencyFmt, dateFmt, shortCurrency } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { DISTRIBUTION_COLORS, getIntlLocale } from './analytics-i18n';

export interface OverviewData {
  totalTransactions: number;
  totalIncome: number;
  totalExpense: number;
  averagePerTransaction: number;
  highestTransaction: { description: string; amount: number; date: string; categoryName: string; type: string } | null;
  lowestTransaction: { description: string; amount: number; date: string; categoryName: string; type: string } | null;
  mostFrequentCategory: { categoryName: string; categoryColor: string; count: number; total: number } | null;
  weekdayBreakdown: { day: string; income: number; expense: number; count: number }[];
}

export interface MonthlyItem { month: string; income: number; expense: number; net: number; count: number; avgPerTx: number }
export interface MerchantItem { name: string; count: number; total: number; category: string }
export interface DistributionItem { range: string; count: number; percentage: number }
export interface DailyPatternItem { hour: string; count: number }

export interface AnalyticsData {
  overview: OverviewData;
  monthlyComparison: MonthlyItem[];
  topMerchants: MerchantItem[];
  amountDistribution: DistributionItem[];
  dailyPattern: DailyPatternItem[];
}

function useMaskedValue(): string {
  const tShared = useSafeTranslations('shared');
  return tShared.has('maskedValue') ? tShared('maskedValue') : 'R$ ••••••';
}

/** Recharts tooltip adapter for TransactionAnalytics weekday and hourly charts. */
export function TransactionAnalyticsTooltip({
  active,
  payload,
  label,
  mode,
  showValues = true,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: unknown; color?: string; dataKey?: string | number }>;
  label?: string;
  mode: 'weekday' | 'hourly';
  showValues?: boolean;
}) {
  const t = useSafeTranslations('analytics');
  const locale = useSafeLocale();
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;

  const rows: FinanceChartTooltipRow[] = payload.flatMap((entry) => {
    const key = entry?.dataKey != null ? String(entry.dataKey) : entry?.name;
    if (typeof entry?.value !== 'number' || !Number.isFinite(entry.value) || !key) {
      return [];
    }
    if (mode === 'weekday') {
      return [{
        key,
        label: key === 'income' ? t('transactions.series.income') : t('transactions.series.expense'),
        value: currencyFmt(entry.value, locale),
        color: entry.color,
      }];
    }
    return [{
      key,
      label: t('transactions.tooltip.transactions'),
      value: String(entry.value),
      color: entry.color,
      maskedValue: t('transactions.tooltip.maskedCount'),
    }];
  });

  if (rows.length === 0) return null;

  return <FinanceChartTooltip active={active} title={label} rows={rows} showValues={showValues} />;
}

function TransactionExtremeCard({
  title, titleClass, transaction, showValues = true,
}: {
  title: string; titleClass: string; transaction: OverviewData['highestTransaction']; showValues?: boolean;
}) {
  const t = useSafeTranslations('analytics');
  const locale = useSafeLocale();
  const maskedValue = useMaskedValue();
  return (
    <div className="min-w-0 border-t border-border pt-3">
      <div className="flex items-center gap-2 mb-3">
        <p className={cn('text-xs font-semibold', titleClass)}>{title}</p>
      </div>
      {transaction ? (
        <div>
          <p className="font-mono text-sm font-semibold tabular-nums">{showValues ? currencyFmt(transaction.amount, locale) : maskedValue}</p>
          <p className="text-xs text-muted-foreground mt-1 truncate">{transaction.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
              {transaction.categoryName}
            </Badge>
            <span className="text-xs text-muted-foreground">{dateFmt(transaction.date, locale)}</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t('transactions.overview.noneFound')}</p>
      )}
    </div>
  );
}

/** Overview tab for TransactionAnalyticsContent using FinanceMetric. */
export function TransactionOverviewTab({ overview, showValues = true }: { overview: OverviewData; showValues?: boolean }) {
  const t = useSafeTranslations('analytics');
  const locale = useSafeLocale();
  const maskedValue = useMaskedValue();
  const statCards = [
    { label: t('transactions.overview.totalTransactions'), value: overview.totalTransactions.toLocaleString(getIntlLocale(locale)), masked: t('transactions.tooltip.maskedCount'), visible: showValues },
    { label: t('transactions.overview.totalIncome'), value: currencyFmt(overview.totalIncome, locale), masked: maskedValue, visible: showValues },
    { label: t('transactions.overview.avgTicket'), value: currencyFmt(overview.averagePerTransaction, locale), masked: maskedValue, visible: showValues },
    {
      label: t('transactions.overview.highestTransaction'),
      value: overview.highestTransaction ? currencyFmt(overview.highestTransaction.amount, locale) : '—',
      masked: maskedValue,
      visible: showValues || !overview.highestTransaction,
    },
  ];

  return (
    <TabsContent value="overview" className="mt-0 min-w-0 space-y-4">
      <dl aria-label={t('transactions.overview.indicatorsAria')} className="grid grid-cols-2 gap-3 border-y border-border py-3 lg:grid-cols-4">
        {statCards.map((stat) => (
          <FinanceMetric
            key={stat.label}
            variant="compact"
            valueClassName="text-sm"
            label={stat.label}
            value={stat.value}
            showValues={stat.visible}
            maskedValue={stat.masked}
          />
        ))}
      </dl>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TransactionExtremeCard
          title={t('transactions.overview.highestTransaction')}
          titleClass="text-[var(--obligation)]"
          transaction={overview.highestTransaction}
          showValues={showValues}
        />
        <TransactionExtremeCard
          title={t('transactions.overview.lowestTransaction')}
          titleClass="text-primary"
          transaction={overview.lowestTransaction}
          showValues={showValues}
        />
      </div>

      {overview.mostFrequentCategory && (
        <div className="min-w-0 border-t border-border pt-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" />
              <p className="text-xs font-semibold text-primary">{t('transactions.overview.mostFrequentCategory')}</p>
            </div>
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4 font-mono tabular-nums">
              {showValues ? `${overview.mostFrequentCategory.count}x` : '•••'}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-8 rounded-sm shrink-0"
              style={{ backgroundColor: overview.mostFrequentCategory.categoryColor }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold truncate">{overview.mostFrequentCategory.categoryName}</p>
                <p className="text-sm font-semibold font-mono tabular-nums shrink-0 ml-2">
                  {showValues ? currencyFmt(overview.mostFrequentCategory.total, locale) : maskedValue}
                </p>
              </div>
              <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: '100%', backgroundColor: overview.mostFrequentCategory.categoryColor }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </TabsContent>
  );
}

function DistributionRangeRow({
  item, maxDistCount, color, showValues = true,
}: {
  item: DistributionItem; maxDistCount: number; color: string; showValues?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium text-muted-foreground w-16 shrink-0 text-right">
        {item.range}
      </span>
      <div className="flex-1 h-8 rounded-lg bg-muted/50 overflow-hidden relative">
        <div
          style={{
            width: showValues && item.count > 0 ? `${Math.max((item.count / maxDistCount) * 100, 4)}%` : '0%',
            backgroundColor: color,
          }}
          className="h-full rounded-lg"
        />
        <div className="absolute inset-0 flex items-center px-3">
          <span className="font-mono text-xs font-semibold tabular-nums text-foreground">{showValues ? item.count : '•••'}</span>
          <span className="text-xs text-muted-foreground ml-auto font-mono tabular-nums">
            {showValues ? `${item.percentage.toFixed(1)}%` : '•••'}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Amount distribution and weekday breakdown tab for TransactionAnalyticsContent. */
export function TransactionDistributionTab({
  amountDistribution, maxDistCount, weekdayBreakdown, showValues = true,
}: {
  amountDistribution: DistributionItem[]; maxDistCount: number; weekdayBreakdown: OverviewData['weekdayBreakdown']; showValues?: boolean;
}) {
  const t = useSafeTranslations('analytics');
  const locale = useSafeLocale();
  return (
    <TabsContent value="distribution" className="mt-0 min-w-0 space-y-5">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {t('transactions.distribution.byAmountTitle')}
        </p>
        <div className="space-y-2.5">
          {amountDistribution.map((item, idx) => (
            <DistributionRangeRow
              key={item.range}
              item={item}
              maxDistCount={maxDistCount}
              color={DISTRIBUTION_COLORS[idx]}
              showValues={showValues}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {t('transactions.distribution.byWeekdayTitle')}
        </p>
        <div className="h-52 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekdayBreakdown} barCategoryGap="15%">
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} tickFormatter={(v) => (showValues ? shortCurrency(v, locale) : '•••')} width={50} />
              <RechartsTooltip content={<TransactionAnalyticsTooltip mode="weekday" showValues={showValues} />} />
              <Bar isAnimationActive={false} dataKey="income" name={t('transactions.series.income')} stackId="a" fill="var(--ds-chart-1)" radius={[0, 0, 0, 0]} />
              <Bar isAnimationActive={false} dataKey="expense" name={t('transactions.series.expense')} stackId="a" fill="var(--ds-chart-4)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[var(--money)]" />
            <span className="text-xs text-muted-foreground">{t('transactions.series.income')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[var(--debt)]" />
            <span className="text-xs text-muted-foreground">{t('transactions.series.expense')}</span>
          </div>
        </div>
      </div>
    </TabsContent>
  );
}

function TopMerchantRow({
  merchant, rank, maxMerchantTotal, showValues = true,
}: {
  merchant: MerchantItem; rank: number; maxMerchantTotal: number; showValues?: boolean;
}) {
  const t = useSafeTranslations('analytics');
  const locale = useSafeLocale();
  const maskedValue = useMaskedValue();
  const pct = Math.max((merchant.total / maxMerchantTotal) * 100, 3);

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-muted-foreground w-4 shrink-0">{rank}</span>
          <span className="text-sm font-medium truncate">{merchant.name}</span>
          <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4 shrink-0">{merchant.category}</Badge>
        </div>
        <span className="text-sm font-semibold font-mono tabular-nums shrink-0 ml-2">
          {showValues ? currencyFmt(merchant.total, locale) : maskedValue}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <FinanceProgress
          label={t('transactions.patterns.merchantShareAria', { name: merchant.name })}
          ariaLabel={t('transactions.patterns.merchantShareAria', { name: merchant.name })}
          value={pct}
          valueText={showValues ? undefined : '•••'}
          showHeader={false}
          className="flex-1"
          trackClassName="h-1.5 bg-muted"
        />
        <span className="text-xs text-muted-foreground font-mono tabular-nums shrink-0">
          {showValues ? `${merchant.count}x` : '•••'}
        </span>
      </div>
    </div>
  );
}

function MonthlyComparisonRow({
  item: m, prevNet, showValues = true,
}: {
  item: MonthlyItem; prevNet: number | null; showValues?: boolean;
}) {
  const locale = useSafeLocale();
  const maskedValue = useMaskedValue();
  const money = (v: number) => (showValues ? currencyFmt(v, locale) : maskedValue);
  const netChange = prevNet !== null && prevNet !== 0
    ? ((m.net - prevNet) / Math.abs(prevNet)) * 100
    : null;

  return (
    <tr className="border-t border-border/30 hover:bg-muted/30 transition-colors">
      <td className="py-2.5 px-3 font-medium">{m.month}</td>
      <td className="text-right py-2.5 px-3 font-mono tabular-nums text-[var(--money)]">{money(m.income)}</td>
      <td className="text-right py-2.5 px-3 font-mono tabular-nums text-[var(--debt)]">{money(m.expense)}</td>
      <td
        className={cn(
          'text-right py-2.5 px-3 font-mono tabular-nums font-semibold',
          m.net >= 0 ? 'text-[var(--money)]' : 'text-[var(--debt)]',
        )}
      >
        {money(m.net)}
      </td>
      <td className="text-right py-2.5 px-3 font-mono tabular-nums">{showValues ? m.count : '•••'}</td>
      <td className="text-right py-2.5 px-3 font-mono tabular-nums">{money(m.avgPerTx)}</td>
      <td className="text-right py-2.5 px-3">
        {netChange !== null ? (
          <div className="inline-flex items-center gap-0.5">
            {netChange >= 0 ? (
              <ArrowUpRight className="w-3 h-3 text-[var(--money)]" />
            ) : (
              <ArrowDownRight className="w-3 h-3 text-[var(--debt)]" />
            )}
            <span className={cn('font-mono tabular-nums', netChange >= 0 ? 'text-[var(--money)]' : 'text-[var(--debt)]')}>
              {showValues ? `${Math.abs(netChange).toFixed(1)}%` : '•••'}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}

/** Daily pattern, top merchants, and monthly comparison table tab for TransactionAnalyticsContent. */
export function TransactionPatternsTab({
  dailyPattern, topMerchants, maxMerchantTotal, monthlyComparison, showValues = true,
}: {
  dailyPattern: DailyPatternItem[]; topMerchants: MerchantItem[]; maxMerchantTotal: number; monthlyComparison: MonthlyItem[]; showValues?: boolean;
}) {
  const t = useSafeTranslations('analytics');
  return (
    <TabsContent value="patterns" className="mt-0 min-w-0 space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t('transactions.patterns.dailyTitle')}
          </p>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyPattern} barCategoryGap="20%">
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} interval={1} />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(v) => (showValues ? String(v) : '•••')} width={30} />
              <RechartsTooltip content={<TransactionAnalyticsTooltip mode="hourly" showValues={showValues} />} />
              <Bar isAnimationActive={false} dataKey="count" fill="var(--ds-chart-2)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {topMerchants.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Store className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('transactions.patterns.topMerchantsTitle')}
            </p>
          </div>
          <div className="space-y-2.5">
            {topMerchants.map((merchant, idx) => (
              <TopMerchantRow
                key={merchant.name}
                merchant={merchant}
                rank={idx + 1}
                maxMerchantTotal={maxMerchantTotal}
                showValues={showValues}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {t('transactions.patterns.monthlyComparisonTitle')}
        </p>
        <div className="min-w-0 rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={t('transactions.patterns.monthlyComparisonAria')}>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground">{t('transactions.patterns.columns.month')}</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-[var(--money)]">{t('transactions.patterns.columns.income')}</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-[var(--debt)]">{t('transactions.patterns.columns.expense')}</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">{t('transactions.patterns.columns.net')}</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">{t('transactions.patterns.columns.count')}</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">{t('transactions.patterns.columns.ticket')}</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">{t('transactions.patterns.columns.change')}</th>
                </tr>
              </thead>
              <tbody>
                {monthlyComparison.map((m, idx) => (
                  <MonthlyComparisonRow
                    key={m.month}
                    item={m}
                    prevNet={idx > 0 ? monthlyComparison[idx - 1].net : null}
                    showValues={showValues}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </TabsContent>
  );
}
