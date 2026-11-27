import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";
import { parseCivilDateEnd, parseCivilDateStart } from "@/lib/api-validation";
import {
  apiErrorResponse,
  formatServerMonthLabel,
  resolveRequestLocale,
  toMonthKey,
  translateApiMessage,
} from "@/lib/server-i18n";

// GET /api/dashboard - Aggregated dashboard data with optional date range filter
export async function GET(request?: NextRequest) {
  const locale = resolveRequestLocale(request);
  try {
    const searchParams =
      request?.nextUrl?.searchParams ??
      new URL(request?.url ?? "http://localhost").searchParams;
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Determine date range
    let rangeStart: Date;
    let rangeEnd: Date;
    let isCustomRange = false;

    if (fromParam !== null || toParam !== null) {
      const parsedStart = fromParam !== null ? parseCivilDateStart(fromParam) : null;
      const parsedEnd = toParam !== null ? parseCivilDateEnd(toParam) : null;

      if ((fromParam !== null && !parsedStart) || (toParam !== null && !parsedEnd)) {
        return apiErrorResponse(
          "INVALID_DATE_FORMAT",
          translateApiMessage(locale, "errors.invalidDateFormat"),
          400
        );
      }

      if (parsedStart && parsedEnd) {
        if (parsedStart > parsedEnd) {
          return apiErrorResponse(
            "INVALID_DATE_RANGE",
            translateApiMessage(locale, "errors.invalidDateRange"),
            400
          );
        }
        rangeStart = parsedStart;
        rangeEnd = parsedEnd;
      } else if (parsedStart) {
        rangeStart = parsedStart;
        rangeEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
      } else {
        rangeStart = new Date(currentYear, currentMonth, 1);
        rangeEnd = parsedEnd!;
      }
      isCustomRange = true;
    } else {
      // Default: current month
      rangeStart = new Date(currentYear, currentMonth, 1);
      rangeEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
    }

    // For monthly trend, determine how far back to look
    // If custom range, calculate the number of months in the range and show those months
    const monthsDiff = (rangeEnd.getFullYear() - rangeStart.getFullYear()) * 12
      + (rangeEnd.getMonth() - rangeStart.getMonth());
    const trendMonths = Math.max(monthsDiff + 1, 1); // At least 1 month
    const trendStart = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);

    // Run all queries in parallel for performance
    const [
      accounts,
      cards,
      monthIncomeTransactions,
      monthExpenseTransactions,
      monthPurchases,
      recentTransactions,
      recentPurchases,
      monthlyTransactions,
      categoryExpenseTransactions,
      monthlyPurchases,
      categoryExpensePurchases,
      allBudgetGoals,
    ] = await Promise.all([
      // 1. All accounts for totalBalance and accountBalances
      db.account.findMany({
        where: { isActive: true },
        select: { id: true, name: true, color: true, balance: true },
      }),

      // 2. All cards for totalCardBalance and totalCardLimit
      db.card.findMany({
        where: { isActive: true },
        select: {
          id: true,
          creditLimit: true,
          currentBalance: true,
        },
      }),

      // 3. Income transactions in date range
      db.transaction.aggregate({
        where: {
          type: "INCOME",
          date: { gte: rangeStart, lte: rangeEnd },
        },
        _sum: { amount: true },
      }),

      // 4. Expense transactions in date range
      db.transaction.aggregate({
        where: {
          type: "EXPENSE",
          date: { gte: rangeStart, lte: rangeEnd },
        },
        _sum: { amount: true },
      }),

      // 5. Purchases in date range
      db.purchase.aggregate({
        where: {
          date: { gte: rangeStart, lte: rangeEnd },
        },
        _sum: { totalAmount: true },
      }),

      // 6. Recent 10 transactions (filtered by date range if custom)
      db.transaction.findMany({
        take: 10,
        orderBy: { date: "desc" },
        where: isCustomRange ? { date: { gte: rangeStart, lte: rangeEnd } } : undefined,
        include: {
          category: true,
          account: true,
          card: true,
        },
      }),

      // 7. Recent 10 purchases (filtered by date range if custom)
      db.purchase.findMany({
        take: 10,
        orderBy: { date: "desc" },
        where: isCustomRange ? { date: { gte: rangeStart, lte: rangeEnd } } : undefined,
        include: {
          items: { orderBy: { createdAt: "asc" } },
          card: true,
          category: true,
        },
      }),

      // 8. Transactions for monthly trend (from trendStart to rangeEnd)
      db.transaction.findMany({
        where: {
          date: {
            gte: trendStart,
            lte: rangeEnd,
          },
        },
        select: {
          type: true,
          amount: true,
          date: true,
        },
      }),

      // 9. Expense transactions grouped by category in date range
      db.transaction.findMany({
        where: {
          type: "EXPENSE",
          date: { gte: rangeStart, lte: rangeEnd },
          categoryId: { not: null },
        },
        select: {
          categoryId: true,
          amount: true,
        },
      }),

      // 10. Purchases for monthly trend (from trendStart to rangeEnd)
      db.purchase.findMany({
        where: {
          date: {
            gte: trendStart,
            lte: rangeEnd,
          },
        },
        select: {
          totalAmount: true,
          date: true,
        },
      }),

      // 11. Purchases grouped by category in date range
      db.purchase.findMany({
        where: {
          date: { gte: rangeStart, lte: rangeEnd },
          categoryId: { not: null },
        },
        select: {
          categoryId: true,
          totalAmount: true,
        },
      }),

      // 12. All budget goals with category
      db.budgetGoal.findMany({
        include: { category: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Calculate totals
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const totalCardBalance = cards.reduce((sum, card) => sum + card.currentBalance, 0);
    const totalCardLimit = cards.reduce((sum, card) => sum + card.creditLimit, 0);
    const monthIncome = monthIncomeTransactions._sum.amount || 0;
    const monthExpense = (monthExpenseTransactions._sum.amount || 0) + (monthPurchases._sum.totalAmount || 0);

    // Account balances
    const accountBalances = accounts.map((acc) => ({
      accountId: acc.id,
      accountName: acc.name,
      accountColor: acc.color,
      balance: acc.balance,
    }));

    // Monthly trend - trim leading empty months for long ranges (> 12 months) while preserving full totals
    let effectiveTrendStart = trendStart;
    let effectiveTrendMonths = trendMonths;
    if (trendMonths > 12) {
      const activityDates = [
        ...monthlyTransactions.map((t) => t.date),
        ...monthlyPurchases.map((p) => p.date),
      ];
      if (activityDates.length === 0) {
        effectiveTrendStart = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);
        effectiveTrendMonths = 1;
      } else {
        let earliest = activityDates[0];
        for (const d of activityDates) {
          if (d < earliest) earliest = d;
        }
        const firstActiveMonth = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
        effectiveTrendStart = firstActiveMonth > trendStart ? firstActiveMonth : trendStart;
        const activeMonthsDiff =
          (rangeEnd.getFullYear() - effectiveTrendStart.getFullYear()) * 12 +
          (rangeEnd.getMonth() - effectiveTrendStart.getMonth());
        effectiveTrendMonths = Math.max(activeMonthsDiff + 1, 1);
      }
    }

    // Monthly trend - iterate through each month in the effective trend range
    const monthlyTrend: {
      month: string;
      monthKey: string;
      income: number;
      expense: number;
    }[] = [];
    for (let i = 0; i < effectiveTrendMonths; i++) {
      const trendMonth = new Date(effectiveTrendStart.getFullYear(), effectiveTrendStart.getMonth() + i, 1);
      const trendMonthEnd = new Date(effectiveTrendStart.getFullYear(), effectiveTrendStart.getMonth() + i + 1, 0, 23, 59, 59, 999);
      const monthLabel = formatServerMonthLabel(trendMonth, locale);

      const monthTxns = monthlyTransactions.filter(
        (t) => t.date >= trendMonth && t.date <= trendMonthEnd
      );

      const monthPurchasesInPeriod = monthlyPurchases.filter(
        (p) => p.date >= trendMonth && p.date <= trendMonthEnd
      );

      const income = monthTxns
        .filter((t) => t.type === "INCOME")
        .reduce((sum, t) => sum + t.amount, 0);

      const txnExpense = monthTxns
        .filter((t) => t.type === "EXPENSE")
        .reduce((sum, t) => sum + t.amount, 0);

      const purchaseExpense = monthPurchasesInPeriod.reduce(
        (sum, p) => sum + p.totalAmount,
        0
      );

      monthlyTrend.push({
        month: monthLabel,
        monthKey: toMonthKey(trendMonth),
        income,
        expense: txnExpense + purchaseExpense,
      });
    }

    // Expense by category - within date range (includes both transactions and purchases)
    const allCategoryIds = [
      ...new Set([
        ...categoryExpenseTransactions.map((t) => t.categoryId!),
        ...categoryExpensePurchases.map((p) => p.categoryId!),
      ]),
    ];
    const expenseByCategory: {
      categoryId: string;
      categoryName: string;
      categoryColor: string;
      total: number;
    }[] = [];

    if (allCategoryIds.length > 0) {
      const categories = await db.category.findMany({
        where: { id: { in: allCategoryIds } },
        select: { id: true, name: true, color: true },
      });

      for (const catId of allCategoryIds) {
        const cat = categories.find((c) => c.id === catId);
        if (!cat) continue;

        const txnTotal = categoryExpenseTransactions
          .filter((t) => t.categoryId === catId)
          .reduce((sum, t) => sum + t.amount, 0);

        const purchaseTotal = categoryExpensePurchases
          .filter((p) => p.categoryId === catId)
          .reduce((sum, p) => sum + p.totalAmount, 0);

        expenseByCategory.push({
          categoryId: cat.id,
          categoryName: cat.name,
          categoryColor: cat.color,
          total: txnTotal + purchaseTotal,
        });
      }

      // Sort by total descending
      expenseByCategory.sort((a, b) => b.total - a.total);
    }

    // Budget goal stats
    const activeGoals = allBudgetGoals.filter((g) => !g.isCompleted).length;
    const completedGoals = allBudgetGoals.filter((g) => g.isCompleted).length;
    const budgetGoals = allBudgetGoals.slice(0, 3).map((g) => ({
      id: g.id,
      name: g.name,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      isCompleted: g.isCompleted,
      category: g.category ? { id: g.category.id, name: g.category.name, color: g.category.color } : null,
    }));

    return NextResponse.json({
      totalBalance,
      totalCardBalance,
      totalCardLimit,
      monthIncome,
      monthExpense,
      recentTransactions,
      recentPurchases,
      expenseByCategory,
      monthlyTrend,
      accountBalances,
      activeGoals,
      completedGoals,
      budgetGoals,
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "analytics.dashboardFetchFailed"),
      500
    );
  }
}
