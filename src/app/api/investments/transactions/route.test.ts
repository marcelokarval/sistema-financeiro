import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

describe("POST, PUT e DELETE /api/investments/transactions - validação e reconciliação", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let POST: typeof import("./route").POST;
  let PUT: typeof import("./route").PUT;
  let DELETE: typeof import("./route").DELETE;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "inv-tx-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `CREATE TABLE "Account" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CASH', "balance" REAL NOT NULL DEFAULT 0, "color" TEXT NOT NULL DEFAULT '#6366f1', "icon" TEXT NOT NULL DEFAULT 'wallet', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Investment" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'STOCK', "description" TEXT NOT NULL DEFAULT '', "currentBalance" REAL NOT NULL DEFAULT 0, "investedAmount" REAL NOT NULL DEFAULT 0, "yieldRate" REAL NOT NULL DEFAULT 0, "brokerage" TEXT NOT NULL DEFAULT '', "ticker" TEXT NOT NULL DEFAULT '', "accountId" TEXT, "categoryId" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "InvestmentTransaction" ("id" TEXT NOT NULL PRIMARY KEY, "type" TEXT NOT NULL, "amount" REAL NOT NULL, "quantity" REAL NOT NULL DEFAULT 0, "unitPrice" REAL NOT NULL DEFAULT 0, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "description" TEXT NOT NULL DEFAULT '', "notes" TEXT NOT NULL DEFAULT '', "investmentId" TEXT NOT NULL REFERENCES "Investment"("id") ON DELETE CASCADE, "accountId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ];
    for (const sql of ddl) {
      await localDb.$executeRawUnsafe(sql);
    }

    mock.module("@/lib/db", () => ({ db: localDb }));
    ({ POST, PUT, DELETE } = await import("./route"));
  });

  beforeEach(async () => {
    await localDb.investmentTransaction.deleteMany();
    await localDb.investment.deleteMany();
    await localDb.investment.create({
      data: { id: "inv-1", name: "CDB 100%", currentBalance: 1000, investedAmount: 1000 },
    });
    await localDb.investmentTransaction.create({
      data: { id: "itx-1", investmentId: "inv-1", type: "APORTE", amount: 200, description: "Aporte inicial" },
    });
  });

  afterAll(async () => {
    await localDb?.$disconnect();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test("DELETE aceita id via query param (?id=...) sem body JSON e reverte currentBalance e investedAmount", async () => {
    const req = new NextRequest("http://localhost/api/investments/transactions?id=itx-1", {
      method: "DELETE",
    });

    const res = await DELETE(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });

    const inv = await localDb.investment.findUniqueOrThrow({ where: { id: "inv-1" } });
    expect(inv.currentBalance).toBe(800);
    expect(inv.investedAmount).toBe(800);
    expect(await localDb.investmentTransaction.findUnique({ where: { id: "itx-1" } })).toBeNull();
  });

  test("PUT rejeita tipo inválido e amount <= 0 com 400 sem alterar o investimento", async () => {
    for (const payload of [
      { id: "itx-1", type: "INVALIDO" },
      { id: "itx-1", amount: 0 },
      { id: "itx-1", amount: -10 },
    ]) {
      const req = new NextRequest("http://localhost/api/investments/transactions", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    }

    const inv = await localDb.investment.findUniqueOrThrow({ where: { id: "inv-1" } });
    expect(inv.currentBalance).toBe(1000);
    expect(inv.investedAmount).toBe(1000);
  });

  test("PUT atualiza tipo/valor e reconcilia currentBalance e investedAmount", async () => {
    const req = new NextRequest("http://localhost/api/investments/transactions", {
      method: "PUT",
      body: JSON.stringify({ id: "itx-1", type: "DIVIDENDO", amount: 50 }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);

    const inv = await localDb.investment.findUniqueOrThrow({ where: { id: "inv-1" } });
    // Reverted APORTE (200): currentBalance=800, investedAmount=800; applied DIVIDENDO (50): currentBalance=850, investedAmount=800
    expect(inv.currentBalance).toBe(850);
    expect(inv.investedAmount).toBe(800);
  });

  test("POST rejeita amount inválido (0, negativo, NaN, Infinity, texto) e date inválida com 400", async () => {
    for (const payload of [
      { investmentId: "inv-1", type: "APORTE", amount: 0 },
      { investmentId: "inv-1", type: "APORTE", amount: -10 },
      { investmentId: "inv-1", type: "APORTE", amount: "NaN" },
      { investmentId: "inv-1", type: "APORTE", amount: "Infinity" },
      { investmentId: "inv-1", type: "APORTE", amount: "abc" },
      { investmentId: "inv-1", type: "APORTE", amount: 100, date: "data-invalida" },
    ]) {
      const req = new NextRequest("http://localhost/api/investments/transactions", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    }

    const inv = await localDb.investment.findUniqueOrThrow({ where: { id: "inv-1" } });
    expect(inv.currentBalance).toBe(1000);
    expect(inv.investedAmount).toBe(1000);
    expect(await localDb.investmentTransaction.count()).toBe(1);
  });

  test("POST cria transação válida com amount numérico e atualiza saldos", async () => {
    const req = new NextRequest("http://localhost/api/investments/transactions", {
      method: "POST",
      body: JSON.stringify({
        investmentId: "inv-1",
        type: "APORTE",
        amount: "250",
        date: "2026-11-15T12:00:00.000Z",
        description: "Novo aporte",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.amount).toBe(250);

    const inv = await localDb.investment.findUniqueOrThrow({ where: { id: "inv-1" } });
    expect(inv.currentBalance).toBe(1250);
    expect(inv.investedAmount).toBe(1250);
  });
});
