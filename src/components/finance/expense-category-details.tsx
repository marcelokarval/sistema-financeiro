'use client';

import { ChevronDown, ChevronUp, TrendingDown } from 'lucide-react';
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
import {
  FinanceChartTooltip,
  type FinanceChartTooltipRow,
} from '@/components/shared/finance-chart-tooltip';
import { useSafeLocale, useSafeTranslations } from '@/i18n/provider';
import { currencyFmt, percentFmt, shortCurrency } from '@/lib/helpers';

export interface CategoryItem {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  total: number;
  percentage: number;
  transactionCount: number;
  purchaseCount: number;
}

export interface MonthlyItem {
  month: string;
  monthKey: string;
  total: number;
}

export interface BreakdownData {
  categories: CategoryItem[];
  totalExpense: number;
  topCategory: CategoryItem | null;
  monthlyData: MonthlyItem[];
}

/** Recharts tooltip adapter for ExpenseBreakdown donut chart. */
export function ExpenseBreakdownTooltip({
  active,
  payload,
  showValues = true,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: unknown; payload?: { color?: string } }>;
  showValues?: boolean;
}) {
  const locale = useSafeLocale();
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;

  const rows: FinanceChartTooltipRow[] = payload.flatMap((entry, idx) => {
    if (typeof entry?.value !== 'number' || !Number.isFinite(entry.value) || !entry?.name) {
      return [];
    }
    return [{
      key: `${entry.name}-${idx}`,
      label: entry.name,
      value: currencyFmt(entry.value, locale),
      color: entry.payload?.color,
    }];
  });

  if (rows.length === 0) return null;

  return <FinanceChartTooltip active={active} rows={rows} showValues={showValues} />;
}

/** Recharts tooltip adapter for expanded category monthly bar chart. */
export function ExpenseCategoryTooltip({
  active,
  payload,
  label,
  categoryName,
  showValues = true,
}: {
  active?: boolean;
  payload?: Array<{ value?: unknown }>;
  label?: string;
  categoryName: string;
  showValues?: boolean;
}) {
  const locale = useSafeLocale();
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;
  const value = payload[0]?.value;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;

  return (
    <FinanceChartTooltip
      active={active}
      title={label}
      rows={[{ key: 'valor', label: categoryName, value: currencyFmt(value, locale) }]}
      showValues={showValues}
    />
  );
}

