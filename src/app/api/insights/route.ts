import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeRecurringToMonthly } from "@/lib/api-validation";
import {
  apiErrorResponse,
  formatServerCurrencyBRL,
  resolveRequestLocale,
  translateApiMessage,
} from "@/lib/server-i18n";

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
export async function GET(request?: NextRequest) {
  const locale = resolveRequestLocale(request);
  const currencyFmt = (v: number) => formatServerCurrencyBRL(v, locale);

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
      const monthsFormatted = monthsCovered.toFixed(1);
      const metricMonths = translateApiMessage(locale, "insights.emergencyFund.metricMonths", {
        months: monthsFormatted,
      });

      if (monthsCovered >= 6) {
        insights.push({
          id: "emergency-fund",
          type: "success",
          icon: "ShieldCheck",
          title: translateApiMessage(locale, "insights.emergencyFund.healthyTitle"),
          description: translateApiMessage(locale, "insights.emergencyFund.healthyDescription", {
            months: monthsFormatted,
          }),
          metric: metricMonths,
          trend: "up",
        });
      } else if (monthsCovered >= 3) {
        insights.push({
          id: "emergency-fund",
          type: "info",
          icon: "ShieldAlert",
          title: translateApiMessage(locale, "insights.emergencyFund.partialTitle"),
          description: translateApiMessage(locale, "insights.emergencyFund.partialDescription", {
            months: monthsFormatted,
          }),
          metric: metricMonths,
          trend: "stable",
        });
      } else {
        insights.push({
          id: "emergency-fund",
          type: "warning",
          icon: "ShieldAlert",
          title: translateApiMessage(locale, "insights.emergencyFund.lowTitle"),
          description: translateApiMessage(locale, "insights.emergencyFund.lowDescription", {
            months: monthsFormatted,
          }),
          metric: metricMonths,
          trend: "down",
          action: translateApiMessage(locale, "insights.emergencyFund.lowAction"),
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
          biggestOverspendCategory =
            categoryMap.get(catId)?.name || translateApiMessage(locale, "common.categoryFallback");
        }
      }
    }

    if (biggestOverspendCategory) {
      insights.push({
        id: "category-overspend",
        type: "warning",
        icon: "AlertTriangle",
        title: translateApiMessage(locale, "insights.categoryOverspend.title", {
          category: biggestOverspendCategory,
        }),
        description: translateApiMessage(locale, "insights.categoryOverspend.description", {
          amount: currencyFmt(biggestOverspendAmount),
          category: biggestOverspendCategory,
        }),
        metric: `+${biggestOverspendPercent.toFixed(0)}%`,
        trend: "up",
        action: translateApiMessage(locale, "insights.categoryOverspend.action"),
      });
    }

    // ──────────────────────────────────────
    // 3. Credit card utilization
    // ──────────────────────────────────────
    for (const card of cards) {
      if (card.creditLimit > 0) {
        const utilization = (card.currentBalance / card.creditLimit) * 100;
        const utilizationStr = utilization.toFixed(0);
        if (utilization >= 90) {
          insights.push({
            id: `card-util-${card.id}`,
            type: "danger",
            icon: "CreditCard",
            title: translateApiMessage(locale, "insights.cardUtil.criticalTitle", {
              name: card.name,
            }),
            description: translateApiMessage(locale, "insights.cardUtil.criticalDescription", {
              name: card.name,
              utilization: utilizationStr,
            }),
            metric: `${utilizationStr}%`,
            trend: "up",
            action: translateApiMessage(locale, "insights.cardUtil.criticalAction"),
          });
        } else if (utilization >= 70) {
          insights.push({
            id: `card-util-${card.id}`,
            type: "warning",
            icon: "CreditCard",
            title: translateApiMessage(locale, "insights.cardUtil.highTitle", {
              name: card.name,
            }),
            description: translateApiMessage(locale, "insights.cardUtil.highDescription", {
              name: card.name,
              utilization: utilizationStr,
            }),
            metric: `${utilizationStr}%`,
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
          title: translateApiMessage(locale, "insights.incomeVsExpense.surplusTitle"),
          description: translateApiMessage(locale, "insights.incomeVsExpense.surplusDescription", {
            percent: surplusPercent,
          }),
          metric: `+${currencyFmt(surplus)}`,
          trend: "up",
        });
      } else {
        const deficitAmount = currencyFmt(Math.abs(surplus));
        insights.push({
          id: "income-vs-expense",
          type: "danger",
          icon: "TrendingDown",
          title: translateApiMessage(locale, "insights.incomeVsExpense.deficitTitle"),
          description: translateApiMessage(locale, "insights.incomeVsExpense.deficitDescription", {
            amount: deficitAmount,
          }),
          metric: deficitAmount,
          trend: "down",
          action: translateApiMessage(locale, "insights.incomeVsExpense.deficitAction"),
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
      const recurringNoun = translateApiMessage(
        locale,
        activeRecurringCount !== 1
          ? "insights.recurringSummary.pluralNoun"
          : "insights.recurringSummary.singularNoun"
      );
      const recurringAmount = currencyFmt(recurringTotal);
      insights.push({
        id: "recurring-summary",
        type: "info",
        icon: "Repeat",
        title: translateApiMessage(locale, "insights.recurringSummary.title", {
          count: activeRecurringCount,
          noun: recurringNoun,
        }),
        description: translateApiMessage(locale, "insights.recurringSummary.description", {
          count: activeRecurringCount,
          noun: recurringNoun,
          amount: recurringAmount,
        }),
        metric: recurringAmount,
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
          biggestTrendCategory =
            categoryMap.get(catId)?.name || translateApiMessage(locale, "common.categoryFallback");
          biggestTrendDirection = "up";
        }
      }
    }

    if (biggestTrendCategory && biggestTrendPercent > 30) {
      const insightType = biggestTrendPercent > 60 ? "danger" : "warning";
      const trendPercentStr = biggestTrendPercent.toFixed(0);
      insights.push({
        id: "category-trend",
        type: insightType,
        icon: "BarChart3",
        title: translateApiMessage(locale, "insights.categoryTrend.title", {
          category: biggestTrendCategory,
        }),
        description: translateApiMessage(locale, "insights.categoryTrend.description", {
          category: biggestTrendCategory,
          percent: trendPercentStr,
        }),
        metric: `+${trendPercentStr}%`,
        trend: "up",
        action: translateApiMessage(locale, "insights.categoryTrend.action"),
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
          title: translateApiMessage(locale, "insights.goalProgress.title", {
            name: topGoal.name,
            progress,
          }),
          description:
            remaining > 0
              ? translateApiMessage(locale, "insights.goalProgress.remainingDescription", {
                  remaining: currencyFmt(remaining),
                  target: currencyFmt(topGoal.targetAmount),
                })
              : translateApiMessage(locale, "insights.goalProgress.completedDescription"),
          metric: `${progress}%`,
          trend: remaining > 0 ? "up" : "stable",
          action: remaining > 0 ? translateApiMessage(locale, "insights.goalProgress.action") : undefined,
        });
      }
    }

    // ──────────────────────────────────────
    // 8. Bank accounts overview
    // ──────────────────────────────────────
    if (accounts.length > 0) {
      const balanceFormatted = currencyFmt(totalBalance);
      const isPlural = accounts.length !== 1;
      insights.push({
        id: "accounts-overview",
        type: "info",
        icon: "Wallet",
        title: translateApiMessage(
          locale,
          isPlural ? "insights.accountsOverview.pluralTitle" : "insights.accountsOverview.singularTitle",
          { count: accounts.length }
        ),
        description: translateApiMessage(
          locale,
          isPlural
            ? "insights.accountsOverview.pluralDescription"
            : "insights.accountsOverview.singularDescription",
          { balance: balanceFormatted, count: accounts.length }
        ),
        metric: balanceFormatted,
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
        const momPercentStr = momChange.toFixed(0);
        insights.push({
          id: "mom-expense",
          type: "warning",
          icon: "ArrowUpRight",
          title: translateApiMessage(locale, "insights.momExpense.upTitle"),
          description: translateApiMessage(locale, "insights.momExpense.upDescription", {
            percent: momPercentStr,
            previous: currencyFmt(prevMonthExpense),
            current: currencyFmt(currentMonthExpense),
          }),
          metric: `+${momPercentStr}%`,
          trend: "up",
        });
      } else if (momChange < -10) {
        insights.push({
          id: "mom-expense",
          type: "success",
          icon: "ArrowDownRight",
          title: translateApiMessage(locale, "insights.momExpense.downTitle"),
          description: translateApiMessage(locale, "insights.momExpense.downDescription", {
            percent: Math.abs(momChange).toFixed(0),
          }),
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
        const utilizationStr = totalUtilization.toFixed(0);
        const cardNoun = translateApiMessage(
          locale,
          cards.length !== 1
            ? "insights.cardDebtOverview.pluralCards"
            : "insights.cardDebtOverview.singularCard"
        );
        insights.push({
          id: "card-debt-overview",
          type: totalUtilization < 40 ? "success" : totalUtilization < 70 ? "info" : "warning",
          icon: "Landmark",
          title: translateApiMessage(locale, "insights.cardDebtOverview.title", {
            utilization: utilizationStr,
          }),
          description: translateApiMessage(locale, "insights.cardDebtOverview.description", {
            balance: currencyFmt(totalCardBalance),
            limit: currencyFmt(totalCardLimit),
            count: cards.length,
            cardNoun,
          }),
          metric: `${utilizationStr}%`,
          trend: totalUtilization < 40 ? "stable" : "up",
        });
      }
    }

    return NextResponse.json(insights);
  } catch (error) {
    console.error("Error fetching insights:", error);
    return apiErrorResponse("INTERNAL_ERROR", translateApiMessage(locale, "insights.fetchFailed"), 500);
  }
}
