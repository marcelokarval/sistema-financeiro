import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  mapPrismaError,
  parseCivilDateStart,
  parseFiniteNumber,
  parseJsonBody,
  parsePositiveFiniteNumber,
} from "@/lib/api-validation";

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
    const parsedBody = await parseJsonBody(request);
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
      return NextResponse.json(
        { error: "Nome da meta de poupança é obrigatório" },
        { status: 400 }
      );
    }

    const resolvedType = type === undefined || type === null ? "SAVINGS" : type;
    if (typeof resolvedType !== "string" || !SAVINGS_TYPES.has(resolvedType)) {
      return NextResponse.json(
        { error: "Tipo da meta de poupança inválido" },
        { status: 400 }
      );
    }

    if (description !== undefined && description !== null && typeof description !== "string") {
      return NextResponse.json({ error: "Descrição inválida" }, { status: 400 });
    }

    const parsedTarget = parsePositiveFiniteNumber(targetAmount);
    if (parsedTarget === null) {
      return NextResponse.json(
        { error: "Valor alvo é obrigatório e deve ser maior que zero" },
        { status: 400 }
      );
    }

    const parsedCurrent = parseOptionalNonNegativeNumber(currentAmount);
    if (!parsedCurrent.ok) {
      return NextResponse.json({ error: "Valor atual inválido" }, { status: 400 });
    }

    const parsedMonthly = parseOptionalNonNegativeNumber(monthlyContribution);
    if (!parsedMonthly.ok) {
      return NextResponse.json({ error: "Contribuição mensal inválida" }, { status: 400 });
    }

    const parsedYield = parseOptionalNonNegativeNumber(yieldRate);
    if (!parsedYield.ok) {
      return NextResponse.json({ error: "Taxa de rendimento inválida" }, { status: 400 });
    }

    const parsedDate = parseOptionalTargetDate(targetDate);
    if (!parsedDate.ok) {
      return NextResponse.json({ error: "Data alvo inválida" }, { status: 400 });
    }

    const parsedAccount = parseOptionalAccountId(accountId);
    if (!parsedAccount.ok) {
      return NextResponse.json({ error: "Conta vinculada inválida" }, { status: 400 });
    }

    if (color !== undefined && color !== null && typeof color !== "string") {
      return NextResponse.json({ error: "Cor inválida" }, { status: 400 });
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
    const prismaResponse = mapPrismaError(error, {
      fk: "Conta vinculada não encontrada",
    });
    if (prismaResponse) {
      return prismaResponse;
    }
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
    const parsedBody = await parseJsonBody(request);
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
      return NextResponse.json(
        { error: "ID da meta de poupança é obrigatório" },
        { status: 400 }
      );
    }

    if (name !== undefined && (typeof name !== "string" || name.trim() === "")) {
      return NextResponse.json(
        { error: "Nome da meta de poupança é obrigatório" },
        { status: 400 }
      );
    }

    if (type !== undefined && (typeof type !== "string" || !SAVINGS_TYPES.has(type))) {
      return NextResponse.json(
        { error: "Tipo da meta de poupança inválido" },
        { status: 400 }
      );
    }

    if (description !== undefined && description !== null && typeof description !== "string") {
      return NextResponse.json({ error: "Descrição inválida" }, { status: 400 });
    }

    let parsedTarget: number | undefined;
    if (targetAmount !== undefined) {
      const parsed = parsePositiveFiniteNumber(targetAmount);
      if (parsed === null) {
        return NextResponse.json(
          { error: "Valor alvo deve ser maior que zero" },
          { status: 400 }
        );
      }
      parsedTarget = parsed;
    }

    let parsedCurrent: number | undefined;
    if (currentAmount !== undefined) {
      const parsed = parseFiniteNumber(currentAmount);
      if (parsed === null || parsed < 0) {
        return NextResponse.json({ error: "Valor atual inválido" }, { status: 400 });
      }
      parsedCurrent = parsed;
    }

    let parsedMonthly: number | undefined;
    if (monthlyContribution !== undefined) {
      const parsed = parseOptionalNonNegativeNumber(monthlyContribution);
      if (!parsed.ok) {
        return NextResponse.json({ error: "Contribuição mensal inválida" }, { status: 400 });
      }
      parsedMonthly = parsed.value;
    }

    let parsedYield: number | undefined;
    if (yieldRate !== undefined) {
      const parsed = parseOptionalNonNegativeNumber(yieldRate);
      if (!parsed.ok) {
        return NextResponse.json({ error: "Taxa de rendimento inválida" }, { status: 400 });
      }
      parsedYield = parsed.value;
    }

    let parsedDate: Date | null | undefined;
    if (targetDate !== undefined) {
      const parsed = parseOptionalTargetDate(targetDate);
      if (!parsed.ok) {
        return NextResponse.json({ error: "Data alvo inválida" }, { status: 400 });
      }
      parsedDate = parsed.value;
    }

    let parsedAccount: string | null | undefined;
    if (accountId !== undefined) {
      const parsed = parseOptionalAccountId(accountId);
      if (!parsed.ok) {
        return NextResponse.json({ error: "Conta vinculada inválida" }, { status: 400 });
      }
      parsedAccount = parsed.value;
    }

    if (color !== undefined && typeof color !== "string") {
      return NextResponse.json({ error: "Cor inválida" }, { status: 400 });
    }
    if (isCompleted !== undefined && typeof isCompleted !== "boolean") {
      return NextResponse.json({ error: "Flag de conclusão inválida" }, { status: 400 });
    }

    const existing = await db.savingsGoal.findUnique({ where: { id: goalId } });
    if (!existing) {
      return NextResponse.json(
        { error: "Meta de poupança não encontrada" },
        { status: 404 }
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
    const prismaResponse = mapPrismaError(error, {
      fk: "Conta vinculada não encontrada",
      notFound: "Meta de poupança não encontrada",
    });
    if (prismaResponse) {
      return prismaResponse;
    }
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
    const parsedBody = await parseJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { id } = parsedBody.data;
    const goalId = typeof id === "string" ? id.trim() : "";

    if (!goalId) {
      return NextResponse.json(
        { error: "ID da meta de poupança é obrigatório" },
        { status: 400 }
      );
    }

    const existing = await db.savingsGoal.findUnique({ where: { id: goalId } });
    if (!existing) {
      return NextResponse.json(
        { error: "Meta de poupança não encontrada" },
        { status: 404 }
      );
    }

    await db.savingsGoal.delete({ where: { id: goalId } });

    return NextResponse.json({ success: true, message: "Meta de poupança excluída com sucesso" });
  } catch (error) {
    const prismaResponse = mapPrismaError(error, {
      notFound: "Meta de poupança não encontrada",
    });
    if (prismaResponse) {
      return prismaResponse;
    }
    console.error("Erro ao excluir meta de poupança:", error);
    return NextResponse.json(
      { error: "Falha ao excluir meta de poupança" },
      { status: 500 }
    );
  }
}
