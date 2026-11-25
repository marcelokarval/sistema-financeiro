import { afterAll, beforeAll, beforeEach, describe, expect, mock, setSystemTime, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

describe("GET /api/quick-stats - séries históricas de 6 meses", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let GET: typeof import("./route").GET;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quick-stats-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `CREATE TABLE "Account" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CASH', "balance" REAL NOT NULL DEFAULT 0, "color" TEXT NOT NULL DEFAULT '#6366f1', "icon" TEXT NOT NULL DEFAULT 'wallet', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Card" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CREDIT', "brand" TEXT NOT NULL DEFAULT 'VISA', "lastFourDigits" TEXT NOT NULL, "creditLimit" REAL NOT NULL DEFAULT 0, "currentBalance" REAL NOT NULL DEFAULT 0, "closingDay" INTEGER NOT NULL DEFAULT 1, "dueDay" INTEGER NOT NULL DEFAULT 10, "color" TEXT NOT NULL DEFAULT '#8b5cf6', "flag" TEXT NOT NULL DEFAULT '', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Investment" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'STOCK', "description" TEXT NOT NULL DEFAULT '', "currentBalance" REAL NOT NULL DEFAULT 0, "investedAmount" REAL NOT NULL DEFAULT 0, "yieldRate" REAL NOT NULL DEFAULT 0, "brokerage" TEXT NOT NULL DEFAULT '', "ticker" TEXT NOT NULL DEFAULT '', "accountId" TEXT, "categoryId" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "InvestmentTransaction" ("id" TEXT NOT NULL PRIMARY KEY, "type" TEXT NOT NULL, "amount" REAL NOT NULL, "quantity" REAL NOT NULL DEFAULT 0, "unitPrice" REAL NOT NULL DEFAULT 0, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "description" TEXT NOT NULL DEFAULT '', "notes" TEXT NOT NULL DEFAULT '', "investmentId" TEXT NOT NULL, "accountId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "SavingsGoal" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '', "type" TEXT NOT NULL DEFAULT 'SAVINGS', "targetAmount" REAL NOT NULL, "currentAmount" REAL NOT NULL DEFAULT 0, "monthlyContribution" REAL NOT NULL DEFAULT 0, "yieldRate" REAL NOT NULL DEFAULT 0, "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "targetDate" DATETIME, "accountId" TEXT, "isCompleted" BOOLEAN NOT NULL DEFAULT false, "color" TEXT NOT NULL DEFAULT '#22c55e', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
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
    setSystemTime(new Date(2026, 10, 15, 12, 0, 0));
    await localDb.investmentTransaction.deleteMany();
    await localDb.investment.deleteMany();
    await localDb.purchase.deleteMany();
    await localDb.transaction.deleteMany();
    await localDb.card.deleteMany();
    await localDb.account.deleteMany();
    await localDb.savingsGoal.deleteMany();
  });

  afterAll(async () => {
    setSystemTime();
    await localDb?.$disconnect();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test("retorna monthlySavingsHistory, investmentsHistory e cardDebtHistory de 6 pontos preservando campos existentes", async () => {
    await localDb.account.create({
      data: { id: "acc-1", name: "Conta Principal", balance: 5000 },
    });
    await localDb.card.create({
      data: { id: "card-1", name: "Nubank", lastFourDigits: "1111", creditLimit: 4000, currentBalance: 750 },
    });
    await localDb.investment.create({
      data: { id: "inv-1", name: "Tesouro", currentBalance: 1500, investedAmount: 1500 },
    });

    // Months relative to Nov 2026 (index 0=Jun .. 5=Nov)
    await localDb.transaction.createMany({
      data: [
        { id: "t-jun", type: "INCOME", amount: 1000, description: "Jun", date: new Date(2026, 5, 10) },
        { id: "t-jul", type: "EXPENSE", amount: 200, description: "Jul", date: new Date(2026, 6, 10) },
        { id: "t-oct-in", type: "INCOME", amount: 1200, description: "Out", date: new Date(2026, 9, 10) },
        { id: "t-nov-in", type: "INCOME", amount: 2000, description: "Nov", date: new Date(2026, 10, 5) },
        { id: "t-nov-out", type: "EXPENSE", amount: 400, description: "Nov", date: new Date(2026, 10, 8) },
        { id: "t-nov-transfer", type: "TRANSFER", amount: 900, description: "Transferência", date: new Date(2026, 10, 12) },
      ],
    });

    await localDb.purchase.createMany({
      data: [
        { id: "p-oct", merchant: "Mercado", totalAmount: 250, cardId: "card-1", date: new Date(2026, 9, 12) },
        { id: "p-nov", merchant: "Farmácia", totalAmount: 300, cardId: "card-1", date: new Date(2026, 10, 9) },
      ],
    });

    await localDb.investmentTransaction.createMany({
      data: [
        { id: "it-aug", investmentId: "inv-1", type: "APORTE", amount: 1000, date: new Date(2026, 7, 15) },
        { id: "it-nov", investmentId: "inv-1", type: "APORTE", amount: 500, date: new Date(2026, 10, 10) },
      ],
    });

    const response = await GET();
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      current: {
        totalBalance: number;
        cardDebt: number;
        investments: number;
        netWorth: number;
        monthlySavings: number;
      };
      sparklines: {
        balance: number[];
        income: number[];
        expense: number[];
      };
      changes: {
        incomeVsLastMonth: number;
        expenseVsLastMonth: number;
        savingsVsLastMonth: number;
      };
      monthlySavingsHistory: number[];
      investmentsHistory: number[];
      cardDebtHistory: number[];
    };

    // Existing fields preserved
    expect(data.current.totalBalance).toBe(5000);
    expect(data.current.cardDebt).toBe(750);
    expect(data.current.investments).toBe(1500);
    expect(data.current.monthlySavings).toBe(1300); // 2000 - (400 + 300)
    expect(data.sparklines.balance).toHaveLength(6);
    expect(data.sparklines.income).toHaveLength(6);
    expect(data.sparklines.expense).toHaveLength(6);
    expect(data.changes).toBeDefined();

    // New 6-point arrays (oldest Jun -> newest Nov)
    expect(data.monthlySavingsHistory).toEqual([1000, -200, 0, 0, 950, 1300]);
    expect(data.investmentsHistory).toEqual([0, 0, 1000, 1000, 1000, 1500]);
    expect(data.cardDebtHistory).toEqual([200, 200, 200, 200, 450, 750]);
    expect(data.sparklines.balance).toEqual([3700, 3500, 3500, 3500, 4450, 5750]);
    expect(data.sparklines.balance[5]).toBe(data.current.netWorth);
  });
});
