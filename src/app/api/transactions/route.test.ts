import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

describe("PUT e DELETE /api/transactions - validação e reconciliação de saldo", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let PUT: typeof import("./route").PUT;
  let DELETE: typeof import("./route").DELETE;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "transactions-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `CREATE TABLE "Account" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CASH', "balance" REAL NOT NULL DEFAULT 0, "color" TEXT NOT NULL DEFAULT '#6366f1', "icon" TEXT NOT NULL DEFAULT 'wallet', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Card" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CREDIT', "brand" TEXT NOT NULL DEFAULT 'VISA', "lastFourDigits" TEXT NOT NULL, "creditLimit" REAL NOT NULL DEFAULT 0, "currentBalance" REAL NOT NULL DEFAULT 0, "closingDay" INTEGER NOT NULL DEFAULT 1, "dueDay" INTEGER NOT NULL DEFAULT 10, "color" TEXT NOT NULL DEFAULT '#8b5cf6', "flag" TEXT NOT NULL DEFAULT '', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "icon" TEXT NOT NULL DEFAULT 'tag', "type" TEXT NOT NULL DEFAULT 'EXPENSE', "color" TEXT NOT NULL DEFAULT '#6b7280', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Transaction" ("id" TEXT NOT NULL PRIMARY KEY, "type" TEXT NOT NULL, "amount" REAL NOT NULL, "description" TEXT NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "categoryId" TEXT REFERENCES "Category"("id"), "accountId" TEXT REFERENCES "Account"("id"), "cardId" TEXT REFERENCES "Card"("id"), "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ];
    for (const sql of ddl) {
      await localDb.$executeRawUnsafe(sql);
    }

    mock.module("@/lib/db", () => ({ db: localDb }));
    ({ PUT, DELETE } = await import("./route"));
  });

  beforeEach(async () => {
    await localDb.transaction.deleteMany();
    await localDb.account.deleteMany();
    await localDb.account.create({
      data: { id: "acc-1", name: "Conta Corrente", balance: 900 },
    });
    await localDb.transaction.create({
      data: {
        id: "tx-1",
        type: "EXPENSE",
        amount: 100,
        description: "Mercado",
        accountId: "acc-1",
      },
    });
  });

  afterAll(async () => {
    await localDb?.$disconnect();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test("DELETE aceita id via query param (?id=...) sem body JSON e reverte o saldo da conta", async () => {
    const req = new NextRequest("http://localhost/api/transactions?id=tx-1", {
      method: "DELETE",
    });

    const res = await DELETE(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });

    const acc = await localDb.account.findUniqueOrThrow({ where: { id: "acc-1" } });
    expect(acc.balance).toBe(1000);
    expect(await localDb.transaction.findUnique({ where: { id: "tx-1" } })).toBeNull();
  });

  test("PUT rejeita amount <= 0, description vazia e type inválido com 400 sem alterar saldo", async () => {
    for (const payload of [
      { id: "tx-1", amount: 0 },
      { id: "tx-1", amount: -50 },
      { id: "tx-1", description: "   " },
      { id: "tx-1", type: "INVALID" },
    ]) {
      const req = new NextRequest("http://localhost/api/transactions", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    }

    const acc = await localDb.account.findUniqueOrThrow({ where: { id: "acc-1" } });
    expect(acc.balance).toBe(900);
  });

  test("PUT atualiza transação e reconcilia saldo atomicamente", async () => {
    const req = new NextRequest("http://localhost/api/transactions", {
      method: "PUT",
      body: JSON.stringify({ id: "tx-1", type: "INCOME", amount: 250, description: "Reembolso" }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);

    const acc = await localDb.account.findUniqueOrThrow({ where: { id: "acc-1" } });
    // 900 + 100 (revert EXPENSE) + 250 (apply INCOME) = 1250
    expect(acc.balance).toBe(1250);
  });
});
