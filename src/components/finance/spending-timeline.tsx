'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

// ─── Helpers ───────────────────────────────────────────────────────
const currencyFmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const shortCurrency = (v: number) => {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v.toFixed(0);
};

const formatDateHeader = (dateStr: string) => {
  try {
    const d = parseISO(dateStr);
    if (isToday(d)) return 'Hoje';
    if (isYesterday(d)) return 'Ontem';
    return format(d, "EEE, dd 'de' MMMM", { locale: ptBR });
  } catch {
    return dateStr;
  }
};

// ─── Types ─────────────────────────────────────────────────────────
interface TimelineItem {
  type: 'transaction' | 'purchase';
  description: string;
  amount: number;
  category: string;
}

interface TimelineDay {
  date: string;
  income: number;
  expense: number;
  net: number;
  count: number;
  runningBalance: number;
  items: TimelineItem[];
}

// ─── Animation Variants ────────────────────────────────────────────
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const barContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.01 } },
};

const barItem = {
  hidden: { scaleY: 0 },
  show: { scaleY: 1, transition: { duration: 0.4, ease: 'easeOut' } },
};

const FILTER_OPTIONS = [
  { label: '7 dias', days: 7 },
  { label: '15 dias', days: 15 },
  { label: '30 dias', days: 30 },
] as const;

