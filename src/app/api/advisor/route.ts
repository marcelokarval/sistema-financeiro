import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";

const currencyFmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, context } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Mensagem é obrigatória." },
        { status: 400 }
      );
    }

    // Fetch real financial data from the database
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [
      accounts,
      cards,
      recentTransactions,
      recentPurchases,
      monthIncomeTransactions,
      monthExpenseTransactions,
      monthPurchases,
      budgetGoals,
      categories,
    ] = await Promise.all([
      // All active accounts with balances
      db.account.findMany({
        where: { isActive: true },
        select: { id: true, name: true, type: true, balance: true, color: true },
      }),
      // All active cards with limits
      db.card.findMany({
        where: { isActive: true },
        select: { id: true, name: true, brand: true, creditLimit: true, currentBalance: true, lastFourDigits: true },
      }),
      // Recent transactions (last 30 days)
      db.transaction.findMany({
        where: { date: { gte: thirtyDaysAgo } },
        include: { category: true, account: true, card: true },
        orderBy: { date: "desc" },
        take: 30,
      }),
      // Recent purchases (last 30 days)
      db.purchase.findMany({
        where: { date: { gte: thirtyDaysAgo } },
        include: { category: true, card: true },
        orderBy: { date: "desc" },
        take: 20,
      }),
      // Current month income
      db.transaction.findMany({
        where: { type: "INCOME", date: { gte: currentMonthStart, lte: currentMonthEnd } },
        include: { category: true },
      }),
      // Current month expenses
      db.transaction.findMany({
        where: { type: "EXPENSE", date: { gte: currentMonthStart, lte: currentMonthEnd } },
        include: { category: true },
      }) as Promise<Array<{ amount: number; category?: { name: string } | null }>>,
      // Current month purchases
      db.purchase.findMany({
        where: { date: { gte: currentMonthStart, lte: currentMonthEnd } },
        include: { category: true },
      }),
      // Budget goals
      db.budgetGoal.findMany({
        include: { category: true },
        orderBy: { createdAt: "desc" },
      }),
      // Categories
      db.category.findMany({
        where: { isActive: true },
        select: { id: true, name: true, type: true, color: true },
      }),
    ]);

    // Compute financial summary
    const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
    const totalCardDebt = cards.reduce((s, c) => s + c.currentBalance, 0);
    const totalCardLimit = cards.reduce((s, c) => s + c.creditLimit, 0);
    const monthIncome = monthIncomeTransactions.reduce((s, t) => s + t.amount, 0);
    const monthExpenseTxTotal = monthExpenseTransactions.reduce((s, t) => s + t.amount, 0);
    const monthExpensePurchaseTotal = monthPurchases.reduce((s, p) => s + p.totalAmount, 0);
    const monthTotalExpense = monthExpenseTxTotal + monthExpensePurchaseTotal;
    const monthNet = monthIncome - monthTotalExpense;

    // Group expenses by category
    const expenseByCategory: Record<string, number> = {};
    for (const t of monthExpenseTransactions) {
      const catName = t.category?.name || "Outros";
      expenseByCategory[catName] = (expenseByCategory[catName] || 0) + t.amount;
    }
    for (const p of monthPurchases) {
      const catName = p.category?.name || "Outros";
      expenseByCategory[catName] = (expenseByCategory[catName] || 0) + p.totalAmount;
    }
    const topCategories = Object.entries(expenseByCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Budget goals summary
    const activeGoals = budgetGoals.filter((g) => !g.isCompleted);
    const completedGoals = budgetGoals.filter((g) => g.isCompleted);

    // Build financial context for the LLM
    const financialContext = `
=== RESUMO FINANCEIRO DO USUÁRIO ===

--- Contas Bancárias (${accounts.length}) ---
${accounts.map((a) => `• ${a.name} (${a.type}): ${currencyFmt(a.balance)}`).join("\n")}
Patrimônio Total: ${currencyFmt(totalBalance)}

--- Cartões de Crédito (${cards.length}) ---
${cards.map((c) => `• ${c.name} (****${c.lastFourDigits}): Fatura ${currencyFmt(c.currentBalance)} / Limite ${currencyFmt(c.creditLimit)}`).join("\n")}
Dívida Total em Cartões: ${currencyFmt(totalCardDebt)} de ${currencyFmt(totalCardLimit)} disponível (${totalCardLimit > 0 ? ((totalCardDebt / totalCardLimit) * 100).toFixed(0) : 0}% de uso)

--- Mês Atual (${now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}) ---
Receitas: ${currencyFmt(monthIncome)}
Despesas (transações): ${currencyFmt(monthExpenseTxTotal)}
Despesas (compras): ${currencyFmt(monthExpensePurchaseTotal)}
Despesas Totais: ${currencyFmt(monthTotalExpense)}
Saldo do Mês: ${currencyFmt(monthNet)} ${monthNet >= 0 ? "(superávit ✅)" : "(déficit ⚠️)"}

--- Top 5 Categorias de Gasto ---
${topCategories.map(([name, amount], i) => `${i + 1}. ${name}: ${currencyFmt(amount)} (${((amount / monthTotalExpense) * 100).toFixed(1)}%)`).join("\n")}

--- Metas de Orçamento ---
Metas Ativas (${activeGoals.length}):
${activeGoals.length > 0 ? activeGoals.map((g) => {
  const progress = g.targetAmount > 0 ? ((g.currentAmount / g.targetAmount) * 100).toFixed(0) : "0";
  return `• ${g.name}: ${currencyFmt(g.currentAmount)} de ${currencyFmt(g.targetAmount)} (${progress}% concluído)${g.category ? ` [${g.category.name}]` : ""}`;
}).join("\n") : "• Nenhuma meta ativa"}

Metas Concluídas (${completedGoals.length}):
${completedGoals.length > 0 ? completedGoals.map((g) => `• ${g.name}: ${currencyFmt(g.targetAmount)} ✅`).join("\n") : "• Nenhuma meta concluída"}

--- Últimas Transações (últimos 30 dias) ---
${recentTransactions.slice(0, 10).map((t) => `• [${t.type === "INCOME" ? "Receita" : "Despesa"}] ${t.description}: ${currencyFmt(t.amount)} (${t.date.toLocaleDateString("pt-BR")})${t.category ? ` [${t.category.name}]` : ""}`).join("\n")}

--- Últimas Compras (últimos 30 dias) ---
${recentPurchases.slice(0, 8).map((p) => `• ${p.merchant}: ${currencyFmt(p.totalAmount)} (${p.date.toLocaleDateString("pt-BR")})${p.category ? ` [${p.category.name}]` : ""}`).join("\n")}

${context ? `\n--- CONTEXTO ADICIONAL DO USUÁRIO ---\n${context}\n` : ""}
`.trim();

    // System prompt for Brazilian financial advisor
    const systemPrompt = `Você é um assistente financeiro inteligente especializado em finanças pessoais brasileiras. Seu nome é "FinanceApp AI" e você trabalha para o aplicativo FinanceApp.

INSTRUÇÕES:
1. Sempre responda em português brasileiro.
2. Use a moeda brasileira (R$ / BRL).
3. Seja amigável, profissional e acolhedor - como um conselheiro financeiro de confiança.
4. Referencie os DADOS REAIS do usuário quando relevante para dar conselhos personalizados.
5. Dê conselhos práticos, acionáveis e realistas baseados na situação financeira do usuário.
6. Quando sugerir economia, calcule valores concretos sempre que possível.
7. Sugira estratégias de otimização de orçamento quando apropriado.
8. Se o usuário pedir para analisar gastos, forneça insights detalhados com base nas categorias.
9. Se perguntarem sobre metas, comente o progresso das metas existentes.
10. Use formatação clara: listas, negrito e emojis quando apropriado para melhorar a legibilidade.
11. Nunca invente dados financeiros - use apenas os dados fornecidos.
12. Se não tiver dados suficientes para responder algo específico, diga isso honestamente.
13. Mantenha respostas concisas mas informativas (2-4 parágrafos no máximo, a menos que o usuário peça detalhamento).
14. Quando relevante, sugira metodologias brasileiras conhecidas como "regra 50-30-20" ou "método do envelope".

Abaixo estão os dados financeiros reais e atuais do usuário:
${financialContext}`;

    // Call LLM
    const zai = await ZAI.create();

    const completion = await zai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      thinking: { type: "disabled" },
    });

    const response = completion.choices[0]?.message?.content;

    if (!response || response.trim().length === 0) {
      return NextResponse.json(
        { error: "Não foi possível gerar uma resposta. Tente novamente." },
        { status: 500 }
      );
    }

    return NextResponse.json({ response: response.trim() });
  } catch (error) {
    console.error("Error in advisor API:", error);
    return NextResponse.json(
      { error: "Erro ao processar sua mensagem. Tente novamente em instantes." },
      { status: 500 }
    );
  }
}
