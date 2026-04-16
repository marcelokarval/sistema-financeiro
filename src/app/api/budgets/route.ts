import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
    const body = await request.json();
    const { name, description, targetAmount, currentAmount, categoryId, startDate, endDate } = body;

    if (!name || name.trim() === "") {
      return NextResponse.json(
        { error: "O nome da meta é obrigatório" },
        { status: 400 }
      );
    }

    if (!targetAmount || targetAmount <= 0) {
      return NextResponse.json(
        { error: "O valor alvo deve ser maior que zero" },
        { status: 400 }
      );
    }

    const budgetGoal = await db.budgetGoal.create({
      data: {
        name: name.trim(),
        description: description?.trim() || "",
        targetAmount: parseFloat(targetAmount),
        currentAmount: parseFloat(currentAmount) || 0,
        categoryId: categoryId || null,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
      },
      include: { category: true },
    });

    return NextResponse.json(budgetGoal, { status: 201 });
  } catch (error) {
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
    const body = await request.json();
    const { id, name, description, targetAmount, currentAmount, categoryId, startDate, endDate, isCompleted } = body;

    if (!id) {
      return NextResponse.json(
        { error: "O ID da meta é obrigatório" },
        { status: 400 }
      );
    }

    const existing = await db.budgetGoal.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Meta não encontrada" },
        { status: 404 }
      );
    }

    const budgetGoal = await db.budgetGoal.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description.trim() }),
        ...(targetAmount !== undefined && { targetAmount: parseFloat(targetAmount) }),
        ...(currentAmount !== undefined && { currentAmount: parseFloat(currentAmount) }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(isCompleted !== undefined && { isCompleted }),
      },
      include: { category: true },
    });

    return NextResponse.json(budgetGoal);
  } catch (error) {
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
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "O ID da meta é obrigatório" },
        { status: 400 }
      );
    }

    const existing = await db.budgetGoal.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Meta não encontrada" },
        { status: 404 }
      );
    }

    await db.budgetGoal.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Meta excluída com sucesso" });
  } catch (error) {
    console.error("Error deleting budget goal:", error);
    return NextResponse.json(
      { error: "Failed to delete budget goal" },
      { status: 500 }
    );
  }
}
