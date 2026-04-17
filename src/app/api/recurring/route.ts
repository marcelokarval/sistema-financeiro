import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/recurring - List all recurring transactions
export async function GET() {
  try {
    const recurring = await db.recurringTransaction.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        category: true,
        account: true,
        card: true,
      },
    });

    return NextResponse.json(recurring);
  } catch (error) {
    console.error("Error fetching recurring transactions:", error);
    return NextResponse.json(
      { error: "Erro ao buscar transações recorrentes" },
      { status: 500 }
    );
  }
}

// POST /api/recurring - Create recurring transaction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      description,
      amount,
      type,
      frequency,
      nextDate,
      categoryId,
      accountId,
      cardId,
    } = body;

    if (!description || description.trim() === "") {
      return NextResponse.json(
        { error: "A descrição é obrigatória" },
        { status: 400 }
      );
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "O valor deve ser maior que zero" },
        { status: 400 }
      );
    }

    if (!type || !["INCOME", "EXPENSE"].includes(type)) {
      return NextResponse.json(
        { error: "Tipo inválido. Use INCOME ou EXPENSE" },
        { status: 400 }
      );
    }

    if (
      !frequency ||
      !["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"].includes(
        frequency
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Frequência inválida. Use WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY ou YEARLY",
        },
        { status: 400 }
      );
    }

    if (!nextDate) {
      return NextResponse.json(
        { error: "A próxima data é obrigatória" },
        { status: 400 }
      );
    }

    const recurring = await db.recurringTransaction.create({
      data: {
        description: description.trim(),
        amount: Number(amount),
        type,
        frequency,
        nextDate: new Date(nextDate),
        categoryId: categoryId || null,
        accountId: accountId || null,
        cardId: cardId || null,
      },
      include: {
        category: true,
        account: true,
        card: true,
      },
    });

    return NextResponse.json(recurring, { status: 201 });
  } catch (error) {
    console.error("Error creating recurring transaction:", error);
    return NextResponse.json(
      { error: "Erro ao criar transação recorrente" },
      { status: 500 }
    );
  }
}

// PUT /api/recurring - Update recurring transaction
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json(
        { error: "O ID é obrigatório" },
        { status: 400 }
      );
    }

    const existing = await db.recurringTransaction.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Transação recorrente não encontrada" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (data.description !== undefined)
      updateData.description = data.description.trim();
    if (data.amount !== undefined) updateData.amount = Number(data.amount);
    if (data.type !== undefined) updateData.type = data.type;
    if (data.frequency !== undefined) updateData.frequency = data.frequency;
    if (data.nextDate !== undefined)
      updateData.nextDate = new Date(data.nextDate);
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.categoryId !== undefined)
      updateData.categoryId = data.categoryId || null;
    if (data.accountId !== undefined)
      updateData.accountId = data.accountId || null;
    if (data.cardId !== undefined) updateData.cardId = data.cardId || null;

    const recurring = await db.recurringTransaction.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        account: true,
        card: true,
      },
    });

    return NextResponse.json(recurring);
  } catch (error) {
    console.error("Error updating recurring transaction:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar transação recorrente" },
      { status: 500 }
    );
  }
}

// DELETE /api/recurring - Delete recurring transaction
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "O ID é obrigatório" },
        { status: 400 }
      );
    }

    const existing = await db.recurringTransaction.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Transação recorrente não encontrada" },
        { status: 404 }
      );
    }

    await db.recurringTransaction.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: "Transação recorrente excluída",
    });
  } catch (error) {
    console.error("Error deleting recurring transaction:", error);
    return NextResponse.json(
      { error: "Erro ao excluir transação recorrente" },
      { status: 500 }
    );
  }
}
