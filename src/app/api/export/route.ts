import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseCivilDateEnd, parseCivilDateStart } from "@/lib/api-validation";
import {
  apiErrorResponse,
  formatServerDate,
  formatServerNumber,
  formatServerPurchaseDate,
  resolveRequestLocale,
  translateApiMessage,
  type SupportedLocale,
} from "@/lib/server-i18n";

// GET /api/export?type=transactions|purchases|accounts&format=csv&startDate=...&endDate=...
export async function GET(request: NextRequest) {
  const locale = resolveRequestLocale(request);

  try {
    const { searchParams } = new URL(request.url);

    const type = searchParams.get("type");
    const format = searchParams.get("format");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Validate type
    if (type !== "transactions" && type !== "purchases" && type !== "accounts") {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "export.invalidType"),
        400
      );
    }

    // Validate format
    if (format !== "csv") {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "export.invalidFormat"),
        400
      );
    }

    // Build date filter
    const parsedStart = startDate ? parseCivilDateStart(startDate) : null;
    if (startDate && parsedStart === null) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "export.invalidStartDate"),
        400
      );
    }

    const parsedEnd = endDate ? parseCivilDateEnd(endDate) : null;
    if (endDate && parsedEnd === null) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "export.invalidEndDate"),
        400
      );
    }

    if (parsedStart && parsedEnd && parsedStart > parsedEnd) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "export.invalidDateRange"),
        400
      );
    }

    const buildDateFilter = (): Prisma.DateTimeFilter | undefined => {
      const filter: Prisma.DateTimeFilter = {};
      if (parsedStart) filter.gte = parsedStart;
      if (parsedEnd) filter.lte = parsedEnd;
      return Object.keys(filter).length > 0 ? filter : undefined;
    };

    let csvContent: string;
    let filename: string;

    switch (type) {
      case "transactions": {
        const where: Prisma.TransactionWhereInput = {};
        const df = buildDateFilter();
        if (df) where.date = df;

        const transactions = await db.transaction.findMany({
          where,
          orderBy: { date: "desc" },
          include: {
            category: true,
            account: true,
            card: true,
          },
        });

        const headers = [
          translateApiMessage(locale, "export.headers.transactions.id"),
          translateApiMessage(locale, "export.headers.transactions.type"),
          translateApiMessage(locale, "export.headers.transactions.amount"),
          translateApiMessage(locale, "export.headers.transactions.description"),
          translateApiMessage(locale, "export.headers.transactions.date"),
          translateApiMessage(locale, "export.headers.transactions.category"),
          translateApiMessage(locale, "export.headers.transactions.account"),
          translateApiMessage(locale, "export.headers.transactions.card"),
        ];

        const rows = transactions.map((t) => [
          t.id,
          translateTransactionType(t.type, locale),
          formatCurrency(t.amount, locale),
          t.description,
          formatServerDate(t.date, locale, "date"),
          t.category?.name ?? "",
          t.account?.name ?? "",
          t.card ? `${t.card.name} (****${t.card.lastFourDigits})` : "",
        ]);

        csvContent = buildCsv(headers, rows);
        filename = translateApiMessage(locale, "export.filenames.transactions");
        break;
      }

      case "purchases": {
        const where: Prisma.PurchaseWhereInput = {};
        const df = buildDateFilter();
        if (df) where.date = df;

        const purchases = await db.purchase.findMany({
          where,
          orderBy: { date: "desc" },
          include: {
            items: true,
            card: true,
          },
        });

        const headers = [
          translateApiMessage(locale, "export.headers.purchases.id"),
          translateApiMessage(locale, "export.headers.purchases.merchant"),
          translateApiMessage(locale, "export.headers.purchases.totalAmount"),
          translateApiMessage(locale, "export.headers.purchases.date"),
          translateApiMessage(locale, "export.headers.purchases.card"),
          translateApiMessage(locale, "export.headers.purchases.itemsCount"),
          translateApiMessage(locale, "export.headers.purchases.installment"),
        ];

        const rows = purchases.map((p) => {
          const installmentInfo =
            p.installmentTotal > 1
              ? `${p.installmentNumber}/${p.installmentTotal}`
              : translateApiMessage(locale, "common.inFull");

          return [
            p.id,
            p.merchant,
            formatCurrency(p.totalAmount, locale),
            formatServerPurchaseDate(p.date, locale, "date"),
            p.card ? `${p.card.name} (****${p.card.lastFourDigits})` : "",
            String(p.items.length),
            installmentInfo,
          ];
        });

        csvContent = buildCsv(headers, rows);
        filename = translateApiMessage(locale, "export.filenames.purchases");
        break;
      }

      case "accounts": {
        const accounts = await db.account.findMany({
          orderBy: { createdAt: "desc" },
        });

        const headers = [
          translateApiMessage(locale, "export.headers.accounts.id"),
          translateApiMessage(locale, "export.headers.accounts.name"),
          translateApiMessage(locale, "export.headers.accounts.type"),
          translateApiMessage(locale, "export.headers.accounts.balance"),
          translateApiMessage(locale, "export.headers.accounts.active"),
        ];

        const rows = accounts.map((a) => [
          a.id,
          a.name,
          translateAccountType(a.type, locale),
          formatCurrency(a.balance, locale),
          translateApiMessage(locale, a.isActive ? "common.yes" : "common.no"),
        ]);

        csvContent = buildCsv(headers, rows);
        filename = translateApiMessage(locale, "export.filenames.accounts");
        break;
      }
    }

    // UTF-8 BOM prefix for Excel compatibility
    const bom = "\uFEFF";
    const csvWithBom = bom + csvContent;

    return new NextResponse(csvWithBom, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Erro ao exportar dados:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "export.fetchFailed"),
      500
    );
  }
}

// --- Helper functions ---

function buildCsv(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCsv).join(";");
  const dataLines = rows.map((row) => row.map(escapeCsv).join(";"));
  return [headerLine, ...dataLines].join("\n");
}

function escapeCsv(value: string): string {
  if (!value) return "";
  const neutralized = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  // Escape double quotes by doubling them, and wrap in quotes if contains semicolon, quote, CR, or LF
  if (
    neutralized.includes('"') ||
    neutralized.includes(";") ||
    neutralized.includes("\n") ||
    neutralized.includes("\r")
  ) {
    return `"${neutralized.replace(/"/g, '""')}"`;
  }
  return neutralized;
}

function formatCurrency(value: number, locale: SupportedLocale): string {
  return formatServerNumber(value, locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function translateTransactionType(type: string, locale: SupportedLocale): string {
  if (type === "INCOME" || type === "EXPENSE" || type === "TRANSFER") {
    return translateApiMessage(locale, `export.transactionTypes.${type}`);
  }
  return type;
}

function translateAccountType(type: string, locale: SupportedLocale): string {
  if (type === "CASH" || type === "BANK" || type === "DIGITAL_WALLET") {
    return translateApiMessage(locale, `export.accountTypes.${type}`);
  }
  return type;
}
