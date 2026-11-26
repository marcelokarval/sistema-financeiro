import { afterAll, beforeAll, beforeEach, describe, expect, mock, setSystemTime, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

describe("GET /api/financial-calendar - isolamento de TRANSFER", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let GET: typeof import("./route").GET;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "financial-cal-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `CREATE TABLE "Account" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CASH', "balance" REAL NOT NULL DEFAULT 0, "color" TEXT NOT NULL DEFAULT '#6366f1', "icon" TEXT NOT NULL DEFAULT 'wallet', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Card" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CREDIT', "brand" TEXT NOT NULL DEFAULT 'VISA', "lastFourDigits" TEXT NOT NULL, "creditLimit" REAL NOT NULL DEFAULT 0, "currentBalance" REAL NOT NULL DEFAULT 0, "closingDay" INTEGER NOT NULL DEFAULT 1, "dueDay" INTEGER NOT NULL DEFAULT 10, "color" TEXT NOT NULL DEFAULT '#8b5cf6', "flag" TEXT NOT NULL DEFAULT '', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "icon" TEXT NOT NULL DEFAULT 'tag', "type" TEXT NOT NULL DEFAULT 'EXPENSE', "color" TEXT NOT NULL DEFAULT '#6b7280', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Transaction" ("id" TEXT NOT NULL PRIMARY KEY, "type" TEXT NOT NULL, "amount" REAL NOT NULL, "description" TEXT NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "categoryId" TEXT REFERENCES "Category"("id"), "accountId" TEXT REFERENCES "Account"("id"), "cardId" TEXT REFERENCES "Card"("id"), "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Purchase" ("id" TEXT NOT NULL PRIMARY KEY, "merchant" TEXT NOT NULL, "totalAmount" REAL NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "installmentNumber" INTEGER NOT NULL DEFAULT 1, "installmentTotal" INTEGER NOT NULL DEFAULT 1, "cardId" TEXT REFERENCES "Card"("id"), "accountId" TEXT, "categoryId" TEXT REFERENCES "Category"("id"), "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "RecurringTransaction" ("id" TEXT NOT NULL PRIMARY KEY, "description" TEXT NOT NULL, "amount" REAL NOT NULL, "type" TEXT NOT NULL, "frequency" TEXT NOT NULL, "nextDate" DATETIME NOT NULL, "categoryId" TEXT REFERENCES "Category"("id"), "accountId" TEXT REFERENCES "Account"("id"), "cardId" TEXT REFERENCES "Card"("id"), "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ];
    for (const sql of ddl) {
      await localDb.$executeRawUnsafe(sql);
    }

    mock.module("@/lib/db", () => ({ db: localDb }));
    ({ GET } = await import("./route"));
  });

  beforeEach(async () => {
    setSystemTime(new Date(2026, 10, 15, 10, 0, 0));
    await localDb.recurringTransaction.deleteMany();
    await localDb.purchase.deleteMany();
    await localDb.transaction.deleteMany();
  });

  afterAll(async () => {
    setSystemTime();
    await localDb?.$disconnect();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test("exclui transações TRANSFER dos eventos e totais de receita e despesa", async () => {
    await localDb.transaction.createMany({
      data: [
        { id: "tx-in", type: "INCOME", amount: 1500, description: "Freela", date: new Date(2026, 10, 16, 12, 0) },
        { id: "tx-out", type: "EXPENSE", amount: 400, description: "Luz", date: new Date(2026, 10, 17, 12, 0) },
        { id: "tx-tr-1", type: "TRANSFER", amount: 900, description: "Transferência entre contas", date: new Date(2026, 10, 18, 12, 0) },
      ],
    });

    const req = new NextRequest("http://localhost/api/financial-calendar?days=30");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.summary.totalIncome).toBe(1500);
    expect(data.summary.totalExpense).toBe(400);
    const allEvents = data.days.flatMap((d: { events: Array<{ id: string }> }) => d.events);
    expect(allEvents.some((e: { id: string }) => e.id === "tx-tr-1")).toBe(false);
  });

  test("emite dateKey ISO e localiza dayOfWeek em pt, es e en", async () => {
    // 2026-11-15 é domingo (dayIndex 0), 2026-11-16 é segunda (dayIndex 1)
    const resPt = await GET(new NextRequest("http://localhost/api/financial-calendar?days=7"));
    expect(resPt.status).toBe(200);
    const dataPt = await resPt.json();
    expect(dataPt.days[0].dateKey).toBe("2026-11-15");
    expect(dataPt.days[0].dayOfWeek).toBe("Dom");
    expect(dataPt.days[1].dayOfWeek).toBe("Seg");

    const resEn = await GET(new NextRequest("http://localhost/api/financial-calendar?days=7&locale=en"));
    expect(resEn.status).toBe(200);
    const dataEn = await resEn.json();
    expect(dataEn.days[0].dateKey).toBe("2026-11-15");
    expect(dataEn.days[0].dayOfWeek).toBe("Sun");
    expect(dataEn.days[1].dayOfWeek).toBe("Mon");

    const resEs = await GET(new NextRequest("http://localhost/api/financial-calendar?days=7&locale=es"));
    expect(resEs.status).toBe(200);
    const dataEs = await resEs.json();
    expect(dataEs.days[0].dateKey).toBe("2026-11-15");
    expect(dataEs.days[0].dayOfWeek).toBe("Dom");
    expect(dataEs.days[1].dayOfWeek).toBe("Lun");
  });
});
