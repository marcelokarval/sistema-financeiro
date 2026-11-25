import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/monthly-budgets?month=7&year=2026
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const now = new Date();
    const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1));
    const year = parseInt(searchParams.get('year') || String(now.getFullYear()));

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Get all budgets for this month/year
    const budgets = await db.monthlyBudget.findMany({
      where: { month, year },
      include: { category: true },
      orderBy: { createdAt: 'asc' },
    });

    // Get all expense transactions for this month/year
    const expenseTransactions = await db.transaction.findMany({
      where: {
        type: 'EXPENSE',
        date: { gte: startDate, lte: endDate },
        categoryId: { in: budgets.map((b) => b.categoryId) },
      },
      select: { categoryId: true, amount: true },
    });

    // Get all purchases for this month/year
    const purchases = await db.purchase.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        categoryId: { in: budgets.map((b) => b.categoryId) },
      },
      select: { categoryId: true, totalAmount: true },
    });

    // Aggregate spent by categoryId
    const spentMap: Record<string, number> = {};
    for (const t of expenseTransactions) {
      if (!t.categoryId) continue;
      spentMap[t.categoryId] = (spentMap[t.categoryId] || 0) + t.amount;
    }
    for (const p of purchases) {
      if (!p.categoryId) continue;
      spentMap[p.categoryId] = (spentMap[p.categoryId] || 0) + p.totalAmount;
    }

    // Build response
    const result = budgets.map((b) => {
      const spent = spentMap[b.categoryId] || 0;
      const remaining = b.amount - spent;
      const percentage = b.amount > 0 ? Math.min((spent / b.amount) * 100, 100) : 0;
      const isOverBudget = spent > b.amount;

      return {
        id: b.id,
        categoryId: b.categoryId,
        categoryName: b.category.name,
        categoryColor: b.category.color,
        categoryIcon: b.category.icon,
        amount: b.amount,
        spent,
        remaining,
        percentage,
        isOverBudget,
      };
    });

    return NextResponse.json({ budgets: result });
  } catch (error) {
    console.error('Erro ao buscar orçamentos mensais:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST /api/monthly-budgets
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { categoryId, amount, month, year } = body;

    if (!categoryId) {
      return NextResponse.json({ error: 'Categoria é obrigatória' }, { status: 400 });
    }
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Valor deve ser maior que zero' }, { status: 400 });
    }
    if (!month || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Mês deve ser entre 1 e 12' }, { status: 400 });
    }
    if (!year || year <= 2020) {
      return NextResponse.json({ error: 'Ano deve ser maior que 2020' }, { status: 400 });
    }

    const budget = await db.monthlyBudget.create({
      data: { categoryId, amount, month, year },
      include: { category: true },
    });

    return NextResponse.json(budget, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Já existe um orçamento para esta categoria neste mês/ano' }, { status: 409 });
    }
    console.error('Erro ao criar orçamento mensal:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// PUT /api/monthly-budgets
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, amount } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    }
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Valor deve ser maior que zero' }, { status: 400 });
    }

    const existing = await db.monthlyBudget.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 });
    }

    const budget = await db.monthlyBudget.update({
      where: { id },
      data: { amount },
      include: { category: true },
    });

    return NextResponse.json(budget);
  } catch (error) {
    console.error('Erro ao atualizar orçamento mensal:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE /api/monthly-budgets?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    }

    const existing = await db.monthlyBudget.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 });
    }

    await db.monthlyBudget.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir orçamento mensal:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
