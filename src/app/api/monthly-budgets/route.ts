import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  mapPrismaError,
  parseFiniteNumber,
  parseJsonBody,
  parsePositiveFiniteNumber,
} from '@/lib/api-validation';

function parseMonthValue(value: unknown): number | null {
  const parsed = parseFiniteNumber(value);
  if (parsed === null || !Number.isInteger(parsed) || parsed < 1 || parsed > 12) {
    return null;
  }
  return parsed;
}

function parseYearValue(value: unknown, minYear: number): number | null {
  const parsed = parseFiniteNumber(value);
  if (parsed === null || !Number.isInteger(parsed) || parsed < minYear || parsed > 2100) {
    return null;
  }
  return parsed;
}

// GET /api/monthly-budgets?month=7&year=2026
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const now = new Date();
    const monthParam = searchParams.get('month');
    const yearParam = searchParams.get('year');

    const month = monthParam !== null ? parseMonthValue(monthParam) : now.getMonth() + 1;
    if (month === null) {
      return NextResponse.json({ error: 'Mês deve ser um inteiro entre 1 e 12' }, { status: 400 });
    }

    const year = yearParam !== null ? parseYearValue(yearParam, 2000) : now.getFullYear();
    if (year === null) {
      return NextResponse.json({ error: 'Ano inválido' }, { status: 400 });
    }

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
    const parsedBody = await parseJsonBody(req);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { categoryId, amount, month, year } = parsedBody.data;

    const validCategoryId = typeof categoryId === 'string' ? categoryId.trim() : '';
    if (!validCategoryId) {
      return NextResponse.json({ error: 'Categoria é obrigatória' }, { status: 400 });
    }

    const parsedAmount = parsePositiveFiniteNumber(amount);
    if (parsedAmount === null) {
      return NextResponse.json({ error: 'Valor deve ser maior que zero' }, { status: 400 });
    }

    const parsedMonth = parseMonthValue(month);
    if (parsedMonth === null) {
      return NextResponse.json({ error: 'Mês deve ser entre 1 e 12' }, { status: 400 });
    }

    const parsedYear = parseYearValue(year, 2021);
    if (parsedYear === null) {
      return NextResponse.json({ error: 'Ano deve ser maior que 2020' }, { status: 400 });
    }

    const budget = await db.monthlyBudget.create({
      data: {
        categoryId: validCategoryId,
        amount: parsedAmount,
        month: parsedMonth,
        year: parsedYear,
      },
      include: { category: true },
    });

    return NextResponse.json(budget, { status: 201 });
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Já existe um orçamento para esta categoria neste mês/ano' },
        { status: 409 }
      );
    }
    const prismaResponse = mapPrismaError(error, { fk: 'Categoria não encontrada' });
    if (prismaResponse) {
      return prismaResponse;
    }
    console.error('Erro ao criar orçamento mensal:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// PUT /api/monthly-budgets
export async function PUT(req: NextRequest) {
  try {
    const parsedBody = await parseJsonBody(req);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { id, amount } = parsedBody.data;
    const budgetId = typeof id === 'string' ? id.trim() : '';

    if (!budgetId) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    }

    const parsedAmount = parsePositiveFiniteNumber(amount);
    if (parsedAmount === null) {
      return NextResponse.json({ error: 'Valor deve ser maior que zero' }, { status: 400 });
    }

    const existing = await db.monthlyBudget.findUnique({ where: { id: budgetId } });
    if (!existing) {
      return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 });
    }

    const budget = await db.monthlyBudget.update({
      where: { id: budgetId },
      data: { amount: parsedAmount },
      include: { category: true },
    });

    return NextResponse.json(budget);
  } catch (error) {
    const prismaResponse = mapPrismaError(error, { notFound: 'Orçamento não encontrado' });
    if (prismaResponse) {
      return prismaResponse;
    }
    console.error('Erro ao atualizar orçamento mensal:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE /api/monthly-budgets?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id')?.trim() ?? '';

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
    const prismaResponse = mapPrismaError(error, { notFound: 'Orçamento não encontrado' });
    if (prismaResponse) {
      return prismaResponse;
    }
    console.error('Erro ao excluir orçamento mensal:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
