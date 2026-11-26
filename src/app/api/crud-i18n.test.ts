/// <reference types="bun-types" />

import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

describe("CRUD routes i18n, códigos de erro e guarda test:sqlite", () => {
  let tempDir: string;
  let localDb: PrismaClient;

  let cardsHandlers: typeof import("./cards/route");
  let categoriesHandlers: typeof import("./categories/route");
  let transferHandlers: typeof import("./transfer/route");
  let transactionsHandlers: typeof import("./transactions/route");
  let monthlyBudgetsHandlers: typeof import("./monthly-budgets/route");
  let installmentsHandlers: typeof import("./installments/route");
  let installmentsPayHandlers: typeof import("./installments/pay/route");
  let consortiumsHandlers: typeof import("./consortiums/route");
  let consortiumsInstallmentsHandlers: typeof import("./consortiums/installments/route");
  let savingsHandlers: typeof import("./savings/route");
  let savingsDepositHandlers: typeof import("./savings/deposit/route");
  let recurringHandlers: typeof import("./recurring/route");
  let recurringProcessHandlers: typeof import("./recurring/process/route");
  let investmentsHandlers: typeof import("./investments/route");
  let investmentTxHandlers: typeof import("./investments/transactions/route");

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "crud-i18n-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `PRAGMA foreign_keys = ON`,
      `CREATE TABLE "Account" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CASH', "balance" REAL NOT NULL DEFAULT 0, "color" TEXT NOT NULL DEFAULT '#6366f1', "icon" TEXT NOT NULL DEFAULT 'wallet', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Card" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CREDIT', "brand" TEXT NOT NULL DEFAULT 'VISA', "lastFourDigits" TEXT NOT NULL, "creditLimit" REAL NOT NULL DEFAULT 0, "currentBalance" REAL NOT NULL DEFAULT 0, "closingDay" INTEGER NOT NULL DEFAULT 1, "dueDay" INTEGER NOT NULL DEFAULT 10, "color" TEXT NOT NULL DEFAULT '#8b5cf6', "flag" TEXT NOT NULL DEFAULT '', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "icon" TEXT NOT NULL DEFAULT 'tag', "type" TEXT NOT NULL DEFAULT 'EXPENSE', "color" TEXT NOT NULL DEFAULT '#6b7280', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Transaction" ("id" TEXT NOT NULL PRIMARY KEY, "type" TEXT NOT NULL, "amount" REAL NOT NULL, "description" TEXT NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "categoryId" TEXT REFERENCES "Category"("id") ON DELETE SET NULL, "accountId" TEXT REFERENCES "Account"("id") ON DELETE SET NULL, "cardId" TEXT REFERENCES "Card"("id") ON DELETE SET NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Purchase" ("id" TEXT NOT NULL PRIMARY KEY, "merchant" TEXT NOT NULL, "totalAmount" REAL NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "installmentNumber" INTEGER NOT NULL DEFAULT 1, "installmentTotal" INTEGER NOT NULL DEFAULT 1, "cardId" TEXT REFERENCES "Card"("id") ON DELETE SET NULL, "accountId" TEXT REFERENCES "Account"("id") ON DELETE SET NULL, "categoryId" TEXT REFERENCES "Category"("id") ON DELETE SET NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "PurchaseItem" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "quantity" INTEGER NOT NULL DEFAULT 1, "unitPrice" REAL NOT NULL, "totalPrice" REAL NOT NULL, "purchaseId" TEXT NOT NULL REFERENCES "Purchase"("id") ON DELETE CASCADE, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "RecurringTransaction" ("id" TEXT NOT NULL PRIMARY KEY, "description" TEXT NOT NULL, "amount" REAL NOT NULL, "type" TEXT NOT NULL, "frequency" TEXT NOT NULL, "nextDate" DATETIME NOT NULL, "categoryId" TEXT REFERENCES "Category"("id") ON DELETE SET NULL, "accountId" TEXT REFERENCES "Account"("id") ON DELETE SET NULL, "cardId" TEXT REFERENCES "Card"("id") ON DELETE SET NULL, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "MonthlyBudget" ("id" TEXT NOT NULL PRIMARY KEY, "categoryId" TEXT NOT NULL REFERENCES "Category"("id") ON DELETE CASCADE, "amount" REAL NOT NULL, "month" INTEGER NOT NULL, "year" INTEGER NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE UNIQUE INDEX "MonthlyBudget_categoryId_month_year_key" ON "MonthlyBudget"("categoryId", "month", "year")`,
      `CREATE TABLE "InstallmentPlan" ("id" TEXT NOT NULL PRIMARY KEY, "description" TEXT NOT NULL, "totalAmount" REAL NOT NULL, "installmentCount" INTEGER NOT NULL, "paidInstallments" INTEGER NOT NULL DEFAULT 0, "monthlyValue" REAL NOT NULL, "interestRate" REAL NOT NULL DEFAULT 0, "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "nextPaymentDate" DATETIME, "type" TEXT NOT NULL DEFAULT 'FINANCING', "status" TEXT NOT NULL DEFAULT 'ACTIVE', "cardId" TEXT REFERENCES "Card"("id") ON DELETE SET NULL, "accountId" TEXT REFERENCES "Account"("id") ON DELETE SET NULL, "categoryId" TEXT REFERENCES "Category"("id") ON DELETE SET NULL, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Installment" ("id" TEXT NOT NULL PRIMARY KEY, "number" INTEGER NOT NULL, "amount" REAL NOT NULL, "dueDate" DATETIME NOT NULL, "paidDate" DATETIME, "status" TEXT NOT NULL DEFAULT 'PENDING', "notes" TEXT NOT NULL DEFAULT '', "installmentPlanId" TEXT NOT NULL REFERENCES "InstallmentPlan"("id") ON DELETE CASCADE, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Consortium" ("id" TEXT NOT NULL PRIMARY KEY, "description" TEXT NOT NULL, "group" TEXT NOT NULL DEFAULT '', "quota" TEXT NOT NULL DEFAULT '', "administrator" TEXT NOT NULL DEFAULT '', "totalAmount" REAL NOT NULL, "fundedAmount" REAL NOT NULL DEFAULT 0, "monthlyPayment" REAL NOT NULL, "installmentCount" INTEGER NOT NULL, "paidInstallments" INTEGER NOT NULL DEFAULT 0, "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "endDate" DATETIME, "nextAssemblyDate" DATETIME, "assembliesAttended" INTEGER NOT NULL DEFAULT 0, "status" TEXT NOT NULL DEFAULT 'ACTIVE', "categoryId" TEXT REFERENCES "Category"("id") ON DELETE SET NULL, "accountId" TEXT REFERENCES "Account"("id") ON DELETE SET NULL, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "ConsortiumInstallment" ("id" TEXT NOT NULL PRIMARY KEY, "number" INTEGER NOT NULL, "amount" REAL NOT NULL, "dueDate" DATETIME NOT NULL, "paidDate" DATETIME, "status" TEXT NOT NULL DEFAULT 'PENDING', "notes" TEXT NOT NULL DEFAULT '', "assemblyDate" DATETIME, "assemblyResult" TEXT NOT NULL DEFAULT '', "consortiumId" TEXT NOT NULL REFERENCES "Consortium"("id") ON DELETE CASCADE, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "SavingsGoal" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '', "type" TEXT NOT NULL DEFAULT 'SAVINGS', "targetAmount" REAL NOT NULL, "currentAmount" REAL NOT NULL DEFAULT 0, "monthlyContribution" REAL NOT NULL DEFAULT 0, "yieldRate" REAL NOT NULL DEFAULT 0, "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "targetDate" DATETIME, "accountId" TEXT REFERENCES "Account"("id") ON DELETE SET NULL, "isCompleted" BOOLEAN NOT NULL DEFAULT false, "color" TEXT NOT NULL DEFAULT '#22c55e', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Investment" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'STOCK', "description" TEXT NOT NULL DEFAULT '', "currentBalance" REAL NOT NULL DEFAULT 0, "investedAmount" REAL NOT NULL DEFAULT 0, "yieldRate" REAL NOT NULL DEFAULT 0, "brokerage" TEXT NOT NULL DEFAULT '', "ticker" TEXT NOT NULL DEFAULT '', "accountId" TEXT REFERENCES "Account"("id") ON DELETE SET NULL, "categoryId" TEXT REFERENCES "Category"("id") ON DELETE SET NULL, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "InvestmentTransaction" ("id" TEXT NOT NULL PRIMARY KEY, "type" TEXT NOT NULL, "amount" REAL NOT NULL, "quantity" REAL NOT NULL DEFAULT 0, "unitPrice" REAL NOT NULL DEFAULT 0, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "description" TEXT NOT NULL DEFAULT '', "notes" TEXT NOT NULL DEFAULT '', "investmentId" TEXT NOT NULL REFERENCES "Investment"("id") ON DELETE CASCADE, "accountId" TEXT REFERENCES "Account"("id") ON DELETE SET NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ];
    for (const sql of ddl) {
      await localDb.$executeRawUnsafe(sql);
    }

    mock.module("@/lib/db", () => ({ db: localDb }));

    cardsHandlers = await import("./cards/route");
    categoriesHandlers = await import("./categories/route");
    transferHandlers = await import("./transfer/route");
    transactionsHandlers = await import("./transactions/route");
    monthlyBudgetsHandlers = await import("./monthly-budgets/route");
    installmentsHandlers = await import("./installments/route");
    installmentsPayHandlers = await import("./installments/pay/route");
    consortiumsHandlers = await import("./consortiums/route");
    consortiumsInstallmentsHandlers = await import("./consortiums/installments/route");
    savingsHandlers = await import("./savings/route");
    savingsDepositHandlers = await import("./savings/deposit/route");
    recurringHandlers = await import("./recurring/route");
    recurringProcessHandlers = await import("./recurring/process/route");
    investmentsHandlers = await import("./investments/route");
    investmentTxHandlers = await import("./investments/transactions/route");
  });

  beforeEach(async () => {
    await localDb.investmentTransaction.deleteMany();
    await localDb.investment.deleteMany();
    await localDb.savingsGoal.deleteMany();
    await localDb.consortiumInstallment.deleteMany();
    await localDb.consortium.deleteMany();
    await localDb.installment.deleteMany();
    await localDb.installmentPlan.deleteMany();
    await localDb.monthlyBudget.deleteMany();
    await localDb.recurringTransaction.deleteMany();
    await localDb.transaction.deleteMany();
    await localDb.category.deleteMany();
    await localDb.card.deleteMany();
    await localDb.account.deleteMany();
  });

  afterAll(async () => {
    await localDb?.$disconnect();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test("cards e categories retornam erros localizados em pt, es e en com code e X-Error-Code", async () => {
    const cardEs = await cardsHandlers.POST(
      new NextRequest("http://localhost/api/cards?locale=es", {
        method: "POST",
        body: JSON.stringify({ name: "" }),
      })
    );
    expect(cardEs.status).toBe(400);
    expect(cardEs.headers.get("X-Error-Code")).toBe("VALIDATION_ERROR");
    expect(await cardEs.json()).toEqual({
      error: "El nombre de la tarjeta es obligatorio",
      code: "VALIDATION_ERROR",
    });

    const cardPt = await cardsHandlers.PUT(
      new NextRequest("http://localhost/api/cards", {
        method: "PUT",
        body: JSON.stringify({ id: "missing" }),
      })
    );
    expect(cardPt.status).toBe(404);
    expect(cardPt.headers.get("X-Error-Code")).toBe("NOT_FOUND");
    expect(await cardPt.json()).toEqual({
      error: "Cartão não encontrado",
      code: "NOT_FOUND",
    });

    const catEn = await categoriesHandlers.DELETE(
      new NextRequest("http://localhost/api/categories?locale=en", {
        method: "DELETE",
        body: JSON.stringify({ id: "missing" }),
      })
    );
    expect(catEn.status).toBe(404);
    expect(catEn.headers.get("X-Error-Code")).toBe("NOT_FOUND");
    expect(await catEn.json()).toEqual({
      error: "Category not found",
      code: "NOT_FOUND",
    });
  });

  test("transfer localiza validações, saldo insuficiente, 404, JSON inválido e mensagem de sucesso", async () => {
    await localDb.account.createMany({
      data: [
        { id: "acc-a", name: "Origem", balance: 100 },
        { id: "acc-b", name: "Destino", balance: 50 },
      ],
    });

    const badJson = await transferHandlers.POST(
      new NextRequest("http://localhost/api/transfer?locale=en", {
        method: "POST",
        body: "{invalid",
      })
    );
    expect(badJson.status).toBe(400);
    expect(badJson.headers.get("X-Error-Code")).toBe("INVALID_JSON");
    expect(await badJson.json()).toEqual({
      error: "Invalid JSON request body.",
      code: "INVALID_JSON",
    });

    const insufficientEs = await transferHandlers.POST(
      new NextRequest("http://localhost/api/transfer?locale=es", {
        method: "POST",
        body: JSON.stringify({ fromAccountId: "acc-a", toAccountId: "acc-b", amount: 500 }),
      })
    );
    expect(insufficientEs.status).toBe(400);
    expect(insufficientEs.headers.get("X-Error-Code")).toBe("INSUFFICIENT_BALANCE");
    expect(await insufficientEs.json()).toEqual({
      error: "Saldo insuficiente en la cuenta de origen",
      code: "INSUFFICIENT_BALANCE",
    });

    const missingEn = await transferHandlers.POST(
      new NextRequest("http://localhost/api/transfer?locale=en", {
        method: "POST",
        body: JSON.stringify({ fromAccountId: "acc-a", toAccountId: "acc-missing", amount: 10 }),
      })
    );
    expect(missingEn.status).toBe(404);
    expect(missingEn.headers.get("X-Error-Code")).toBe("NOT_FOUND");
    expect(await missingEn.json()).toEqual({
      error: "One or both accounts not found",
      code: "NOT_FOUND",
    });

    const okEs = await transferHandlers.POST(
      new NextRequest("http://localhost/api/transfer?locale=es", {
        method: "POST",
        body: JSON.stringify({ fromAccountId: "acc-a", toAccountId: "acc-b", amount: 25 }),
      })
    );
    expect(okEs.status).toBe(201);
    expect(await okEs.json()).toMatchObject({
      success: true,
      message: "Transferencia realizada correctamente",
    });
  });

  test("transactions e monthly-budgets localizam erros de query, validação, conflito e 404", async () => {
    await localDb.category.create({ data: { id: "cat-1", name: "Food" } });
    await localDb.monthlyBudget.create({
      data: { id: "mb-1", categoryId: "cat-1", amount: 300, month: 5, year: 2026 },
    });

    const txBadFrom = await transactionsHandlers.GET(
      new NextRequest("http://localhost/api/transactions?from=invalid&locale=es")
    );
    expect(txBadFrom.status).toBe(400);
    expect(txBadFrom.headers.get("X-Error-Code")).toBe("VALIDATION_ERROR");
    expect(await txBadFrom.json()).toEqual({
      error: "Fecha inicial inválida. Use el formato YYYY-MM-DD.",
      code: "VALIDATION_ERROR",
    });

    const txBadDeleteJson = await transactionsHandlers.DELETE(
      new NextRequest("http://localhost/api/transactions?locale=en", {
        method: "DELETE",
        body: "{broken",
      })
    );
    expect(txBadDeleteJson.status).toBe(400);
    expect(txBadDeleteJson.headers.get("X-Error-Code")).toBe("INVALID_JSON");

    const mbInvalidMonth = await monthlyBudgetsHandlers.GET(
      new NextRequest("http://localhost/api/monthly-budgets?month=13&locale=en")
    );
    expect(mbInvalidMonth.status).toBe(400);
    expect(mbInvalidMonth.headers.get("X-Error-Code")).toBe("VALIDATION_ERROR");
    expect(await mbInvalidMonth.json()).toEqual({
      error: "Month must be an integer between 1 and 12",
      code: "VALIDATION_ERROR",
    });

    const mbDuplicateEs = await monthlyBudgetsHandlers.POST(
      new NextRequest("http://localhost/api/monthly-budgets?locale=es", {
        method: "POST",
        body: JSON.stringify({ categoryId: "cat-1", amount: 400, month: 5, year: 2026 }),
      })
    );
    expect(mbDuplicateEs.status).toBe(409);
    expect(mbDuplicateEs.headers.get("X-Error-Code")).toBe("CONFLICT");
    expect(await mbDuplicateEs.json()).toEqual({
      error: "Ya existe un presupuesto para esta categoría en este mes/año",
      code: "CONFLICT",
    });
  });

  test("installments preserva legado sem sinal de locale e localiza com sinal explícito; pay localiza erros", async () => {
    const legacyNotFound = await installmentsHandlers.GET(
      new NextRequest("http://localhost/api/installments?id=missing")
    );
    expect(legacyNotFound.status).toBe(404);
    expect(legacyNotFound.headers.get("X-Error-Code")).toBe("NOT_FOUND");
    expect(await legacyNotFound.json()).toEqual({
      error: "Plano de parcelamento não encontrado",
    });

    const enNotFound = await installmentsHandlers.GET(
      new NextRequest("http://localhost/api/installments?id=missing&locale=en")
    );
    expect(enNotFound.status).toBe(404);
    expect(enNotFound.headers.get("X-Error-Code")).toBe("NOT_FOUND");
    expect(await enNotFound.json()).toEqual({
      error: "Installment plan not found",
      code: "NOT_FOUND",
    });

    const plan = await localDb.installmentPlan.create({
      data: {
        id: "plan-1",
        description: "Laptop",
        totalAmount: 100,
        installmentCount: 1,
        monthlyValue: 100,
        installments: {
          create: { id: "inst-1", number: 1, amount: 100, dueDate: new Date() },
        },
      },
    });

    const payOkEn = await installmentsPayHandlers.POST(
      new NextRequest("http://localhost/api/installments/pay?locale=en", {
        method: "POST",
        body: JSON.stringify({ installmentId: "inst-1" }),
      })
    );
    expect(payOkEn.status).toBe(200);
    expect(await payOkEn.json()).toMatchObject({
      message: "Installment paid successfully! Installment plan completed.",
    });

    const payAgainEs = await installmentsPayHandlers.POST(
      new NextRequest("http://localhost/api/installments/pay?locale=es", {
        method: "POST",
        body: JSON.stringify({ installmentId: "inst-1" }),
      })
    );
    expect(payAgainEs.status).toBe(400);
    expect(payAgainEs.headers.get("X-Error-Code")).toBeTruthy();
    expect((await payAgainEs.json()).error).toBe("Este plan de cuotas ya fue completado");
    expect(plan.id).toBe("plan-1");
  });

  test("consortiums, consortiums/installments, savings e savings/deposit localizam erros e respostas", async () => {
    const consErrEs = await consortiumsHandlers.POST(
      new NextRequest("http://localhost/api/consortiums?locale=es", {
        method: "POST",
        body: JSON.stringify({ description: "" }),
      })
    );
    expect(consErrEs.status).toBe(400);
    expect(consErrEs.headers.get("X-Error-Code")).toBe("VALIDATION_ERROR");
    expect(await consErrEs.json()).toEqual({
      error: "La descripción del consorcio es obligatoria",
      code: "VALIDATION_ERROR",
    });

    const consInstNotFound = await consortiumsInstallmentsHandlers.POST(
      new NextRequest("http://localhost/api/consortiums/installments?locale=en", {
        method: "POST",
        body: JSON.stringify({ installmentId: "missing" }),
      })
    );
    expect(consInstNotFound.status).toBe(404);
    expect(consInstNotFound.headers.get("X-Error-Code")).toBe("NOT_FOUND");
    expect(await consInstNotFound.json()).toEqual({
      error: "Installment not found",
      code: "NOT_FOUND",
    });

    const savErrEn = await savingsHandlers.POST(
      new NextRequest("http://localhost/api/savings?locale=en", {
        method: "POST",
        body: JSON.stringify({ name: "" }),
      })
    );
    expect(savErrEn.status).toBe(400);
    expect(savErrEn.headers.get("X-Error-Code")).toBe("VALIDATION_ERROR");
    expect(await savErrEn.json()).toEqual({
      error: "Savings goal name is required",
      code: "VALIDATION_ERROR",
    });

    await localDb.savingsGoal.create({
      data: { id: "sg-1", name: "Trip", targetAmount: 50, currentAmount: 0 },
    });

    const depEn = await savingsDepositHandlers.POST(
      new NextRequest("http://localhost/api/savings/deposit?locale=en", {
        method: "POST",
        body: JSON.stringify({ savingsGoalId: "sg-1", amount: 50 }),
      })
    );
    expect(depEn.status).toBe(200);
    expect(await depEn.json()).toMatchObject({
      depositDescription: "Deposit",
      goalCompleted: true,
    });

    const depCompletedEs = await savingsDepositHandlers.POST(
      new NextRequest("http://localhost/api/savings/deposit?locale=es", {
        method: "POST",
        body: JSON.stringify({ savingsGoalId: "sg-1", amount: 10 }),
      })
    );
    expect(depCompletedEs.status).toBe(400);
    expect(depCompletedEs.headers.get("X-Error-Code")).toBe("GOAL_COMPLETED");
    expect(await depCompletedEs.json()).toEqual({
      error: "Esta meta de ahorro ya fue completada",
      code: "GOAL_COMPLETED",
    });
  });

  test("recurring, recurring/process, investments e investments/transactions localizam erros e mensagens", async () => {
    const recErrEs = await recurringHandlers.POST(
      new NextRequest("http://localhost/api/recurring?locale=es", {
        method: "POST",
        body: JSON.stringify({ description: "" }),
      })
    );
    expect(recErrEs.status).toBe(400);
    expect(recErrEs.headers.get("X-Error-Code")).toBe("VALIDATION_ERROR");
    expect(await recErrEs.json()).toEqual({
      error: "La descripción es obligatoria",
      code: "VALIDATION_ERROR",
    });

    const procDefaultPt = await recurringProcessHandlers.POST();
    expect(procDefaultPt.status).toBe(200);
    expect(await procDefaultPt.json()).toMatchObject({
      success: true,
      processed: 0,
      message: "Nenhuma transação recorrente pendente",
    });

    const procEn = await recurringProcessHandlers.POST(
      new NextRequest("http://localhost/api/recurring/process?locale=en", { method: "POST" })
    );
    expect(procEn.status).toBe(200);
    expect(await procEn.json()).toMatchObject({
      success: true,
      processed: 0,
      message: "No pending recurring transactions",
    });

    const invErrEn = await investmentsHandlers.POST(
      new NextRequest("http://localhost/api/investments?locale=en", {
        method: "POST",
        body: JSON.stringify({ name: "" }),
      })
    );
    expect(invErrEn.status).toBe(400);
    expect(invErrEn.headers.get("X-Error-Code")).toBe("VALIDATION_ERROR");
    expect(await invErrEn.json()).toEqual({
      error: "Investment name is required",
      code: "VALIDATION_ERROR",
    });

    const invTxErrEs = await investmentTxHandlers.POST(
      new NextRequest("http://localhost/api/investments/transactions?locale=es", {
        method: "POST",
        body: JSON.stringify({ investmentId: "" }),
      })
    );
    expect(invTxErrEs.status).toBe(400);
    expect(invTxErrEs.headers.get("X-Error-Code")).toBe("VALIDATION_ERROR");
    expect(await invTxErrEs.json()).toEqual({
      error: "El ID de la inversión es obligatorio",
      code: "VALIDATION_ERROR",
    });
  });
});
