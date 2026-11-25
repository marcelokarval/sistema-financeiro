/// <reference types="bun-types" />

import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

describe("POST, PUT e DELETE /api/purchases - validação JSON, domínio e FKs", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let POST: typeof import("./route").POST;
  let PUT: typeof import("./route").PUT;
  let DELETE: typeof import("./route").DELETE;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "purchases-val-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `CREATE TABLE "Account" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CASH', "balance" REAL NOT NULL DEFAULT 0, "color" TEXT NOT NULL DEFAULT '#6366f1', "icon" TEXT NOT NULL DEFAULT 'wallet', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Card" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CREDIT', "brand" TEXT NOT NULL DEFAULT 'VISA', "lastFourDigits" TEXT NOT NULL, "creditLimit" REAL NOT NULL DEFAULT 0, "currentBalance" REAL NOT NULL DEFAULT 0, "closingDay" INTEGER NOT NULL DEFAULT 1, "dueDay" INTEGER NOT NULL DEFAULT 10, "color" TEXT NOT NULL DEFAULT '#8b5cf6', "flag" TEXT NOT NULL DEFAULT '', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "icon" TEXT NOT NULL DEFAULT 'tag', "type" TEXT NOT NULL DEFAULT 'EXPENSE', "color" TEXT NOT NULL DEFAULT '#6b7280', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Purchase" ("id" TEXT NOT NULL PRIMARY KEY, "merchant" TEXT NOT NULL, "totalAmount" REAL NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "installmentNumber" INTEGER NOT NULL DEFAULT 1, "installmentTotal" INTEGER NOT NULL DEFAULT 1, "cardId" TEXT REFERENCES "Card"("id"), "accountId" TEXT, "categoryId" TEXT REFERENCES "Category"("id"), "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "PurchaseItem" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "quantity" INTEGER NOT NULL DEFAULT 1, "unitPrice" REAL NOT NULL, "totalPrice" REAL NOT NULL, "purchaseId" TEXT NOT NULL REFERENCES "Purchase"("id") ON DELETE CASCADE, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ];
    for (const sql of ddl) {
      await localDb.$executeRawUnsafe(sql);
    }

    mock.module("@/lib/db", () => ({ db: localDb }));
    ({ POST, PUT, DELETE } = await import("./route"));
  });

  beforeEach(async () => {
    await localDb.purchaseItem.deleteMany();
    await localDb.purchase.deleteMany();
    await localDb.card.deleteMany();
    await localDb.account.deleteMany();
    await localDb.category.deleteMany();

    await localDb.card.create({
      data: { id: "card-1", name: "Cartão Principal", lastFourDigits: "1234" },
    });
    await localDb.account.create({
      data: { id: "acc-1", name: "Conta Principal", balance: 500 },
    });
    await localDb.category.create({
      data: { id: "cat-1", name: "Alimentação" },
    });
    await localDb.purchase.create({
      data: {
        id: "pur-1",
        merchant: "Mercado Original",
        totalAmount: 50,
        cardId: "card-1",
        categoryId: "cat-1",
        items: {
          create: [{ id: "item-1", name: "Café", quantity: 1, unitPrice: 50, totalPrice: 50 }],
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
    ["POST", "[]"],
    ["PUT", "{malformed"],
    ["PUT", "null"],
    ["DELETE", "{malformed"],
    ["DELETE", "[]"],
  ] as const)("%s rejeita JSON inválido (%s) com HTTP 400", async (method, rawBody) => {
    const req = new NextRequest("http://localhost/api/purchases", {
      method,
      body: rawBody,
    });
    const handler = method === "POST" ? POST : method === "PUT" ? PUT : DELETE;
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  test("POST rejeita campos inválidos e FKs inexistentes com HTTP 400", async () => {
    const base = {
      merchant: "Padaria",
      totalAmount: 25,
      items: [{ name: "Pão", quantity: 1, unitPrice: 25, totalPrice: 25 }],
    };

    for (const payload of [
      { ...base, merchant: "   " },
      { ...base, totalAmount: 0 },
      { ...base, totalAmount: -10 },
      { ...base, totalAmount: "NaN" },
      { ...base, date: "2026-02-30" },
      { ...base, date: "invalida" },
      { ...base, items: [] },
      { ...base, items: [{ name: "   ", unitPrice: 10 }] },
      { ...base, cardId: "card-inexistente" },
      { ...base, accountId: "acc-inexistente" },
      { ...base, categoryId: "cat-inexistente" },
    ]) {
      const req = new NextRequest("http://localhost/api/purchases", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    }

    expect(await localDb.purchase.count()).toBe(1);
  });

  test("PUT rejeita campos inválidos e FKs inexistentes com HTTP 400 sem alterar registro", async () => {
    for (const payload of [
      { id: "pur-1", merchant: "   " },
      { id: "pur-1", totalAmount: 0 },
      { id: "pur-1", totalAmount: -15 },
      { id: "pur-1", totalAmount: "Infinity" },
      { id: "pur-1", date: "2026-02-30" },
      { id: "pur-1", items: "nao-array" },
      { id: "pur-1", items: [{ name: "", unitPrice: 10 }] },
      { id: "pur-1", cardId: "card-inexistente" },
      { id: "pur-1", accountId: "acc-inexistente" },
      { id: "pur-1", categoryId: "cat-inexistente" },
    ]) {
      const req = new NextRequest("http://localhost/api/purchases", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    }

    const stored = await localDb.purchase.findUniqueOrThrow({ where: { id: "pur-1" } });
    expect(stored.merchant).toBe("Mercado Original");
    expect(stored.totalAmount).toBe(50);
  });

  test("POST e PUT aceitam FKs existentes e valores válidos", async () => {
    const postReq = new NextRequest("http://localhost/api/purchases", {
      method: "POST",
      body: JSON.stringify({
        merchant: "Supermercado",
        totalAmount: "45.5",
        date: "2026-11-25",
        cardId: "card-1",
        accountId: "acc-1",
        categoryId: "cat-1",
        items: [{ name: "Arroz", quantity: 1, unitPrice: 45.5 }],
      }),
    });
    const postRes = await POST(postReq);
    expect(postRes.status).toBe(201);
    const created = await postRes.json();
    expect(created.accountId).toBe("acc-1");

    const putReq = new NextRequest("http://localhost/api/purchases", {
      method: "PUT",
      body: JSON.stringify({
        id: created.id,
        merchant: "Supermercado Atualizado",
        totalAmount: 60,
        items: [],
      }),
    });
    const putRes = await PUT(putReq);
    expect(putRes.status).toBe(200);
    const updated = await putRes.json();
    expect(updated.merchant).toBe("Supermercado Atualizado");
    expect(updated.items).toEqual([]);
  });
});
