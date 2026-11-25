import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { formatPurchaseDate } from "@/lib/purchase-date";
import { Prisma } from "@prisma/client";

// GET /api/export?type=transactions|purchases|accounts&format=csv&startDate=...&endDate=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const type = searchParams.get("type");
    const format = searchParams.get("format");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Validate type
    if (type !== "transactions" && type !== "purchases" && type !== "accounts") {
      return NextResponse.json(
        { error: "Tipo de exportação inválido. Use: transactions, purchases ou accounts" },
        { status: 400 }
      );
    }

    // Validate format
    if (format !== "csv") {
      return NextResponse.json(
        { error: "Formato inválido. Use: csv" },
        { status: 400 }
      );
    }

    // Build date filter
    const buildDateFilter = (): Prisma.DateTimeFilter | undefined => {
      const filter: Prisma.DateTimeFilter = {};
      if (startDate) filter.gte = new Date(startDate);
      if (endDate) {
        const toDate = new Date(endDate);
        toDate.setHours(23, 59, 59, 999);
        filter.lte = toDate;
      }
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
          "ID",
          "Tipo",
          "Valor (R$)",
          "Descrição",
          "Data",
          "Categoria",
          "Conta",
          "Cartão",
        ];

        const rows = transactions.map((t) => [
          t.id,
          translateTransactionType(t.type),
          formatCurrency(t.amount),
          escapeCsv(t.description),
          formatDate(t.date),
          t.category?.name ?? "",
          t.account?.name ?? "",
          t.card ? `${t.card.name} (****${t.card.lastFourDigits})` : "",
        ]);

        csvContent = buildCsv(headers, rows);
        filename = "transacoes.csv";
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
          "ID",
          "Estabelecimento",
          "Valor Total (R$)",
          "Data",
          "Cartão",
          "Qtd. Itens",
          "Parcela",
        ];

        const rows = purchases.map((p) => {
          let installmentInfo = "";
          if (p.installmentTotal > 1) {
            installmentInfo = `${p.installmentNumber}/${p.installmentTotal}`;
          } else {
            installmentInfo = "À vista";
          }

          return [
            p.id,
            escapeCsv(p.merchant),
            formatCurrency(p.totalAmount),
            formatPurchaseDate(p.date),
            p.card ? `${p.card.name} (****${p.card.lastFourDigits})` : "",
            String(p.items.length),
            installmentInfo,
          ];
        });

        csvContent = buildCsv(headers, rows);
        filename = "compras.csv";
        break;
      }

      case "accounts": {
        const accounts = await db.account.findMany({
          orderBy: { createdAt: "desc" },
        });

        const headers = [
          "ID",
          "Nome",
          "Tipo",
          "Saldo (R$)",
          "Ativa",
        ];

        const typeLabels: Record<string, string> = {
          CASH: "Dinheiro",
          BANK: "Banco",
          DIGITAL_WALLET: "Carteira Digital",
        };

        const rows = accounts.map((a) => [
          a.id,
          escapeCsv(a.name),
          typeLabels[a.type] ?? a.type,
          formatCurrency(a.balance),
          a.isActive ? "Sim" : "Não",
        ]);

        csvContent = buildCsv(headers, rows);
        filename = "contas.csv";
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
    return NextResponse.json(
      { error: "Falha ao exportar dados" },
      { status: 500 }
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
  // Escape double quotes by doubling them, and wrap in quotes if contains semicolon, quote, or newline
  if (value.includes('"') || value.includes(";") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function translateTransactionType(type: string): string {
  const labels: Record<string, string> = {
    INCOME: "Receita",
    EXPENSE: "Despesa",
    TRANSFER: "Transferência",
  };
  return labels[type] ?? type;
}
