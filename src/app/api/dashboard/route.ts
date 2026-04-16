import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

// GET /api/dashboard - Aggregated dashboard data
export async function GET() {
  try {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Start and end of current month
    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

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

      // 3. Current month income transactions
      db.transaction.aggregate({
        where: {
          type: "INCOME",
          date: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amount: true },
      }),

      // 4. Current month expense transactions
      db.transaction.aggregate({
        where: {
          type: "EXPENSE",
          date: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amount: true },
      }),

      // 5. Current month purchases (expenses)
      db.purchase.aggregate({
        where: {
          date: { gte: monthStart, lte: monthEnd },
        },
        _sum: { totalAmount: true },
      }),

      // 6. Recent 10 transactions
      db.transaction.findMany({
        take: 10,
        orderBy: { date: "desc" },
        include: {
          category: true,
          account: true,
          card: true,
        },
      }),

      // 7. Recent 10 purchases (now includes category)
      db.purchase.findMany({
        take: 10,
        orderBy: { date: "desc" },
        include: {
          items: { orderBy: { createdAt: "asc" } },
          card: true,
          category: true,
        },
      }),

      // 8. All transactions for monthly trend (last 6 months)
      db.transaction.findMany({
        where: {
          date: {
            gte: new Date(currentYear, currentMonth - 5, 1),
          },
        },
        select: {
          type: true,
          amount: true,
          date: true,
        },
      }),

      // 9. Current month expense transactions grouped by category
      db.transaction.findMany({
        where: {
          type: "EXPENSE",
          date: { gte: monthStart, lte: monthEnd },
          categoryId: { not: null },
        },
        select: {
          categoryId: true,
          amount: true,
        },
      }),

      // 10. All purchases for monthly trend (last 6 months)
      db.purchase.findMany({
        where: {
          date: {
            gte: new Date(currentYear, currentMonth - 5, 1),
          },
        },
        select: {
          totalAmount: true,
          date: true,
        },
      }),

      // 11. Current month purchases grouped by category
      db.purchase.findMany({
        where: {
          date: { gte: monthStart, lte: monthEnd },
          categoryId: { not: null },
        },
        select: {
          categoryId: true,
          totalAmount: true,
        },
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

    // Monthly trend - last 6 months (includes both transactions and purchases)
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const trendMonth = new Date(currentYear, currentMonth - i, 1);
      const trendMonthEnd = new Date(currentYear, currentMonth - i + 1, 0, 23, 59, 59, 999);
      const monthLabel = trendMonth.toLocaleString("pt-BR", {
        month: "short",
        year: "2-digit",
      });

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
        income,
        expense: txnExpense + purchaseExpense,
      });
    }

    // Expense by category - current month (includes both transactions and purchases)
    const allCategoryIds = [
      ...new Set([
        ...categoryExpenseTransactions.map((t) => t.categoryId!),
        ...categoryExpensePurchases.map((p) => p.categoryId!),
      ]),
    ];
    const expenseByCategory = [];

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
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
