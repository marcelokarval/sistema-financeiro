import { afterAll, beforeAll, beforeEach, describe, expect, mock, setSystemTime, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

describe("GET /api/forecast - normalização mensal de recorrências", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let GET: typeof import("./route").GET;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "forecast-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "icon" TEXT NOT NULL DEFAULT 'tag', "type" TEXT NOT NULL DEFAULT 'EXPENSE', "color" TEXT NOT NULL DEFAULT '#6b7280', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Transaction" ("id" TEXT NOT NULL PRIMARY KEY, "type" TEXT NOT NULL, "amount" REAL NOT NULL, "description" TEXT NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "categoryId" TEXT REFERENCES "Category"("id"), "accountId" TEXT, "cardId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Purchase" ("id" TEXT NOT NULL PRIMARY KEY, "merchant" TEXT NOT NULL, "totalAmount" REAL NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "installmentNumber" INTEGER NOT NULL DEFAULT 1, "installmentTotal" INTEGER NOT NULL DEFAULT 1, "cardId" TEXT, "accountId" TEXT, "categoryId" TEXT REFERENCES "Category"("id"), "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "RecurringTransaction" ("id" TEXT NOT NULL PRIMARY KEY, "description" TEXT NOT NULL, "amount" REAL NOT NULL, "type" TEXT NOT NULL, "frequency" TEXT NOT NULL, "nextDate" DATETIME NOT NULL, "categoryId" TEXT REFERENCES "Category"("id"), "accountId" TEXT, "cardId" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ];
    for (const sql of ddl) {
      await localDb.$executeRawUnsafe(sql);
    }

    mock.module("@/lib/db", () => ({ db: localDb }));
    ({ GET } = await import("./route"));
  });

  beforeEach(async () => {
    setSystemTime(new Date("2026-11-15T12:00:00Z"));
    await localDb.recurringTransaction.deleteMany();
    await localDb.purchase.deleteMany();
    await localDb.transaction.deleteMany();
    await localDb.category.deleteMany();
  });

  afterAll(async () => {
    setSystemTime();
    await localDb?.$disconnect();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test("normaliza recorrências WEEKLY, BIWEEKLY, QUARTERLY e YEARLY para base mensal", async () => {
    await localDb.recurringTransaction.createMany({
      data: [
        {
          id: "rec-weekly",
          description: "Freela semanal",
          amount: 100,
          type: "INCOME",
          frequency: "WEEKLY",
          nextDate: new Date("2026-11-20T12:00:00Z"),
        },
        {
          id: "rec-yearly",
          description: "Bônus anual",
          amount: 1200,
          type: "INCOME",
          frequency: "YEARLY",
          nextDate: new Date("2026-12-20T12:00:00Z"),
        },
        {
          id: "rec-biweekly",
          description: "Mercado quinzenal",
          amount: 260,
          type: "EXPENSE",
          frequency: "BIWEEKLY",
          nextDate: new Date("2026-11-25T12:00:00Z"),
        },
        {
          id: "rec-quarterly",
          description: "Seguro trimestral",
          amount: 300,
          type: "EXPENSE",
          frequency: "QUARTERLY",
          nextDate: new Date("2026-12-10T12:00:00Z"),
        },
      ],
    });

    const req = new NextRequest("http://localhost/api/forecast?months=1");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    const expectedMonthlyIncome = 100 * (52 / 12) + 1200 / 12;
    const expectedMonthlyExpense = 260 * (26 / 12) + 300 / 3;
    const expectedProjIncome = Math.round(expectedMonthlyIncome * 0.4 * 100) / 100;
    const expectedProjExpense = Math.round(expectedMonthlyExpense * 0.4 * 100) / 100;

    expect(data.forecastMonths).toHaveLength(1);
    expect(data.forecastMonths[0].projectedIncome).toBe(expectedProjIncome);
    expect(data.forecastMonths[0].projectedExpense).toBe(expectedProjExpense);
  });
});
