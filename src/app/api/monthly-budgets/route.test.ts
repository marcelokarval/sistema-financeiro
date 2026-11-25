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
  let POST: typeof import("./route").POST;
  let PUT: typeof import("./route").PUT;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "monthly-budgets-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "icon" TEXT NOT NULL DEFAULT 'tag', "type" TEXT NOT NULL DEFAULT 'EXPENSE', "color" TEXT NOT NULL DEFAULT '#6b7280', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "MonthlyBudget" ("id" TEXT NOT NULL PRIMARY KEY, "categoryId" TEXT NOT NULL REFERENCES "Category"("id") ON DELETE CASCADE, "amount" REAL NOT NULL, "month" INTEGER NOT NULL, "year" INTEGER NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Transaction" ("id" TEXT NOT NULL PRIMARY KEY, "type" TEXT NOT NULL, "amount" REAL NOT NULL, "description" TEXT NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "categoryId" TEXT, "accountId" TEXT, "cardId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Purchase" ("id" TEXT NOT NULL PRIMARY KEY, "merchant" TEXT NOT NULL, "totalAmount" REAL NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "installmentNumber" INTEGER NOT NULL DEFAULT 1, "installmentTotal" INTEGER NOT NULL DEFAULT 1, "cardId" TEXT, "accountId" TEXT, "categoryId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ];
    for (const sql of ddl) {
      await localDb.$executeRawUnsafe(sql);
    }

    mock.module("@/lib/db", () => ({ db: localDb }));
    ({ GET, POST, PUT } = await import("./route"));
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

  test("GET rejeita month/year não numéricos ou fora do intervalo com HTTP 400", async () => {
    for (const query of [
      "month=abc&year=2026",
      "month=13&year=2026",
      "month=0&year=2026",
      "month=1.5&year=2026",
      "month=11&year=abc",
      "month=11&year=1999",
    ]) {
      const req = new NextRequest(`http://localhost/api/monthly-budgets?${query}`);
      const res = await GET(req);
      expect(res.status).toBe(400);
    }
  });

  test("POST rejeita JSON inválido, valores não finitos/positivos e categoryId inexistente (P2003) com HTTP 400", async () => {
    await localDb.category.create({
      data: { id: "cat-food", name: "Alimentação", color: "#22c55e", icon: "utensils" },
    });

    const badJsonRes = await POST(
      new NextRequest("http://localhost/api/monthly-budgets", { method: "POST", body: "{invalido" })
    );
    expect(badJsonRes.status).toBe(400);

    for (const payload of [
      { categoryId: "cat-food", amount: "NaN", month: 11, year: 2026 },
      { categoryId: "cat-food", amount: "Infinity", month: 11, year: 2026 },
      { categoryId: "cat-food", amount: 0, month: 11, year: 2026 },
      { categoryId: "cat-food", amount: -100, month: 11, year: 2026 },
      { categoryId: "cat-food", amount: 300, month: "NaN", year: 2026 },
      { categoryId: "cat-food", amount: 300, month: 13, year: 2026 },
      { categoryId: "cat-food", amount: 300, month: 11, year: 2020 },
      { categoryId: "cat-inexistente", amount: 300, month: 11, year: 2026 },
    ]) {
      const res = await POST(
        new NextRequest("http://localhost/api/monthly-budgets", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      );
      expect(res.status).toBe(400);
    }

    expect(await localDb.monthlyBudget.count()).toBe(0);
  });

  test("PUT rejeita JSON inválido e amount <= 0 ou não finito com HTTP 400", async () => {
    await localDb.category.create({
      data: { id: "cat-food", name: "Alimentação", color: "#22c55e", icon: "utensils" },
    });
    await localDb.monthlyBudget.create({
      data: { id: "budget-1", categoryId: "cat-food", amount: 500, month: 11, year: 2026 },
    });

    const badJsonRes = await PUT(
      new NextRequest("http://localhost/api/monthly-budgets", { method: "PUT", body: "{invalido" })
    );
    expect(badJsonRes.status).toBe(400);

    for (const amount of [0, -10, "NaN", "Infinity", "abc", true]) {
      const res = await PUT(
        new NextRequest("http://localhost/api/monthly-budgets", {
          method: "PUT",
          body: JSON.stringify({ id: "budget-1", amount }),
        })
      );
      expect(res.status).toBe(400);
    }

    const budget = await localDb.monthlyBudget.findUniqueOrThrow({ where: { id: "budget-1" } });
    expect(budget.amount).toBe(500);
  });
});
