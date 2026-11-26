import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";
import { parseJsonBodyLocalized } from "@/lib/api-validation";
import {
  apiErrorResponse,
  formatServerCurrencyBRL,
  formatServerDate,
  formatServerMonthLabel,
  formatServerPurchaseDate,
  getApiMessages,
  resolveRequestLocale,
  translateApiMessage,
} from "@/lib/server-i18n";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_CONTEXT_LENGTH = 1000;

function sanitizeUntrustedContext(raw: string): string {
  const normalized = raw
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/<\/?user_context>/gi, " ")
    .replace(/={3,}|-{3,}/g, " ")
    .replace(/[<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.slice(0, MAX_CONTEXT_LENGTH);
}

export async function POST(request: NextRequest) {
  const locale = resolveRequestLocale(request);

  try {
    const parsedBody = await parseJsonBodyLocalized(request, { locale });
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { message, context } = parsedBody.data;

    if (typeof message !== "string" || message.trim().length === 0) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "advisor.messageRequired"),
        400
      );
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "advisor.messageTooLong", {
          max: MAX_MESSAGE_LENGTH,
        }),
        400
      );
    }

    if (context !== undefined && context !== null && typeof context !== "string") {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "advisor.invalidContext"),
        400
      );
    }

    const sanitizedContext =
      typeof context === "string" ? sanitizeUntrustedContext(context) : "";

    // Fetch real financial data from the database
    const now = new Date();
    const thirtyDaysAgo = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 30
    );
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    const [
      accounts,
      cards,
      recentTransactions,
      recentPurchases,
      monthIncomeTransactions,
      monthExpenseTransactions,
      monthPurchases,
      budgetGoals,
    ] = await Promise.all([
      db.account.findMany({
        where: { isActive: true },
        select: { id: true, name: true, type: true, balance: true, color: true },
      }),
      db.card.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          brand: true,
          creditLimit: true,
          currentBalance: true,
        },
      }),
      db.transaction.findMany({
        where: { date: { gte: thirtyDaysAgo } },
        include: { category: true, account: true, card: true },
        orderBy: { date: "desc" },
        take: 30,
      }),
      db.purchase.findMany({
        where: { date: { gte: thirtyDaysAgo } },
        include: { category: true, card: true },
        orderBy: { date: "desc" },
        take: 20,
      }),
      db.transaction.findMany({
        where: {
          type: "INCOME",
          date: { gte: currentMonthStart, lte: currentMonthEnd },
        },
        include: { category: true },
      }),
      db.transaction.findMany({
        where: {
          type: "EXPENSE",
          date: { gte: currentMonthStart, lte: currentMonthEnd },
        },
        include: { category: true },
      }) as Promise<Array<{ amount: number; category?: { name: string } | null }>>,
      db.purchase.findMany({
        where: { date: { gte: currentMonthStart, lte: currentMonthEnd } },
        include: { category: true },
      }),
      db.budgetGoal.findMany({
        include: { category: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const fmt = (v: number) => formatServerCurrencyBRL(v, locale);
    const otherCategoryLabel = translateApiMessage(locale, "advisor.otherCategory");

    // Compute financial summary
    const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
    const totalCardDebt = cards.reduce((s, c) => s + c.currentBalance, 0);
    const totalCardLimit = cards.reduce((s, c) => s + c.creditLimit, 0);
    const monthIncome = monthIncomeTransactions.reduce((s, t) => s + t.amount, 0);
    const monthExpenseTxTotal = monthExpenseTransactions.reduce(
      (s, t) => s + t.amount,
      0
    );
    const monthExpensePurchaseTotal = monthPurchases.reduce(
      (s, p) => s + p.totalAmount,
      0
    );
    const monthTotalExpense = monthExpenseTxTotal + monthExpensePurchaseTotal;
    const monthNet = monthIncome - monthTotalExpense;

    // Group expenses by category
    const expenseByCategory: Record<string, number> = {};
    for (const t of monthExpenseTransactions) {
      const catName = t.category?.name || otherCategoryLabel;
      expenseByCategory[catName] = (expenseByCategory[catName] || 0) + t.amount;
    }
    for (const p of monthPurchases) {
      const catName = p.category?.name || otherCategoryLabel;
      expenseByCategory[catName] = (expenseByCategory[catName] || 0) + p.totalAmount;
    }
    const topCategories = Object.entries(expenseByCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Budget goals summary
    const activeGoals = budgetGoals.filter((g) => !g.isCompleted);
    const completedGoals = budgetGoals.filter((g) => g.isCompleted);

    const cardUtilization =
      totalCardLimit > 0 ? ((totalCardDebt / totalCardLimit) * 100).toFixed(0) : "0";
    const monthLabel = formatServerMonthLabel(now, locale, {
      month: "long",
      year: "numeric",
    });
    const balanceStatus = translateApiMessage(
      locale,
      monthNet >= 0 ? "advisor.statusSurplus" : "advisor.statusDeficit"
    );

    const untrustedBlock = sanitizedContext
      ? `\n${translateApiMessage(locale, "advisor.sections.untrustedHeader", {
          notice: translateApiMessage(locale, "advisor.untrustedNotice"),
        })}\n<user_context>\n${sanitizedContext}\n</user_context>\n`
      : "";

    const financialContext = `
${translateApiMessage(locale, "advisor.sections.header")}

${translateApiMessage(locale, "advisor.sections.accountsTitle", { count: accounts.length })}
${accounts.map((a) => `• ${a.name} (${a.type}): ${fmt(a.balance)}`).join("\n")}
${translateApiMessage(locale, "advisor.sections.totalBalance", { amount: fmt(totalBalance) })}

${translateApiMessage(locale, "advisor.sections.cardsTitle", { count: cards.length })}
${cards
  .map((c) =>
    translateApiMessage(locale, "advisor.sections.cardLine", {
      name: c.name,
      balance: fmt(c.currentBalance),
      limit: fmt(c.creditLimit),
    })
  )
  .join("\n")}
${translateApiMessage(locale, "advisor.sections.cardsDebtSummary", {
  debt: fmt(totalCardDebt),
  limit: fmt(totalCardLimit),
  utilization: cardUtilization,
})}

${translateApiMessage(locale, "advisor.sections.currentMonthTitle", { monthLabel })}
${translateApiMessage(locale, "advisor.sections.income", { amount: fmt(monthIncome) })}
${translateApiMessage(locale, "advisor.sections.expenseTransactions", {
  amount: fmt(monthExpenseTxTotal),
})}
${translateApiMessage(locale, "advisor.sections.expensePurchases", {
  amount: fmt(monthExpensePurchaseTotal),
})}
${translateApiMessage(locale, "advisor.sections.totalExpense", {
  amount: fmt(monthTotalExpense),
})}
${translateApiMessage(locale, "advisor.sections.monthBalance", {
  amount: fmt(monthNet),
  status: balanceStatus,
})}

${translateApiMessage(locale, "advisor.sections.topCategoriesTitle")}
${topCategories
  .map(
    ([name, amount], i) =>
      `${i + 1}. ${name}: ${fmt(amount)} (${
        monthTotalExpense > 0 ? ((amount / monthTotalExpense) * 100).toFixed(1) : "0.0"
      }%)`
  )
  .join("\n")}

${translateApiMessage(locale, "advisor.sections.budgetGoalsTitle")}
${translateApiMessage(locale, "advisor.sections.activeGoals", {
  count: activeGoals.length,
})}
${
  activeGoals.length > 0
    ? activeGoals
        .map((g) => {
          const progress =
            g.targetAmount > 0
              ? ((g.currentAmount / g.targetAmount) * 100).toFixed(0)
              : "0";
          return translateApiMessage(locale, "advisor.sections.goalLine", {
            name: g.name,
            current: fmt(g.currentAmount),
            target: fmt(g.targetAmount),
            progress,
            categorySuffix: g.category ? ` [${g.category.name}]` : "",
          });
        })
        .join("\n")
    : translateApiMessage(locale, "advisor.sections.noActiveGoals")
}

${translateApiMessage(locale, "advisor.sections.completedGoals", {
  count: completedGoals.length,
})}
${
  completedGoals.length > 0
    ? completedGoals
        .map((g) =>
          translateApiMessage(locale, "advisor.sections.completedGoalLine", {
            name: g.name,
            target: fmt(g.targetAmount),
          })
        )
        .join("\n")
    : translateApiMessage(locale, "advisor.sections.noCompletedGoals")
}

${translateApiMessage(locale, "advisor.sections.recentTransactionsTitle")}
${recentTransactions
  .slice(0, 10)
  .map((t) => {
    const typeKey =
      t.type === "INCOME" || t.type === "TRANSFER" || t.type === "EXPENSE"
        ? t.type
        : "EXPENSE";
    const typeLabel = translateApiMessage(
      locale,
      `advisor.transactionTypes.${typeKey}`
    );
    return `• [${typeLabel}] ${t.description}: ${fmt(t.amount)} (${formatServerDate(
      t.date,
      locale,
      "date"
    )})${t.category ? ` [${t.category.name}]` : ""}`;
  })
  .join("\n")}

${translateApiMessage(locale, "advisor.sections.recentPurchasesTitle")}
${recentPurchases
  .slice(0, 8)
  .map(
    (p) =>
      `• ${p.merchant}: ${fmt(p.totalAmount)} (${formatServerPurchaseDate(
        p.date,
        locale,
        "date"
      )})${p.category ? ` [${p.category.name}]` : ""}`
  )
  .join("\n")}
${untrustedBlock}
`.trim();

    const promptMsgs = getApiMessages(locale).advisor.systemPrompt;
    const rulesLines = Object.values(promptMsgs.rules).join("\n");
    const systemPrompt = `${promptMsgs.intro}

${promptMsgs.instructionsTitle}
${rulesLines}

${promptMsgs.dataLead}
${financialContext}`;

    // Call LLM
    const zai = await ZAI.create();

    const completion = await zai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: trimmedMessage },
      ],
      thinking: { type: "disabled" },
    });

    const response = completion.choices[0]?.message?.content;

    if (!response || response.trim().length === 0) {
      return apiErrorResponse(
        "INTERNAL_ERROR",
        translateApiMessage(locale, "advisor.emptyResponse"),
        500
      );
    }

    return NextResponse.json({ response: response.trim() });
  } catch (error) {
    console.error("Error in advisor API:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "advisor.processFailed"),
      500
    );
  }
}
