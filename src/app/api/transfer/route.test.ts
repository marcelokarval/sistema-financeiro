import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

describe("POST /api/transfer - atomicidade, TOCTOU e type TRANSFER", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let POST: typeof import("./route").POST;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "transfer-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `CREATE TABLE "Account" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CASH', "balance" REAL NOT NULL DEFAULT 0, "color" TEXT NOT NULL DEFAULT '#6366f1', "icon" TEXT NOT NULL DEFAULT 'wallet', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "icon" TEXT NOT NULL DEFAULT 'tag', "type" TEXT NOT NULL DEFAULT 'EXPENSE', "color" TEXT NOT NULL DEFAULT '#6b7280', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Transaction" ("id" TEXT NOT NULL PRIMARY KEY, "type" TEXT NOT NULL, "amount" REAL NOT NULL, "description" TEXT NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "categoryId" TEXT REFERENCES "Category"("id"), "accountId" TEXT REFERENCES "Account"("id"), "cardId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ];
    for (const sql of ddl) {
      await localDb.$executeRawUnsafe(sql);
    }

    mock.module("@/lib/db", () => ({ db: localDb }));
    ({ POST } = await import("./route"));
  });

  beforeEach(async () => {
    await localDb.transaction.deleteMany();
    await localDb.account.deleteMany();
    await localDb.account.createMany({
      data: [
        { id: "acc-from", name: "Conta Origem", balance: 1000 },
        { id: "acc-to", name: "Conta Destino", balance: 200 },
      ],
    });
  });

  afterAll(async () => {
    await localDb?.$disconnect();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test("grava ambas transações com type TRANSFER e atualiza saldos atomicamente", async () => {
    const req = new NextRequest("http://localhost/api/transfer", {
      method: "POST",
      body: JSON.stringify({
        fromAccountId: "acc-from",
        toAccountId: "acc-to",
        amount: 350,
        description: "Reserva mensal",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.withdrawal.type).toBe("TRANSFER");
    expect(data.deposit.type).toBe("TRANSFER");

    const fromAcc = await localDb.account.findUniqueOrThrow({ where: { id: "acc-from" } });
    const toAcc = await localDb.account.findUniqueOrThrow({ where: { id: "acc-to" } });
    expect(fromAcc.balance).toBe(650);
    expect(toAcc.balance).toBe(550);

    const txs = await localDb.transaction.findMany();
    expect(txs).toHaveLength(2);
    expect(txs.every((t) => t.type === "TRANSFER")).toBe(true);
  });

  test("rejeita amount inválido e date inválida com 400 sem alterar saldos", async () => {
    for (const payload of [
      { fromAccountId: "acc-from", toAccountId: "acc-to", amount: 0 },
      { fromAccountId: "acc-from", toAccountId: "acc-to", amount: -10 },
      { fromAccountId: "acc-from", toAccountId: "acc-to", amount: "NaN" },
      { fromAccountId: "acc-from", toAccountId: "acc-to", amount: "Infinity" },
      { fromAccountId: "acc-from", toAccountId: "acc-to", amount: 100, date: "data-invalida" },
    ]) {
      const req = new NextRequest("http://localhost/api/transfer", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    }

    const fromAcc = await localDb.account.findUniqueOrThrow({ where: { id: "acc-from" } });
    const toAcc = await localDb.account.findUniqueOrThrow({ where: { id: "acc-to" } });
    expect(fromAcc.balance).toBe(1000);
    expect(toAcc.balance).toBe(200);
    expect(await localDb.transaction.count()).toBe(0);
  });

  test("faz rollback completo se a atualização da conta destino falhar dentro da transação", async () => {
    await localDb.$executeRawUnsafe(
      `CREATE TRIGGER fail_dest_credit BEFORE UPDATE ON "Account" WHEN NEW.id = 'acc-to' BEGIN SELECT RAISE(ABORT, 'simulated failure'); END;`
    );

    try {
      const req = new NextRequest("http://localhost/api/transfer", {
        method: "POST",
        body: JSON.stringify({
          fromAccountId: "acc-from",
          toAccountId: "acc-to",
          amount: 250,
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(500);

      const fromAcc = await localDb.account.findUniqueOrThrow({ where: { id: "acc-from" } });
      const toAcc = await localDb.account.findUniqueOrThrow({ where: { id: "acc-to" } });
      expect(fromAcc.balance).toBe(1000);
      expect(toAcc.balance).toBe(200);
      expect(await localDb.transaction.count()).toBe(0);
    } finally {
      await localDb.$executeRawUnsafe(`DROP TRIGGER IF EXISTS fail_dest_credit;`);
    }
  });

  test("impede saldo negativo em transferências concorrentes (TOCTOU)", async () => {
    const req1 = new NextRequest("http://localhost/api/transfer", {
      method: "POST",
      body: JSON.stringify({ fromAccountId: "acc-from", toAccountId: "acc-to", amount: 700 }),
    });
    const req2 = new NextRequest("http://localhost/api/transfer", {
      method: "POST",
      body: JSON.stringify({ fromAccountId: "acc-from", toAccountId: "acc-to", amount: 700 }),
    });

    const [res1, res2] = await Promise.all([POST(req1), POST(req2)]);
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 400]);

    const fromAcc = await localDb.account.findUniqueOrThrow({ where: { id: "acc-from" } });
    const toAcc = await localDb.account.findUniqueOrThrow({ where: { id: "acc-to" } });
    expect(fromAcc.balance).toBe(300);
    expect(toAcc.balance).toBe(900);
    expect(await localDb.transaction.count()).toBe(2);
  });
});
