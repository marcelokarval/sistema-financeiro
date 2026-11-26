import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseJsonBodyLocalized } from "@/lib/api-validation";
import {
  apiErrorResponse,
  apiSuccessMessage,
  resolveRequestLocale,
  translateApiMessage,
} from "@/lib/server-i18n";

type TransactionType =
  | "APORTE"
  | "DIVIDENDO"
  | "VENDA"
  | "REINVESTIMENTO"
  | "TAXA"
  | "BONUS";

function applyTransactionEffect(
  type: TransactionType,
  amount: number
): { currentBalanceDelta: number; investedAmountDelta: number } {
  switch (type) {
    case "APORTE":
      return { currentBalanceDelta: amount, investedAmountDelta: amount };
    case "VENDA":
      return { currentBalanceDelta: -amount, investedAmountDelta: 0 };
    case "DIVIDENDO":
    case "BONUS":
      return { currentBalanceDelta: amount, investedAmountDelta: 0 };
    case "REINVESTIMENTO":
      return { currentBalanceDelta: amount, investedAmountDelta: amount };
    case "TAXA":
      return { currentBalanceDelta: -amount, investedAmountDelta: 0 };
    default:
      return { currentBalanceDelta: 0, investedAmountDelta: 0 };
  }
}

// GET /api/investments/transactions - Listar transações de investimento
export async function GET(request: NextRequest) {
  const locale = resolveRequestLocale(request);

  try {
    const { searchParams } = new URL(request.url);
    const investmentId = searchParams.get("investmentId");

    const where = investmentId ? { investmentId } : {};

    const transactions = await db.investmentTransaction.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        investment: {
          select: { id: true, name: true, type: true },
        },
        account: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Erro ao buscar transações de investimento:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "crud.investments.txFetchFailed"),
      500
    );
  }
}

// POST /api/investments/transactions - Criar transação de investimento
export async function POST(request: NextRequest) {
  const locale = resolveRequestLocale(request);

  try {
    const parsedBody = await parseJsonBodyLocalized(request, { locale });
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const {
      investmentId,
      type,
      amount,
      quantity,
      unitPrice,
      date,
      description,
      notes,
      accountId,
    } = parsedBody.data;

    const resolvedInvestmentId =
      typeof investmentId === "string" ? investmentId.trim() : "";

    if (!resolvedInvestmentId) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.investments.idRequired"),
        400
      );
    }

    if (
      typeof type !== "string" ||
      !["APORTE", "DIVIDENDO", "VENDA", "REINVESTIMENTO", "TAXA", "BONUS"].includes(type)
    ) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.investments.txInvalidType"),
        400
      );
    }

    if (amount === undefined || amount === null) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.investments.txAmountRequired"),
        400
      );
    }

    const parsedAmount = typeof amount === "boolean" ? NaN : Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.investments.txAmountPositive"),
        400
      );
    }

    if (
      date !== undefined &&
      date !== null &&
      ((typeof date !== "string" && typeof date !== "number") ||
        isNaN(new Date(date).getTime()))
    ) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.investments.txInvalidDate"),
        400
      );
    }

    const investment = await db.investment.findUnique({
      where: { id: resolvedInvestmentId },
    });

    if (!investment) {
      return apiErrorResponse(
        "NOT_FOUND",
        translateApiMessage(locale, "crud.investments.notFound"),
        404
      );
    }

    const transactionType = type as TransactionType;
    const { currentBalanceDelta, investedAmountDelta } = applyTransactionEffect(
      transactionType,
      parsedAmount
    );

    const transaction = await db.$transaction(async (tx) => {
      const newTransaction = await tx.investmentTransaction.create({
        data: {
          investmentId: resolvedInvestmentId,
          type: transactionType,
          amount: parsedAmount,
          quantity: typeof quantity === "number" ? quantity : 0,
          unitPrice: typeof unitPrice === "number" ? unitPrice : 0,
          date: date ? new Date(date as string | number) : new Date(),
          description: typeof description === "string" ? description.trim() : "",
          notes: typeof notes === "string" ? notes.trim() : "",
          accountId: typeof accountId === "string" && accountId.trim() ? accountId.trim() : null,
        },
      });

      await tx.investment.update({
        where: { id: resolvedInvestmentId },
        data: {
          currentBalance: { increment: currentBalanceDelta },
          investedAmount: { increment: investedAmountDelta },
        },
      });

      return newTransaction;
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar transação de investimento:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "crud.investments.txCreateFailed"),
      500
    );
  }
}

