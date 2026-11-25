import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

describe("POST, PUT e DELETE /api/investments - validação JSON, FK e domínio", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let POST: typeof import("./route").POST;
  let PUT: typeof import("./route").PUT;
  let DELETE: typeof import("./route").DELETE;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "investments-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `CREATE TABLE "Account" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CASH', "balance" REAL NOT NULL DEFAULT 0, "color" TEXT NOT NULL DEFAULT '#6366f1', "icon" TEXT NOT NULL DEFAULT 'wallet', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "icon" TEXT NOT NULL DEFAULT 'tag', "type" TEXT NOT NULL DEFAULT 'EXPENSE', "color" TEXT NOT NULL DEFAULT '#6b7280', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Investment" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'STOCK', "description" TEXT NOT NULL DEFAULT '', "currentBalance" REAL NOT NULL DEFAULT 0, "investedAmount" REAL NOT NULL DEFAULT 0, "yieldRate" REAL NOT NULL DEFAULT 0, "brokerage" TEXT NOT NULL DEFAULT '', "ticker" TEXT NOT NULL DEFAULT '', "accountId" TEXT REFERENCES "Account"("id") ON DELETE SET NULL, "categoryId" TEXT REFERENCES "Category"("id") ON DELETE SET NULL, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ];
    for (const sql of ddl) {
      await localDb.$executeRawUnsafe(sql);
    }

    mock.module("@/lib/db", () => ({ db: localDb }));
    ({ POST, PUT, DELETE } = await import("./route"));
  });

  beforeEach(async () => {
    await localDb.investment.deleteMany();
    await localDb.account.deleteMany();
    await localDb.category.deleteMany();
    await localDb.account.create({ data: { id: "acc-1", name: "Corretora" } });
    await localDb.category.create({ data: { id: "cat-1", name: "Renda Variável" } });
    await localDb.investment.create({
      data: {
        id: "inv-1",
        name: "PETR4",
        type: "STOCK",
        investedAmount: 1000,
        currentBalance: 1100,
        accountId: "acc-1",
        categoryId: "cat-1",
      },
    });
  });

  afterAll(async () => {
    await localDb?.$disconnect();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test("POST, PUT e DELETE retornam HTTP 400 para JSON malformado", async () => {
    for (const raw of ["{invalido", "", "[]"]) {
      expect((await POST(new NextRequest("http://localhost/api/investments", { method: "POST", body: raw }))).status).toBe(400);
      expect((await PUT(new NextRequest("http://localhost/api/investments", { method: "PUT", body: raw }))).status).toBe(400);
      expect((await DELETE(new NextRequest("http://localhost/api/investments", { method: "DELETE", body: raw }))).status).toBe(400);
    }
  });

  test("POST e PUT rejeitam nome/tipo vazios ou inválidos, números inválidos e FKs inexistentes com HTTP 400", async () => {
    for (const payload of [
      { name: "   ", type: "STOCK" },
      { name: "Ativo", type: "   " },
      { name: "Ativo", type: "INVALIDO" },
      { name: "Ativo", type: "STOCK", investedAmount: "NaN" },
      { name: "Ativo", type: "STOCK", currentBalance: -10 },
      { name: "Ativo", type: "STOCK", yieldRate: "Infinity" },
      { name: "Ativo", type: "STOCK", accountId: "acc-inexistente" },
      { name: "Ativo", type: "STOCK", categoryId: "cat-inexistente" },
    ]) {
      const res = await POST(
        new NextRequest("http://localhost/api/investments", { method: "POST", body: JSON.stringify(payload) })
      );
      expect(res.status).toBe(400);
    }

    for (const payload of [
      { id: "inv-1", name: "   " },
      { id: "inv-1", type: "   " },
      { id: "inv-1", type: "INVALIDO" },
      { id: "inv-1", investedAmount: -5 },
      { id: "inv-1", currentBalance: "NaN" },
      { id: "inv-1", yieldRate: "Infinity" },
      { id: "inv-1", accountId: "acc-inexistente" },
      { id: "inv-1", categoryId: "cat-inexistente" },
    ]) {
      const res = await PUT(
        new NextRequest("http://localhost/api/investments", { method: "PUT", body: JSON.stringify(payload) })
      );
      expect(res.status).toBe(400);
    }

    const inv = await localDb.investment.findUniqueOrThrow({ where: { id: "inv-1" } });
    expect(inv.name).toBe("PETR4");
    expect(inv.investedAmount).toBe(1000);
  });

  test("PUT atualiza investimento válido e retorna 404 para investimento inexistente", async () => {
    const missing = await PUT(
      new NextRequest("http://localhost/api/investments", {
        method: "PUT",
        body: JSON.stringify({ id: "inv-missing", name: "Outro" }),
      })
    );
    expect(missing.status).toBe(404);

    const ok = await PUT(
      new NextRequest("http://localhost/api/investments", {
        method: "PUT",
        body: JSON.stringify({
          id: "inv-1",
          name: "  Tesouro Selic  ",
          type: "TESOURO",
          investedAmount: 2000,
          currentBalance: 2050,
          accountId: "",
          categoryId: null,
        }),
      })
    );
    expect(ok.status).toBe(200);
    const updated = await localDb.investment.findUniqueOrThrow({ where: { id: "inv-1" } });
    expect(updated.name).toBe("Tesouro Selic");
    expect(updated.type).toBe("TESOURO");
    expect(updated.accountId).toBeNull();
    expect(updated.categoryId).toBeNull();
  });
});
