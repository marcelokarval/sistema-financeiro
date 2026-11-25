import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

describe("GET /api/purchases - busca case-insensitive em SQLite", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let GET: typeof import("./route").GET;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "purchases-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `CREATE TABLE "Card" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CREDIT', "brand" TEXT NOT NULL DEFAULT 'VISA', "lastFourDigits" TEXT NOT NULL, "creditLimit" REAL NOT NULL DEFAULT 0, "currentBalance" REAL NOT NULL DEFAULT 0, "closingDay" INTEGER NOT NULL DEFAULT 1, "dueDay" INTEGER NOT NULL DEFAULT 10, "color" TEXT NOT NULL DEFAULT '#8b5cf6', "flag" TEXT NOT NULL DEFAULT '', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "icon" TEXT NOT NULL DEFAULT 'tag', "type" TEXT NOT NULL DEFAULT 'EXPENSE', "color" TEXT NOT NULL DEFAULT '#6b7280', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Purchase" ("id" TEXT NOT NULL PRIMARY KEY, "merchant" TEXT NOT NULL, "totalAmount" REAL NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "installmentNumber" INTEGER NOT NULL DEFAULT 1, "installmentTotal" INTEGER NOT NULL DEFAULT 1, "cardId" TEXT, "accountId" TEXT, "categoryId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "PurchaseItem" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "quantity" INTEGER NOT NULL DEFAULT 1, "unitPrice" REAL NOT NULL, "totalPrice" REAL NOT NULL, "purchaseId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
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
    await localDb.card.deleteMany();
  });

  afterAll(async () => {
    await localDb?.$disconnect();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test("filtra merchant sem erro de Prisma SQLite e com suporte case-insensitive e acentos", async () => {
    await localDb.card.create({
      data: { id: "card-1", name: "Nubank", lastFourDigits: "1234" },
    });
    await localDb.purchase.createMany({
      data: [
        { id: "p1", merchant: "CAFÉ DO PORTO", totalAmount: 25, cardId: "card-1" },
        { id: "p2", merchant: "Mercado Central", totalAmount: 100, cardId: "card-1" },
        { id: "p3", merchant: "Padaria Café Quente", totalAmount: 18, cardId: "card-1" },
      ],
    });

    const req = new NextRequest("http://localhost/api/purchases?cardId=card-1&merchant=caf%C3%A9");
    const response = await GET(req);
    expect(response.status).toBe(200);

    const purchases = (await response.json()) as Array<{ id: string; merchant: string }>;
    expect(purchases.map((p) => p.id).sort()).toEqual(["p1", "p3"]);
  });

  test("filtra merchant ASCII sem diferenciar maiúsculas e minúsculas", async () => {
    await localDb.purchase.createMany({
      data: [
        { id: "p1", merchant: "MERCADO LIVRE", totalAmount: 250 },
        { id: "p2", merchant: "Farmácia Popular", totalAmount: 40 },
      ],
    });

    const req = new NextRequest("http://localhost/api/purchases?merchant=mercado");
    const response = await GET(req);
    expect(response.status).toBe(200);

    const purchases = (await response.json()) as Array<{ id: string }>;
    expect(purchases.map((p) => p.id)).toEqual(["p1"]);
  });
});
