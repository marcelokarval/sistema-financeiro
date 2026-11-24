import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthsParam = searchParams.get('months');
    const months = Math.min(Math.max(parseInt(monthsParam || '6', 10) || 6, 1), 24);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Date range for the requested months
    const startDate = new Date(currentYear, currentMonth - (months - 1), 1);
    const endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    // Fetch all transactions and purchases in range
    const [allTransactions, allPurchases, allCategories] = await Promise.all([
      db.transaction.findMany({
        where: { date: { gte: startDate, lte: endDate } },
        select: {
          id: true,
          type: true,
          amount: true,
          date: true,
          description: true,
          categoryId: true,
        },
        orderBy: { date: 'desc' },
      }),
      db.purchase.findMany({
        where: { date: { gte: startDate, lte: endDate } },
        select: {
          id: true,
          totalAmount: true,
          date: true,
          merchant: true,
          categoryId: true,
        },
        orderBy: { date: 'desc' },
      }),
      db.category.findMany({
        where: { isActive: true },
        select: { id: true, name: true, color: true },
      }),
    ]);

    const categoryMap = new Map(allCategories.map((c) => [c.id, c]));

    // Build monthly comparison data
    const monthlyData: {
      month: string;
      income: number;
      expense: number;
      net: number;
      transactionCount: number;
      purchaseCount: number;
      avgDailySpend: number;
      savingsRate: number;
      daysInMonth: number;
      daysElapsed: number;
    }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date(currentYear, currentMonth - i, 1);
      const monthEnd = new Date(currentYear, currentMonth - i + 1, 0, 23, 59, 59, 999);
      const daysInMonth = new Date(currentYear, currentMonth - i + 1, 0).getDate();
      const daysElapsed = i === 0 ? now.getDate() : daysInMonth;

      const label = monthStart.toLocaleString('pt-BR', {
        month: 'short',
        year: '2-digit',
      });

      // Filter transactions for this month
      const monthTxns = allTransactions.filter(
        (t) => t.date >= monthStart && t.date <= monthEnd
      );
      const monthPurchases = allPurchases.filter(
        (p) => p.date >= monthStart && p.date <= monthEnd
      );

      const income = monthTxns
        .filter((t) => t.type === 'INCOME')
        .reduce((sum, t) => sum + t.amount, 0);

      const txnExpense = monthTxns
        .filter((t) => t.type === 'EXPENSE')
        .reduce((sum, t) => sum + t.amount, 0);

      const purchaseExpense = monthPurchases.reduce(
        (sum, p) => sum + p.totalAmount, 0
      );

      const expense = txnExpense + purchaseExpense;
      const net = income - expense;
      const transactionCount = monthTxns.length;
      const purchaseCount = monthPurchases.length;
      const avgDailySpend = daysElapsed > 0 ? expense / daysElapsed : 0;
      const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;

      monthlyData.push({
        month: label,
        income,
        expense,
        net,
        transactionCount,
        purchaseCount,
        avgDailySpend,
        savingsRate,
        daysInMonth,
        daysElapsed,
      });
    }

    // Top expense category across the entire period
    const categoryExpenses = new Map<string, { name: string; color: string; total: number; count: number }>();

    for (const t of allTransactions) {
      if (t.type === 'EXPENSE' && t.categoryId && categoryMap.has(t.categoryId)) {
        const cat = categoryMap.get(t.categoryId)!;
        const existing = categoryExpenses.get(t.categoryId) || { name: cat.name, color: cat.color, total: 0, count: 0 };
        existing.total += t.amount;
        existing.count += 1;
        categoryExpenses.set(t.categoryId, existing);
      }
    }

    for (const p of allPurchases) {
      if (p.categoryId && categoryMap.has(p.categoryId)) {
        const cat = categoryMap.get(p.categoryId)!;
        const existing = categoryExpenses.get(p.categoryId) || { name: cat.name, color: cat.color, total: 0, count: 0 };
        existing.total += p.totalAmount;
        existing.count += 1;
        categoryExpenses.set(p.categoryId, existing);
      }
    }

    const sortedCategories = Array.from(categoryExpenses.values()).sort((a, b) => b.total - a.total);
    const topExpenseCategory = sortedCategories[0] || null;
    const topCategories = sortedCategories.slice(0, 3);

    // Average daily spend (current month)
    const currentMonthData = monthlyData[monthlyData.length - 1];
    const avgDailySpend = currentMonthData?.avgDailySpend || 0;

    // Highest expense transaction
    const expenseTransactions = allTransactions.filter((t) => t.type === 'EXPENSE');
    const expensePurchases = allPurchases.map((p) => ({
      id: p.id,
      description: p.merchant,
      amount: p.totalAmount,
      date: p.date,
    }));

    const allExpenses = [
      ...expenseTransactions.map((t) => ({
        id: t.id,
        description: t.description,
        amount: t.amount,
        date: t.date,
      })),
      ...expensePurchases,
    ].sort((a, b) => b.amount - a.amount);

    const highestExpense = allExpenses[0] || null;

    // Lowest income transaction (menor receita)
    const incomeTransactions = allTransactions
      .filter((t) => t.type === 'INCOME')
      .sort((a, b) => a.amount - b.amount);
    const lowestIncome = incomeTransactions[0] || null;

    // Savings rate trend (per month)
    const savingsRateTrend = monthlyData.map((m) => ({
      month: m.month,
      rate: m.savingsRate,
    }));

    // Ticket médio (average expense per transaction/purchase)
    const totalExpenseCount = expenseTransactions.length + allPurchases.length;
    const totalExpenseAmount = expenseTransactions.reduce((s, t) => s + t.amount, 0)
      + allPurchases.reduce((s, p) => s + p.totalAmount, 0);
    const ticketMedio = totalExpenseCount > 0 ? totalExpenseAmount / totalExpenseCount : 0;

    return NextResponse.json({
      monthlyData,
      topExpenseCategory,
      topCategories,
      avgDailySpend,
      highestExpense,
      lowestIncome,
      savingsRateTrend,
      ticketMedio,
    });
  } catch (error) {
    console.error('Error fetching reports data:', error);
    return NextResponse.json(
      { error: 'Falha ao buscar dados dos relatórios' },
      { status: 500 }
    );
  }
}
