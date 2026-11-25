import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

describe("GET /api/monthly-budgets - guarda de categoryId nulo", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let GET: typeof import("./route").GET;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "monthly-budgets-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "icon" TEXT NOT NULL DEFAULT 'tag', "type" TEXT NOT NULL DEFAULT 'EXPENSE', "color" TEXT NOT NULL DEFAULT '#6b7280', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "MonthlyBudget" ("id" TEXT NOT NULL PRIMARY KEY, "categoryId" TEXT NOT NULL, "amount" REAL NOT NULL, "month" INTEGER NOT NULL, "year" INTEGER NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Transaction" ("id" TEXT NOT NULL PRIMARY KEY, "type" TEXT NOT NULL, "amount" REAL NOT NULL, "description" TEXT NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "categoryId" TEXT, "accountId" TEXT, "cardId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Purchase" ("id" TEXT NOT NULL PRIMARY KEY, "merchant" TEXT NOT NULL, "totalAmount" REAL NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "installmentNumber" INTEGER NOT NULL DEFAULT 1, "installmentTotal" INTEGER NOT NULL DEFAULT 1, "cardId" TEXT, "accountId" TEXT, "categoryId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ];
    for (const sql of ddl) {
      await localDb.$executeRawUnsafe(sql);
    }

    mock.module("@/lib/db", () => ({ db: localDb }));
    ({ GET } = await import("./route"));
  });

  beforeEach(async () => {
    await localDb.purchase.deleteMany();
    await localDb.transaction.deleteMany();
    await localDb.monthlyBudget.deleteMany();
    await localDb.category.deleteMany();
  });

  afterAll(async () => {
    await localDb?.$disconnect();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test("agrega gastos por categoria e ignora categoryId nulo com segurança", async () => {
    await localDb.category.create({
      data: { id: "cat-food", name: "Alimentação", color: "#22c55e", icon: "utensils" },
    });
    await localDb.monthlyBudget.create({
      data: { id: "budget-1", categoryId: "cat-food", amount: 500, month: 11, year: 2026 },
    });

    const dateInMonth = new Date(2026, 10, 15, 12, 0, 0);
    await localDb.transaction.createMany({
      data: [
        { id: "t1", type: "EXPENSE", amount: 150, description: "Mercado", date: dateInMonth, categoryId: "cat-food" },
        { id: "t2", type: "EXPENSE", amount: 999, description: "Sem categoria", date: dateInMonth, categoryId: null },
      ],
    });
    await localDb.purchase.createMany({
      data: [
        { id: "p1", merchant: "Padaria", totalAmount: 200, date: dateInMonth, categoryId: "cat-food" },
        { id: "p2", merchant: "Avulsa", totalAmount: 888, date: dateInMonth, categoryId: null },
      ],
    });

    const req = new NextRequest("http://localhost/api/monthly-budgets?month=11&year=2026");
    const response = await GET(req);
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      budgets: Array<{
        id: string;
        categoryId: string;
        categoryName: string;
        categoryColor: string;
        categoryIcon: string;
        amount: number;
        spent: number;
        remaining: number;
        percentage: number;
        isOverBudget: boolean;
      }>;
    };

    expect(body.budgets).toEqual([
      {
        id: "budget-1",
        categoryId: "cat-food",
        categoryName: "Alimentação",
        categoryColor: "#22c55e",
        categoryIcon: "utensils",
        amount: 500,
        spent: 350,
        remaining: 150,
        percentage: 70,
        isOverBudget: false,
      },
    ]);
  });
});
