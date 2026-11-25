import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

describe("POST, PUT e DELETE /api/transactions - validação e reconciliação de saldo", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let GET: typeof import("./route").GET;
  let POST: typeof import("./route").POST;
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
    ({ GET, POST, PUT, DELETE } = await import("./route"));
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

  test("POST rejeita type inválido, amount <= 0, NaN, Infinity e date inválida com 400 sem persistir", async () => {
    for (const payload of [
      { type: "INVALID", amount: 50, description: "Teste" },
      { type: "EXPENSE", amount: 0, description: "Teste" },
      { type: "EXPENSE", amount: -10, description: "Teste" },
      { type: "EXPENSE", amount: "NaN", description: "Teste" },
      { type: "EXPENSE", amount: "Infinity", description: "Teste" },
      { type: "EXPENSE", amount: 50, description: "Teste", date: "data-invalida" },
    ]) {
      const req = new NextRequest("http://localhost/api/transactions", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    }

    expect(await localDb.transaction.count()).toBe(1);
    const acc = await localDb.account.findUniqueOrThrow({ where: { id: "acc-1" } });
    expect(acc.balance).toBe(900);
  });

  test("POST faz rollback completo sem deixar transação órfã se atualização de conta falhar ou accountId não existir", async () => {
    const missingAccReq = new NextRequest("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        type: "EXPENSE",
        amount: 100,
        description: "Conta inexistente",
        accountId: "acc-inexistente",
      }),
    });
    const missingRes = await POST(missingAccReq);
    expect([400, 404]).toContain(missingRes.status);
    expect(await localDb.transaction.count()).toBe(1);

    await localDb.$executeRawUnsafe(
      `CREATE TRIGGER fail_tx_acc_update BEFORE UPDATE ON "Account" WHEN NEW.id = 'acc-1' BEGIN SELECT RAISE(ABORT, 'simulated failure'); END;`
    );
    try {
      const failReq = new NextRequest("http://localhost/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          type: "INCOME",
          amount: 200,
          description: "Falha parcial",
          accountId: "acc-1",
        }),
      });
      const failRes = await POST(failReq);
      expect(failRes.status).toBe(500);
      expect(await localDb.transaction.count()).toBe(1);
      const acc = await localDb.account.findUniqueOrThrow({ where: { id: "acc-1" } });
      expect(acc.balance).toBe(900);
    } finally {
      await localDb.$executeRawUnsafe(`DROP TRIGGER IF EXISTS fail_tx_acc_update;`);
    }
  });

  test("GET interpreta from/to no fuso civil local sem truncar fim do dia e rejeita datas inválidas com 400", async () => {
    await localDb.transaction.createMany({
      data: [
        {
          id: "tx-before",
          type: "EXPENSE",
          amount: 10,
          description: "Antes do intervalo",
          date: new Date(2026, 9, 31, 23, 59, 59),
        },
        {
          id: "tx-end-day",
          type: "EXPENSE",
          amount: 25,
          description: "Noite do último dia",
          date: new Date(2026, 10, 25, 23, 30, 0),
        },
        {
          id: "tx-after",
          type: "EXPENSE",
          amount: 40,
          description: "Depois do intervalo",
          date: new Date(2026, 10, 26, 0, 0, 0),
        },
      ],
    });

    const res = await GET(new NextRequest("http://localhost/api/transactions?from=2026-11-01&to=2026-11-25"));
    expect(res.status).toBe(200);
    const items = (await res.json()) as Array<{ id: string }>;
    expect(items.map((i) => i.id)).toContain("tx-end-day");
    expect(items.map((i) => i.id)).not.toContain("tx-before");
    expect(items.map((i) => i.id)).not.toContain("tx-after");

    for (const badQuery of ["from=2026-02-30", "to=abc", "from=2026-11-01&to=2026-02-30"]) {
      const badRes = await GET(new NextRequest(`http://localhost/api/transactions?${badQuery}`));
      expect(badRes.status).toBe(400);
    }
  });

  test("POST e PUT retornam 400 para JSON malformado, data inválida (2026-02-30) e FK inexistente", async () => {
    const badJsonPost = new NextRequest("http://localhost/api/transactions", {
      method: "POST",
      body: "{invalid-json",
    });
    expect((await POST(badJsonPost)).status).toBe(400);

    const badJsonPut = new NextRequest("http://localhost/api/transactions", {
      method: "PUT",
      body: "{invalid-json",
    });
    expect((await PUT(badJsonPut)).status).toBe(400);

    const badDatePost = new NextRequest("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        type: "EXPENSE",
        amount: 50,
        description: "Data inexistente",
        date: "2026-02-30",
      }),
    });
    expect((await POST(badDatePost)).status).toBe(400);

    const badFkPost = new NextRequest("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        type: "EXPENSE",
        amount: 50,
        description: "Categoria inexistente",
        categoryId: "cat-inexistente",
      }),
    });
    expect((await POST(badFkPost)).status).toBe(400);

    const badFkPut = new NextRequest("http://localhost/api/transactions", {
      method: "PUT",
      body: JSON.stringify({
        id: "tx-1",
        categoryId: "cat-inexistente",
      }),
    });
    expect((await PUT(badFkPut)).status).toBe(400);

    const badAccPut = new NextRequest("http://localhost/api/transactions", {
      method: "PUT",
      body: JSON.stringify({
        id: "tx-1",
        accountId: "acc-inexistente",
      }),
    });
    expect((await PUT(badAccPut)).status).toBe(400);
  });
});
