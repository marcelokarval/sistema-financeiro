import { afterAll, beforeAll, beforeEach, describe, expect, mock, setSystemTime, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

describe("GET /api/upcoming-bills - vencimento de cartão, domingo e fatura zerada", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let GET: typeof import("./route").GET;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "upcoming-bills-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `CREATE TABLE "Account" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CASH', "balance" REAL NOT NULL DEFAULT 0, "color" TEXT NOT NULL DEFAULT '#6366f1', "icon" TEXT NOT NULL DEFAULT 'wallet', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Card" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CREDIT', "brand" TEXT NOT NULL DEFAULT 'VISA', "lastFourDigits" TEXT NOT NULL, "creditLimit" REAL NOT NULL DEFAULT 0, "currentBalance" REAL NOT NULL DEFAULT 0, "closingDay" INTEGER NOT NULL DEFAULT 1, "dueDay" INTEGER NOT NULL DEFAULT 10, "color" TEXT NOT NULL DEFAULT '#8b5cf6', "flag" TEXT NOT NULL DEFAULT '', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "icon" TEXT NOT NULL DEFAULT 'tag', "type" TEXT NOT NULL DEFAULT 'EXPENSE', "color" TEXT NOT NULL DEFAULT '#6b7280', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "InstallmentPlan" ("id" TEXT NOT NULL PRIMARY KEY, "description" TEXT NOT NULL, "totalAmount" REAL NOT NULL, "installmentCount" INTEGER NOT NULL, "paidInstallments" INTEGER NOT NULL DEFAULT 0, "monthlyValue" REAL NOT NULL, "interestRate" REAL NOT NULL DEFAULT 0, "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "nextPaymentDate" DATETIME, "type" TEXT NOT NULL DEFAULT 'FINANCING', "status" TEXT NOT NULL DEFAULT 'ACTIVE', "cardId" TEXT REFERENCES "Card"("id"), "accountId" TEXT, "categoryId" TEXT REFERENCES "Category"("id"), "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Installment" ("id" TEXT NOT NULL PRIMARY KEY, "number" INTEGER NOT NULL, "amount" REAL NOT NULL, "dueDate" DATETIME NOT NULL, "paidDate" DATETIME, "status" TEXT NOT NULL DEFAULT 'PENDING', "notes" TEXT NOT NULL DEFAULT '', "installmentPlanId" TEXT NOT NULL REFERENCES "InstallmentPlan"("id") ON DELETE CASCADE, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Consortium" ("id" TEXT NOT NULL PRIMARY KEY, "description" TEXT NOT NULL, "group" TEXT NOT NULL DEFAULT '', "quota" TEXT NOT NULL DEFAULT '', "administrator" TEXT NOT NULL DEFAULT '', "totalAmount" REAL NOT NULL, "fundedAmount" REAL NOT NULL DEFAULT 0, "monthlyPayment" REAL NOT NULL, "installmentCount" INTEGER NOT NULL, "paidInstallments" INTEGER NOT NULL DEFAULT 0, "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "endDate" DATETIME, "nextAssemblyDate" DATETIME, "assembliesAttended" INTEGER NOT NULL DEFAULT 0, "status" TEXT NOT NULL DEFAULT 'ACTIVE', "categoryId" TEXT REFERENCES "Category"("id"), "accountId" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "ConsortiumInstallment" ("id" TEXT NOT NULL PRIMARY KEY, "number" INTEGER NOT NULL, "amount" REAL NOT NULL, "dueDate" DATETIME NOT NULL, "paidDate" DATETIME, "status" TEXT NOT NULL DEFAULT 'PENDING', "notes" TEXT NOT NULL DEFAULT '', "assemblyDate" DATETIME, "assemblyResult" TEXT NOT NULL DEFAULT '', "consortiumId" TEXT NOT NULL REFERENCES "Consortium"("id") ON DELETE CASCADE, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "RecurringTransaction" ("id" TEXT NOT NULL PRIMARY KEY, "description" TEXT NOT NULL, "amount" REAL NOT NULL, "type" TEXT NOT NULL, "frequency" TEXT NOT NULL, "nextDate" DATETIME NOT NULL, "categoryId" TEXT REFERENCES "Category"("id"), "accountId" TEXT REFERENCES "Account"("id"), "cardId" TEXT REFERENCES "Card"("id"), "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ];
    for (const sql of ddl) {
      await localDb.$executeRawUnsafe(sql);
    }

    mock.module("@/lib/db", () => ({ db: localDb }));
    ({ GET } = await import("./route"));
  });

  beforeEach(async () => {
    await localDb.recurringTransaction.deleteMany();
    await localDb.consortiumInstallment.deleteMany();
    await localDb.consortium.deleteMany();
    await localDb.installment.deleteMany();
    await localDb.installmentPlan.deleteMany();
    await localDb.card.deleteMany();
  });

  afterAll(async () => {
    setSystemTime();
    await localDb?.$disconnect();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test("limita dueDay=31 em fevereiro de 2026 para 2026-02-28 e omite cartões com currentBalance <= 0", async () => {
    setSystemTime(new Date("2026-02-10T12:00:00Z"));

    await localDb.card.createMany({
      data: [
        {
          id: "c31",
          name: "Cartão Dia 31",
          type: "CREDIT",
          brand: "VISA",
          lastFourDigits: "1111",
          creditLimit: 5000,
          currentBalance: 450,
          closingDay: 24,
          dueDay: 31,
          isActive: true,
        },
        {
          id: "czero",
          name: "Cartão Zerado",
          type: "CREDIT",
          brand: "MASTERCARD",
          lastFourDigits: "2222",
          creditLimit: 3000,
          currentBalance: 0,
          closingDay: 8,
          dueDay: 15,
          isActive: true,
        },
      ],
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();

    const card31Bill = data.bills.find((b: { id: string }) => b.id === "card-c31");
    expect(card31Bill).toBeDefined();
    const due = new Date(card31Bill.dueDate);
    expect(due.getFullYear()).toBe(2026);
    expect(due.getMonth()).toBe(1);
    expect(due.getDate()).toBe(28);

    expect(data.bills.some((b: { id: string }) => b.id === "card-czero")).toBe(false);
  });

  test("em consulta no domingo, summary.thisWeek encerra no próprio domingo às 23:59:59.999 e exclui segunda-feira", async () => {
    // 2026-11-22 é domingo
    setSystemTime(new Date("2026-11-22T12:00:00Z"));

    await localDb.recurringTransaction.createMany({
      data: [
        {
          id: "rec-sun",
          description: "Conta Domingo",
          amount: 200,
          type: "EXPENSE",
          frequency: "MONTHLY",
          nextDate: new Date(2026, 10, 22, 18, 0, 0),
          isActive: true,
        },
        {
          id: "rec-mon",
          description: "Conta Segunda",
          amount: 500,
          type: "EXPENSE",
          frequency: "MONTHLY",
          nextDate: new Date(2026, 10, 23, 10, 0, 0),
          isActive: true,
        },
      ],
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.bills).toHaveLength(2);
    expect(data.summary.thisWeek.count).toBe(1);
    expect(data.summary.thisWeek.amount).toBe(200);
  });
});
