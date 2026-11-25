import { afterAll, beforeAll, beforeEach, describe, expect, mock, setSystemTime, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

describe("GET /api/balance-projection - janela fechada de 3 meses completos", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let GET: typeof import("./route").GET;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "balance-projection-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `CREATE TABLE "Account" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CASH', "balance" REAL NOT NULL DEFAULT 0, "color" TEXT NOT NULL DEFAULT '#6366f1', "icon" TEXT NOT NULL DEFAULT 'wallet', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Transaction" ("id" TEXT NOT NULL PRIMARY KEY, "type" TEXT NOT NULL, "amount" REAL NOT NULL, "description" TEXT NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "categoryId" TEXT, "accountId" TEXT REFERENCES "Account"("id"), "cardId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Purchase" ("id" TEXT NOT NULL PRIMARY KEY, "merchant" TEXT NOT NULL, "totalAmount" REAL NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "installmentNumber" INTEGER NOT NULL DEFAULT 1, "installmentTotal" INTEGER NOT NULL DEFAULT 1, "cardId" TEXT, "accountId" TEXT REFERENCES "Account"("id"), "categoryId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ];
    for (const sql of ddl) {
      await localDb.$executeRawUnsafe(sql);
    }

    mock.module("@/lib/db", () => ({ db: localDb }));
    ({ GET } = await import("./route"));
  });

  beforeEach(async () => {
    setSystemTime(new Date("2026-11-15T12:00:00Z"));
    await localDb.purchase.deleteMany();
    await localDb.transaction.deleteMany();
    await localDb.account.deleteMany();
  });

  afterAll(async () => {
    setSystemTime();
    await localDb?.$disconnect();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test("calcula avgMonthlyIncome e avgMonthlyExpense apenas sobre os 3 meses fechados anteriores (ago-out)", async () => {
    await localDb.account.create({
      data: { id: "acc-1", name: "Conta Principal", balance: 1000 },
    });

    await localDb.transaction.createMany({
      data: [
        { id: "in-aug", type: "INCOME", amount: 3000, description: "Salário Ago", date: new Date(2026, 7, 10, 12, 0), accountId: "acc-1" },
        { id: "in-sep", type: "INCOME", amount: 3000, description: "Salário Set", date: new Date(2026, 8, 10, 12, 0), accountId: "acc-1" },
        { id: "in-oct", type: "INCOME", amount: 3000, description: "Salário Out", date: new Date(2026, 9, 10, 12, 0), accountId: "acc-1" },
        { id: "out-aug", type: "EXPENSE", amount: 1500, description: "Aluguel Ago", date: new Date(2026, 7, 20, 12, 0), accountId: "acc-1" },
        // Lançamentos parciais do mês corrente (novembro) devem ser ignorados na média trimestral
        { id: "in-nov", type: "INCOME", amount: 9000, description: "Bônus Nov", date: new Date(2026, 10, 5, 12, 0), accountId: "acc-1" },
        { id: "out-nov", type: "EXPENSE", amount: 6000, description: "Gasto Nov", date: new Date(2026, 10, 6, 12, 0), accountId: "acc-1" },
      ],
    });

    await localDb.purchase.createMany({
      data: [
        { id: "pur-oct", merchant: "Supermercado Out", totalAmount: 1500, date: new Date(2026, 9, 31, 23, 30), accountId: "acc-1" },
        { id: "pur-nov", merchant: "Eletrônicos Nov", totalAmount: 3000, date: new Date(2026, 10, 10, 12, 0), accountId: "acc-1" },
      ],
    });

    const req = new NextRequest("http://localhost/api/balance-projection?months=3");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.accounts).toHaveLength(1);
    expect(data.accounts[0].avgMonthlyIncome).toBe(3000);
    expect(data.accounts[0].avgMonthlyExpense).toBe(1000);
    expect(data.accounts[0].monthlyNet).toBe(2000);
    expect(data.averageMonthlySavings).toBe(2000);
  });
});
