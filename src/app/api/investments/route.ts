import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/investments - Listar todos os investimentos
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    const where = type ? { type } : {};

    const investments = await db.investment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    });

    return NextResponse.json(investments);
  } catch (error) {
    console.error("Erro ao buscar investimentos:", error);
    return NextResponse.json(
      { error: "Erro ao buscar investimentos" },
      { status: 500 }
    );
  }
}

// POST /api/investments - Criar investimento
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      type,
      description,
      investedAmount,
      currentBalance,
      yieldRate,
      brokerage,
      ticker,
      accountId,
      categoryId,
    } = body;

    if (!name || name.trim() === "") {
      return NextResponse.json(
        { error: "Nome do investimento é obrigatório" },
        { status: 400 }
      );
    }

    if (!type || type.trim() === "") {
      return NextResponse.json(
        { error: "Tipo do investimento é obrigatório" },
        { status: 400 }
      );
    }

    const investment = await db.investment.create({
      data: {
        name: name.trim(),
        type: type.trim(),
        description: description?.trim() ?? "",
        investedAmount: investedAmount ?? 0,
        currentBalance: currentBalance ?? 0,
        yieldRate: yieldRate ?? 0,
        brokerage: brokerage?.trim() ?? "",
        ticker: ticker?.trim() ?? "",
        accountId: accountId ?? null,
        categoryId: categoryId ?? null,
      },
    });

    return NextResponse.json(investment, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar investimento:", error);
    return NextResponse.json(
      { error: "Erro ao criar investimento" },
      { status: 500 }
    );
  }
}

// PUT /api/investments - Atualizar investimento
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      name,
      type,
      description,
      investedAmount,
      currentBalance,
      yieldRate,
      brokerage,
      ticker,
      accountId,
      categoryId,
      isActive,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID do investimento é obrigatório" },
        { status: 400 }
      );
    }

    const existing = await db.investment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Investimento não encontrado" },
        { status: 404 }
      );
    }

    const investment = await db.investment.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(type !== undefined && { type: type.trim() }),
        ...(description !== undefined && { description: description.trim() }),
        ...(investedAmount !== undefined && { investedAmount }),
        ...(currentBalance !== undefined && { currentBalance }),
        ...(yieldRate !== undefined && { yieldRate }),
        ...(brokerage !== undefined && { brokerage: brokerage.trim() }),
        ...(ticker !== undefined && { ticker: ticker.trim() }),
        ...(accountId !== undefined && { accountId: accountId ?? null }),
        ...(categoryId !== undefined && { categoryId: categoryId ?? null }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(investment);
  } catch (error) {
    console.error("Erro ao atualizar investimento:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar investimento" },
      { status: 500 }
    );
  }
}

// DELETE /api/investments - Excluir investimento
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID do investimento é obrigatório" },
        { status: 400 }
      );
    }

    const existing = await db.investment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Investimento não encontrado" },
        { status: 404 }
      );
    }

    await db.investment.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: "Investimento excluído com sucesso",
    });
  } catch (error) {
    console.error("Erro ao excluir investimento:", error);
    return NextResponse.json(
      { error: "Erro ao excluir investimento" },
      { status: 500 }
    );
  }
}
