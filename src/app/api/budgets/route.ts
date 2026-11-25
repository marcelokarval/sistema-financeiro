import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  mapPrismaError,
  parseCivilDateStart,
  parseFiniteNumber,
  parseJsonBody,
  parsePositiveFiniteNumber,
} from "@/lib/api-validation";

function parseDateValue(value: unknown): Date | null {
  if (typeof value !== "string") {
    return null;
  }
  return parseCivilDateStart(value);
}

// GET /api/budgets - List all budget goals
export async function GET() {
  try {
    const budgetGoals = await db.budgetGoal.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        category: true,
      },
    });
    return NextResponse.json(budgetGoals);
  } catch (error) {
    console.error("Error fetching budget goals:", error);
    return NextResponse.json(
      { error: "Failed to fetch budget goals" },
      { status: 500 }
    );
  }
}

// POST /api/budgets - Create budget goal
export async function POST(request: NextRequest) {
  try {
    const parsedBody = await parseJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const {
      name,
      description,
      targetAmount,
      currentAmount,
      categoryId,
      startDate,
      endDate,
    } = parsedBody.data;

    if (typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "O nome da meta é obrigatório" },
        { status: 400 }
      );
    }

    if (description !== undefined && description !== null && typeof description !== "string") {
      return NextResponse.json({ error: "Descrição inválida" }, { status: 400 });
    }

    const parsedTarget = parsePositiveFiniteNumber(targetAmount);
    if (parsedTarget === null) {
      return NextResponse.json(
        { error: "O valor alvo deve ser maior que zero" },
        { status: 400 }
      );
    }

    let parsedCurrent = 0;
    if (currentAmount !== undefined && currentAmount !== null) {
      const parsed = parseFiniteNumber(currentAmount);
      if (parsed === null || parsed < 0) {
        return NextResponse.json(
          { error: "O valor atual deve ser um número válido não negativo" },
          { status: 400 }
        );
      }
      parsedCurrent = parsed;
    }

    let resolvedCategoryId: string | null = null;
    if (categoryId !== undefined && categoryId !== null && categoryId !== "") {
      if (typeof categoryId !== "string" || categoryId.trim() === "") {
        return NextResponse.json({ error: "Categoria inválida" }, { status: 400 });
      }
      resolvedCategoryId = categoryId.trim();
    }

    let resolvedStartDate = new Date();
    if (startDate !== undefined && startDate !== null && startDate !== "") {
      const parsed = parseDateValue(startDate);
      if (!parsed) {
        return NextResponse.json({ error: "Data inicial inválida" }, { status: 400 });
      }
      resolvedStartDate = parsed;
    }

    let resolvedEndDate: Date | null = null;
    if (endDate !== undefined && endDate !== null && endDate !== "") {
      const parsed = parseDateValue(endDate);
      if (!parsed) {
        return NextResponse.json({ error: "Data final inválida" }, { status: 400 });
      }
      resolvedEndDate = parsed;
    }

    const budgetGoal = await db.budgetGoal.create({
      data: {
        name: name.trim(),
        description: typeof description === "string" ? description.trim() : "",
        targetAmount: parsedTarget,
        currentAmount: parsedCurrent,
        categoryId: resolvedCategoryId,
        startDate: resolvedStartDate,
        endDate: resolvedEndDate,
      },
      include: { category: true },
    });

    return NextResponse.json(budgetGoal, { status: 201 });
  } catch (error) {
    const prismaResponse = mapPrismaError(error, { fk: "Categoria não encontrada" });
    if (prismaResponse) {
      return prismaResponse;
    }
    console.error("Error creating budget goal:", error);
    return NextResponse.json(
      { error: "Failed to create budget goal" },
      { status: 500 }
    );
  }
}

