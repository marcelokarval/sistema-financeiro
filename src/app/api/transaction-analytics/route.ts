import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  apiErrorResponse,
  formatServerMonthLabel,
  formatServerWeekdayShort,
  resolveRequestLocale,
  toMonthKey,
  translateApiMessage,
} from '@/lib/server-i18n';

export async function GET(request?: Request | NextRequest) {
  const locale = resolveRequestLocale(request);
  const uncategorizedLabel = translateApiMessage(locale, 'common.uncategorizedTitle');
  try {
    const { searchParams } = new URL(request?.url ?? 'http://localhost');
    const monthsParam = searchParams.get('months');
    const months = Math.min(Math.max(parseInt(monthsParam || '6', 10) || 6, 1), 12);
    const typeFilter = searchParams.get('type') || 'ALL';

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const startDate = new Date(currentYear, currentMonth - (months - 1), 1);
    const endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    // Build where clause for type filter
    const typeWhere: { type?: string } = {};
    if (typeFilter !== 'ALL') {
      typeWhere.type = typeFilter;
    }

    // Fetch transactions with category in date range
    const transactions = await db.transaction.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        ...typeWhere,
      },
      include: {
        category: {
          select: { id: true, name: true, color: true },
        },
      },
      orderBy: { date: 'desc' },
    });

    const incomeTxs = transactions.filter((t) => t.type === 'INCOME');
    const expenseTxs = transactions.filter((t) => t.type === 'EXPENSE');

    const totalIncome = incomeTxs.reduce((s, t) => s + t.amount, 0);
    const totalExpense = expenseTxs.reduce((s, t) => s + t.amount, 0);
    const totalTransactions = transactions.length;
    const averagePerTransaction = totalTransactions > 0
      ? transactions.reduce((s, t) => s + t.amount, 0) / totalTransactions
      : 0;

    // Highest and lowest transactions
    const sortedByAmount = [...transactions].sort((a, b) => b.amount - a.amount);
    const highestTx = sortedByAmount[0] || null;
    const lowestTx = sortedByAmount[sortedByAmount.length - 1] || null;

    const formatTx = (t: NonNullable<typeof highestTx>) => ({
      description: t.description,
      amount: t.amount,
      date: t.date.toISOString(),
      categoryName: t.category?.name || uncategorizedLabel,
      type: t.type,
    });

    // Most frequent category
    const categoryCounts = new Map<string, { name: string; color: string; count: number; total: number }>();
    for (const t of transactions) {
      const catId = t.category?.id || 'uncategorized';
      const catName = t.category?.name || uncategorizedLabel;
      const catColor = t.category?.color || '#6b7280';
      if (!categoryCounts.has(catId)) {
        categoryCounts.set(catId, { name: catName, color: catColor, count: 0, total: 0 });
      }
      const entry = categoryCounts.get(catId)!;
      entry.count += 1;
      entry.total += t.amount;
    }
    const sortedCategories = Array.from(categoryCounts.values()).sort((a, b) => b.count - a.count);
    const mostFrequentCategory = sortedCategories[0] || null;

    // Weekday breakdown (Dom=0 .. Sáb=6)
    const weekdayBreakdown = Array.from({ length: 7 }, (_, idx) => {
      const day = formatServerWeekdayShort(idx, locale);
      const dayTxs = transactions.filter((t) => t.date.getDay() === idx);
      const dayIncome = dayTxs.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
      const dayExpense = dayTxs.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
      return {
        day,
        dayIndex: idx,
        income: dayIncome,
        expense: dayExpense,
        count: dayTxs.length,
      };
    });

    // Monthly comparison
    const monthlyComparison: {
      month: string;
      monthKey: string;
      income: number;
      expense: number;
      net: number;
      count: number;
      avgPerTx: number;
    }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const mStart = new Date(currentYear, currentMonth - i, 1);
      const mEnd = new Date(currentYear, currentMonth - i + 1, 0, 23, 59, 59, 999);
      const mLabel = formatServerMonthLabel(mStart, locale);

      const mTxs = transactions.filter((t) => t.date >= mStart && t.date <= mEnd);
      const mIncome = mTxs.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
      const mExpense = mTxs.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);

      monthlyComparison.push({
        month: mLabel,
        monthKey: toMonthKey(mStart),
        income: mIncome,
        expense: mExpense,
        net: mIncome - mExpense,
        count: mTxs.length,
        avgPerTx: mTxs.length > 0 ? mTxs.reduce((s, t) => s + t.amount, 0) / mTxs.length : 0,
      });
    }

    // Top 5 merchants (by total amount in expense transactions)
    const merchantCounts = new Map<string, { name: string; count: number; total: number; category: string }>();
    for (const t of expenseTxs) {
      const name = t.description.trim();
      if (!merchantCounts.has(name)) {
        merchantCounts.set(name, { name, count: 0, total: 0, category: t.category?.name || uncategorizedLabel });
      }
      const entry = merchantCounts.get(name)!;
      entry.count += 1;
      entry.total += t.amount;
    }
    const topMerchants = Array.from(merchantCounts.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Amount distribution (5 ranges)
    const ranges = [
      { range: 'R$0-50', min: 0, max: 50 },
      { range: 'R$50-200', min: 50, max: 200 },
      { range: 'R$200-500', min: 200, max: 500 },
      { range: 'R$500-1k', min: 500, max: 1000 },
      { range: 'R$1k+', min: 1000, max: Infinity },
    ];

    const amountDistribution = ranges.map((r) => {
      const count = transactions.filter((t) => t.amount >= r.min && (r.max === Infinity ? true : t.amount < r.max)).length;
      return {
        range: r.range,
        count,
        percentage: totalTransactions > 0 ? (count / totalTransactions) * 100 : 0,
      };
    });

    // Daily pattern (transactions by time of day, 2h blocks)
    const hourlyBlocks: { hour: string; count: number }[] = [];
    for (let h = 0; h < 24; h += 2) {
      const label = `${String(h).padStart(2, '0')}:00`;
      const count = transactions.filter((t) => {
        const hour = t.date.getHours();
        return hour >= h && hour < h + 2;
      }).length;
      hourlyBlocks.push({ hour: label, count });
    }

    return NextResponse.json({
      overview: {
        totalTransactions,
        totalIncome,
        totalExpense,
        averagePerTransaction,
        highestTransaction: highestTx ? formatTx(highestTx) : null,
        lowestTransaction: lowestTx ? formatTx(lowestTx) : null,
        mostFrequentCategory: mostFrequentCategory
          ? {
              categoryName: mostFrequentCategory.name,
              categoryColor: mostFrequentCategory.color,
              count: mostFrequentCategory.count,
              total: mostFrequentCategory.total,
            }
          : null,
        weekdayBreakdown,
      },
      monthlyComparison,
      topMerchants,
      amountDistribution,
      dailyPattern: hourlyBlocks,
    });
  } catch (error) {
    console.error('Erro ao buscar análise de transações:', error);
    return apiErrorResponse(
      'INTERNAL_ERROR',
      translateApiMessage(locale, 'analytics.transactionAnalyticsFailed'),
      500
    );
  }
}
