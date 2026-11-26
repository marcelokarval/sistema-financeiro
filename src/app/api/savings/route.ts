import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  mapPrismaErrorLocalized,
  parseCivilDateStart,
  parseFiniteNumber,
  parseJsonBodyLocalized,
  parsePositiveFiniteNumber,
} from "@/lib/api-validation";
import {
  apiErrorResponse,
  apiSuccessMessage,
  resolveRequestLocale,
  translateApiMessage,
} from "@/lib/server-i18n";

const SAVINGS_TYPES = new Set([
  "SAVINGS",
  "PIGGY_BANK",
  "CDI",
  "INVESTMENT",
  "EMERGENCY_FUND",
]);

function parseOptionalNonNegativeNumber(value: unknown): { ok: true; value: number } | { ok: false } {
  if (value === null || value === undefined) {
    return { ok: true, value: 0 };
  }
  const parsed = parseFiniteNumber(value);
  if (parsed === null || parsed < 0) {
    return { ok: false };
  }
  return { ok: true, value: parsed };
}

function parseOptionalTargetDate(value: unknown): { ok: true; value: Date | null } | { ok: false } {
  if (value === null || value === undefined || value === "") {
    return { ok: true, value: null };
  }
  if (typeof value !== "string") {
    return { ok: false };
  }
  const parsed = parseCivilDateStart(value);
  return parsed ? { ok: true, value: parsed } : { ok: false };
}

function parseOptionalAccountId(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === null || value === undefined || value === "") {
    return { ok: true, value: null };
  }
  if (typeof value !== "string" || value.trim() === "") {
    return { ok: false };
  }
  return { ok: true, value: value.trim() };
}

// GET /api/savings - Listar todas as metas de poupança
export async function GET(request: NextRequest) {
  const locale = resolveRequestLocale(request);

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
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "crud.savings.fetchFailed"),
      500
    );
  }
}

// POST /api/savings - Criar meta de poupança
export async function POST(request: NextRequest) {
  const locale = resolveRequestLocale(request);

  try {
    const parsedBody = await parseJsonBodyLocalized(request, { locale });
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

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
    } = parsedBody.data;

    if (typeof name !== "string" || name.trim() === "") {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.savings.nameRequired"),
        400
      );
    }

    const resolvedType = type === undefined || type === null ? "SAVINGS" : type;
    if (typeof resolvedType !== "string" || !SAVINGS_TYPES.has(resolvedType)) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.savings.invalidType"),
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

    const parsedTarget = parsePositiveFiniteNumber(targetAmount);
    if (parsedTarget === null) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.savings.targetPositive"),
        400
      );
    }

    const parsedCurrent = parseOptionalNonNegativeNumber(currentAmount);
    if (!parsedCurrent.ok) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.savings.invalidCurrentAmount"),
        400
      );
    }

    const parsedMonthly = parseOptionalNonNegativeNumber(monthlyContribution);
    if (!parsedMonthly.ok) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.savings.invalidMonthlyContribution"),
        400
      );
    }

    const parsedYield = parseOptionalNonNegativeNumber(yieldRate);
    if (!parsedYield.ok) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.savings.invalidYieldRate"),
        400
      );
    }

    const parsedDate = parseOptionalTargetDate(targetDate);
    if (!parsedDate.ok) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.savings.invalidTargetDate"),
        400
      );
    }

    const parsedAccount = parseOptionalAccountId(accountId);
    if (!parsedAccount.ok) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.savings.invalidLinkedAccount"),
        400
      );
    }

    if (color !== undefined && color !== null && typeof color !== "string") {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "validation.invalidColor"),
        400
      );
    }

    const savingsGoal = await db.savingsGoal.create({
      data: {
        name: name.trim(),
        type: resolvedType,
        description: typeof description === "string" ? description.trim() : "",
        targetAmount: parsedTarget,
        currentAmount: parsedCurrent.value,
        monthlyContribution: parsedMonthly.value,
        yieldRate: parsedYield.value,
        targetDate: parsedDate.value,
        accountId: parsedAccount.value,
        color: typeof color === "string" && color.trim() ? color.trim() : "#22c55e",
      },
      include: {
        account: {
          select: { id: true, name: true, color: true, icon: true },
        },
      },
    });

    return NextResponse.json(savingsGoal, { status: 201 });
  } catch (error) {
    const prismaResponse = mapPrismaErrorLocalized(error, locale, {
      fk: translateApiMessage(locale, "crud.savings.accountNotFound"),
    });
    if (prismaResponse) {
      return prismaResponse;
    }
    console.error("Erro ao criar meta de poupança:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "crud.savings.createFailed"),
      500
    );
  }
}

