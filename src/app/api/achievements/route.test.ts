import { afterAll, beforeAll, beforeEach, describe, expect, mock, setSystemTime, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { formatServerCurrencyBRL } from "@/lib/server-i18n";

describe("GET /api/achievements - i18n (pt/es/en) e compatibilidade", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let GET: typeof import("./route").GET;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "achievements-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `CREATE TABLE "Account" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CASH', "balance" REAL NOT NULL DEFAULT 0, "color" TEXT NOT NULL DEFAULT '#6366f1', "icon" TEXT NOT NULL DEFAULT 'wallet', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Card" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CREDIT', "brand" TEXT NOT NULL DEFAULT 'VISA', "lastFourDigits" TEXT NOT NULL, "creditLimit" REAL NOT NULL DEFAULT 0, "currentBalance" REAL NOT NULL DEFAULT 0, "closingDay" INTEGER NOT NULL DEFAULT 1, "dueDay" INTEGER NOT NULL DEFAULT 10, "color" TEXT NOT NULL DEFAULT '#8b5cf6', "flag" TEXT NOT NULL DEFAULT '', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "icon" TEXT NOT NULL DEFAULT 'tag', "type" TEXT NOT NULL DEFAULT 'EXPENSE', "color" TEXT NOT NULL DEFAULT '#6b7280', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Transaction" ("id" TEXT NOT NULL PRIMARY KEY, "type" TEXT NOT NULL, "amount" REAL NOT NULL, "description" TEXT NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "categoryId" TEXT, "accountId" TEXT, "cardId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Purchase" ("id" TEXT NOT NULL PRIMARY KEY, "merchant" TEXT NOT NULL, "totalAmount" REAL NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "installmentNumber" INTEGER NOT NULL DEFAULT 1, "installmentTotal" INTEGER NOT NULL DEFAULT 1, "cardId" TEXT, "accountId" TEXT, "categoryId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "SavingsGoal" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '', "type" TEXT NOT NULL DEFAULT 'SAVINGS', "targetAmount" REAL NOT NULL, "currentAmount" REAL NOT NULL DEFAULT 0, "monthlyContribution" REAL NOT NULL DEFAULT 0, "yieldRate" REAL NOT NULL DEFAULT 0, "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "targetDate" DATETIME, "accountId" TEXT, "isCompleted" BOOLEAN NOT NULL DEFAULT false, "color" TEXT NOT NULL DEFAULT '#22c55e', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Investment" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'STOCK', "description" TEXT NOT NULL DEFAULT '', "currentBalance" REAL NOT NULL DEFAULT 0, "investedAmount" REAL NOT NULL DEFAULT 0, "yieldRate" REAL NOT NULL DEFAULT 0, "brokerage" TEXT NOT NULL DEFAULT '', "ticker" TEXT NOT NULL DEFAULT '', "accountId" TEXT, "categoryId" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "InstallmentPlan" ("id" TEXT NOT NULL PRIMARY KEY, "description" TEXT NOT NULL, "totalAmount" REAL NOT NULL, "installmentCount" INTEGER NOT NULL, "paidInstallments" INTEGER NOT NULL DEFAULT 0, "monthlyValue" REAL NOT NULL, "interestRate" REAL NOT NULL DEFAULT 0, "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "nextPaymentDate" DATETIME, "type" TEXT NOT NULL DEFAULT 'FINANCING', "status" TEXT NOT NULL DEFAULT 'ACTIVE', "cardId" TEXT, "accountId" TEXT, "categoryId" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ];
    for (const sql of ddl) {
      await localDb.$executeRawUnsafe(sql);
    }

    mock.module("@/lib/db", () => ({ db: localDb }));
    ({ GET } = await import("./route"));
  });

  beforeEach(async () => {
    setSystemTime(new Date("2026-11-15T12:00:00Z"));
    await localDb.installmentPlan.deleteMany();
    await localDb.investment.deleteMany();
    await localDb.savingsGoal.deleteMany();
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

  test("GET() sem argumentos retorna conquistas em pt preservando id, icon, category e BRL", async () => {
    await localDb.account.create({
      data: { id: "acc-1", name: "Conta", balance: 1500 },
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      achievements: Array<{
        id: string;
        title: string;
        description: string;
        icon: string;
        category: string;
        unlocked: boolean;
      }>;
    };

    expect(data.achievements).toHaveLength(12);
    const first = data.achievements.find((a) => a.id === "primeira-economia");
    expect(first?.title).toBe("Primeira Economia");
    expect(first?.icon).toBe("PiggyBank");
    expect(first?.category).toBe("poupanca");

    const netWorth = data.achievements.find((a) => a.id === "patrimonio-crescendo");
    expect(netWorth?.title).toBe("Patrimônio Crescendo");
    expect(netWorth?.category).toBe("investimento");
    expect(netWorth?.description).toBe(
      `Patrimônio líquido positivo e acima de ${formatServerCurrencyBRL(1000, "pt")}`
    );
    expect(netWorth?.unlocked).toBe(true);
  });

  test("GET(req) traduz 12 conquistas para en e es preservando id, icon, category e BRL", async () => {
    const resEn = await GET(new NextRequest("http://localhost/api/achievements?locale=en"));
    expect(resEn.status).toBe(200);
    const dataEn = (await resEn.json()) as {
      achievements: Array<{
        id: string;
        title: string;
        description: string;
        icon: string;
        category: string;
      }>;
    };

    expect(dataEn.achievements).toHaveLength(12);
    expect(dataEn.achievements.find((a) => a.id === "primeira-economia")?.title).toBe("First Savings");
    expect(dataEn.achievements.find((a) => a.id === "sem-dividas")?.category).toBe("controle");
    expect(dataEn.achievements.find((a) => a.id === "financeiro-completo")?.category).toBe("exploracao");
    expect(dataEn.achievements.find((a) => a.id === "patrimonio-crescendo")?.description).toBe(
      `Positive net worth above ${formatServerCurrencyBRL(1000, "en")}`
    );
    expect(dataEn.achievements.find((a) => a.id === "financeiro-completo")?.title).toBe("Complete Finance");

    const resEs = await GET(new NextRequest("http://localhost/api/achievements?locale=es"));
    expect(resEs.status).toBe(200);
    const dataEs = (await resEs.json()) as {
      achievements: Array<{
        id: string;
        title: string;
        description: string;
        icon: string;
        category: string;
      }>;
    };

    expect(dataEs.achievements).toHaveLength(12);
    expect(dataEs.achievements.find((a) => a.id === "primeira-economia")?.title).toBe("Primer Ahorro");
    expect(dataEs.achievements.find((a) => a.id === "patrimonio-crescendo")?.description).toBe(
      `Patrimonio neto positivo y superior a ${formatServerCurrencyBRL(1000, "es")}`
    );
    expect(dataEs.achievements.find((a) => a.id === "financeiro-completo")?.title).toBe("Finanzas Completas");
  });

  test("retorna erro 500 localizado com code e X-Error-Code em falha inesperada", async () => {
    const originalFindMany = localDb.account.findMany;
    localDb.account.findMany = (() => Promise.reject(new Error("db down"))) as typeof originalFindMany;
    try {
      const resEn = await GET(new NextRequest("http://localhost/api/achievements?locale=en"));
      expect(resEn.status).toBe(500);
      expect(resEn.headers.get("X-Error-Code")).toBe("INTERNAL_ERROR");
      expect(await resEn.json()).toEqual({
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    } finally {
      localDb.account.findMany = originalFindMany;
    }
  });
});
