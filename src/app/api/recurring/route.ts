import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  mapPrismaError,
  parseCivilDateStart,
  parseJsonBody,
  parsePositiveFiniteNumber,
} from "@/lib/api-validation";

const VALID_RECURRING_TYPES = ["INCOME", "EXPENSE"] as const;
const VALID_RECURRING_FREQUENCIES = [
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
] as const;

function parseOptionalId(
  value: unknown
): { valid: true; value: string | null } | { valid: false } {
  if (value === undefined || value === null) {
    return { valid: true, value: null };
  }
  if (typeof value !== "string") {
    return { valid: false };
  }
  const trimmed = value.trim();
  return { valid: true, value: trimmed || null };
}

async function validateRecurringRelations(ids: {
  categoryId?: string | null;
  accountId?: string | null;
  cardId?: string | null;
}): Promise<NextResponse | null> {
  if (ids.categoryId) {
    const category = await db.category.findUnique({
      where: { id: ids.categoryId },
      select: { id: true },
    });
    if (!category) {
      return NextResponse.json({ error: "Categoria não encontrada" }, { status: 400 });
    }
  }
  if (ids.accountId) {
    const account = await db.account.findUnique({
      where: { id: ids.accountId },
      select: { id: true },
    });
    if (!account) {
      return NextResponse.json({ error: "Conta não encontrada" }, { status: 400 });
    }
  }
  if (ids.cardId) {
    const card = await db.card.findUnique({
      where: { id: ids.cardId },
      select: { id: true },
    });
    if (!card) {
      return NextResponse.json({ error: "Cartão não encontrado" }, { status: 400 });
    }
  }
  return null;
}

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
    const parsedBody = await parseJsonBody(request, "Corpo da requisição JSON inválido.");
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const {
      description,
      amount,
      type,
      frequency,
      nextDate,
      categoryId,
      accountId,
      cardId,
    } = parsedBody.data;

    if (typeof description !== "string" || description.trim() === "") {
      return NextResponse.json(
        { error: "A descrição é obrigatória" },
        { status: 400 }
      );
    }

    const parsedAmount = parsePositiveFiniteNumber(amount);
    if (parsedAmount === null) {
      return NextResponse.json(
        { error: "O valor deve ser maior que zero" },
        { status: 400 }
      );
    }

    if (
      typeof type !== "string" ||
      !VALID_RECURRING_TYPES.includes(type as (typeof VALID_RECURRING_TYPES)[number])
    ) {
      return NextResponse.json(
        { error: "Tipo inválido. Use INCOME ou EXPENSE" },
        { status: 400 }
      );
    }

    if (
      typeof frequency !== "string" ||
      !VALID_RECURRING_FREQUENCIES.includes(
        frequency as (typeof VALID_RECURRING_FREQUENCIES)[number]
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

    if (typeof nextDate !== "string" || !nextDate.trim()) {
      return NextResponse.json(
        { error: "A próxima data é obrigatória" },
        { status: 400 }
      );
    }
    const parsedNextDate = parseCivilDateStart(nextDate);
    if (parsedNextDate === null) {
      return NextResponse.json(
        { error: "A próxima data é inválida" },
        { status: 400 }
      );
    }

    const parsedCategoryId = parseOptionalId(categoryId);
    const parsedAccountId = parseOptionalId(accountId);
    const parsedCardId = parseOptionalId(cardId);
    if (!parsedCategoryId.valid || !parsedAccountId.valid || !parsedCardId.valid) {
      return NextResponse.json(
        { error: "Identificador de vínculo inválido" },
        { status: 400 }
      );
    }

    const relationError = await validateRecurringRelations({
      categoryId: parsedCategoryId.value,
      accountId: parsedAccountId.value,
      cardId: parsedCardId.value,
    });
    if (relationError) {
      return relationError;
    }

    const recurring = await db.recurringTransaction.create({
      data: {
        description: description.trim(),
        amount: parsedAmount,
        type,
        frequency,
        nextDate: parsedNextDate,
        categoryId: parsedCategoryId.value,
        accountId: parsedAccountId.value,
        cardId: parsedCardId.value,
      },
      include: {
        category: true,
        account: true,
        card: true,
      },
    });

    return NextResponse.json(recurring, { status: 201 });
  } catch (error) {
    const mapped = mapPrismaError(error);
    if (mapped) return mapped;
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
    const parsedBody = await parseJsonBody(request, "Corpo da requisição JSON inválido.");
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { id, ...data } = parsedBody.data;

    if (typeof id !== "string" || id.trim() === "") {
      return NextResponse.json(
        { error: "O ID é obrigatório" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (data.description !== undefined) {
      if (typeof data.description !== "string" || data.description.trim() === "") {
        return NextResponse.json(
          { error: "A descrição é obrigatória" },
          { status: 400 }
        );
      }
      updateData.description = data.description.trim();
    }
    if (data.amount !== undefined) {
      const parsedAmount = parsePositiveFiniteNumber(data.amount);
      if (parsedAmount === null) {
        return NextResponse.json(
          { error: "O valor deve ser maior que zero" },
          { status: 400 }
        );
      }
      updateData.amount = parsedAmount;
    }
    if (data.type !== undefined) {
      if (
        typeof data.type !== "string" ||
        !VALID_RECURRING_TYPES.includes(
          data.type as (typeof VALID_RECURRING_TYPES)[number]
        )
      ) {
        return NextResponse.json(
          { error: "Tipo inválido. Use INCOME ou EXPENSE" },
          { status: 400 }
        );
      }
      updateData.type = data.type;
    }
    if (data.frequency !== undefined) {
      if (
        typeof data.frequency !== "string" ||
        !VALID_RECURRING_FREQUENCIES.includes(
          data.frequency as (typeof VALID_RECURRING_FREQUENCIES)[number]
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
      updateData.frequency = data.frequency;
    }
    if (data.nextDate !== undefined) {
      if (typeof data.nextDate !== "string") {
        return NextResponse.json(
          { error: "A próxima data é inválida" },
          { status: 400 }
        );
      }
      const parsedNextDate = parseCivilDateStart(data.nextDate);
      if (parsedNextDate === null) {
        return NextResponse.json(
          { error: "A próxima data é inválida" },
          { status: 400 }
        );
      }
      updateData.nextDate = parsedNextDate;
    }
    if (data.isActive !== undefined) {
      if (typeof data.isActive !== "boolean") {
        return NextResponse.json(
          { error: "Valor de isActive inválido" },
          { status: 400 }
        );
      }
      updateData.isActive = data.isActive;
    }

    const parsedCategoryId =
      data.categoryId !== undefined ? parseOptionalId(data.categoryId) : undefined;
    const parsedAccountId =
      data.accountId !== undefined ? parseOptionalId(data.accountId) : undefined;
    const parsedCardId =
      data.cardId !== undefined ? parseOptionalId(data.cardId) : undefined;
    if (
      (parsedCategoryId && !parsedCategoryId.valid) ||
      (parsedAccountId && !parsedAccountId.valid) ||
      (parsedCardId && !parsedCardId.valid)
    ) {
      return NextResponse.json(
        { error: "Identificador de vínculo inválido" },
        { status: 400 }
      );
    }

    if (parsedCategoryId && parsedCategoryId.valid) {
      updateData.categoryId = parsedCategoryId.value;
    }
    if (parsedAccountId && parsedAccountId.valid) {
      updateData.accountId = parsedAccountId.value;
    }
    if (parsedCardId && parsedCardId.valid) {
      updateData.cardId = parsedCardId.value;
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

    const relationError = await validateRecurringRelations({
      categoryId: parsedCategoryId && parsedCategoryId.valid ? parsedCategoryId.value : null,
      accountId: parsedAccountId && parsedAccountId.valid ? parsedAccountId.value : null,
      cardId: parsedCardId && parsedCardId.valid ? parsedCardId.value : null,
    });
    if (relationError) {
      return relationError;
    }

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
    const mapped = mapPrismaError(error);
    if (mapped) return mapped;
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
    const parsedBody = await parseJsonBody(request, "Corpo da requisição JSON inválido.");
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { id } = parsedBody.data;

    if (typeof id !== "string" || id.trim() === "") {
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
    const mapped = mapPrismaError(error);
    if (mapped) return mapped;
    console.error("Error deleting recurring transaction:", error);
    return NextResponse.json(
      { error: "Erro ao excluir transação recorrente" },
      { status: 500 }
    );
  }
}
