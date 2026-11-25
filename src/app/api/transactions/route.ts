import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  parseCivilDateEnd,
  parseCivilDateStart,
  parseJsonBody,
  parsePositiveFiniteNumber,
} from "@/lib/api-validation";

class TransactionDomainError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

async function validateTransactionRefs(
  tx: Prisma.TransactionClient,
  refs: { accountId?: unknown; categoryId?: unknown; cardId?: unknown },
  accountMissingStatus: number
): Promise<void> {
  if (typeof refs.accountId === "string" && refs.accountId) {
    const account = await tx.account.findUnique({ where: { id: refs.accountId } });
    if (!account) {
      throw new TransactionDomainError(
        accountMissingStatus === 404 ? "Account not found" : "Conta inválida.",
        accountMissingStatus
      );
    }
  }
  if (typeof refs.categoryId === "string" && refs.categoryId) {
    const category = await tx.category.findUnique({ where: { id: refs.categoryId } });
    if (!category) {
      throw new TransactionDomainError("Categoria inválida.", 400);
    }
  }
  if (typeof refs.cardId === "string" && refs.cardId) {
    const card = await tx.card.findUnique({ where: { id: refs.cardId } });
    if (!card) {
      throw new TransactionDomainError("Cartão inválido.", 400);
    }
  }
}

function isValidOptionalId(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

// GET /api/transactions - List transactions with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const accountId = searchParams.get("accountId");
    const cardId = searchParams.get("cardId");
    const type = searchParams.get("type");
    const categoryId = searchParams.get("categoryId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: Prisma.TransactionWhereInput = {};

    if (accountId) where.accountId = accountId;
    if (cardId) where.cardId = cardId;
    if (type) where.type = type;
    if (categoryId) where.categoryId = categoryId;
    if (from !== null || to !== null) {
      where.date = {};
      if (from !== null) {
        const fromDate = parseCivilDateStart(from);
        if (!fromDate) {
          return NextResponse.json(
            { error: "Data inicial inválida. Use o formato YYYY-MM-DD." },
            { status: 400 }
          );
        }
        where.date.gte = fromDate;
      }
      if (to !== null) {
        const toDate = parseCivilDateEnd(to);
        if (!toDate) {
          return NextResponse.json(
            { error: "Data final inválida. Use o formato YYYY-MM-DD." },
            { status: 400 }
          );
        }
        where.date.lte = toDate;
      }
      if (where.date.gte && where.date.lte && where.date.gte > where.date.lte) {
        return NextResponse.json(
          { error: "Intervalo de datas inválido: 'from' deve ser anterior ou igual a 'to'." },
          { status: 400 }
        );
      }
    }

    const transactions = await db.transaction.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        category: true,
        account: true,
        card: true,
      },
    });

    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

