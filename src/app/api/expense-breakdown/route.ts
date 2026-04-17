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

    // Fetch all transactions (EXPENSE), purchases, and categories in range
    const [expenseTransactions, allPurchases, allCategories] = await Promise.all([
      db.transaction.findMany({
        where: {
          type: 'EXPENSE',
          date: { gte: startDate, lte: endDate },
        },
        select: {
          id: true,
          amount: true,
          date: true,
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

    // Aggregate expenses by category
    const categoryExpenses = new Map<
      string,
      {
        categoryId: string;
        categoryName: string;
        categoryColor: string;
        total: number;
        transactionCount: number;
        purchaseCount: number;
        monthlyTotals: Map<string, number>;
      }
    >();

    // Process EXPENSE transactions
    for (const t of expenseTransactions) {
      const catId = t.categoryId || 'uncategorized';
      const cat = categoryMap.get(catId);
      const name = cat?.name || 'Sem Categoria';
      const color = cat?.color || '#6b7280';

      if (!categoryExpenses.has(catId)) {
        categoryExpenses.set(catId, {
          categoryId: catId,
          categoryName: name,
          categoryColor: color,
          total: 0,
          transactionCount: 0,
          purchaseCount: 0,
          monthlyTotals: new Map(),
        });
      }

      const entry = categoryExpenses.get(catId)!;
      entry.total += t.amount;
      entry.transactionCount += 1;

      const monthKey = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
      entry.monthlyTotals.set(monthKey, (entry.monthlyTotals.get(monthKey) || 0) + t.amount);
    }

    // Process purchases
    for (const p of allPurchases) {
      const catId = p.categoryId || 'uncategorized';
      const cat = categoryMap.get(catId);
      const name = cat?.name || 'Sem Categoria';
      const color = cat?.color || '#6b7280';

      if (!categoryExpenses.has(catId)) {
        categoryExpenses.set(catId, {
          categoryId: catId,
          categoryName: name,
          categoryColor: color,
          total: 0,
          transactionCount: 0,
          purchaseCount: 0,
          monthlyTotals: new Map(),
        });
      }

      const entry = categoryExpenses.get(catId)!;
      entry.total += p.totalAmount;
      entry.purchaseCount += 1;

      const monthKey = `${p.date.getFullYear()}-${String(p.date.getMonth() + 1).padStart(2, '0')}`;
      entry.monthlyTotals.set(monthKey, (entry.monthlyTotals.get(monthKey) || 0) + p.totalAmount);
    }

    // Sort by total descending
    const sortedCategories = Array.from(categoryExpenses.values()).sort((a, b) => b.total - a.total);

    // Compute total expense
    const totalExpense = sortedCategories.reduce((sum, c) => sum + c.total, 0);

    // Compute percentages and include monthly breakdown per category
    const categories = sortedCategories.map((cat) => ({
      categoryId: cat.categoryId,
      categoryName: cat.categoryName,
      categoryColor: cat.categoryColor,
      total: cat.total,
      percentage: totalExpense > 0 ? (cat.total / totalExpense) * 100 : 0,
      transactionCount: cat.transactionCount,
      purchaseCount: cat.purchaseCount,
    }));

    // Top category
    const topCategory = categories[0] || null;

    // Build monthly data array
    const monthlyData = [];
    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date(currentYear, currentMonth - i, 1);
      const monthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
      const label = monthStart.toLocaleString('pt-BR', {
        month: 'short',
        year: '2-digit',
      });

      let monthExpense = 0;
      for (const t of expenseTransactions) {
        const tKey = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
        if (tKey === monthKey) monthExpense += t.amount;
      }
      for (const p of allPurchases) {
        const pKey = `${p.date.getFullYear()}-${String(p.date.getMonth() + 1).padStart(2, '0')}`;
        if (pKey === monthKey) monthExpense += p.totalAmount;
      }

      monthlyData.push({
        month: label,
        monthKey,
        total: monthExpense,
      });
    }

    return NextResponse.json({
      categories,
      totalExpense,
      topCategory,
      monthlyData,
    });
  } catch (error) {
    console.error('Erro ao buscar detalhamento de despesas:', error);
    return NextResponse.json(
      { error: 'Falha ao buscar detalhamento de despesas' },
      { status: 500 }
    );
  }
}
