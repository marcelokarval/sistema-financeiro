import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  mapPrismaErrorLocalized,
  parseJsonBodyLocalized,
  parsePositiveFiniteNumber,
} from "@/lib/api-validation";
import {
  apiErrorResponse,
  resolveRequestLocale,
  translateApiMessage,
} from "@/lib/server-i18n";

class DepositDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

// POST /api/savings/deposit - Depositar em meta de poupança
export async function POST(request: NextRequest) {
  const locale = resolveRequestLocale(request);

  try {
    const parsedBody = await parseJsonBodyLocalized(request, { locale });
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { savingsGoalId, amount, description } = parsedBody.data;

    const goalId = typeof savingsGoalId === "string" ? savingsGoalId.trim() : "";
    if (!goalId) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.savings.idRequired"),
        400
      );
    }

    const parsedAmount = parsePositiveFiniteNumber(amount);
    if (parsedAmount === null) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.savings.depositAmountPositive"),
        400
      );
    }

    if (description !== undefined && description !== null && typeof description !== "string") {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "validation.invalidDescription"),
        400
      );
    }

    const depositDescription =
      typeof description === "string" && description.trim() !== ""
        ? description.trim()
        : translateApiMessage(locale, "crud.savings.depositDefaultDescription");

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
          throw new DepositDomainError(
            "NOT_FOUND",
            translateApiMessage(locale, "crud.savings.notFound"),
            404
          );
        }
        throw new DepositDomainError(
          "GOAL_COMPLETED",
          translateApiMessage(locale, "crud.savings.goalAlreadyCompleted"),
          400
        );
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
      return apiErrorResponse(error.code, error.message, error.status);
    }
    const prismaResponse = mapPrismaErrorLocalized(error, locale, {
      notFound: translateApiMessage(locale, "crud.savings.notFound"),
    });
    if (prismaResponse) {
      return prismaResponse;
    }
    console.error("Erro ao depositar na meta de poupança:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "crud.savings.depositFailed"),
      500
    );
  }
}
