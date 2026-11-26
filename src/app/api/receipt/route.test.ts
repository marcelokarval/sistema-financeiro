import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

describe("GET /api/receipt - internacionalização pt/es/en, BRL e datas civis", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let GET: typeof import("./route").GET;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "receipt-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `CREATE TABLE "Account" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CASH', "balance" REAL NOT NULL DEFAULT 0, "color" TEXT NOT NULL DEFAULT '#6366f1', "icon" TEXT NOT NULL DEFAULT 'wallet', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Card" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CREDIT', "brand" TEXT NOT NULL DEFAULT 'VISA', "lastFourDigits" TEXT NOT NULL, "creditLimit" REAL NOT NULL DEFAULT 0, "currentBalance" REAL NOT NULL DEFAULT 0, "closingDay" INTEGER NOT NULL DEFAULT 1, "dueDay" INTEGER NOT NULL DEFAULT 10, "color" TEXT NOT NULL DEFAULT '#8b5cf6', "flag" TEXT NOT NULL DEFAULT '', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "icon" TEXT NOT NULL DEFAULT 'tag', "type" TEXT NOT NULL DEFAULT 'EXPENSE', "color" TEXT NOT NULL DEFAULT '#6b7280', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Transaction" ("id" TEXT NOT NULL PRIMARY KEY, "type" TEXT NOT NULL, "amount" REAL NOT NULL, "description" TEXT NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "categoryId" TEXT REFERENCES "Category"("id"), "accountId" TEXT REFERENCES "Account"("id"), "cardId" TEXT REFERENCES "Card"("id"), "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Purchase" ("id" TEXT NOT NULL PRIMARY KEY, "merchant" TEXT NOT NULL, "totalAmount" REAL NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "installmentNumber" INTEGER NOT NULL DEFAULT 1, "installmentTotal" INTEGER NOT NULL DEFAULT 1, "cardId" TEXT REFERENCES "Card"("id"), "accountId" TEXT, "categoryId" TEXT REFERENCES "Category"("id"), "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "PurchaseItem" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "quantity" INTEGER NOT NULL DEFAULT 1, "unitPrice" REAL NOT NULL, "totalPrice" REAL NOT NULL, "purchaseId" TEXT NOT NULL REFERENCES "Purchase"("id") ON DELETE CASCADE, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ];
    for (const sql of ddl) {
      await localDb.$executeRawUnsafe(sql);
    }

    mock.module("@/lib/db", () => ({ db: localDb }));
    ({ GET } = await import("./route"));
  });

  beforeEach(async () => {
    await localDb.purchaseItem.deleteMany();
    await localDb.purchase.deleteMany();
    await localDb.transaction.deleteMany();
    await localDb.category.deleteMany();
    await localDb.card.deleteMany();
    await localDb.account.deleteMany();
  });

  afterAll(async () => {
    await localDb?.$disconnect();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test("emite recibo de transação em pt (default), es e en preservando BRL e rawType", async () => {
    await localDb.transaction.create({
      data: {
        id: "tx-rec-1",
        type: "TRANSFER",
        amount: 1234.56,
        description: "Reserva mensal",
        date: new Date("2026-11-19T14:30:00.000Z"),
      },
    });

    const resPt = await GET(new NextRequest("http://localhost/api/receipt?type=transaction&id=tx-rec-1"));
    expect(resPt.status).toBe(200);
    const bodyPt = await resPt.json();
    expect(bodyPt.data.type).toBe("Transferência");
    expect(bodyPt.data.rawType).toBe("TRANSFER");
    expect(bodyPt.data.category).toBe("Sem categoria");
    expect(bodyPt.data.account).toBe("N/A");
    expect(bodyPt.data.amount).toContain("R$");
    expect(bodyPt.data.amount).toContain("1.234,56");
    expect(bodyPt.data.amountRaw).toBe(1234.56);

    const resEs = await GET(new NextRequest("http://localhost/api/receipt?type=transaction&id=tx-rec-1&locale=es"));
    expect(resEs.status).toBe(200);
    const bodyEs = await resEs.json();
    expect(bodyEs.data.type).toBe("Transferencia");
    expect(bodyEs.data.rawType).toBe("TRANSFER");
    expect(bodyEs.data.category).toBe("Sin categoría");
    expect(bodyEs.data.account).toBe("N/D");
    expect(bodyEs.data.amount).toContain("BRL");
    expect(bodyEs.data.amount).not.toContain("€");

    const resEn = await GET(new NextRequest("http://localhost/api/receipt?type=transaction&id=tx-rec-1&locale=en"));
    expect(resEn.status).toBe(200);
    const bodyEn = await resEn.json();
    expect(bodyEn.data.type).toBe("Transfer");
    expect(bodyEn.data.rawType).toBe("TRANSFER");
    expect(bodyEn.data.category).toBe("Uncategorized");
    expect(bodyEn.data.account).toBe("N/A");
    expect(bodyEn.data.amount).toContain("R$");
    expect(bodyEn.data.amount).toContain("1,234.56");
    expect(bodyEn.data.amount).not.toMatch(/(?<![R])\$/);
  });

  test("emite recibo de compra civil preservando dia 19/11/2026 sem recuo de fuso em pt, es e en", async () => {
    await localDb.purchase.create({
      data: {
        id: "pur-civil-1",
        merchant: "Mercado Central",
        totalAmount: 250.5,
        date: new Date("2026-11-19T00:00:00.000Z"),
        items: {
          create: [
            {
              id: "item-1",
              name: "Café",
              quantity: 2,
              unitPrice: 125.25,
              totalPrice: 250.5,
            },
          ],
        },
      },
    });

    const resPt = await GET(new NextRequest("http://localhost/api/receipt?type=purchase&id=pur-civil-1"));
    expect(resPt.status).toBe(200);
    const bodyPt = await resPt.json();
    expect(bodyPt.data.date).toBe("19/11/2026");
    expect(bodyPt.data.category).toBe("Sem categoria");
    expect(bodyPt.data.totalAmountRaw).toBe(250.5);
    expect(bodyPt.data.items[0].totalPriceRaw).toBe(250.5);

    const resEs = await GET(new NextRequest("http://localhost/api/receipt?type=purchase&id=pur-civil-1&locale=es"));
    expect(resEs.status).toBe(200);
    const bodyEs = await resEs.json();
    expect(bodyEs.data.date).toBe("19/11/2026");
    expect(bodyEs.data.category).toBe("Sin categoría");
    expect(bodyEs.data.totalAmount).toContain("BRL");
    expect(bodyEs.data.items[0].unitPrice).toContain("BRL");

    const resEn = await GET(new NextRequest("http://localhost/api/receipt?type=purchase&id=pur-civil-1&locale=en"));
    expect(resEn.status).toBe(200);
    const bodyEn = await resEn.json();
    expect(bodyEn.data.date).toBe("11/19/2026");
    expect(bodyEn.data.category).toBe("Uncategorized");
    expect(bodyEn.data.totalAmount).toContain("R$");
    expect(bodyEn.data.totalAmount).toContain("250.50");
  });

  test("retorna erros 400 e 404 localizados com code e header X-Error-Code", async () => {
    const missingRes = await GET(new NextRequest("http://localhost/api/receipt?locale=en"));
    expect(missingRes.status).toBe(400);
    expect(missingRes.headers.get("X-Error-Code")).toBe("MISSING_PARAMS");
    expect(await missingRes.json()).toEqual({
      error: "Parameters 'type' and 'id' are required.",
      code: "MISSING_PARAMS",
    });

    const invalidTypeRes = await GET(new NextRequest("http://localhost/api/receipt?type=other&id=1&locale=es"));
    expect(invalidTypeRes.status).toBe(400);
    expect(invalidTypeRes.headers.get("X-Error-Code")).toBe("INVALID_TYPE");
    expect(await invalidTypeRes.json()).toEqual({
      error: "Tipo inválido. Use 'transaction' o 'purchase'.",
      code: "INVALID_TYPE",
    });

    const txnNotFoundRes = await GET(new NextRequest("http://localhost/api/receipt?type=transaction&id=nope&locale=en"));
    expect(txnNotFoundRes.status).toBe(404);
    expect(txnNotFoundRes.headers.get("X-Error-Code")).toBe("NOT_FOUND");
    expect(await txnNotFoundRes.json()).toEqual({
      error: "Transaction not found.",
      code: "NOT_FOUND",
    });

    const purNotFoundRes = await GET(new NextRequest("http://localhost/api/receipt?type=purchase&id=nope&locale=es"));
    expect(purNotFoundRes.status).toBe(404);
    expect(purNotFoundRes.headers.get("X-Error-Code")).toBe("NOT_FOUND");
    expect(await purNotFoundRes.json()).toEqual({
      error: "Compra no encontrada.",
      code: "NOT_FOUND",
    });
  });
});
