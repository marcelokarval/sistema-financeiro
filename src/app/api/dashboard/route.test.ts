import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

describe("GET /api/dashboard - filtro de data civil", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let GET: typeof import("./route").GET;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "dashboard-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `CREATE TABLE "Account" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CASH', "balance" REAL NOT NULL DEFAULT 0, "color" TEXT NOT NULL DEFAULT '#6366f1', "icon" TEXT NOT NULL DEFAULT 'wallet', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Card" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CREDIT', "brand" TEXT NOT NULL DEFAULT 'VISA', "lastFourDigits" TEXT NOT NULL, "creditLimit" REAL NOT NULL DEFAULT 0, "currentBalance" REAL NOT NULL DEFAULT 0, "closingDay" INTEGER NOT NULL DEFAULT 1, "dueDay" INTEGER NOT NULL DEFAULT 10, "color" TEXT NOT NULL DEFAULT '#8b5cf6', "flag" TEXT NOT NULL DEFAULT '', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "icon" TEXT NOT NULL DEFAULT 'tag', "type" TEXT NOT NULL DEFAULT 'EXPENSE', "color" TEXT NOT NULL DEFAULT '#6b7280', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Transaction" ("id" TEXT NOT NULL PRIMARY KEY, "type" TEXT NOT NULL, "amount" REAL NOT NULL, "description" TEXT NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "categoryId" TEXT REFERENCES "Category"("id"), "accountId" TEXT REFERENCES "Account"("id"), "cardId" TEXT REFERENCES "Card"("id"), "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Purchase" ("id" TEXT NOT NULL PRIMARY KEY, "merchant" TEXT NOT NULL, "totalAmount" REAL NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "installmentNumber" INTEGER NOT NULL DEFAULT 1, "installmentTotal" INTEGER NOT NULL DEFAULT 1, "cardId" TEXT REFERENCES "Card"("id"), "accountId" TEXT, "categoryId" TEXT REFERENCES "Category"("id"), "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "PurchaseItem" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "quantity" INTEGER NOT NULL DEFAULT 1, "unitPrice" REAL NOT NULL, "totalPrice" REAL NOT NULL, "purchaseId" TEXT NOT NULL REFERENCES "Purchase"("id") ON DELETE CASCADE, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "BudgetGoal" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '', "targetAmount" REAL NOT NULL, "currentAmount" REAL NOT NULL DEFAULT 0, "categoryId" TEXT REFERENCES "Category"("id"), "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "endDate" DATETIME, "isCompleted" BOOLEAN NOT NULL DEFAULT false, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
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
    await localDb.budgetGoal.deleteMany();
    await localDb.category.deleteMany();
    await localDb.card.deleteMany();
    await localDb.account.deleteMany();
  });

  afterAll(async () => {
    await localDb?.$disconnect();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test("inclui transações e compras às 23:30 local no último dia do filtro YYYY-MM-DD", async () => {
    await localDb.transaction.createMany({
      data: [
        {
          id: "tx-in-day",
          type: "INCOME",
          amount: 1200,
          description: "Receita fim do dia",
          date: new Date(2026, 10, 25, 23, 30, 0),
        },
        {
          id: "tx-out-day",
          type: "EXPENSE",
          amount: 300,
          description: "Despesa fim do dia",
          date: new Date(2026, 10, 25, 23, 45, 0),
        },
        {
          id: "tx-prev-day",
          type: "EXPENSE",
          amount: 999,
          description: "Dia anterior",
          date: new Date(2026, 10, 24, 23, 59, 59),
        },
        {
          id: "tx-next-day",
          type: "INCOME",
          amount: 888,
          description: "Dia seguinte",
          date: new Date(2026, 10, 26, 0, 0, 0),
        },
      ],
    });

    await localDb.purchase.create({
      data: {
        id: "pur-in-day",
        merchant: "Mercado Noturno",
        totalAmount: 150,
        date: new Date(2026, 10, 25, 23, 30, 0),
      },
    });

    const req = new NextRequest("http://localhost/api/dashboard?from=2026-11-25&to=2026-11-25");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.monthIncome).toBe(1200);
    expect(data.monthExpense).toBe(450);
    expect(data.recentTransactions.map((t: { id: string }) => t.id).sort()).toEqual([
      "tx-in-day",
      "tx-out-day",
    ]);
    expect(data.recentPurchases.map((p: { id: string }) => p.id)).toEqual(["pur-in-day"]);
  });

  test("rejeita datas inválidas em from/to com HTTP 400", async () => {
    for (const query of [
      "from=2026-02-30&to=2026-11-25",
      "from=2026-11-01&to=abc",
      "from=abc",
      "to=2026-13-01",
    ]) {
      const req = new NextRequest(`http://localhost/api/dashboard?${query}`);
      const res = await GET(req);
      expect(res.status).toBe(400);
    }
  });

  test("emite monthKey em monthlyTrend e formata rótulos e erros para en e es", async () => {
    const reqEn = new NextRequest("http://localhost/api/dashboard?from=2026-11-01&to=2026-11-30&locale=en");
    const resEn = await GET(reqEn);
    expect(resEn.status).toBe(200);
    const dataEn = await resEn.json();
    expect(dataEn.monthlyTrend).toHaveLength(1);
    expect(dataEn.monthlyTrend[0].monthKey).toBe("2026-11");
    expect(dataEn.monthlyTrend[0].month).toContain("Nov");

    const invalidEn = await GET(new NextRequest("http://localhost/api/dashboard?from=abc&locale=en"));
    expect(invalidEn.status).toBe(400);
    expect(invalidEn.headers.get("X-Error-Code")).toBe("INVALID_DATE_FORMAT");
    expect(await invalidEn.json()).toEqual({
      error: "Invalid dates. Use YYYY-MM-DD format.",
      code: "INVALID_DATE_FORMAT",
    });

    const rangeEs = await GET(
      new NextRequest("http://localhost/api/dashboard?from=2026-11-26&to=2026-11-25&locale=es")
    );
    expect(rangeEs.status).toBe(400);
    expect(rangeEs.headers.get("X-Error-Code")).toBe("INVALID_DATE_RANGE");
    expect(await rangeEs.json()).toEqual({
      error: "Rango de fechas inválido: 'from' debe ser anterior o igual a 'to'.",
      code: "INVALID_DATE_RANGE",
    });
  });

  test("apara meses iniciais vazios em monthlyTrend quando intervalo > 12 meses mantendo totais desde 2000", async () => {
    // Cenário 1: intervalo > 12 meses sem movimentos emite apenas o mês de rangeEnd
    const emptyAllRes = await GET(
      new NextRequest("http://localhost/api/dashboard?from=2000-01-01&to=2026-11-30")
    );
    expect(emptyAllRes.status).toBe(200);
    const emptyAllData = await emptyAllRes.json();
    expect(emptyAllData.monthIncome).toBe(0);
    expect(emptyAllData.monthExpense).toBe(0);
    expect(emptyAllData.monthlyTrend.map((m: { monthKey: string }) => m.monthKey)).toEqual([
      "2026-11",
    ]);

    // Cenário 2: registros apenas em 2026 (transação em 2026-10 e compra em 2026-11)
    await localDb.transaction.create({
      data: {
        id: "tx-all-oct",
        type: "INCOME",
        amount: 2500,
        description: "Salário outubro",
        date: new Date(2026, 9, 15, 12, 0, 0),
      },
    });
    await localDb.purchase.create({
      data: {
        id: "pur-all-nov",
        merchant: "Mercado novembro",
        totalAmount: 400,
        date: new Date(2026, 10, 10, 12, 0, 0),
      },
    });

    const activeAllRes = await GET(
      new NextRequest("http://localhost/api/dashboard?from=2000-01-01&to=2026-11-30")
    );
    expect(activeAllRes.status).toBe(200);
    const activeAllData = await activeAllRes.json();

    expect(activeAllData.monthIncome).toBe(2500);
    expect(activeAllData.monthExpense).toBe(400);
    expect(activeAllData.monthlyTrend).toHaveLength(2);
    expect(activeAllData.monthlyTrend.map((m: { monthKey: string }) => m.monthKey)).toEqual([
      "2026-10",
      "2026-11",
    ]);
    expect(activeAllData.monthlyTrend[0]).toMatchObject({
      monthKey: "2026-10",
      income: 2500,
      expense: 0,
    });
    expect(activeAllData.monthlyTrend[1]).toMatchObject({
      monthKey: "2026-11",
      income: 0,
      expense: 400,
    });

    // Cenário 3: faixa <= 12 meses permanece inalterada mesmo com meses iniciais vazios
    const yearRes = await GET(
      new NextRequest("http://localhost/api/dashboard?from=2026-01-01&to=2026-11-30")
    );
    expect(yearRes.status).toBe(200);
    const yearData = await yearRes.json();
    expect(yearData.monthlyTrend).toHaveLength(11);
    expect(yearData.monthlyTrend[0].monthKey).toBe("2026-01");
    expect(yearData.monthlyTrend[10].monthKey).toBe("2026-11");
  });
});