// PUT /api/savings - Atualizar meta de poupança
export async function PUT(request: NextRequest) {
  const locale = resolveRequestLocale(request);

  try {
    const parsedBody = await parseJsonBodyLocalized(request, { locale });
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const {
      id,
      name,
      type,
      description,
      targetAmount,
      currentAmount,
      monthlyContribution,
      yieldRate,
      targetDate,
      accountId,
      color,
      isCompleted,
    } = parsedBody.data;

    const goalId = typeof id === "string" ? id.trim() : "";
    if (!goalId) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.savings.idRequired"),
        400
      );
    }

    if (name !== undefined && (typeof name !== "string" || name.trim() === "")) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.savings.nameRequired"),
        400
      );
    }

    if (type !== undefined && (typeof type !== "string" || !SAVINGS_TYPES.has(type))) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.savings.invalidType"),
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

    let parsedTarget: number | undefined;
    if (targetAmount !== undefined) {
      const parsed = parsePositiveFiniteNumber(targetAmount);
      if (parsed === null) {
        return apiErrorResponse(
          "VALIDATION_ERROR",
          translateApiMessage(locale, "crud.savings.targetPositiveUpdate"),
          400
        );
      }
      parsedTarget = parsed;
    }

    let parsedCurrent: number | undefined;
    if (currentAmount !== undefined) {
      const parsed = parseFiniteNumber(currentAmount);
      if (parsed === null || parsed < 0) {
        return apiErrorResponse(
          "VALIDATION_ERROR",
          translateApiMessage(locale, "crud.savings.invalidCurrentAmount"),
          400
        );
      }
      parsedCurrent = parsed;
    }

    let parsedMonthly: number | undefined;
    if (monthlyContribution !== undefined) {
      const parsed = parseOptionalNonNegativeNumber(monthlyContribution);
      if (!parsed.ok) {
        return apiErrorResponse(
          "VALIDATION_ERROR",
          translateApiMessage(locale, "crud.savings.invalidMonthlyContribution"),
          400
        );
      }
      parsedMonthly = parsed.value;
    }

    let parsedYield: number | undefined;
    if (yieldRate !== undefined) {
      const parsed = parseOptionalNonNegativeNumber(yieldRate);
      if (!parsed.ok) {
        return apiErrorResponse(
          "VALIDATION_ERROR",
          translateApiMessage(locale, "crud.savings.invalidYieldRate"),
          400
        );
      }
      parsedYield = parsed.value;
    }

    let parsedDate: Date | null | undefined;
    if (targetDate !== undefined) {
      const parsed = parseOptionalTargetDate(targetDate);
      if (!parsed.ok) {
        return apiErrorResponse(
          "VALIDATION_ERROR",
          translateApiMessage(locale, "crud.savings.invalidTargetDate"),
          400
        );
      }
      parsedDate = parsed.value;
    }

    let parsedAccount: string | null | undefined;
    if (accountId !== undefined) {
      const parsed = parseOptionalAccountId(accountId);
      if (!parsed.ok) {
        return apiErrorResponse(
          "VALIDATION_ERROR",
          translateApiMessage(locale, "crud.savings.invalidLinkedAccount"),
          400
        );
      }
      parsedAccount = parsed.value;
    }

    if (color !== undefined && typeof color !== "string") {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "validation.invalidColor"),
        400
      );
    }
    if (isCompleted !== undefined && typeof isCompleted !== "boolean") {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "validation.invalidCompletedFlag"),
        400
      );
    }

    const existing = await db.savingsGoal.findUnique({ where: { id: goalId } });
    if (!existing) {
      return apiErrorResponse(
        "NOT_FOUND",
        translateApiMessage(locale, "crud.savings.notFound"),
        404
      );
    }

    const savingsGoal = await db.savingsGoal.update({
      where: { id: goalId },
      data: {
        ...(name !== undefined && { name: (name as string).trim() }),
        ...(type !== undefined && { type: type as string }),
        ...(description !== undefined && {
          description: typeof description === "string" ? description.trim() : "",
        }),
        ...(parsedTarget !== undefined && { targetAmount: parsedTarget }),
        ...(parsedCurrent !== undefined && { currentAmount: parsedCurrent }),
        ...(parsedMonthly !== undefined && { monthlyContribution: parsedMonthly }),
        ...(parsedYield !== undefined && { yieldRate: parsedYield }),
        ...(parsedDate !== undefined && { targetDate: parsedDate }),
        ...(parsedAccount !== undefined && { accountId: parsedAccount }),
        ...(color !== undefined && { color: (color as string).trim() }),
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
    const prismaResponse = mapPrismaErrorLocalized(error, locale, {
      fk: translateApiMessage(locale, "crud.savings.accountNotFound"),
      notFound: translateApiMessage(locale, "crud.savings.notFound"),
    });
    if (prismaResponse) {
      return prismaResponse;
    }
    console.error("Erro ao atualizar meta de poupança:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "crud.savings.updateFailed"),
      500
    );
  }
}

// DELETE /api/savings - Excluir meta de poupança
export async function DELETE(request: NextRequest) {
  const locale = resolveRequestLocale(request);

  try {
    const parsedBody = await parseJsonBodyLocalized(request, { locale });
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { id } = parsedBody.data;
    const goalId = typeof id === "string" ? id.trim() : "";

    if (!goalId) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.savings.idRequired"),
        400
      );
    }

    const existing = await db.savingsGoal.findUnique({ where: { id: goalId } });
    if (!existing) {
      return apiErrorResponse(
        "NOT_FOUND",
        translateApiMessage(locale, "crud.savings.notFound"),
        404
      );
    }

    await db.savingsGoal.delete({ where: { id: goalId } });

    return apiSuccessMessage(
      translateApiMessage(locale, "crud.savings.deleted")
    );
  } catch (error) {
    const prismaResponse = mapPrismaErrorLocalized(error, locale, {
      notFound: translateApiMessage(locale, "crud.savings.notFound"),
    });
    if (prismaResponse) {
      return prismaResponse;
    }
    console.error("Erro ao excluir meta de poupança:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "crud.savings.deleteFailed"),
      500
    );
  }
}
