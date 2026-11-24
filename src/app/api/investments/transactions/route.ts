import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
    return NextResponse.json(
      { error: "Erro ao buscar transações de investimento" },
      { status: 500 }
    );
  }
}

// POST /api/investments/transactions - Criar transação de investimento
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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
    } = body;

    if (!investmentId) {
      return NextResponse.json(
        { error: "ID do investimento é obrigatório" },
        { status: 400 }
      );
    }

    if (!type || !["APORTE", "DIVIDENDO", "VENDA", "REINVESTIMENTO", "TAXA", "BONUS"].includes(type)) {
      return NextResponse.json(
        { error: "Tipo de transação inválido. Use: APORTE, DIVIDENDO, VENDA, REINVESTIMENTO, TAXA ou BONUS" },
        { status: 400 }
      );
    }

    if (amount === undefined || amount === null) {
      return NextResponse.json(
        { error: "Valor da transação é obrigatório" },
        { status: 400 }
      );
    }

    const investment = await db.investment.findUnique({
      where: { id: investmentId },
    });

    if (!investment) {
      return NextResponse.json(
        { error: "Investimento não encontrado" },
        { status: 404 }
      );
    }

    const transactionType = type as TransactionType;
    const { currentBalanceDelta, investedAmountDelta } = applyTransactionEffect(
      transactionType,
      amount
    );

    const transaction = await db.$transaction(async (tx) => {
      const newTransaction = await tx.investmentTransaction.create({
        data: {
          investmentId,
          type: transactionType,
          amount,
          quantity: quantity ?? 0,
          unitPrice: unitPrice ?? 0,
          date: date ? new Date(date) : new Date(),
          description: description?.trim() ?? "",
          notes: notes?.trim() ?? "",
          accountId: accountId ?? null,
        },
      });

      await tx.investment.update({
        where: { id: investmentId },
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
    return NextResponse.json(
      { error: "Erro ao criar transação de investimento" },
      { status: 500 }
    );
  }
}

// PUT /api/investments/transactions - Atualizar transação de investimento
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
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
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID da transação é obrigatório" },
        { status: 400 }
      );
    }

    if (
      type !== undefined &&
      !["APORTE", "DIVIDENDO", "VENDA", "REINVESTIMENTO", "TAXA", "BONUS"].includes(type)
    ) {
      return NextResponse.json(
        { error: "Tipo de transação inválido. Use: APORTE, DIVIDENDO, VENDA, REINVESTIMENTO, TAXA ou BONUS" },
        { status: 400 }
      );
    }

    const parsedAmount = amount !== undefined ? Number(amount) : undefined;
    if (parsedAmount !== undefined && (!Number.isFinite(parsedAmount) || parsedAmount <= 0)) {
      return NextResponse.json(
        { error: "Valor da transação deve ser maior que zero" },
        { status: 400 }
      );
    }

    if (date !== undefined && date !== null && isNaN(new Date(date).getTime())) {
      return NextResponse.json(
        { error: "Data da transação inválida" },
        { status: 400 }
      );
    }

    const existingTransaction = await db.investmentTransaction.findUnique({
      where: { id },
    });

    if (!existingTransaction) {
      return NextResponse.json(
        { error: "Transação não encontrada" },
        { status: 404 }
      );
    }

    if (investmentId !== undefined && investmentId !== existingTransaction.investmentId) {
      const targetInvestment = await db.investment.findUnique({
        where: { id: investmentId },
      });
      if (!targetInvestment) {
        return NextResponse.json(
          { error: "Investimento não encontrado" },
          { status: 404 }
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
        where: { id: investmentId ?? existingTransaction.investmentId },
        data: {
          currentBalance: { increment: newEffects.currentBalanceDelta },
          investedAmount: { increment: newEffects.investedAmountDelta },
        },
      });

      // Atualizar a transação
      const updatedTransaction = await tx.investmentTransaction.update({
        where: { id },
        data: {
          ...(investmentId !== undefined && { investmentId }),
          ...(type !== undefined && { type }),
          ...(parsedAmount !== undefined && { amount: parsedAmount }),
          ...(quantity !== undefined && { quantity }),
          ...(unitPrice !== undefined && { unitPrice }),
          ...(date !== undefined && { date: new Date(date) }),
          ...(description !== undefined && { description: description.trim() }),
          ...(notes !== undefined && { notes: notes.trim() }),
          ...(accountId !== undefined && { accountId: accountId ?? null }),
        },
      });

      return updatedTransaction;
    });

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("Erro ao atualizar transação de investimento:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar transação de investimento" },
      { status: 500 }
    );
  }
}

// DELETE /api/investments/transactions - Excluir transação de investimento
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
            { error: "Corpo JSON inválido" },
            { status: 400 }
          );
        }
      }
    }

    if (!id) {
      return NextResponse.json(
        { error: "ID da transação é obrigatório" },
        { status: 400 }
      );
    }

    const existingTransaction = await db.investmentTransaction.findUnique({
      where: { id },
    });

    if (!existingTransaction) {
      return NextResponse.json(
        { error: "Transação não encontrada" },
        { status: 404 }
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

    return NextResponse.json({
      success: true,
      message: "Transação excluída com sucesso",
    });
  } catch (error) {
    console.error("Erro ao excluir transação de investimento:", error);
    return NextResponse.json(
      { error: "Erro ao excluir transação de investimento" },
      { status: 500 }
    );
  }
}
