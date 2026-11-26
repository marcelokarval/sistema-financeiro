import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseJsonBodyLocalized } from "@/lib/api-validation";
import {
  apiErrorResponse,
  resolveRequestLocale,
  translateApiMessage,
} from "@/lib/server-i18n";

class TransferDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

// POST /api/transfer - Transfer between accounts
export async function POST(request: NextRequest) {
  const locale = resolveRequestLocale(request);

  try {
    const parsedBody = await parseJsonBodyLocalized(request, { locale });
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { fromAccountId, toAccountId, amount, date, description } = parsedBody.data;
    const fromId = typeof fromAccountId === "string" ? fromAccountId.trim() : "";
    const toId = typeof toAccountId === "string" ? toAccountId.trim() : "";

    if (!fromId || !toId) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.transfer.accountsRequired"),
        400
      );
    }

    if (fromId === toId) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.transfer.sameAccount"),
        400
      );
    }

    const parsedAmount = typeof amount === "boolean" ? NaN : Number(amount);
    if (
      amount === undefined ||
      amount === null ||
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0
    ) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.transfer.validAmountRequired"),
        400
      );
    }

    if (
      date !== undefined &&
      date !== null &&
      (typeof date !== "string" && typeof date !== "number" ||
        isNaN(new Date(date).getTime()))
    ) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.transfer.invalidDate"),
        400
      );
    }

    const transferDate = date ? new Date(date as string | number) : new Date();

    const { withdrawalTx, depositTx } = await db.$transaction(async (tx) => {
      // Acquire write lock upfront in SQLite to prevent SHARED->RESERVED deadlocks under concurrency
      const debited = await tx.account.updateMany({
        where: { id: fromId, balance: { gte: parsedAmount } },
        data: { balance: { decrement: parsedAmount } },
      });

      const [fromAccount, toAccount] = await Promise.all([
        tx.account.findUnique({ where: { id: fromId } }),
        tx.account.findUnique({ where: { id: toId } }),
      ]);

      if (!fromAccount || !toAccount) {
        throw new TransferDomainError(
          "NOT_FOUND",
          translateApiMessage(locale, "crud.transfer.accountsNotFound"),
          404
        );
      }

      if (debited.count === 0) {
        throw new TransferDomainError(
          "INSUFFICIENT_BALANCE",
          translateApiMessage(locale, "crud.transfer.insufficientBalance"),
          400
        );
      }

      await tx.account.update({
        where: { id: toId },
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
          accountId: fromId,
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
          accountId: toId,
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
        message: translateApiMessage(locale, "crud.transfer.success"),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof TransferDomainError) {
      return apiErrorResponse(error.code, error.message, error.status);
    }
    console.error("Error processing transfer:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "crud.transfer.failed"),
      500
    );
  }
}