// POST /api/transactions - Create transaction
export async function POST(request: NextRequest) {
  try {
    const parsedBody = await parseJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { type, amount, description, date, notes, categoryId, accountId, cardId } = parsedBody.data;

    if (typeof type !== "string" || !["INCOME", "EXPENSE", "TRANSFER"].includes(type)) {
      return NextResponse.json(
        { error: "Transaction type is required (INCOME, EXPENSE, TRANSFER)" },
        { status: 400 }
      );
    }

    const parsedAmount = parsePositiveFiniteNumber(amount);
    if (parsedAmount === null) {
      return NextResponse.json(
        { error: "Valid amount is required" },
        { status: 400 }
      );
    }

    if (typeof description !== "string" || description.trim() === "") {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    if (!isValidOptionalId(categoryId) || !isValidOptionalId(accountId) || !isValidOptionalId(cardId)) {
      return NextResponse.json(
        { error: "Referência de categoria, conta ou cartão inválida." },
        { status: 400 }
      );
    }

    let resolvedDate = new Date();
    if (date !== undefined && date !== null) {
      if (typeof date !== "string") {
        return NextResponse.json(
          { error: "Invalid transaction date" },
          { status: 400 }
        );
      }
      const parsedDate = parseCivilDateStart(date);
      if (!parsedDate) {
        return NextResponse.json(
          { error: "Invalid transaction date" },
          { status: 400 }
        );
      }
      resolvedDate = parsedDate;
    }

    const transaction = await db.$transaction(async (tx) => {
      await validateTransactionRefs(tx, { accountId, categoryId, cardId }, 404);

      const created = await tx.transaction.create({
        data: {
          type,
          amount: parsedAmount,
          description: description.trim(),
          date: resolvedDate,
          notes: typeof notes === "string" ? notes : "",
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

      // Update account balance if account is specified
      if (accountId) {
        if (type === "INCOME") {
          await tx.account.update({
            where: { id: accountId },
            data: { balance: { increment: parsedAmount } },
          });
        } else if (type === "EXPENSE") {
          await tx.account.update({
            where: { id: accountId },
            data: { balance: { decrement: parsedAmount } },
          });
        }
      }

      return created;
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    if (error instanceof TransactionDomainError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error creating transaction:", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}

// PUT /api/transactions - Update transaction
export async function PUT(request: NextRequest) {
  try {
    const parsedBody = await parseJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { id, type, amount, description, date, notes, categoryId, accountId, cardId } = parsedBody.data;

    if (typeof id !== "string" || !id.trim()) {
      return NextResponse.json(
        { error: "Transaction id is required" },
        { status: 400 }
      );
    }

    if (type !== undefined && (typeof type !== "string" || !["INCOME", "EXPENSE", "TRANSFER"].includes(type))) {
      return NextResponse.json(
        { error: "Transaction type is required (INCOME, EXPENSE, TRANSFER)" },
        { status: 400 }
      );
    }

    let parsedPutAmount: number | undefined;
    if (amount !== undefined) {
      const parsed = parsePositiveFiniteNumber(amount);
      if (parsed === null) {
        return NextResponse.json(
          { error: "Valid amount is required" },
          { status: 400 }
        );
      }
      parsedPutAmount = parsed;
    }

    if (description !== undefined && (typeof description !== "string" || description.trim() === "")) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    if (!isValidOptionalId(categoryId) || !isValidOptionalId(accountId) || !isValidOptionalId(cardId)) {
      return NextResponse.json(
        { error: "Referência de categoria, conta ou cartão inválida." },
        { status: 400 }
      );
    }

    let parsedPutDate: Date | undefined;
    if (date !== undefined) {
      if (date === null) {
        parsedPutDate = new Date();
      } else if (typeof date !== "string") {
        return NextResponse.json(
          { error: "Invalid transaction date" },
          { status: 400 }
        );
      } else {
        const parsed = parseCivilDateStart(date);
        if (!parsed) {
          return NextResponse.json(
            { error: "Invalid transaction date" },
            { status: 400 }
          );
        }
        parsedPutDate = parsed;
      }
    }

    const transaction = await db.$transaction(async (tx) => {
      const existing = await tx.transaction.findUnique({ where: { id } });
      if (!existing) {
        throw new TransactionDomainError("Transaction not found", 404);
      }

      await validateTransactionRefs(tx, { accountId, categoryId, cardId }, 400);

      const newAmount = parsedPutAmount !== undefined ? parsedPutAmount : existing.amount;
      const newType = type || existing.type;
      const newAccountId = accountId !== undefined ? accountId || null : existing.accountId;

      // Revert the old balance change if account is involved
      if (existing.accountId && existing.amount) {
        if (existing.type === "INCOME") {
          await tx.account.update({
            where: { id: existing.accountId },
            data: { balance: { decrement: existing.amount } },
          });
        } else if (existing.type === "EXPENSE") {
          await tx.account.update({
            where: { id: existing.accountId },
            data: { balance: { increment: existing.amount } },
          });
        }
      }

      const updated = await tx.transaction.update({
        where: { id },
        data: {
          ...(type !== undefined && { type }),
          ...(parsedPutAmount !== undefined && { amount: parsedPutAmount }),
          ...(description !== undefined && { description: description.trim() }),
          ...(parsedPutDate !== undefined && { date: parsedPutDate }),
          ...(notes !== undefined && typeof notes === "string" && { notes }),
          ...(categoryId !== undefined && { categoryId: categoryId || null }),
          ...(accountId !== undefined && { accountId: accountId || null }),
          ...(cardId !== undefined && { cardId: cardId || null }),
        },
        include: {
          category: true,
          account: true,
          card: true,
        },
      });

      // Apply the new balance change if account is involved
      if (newAccountId) {
        if (newType === "INCOME") {
          await tx.account.update({
            where: { id: newAccountId },
            data: { balance: { increment: newAmount } },
          });
        } else if (newType === "EXPENSE") {
          await tx.account.update({
            where: { id: newAccountId },
            data: { balance: { decrement: newAmount } },
          });
        }
      }

      return updated;
    });

    return NextResponse.json(transaction);
  } catch (error) {
    if (error instanceof TransactionDomainError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error updating transaction:", error);
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}

// DELETE /api/transactions - Delete transaction
export async function DELETE(request: NextRequest) {
  try {
    let id = new URL(request.url).searchParams.get("id");
    if (!id) {
      const rawBody = await request.text();
      if (rawBody.trim()) {
        try {
          const parsed: unknown = JSON.parse(rawBody);
          if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
            return NextResponse.json(
              { error: "Invalid JSON body" },
              { status: 400 }
            );
          }
          const rawId = (parsed as { id?: unknown }).id;
          id = typeof rawId === "string" ? rawId : null;
        } catch {
          return NextResponse.json(
            { error: "Invalid JSON body" },
            { status: 400 }
          );
        }
      }
    }

    if (!id) {
      return NextResponse.json(
        { error: "Transaction id is required" },
        { status: 400 }
      );
    }

    const existing = await db.transaction.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    await db.$transaction(async (tx) => {
      // Revert the balance change if account is involved
      if (existing.accountId && existing.amount) {
        if (existing.type === "INCOME") {
          await tx.account.update({
            where: { id: existing.accountId },
            data: { balance: { decrement: existing.amount } },
          });
        } else if (existing.type === "EXPENSE") {
          await tx.account.update({
            where: { id: existing.accountId },
            data: { balance: { increment: existing.amount } },
          });
        }
      }

      await tx.transaction.delete({ where: { id } });
    });

    return NextResponse.json({ success: true, message: "Transaction deleted" });
  } catch (error) {
    console.error("Error deleting transaction:", error);
    return NextResponse.json(
      { error: "Failed to delete transaction" },
      { status: 500 }
    );
  }
}
