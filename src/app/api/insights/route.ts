import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeRecurringToMonthly } from "@/lib/api-validation";

const currencyFmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface FinancialInsight {
  id: string;
  type: "success" | "warning" | "danger" | "info";
  icon: string;
  title: string;
  description: string;
  action?: string;
  metric?: string;
  trend?: "up" | "down" | "stable";
}

// GET /api/insights — compute 10 financial insights
export async function GET() {
  try {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // 3 complete months prior to current month for trend analysis
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const threeCompleteMonthsEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [
      accounts,
      cards,
      categories,
      monthExpenseTransactions,
      monthIncomeTransactions,
      monthPurchases,
      threeMonthExpenseTransactions,
      threeMonthPurchases,
      previousMonthExpenseTransactions,
      previousMonthPurchases,
      recurringTransactions,
      budgetGoals,
    ] = await Promise.all([
      db.account.findMany({
        where: { isActive: true },
        select: { id: true, name: true, balance: true, type: true, color: true },
      }),
      db.card.findMany({
        where: { isActive: true },
        select: { id: true, name: true, creditLimit: true, currentBalance: true, color: true },
      }),
      db.category.findMany({
        where: { isActive: true },
        select: { id: true, name: true, color: true },
      }),
      // Current month expense transactions
      db.transaction.findMany({
        where: { type: "EXPENSE", date: { gte: currentMonthStart, lte: currentMonthEnd } },
        select: { amount: true, categoryId: true, date: true },
      }),
      // Current month income transactions
      db.transaction.findMany({
        where: { type: "INCOME", date: { gte: currentMonthStart, lte: currentMonthEnd } },
        select: { amount: true },
      }),
      // Current month purchases
      db.purchase.findMany({
        where: { date: { gte: currentMonthStart, lte: currentMonthEnd } },
        select: { totalAmount: true, categoryId: true, date: true },
      }),
      // Last 3 complete months expense transactions
      db.transaction.findMany({
        where: { type: "EXPENSE", date: { gte: threeMonthsAgo, lte: threeCompleteMonthsEnd } },
        select: { amount: true, categoryId: true, date: true },
      }),
      // Last 3 complete months purchases
      db.purchase.findMany({
        where: { date: { gte: threeMonthsAgo, lte: threeCompleteMonthsEnd } },
        select: { totalAmount: true, categoryId: true, date: true },
      }),
      // Previous month expense transactions (for comparison)
      db.transaction.findMany({
        where: {
          type: "EXPENSE",
          date: {
            gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
            lte: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
          },
        },
        select: { amount: true },
      }),
      // Previous month purchases
      db.purchase.findMany({
        where: {
          date: {
            gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
            lte: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
          },
        },
        select: { totalAmount: true },
      }),
      // Recurring transactions
      db.recurringTransaction.findMany({
        where: { isActive: true },
        select: { id: true, description: true, amount: true, type: true, frequency: true },
      }),
      // Budget goals
      db.budgetGoal.findMany({
        include: { category: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const insights: FinancialInsight[] = [];

    // ──────────────────────────────────────
    // 1. Emergency fund coverage (reserve = total account balances)
    // ──────────────────────────────────────
    const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
    const currentMonthExpense =
      monthExpenseTransactions.reduce((s, t) => s + t.amount, 0) +
      monthPurchases.reduce((s, p) => s + p.totalAmount, 0);
    const monthlyAvgExpense =
      threeMonthExpenseTransactions.reduce((s, t) => s + t.amount, 0) +
      threeMonthPurchases.reduce((s, p) => s + p.totalAmount, 0);
    const monthsOfData = 3;
    const avgMonthlyExpense = monthlyAvgExpense / monthsOfData;

    if (avgMonthlyExpense > 0) {
      const monthsCovered = totalBalance / avgMonthlyExpense;
      if (monthsCovered >= 6) {
        insights.push({
          id: "emergency-fund",
          type: "success",
          icon: "ShieldCheck",
          title: "Reserva de emergência saudável",
          description: `Sua reserva cobre aproximadamente ${monthsCovered.toFixed(1)} meses de gastos. Isso está acima do recomendado!`,
          metric: `${monthsCovered.toFixed(1)} meses`,
          trend: "up",
        });
      } else if (monthsCovered >= 3) {
        insights.push({
          id: "emergency-fund",
          type: "info",
          icon: "ShieldAlert",
          title: "Reserva de emergência parcial",
          description: `Sua reserva cobre aproximadamente ${monthsCovered.toFixed(1)} meses de gastos. O ideal é ter pelo menos 6 meses.`,
          metric: `${monthsCovered.toFixed(1)} meses`,
          trend: "stable",
        });
      } else {
        insights.push({
          id: "emergency-fund",
          type: "warning",
          icon: "ShieldAlert",
          title: "Reserva de emergência baixa",
          description: `Sua reserva cobre apenas ${monthsCovered.toFixed(1)} meses de gastos. Considere aumentar sua poupança para emergências.`,
          metric: `${monthsCovered.toFixed(1)} meses`,
          trend: "down",
          action: "Rever orçamento",
        });
      }
    }

    // ──────────────────────────────────────
    // 2. Category overspending this month vs average
    // ──────────────────────────────────────
    const categoryMap = new Map<string, { name: string; color: string }>();
    for (const cat of categories) {
      categoryMap.set(cat.id, { name: cat.name, color: cat.color });
    }

    // Current month expenses by category
    const currentCategoryExpense = new Map<string, number>();
    for (const t of monthExpenseTransactions) {
      if (t.categoryId) {
        currentCategoryExpense.set(t.categoryId, (currentCategoryExpense.get(t.categoryId) || 0) + t.amount);
      }
    }
    for (const p of monthPurchases) {
      if (p.categoryId) {
        currentCategoryExpense.set(p.categoryId, (currentCategoryExpense.get(p.categoryId) || 0) + p.totalAmount);
      }
    }

    // 3-month average expenses by category
    const threeMonthCategoryExpense = new Map<string, number>();
    for (const t of threeMonthExpenseTransactions) {
      if (t.categoryId) {
        threeMonthCategoryExpense.set(t.categoryId, (threeMonthCategoryExpense.get(t.categoryId) || 0) + t.amount);
      }
    }
    for (const p of threeMonthPurchases) {
      if (p.categoryId) {
        threeMonthCategoryExpense.set(p.categoryId, (threeMonthCategoryExpense.get(p.categoryId) || 0) + p.totalAmount);
      }
    }

    // Find category with biggest overspend
    let biggestOverspendCategory = "";
    let biggestOverspendAmount = 0;
    let biggestOverspendPercent = 0;

    for (const [catId, currentTotal] of currentCategoryExpense) {
      const avgTotal = (threeMonthCategoryExpense.get(catId) || 0) / monthsOfData;
      if (avgTotal > 0) {
        const diff = currentTotal - avgTotal;
        const percentIncrease = (diff / avgTotal) * 100;
        if (percentIncrease > 20 && diff > biggestOverspendAmount) {
          biggestOverspendAmount = diff;
          biggestOverspendPercent = percentIncrease;
          biggestOverspendCategory = categoryMap.get(catId)?.name || "Categoria";
        }
      }
    }

    if (biggestOverspendCategory) {
      insights.push({
        id: "category-overspend",
        type: "warning",
        icon: "AlertTriangle",
        title: `Gastos acima da média em ${biggestOverspendCategory}`,
        description: `Você gastou ${currencyFmt(biggestOverspendAmount)} a mais em ${biggestOverspendCategory} este mês comparado à sua média dos últimos 3 meses.`,
        metric: `+${biggestOverspendPercent.toFixed(0)}%`,
        trend: "up",
        action: "Ver detalhes da categoria",
      });
    }

    // ──────────────────────────────────────
    // 3. Credit card utilization
    // ──────────────────────────────────────
    for (const card of cards) {
      if (card.creditLimit > 0) {
        const utilization = (card.currentBalance / card.creditLimit) * 100;
        if (utilization >= 90) {
          insights.push({
            id: `card-util-${card.id}`,
            type: "danger",
            icon: "CreditCard",
            title: `Cartão ${card.name} com limite quase esgotado`,
            description: `Seu cartão ${card.name} está com ${utilization.toFixed(0)}% do limite utilizado. Evite novas compras neste cartão.`,
            metric: `${utilization.toFixed(0)}%`,
            trend: "up",
            action: "Pagar fatura",
          });
        } else if (utilization >= 70) {
          insights.push({
            id: `card-util-${card.id}`,
            type: "warning",
            icon: "CreditCard",
            title: `Cartão ${card.name} com alto uso do limite`,
            description: `Seu cartão ${card.name} está com ${utilization.toFixed(0)}% do limite utilizado. Fique atento aos próximos gastos.`,
            metric: `${utilization.toFixed(0)}%`,
            trend: "up",
          });
        }
      }
    }

    // ──────────────────────────────────────
    // 4. Income vs Expense comparison
    // ──────────────────────────────────────
    const currentMonthIncome = monthIncomeTransactions.reduce((s, t) => s + t.amount, 0);
    if (currentMonthIncome > 0 && currentMonthExpense > 0) {
      const surplus = currentMonthIncome - currentMonthExpense;
      if (surplus > 0) {
        const surplusPercent = ((surplus / currentMonthIncome) * 100).toFixed(0);
        insights.push({
          id: "income-vs-expense",
          type: "success",
          icon: "TrendingUp",
          title: "Receitas superaram despesas",
          description: `Parabéns! Suas receitas superaram as despesas em ${surplusPercent}% este mês. Continue assim!`,
          metric: `+${currencyFmt(surplus)}`,
          trend: "up",
        });
      } else {
        insights.push({
          id: "income-vs-expense",
          type: "danger",
          icon: "TrendingDown",
          title: "Despesas ultrapassaram receitas",
          description: `Suas despesas ultrapassaram as receitas em ${currencyFmt(Math.abs(surplus))} este mês. Revise seus gastos.`,
          metric: currencyFmt(Math.abs(surplus)),
          trend: "down",
          action: "Rever despesas",
        });
      }
    }

    // ──────────────────────────────────────
    // 5. Recurring transactions summary
    // ──────────────────────────────────────
    if (recurringTransactions.length > 0) {
      const activeRecurringCount = recurringTransactions.length;
      const recurringTotal = recurringTransactions.reduce(
        (s, r) => s + normalizeRecurringToMonthly(r.amount, r.frequency),
        0
      );
      insights.push({
        id: "recurring-summary",
        type: "info",
        icon: "Repeat",
        title: `${activeRecurringCount} transaç${activeRecurringCount !== 1 ? 'ões' : 'ão'} recorrente${activeRecurringCount !== 1 ? 's' : ''}`,
        description: `Você tem ${activeRecurringCount} transaç${activeRecurringCount !== 1 ? 'ões' : 'ão'} recorrente${activeRecurringCount !== 1 ? 's' : ''} que somam ${currencyFmt(recurringTotal)}/mês.`,
        metric: currencyFmt(recurringTotal),
        trend: "stable",
      });
    }

    // ──────────────────────────────────────
    // 6. Category trend (3 months)
    // ──────────────────────────────────────
    // Find the category with the highest growth
    let biggestTrendCategory = "";
    let biggestTrendPercent = 0;
    let biggestTrendDirection: "up" | "down" = "up";

    for (const [catId, total3m] of threeMonthCategoryExpense) {
      // Split 3 months into first 1.5 and last 1.5 months
      const midpoint = new Date(
        threeMonthsAgo.getFullYear(),
        threeMonthsAgo.getMonth() + 1,
        15
      );
      const firstHalfTxn = threeMonthExpenseTransactions.filter(
        (t) => t.categoryId === catId && t.date < midpoint
      );
      const secondHalfTxn = threeMonthExpenseTransactions.filter(
        (t) => t.categoryId === catId && t.date >= midpoint
      );
      const firstHalfPurchase = threeMonthPurchases.filter(
        (p) => p.categoryId === catId && p.date < midpoint
      );
      const secondHalfPurchase = threeMonthPurchases.filter(
        (p) => p.categoryId === catId && p.date >= midpoint
      );

      const firstHalf = firstHalfTxn.reduce((s, t) => s + t.amount, 0) +
        firstHalfPurchase.reduce((s, p) => s + p.totalAmount, 0);
      const secondHalf = secondHalfTxn.reduce((s, t) => s + t.amount, 0) +
        secondHalfPurchase.reduce((s, p) => s + p.totalAmount, 0);

      if (firstHalf > 0) {
        const percentChange = ((secondHalf - firstHalf) / firstHalf) * 100;
        if (percentChange > biggestTrendPercent) {
          biggestTrendPercent = percentChange;
          biggestTrendCategory = categoryMap.get(catId)?.name || "Categoria";
          biggestTrendDirection = "up";
        }
      }
    }

    if (biggestTrendCategory && biggestTrendPercent > 30) {
      const insightType = biggestTrendPercent > 60 ? "danger" : "warning";
      insights.push({
        id: "category-trend",
        type: insightType,
        icon: "BarChart3",
        title: `Gastos com ${biggestTrendCategory} em alta`,
        description: `Os gastos com ${biggestTrendCategory} aumentaram aproximadamente ${biggestTrendPercent.toFixed(0)}% na última metade dos últimos 3 meses.`,
        metric: `+${biggestTrendPercent.toFixed(0)}%`,
        trend: "up",
        action: "Analisar gastos",
      });
    }

    // ──────────────────────────────────────
    // 7. Budget goal progress
    // ──────────────────────────────────────
    const activeGoals = budgetGoals.filter((g) => !g.isCompleted);
    if (activeGoals.length > 0) {
      // Show the goal closest to completion
      const sortedByProgress = [...activeGoals].sort((a, b) => {
        const progA = a.targetAmount > 0 ? a.currentAmount / a.targetAmount : 0;
        const progB = b.targetAmount > 0 ? b.currentAmount / b.targetAmount : 0;
        return progB - progA;
      });
      const topGoal = sortedByProgress[0];
      if (topGoal && topGoal.targetAmount > 0) {
        const progressValue = (topGoal.currentAmount / topGoal.targetAmount) * 100;
        const progress = progressValue.toFixed(0);
        const remaining = topGoal.targetAmount - topGoal.currentAmount;
        insights.push({
          id: `goal-${topGoal.id}`,
          type: progressValue >= 70 ? "success" : "info",
          icon: "Target",
          title: `Meta "${topGoal.name}" está ${progress}% completa`,
          description: remaining > 0
            ? `Faltam ${currencyFmt(remaining)} para atingir a meta de ${currencyFmt(topGoal.targetAmount)}.`
            : `Parabéns! Você atingiu a meta!`,
          metric: `${progress}%`,
          trend: remaining > 0 ? "up" : "stable",
          action: remaining > 0 ? "Contribuir agora" : undefined,
        });
      }
    }

    // ──────────────────────────────────────
    // 8. Bank accounts overview
    // ──────────────────────────────────────
    if (accounts.length > 0) {
      insights.push({
        id: "accounts-overview",
        type: "info",
        icon: "Wallet",
        title: `${accounts.length} conta${accounts.length !== 1 ? "s" : ""} bancária${accounts.length !== 1 ? "s" : ""} ativa${accounts.length !== 1 ? "s" : ""}`,
        description: `Saldo total de ${currencyFmt(totalBalance)} distribuído${accounts.length !== 1 ? "s" : ""} em ${accounts.length} conta${accounts.length !== 1 ? "s" : ""}.`,
        metric: currencyFmt(totalBalance),
        trend: "stable",
      });
    }

    // ──────────────────────────────────────
    // 9. Month-over-month expense comparison
    // ──────────────────────────────────────
    const prevMonthExpense =
      previousMonthExpenseTransactions.reduce((s, t) => s + t.amount, 0) +
      previousMonthPurchases.reduce((s, p) => s + p.totalAmount, 0);

    if (prevMonthExpense > 0 && currentMonthExpense > 0) {
      const momChange = ((currentMonthExpense - prevMonthExpense) / prevMonthExpense) * 100;
      if (momChange > 0) {
        insights.push({
          id: "mom-expense",
          type: "warning",
          icon: "ArrowUpRight",
          title: "Gastos aumentaram em relação ao mês anterior",
          description: `Suas despesas subiram ${momChange.toFixed(0)}% em comparação com o mês passado (${currencyFmt(prevMonthExpense)} → ${currencyFmt(currentMonthExpense)}).`,
          metric: `+${momChange.toFixed(0)}%`,
          trend: "up",
        });
      } else if (momChange < -10) {
        insights.push({
          id: "mom-expense",
          type: "success",
          icon: "ArrowDownRight",
          title: "Gastos reduzidos em relação ao mês anterior",
          description: `Suas despesas caíram ${Math.abs(momChange).toFixed(0)}% em comparação com o mês passado. Ótimo trabalho!`,
          metric: `${momChange.toFixed(0)}%`,
          trend: "down",
        });
      }
    }

    // ──────────────────────────────────────
    // 10. Total card debt vs limit overview
    // ──────────────────────────────────────
    if (cards.length > 0) {
      const totalCardBalance = cards.reduce((s, c) => s + c.currentBalance, 0);
      const totalCardLimit = cards.reduce((s, c) => s + c.creditLimit, 0);
      if (totalCardLimit > 0) {
        const totalUtilization = (totalCardBalance / totalCardLimit) * 100;
        insights.push({
          id: "card-debt-overview",
          type: totalUtilization < 40 ? "success" : totalUtilization < 70 ? "info" : "warning",
          icon: "Landmark",
          title: `Uso total do crédito: ${totalUtilization.toFixed(0)}%`,
          description: `Você está utilizando ${currencyFmt(totalCardBalance)} de ${currencyFmt(totalCardLimit)} disponível em ${cards.length} cartão${cards.length !== 1 ? 'ões' : 'ão'}.`,
          metric: `${totalUtilization.toFixed(0)}%`,
          trend: totalUtilization < 40 ? "stable" : "up",
        });
      }
    }

    return NextResponse.json(insights);
  } catch (error) {
    console.error("Error fetching insights:", error);
    return NextResponse.json(
      { error: "Erro ao gerar insights financeiros" },
      { status: 500 }
    );
  }
}
