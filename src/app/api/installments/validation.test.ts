/// <reference types="bun-types" />

import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

describe("POST, PUT e DELETE /api/installments - validação JSON, domínio e FKs", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let POST: typeof import("./route").POST;
  let PUT: typeof import("./route").PUT;
  let DELETE: typeof import("./route").DELETE;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "installments-val-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `CREATE TABLE "Account" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CASH', "balance" REAL NOT NULL DEFAULT 0, "color" TEXT NOT NULL DEFAULT '#6366f1', "icon" TEXT NOT NULL DEFAULT 'wallet', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Card" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CREDIT', "brand" TEXT NOT NULL DEFAULT 'VISA', "lastFourDigits" TEXT NOT NULL, "creditLimit" REAL NOT NULL DEFAULT 0, "currentBalance" REAL NOT NULL DEFAULT 0, "closingDay" INTEGER NOT NULL DEFAULT 1, "dueDay" INTEGER NOT NULL DEFAULT 10, "color" TEXT NOT NULL DEFAULT '#8b5cf6', "flag" TEXT NOT NULL DEFAULT '', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "icon" TEXT NOT NULL DEFAULT 'tag', "type" TEXT NOT NULL DEFAULT 'EXPENSE', "color" TEXT NOT NULL DEFAULT '#6b7280', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "InstallmentPlan" ("id" TEXT NOT NULL PRIMARY KEY, "description" TEXT NOT NULL, "totalAmount" REAL NOT NULL, "installmentCount" INTEGER NOT NULL, "paidInstallments" INTEGER NOT NULL DEFAULT 0, "monthlyValue" REAL NOT NULL, "interestRate" REAL NOT NULL DEFAULT 0, "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "nextPaymentDate" DATETIME, "type" TEXT NOT NULL DEFAULT 'FINANCING', "status" TEXT NOT NULL DEFAULT 'ACTIVE', "cardId" TEXT REFERENCES "Card"("id"), "accountId" TEXT, "categoryId" TEXT REFERENCES "Category"("id"), "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Installment" ("id" TEXT NOT NULL PRIMARY KEY, "number" INTEGER NOT NULL, "amount" REAL NOT NULL, "dueDate" DATETIME NOT NULL, "paidDate" DATETIME, "status" TEXT NOT NULL DEFAULT 'PENDING', "notes" TEXT NOT NULL DEFAULT '', "installmentPlanId" TEXT NOT NULL REFERENCES "InstallmentPlan"("id") ON DELETE CASCADE, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ];
    for (const sql of ddl) {
      await localDb.$executeRawUnsafe(sql);
    }

    mock.module("@/lib/db", () => ({ db: localDb }));
    ({ POST, PUT, DELETE } = await import("./route"));
  });

  beforeEach(async () => {
    await localDb.installment.deleteMany();
    await localDb.installmentPlan.deleteMany();
    await localDb.card.deleteMany();
    await localDb.account.deleteMany();
    await localDb.category.deleteMany();

    await localDb.card.create({
      data: { id: "card-1", name: "Cartão", lastFourDigits: "4321" },
    });
    await localDb.account.create({
      data: { id: "acc-1", name: "Conta", balance: 1000 },
    });
    await localDb.category.create({
      data: { id: "cat-1", name: "Equipamentos" },
    });
    await localDb.installmentPlan.create({
      data: {
        id: "plan-1",
        description: "Notebook",
        totalAmount: 1200,
        installmentCount: 3,
        monthlyValue: 400,
        paidInstallments: 0,
        installments: {
          create: [
            { id: "i-1", number: 1, amount: 400, dueDate: new Date("2026-11-10") },
            { id: "i-2", number: 2, amount: 400, dueDate: new Date("2026-12-10") },
            { id: "i-3", number: 3, amount: 400, dueDate: new Date("2027-01-10") },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await localDb?.$disconnect();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test.each([
    ["POST", "{malformed"],
    ["POST", ""],
    ["POST", "null"],
    ["PUT", "{malformed"],
    ["PUT", "[]"],
    ["DELETE", "{malformed"],
    ["DELETE", '"texto"'],
  ] as const)("%s rejeita JSON inválido (%s) com HTTP 400", async (method, rawBody) => {
    const req = new NextRequest("http://localhost/api/installments", {
      method,
      body: rawBody,
    });
    const handler = method === "POST" ? POST : method === "PUT" ? PUT : DELETE;
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  test("POST rejeita valores inválidos e FKs inexistentes com HTTP 400", async () => {
    const base = {
      description: "Celular",
      totalAmount: 1000,
      installmentCount: 5,
      monthlyValue: 200,
    };

    for (const payload of [
      { ...base, description: "   " },
      { ...base, totalAmount: 0 },
      { ...base, totalAmount: -100 },
      { ...base, totalAmount: "NaN" },
      { ...base, installmentCount: 0 },
      { ...base, installmentCount: 2.5 },
      { ...base, monthlyValue: 0 },
      { ...base, monthlyValue: "NaN" },
      { ...base, interestRate: -1 },
      { ...base, startDate: "2026-02-30" },
      { ...base, type: "INVALID_TYPE" },
      { ...base, cardId: "card-inexistente" },
      { ...base, accountId: "acc-inexistente" },
      { ...base, categoryId: "cat-inexistente" },
    ]) {
      const req = new NextRequest("http://localhost/api/installments", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    }

    expect(await localDb.installmentPlan.count()).toBe(1);
  });

  test("PUT rejeita dados inválidos, paidInstallments fora do intervalo e FKs inexistentes com HTTP 400", async () => {
    for (const payload of [
      { id: "plan-1", description: "   " },
      { id: "plan-1", totalAmount: 0 },
      { id: "plan-1", totalAmount: "NaN" },
      { id: "plan-1", installmentCount: 0 },
      { id: "plan-1", installmentCount: 1.5 },
      { id: "plan-1", monthlyValue: -50 },
      { id: "plan-1", interestRate: "Infinity" },
      { id: "plan-1", startDate: "2026-02-30" },
      { id: "plan-1", type: "INVALID" },
      { id: "plan-1", status: "INVALID" },
      { id: "plan-1", paidInstallments: -1 },
      { id: "plan-1", paidInstallments: 4 },
      { id: "plan-1", paidInstallments: 1.5 },
      { id: "plan-1", cardId: "card-inexistente" },
      { id: "plan-1", accountId: "acc-inexistente" },
      { id: "plan-1", categoryId: "cat-inexistente" },
    ]) {
      const req = new NextRequest("http://localhost/api/installments", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    }

    const stored = await localDb.installmentPlan.findUniqueOrThrow({ where: { id: "plan-1" } });
    expect(stored.description).toBe("Notebook");
    expect(stored.paidInstallments).toBe(0);
  });

  test("PUT atualiza paidInstallments válido e sincroniza parcelas", async () => {
    const req = new NextRequest("http://localhost/api/installments", {
      method: "PUT",
      body: JSON.stringify({
        id: "plan-1",
        paidInstallments: 2,
        cardId: "card-1",
        accountId: "acc-1",
        categoryId: "cat-1",
      }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.paidInstallments).toBe(2);

    const installments = await localDb.installment.findMany({
      where: { installmentPlanId: "plan-1" },
      orderBy: { number: "asc" },
    });
    expect(installments.map((i) => i.status)).toEqual(["PAID", "PAID", "PENDING"]);
  });
});
