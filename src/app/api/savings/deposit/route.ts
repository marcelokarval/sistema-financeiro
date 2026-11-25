import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  mapPrismaError,
  parseJsonBody,
  parsePositiveFiniteNumber,
} from "@/lib/api-validation";

class DepositDomainError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

// POST /api/savings/deposit - Depositar em meta de poupança
export async function POST(request: NextRequest) {
  try {
    const parsedBody = await parseJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { savingsGoalId, amount, description } = parsedBody.data;

    const goalId = typeof savingsGoalId === "string" ? savingsGoalId.trim() : "";
    if (!goalId) {
      return NextResponse.json(
        { error: "ID da meta de poupança é obrigatório" },
        { status: 400 }
      );
    }

    const parsedAmount = parsePositiveFiniteNumber(amount);
    if (parsedAmount === null) {
      return NextResponse.json(
        { error: "Valor do depósito é obrigatório e deve ser maior que zero" },
        { status: 400 }
      );
    }

    if (description !== undefined && description !== null && typeof description !== "string") {
      return NextResponse.json(
        { error: "Descrição inválida" },
        { status: 400 }
      );
    }

    const depositDescription =
      typeof description === "string" && description.trim() !== ""
        ? description.trim()
        : "Depósito";

    const { updatedGoal, goalCompleted } = await db.$transaction(async (tx) => {
      // Atualiza atomicamente primeiro para evitar lost update e deadlock de upgrade de lock no SQLite
      const updatedCount = await tx.savingsGoal.updateMany({
        where: { id: goalId, isCompleted: false },
        data: { currentAmount: { increment: parsedAmount } },
      });

      if (updatedCount.count === 0) {
        const existing = await tx.savingsGoal.findUnique({
          where: { id: goalId },
          select: { id: true, isCompleted: true },
        });
        if (!existing) {
          throw new DepositDomainError("Meta de poupança não encontrada", 404);
        }
        throw new DepositDomainError("Esta meta de poupança já foi concluída", 400);
      }

      let goal = await tx.savingsGoal.findUniqueOrThrow({
        where: { id: goalId },
        include: {
          account: {
            select: { id: true, name: true, color: true, icon: true },
          },
        },
      });

      const completedNow = goal.currentAmount >= goal.targetAmount;
      if (completedNow && !goal.isCompleted) {
        goal = await tx.savingsGoal.update({
          where: { id: goalId },
          data: { isCompleted: true },
          include: {
            account: {
              select: { id: true, name: true, color: true, icon: true },
            },
          },
        });
      }

      return { updatedGoal: goal, goalCompleted: completedNow };
    });

    return NextResponse.json({
      ...updatedGoal,
      depositAmount: parsedAmount,
      depositDescription,
      goalCompleted,
    });
  } catch (error) {
    if (error instanceof DepositDomainError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const prismaResponse = mapPrismaError(error, {
      notFound: "Meta de poupança não encontrada",
    });
    if (prismaResponse) {
      return prismaResponse;
    }
    console.error("Erro ao depositar na meta de poupança:", error);
    return NextResponse.json(
      { error: "Falha ao depositar na meta de poupança" },
      { status: 500 }
    );
  }
}
