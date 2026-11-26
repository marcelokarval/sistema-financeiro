import { afterAll, beforeAll, beforeEach, describe, expect, mock, setSystemTime, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

import { NextRequest } from "next/server";
import { formatServerCurrencyBRL } from "@/lib/server-i18n";

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

  test("localiza insights narrativos para en e es mantendo BRL e ids/icons originais", async () => {
    setSystemTime(new Date("2026-11-15T12:00:00Z"));

    await localDb.account.create({
      data: { id: "acc-1", name: "Conta Principal", balance: 9000 },
    });
    await localDb.card.create({
      data: {
        id: "card-1",
        name: "Nubank",
        lastFourDigits: "1234",
        creditLimit: 1000,
        currentBalance: 920,
      },
    });
    await localDb.category.create({
      data: { id: "cat-food", name: "Alimentação", type: "EXPENSE", color: "#ef4444" },
    });
    await localDb.transaction.createMany({
      data: [
        { id: "inc-nov", type: "INCOME", amount: 5000, description: "Salário", date: new Date(2026, 10, 5, 12, 0) },
        { id: "exp-aug", type: "EXPENSE", amount: 1000, description: "Mercado Ago", date: new Date(2026, 7, 15, 12, 0), categoryId: "cat-food" },
        { id: "exp-sep", type: "EXPENSE", amount: 1000, description: "Mercado Set", date: new Date(2026, 8, 15, 12, 0), categoryId: "cat-food" },
        { id: "exp-oct", type: "EXPENSE", amount: 1000, description: "Mercado Out", date: new Date(2026, 9, 15, 12, 0), categoryId: "cat-food" },
        { id: "exp-nov", type: "EXPENSE", amount: 3000, description: "Mercado Nov", date: new Date(2026, 10, 10, 12, 0), categoryId: "cat-food" },
      ],
    });
    await localDb.recurringTransaction.create({
      data: {
        id: "rec-1",
        description: "Streaming",
        amount: 50,
        type: "EXPENSE",
        frequency: "MONTHLY",
        nextDate: new Date("2026-11-25T12:00:00Z"),
        isActive: true,
      },
    });
    await localDb.budgetGoal.create({
      data: {
        id: "goal-1",
        name: "Reserva",
        targetAmount: 1000,
        currentAmount: 700,
        isCompleted: false,
      },
    });

    const resEn = await GET(new NextRequest("http://localhost/api/insights?locale=en"));
    expect(resEn.status).toBe(200);
    const insightsEn = (await resEn.json()) as Array<{
      id: string;
      icon: string;
      title: string;
      description: string;
      action?: string;
      metric?: string;
    }>;

    const emergencyEn = insightsEn.find((i) => i.id === "emergency-fund");
    expect(emergencyEn?.title).toBe("Healthy emergency fund");
    expect(emergencyEn?.metric).toBe("9.0 months");
    expect(emergencyEn?.icon).toBe("ShieldCheck");

    const overspendEn = insightsEn.find((i) => i.id === "category-overspend");
    expect(overspendEn?.title).toBe("Above-average spending in Alimentação");
    expect(overspendEn?.description).toContain(formatServerCurrencyBRL(2000, "en"));
    expect(overspendEn?.action).toBe("View category details");

    const cardUtilEn = insightsEn.find((i) => i.id === "card-util-card-1");
    expect(cardUtilEn?.title).toBe("Card Nubank limit nearly exhausted");
    expect(cardUtilEn?.action).toBe("Pay bill");

    const recurringEn = insightsEn.find((i) => i.id === "recurring-summary");
    expect(recurringEn?.title).toBe("1 recurring transaction");
    expect(recurringEn?.description).toContain(`${formatServerCurrencyBRL(50, "en")}/month`);

    const goalEn = insightsEn.find((i) => i.id === "goal-goal-1");
    expect(goalEn?.title).toBe('Goal "Reserva" is 70% complete');
    expect(goalEn?.action).toBe("Contribute now");

    const resEs = await GET(new NextRequest("http://localhost/api/insights?locale=es"));
    expect(resEs.status).toBe(200);
    const insightsEs = (await resEs.json()) as Array<{
      id: string;
      title: string;
      description: string;
      action?: string;
      metric?: string;
    }>;

    const emergencyEs = insightsEs.find((i) => i.id === "emergency-fund");
    expect(emergencyEs?.title).toBe("Fondo de emergencia saludable");
    expect(emergencyEs?.metric).toBe("9.0 meses");

    const overspendEs = insightsEs.find((i) => i.id === "category-overspend");
    expect(overspendEs?.title).toBe("Gastos por encima del promedio en Alimentação");
    expect(overspendEs?.description).toContain(formatServerCurrencyBRL(2000, "es"));
    expect(overspendEs?.action).toBe("Ver detalles de la categoría");

    const recurringEs = insightsEs.find((i) => i.id === "recurring-summary");
    expect(recurringEs?.title).toBe("1 transacción recurrente");
    expect(recurringEs?.description).toContain(`${formatServerCurrencyBRL(50, "es")}/mes.`);

    const goalEs = insightsEs.find((i) => i.id === "goal-goal-1");
    expect(goalEs?.title).toBe('La meta "Reserva" está 70% completada');
    expect(goalEs?.action).toBe("Aportar ahora");
  });

  test("retorna erro 500 localizado com code e X-Error-Code em falha inesperada", async () => {
    const originalFindMany = localDb.account.findMany;
    localDb.account.findMany = (() => Promise.reject(new Error("db down"))) as typeof originalFindMany;
    try {
      const res = await GET(new NextRequest("http://localhost/api/insights?locale=en"));
      expect(res.status).toBe(500);
      expect(res.headers.get("X-Error-Code")).toBe("INTERNAL_ERROR");
      expect(await res.json()).toEqual({
        error: "Failed to generate financial insights",
        code: "INTERNAL_ERROR",
      });
    } finally {
      localDb.account.findMany = originalFindMany;
    }
  });
});
