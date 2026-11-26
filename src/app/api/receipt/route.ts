import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  apiErrorResponse,
  formatServerCurrencyBRL,
  formatServerDate,
  formatServerPurchaseDate,
  resolveRequestLocale,
  translateApiMessage,
  type SupportedLocale,
} from "@/lib/server-i18n";

function translateReceiptType(type: string, locale: SupportedLocale): string {
  const key = `receipt.types.${type}`;
  const translated = translateApiMessage(locale, key);
  return translated === key ? type : translated;
}

// GET /api/receipt?type=transaction|purchase&id=xxx
export async function GET(request?: NextRequest) {
  const locale = resolveRequestLocale(request);
  try {
    const { searchParams } = new URL(request?.url ?? "http://localhost");
    const type = searchParams.get("type");
    const id = searchParams.get("id");

    if (!type || !id) {
      return apiErrorResponse(
        "MISSING_PARAMS",
        translateApiMessage(locale, "receipt.missingParams"),
        400
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
        return apiErrorResponse(
          "NOT_FOUND",
          translateApiMessage(locale, "receipt.transactionNotFound"),
          404
        );
      }

      const receipt = {
        receiptType: "transaction",
        receiptNumber: `TXN-${transaction.id.slice(0, 8).toUpperCase()}`,
        issuedAt: new Date().toISOString(),
        data: {
          id: transaction.id,
          type: translateReceiptType(transaction.type, locale),
          rawType: transaction.type,
          description: transaction.description,
          amount: formatServerCurrencyBRL(transaction.amount, locale),
          amountRaw: transaction.amount,
          date: formatServerDate(transaction.date, locale, "datetime"),
          category: transaction.category?.name || translateApiMessage(locale, "common.uncategorized"),
          categoryColor: transaction.category?.color || "#6b7280",
          account: transaction.account?.name || translateApiMessage(locale, "common.notAvailable"),
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
        return apiErrorResponse(
          "NOT_FOUND",
          translateApiMessage(locale, "receipt.purchaseNotFound"),
          404
        );
      }

      const receipt = {
        receiptType: "purchase",
        receiptNumber: `PRC-${purchase.id.slice(0, 8).toUpperCase()}`,
        issuedAt: new Date().toISOString(),
        data: {
          id: purchase.id,
          merchant: purchase.merchant,
          totalAmount: formatServerCurrencyBRL(purchase.totalAmount, locale),
          totalAmountRaw: purchase.totalAmount,
          date: formatServerPurchaseDate(purchase.date, locale, "receipt"),
          category: purchase.category?.name || translateApiMessage(locale, "common.uncategorized"),
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
            unitPrice: formatServerCurrencyBRL(item.unitPrice, locale),
            totalPrice: formatServerCurrencyBRL(item.totalPrice, locale),
            totalPriceRaw: item.totalPrice,
          })),
          itemsCount: purchase.items.length,
        },
      };

      return NextResponse.json(receipt);
    }

    return apiErrorResponse(
      "INVALID_TYPE",
      translateApiMessage(locale, "receipt.invalidType"),
      400
    );
  } catch (error) {
    console.error("Error generating receipt:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "receipt.fetchFailed"),
      500
    );
  }
}