// ─── Main Component ────────────────────────────────────────────────
export function SpendingTimeline() {
  const [data, setData] = useState<TimelineDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDays, setActiveDays] = useState(30);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const fetchTimeline = useCallback(async (days: number) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/timeline?days=${days}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error('Erro ao buscar linha do tempo:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTimeline(activeDays);
  }, [activeDays, fetchTimeline]);

  // ─── Computed values ─────────────────────────────────────────────
  const totalIncome = data.reduce((sum, d) => sum + d.income, 0);
  const totalExpense = data.reduce((sum, d) => sum + d.expense, 0);
  const daysWithActivity = data.filter((d) => d.count > 0);
  const maxAbsNet = Math.max(
    ...data.map((d) => Math.abs(d.net)),
    1
  );

  // Reversed data for the bar chart (oldest first)
  const chartData = [...data].reverse();

  // ─── Loading Skeleton ─────────────────────────────────────────────
  if (loading) {
    return (
      <Card className="border-0 shadow-md overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-3 w-52" />
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-7 w-20 rounded-full" />
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Bar chart skeleton */}
          <Skeleton className="h-40 w-full rounded-xl" />
          {/* Day rows */}
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
          {/* Running balance skeleton */}
          <Skeleton className="h-14 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
    >
      <Card className="border-0 shadow-md overflow-hidden card-glow">
        {/* Gradient top border */}
        <div className="h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />

        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <CalendarDays className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  Linha do Tempo
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Fluxo de caixa diário · {daysWithActivity.length} dias com atividade
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  onClick={() => setActiveDays(opt.days)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 whitespace-nowrap ${
                    activeDays === opt.days
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 ml-1"
                onClick={() => fetchTimeline(activeDays)}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ═══════════════════════════════════════════════════════════
              MINI BAR CHART
          ═══════════════════════════════════════════════════════════ */}
          {chartData.length > 0 && (
            <motion.div variants={item}>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="flex items-end justify-center gap-[3px] sm:gap-1 h-28">
                  <motion.div
                    variants={barContainer}
                    initial="hidden"
                    animate="show"
                    className="flex items-end justify-center gap-[3px] sm:gap-1 h-full w-full"
                  >
                    {chartData.map((day) => {
                      const height = maxAbsNet > 0
                        ? Math.max(4, (Math.abs(day.net) / maxAbsNet) * 100)
                        : 4;
                      const isPositive = day.net >= 0;
                      const color = day.count === 0
                        ? 'bg-muted-foreground/15'
                        : isPositive
                          ? 'bg-emerald-500'
                          : 'bg-rose-500';

                      return (
                        <motion.div
                          key={day.date}
                          variants={barItem}
                          style={{ height: `${height}%`, minHeight: '3px' }}
                          className={`flex-1 max-w-[14px] rounded-t-sm ${color} transition-colors duration-200`}
                          title={`${day.date}: ${currencyFmt(day.net)}`}
                        />
                      );
                    })}
                  </motion.div>
                </div>
                {/* Legend */}
                <div className="flex items-center justify-center gap-4 mt-2.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                    <span className="text-[10px] text-muted-foreground">Positivo</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                    <span className="text-[10px] text-muted-foreground">Negativo</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-muted-foreground/15" />
                    <span className="text-[10px] text-muted-foreground">Sem atividade</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              TIMELINE LIST
          ═══════════════════════════════════════════════════════════ */}
          <ScrollArea className="max-h-[420px]">
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="space-y-2 pr-2"
            >
              {data.map((day) => {
                const isExpanded = expandedDay === day.date;
                const hasItems = day.count > 0;
                const isNetPositive = day.net >= 0;

                return (
                  <motion.div
                    key={day.date}
                    variants={item}
                    layout
                    className="rounded-xl border border-border/50 bg-card overflow-hidden"
                  >
                    {/* Day header row */}
                    <button
                      onClick={() => setExpandedDay(isExpanded ? null : day.date)}
                      className="flex items-center justify-between w-full p-3 sm:p-4 hover:bg-accent/30 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Day indicator dot */}
                        <div
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            !hasItems
                              ? 'bg-muted-foreground/20'
                              : isNetPositive
                                ? 'bg-emerald-500'
                                : 'bg-rose-500'
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold capitalize">
                              {formatDateHeader(day.date)}
                            </span>
                            {isToday(parseISO(day.date)) && (
                              <Badge className="text-[9px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20">
                                Atual
                              </Badge>
                            )}
                          </div>
                          {hasItems && (
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-muted-foreground">
                                {day.count} {day.count === 1 ? 'movimento' : 'movimentos'}
                              </span>
                              {day.income > 0 && (
                                <span className="text-[11px] text-emerald-500 font-medium">
                                  +{currencyFmt(day.income)}
                                </span>
                              )}
                              {day.expense > 0 && (
                                <span className="text-[11px] text-rose-500 font-medium">
                                  -{currencyFmt(day.expense)}
                                </span>
                              )}
                            </div>
                          )}
                          {!hasItems && (
                            <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                              Sem movimentações
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        {/* Net amount */}
                        {hasItems && (
                          <div className="text-right">
                            <span
                              className={`text-sm font-bold ${
                                isNetPositive ? 'text-emerald-500' : 'text-rose-500'
                              }`}
                            >
                              {isNetPositive ? '+' : ''}
                              {currencyFmt(day.net)}
                            </span>
                          </div>
                        )}
                        {/* Expand/collapse chevron */}
                        {hasItems && (
                          <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          </motion.div>
                        )}
                      </div>
                    </button>

                    {/* Expanded items */}
                    <AnimatePresence>
                      {isExpanded && hasItems && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-border/40 bg-muted/20">
                            <div className="p-3 sm:p-4 space-y-1.5">
                              {day.items.map((txItem, idx) => {
                                const isIncomeItem = txItem.amount > 0;
                                return (
                                  <motion.div
                                    key={`${day.date}-${idx}`}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.2, delay: idx * 0.04 }}
                                    className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-accent/30 transition-colors"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      {/* Type icon */}
                                      <div
                                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                          txItem.type === 'transaction'
                                            ? isIncomeItem
                                              ? 'bg-emerald-500/10'
                                              : 'bg-rose-500/10'
                                            : 'bg-violet-500/10'
                                        }`}
                                      >
                                        {txItem.type === 'purchase' ? (
                                          <ShoppingBag className="w-4 h-4 text-violet-500" />
                                        ) : isIncomeItem ? (
                                          <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                                        ) : (
                                          <ArrowDownRight className="w-4 h-4 text-rose-500" />
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium truncate">
                                          {txItem.description}
                                        </p>
                                        <Badge
                                          variant="secondary"
                                          className="text-[9px] px-1.5 py-0 h-4 mt-0.5"
                                        >
                                          {txItem.category}
                                        </Badge>
                                      </div>
                                    </div>
                                    <span
                                      className={`text-sm font-bold whitespace-nowrap ml-2 ${
                                        isIncomeItem ? 'text-emerald-500' : 'text-rose-500'
                                      }`}
                                    >
                                      {isIncomeItem ? '+' : ''}
                                      {currencyFmt(txItem.amount)}
                                    </span>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </motion.div>
          </ScrollArea>

          {/* ═══════════════════════════════════════════════════════════
              RUNNING BALANCE FOOTER
          ═══════════════════════════════════════════════════════════ */}
          {data.length > 0 && (
            <motion.div variants={item} initial="hidden" animate="show">
              <div className="rounded-xl border border-border/60 bg-gradient-to-r from-muted/40 to-muted/20 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {data[0].runningBalance >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-rose-500" />
                    )}
                    <span className="text-xs font-semibold text-foreground/80">
                      Saldo acumulado
                    </span>
                  </div>
                  <span
                    className={`text-sm font-bold ${
                      data[0].runningBalance >= 0 ? 'text-emerald-500' : 'text-rose-500'
                    }`}
                  >
                    {data[0].runningBalance >= 0 ? '+' : ''}
                    {currencyFmt(data[0].runningBalance)}
                  </span>
                </div>

                {/* Progress bar showing income vs expense */}
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${totalIncome + totalExpense > 0
                        ? (totalIncome / (totalIncome + totalExpense)) * 100
                        : 50}%`,
                    }}
                    transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                  />
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1.5">
                    <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                    <span className="text-[11px] text-muted-foreground">
                      Receitas: <span className="font-medium text-foreground/70">{currencyFmt(totalIncome)}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ArrowDownRight className="w-3 h-3 text-rose-500" />
                    <span className="text-[11px] text-muted-foreground">
                      Despesas: <span className="font-medium text-foreground/70">{currencyFmt(totalExpense)}</span>
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
