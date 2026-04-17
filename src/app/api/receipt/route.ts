import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const currencyFmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);

const dateFmt = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));

const translateType = (type: string) => {
  const map: Record<string, string> = {
    INCOME: "Receita",
    EXPENSE: "Despesa",
    TRANSFER: "Transferência",
  };
  return map[type] || type;
};

// GET /api/receipt?type=transaction|purchase&id=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const id = searchParams.get("id");

    if (!type || !id) {
      return NextResponse.json(
        { error: "Parâmetros 'type' e 'id' são obrigatórios." },
        { status: 400 }
      );
    }

    if (type === "transaction") {
      const transaction = await db.transaction.findUnique({
        where: { id },
        include: {
          category: true,
          account: true,
          card: true,
        },
      });

      if (!transaction) {
        return NextResponse.json(
          { error: "Transação não encontrada." },
          { status: 404 }
        );
      }

      const receipt = {
        receiptType: "transaction",
        receiptNumber: `TXN-${transaction.id.slice(0, 8).toUpperCase()}`,
        issuedAt: new Date().toISOString(),
        data: {
          id: transaction.id,
          type: translateType(transaction.type),
          rawType: transaction.type,
          description: transaction.description,
          amount: currencyFmt(transaction.amount),
          amountRaw: transaction.amount,
          date: dateFmt(transaction.date),
          category: transaction.category?.name || "Sem categoria",
          categoryColor: transaction.category?.color || "#6b7280",
          account: transaction.account?.name || "N/A",
          accountColor: transaction.account?.color || "#6b7280",
          card: transaction.card
            ? `${transaction.card.name} •••• ${transaction.card.lastFourDigits}`
            : null,
          notes: transaction.notes || null,
        },
      };

      return NextResponse.json(receipt);
    }

    if (type === "purchase") {
      const purchase = await db.purchase.findUnique({
        where: { id },
        include: {
          items: {
            orderBy: { createdAt: "asc" },
          },
          card: true,
          category: true,
        },
      });

      if (!purchase) {
        return NextResponse.json(
          { error: "Compra não encontrada." },
          { status: 404 }
        );
      }

      const receipt = {
        receiptType: "purchase",
        receiptNumber: `PRC-${purchase.id.slice(0, 8).toUpperCase()}`,
        issuedAt: new Date().toISOString(),
        data: {
          id: purchase.id,
          merchant: purchase.merchant,
          totalAmount: currencyFmt(purchase.totalAmount),
          totalAmountRaw: purchase.totalAmount,
          date: dateFmt(purchase.date),
          category: purchase.category?.name || "Sem categoria",
          categoryColor: purchase.category?.color || "#6b7280",
          card: purchase.card
            ? `${purchase.card.name} •••• ${purchase.card.lastFourDigits}`
            : null,
          cardBrand: purchase.card?.brand || null,
          installment:
            purchase.installmentTotal > 1
              ? `${purchase.installmentNumber}/${purchase.installmentTotal}`
              : null,
          notes: purchase.notes || null,
          items: purchase.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unitPrice: currencyFmt(item.unitPrice),
            totalPrice: currencyFmt(item.totalPrice),
            totalPriceRaw: item.totalPrice,
          })),
          itemsCount: purchase.items.length,
        },
      };

      return NextResponse.json(receipt);
    }

    return NextResponse.json(
      { error: "Tipo inválido. Use 'transaction' ou 'purchase'." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error generating receipt:", error);
    return NextResponse.json(
      { error: "Erro ao gerar recibo. Tente novamente." },
      { status: 500 }
    );
  }
}