// PUT /api/budgets - Update budget goal
export async function PUT(request: NextRequest) {
  try {
    const parsedBody = await parseJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const {
      id,
      name,
      description,
      targetAmount,
      currentAmount,
      categoryId,
      startDate,
      endDate,
      isCompleted,
    } = parsedBody.data;

    const budgetId = typeof id === "string" ? id.trim() : "";
    if (!budgetId) {
      return NextResponse.json(
        { error: "O ID da meta é obrigatório" },
        { status: 400 }
      );
    }

    if (name !== undefined && (typeof name !== "string" || name.trim() === "")) {
      return NextResponse.json(
        { error: "O nome da meta é obrigatório" },
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
          { error: "O valor alvo deve ser maior que zero" },
          { status: 400 }
        );
      }
      parsedTarget = parsed;
    }

    let parsedCurrent: number | undefined;
    if (currentAmount !== undefined) {
      const parsed = parseFiniteNumber(currentAmount);
      if (parsed === null || parsed < 0) {
        return NextResponse.json(
          { error: "O valor atual deve ser um número válido não negativo" },
          { status: 400 }
        );
      }
      parsedCurrent = parsed;
    }

    let resolvedCategoryId: string | null | undefined;
    if (categoryId !== undefined) {
      if (categoryId === null || categoryId === "") {
        resolvedCategoryId = null;
      } else if (typeof categoryId === "string" && categoryId.trim() !== "") {
        resolvedCategoryId = categoryId.trim();
      } else {
        return NextResponse.json({ error: "Categoria inválida" }, { status: 400 });
      }
    }

    let resolvedStartDate: Date | undefined;
    if (startDate !== undefined) {
      const parsed = parseDateValue(startDate);
      if (!parsed) {
        return NextResponse.json({ error: "Data inicial inválida" }, { status: 400 });
      }
      resolvedStartDate = parsed;
    }

    let resolvedEndDate: Date | null | undefined;
    if (endDate !== undefined) {
      if (endDate === null || endDate === "") {
        resolvedEndDate = null;
      } else {
        const parsed = parseDateValue(endDate);
        if (!parsed) {
          return NextResponse.json({ error: "Data final inválida" }, { status: 400 });
        }
        resolvedEndDate = parsed;
      }
    }

    if (isCompleted !== undefined && typeof isCompleted !== "boolean") {
      return NextResponse.json({ error: "Flag de conclusão inválida" }, { status: 400 });
    }

    const existing = await db.budgetGoal.findUnique({ where: { id: budgetId } });
    if (!existing) {
      return NextResponse.json(
        { error: "Meta não encontrada" },
        { status: 404 }
      );
    }

    const budgetGoal = await db.budgetGoal.update({
      where: { id: budgetId },
      data: {
        ...(name !== undefined && { name: (name as string).trim() }),
        ...(description !== undefined && {
          description: typeof description === "string" ? description.trim() : "",
        }),
        ...(parsedTarget !== undefined && { targetAmount: parsedTarget }),
        ...(parsedCurrent !== undefined && { currentAmount: parsedCurrent }),
        ...(resolvedCategoryId !== undefined && { categoryId: resolvedCategoryId }),
        ...(resolvedStartDate !== undefined && { startDate: resolvedStartDate }),
        ...(resolvedEndDate !== undefined && { endDate: resolvedEndDate }),
        ...(isCompleted !== undefined && { isCompleted }),
      },
      include: { category: true },
    });

    return NextResponse.json(budgetGoal);
  } catch (error) {
    const prismaResponse = mapPrismaError(error, {
      fk: "Categoria não encontrada",
      notFound: "Meta não encontrada",
    });
    if (prismaResponse) {
      return prismaResponse;
    }
    console.error("Error updating budget goal:", error);
    return NextResponse.json(
      { error: "Failed to update budget goal" },
      { status: 500 }
    );
  }
}

// DELETE /api/budgets - Delete budget goal
export async function DELETE(request: NextRequest) {
  try {
    const parsedBody = await parseJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { id } = parsedBody.data;
    const budgetId = typeof id === "string" ? id.trim() : "";

    if (!budgetId) {
      return NextResponse.json(
        { error: "O ID da meta é obrigatório" },
        { status: 400 }
      );
    }

    const existing = await db.budgetGoal.findUnique({ where: { id: budgetId } });
    if (!existing) {
      return NextResponse.json(
        { error: "Meta não encontrada" },
        { status: 404 }
      );
    }

    await db.budgetGoal.delete({ where: { id: budgetId } });

    return NextResponse.json({ success: true, message: "Meta excluída com sucesso" });
  } catch (error) {
    const prismaResponse = mapPrismaError(error, { notFound: "Meta não encontrada" });
    if (prismaResponse) {
      return prismaResponse;
    }
    console.error("Error deleting budget goal:", error);
    return NextResponse.json(
      { error: "Failed to delete budget goal" },
      { status: 500 }
    );
  }
}
