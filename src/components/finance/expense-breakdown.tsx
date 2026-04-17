'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  PieChart as PieChartIcon,
  Trophy,
  Medal,
  Award,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Helpers ───────────────────────────────────────────────────────
const currencyFmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const shortCurrency = (v: number) => {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v.toFixed(0);
};

// ─── Types ─────────────────────────────────────────────────────────
interface CategoryItem {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  total: number;
  percentage: number;
  transactionCount: number;
  purchaseCount: number;
}

interface MonthlyItem {
  month: string;
  monthKey: string;
  total: number;
}

interface BreakdownData {
  categories: CategoryItem[];
  totalExpense: number;
  topCategory: CategoryItem | null;
  monthlyData: MonthlyItem[];
}

// ─── Animation Variants ────────────────────────────────────────────
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const cardHover = {
  scale: 1.01,
  transition: { type: 'spring', stiffness: 300, damping: 20 },
};

const expandedContent = {
  hidden: { height: 0, opacity: 0 },
  show: { height: 'auto', opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { height: 0, opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } },
};

// ─── Default Chart Colors ──────────────────────────────────────────
const CHART_COLORS = [
  '#f43f5e', // rose
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#a855f7', // purple
];

// ─── Component ─────────────────────────────────────────────────────
export function ExpenseBreakdown() {
  const [data, setData] = useState<BreakdownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showCurrentMonth, setShowCurrentMonth] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const months = showCurrentMonth ? '1' : '6';
      const res = await fetch(`/api/expense-breakdown?months=${months}`);
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error('Erro ao buscar detalhamento de despesas', e);
    } finally {
      setLoading(false);
    }
  }, [showCurrentMonth]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Reset expanded/active when data changes
  useEffect(() => {
    setActiveCategory(null);
    setExpandedCategory(null);
  }, [showCurrentMonth]);

  // Prepare chart data: top 8 + "Outros"
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
        color: '#94a3b8',
        categoryId: 'outros',
        percentage: othersPercentage,
      });
    }

    return result;
  }, [data]);

  // Top 3 for trophy summary
  const top3 = data?.categories.slice(0, 3) || [];
  const trophyIcons = [Trophy, Medal, Award];
  const trophyColors = ['text-amber-500', 'text-slate-400', 'text-amber-700'];

  // Find max monthly value for bar chart scaling
  const maxMonthlyValue = useMemo(() => {
    if (!data) return 0;
    return Math.max(...data.monthlyData.map((m) => m.total), 1);
  }, [data]);

  // Get monthly breakdown for a specific category (used in expanded view)
  const getCategoryMonthlyData = useCallback(
    (catId: string) => {
      if (!data) return [];
      // We need per-category monthly data - since the API doesn't return it per category,
      // we use the overall monthly data as a visual indicator
      // For a more accurate view, we'd need the API to return per-category monthly breakdowns
      return data.monthlyData.map((m) => ({
        month: m.month,
        total: m.total * ((data.categories.find((c) => c.categoryId === catId)?.percentage || 0) / 100),
      }));
    },
    [data]
  );

  // ─── Loading skeleton ────────────────────────────────────────────
  if (loading) {
    return (
      <Card className="border-0 shadow-md overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500" />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
            <Skeleton className="h-8 w-40" />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Donut skeleton */}
          <div className="flex items-center justify-center">
            <Skeleton className="w-56 h-56 rounded-full" />
          </div>
          {/* Category list skeleton */}
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
          {/* Trophy summary skeleton */}
          <Skeleton className="h-16 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Erro ao carregar detalhamento de despesas.
      </p>
    );
  }

  const activeSlice = activeCategory
    ? chartData.find((d) => d.categoryId === activeCategory)
    : null;

  return (
    <motion.div variants={container} initial="hidden" animate="show">
      <Card className="border-0 shadow-md overflow-hidden">
        {/* Gradient top border */}
        <div className="h-1 bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500" />

        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
                <PieChartIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  Detalhamento de Despesas
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Distribuição por categoria
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Monthly trend toggle */}
              <div className="flex items-center bg-muted/50 rounded-lg p-0.5">
                <Button
                  variant={showCurrentMonth ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-[11px] px-2.5"
                  onClick={() => setShowCurrentMonth(true)}
                >
                  Mês Atual
                </Button>
                <Button
                  variant={!showCurrentMonth ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-[11px] px-2.5"
                  onClick={() => setShowCurrentMonth(false)}
                >
                  6 Meses
                </Button>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={fetchData}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* ═══════════════════════════════════════════════════════════
              DONUT CHART
          ═══════════════════════════════════════════════════════════ */}
          <motion.div variants={item} className="flex flex-col items-center">
            <div className="relative w-full max-w-[320px] h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={75}
                    outerRadius={130}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    strokeWidth={0}
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
                  <RechartsTooltip
                    formatter={(value: number, name: string) => [
                      currencyFmt(value),
                      name,
                    ]}
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: 'var(--card-foreground)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Center text inside donut */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                  Total Gasto
                </p>
                <motion.p
                  key={data.totalExpense}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="text-xl font-bold mt-0.5"
                >
                  {currencyFmt(data.totalExpense)}
                </motion.p>
                {activeSlice && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="flex items-center gap-1.5 mt-1"
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{ backgroundColor: activeSlice.color }}
                    />
                    <span className="text-xs font-medium text-muted-foreground">
                      {activeSlice.name} ({activeSlice.percentage.toFixed(1)}%)
                    </span>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>

          {/* ═══════════════════════════════════════════════════════════
              CATEGORY DETAIL LIST
          ═══════════════════════════════════════════════════════════ */}
          <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
            {data.categories.slice(0, 8).map((cat, idx) => {
              const isExpanded = expandedCategory === cat.categoryId;
              const isHighlighted =
                activeCategory === cat.categoryId || activeCategory === null;

              return (
                <motion.div
                  key={cat.categoryId}
                  variants={item}
                  whileHover={cardHover}
                  className="rounded-xl border bg-card transition-all"
                >
                  {/* Category row */}
                  <button
                    type="button"
                    className="flex items-center gap-3 w-full p-3.5 text-left"
                    onClick={() =>
                      setExpandedCategory(isExpanded ? null : cat.categoryId)
                    }
                    onMouseEnter={() => setActiveCategory(cat.categoryId)}
                    onMouseLeave={() => setActiveCategory(null)}
                  >
                    {/* Color dot */}
                    <div
                      className="w-3.5 h-3.5 rounded-sm shrink-0 transition-transform"
                      style={{
                        backgroundColor: cat.categoryColor,
                        transform: isHighlighted ? 'scale(1.2)' : 'scale(0.9)',
                        opacity: isHighlighted ? 1 : 0.4,
                      }}
                    />

                    {/* Name & counts */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {cat.categoryName}
                        </span>
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 h-4 shrink-0"
                        >
                          {cat.transactionCount + cat.purchaseCount}x
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {/* Percentage bar */}
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[120px]">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max(cat.percentage, 1)}%` }}
                            transition={{
                              duration: 0.7,
                              delay: 0.15 + idx * 0.06,
                              ease: 'easeOut',
                            }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: cat.categoryColor }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Amount & percentage */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {currencyFmt(cat.total)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {cat.percentage.toFixed(1)}%
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Expanded monthly breakdown */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        variants={expandedContent}
                        initial="hidden"
                        animate="show"
                        exit="exit"
                        className="overflow-hidden"
                      >
                        <div className="px-3.5 pb-3.5 pt-0">
                          <div className="border-t border-border/50 pt-3">
                            <p className="text-[11px] text-muted-foreground font-medium mb-2 flex items-center gap-1.5">
                              <TrendingDown className="w-3 h-3" />
                              Tendência mensal
                            </p>
                            <div className="h-28">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={data.monthlyData.map((m) => ({
                                    month: m.month,
                                    valor:
                                      m.total *
                                      (cat.percentage / 100),
                                  }))}
                                  barCategoryGap="25%"
                                >
                                  <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="var(--border)"
                                    vertical={false}
                                  />
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
                                    tickFormatter={shortCurrency}
                                    width={40}
                                  />
                                  <RechartsTooltip
                                    formatter={(value: number) => [
                                      currencyFmt(value),
                                      cat.categoryName,
                                    ]}
                                    contentStyle={{
                                      backgroundColor:
                                        'var(--card)',
                                      border:
                                        '1px solid var(--border)',
                                      borderRadius: '12px',
                                      fontSize: '11px',
                                      color: 'var(--card-foreground)',
                                      boxShadow:
                                        '0 4px 12px rgba(0,0,0,0.15)',
                                    }}
                                  />
                                  <Bar
                                    dataKey="valor"
                                    fill={cat.categoryColor}
                                    radius={[3, 3, 0, 0]}
                                  />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}

            {/* "Outros" row if there are more than 8 categories */}
            {data.categories.length > 8 && (
              <motion.div
                variants={item}
                whileHover={cardHover}
                className="rounded-xl border bg-card p-3.5 flex items-center gap-3"
              >
                <div className="w-3.5 h-3.5 rounded-sm shrink-0 bg-slate-400" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-muted-foreground">
                    Outros ({data.categories.length - 8} categorias)
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-muted-foreground">
                    {currencyFmt(
                      data.categories.slice(8).reduce((s, c) => s + c.total, 0)
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {data.categories
                      .slice(8)
                      .reduce((s, c) => s + c.percentage, 0)
                      .toFixed(1)}
                    %
                  </p>
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* ═══════════════════════════════════════════════════════════
              TOP 3 SUMMARY ROW
          ═══════════════════════════════════════════════════════════ */}
          {top3.length > 0 && (
            <motion.div
              variants={item}
              initial="hidden"
              animate="show"
              className="rounded-xl bg-gradient-to-r from-amber-500/5 via-amber-500/10 to-amber-500/5 border border-amber-500/20 p-4"
            >
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-3">
                Top Categorias
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {top3.map((cat, idx) => {
                  const TrophyIcon = trophyIcons[idx];
                  const trophyColor = trophyColors[idx];
                  return (
                    <motion.div
                      key={cat.categoryId}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 + idx * 0.1 }}
                      className="flex items-center gap-3 bg-background/60 rounded-lg p-3"
                    >
                      <TrophyIcon
                        className={`w-6 h-6 ${trophyColor} shrink-0`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{
                              backgroundColor: cat.categoryColor,
                            }}
                          />
                          <span className="text-sm font-medium truncate">
                            {cat.categoryName}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-xs font-semibold">
                            {currencyFmt(cat.total)}
                          </span>
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 h-4"
                          >
                            {cat.percentage.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
