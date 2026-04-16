import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Valid amount is required" },
        { status: 400 }
      );
    }

    // Verify both accounts exist
    const fromAccount = await db.account.findUnique({ where: { id: fromAccountId } });
    const toAccount = await db.account.findUnique({ where: { id: toAccountId } });

    if (!fromAccount || !toAccount) {
      return NextResponse.json(
        { error: "One or both accounts not found" },
        { status: 404 }
      );
    }

    // Check sufficient balance
    if (fromAccount.balance < amount) {
      return NextResponse.json(
        { error: "Insufficient balance in source account" },
        { status: 400 }
      );
    }

    const transferDate = date ? new Date(date) : new Date();
    const desc = description || `Transferência de ${fromAccount.name} para ${toAccount.name}`;

    // Create withdrawal transaction for source account
    const withdrawalTx = await db.transaction.create({
      data: {
        type: "EXPENSE",
        amount: Number(amount),
        description: desc,
        date: transferDate,
        notes: `Transferência para ${toAccount.name}`,
        accountId: fromAccountId,
      },
      include: { category: true, account: true },
    });

    // Create deposit transaction for destination account
    const depositTx = await db.transaction.create({
      data: {
        type: "INCOME",
        amount: Number(amount),
        description: desc,
        date: transferDate,
        notes: `Transferência de ${fromAccount.name}`,
        accountId: toAccountId,
      },
      include: { category: true, account: true },
    });

    // Update balances
    await db.account.update({
      where: { id: fromAccountId },
      data: { balance: { decrement: Number(amount) } },
    });

    await db.account.update({
      where: { id: toAccountId },
      data: { balance: { increment: Number(amount) } },
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
    console.error("Error processing transfer:", error);
    return NextResponse.json(
      { error: "Failed to process transfer" },
      { status: 500 }
    );
  }
}
