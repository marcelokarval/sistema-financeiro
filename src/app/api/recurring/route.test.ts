/// <reference types="bun-types" />

import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

describe("POST, PUT e DELETE /api/recurring - validação JSON, domínio e FKs", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let POST: typeof import("./route").POST;
  let PUT: typeof import("./route").PUT;
  let DELETE: typeof import("./route").DELETE;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "recurring-val-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `CREATE TABLE "Account" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CASH', "balance" REAL NOT NULL DEFAULT 0, "color" TEXT NOT NULL DEFAULT '#6366f1', "icon" TEXT NOT NULL DEFAULT 'wallet', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Card" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CREDIT', "brand" TEXT NOT NULL DEFAULT 'VISA', "lastFourDigits" TEXT NOT NULL, "creditLimit" REAL NOT NULL DEFAULT 0, "currentBalance" REAL NOT NULL DEFAULT 0, "closingDay" INTEGER NOT NULL DEFAULT 1, "dueDay" INTEGER NOT NULL DEFAULT 10, "color" TEXT NOT NULL DEFAULT '#8b5cf6', "flag" TEXT NOT NULL DEFAULT '', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "icon" TEXT NOT NULL DEFAULT 'tag', "type" TEXT NOT NULL DEFAULT 'EXPENSE', "color" TEXT NOT NULL DEFAULT '#6b7280', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "RecurringTransaction" ("id" TEXT NOT NULL PRIMARY KEY, "description" TEXT NOT NULL, "amount" REAL NOT NULL, "type" TEXT NOT NULL, "frequency" TEXT NOT NULL, "nextDate" DATETIME NOT NULL, "categoryId" TEXT REFERENCES "Category"("id"), "accountId" TEXT REFERENCES "Account"("id"), "cardId" TEXT REFERENCES "Card"("id"), "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ];
    for (const sql of ddl) {
      await localDb.$executeRawUnsafe(sql);
    }

    mock.module("@/lib/db", () => ({ db: localDb }));
    ({ POST, PUT, DELETE } = await import("./route"));
  });

  beforeEach(async () => {
    await localDb.recurringTransaction.deleteMany();
    await localDb.card.deleteMany();
    await localDb.account.deleteMany();
    await localDb.category.deleteMany();

    await localDb.card.create({
      data: { id: "card-1", name: "Cartão", lastFourDigits: "1111" },
    });
    await localDb.account.create({
      data: { id: "acc-1", name: "Conta", balance: 1000 },
    });
    await localDb.category.create({
      data: { id: "cat-1", name: "Assinaturas" },
    });
    await localDb.recurringTransaction.create({
      data: {
        id: "rec-1",
        description: "Streaming",
        amount: 55,
        type: "EXPENSE",
        frequency: "MONTHLY",
        nextDate: new Date("2026-12-01"),
        accountId: "acc-1",
        categoryId: "cat-1",
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
    ["DELETE", "true"],
  ] as const)("%s rejeita JSON inválido (%s) com HTTP 400", async (method, rawBody) => {
    const req = new NextRequest("http://localhost/api/recurring", {
      method,
      body: rawBody,
    });
    const handler = method === "POST" ? POST : method === "PUT" ? PUT : DELETE;
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  test("POST rejeita campos inválidos e FKs inexistentes com HTTP 400", async () => {
    const base = {
      description: "Academia",
      amount: 120,
      type: "EXPENSE",
      frequency: "MONTHLY",
      nextDate: "2026-12-05",
    };

    for (const payload of [
      { ...base, description: "   " },
      { ...base, amount: 0 },
      { ...base, amount: -20 },
      { ...base, amount: "NaN" },
      { ...base, type: "TRANSFER" },
      { ...base, frequency: "DAILY" },
      { ...base, nextDate: "2026-02-30" },
      { ...base, nextDate: "invalida" },
      { ...base, categoryId: "cat-inexistente" },
      { ...base, accountId: "acc-inexistente" },
      { ...base, cardId: "card-inexistente" },
    ]) {
      const req = new NextRequest("http://localhost/api/recurring", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    }

    expect(await localDb.recurringTransaction.count()).toBe(1);
  });

  test("PUT rejeita dados inválidos e FKs inexistentes com HTTP 400 sem alterar registro", async () => {
    for (const payload of [
      { id: "rec-1", description: "   " },
      { id: "rec-1", amount: "NaN" },
      { id: "rec-1", amount: -10 },
      { id: "rec-1", amount: 0 },
      { id: "rec-1", type: "INVALID" },
      { id: "rec-1", frequency: "HOURLY" },
      { id: "rec-1", nextDate: "2026-02-30" },
      { id: "rec-1", isActive: "true" },
      { id: "rec-1", categoryId: "cat-inexistente" },
      { id: "rec-1", accountId: "acc-inexistente" },
      { id: "rec-1", cardId: "card-inexistente" },
    ]) {
      const req = new NextRequest("http://localhost/api/recurring", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    }

    const stored = await localDb.recurringTransaction.findUniqueOrThrow({ where: { id: "rec-1" } });
    expect(stored.description).toBe("Streaming");
    expect(stored.amount).toBe(55);
  });

  test("POST, PUT e DELETE funcionam com dados e FKs válidas", async () => {
    const postRes = await POST(
      new NextRequest("http://localhost/api/recurring", {
        method: "POST",
        body: JSON.stringify({
          description: "Salário",
          amount: "5000",
          type: "INCOME",
          frequency: "MONTHLY",
          nextDate: "2026-12-01",
          accountId: "acc-1",
          categoryId: "cat-1",
          cardId: "card-1",
        }),
      })
    );
    expect(postRes.status).toBe(201);
    const created = await postRes.json();

    const putRes = await PUT(
      new NextRequest("http://localhost/api/recurring", {
        method: "PUT",
        body: JSON.stringify({
          id: created.id,
          amount: 5500,
          isActive: false,
        }),
      })
    );
    expect(putRes.status).toBe(200);
    const updated = await putRes.json();
    expect(updated.amount).toBe(5500);
    expect(updated.isActive).toBe(false);

    const delRes = await DELETE(
      new NextRequest("http://localhost/api/recurring", {
        method: "DELETE",
        body: JSON.stringify({ id: created.id }),
      })
    );
    expect(delRes.status).toBe(200);
    expect(await localDb.recurringTransaction.findUnique({ where: { id: created.id } })).toBeNull();
  });
});