function ExpenseCategoryMonthlyChart({
  category,
  monthlyData,
  showValues = true,
}: {
  category: CategoryItem;
  monthlyData: MonthlyItem[];
  showValues?: boolean;
}) {
  const t = useSafeTranslations('analytics');
  const locale = useSafeLocale();
  const series = monthlyData.map((m) => ({
    month: m.month,
    valor: m.total * (category.percentage / 100),
  }));

  return (
    <div className="px-3.5 pb-3.5 pt-0">
      <div className="border-t border-border/50 pt-3">
        <p className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1.5">
          <TrendingDown className="w-3 h-3" />
          {t('expenses.monthlyEstimate')}
        </p>
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10 }}
                stroke="var(--muted-foreground)"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                stroke="var(--muted-foreground)"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (showValues ? shortCurrency(v, locale) : '•••')}
                width={40}
              />
              <RechartsTooltip content={<ExpenseCategoryTooltip categoryName={category.categoryName} showValues={showValues} />} />
              <Bar
                dataKey="valor"
                isAnimationActive={false}
                fill={category.categoryColor}
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function ExpenseCategoryRow({
  category: cat,
  isExpanded,
  isHighlighted,
  monthlyData,
  onToggle,
  onHover,
  showValues = true,
}: {
  category: CategoryItem;
  isExpanded: boolean;
  isHighlighted: boolean;
  monthlyData: MonthlyItem[];
  onToggle: () => void;
  onHover: (categoryId: string | null) => void;
  showValues?: boolean;
}) {
  const tShared = useSafeTranslations('shared');
  const locale = useSafeLocale();
  const maskedValue = tShared.has('maskedValue') ? tShared('maskedValue') : 'R$ ••••••';
  return (
    <li>
      <button
        type="button"
        aria-expanded={isExpanded}
        className="flex w-full items-center gap-2 rounded-sm px-2 py-3 text-left hover:bg-muted/30 focus-visible:outline-offset-[-2px]"
        onClick={onToggle}
        onMouseEnter={() => onHover(cat.categoryId)}
        onMouseLeave={() => onHover(null)}
      >
        <div
          className="w-3.5 h-3.5 rounded-sm shrink-0 transition-transform"
          style={{
            backgroundColor: cat.categoryColor,
            transform: isHighlighted ? 'scale(1.2)' : 'scale(0.9)',
            opacity: isHighlighted ? 1 : 0.4,
          }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="min-w-0 break-words text-sm font-medium">{cat.categoryName}</span>
            <Badge variant="secondary" className="font-mono text-xs tabular-nums px-1.5 py-0 h-5 shrink-0">
              {cat.transactionCount + cat.purchaseCount}x
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[120px]">
              <div
                className="h-full rounded-full"
                style={{ width: `${showValues ? Math.max(cat.percentage, 1) : 0}%`, backgroundColor: cat.categoryColor }}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="font-mono text-sm font-semibold tabular-nums">{showValues ? currencyFmt(cat.total, locale) : maskedValue}</p>
            <p className="font-mono text-xs tabular-nums text-muted-foreground">{showValues ? percentFmt(cat.percentage, locale, { signed: false }) : '•••'}</p>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {isExpanded && <ExpenseCategoryMonthlyChart category={cat} monthlyData={monthlyData} showValues={showValues} />}
    </li>
  );
}

/** Expandable category breakdown list with monthly participation charts and "Outros" aggregation. */
export function ExpenseCategoryList({
  categories,
  monthlyData,
  activeCategory,
  expandedCategory,
  onSelectActive,
  onToggleExpand,
  showValues = true,
}: {
  categories: CategoryItem[];
  monthlyData: MonthlyItem[];
  activeCategory: string | null;
  expandedCategory: string | null;
  onSelectActive: (categoryId: string | null) => void;
  onToggleExpand: (categoryId: string) => void;
  showValues?: boolean;
}) {
  const t = useSafeTranslations('analytics');
  const tShared = useSafeTranslations('shared');
  const locale = useSafeLocale();
  const maskedValue = tShared.has('maskedValue') ? tShared('maskedValue') : 'R$ ••••••';
  const remaining = categories.slice(8);

  return (
    <ul className="divide-y divide-border border-y border-border">
      {categories.slice(0, 8).map((cat) => (
        <ExpenseCategoryRow
          key={cat.categoryId}
          category={cat}
          isExpanded={expandedCategory === cat.categoryId}
          isHighlighted={activeCategory === cat.categoryId || activeCategory === null}
          monthlyData={monthlyData}
          onToggle={() => onToggleExpand(cat.categoryId)}
          onHover={onSelectActive}
          showValues={showValues}
        />
      ))}

      {remaining.length > 0 && (
        <li className="flex items-center gap-3 px-2 py-3">
          <div className="w-3.5 h-3.5 rounded-sm shrink-0 bg-muted-foreground" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-muted-foreground">
              {t('expenses.othersCount', { count: remaining.length })}
            </span>
          </div>
          <div className="text-right shrink-0">
            <p className="font-mono text-sm font-semibold tabular-nums text-muted-foreground">
              {showValues ? currencyFmt(remaining.reduce((s, c) => s + c.total, 0), locale) : maskedValue}
            </p>
            <p className="font-mono text-xs tabular-nums text-muted-foreground">
              {showValues ? percentFmt(remaining.reduce((s, c) => s + c.percentage, 0), locale, { signed: false }) : '•••'}
            </p>
          </div>
        </li>
      )}
    </ul>
  );
}
