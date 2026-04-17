import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/quick-stats — compact financial summary with sparkline data
export async function GET() {
  try {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Date range: last 6 months (including current)
    const rangeStart = new Date(currentYear, currentMonth - 5, 1);
    const rangeEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    // Run all queries in parallel
    const [
      accounts,
      cards,
      investments,
      savingsGoals,
      allTransactions,
      allPurchases,
    ] = await Promise.all([
      // Active accounts
      db.account.findMany({
        where: { isActive: true },
        select: { balance: true },
      }),

      // Active cards
      db.card.findMany({
        where: { isActive: true },
        select: { currentBalance: true, creditLimit: true },
      }),

      // Active investments
      db.investment.findMany({
        where: { isActive: true },
        select: { currentBalance: true },
      }),

      // Savings goals
      db.savingsGoal.findMany({
        select: { currentAmount: true },
      }),

      // Transactions in last 6 months
      db.transaction.findMany({
        where: {
          type: { in: ["INCOME", "EXPENSE"] },
          date: { gte: rangeStart, lte: rangeEnd },
        },
        select: { type: true, amount: true, date: true },
      }),

      // Purchases in last 6 months
      db.purchase.findMany({
        where: {
          date: { gte: rangeStart, lte: rangeEnd },
        },
        select: { totalAmount: true, date: true },
      }),
    ]);

    // --- Current totals ---
    const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
    const cardDebt = cards.reduce((sum, c) => sum + c.currentBalance, 0);
    const totalCardLimit = cards.reduce((sum, c) => sum + c.creditLimit, 0);
    const totalInvestments = investments.reduce((sum, i) => sum + i.currentBalance, 0);
    const totalSavingsGoals = savingsGoals.reduce((sum, s) => sum + s.currentAmount, 0);
    const netWorth = totalBalance + totalInvestments + totalSavingsGoals - cardDebt;

    // --- Per-month computation (6 months) ---
    const monthlyData: {
      month: string;
      year: number;
      monthIndex: number;
      income: number;
      expense: number;
    }[] = [];

    for (let i = 0; i < 6; i++) {
      const mStart = new Date(currentYear, currentMonth - 5 + i, 1);
      const mEnd = new Date(currentYear, currentMonth - 5 + i + 1, 0, 23, 59, 59, 999);

      const txnsInMonth = allTransactions.filter(
        (t) => t.date >= mStart && t.date <= mEnd
      );
      const purchasesInMonth = allPurchases.filter(
        (p) => p.date >= mStart && p.date <= mEnd
      );

      const income = txnsInMonth
        .filter((t) => t.type === "INCOME")
        .reduce((s, t) => s + t.amount, 0);

      const txnExpense = txnsInMonth
        .filter((t) => t.type === "EXPENSE")
        .reduce((s, t) => s + t.amount, 0);

      const purchaseExpense = purchasesInMonth.reduce(
        (s, p) => s + p.totalAmount,
        0
      );

      monthlyData.push({
        month: mStart.toLocaleString("pt-BR", { month: "short" }),
        year: mStart.getFullYear(),
        monthIndex: i,
        income,
        expense: txnExpense + purchaseExpense,
      });
    }

    // Current month = last entry
    const currentMonthData = monthlyData[5];
    const lastMonthData = monthlyData[4];
    const monthlyIncome = currentMonthData.income;
    const monthlyExpense = currentMonthData.expense;
    const monthlySavings = monthlyIncome - monthlyExpense;
    const savingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;

    // --- Sparklines ---
    // Balance: net worth approximation per month (income - expense cumulative is the trend)
    // We approximate balance trend by cumulative net of each month
    let runningBalance = netWorth - monthlySavings; // approximate starting balance
    const balanceSparkline = monthlyData.map((m) => {
      runningBalance += m.income - m.expense;
      return Math.round(runningBalance * 100) / 100;
    });

    const incomeSparkline = monthlyData.map((m) =>
      Math.round(m.income * 100) / 100
    );
    const expenseSparkline = monthlyData.map((m) =>
      Math.round(m.expense * 100) / 100
    );

    // --- Changes (% vs last month) ---
    const incomeVsLastMonth =
      lastMonthData.income > 0
        ? ((currentMonthData.income - lastMonthData.income) / lastMonthData.income) * 100
        : currentMonthData.income > 0
        ? 100
        : 0;

    const expenseVsLastMonth =
      lastMonthData.expense > 0
        ? ((currentMonthData.expense - lastMonthData.expense) / lastMonthData.expense) * 100
        : currentMonthData.expense > 0
        ? 100
        : 0;

    const lastMonthSavings = lastMonthData.income - lastMonthData.expense;
    const savingsVsLastMonth =
      lastMonthSavings !== 0
        ? ((monthlySavings - lastMonthSavings) / Math.abs(lastMonthSavings)) * 100
        : monthlySavings > 0
        ? 100
        : 0;

    return NextResponse.json({
      current: {
        totalBalance: Math.round(totalBalance * 100) / 100,
        cardDebt: Math.round(cardDebt * 100) / 100,
        investments: Math.round(totalInvestments * 100) / 100,
        savingsGoals: Math.round(totalSavingsGoals * 100) / 100,
        netWorth: Math.round(netWorth * 100) / 100,
        monthlyIncome: Math.round(monthlyIncome * 100) / 100,
        monthlyExpense: Math.round(monthlyExpense * 100) / 100,
        monthlySavings: Math.round(monthlySavings * 100) / 100,
        savingsRate: Math.round(savingsRate * 10) / 10,
      },
      sparklines: {
        balance: balanceSparkline,
        income: incomeSparkline,
        expense: expenseSparkline,
      },
      changes: {
        incomeVsLastMonth: Math.round(incomeVsLastMonth * 10) / 10,
        expenseVsLastMonth: Math.round(expenseVsLastMonth * 10) / 10,
        savingsVsLastMonth: Math.round(savingsVsLastMonth * 10) / 10,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar resumo rápido:", error);
    return NextResponse.json(
      { error: "Falha ao buscar dados do resumo rápido" },
      { status: 500 }
    );
  }
}
