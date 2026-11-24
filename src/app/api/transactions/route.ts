import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

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
    if (from || to) {
      where.date = {};
      if (from) {
        where.date.gte = new Date(from);
      }
      if (to) {
        // Include the entire end day
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.date.lte = toDate;
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
    const body = await request.json();
    const { type, amount, description, date, notes, categoryId, accountId, cardId } = body;

    if (!type) {
      return NextResponse.json(
        { error: "Transaction type is required (INCOME, EXPENSE, TRANSFER)" },
        { status: 400 }
      );
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Valid amount is required" },
        { status: 400 }
      );
    }

    if (!description || description.trim() === "") {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    const transaction = await db.transaction.create({
      data: {
        type,
        amount: Number(amount),
        description: description.trim(),
        date: date ? new Date(date) : new Date(),
        notes: notes || "",
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
        await db.account.update({
          where: { id: accountId },
          data: { balance: { increment: Number(amount) } },
        });
      } else if (type === "EXPENSE") {
        await db.account.update({
          where: { id: accountId },
          data: { balance: { decrement: Number(amount) } },
        });
      }
    }

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
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
    const body = await request.json();
    const { id, type, amount, description, date, notes, categoryId, accountId, cardId } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Transaction id is required" },
        { status: 400 }
      );
    }

    if (type !== undefined && !["INCOME", "EXPENSE", "TRANSFER"].includes(type)) {
      return NextResponse.json(
        { error: "Transaction type is required (INCOME, EXPENSE, TRANSFER)" },
        { status: 400 }
      );
    }

    if (amount !== undefined && (!Number.isFinite(Number(amount)) || Number(amount) <= 0)) {
      return NextResponse.json(
        { error: "Valid amount is required" },
        { status: 400 }
      );
    }

    if (description !== undefined && (typeof description !== "string" || description.trim() === "")) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    if (date !== undefined && date !== null && isNaN(new Date(date).getTime())) {
      return NextResponse.json(
        { error: "Invalid transaction date" },
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

    const newAmount = amount !== undefined ? Number(amount) : existing.amount;
    const newType = type || existing.type;
    const newAccountId = accountId !== undefined ? accountId || null : existing.accountId;

    const transaction = await db.$transaction(async (tx) => {
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
          ...(amount !== undefined && { amount: newAmount }),
          ...(description !== undefined && { description: description.trim() }),
          ...(date !== undefined && { date: date ? new Date(date) : new Date() }),
          ...(notes !== undefined && { notes }),
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
          const parsed = JSON.parse(rawBody) as { id?: string };
          id = parsed.id ?? null;
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
