import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/savings/deposit - Depositar em meta de poupança
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { savingsGoalId, amount, description } = body;

    if (!savingsGoalId) {
      return NextResponse.json(
        { error: "ID da meta de poupança é obrigatório" },
        { status: 400 }
      );
    }

    if (amount === undefined || amount <= 0) {
      return NextResponse.json(
        { error: "Valor do depósito é obrigatório e deve ser maior que zero" },
        { status: 400 }
      );
    }

    const savingsGoal = await db.savingsGoal.findUnique({
      where: { id: savingsGoalId },
    });

    if (!savingsGoal) {
      return NextResponse.json(
        { error: "Meta de poupança não encontrada" },
        { status: 404 }
      );
    }

    if (savingsGoal.isCompleted) {
      return NextResponse.json(
        { error: "Esta meta de poupança já foi concluída" },
        { status: 400 }
      );
    }

    const newCurrentAmount = savingsGoal.currentAmount + amount;
    const goalCompleted = newCurrentAmount >= savingsGoal.targetAmount;

    const updatedGoal = await db.savingsGoal.update({
      where: { id: savingsGoalId },
      data: {
        currentAmount: newCurrentAmount,
        ...(goalCompleted && { isCompleted: true }),
      },
      include: {
        account: {
          select: { id: true, name: true, color: true, icon: true },
        },
      },
    });

    return NextResponse.json({
      ...updatedGoal,
      depositAmount: amount,
      depositDescription: description || "Depósito",
      goalCompleted,
    });
  } catch (error) {
    console.error("Erro ao depositar na meta de poupança:", error);
    return NextResponse.json(
      { error: "Falha ao depositar na meta de poupança" },
      { status: 500 }
    );
  }
}
