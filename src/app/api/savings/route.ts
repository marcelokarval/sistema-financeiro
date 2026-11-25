import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/savings - Listar todas as metas de poupança
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    const savingsGoals = await db.savingsGoal.findMany({
      where: {
        ...(type && { type }),
      },
      orderBy: { createdAt: "desc" },
      include: {
        account: {
          select: { id: true, name: true, color: true, icon: true },
        },
      },
    });

    return NextResponse.json(savingsGoals);
  } catch (error) {
    console.error("Erro ao buscar metas de poupança:", error);
    return NextResponse.json(
      { error: "Falha ao buscar metas de poupança" },
      { status: 500 }
    );
  }
}

// POST /api/savings - Criar meta de poupança
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      type,
      targetAmount,
      description,
      currentAmount,
      monthlyContribution,
      yieldRate,
      targetDate,
      accountId,
      color,
    } = body;

    if (!name || name.trim() === "") {
      return NextResponse.json(
        { error: "Nome da meta de poupança é obrigatório" },
        { status: 400 }
      );
    }

    if (targetAmount === undefined || targetAmount <= 0) {
      return NextResponse.json(
        { error: "Valor alvo é obrigatório e deve ser maior que zero" },
        { status: 400 }
      );
    }

    const savingsGoal = await db.savingsGoal.create({
      data: {
        name: name.trim(),
        type: type || "SAVINGS",
        description: description?.trim() || "",
        targetAmount,
        currentAmount: currentAmount ?? 0,
        monthlyContribution: monthlyContribution ?? 0,
        yieldRate: yieldRate ?? 0,
        targetDate: targetDate ? new Date(targetDate) : null,
        accountId: accountId || null,
        color: color || "#22c55e",
      },
      include: {
        account: {
          select: { id: true, name: true, color: true, icon: true },
        },
      },
    });

    return NextResponse.json(savingsGoal, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar meta de poupança:", error);
    return NextResponse.json(
      { error: "Falha ao criar meta de poupança" },
      { status: 500 }
    );
  }
}

// PUT /api/savings - Atualizar meta de poupança
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, type, description, targetAmount, currentAmount, monthlyContribution, yieldRate, targetDate, accountId, color, isCompleted } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID da meta de poupança é obrigatório" },
        { status: 400 }
      );
    }

    const existing = await db.savingsGoal.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Meta de poupança não encontrada" },
        { status: 404 }
      );
    }

    const savingsGoal = await db.savingsGoal.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(type !== undefined && { type }),
        ...(description !== undefined && { description: description?.trim() ?? "" }),
        ...(targetAmount !== undefined && { targetAmount }),
        ...(currentAmount !== undefined && { currentAmount }),
        ...(monthlyContribution !== undefined && { monthlyContribution: monthlyContribution ?? 0 }),
        ...(yieldRate !== undefined && { yieldRate: yieldRate ?? 0 }),
        ...(targetDate !== undefined && { targetDate: targetDate ? new Date(targetDate) : null }),
        ...(accountId !== undefined && { accountId: accountId || null }),
        ...(color !== undefined && { color }),
        ...(isCompleted !== undefined && { isCompleted }),
      },
      include: {
        account: {
          select: { id: true, name: true, color: true, icon: true },
        },
      },
    });

    return NextResponse.json(savingsGoal);
  } catch (error) {
    console.error("Erro ao atualizar meta de poupança:", error);
    return NextResponse.json(
      { error: "Falha ao atualizar meta de poupança" },
      { status: 500 }
    );
  }
}

// DELETE /api/savings - Excluir meta de poupança
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID da meta de poupança é obrigatório" },
        { status: 400 }
      );
    }

    const existing = await db.savingsGoal.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Meta de poupança não encontrada" },
        { status: 404 }
      );
    }

    await db.savingsGoal.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Meta de poupança excluída com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir meta de poupança:", error);
    return NextResponse.json(
      { error: "Falha ao excluir meta de poupança" },
      { status: 500 }
    );
  }
}
