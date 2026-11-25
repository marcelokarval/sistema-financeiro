import { afterAll, beforeAll, beforeEach, describe, expect, mock, setSystemTime, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

describe("GET /api/insights - progresso de meta de orçamento", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let GET: typeof import("./route").GET;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "insights-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `CREATE TABLE "Account" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CASH', "balance" REAL NOT NULL DEFAULT 0, "color" TEXT NOT NULL DEFAULT '#6366f1', "icon" TEXT NOT NULL DEFAULT 'wallet', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Card" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CREDIT', "brand" TEXT NOT NULL DEFAULT 'VISA', "lastFourDigits" TEXT NOT NULL, "creditLimit" REAL NOT NULL DEFAULT 0, "currentBalance" REAL NOT NULL DEFAULT 0, "closingDay" INTEGER NOT NULL DEFAULT 1, "dueDay" INTEGER NOT NULL DEFAULT 10, "color" TEXT NOT NULL DEFAULT '#8b5cf6', "flag" TEXT NOT NULL DEFAULT '', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "icon" TEXT NOT NULL DEFAULT 'tag', "type" TEXT NOT NULL DEFAULT 'EXPENSE', "color" TEXT NOT NULL DEFAULT '#6b7280', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Transaction" ("id" TEXT NOT NULL PRIMARY KEY, "type" TEXT NOT NULL, "amount" REAL NOT NULL, "description" TEXT NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "categoryId" TEXT, "accountId" TEXT, "cardId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Purchase" ("id" TEXT NOT NULL PRIMARY KEY, "merchant" TEXT NOT NULL, "totalAmount" REAL NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "installmentNumber" INTEGER NOT NULL DEFAULT 1, "installmentTotal" INTEGER NOT NULL DEFAULT 1, "cardId" TEXT, "accountId" TEXT, "categoryId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "RecurringTransaction" ("id" TEXT NOT NULL PRIMARY KEY, "description" TEXT NOT NULL, "amount" REAL NOT NULL, "type" TEXT NOT NULL, "frequency" TEXT NOT NULL, "nextDate" DATETIME NOT NULL, "categoryId" TEXT, "accountId" TEXT, "cardId" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "BudgetGoal" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '', "targetAmount" REAL NOT NULL, "currentAmount" REAL NOT NULL DEFAULT 0, "categoryId" TEXT, "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "endDate" DATETIME, "isCompleted" BOOLEAN NOT NULL DEFAULT false, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ];
    for (const sql of ddl) {
      await localDb.$executeRawUnsafe(sql);
    }

    mock.module("@/lib/db", () => ({ db: localDb }));
    ({ GET } = await import("./route"));
  });

  beforeEach(async () => {
    setSystemTime();
    await localDb.budgetGoal.deleteMany();
    await localDb.recurringTransaction.deleteMany();
    await localDb.purchase.deleteMany();
    await localDb.transaction.deleteMany();
    await localDb.category.deleteMany();
    await localDb.card.deleteMany();
    await localDb.account.deleteMany();
  });

  afterAll(async () => {
    setSystemTime();
    await localDb?.$disconnect();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test("marca insight da meta como success quando progresso numérico >= 70", async () => {
    await localDb.budgetGoal.create({
      data: {
        id: "goal-70",
        name: "Reserva",
        targetAmount: 1000,
        currentAmount: 700,
        isCompleted: false,
      },
    });

    const response = await GET();
    expect(response.status).toBe(200);
    const insights = (await response.json()) as Array<{
      id: string;
      type: string;
      metric?: string;
      title: string;
    }>;

    const goalInsight = insights.find((item) => item.id === "goal-goal-70");
    expect(goalInsight).toBeDefined();
    expect(goalInsight?.type).toBe("success");
    expect(goalInsight?.metric).toBe("70%");
    expect(goalInsight?.title).toContain("70% completa");
  });

  test("marca insight da meta como info quando progresso numérico < 70", async () => {
    await localDb.budgetGoal.create({
      data: {
        id: "goal-69",
        name: "Viagem",
        targetAmount: 1000,
        currentAmount: 690,
        isCompleted: false,
      },
    });

    const response = await GET();
    expect(response.status).toBe(200);
    const insights = (await response.json()) as Array<{
      id: string;
      type: string;
      metric?: string;
    }>;

    const goalInsight = insights.find((item) => item.id === "goal-goal-69");
    expect(goalInsight).toBeDefined();
    expect(goalInsight?.type).toBe("info");
    expect(goalInsight?.metric).toBe("69%");
  });

  test("normaliza recorrências WEEKLY e YEARLY para equivalente mensal no insight recurring-summary", async () => {
    setSystemTime(new Date("2026-11-15T12:00:00Z"));

    await localDb.recurringTransaction.createMany({
      data: [
        {
          id: "rec-w",
          description: "Academia",
          amount: 100,
          type: "EXPENSE",
          frequency: "WEEKLY",
          nextDate: new Date("2026-11-20T12:00:00Z"),
          isActive: true,
        },
        {
          id: "rec-y",
          description: "IPTU",
          amount: 1200,
          type: "EXPENSE",
          frequency: "YEARLY",
          nextDate: new Date("2026-12-20T12:00:00Z"),
          isActive: true,
        },
      ],
    });

    const response = await GET();
    expect(response.status).toBe(200);
    const insights = (await response.json()) as Array<{
      id: string;
      metric?: string;
      description: string;
    }>;

    const recurring = insights.find((item) => item.id === "recurring-summary");
    expect(recurring).toBeDefined();
    // 100 * (52/12) + 1200 / 12 = 533.333... -> "R$ 533,33"
    expect(recurring?.metric).toContain("533,33");
    expect(recurring?.description).toContain("533,33/mês");
  });

  test("usa janela fechada dos 3 meses anteriores (ago-out) em emergency-fund e category-overspend, ignorando novembro", async () => {
    setSystemTime(new Date("2026-11-15T12:00:00Z"));

    await localDb.account.create({
      data: { id: "acc-res", name: "Reserva", balance: 9000 },
    });
    await localDb.category.create({
      data: { id: "cat-food", name: "Alimentação", type: "EXPENSE", color: "#ef4444" },
    });
    await localDb.transaction.createMany({
      data: [
        { id: "exp-aug", type: "EXPENSE", amount: 1000, description: "Mercado Ago", date: new Date(2026, 7, 15, 12, 0), categoryId: "cat-food" },
        { id: "exp-sep", type: "EXPENSE", amount: 1000, description: "Mercado Set", date: new Date(2026, 8, 15, 12, 0), categoryId: "cat-food" },
        { id: "exp-oct", type: "EXPENSE", amount: 1000, description: "Mercado Out", date: new Date(2026, 9, 15, 12, 0), categoryId: "cat-food" },
        // Gasto parcial do mês atual não deve inflar a média dos 3 meses anteriores
        { id: "exp-nov", type: "EXPENSE", amount: 3000, description: "Mercado Nov", date: new Date(2026, 10, 5, 12, 0), categoryId: "cat-food" },
      ],
    });

    const response = await GET();
    expect(response.status).toBe(200);
    const insights = (await response.json()) as Array<{
      id: string;
      metric?: string;
    }>;

    const emergency = insights.find((item) => item.id === "emergency-fund");
    expect(emergency?.metric).toBe("9.0 meses");

    const overspend = insights.find((item) => item.id === "category-overspend");
    expect(overspend?.metric).toBe("+200%");
  });
});
