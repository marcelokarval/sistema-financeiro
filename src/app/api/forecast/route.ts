import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/forecast?months=3 — Cash flow forecast based on historical patterns + recurring transactions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const monthsParam = searchParams.get("months");
    let forecastMonths = 3;

    if (monthsParam) {
      const parsed = parseInt(monthsParam, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 6) {
        return NextResponse.json(
          { error: "O parâmetro 'months' deve ser um número entre 1 e 6." },
          { status: 400 }
        );
      }
      forecastMonths = parsed;
    }

    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

    // Parallel fetch: historical transactions, purchases, categories, recurring transactions
    const [transactions, purchases, categories, recurringTransactions] =
      await Promise.all([
        db.transaction.findMany({
          where: {
            date: { gte: sixMonthsAgo },
          },
          include: { category: true },
          orderBy: { date: "asc" },
        }),
        db.purchase.findMany({
          where: {
            date: { gte: sixMonthsAgo },
          },
          include: { category: true },
          orderBy: { date: "asc" },
        }),
        db.category.findMany({
          where: { isActive: true },
          select: { id: true, name: true, color: true, type: true },
        }),
        db.recurringTransaction.findMany({
          where: { isActive: true },
          include: { category: true },
        }),
      ]);

    // ─── Historical analysis by month ─────────────────────────────────
    const monthBuckets: {
      year: number;
      month: number;
      income: number;
      expense: number;
      categoryExpense: Record<string, number>;
    }[] = [];

    // Build 6 month buckets
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthBuckets.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        income: 0,
        expense: 0,
        categoryExpense: {},
      });
    }

    // Populate buckets from transactions
    for (const t of transactions) {
      const b = monthBuckets.find(
        (b) =>
          t.date.getFullYear() === b.year && t.date.getMonth() === b.month
      );
      if (!b) continue;
      if (t.type === "INCOME") {
        b.income += t.amount;
      } else if (t.type === "EXPENSE") {
        b.expense += t.amount;
        if (t.categoryId) {
          b.categoryExpense[t.categoryId] =
            (b.categoryExpense[t.categoryId] || 0) + t.amount;
        }
      }
    }

    // Populate buckets from purchases
    for (const p of purchases) {
      const b = monthBuckets.find(
        (b) =>
          p.date.getFullYear() === b.year && p.date.getMonth() === b.month
      );
      if (!b) continue;
      b.expense += p.totalAmount;
      if (p.categoryId) {
        b.categoryExpense[p.categoryId] =
          (b.categoryExpense[p.categoryId] || 0) + p.totalAmount;
      }
    }

    // Remove months with zero activity from average calculation
    const activeMonths = monthBuckets.filter(
      (b) => b.income > 0 || b.expense > 0
    );
    const totalActiveMonths = activeMonths.length || 1;

    const avgIncome =
      activeMonths.reduce((s, b) => s + b.income, 0) / totalActiveMonths;
    const avgExpense =
      activeMonths.reduce((s, b) => s + b.expense, 0) / totalActiveMonths;

    // ─── Average expense by category ─────────────────────────────────
    const categoryTotals: Record<string, { name: string; color: string; total: number }> = {};
    for (const b of activeMonths) {
      for (const [catId, amount] of Object.entries(b.categoryExpense)) {
        if (!categoryTotals[catId]) {
          const cat = categories.find((c) => c.id === catId);
          categoryTotals[catId] = {
            name: cat?.name || "Outros",
            color: cat?.color || "#6b7280",
            total: 0,
          };
        }
        categoryTotals[catId].total += amount;
      }
    }

    const topExpenseCategories = Object.values(categoryTotals)
      .map((c) => ({
        name: c.name,
        color: c.color,
        averageMonthly: Math.round((c.total / totalActiveMonths) * 100) / 100,
      }))
      .sort((a, b) => b.averageMonthly - a.averageMonthly)
      .slice(0, 5);

    // ─── Recurring transaction projections ───────────────────────────
    let recurringIncome = 0;
    let recurringExpense = 0;

    for (const r of recurringTransactions) {
      if (r.type === "INCOME") {
        recurringIncome += r.amount;
      } else if (r.type === "EXPENSE") {
        recurringExpense += r.amount;
      }
    }

    // ─── Forecast calculation ────────────────────────────────────────
    const forecastMonthsData: {
      month: string;
      projectedIncome: number;
      projectedExpense: number;
      projectedNet: number;
      confidence: number;
    }[] = [];

    for (let i = 1; i <= forecastMonths; i++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthLabel = targetDate.toLocaleString("pt-BR", {
        month: "long",
        year: "numeric",
      });

      // Blend historical average with recurring (weighted: 60% historical, 40% recurring)
      const hasRecurring = recurringTransactions.length > 0;
      const projIncome = hasRecurring
        ? avgIncome * 0.6 + recurringIncome * 0.4
        : avgIncome;
      const projExpense = hasRecurring
        ? avgExpense * 0.6 + recurringExpense * 0.4
        : avgExpense;

      const projNet = projIncome - projExpense;

      // Confidence decreases further into the future, increases with more historical data
      const dataConfidence = Math.min(totalActiveMonths / 6, 1) * 100; // up to 100
      const distancePenalty = (i - 1) * 10; // lose 10% per month into the future
      const recurringBonus = hasRecurring ? 5 : 0; // small bonus for having recurring data
      const confidence = Math.max(
        15,
        Math.min(98, dataConfidence - distancePenalty + recurringBonus)
      );

      forecastMonthsData.push({
        month: monthLabel,
        projectedIncome: Math.round(projIncome * 100) / 100,
        projectedExpense: Math.round(projExpense * 100) / 100,
        projectedNet: Math.round(projNet * 100) / 100,
        confidence: Math.round(confidence),
      });
    }

    // ─── Risk alerts ─────────────────────────────────────────────────
    const riskAlerts: string[] = [];

    if (avgExpense > avgIncome * 0.9) {
      riskAlerts.push(
        "Suas despesas estão acima de 90% da sua receita média. Risco de déficit."
      );
    }

    if (avgIncome - avgExpense < 0) {
      riskAlerts.push(
        "Seu saldo médio mensal é negativo. Revise seus gastos urgentemente."
      );
    }

    // Check if expenses have been trending up recently
    const recent3 = activeMonths.slice(-3);
    const olderMonths = activeMonths.slice(0, -3);
    if (recent3.length === 3 && olderMonths.length > 0) {
      const recentAvgExpense =
        recent3.reduce((s, b) => s + b.expense, 0) / 3;
      const olderAvgExpense =
        olderMonths.reduce((s, b) => s + b.expense, 0) / olderMonths.length;

      if (olderAvgExpense > 0) {
        const expenseIncrease =
          ((recentAvgExpense - olderAvgExpense) / olderAvgExpense) * 100;
        if (expenseIncrease > 10) {
          riskAlerts.push(
            `Gastos gerais estão ${Math.round(expenseIncrease)}% acima da média dos meses anteriores.`
          );
        }
      }

      // Check per-category trends (limit to 3 to avoid alert spam)
      const allCatIds = [
        ...new Set([
          ...recent3.flatMap((b) => Object.keys(b.categoryExpense)),
          ...olderMonths.flatMap((b) => Object.keys(b.categoryExpense)),
        ]),
      ];

      for (const catId of allCatIds.slice(0, 3)) {
        const cat = categories.find((c) => c.id === catId);
        if (!cat) continue;
        const recentCatAvg =
          recent3.reduce(
            (s, b) => s + (b.categoryExpense[catId] || 0),
            0
          ) / 3;
        const olderCatAvg =
          olderMonths.reduce(
            (s, b) => s + (b.categoryExpense[catId] || 0),
            0
          ) / olderMonths.length;

        if (olderCatAvg > 0) {
          const catIncrease =
            ((recentCatAvg - olderCatAvg) / olderCatAvg) * 100;
          if (catIncrease > 15) {
            riskAlerts.push(
              `Gastos com ${cat.name} estão ${Math.round(catIncrease)}% acima da média dos últimos 3 meses.`
            );
          }
        }
      }
    }

    // Low savings warning
    if (avgIncome > 0) {
      const savingsRate = ((avgIncome - avgExpense) / avgIncome) * 100;
      if (savingsRate < 10 && savingsRate > 0) {
        riskAlerts.push(
          "Sua taxa de poupança está abaixo de 10%. Considere reduzir gastos desnecessários."
        );
      }
    }

    // ─── Trend direction ─────────────────────────────────────────────
    let trendDirection: "improving" | "stable" | "declining" = "stable";
    if (activeMonths.length >= 3) {
      const last3 = activeMonths.slice(-3);
      const netTrend = last3.map((b) => b.income - b.expense);
      const firstHalf = netTrend.slice(0, 1);
      const secondHalf = netTrend.slice(1);

      if (firstHalf.length > 0 && secondHalf.length > 0) {
        const avgFirst = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
        const avgSecond =
          secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;

        if (avgSecond > avgFirst * 1.05) {
          trendDirection = "improving";
        } else if (avgSecond < avgFirst * 0.95) {
          trendDirection = "declining";
        }
      }
    }

    return NextResponse.json({
      forecastMonths: forecastMonthsData,
      topExpenseCategories,
      riskAlerts,
      trendDirection,
    });
  } catch (error) {
    console.error("Error generating forecast:", error);
    return NextResponse.json(
      { error: "Erro ao gerar previsão de fluxo de caixa." },
      { status: 500 }
    );
  }
}