// PUT /api/investments/transactions - Atualizar transação de investimento
export async function PUT(request: NextRequest) {
  const locale = resolveRequestLocale(request);

  try {
    const parsedBody = await parseJsonBodyLocalized(request, { locale });
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const {
      id,
      investmentId,
      type,
      amount,
      quantity,
      unitPrice,
      date,
      description,
      notes,
      accountId,
    } = parsedBody.data;

    const txId = typeof id === "string" ? id.trim() : "";
    if (!txId) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.investments.txIdRequired"),
        400
      );
    }

    if (
      type !== undefined &&
      (typeof type !== "string" ||
        !["APORTE", "DIVIDENDO", "VENDA", "REINVESTIMENTO", "TAXA", "BONUS"].includes(type))
    ) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.investments.txInvalidType"),
        400
      );
    }

    const parsedAmount =
      amount !== undefined
        ? typeof amount === "boolean"
          ? NaN
          : Number(amount)
        : undefined;
    if (parsedAmount !== undefined && (!Number.isFinite(parsedAmount) || parsedAmount <= 0)) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.investments.txAmountPositive"),
        400
      );
    }

    if (
      date !== undefined &&
      date !== null &&
      ((typeof date !== "string" && typeof date !== "number") ||
        isNaN(new Date(date).getTime()))
    ) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.investments.txInvalidDate"),
        400
      );
    }

    const existingTransaction = await db.investmentTransaction.findUnique({
      where: { id: txId },
    });

    if (!existingTransaction) {
      return apiErrorResponse(
        "NOT_FOUND",
        translateApiMessage(locale, "crud.investments.txNotFound"),
        404
      );
    }

    const resolvedTargetInvestmentId =
      typeof investmentId === "string" ? investmentId : undefined;
    if (
      resolvedTargetInvestmentId !== undefined &&
      resolvedTargetInvestmentId !== existingTransaction.investmentId
    ) {
      const targetInvestment = await db.investment.findUnique({
        where: { id: resolvedTargetInvestmentId },
      });
      if (!targetInvestment) {
        return apiErrorResponse(
          "NOT_FOUND",
          translateApiMessage(locale, "crud.investments.notFound"),
          404
        );
      }
    }

    // Desfazer efeito antigo
    const oldType = existingTransaction.type as TransactionType;
    const oldAmount = existingTransaction.amount;
    const oldEffects = applyTransactionEffect(oldType, oldAmount);

    const transaction = await db.$transaction(async (tx) => {
      // Desfazer efeito antigo no investimento
      await tx.investment.update({
        where: { id: existingTransaction.investmentId },
        data: {
          currentBalance: { increment: -oldEffects.currentBalanceDelta },
          investedAmount: { increment: -oldEffects.investedAmountDelta },
        },
      });

      // Determinar novo tipo e valor para aplicar o novo efeito
      const newType = (type ?? existingTransaction.type) as TransactionType;
      const newAmount = parsedAmount ?? existingTransaction.amount;
      const newEffects = applyTransactionEffect(newType, newAmount);

      // Aplicar novo efeito no investimento
      await tx.investment.update({
        where: { id: resolvedTargetInvestmentId ?? existingTransaction.investmentId },
        data: {
          currentBalance: { increment: newEffects.currentBalanceDelta },
          investedAmount: { increment: newEffects.investedAmountDelta },
        },
      });

      // Atualizar a transação
      const updatedTransaction = await tx.investmentTransaction.update({
        where: { id: txId },
        data: {
          ...(resolvedTargetInvestmentId !== undefined && {
            investmentId: resolvedTargetInvestmentId,
          }),
          ...(type !== undefined && { type }),
          ...(parsedAmount !== undefined && { amount: parsedAmount }),
          ...(typeof quantity === "number" && { quantity }),
          ...(typeof unitPrice === "number" && { unitPrice }),
          ...(date !== undefined && { date: new Date(date as string | number) }),
          ...(typeof description === "string" && { description: description.trim() }),
          ...(typeof notes === "string" && { notes: notes.trim() }),
          ...(accountId !== undefined && {
            accountId: typeof accountId === "string" && accountId.trim() ? accountId.trim() : null,
          }),
        },
      });

      return updatedTransaction;
    });

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("Erro ao atualizar transação de investimento:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "crud.investments.txUpdateFailed"),
      500
    );
  }
}

// DELETE /api/investments/transactions - Excluir transação de investimento
export async function DELETE(request: NextRequest) {
  const locale = resolveRequestLocale(request);

  try {
    let id = new URL(request.url).searchParams.get("id");
    if (!id) {
      const rawBody = await request.text();
      if (rawBody.trim()) {
        try {
          const parsed: unknown = JSON.parse(rawBody);
          if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
            return apiErrorResponse(
              "INVALID_JSON",
              translateApiMessage(locale, "validation.invalidJson"),
              400
            );
          }
          const rawId = (parsed as { id?: unknown }).id;
          id = typeof rawId === "string" ? rawId : null;
        } catch {
          return apiErrorResponse(
            "INVALID_JSON",
            translateApiMessage(locale, "validation.invalidJson"),
            400
          );
        }
      }
    }

    if (!id) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.investments.txIdRequired"),
        400
      );
    }

    const existingTransaction = await db.investmentTransaction.findUnique({
      where: { id },
    });

    if (!existingTransaction) {
      return apiErrorResponse(
        "NOT_FOUND",
        translateApiMessage(locale, "crud.investments.txNotFound"),
        404
      );
    }

    // Desfazer efeito da transação no investimento
    const oldType = existingTransaction.type as TransactionType;
    const oldEffects = applyTransactionEffect(oldType, existingTransaction.amount);

    await db.$transaction(async (tx) => {
      await tx.investment.update({
        where: { id: existingTransaction.investmentId },
        data: {
          currentBalance: { increment: -oldEffects.currentBalanceDelta },
          investedAmount: { increment: -oldEffects.investedAmountDelta },
        },
      });

      await tx.investmentTransaction.delete({
        where: { id },
      });
    });

    return apiSuccessMessage(
      translateApiMessage(locale, "crud.investments.txDeleted")
    );
  } catch (error) {
    console.error("Erro ao excluir transação de investimento:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "crud.investments.txDeleteFailed"),
      500
    );
  }
}
