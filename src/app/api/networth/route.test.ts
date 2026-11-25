import { afterAll, beforeAll, beforeEach, describe, expect, mock, setSystemTime, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

describe("GET /api/networth - dívidas reais e passivos históricos negativos", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let GET: typeof import("./route").GET;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "networth-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `CREATE TABLE "Account" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CASH', "balance" REAL NOT NULL DEFAULT 0, "color" TEXT NOT NULL DEFAULT '#6366f1', "icon" TEXT NOT NULL DEFAULT 'wallet', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Card" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CREDIT', "brand" TEXT NOT NULL DEFAULT 'VISA', "lastFourDigits" TEXT NOT NULL, "creditLimit" REAL NOT NULL DEFAULT 0, "currentBalance" REAL NOT NULL DEFAULT 0, "closingDay" INTEGER NOT NULL DEFAULT 1, "dueDay" INTEGER NOT NULL DEFAULT 10, "color" TEXT NOT NULL DEFAULT '#8b5cf6', "flag" TEXT NOT NULL DEFAULT '', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Investment" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'STOCK', "description" TEXT NOT NULL DEFAULT '', "currentBalance" REAL NOT NULL DEFAULT 0, "investedAmount" REAL NOT NULL DEFAULT 0, "yieldRate" REAL NOT NULL DEFAULT 0, "brokerage" TEXT NOT NULL DEFAULT '', "ticker" TEXT NOT NULL DEFAULT '', "accountId" TEXT, "categoryId" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "SavingsGoal" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '', "type" TEXT NOT NULL DEFAULT 'SAVINGS', "targetAmount" REAL NOT NULL, "currentAmount" REAL NOT NULL DEFAULT 0, "monthlyContribution" REAL NOT NULL DEFAULT 0, "yieldRate" REAL NOT NULL DEFAULT 0, "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "targetDate" DATETIME, "accountId" TEXT, "isCompleted" BOOLEAN NOT NULL DEFAULT false, "color" TEXT NOT NULL DEFAULT '#22c55e', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "InstallmentPlan" ("id" TEXT NOT NULL PRIMARY KEY, "description" TEXT NOT NULL, "totalAmount" REAL NOT NULL, "installmentCount" INTEGER NOT NULL, "paidInstallments" INTEGER NOT NULL DEFAULT 0, "monthlyValue" REAL NOT NULL, "interestRate" REAL NOT NULL DEFAULT 0, "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "nextPaymentDate" DATETIME, "type" TEXT NOT NULL DEFAULT 'FINANCING', "status" TEXT NOT NULL DEFAULT 'ACTIVE', "cardId" TEXT, "accountId" TEXT, "categoryId" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Installment" ("id" TEXT NOT NULL PRIMARY KEY, "number" INTEGER NOT NULL, "amount" REAL NOT NULL, "dueDate" DATETIME NOT NULL, "paidDate" DATETIME, "status" TEXT NOT NULL DEFAULT 'PENDING', "notes" TEXT NOT NULL DEFAULT '', "installmentPlanId" TEXT NOT NULL REFERENCES "InstallmentPlan"("id") ON DELETE CASCADE, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Consortium" ("id" TEXT NOT NULL PRIMARY KEY, "description" TEXT NOT NULL, "group" TEXT NOT NULL DEFAULT '', "quota" TEXT NOT NULL DEFAULT '', "administrator" TEXT NOT NULL DEFAULT '', "totalAmount" REAL NOT NULL, "fundedAmount" REAL NOT NULL DEFAULT 0, "monthlyPayment" REAL NOT NULL, "installmentCount" INTEGER NOT NULL, "paidInstallments" INTEGER NOT NULL DEFAULT 0, "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "endDate" DATETIME, "nextAssemblyDate" DATETIME, "assembliesAttended" INTEGER NOT NULL DEFAULT 0, "status" TEXT NOT NULL DEFAULT 'ACTIVE', "categoryId" TEXT, "accountId" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
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
    await localDb.purchase.deleteMany();
    await localDb.transaction.deleteMany();
    await localDb.consortium.deleteMany();
    await localDb.installment.deleteMany();
    await localDb.installmentPlan.deleteMany();
    await localDb.savingsGoal.deleteMany();
    await localDb.investment.deleteMany();
    await localDb.card.deleteMany();
    await localDb.account.deleteMany();
  });

  afterAll(async () => {
    setSystemTime();
    await localDb?.$disconnect();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test("inclui consórcios ativos, soma parcelas PENDING/OVERDUE, ignora TRANSFER e preserva passivos em patrimônio negativo", async () => {
    // Ativos atuais: 1000
    await localDb.account.create({
      data: { id: "acc-1", name: "Conta", balance: 1000 },
    });
    // Cartão: 500
    await localDb.card.create({
      data: { id: "card-1", name: "Visa", lastFourDigits: "2222", creditLimit: 3000, currentBalance: 500 },
    });
    // Consórcio ativo: dívida = 1200 - 400 = 800; concluído/cancelado ignorados
    await localDb.consortium.createMany({
      data: [
        {
          id: "cons-active",
          description: "Moto",
          totalAmount: 1200,
          fundedAmount: 400,
          monthlyPayment: 200,
          installmentCount: 6,
          paidInstallments: 2,
          status: "ACTIVE",
        },
        {
          id: "cons-done",
          description: "Quitado",
          totalAmount: 2000,
          fundedAmount: 1500,
          monthlyPayment: 500,
          installmentCount: 4,
          paidInstallments: 4,
          status: "COMPLETED",
        },
        {
          id: "cons-cancel",
          description: "Cancelado",
          totalAmount: 3000,
          fundedAmount: 0,
          monthlyPayment: 500,
          installmentCount: 6,
          paidInstallments: 0,
          status: "CANCELLED",
        },
      ],
    });

    // Parcelamento: totalAmount=1000, monthlyValue=100, paidInstallments=2 (fórmula antiga daria 800),
    // mas parcelas reais PENDING/OVERDUE somam 350 + 350 = 700 (PAID ignorada).
    await localDb.installmentPlan.create({
      data: {
        id: "plan-1",
        description: "Empréstimo",
        totalAmount: 1000,
        installmentCount: 4,
        paidInstallments: 2,
        monthlyValue: 100,
        status: "ACTIVE",
      },
    });
    await localDb.installment.createMany({
      data: [
        { id: "i-1", installmentPlanId: "plan-1", number: 1, amount: 150, dueDate: new Date(2026, 8, 10), status: "PAID" },
        { id: "i-2", installmentPlanId: "plan-1", number: 2, amount: 150, dueDate: new Date(2026, 9, 10), status: "PAID" },
        { id: "i-3", installmentPlanId: "plan-1", number: 3, amount: 350, dueDate: new Date(2026, 10, 10), status: "OVERDUE" },
        { id: "i-4", installmentPlanId: "plan-1", number: 4, amount: 350, dueDate: new Date(2026, 11, 10), status: "PENDING" },
      ],
    });

    // Passivos atuais: 500 (cartão) + 800 (consórcio) + 700 (parcelas PENDING/OVERDUE) = 2000
    // netWorth atual: 1000 - 2000 = -1000
    // Em Nov/2026 há uma receita de 1500 e uma transferência de 9999 (que deve ser ignorada).
    // Logo em Out/2026 (mês anterior): netWorth = -1000 - 1500 = -2500 (<= -currentLiabilities = -2000!).
    await localDb.transaction.createMany({
      data: [
        { id: "tx-nov", type: "INCOME", amount: 1500, description: "Receita Nov", date: new Date(2026, 10, 5) },
        { id: "tx-tr", type: "TRANSFER", amount: 9999, description: "Transferência", date: new Date(2026, 10, 6) },
      ],
    });

    const req = new Request("http://localhost/api/networth?months=2");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      monthlyData: Array<{ month: string; netWorth: number; assets: number; liabilities: number }>;
    };

    expect(data.monthlyData).toHaveLength(2);
    const [oct, nov] = data.monthlyData;

    expect(nov.assets).toBe(1000);
    expect(nov.liabilities).toBe(2000);
    expect(nov.netWorth).toBe(-1000);
    expect(nov.assets - nov.liabilities).toBe(nov.netWorth);

    // Outubro com netWorth = -2500 (< -2000): passivos nunca zeram!
    expect(oct.netWorth).toBe(-2500);
    expect(oct.liabilities).toBe(2500);
    expect(oct.assets).toBe(0);
    expect(oct.assets - oct.liabilities).toBe(oct.netWorth);
  });
});
