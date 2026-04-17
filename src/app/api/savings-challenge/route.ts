import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/savings-challenge — Compute savings data for gamified challenges
export async function GET() {
  try {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Date boundaries for current month
    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    // Today boundaries
    const todayStart = new Date(currentYear, currentMonth, now.getDate());
    const todayEnd = new Date(currentYear, currentMonth, now.getDate(), 23, 59, 59, 999);

    // Days in current month
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysElapsed = now.getDate(); // 1-indexed, so today = days elapsed
    const daysRemaining = daysInMonth - daysElapsed;

    // Parallel fetch: current month transactions + purchases + today's expenses
    const [
      monthIncomeTxns,
      monthExpenseTxns,
      monthPurchases,
      todayExpenseTxns,
      todayPurchases,
    ] = await Promise.all([
      // Current month INCOME transactions
      db.transaction.aggregate({
        where: { type: "INCOME", date: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
      }),
      // Current month EXPENSE transactions
      db.transaction.aggregate({
        where: { type: "EXPENSE", date: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
      }),
      // Current month purchases (all are expenses)
      db.purchase.aggregate({
        where: { date: { gte: monthStart, lte: monthEnd } },
        _sum: { totalAmount: true },
      }),
      // Today's EXPENSE transactions
      db.transaction.aggregate({
        where: { type: "EXPENSE", date: { gte: todayStart, lte: todayEnd } },
        _sum: { amount: true },
      }),
      // Today's purchases
      db.purchase.aggregate({
        where: { date: { gte: todayStart, lte: todayEnd } },
        _sum: { totalAmount: true },
      }),
    ]);

    const income = monthIncomeTxns._sum.amount || 0;
    const totalExpenses = (monthExpenseTxns._sum.amount || 0) + (monthPurchases._sum.totalAmount || 0);
    const todaySpending = (todayExpenseTxns._sum.amount || 0) + (todayPurchases._sum.totalAmount || 0);

    // Core metrics
    const currentMonthSavings = income - totalExpenses;
    const dailyAverageExpense = daysElapsed > 0 ? totalExpenses / daysElapsed : 0;
    const projectedMonthExpense = dailyAverageExpense * daysInMonth;
    const projectedSavings = income - projectedMonthExpense;
    const savingsRate = income > 0 ? (currentMonthSavings / income) * 100 : 0;

    // --- Challenge targets ---
    // Challenge 1: Spend less today (20% under daily average)
    const dailyTarget = Math.round(dailyAverageExpense * 0.8 * 100) / 100;
    const challenge1Progress = dailyTarget > 0 ? Math.min(todaySpending / dailyTarget * 100, 100) : 0;

    // Challenge 2: Save R$500 this month
    const monthlySavingTarget = 500;
    const challenge2Progress = Math.min(Math.max(currentMonthSavings / monthlySavingTarget * 100, 0), 100);

    // Challenge 3: Keep savings rate above 20%
    const savingsRateTarget = 20;
    const challenge3Progress = Math.min(savingsRate / savingsRateTarget * 100, 100);

    const challengeTargets = [
      {
        id: "daily-spend",
        title: "Gastar menos hoje",
        description: `Fique abaixo de ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(dailyTarget)} no dia`,
        current: todaySpending,
        target: dailyTarget,
        progress: challenge1Progress,
        unit: "currency",
      },
      {
        id: "monthly-save",
        title: "Economizar R$500 este mês",
        description: `Já economizou ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Math.max(currentMonthSavings, 0))} de R$500,00`,
        current: Math.max(currentMonthSavings, 0),
        target: monthlySavingTarget,
        progress: challenge2Progress,
        unit: "currency",
      },
      {
        id: "savings-rate",
        title: "Taxa de poupança acima de 20%",
        description: `Taxa atual: ${savingsRate.toFixed(1)}% — mantenha o ritmo!`,
        current: savingsRate,
        target: savingsRateTarget,
        progress: challenge3Progress,
        unit: "percent",
      },
    ];

    return NextResponse.json({
      currentMonthSavings,
      dailyAverageExpense,
      projectedMonthExpense,
      projectedSavings,
      savingsRate,
      daysRemaining,
      daysInMonth,
      daysElapsed,
      income,
      totalExpenses,
      todaySpending,
      dailyTarget,
      challengeTargets,
    });
  } catch (error) {
    console.error("Erro ao carregar dados do desafio de economia:", error);
    return NextResponse.json(
      { error: "Erro ao carregar dados do desafio de economia." },
      { status: 500 }
    );
  }
}
