import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

class TransferDomainError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

// POST /api/transfer - Transfer between accounts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fromAccountId, toAccountId, amount, date, description } = body;

    if (!fromAccountId || !toAccountId) {
      return NextResponse.json(
        { error: "From and To account IDs are required" },
        { status: 400 }
      );
    }

    if (fromAccountId === toAccountId) {
      return NextResponse.json(
        { error: "Cannot transfer to the same account" },
        { status: 400 }
      );
    }

    const parsedAmount = typeof amount === "boolean" ? NaN : Number(amount);
    if (
      amount === undefined ||
      amount === null ||
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0
    ) {
      return NextResponse.json(
        { error: "Valid amount is required" },
        { status: 400 }
      );
    }

    if (date !== undefined && date !== null && isNaN(new Date(date).getTime())) {
      return NextResponse.json(
        { error: "Invalid transfer date" },
        { status: 400 }
      );
    }

    const transferDate = date ? new Date(date) : new Date();

    const { withdrawalTx, depositTx } = await db.$transaction(async (tx) => {
      // Acquire write lock upfront in SQLite to prevent SHARED->RESERVED deadlocks under concurrency
      const debited = await tx.account.updateMany({
        where: { id: fromAccountId, balance: { gte: parsedAmount } },
        data: { balance: { decrement: parsedAmount } },
      });

      const [fromAccount, toAccount] = await Promise.all([
        tx.account.findUnique({ where: { id: fromAccountId } }),
        tx.account.findUnique({ where: { id: toAccountId } }),
      ]);

      if (!fromAccount || !toAccount) {
        throw new TransferDomainError("One or both accounts not found", 404);
      }

      if (debited.count === 0) {
        throw new TransferDomainError("Insufficient balance in source account", 400);
      }

      await tx.account.update({
        where: { id: toAccountId },
        data: { balance: { increment: parsedAmount } },
      });

      const desc =
        typeof description === "string" && description.trim() !== ""
          ? description.trim()
          : `Transferência de ${fromAccount.name} para ${toAccount.name}`;

      const withdrawal = await tx.transaction.create({
        data: {
          type: "TRANSFER",
          amount: parsedAmount,
          description: desc,
          date: transferDate,
          notes: `Transferência para ${toAccount.name}`,
          accountId: fromAccountId,
        },
        include: { category: true, account: true },
      });

      const deposit = await tx.transaction.create({
        data: {
          type: "TRANSFER",
          amount: parsedAmount,
          description: desc,
          date: transferDate,
          notes: `Transferência de ${fromAccount.name}`,
          accountId: toAccountId,
        },
        include: { category: true, account: true },
      });

      return { withdrawalTx: withdrawal, depositTx: deposit };
    });

    return NextResponse.json(
      {
        success: true,
        withdrawal: withdrawalTx,
        deposit: depositTx,
        message: "Transferência realizada com sucesso",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof TransferDomainError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error processing transfer:", error);
    return NextResponse.json(
      { error: "Failed to process transfer" },
      { status: 500 }
    );
  }
}
