import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

describe("POST, PUT e DELETE /api/budgets - validação JSON, FK e domínio", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let POST: typeof import("./route").POST;
  let PUT: typeof import("./route").PUT;
  let DELETE: typeof import("./route").DELETE;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "budgets-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "icon" TEXT NOT NULL DEFAULT 'tag', "type" TEXT NOT NULL DEFAULT 'EXPENSE', "color" TEXT NOT NULL DEFAULT '#6b7280', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "BudgetGoal" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '', "targetAmount" REAL NOT NULL, "currentAmount" REAL NOT NULL DEFAULT 0, "categoryId" TEXT REFERENCES "Category"("id") ON DELETE SET NULL, "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "endDate" DATETIME, "isCompleted" BOOLEAN NOT NULL DEFAULT false, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ];
    for (const sql of ddl) {
      await localDb.$executeRawUnsafe(sql);
    }

    mock.module("@/lib/db", () => ({ db: localDb }));
    ({ POST, PUT, DELETE } = await import("./route"));
  });

  beforeEach(async () => {
    await localDb.budgetGoal.deleteMany();
    await localDb.category.deleteMany();
    await localDb.category.create({
      data: { id: "cat-1", name: "Lazer" },
    });
    await localDb.budgetGoal.create({
      data: {
        id: "bg-1",
        name: "Teto Lazer",
        targetAmount: 1000,
        currentAmount: 100,
        categoryId: "cat-1",
      },
    });
  });

  afterAll(async () => {
    await localDb?.$disconnect();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test("POST, PUT e DELETE retornam HTTP 400 para JSON malformado", async () => {
    for (const raw of ["{invalido", "", "null"]) {
      expect((await POST(new NextRequest("http://localhost/api/budgets", { method: "POST", body: raw }))).status).toBe(400);
      expect((await PUT(new NextRequest("http://localhost/api/budgets", { method: "PUT", body: raw }))).status).toBe(400);
      expect((await DELETE(new NextRequest("http://localhost/api/budgets", { method: "DELETE", body: raw }))).status).toBe(400);
    }
  });

  test("POST e PUT rejeitam nome vazio, valores inválidos, datas inválidas e FK inexistente com HTTP 400", async () => {
    for (const payload of [
      { name: "   ", targetAmount: 500 },
      { name: "Meta", targetAmount: 0 },
      { name: "Meta", targetAmount: -10 },
      { name: "Meta", targetAmount: "NaN" },
      { name: "Meta", targetAmount: 500, currentAmount: "Infinity" },
      { name: "Meta", targetAmount: 500, endDate: "2026-02-30" },
      { name: "Meta", targetAmount: 500, categoryId: "cat-inexistente" },
    ]) {
      const res = await POST(
        new NextRequest("http://localhost/api/budgets", { method: "POST", body: JSON.stringify(payload) })
      );
      expect(res.status).toBe(400);
    }

    for (const payload of [
      { id: "bg-1", name: "   " },
      { id: "bg-1", targetAmount: 0 },
      { id: "bg-1", targetAmount: -5 },
      { id: "bg-1", targetAmount: "NaN" },
      { id: "bg-1", currentAmount: -1 },
      { id: "bg-1", startDate: "data-invalida" },
      { id: "bg-1", endDate: "2026-02-30" },
      { id: "bg-1", categoryId: "cat-inexistente" },
    ]) {
      const res = await PUT(
        new NextRequest("http://localhost/api/budgets", { method: "PUT", body: JSON.stringify(payload) })
      );
      expect(res.status).toBe(400);
    }

    const goal = await localDb.budgetGoal.findUniqueOrThrow({ where: { id: "bg-1" } });
    expect(goal.name).toBe("Teto Lazer");
    expect(goal.targetAmount).toBe(1000);
  });

  test("PUT atualiza meta válida e retorna 404 para meta inexistente", async () => {
    const missing = await PUT(
      new NextRequest("http://localhost/api/budgets", {
        method: "PUT",
        body: JSON.stringify({ id: "bg-missing", name: "Outra" }),
      })
    );
    expect(missing.status).toBe(404);

    const ok = await PUT(
      new NextRequest("http://localhost/api/budgets", {
        method: "PUT",
        body: JSON.stringify({
          id: "bg-1",
          name: "  Novo Teto  ",
          targetAmount: 1500,
          categoryId: null,
          endDate: null,
        }),
      })
    );
    expect(ok.status).toBe(200);
    const updated = await localDb.budgetGoal.findUniqueOrThrow({ where: { id: "bg-1" } });
    expect(updated.name).toBe("Novo Teto");
    expect(updated.targetAmount).toBe(1500);
    expect(updated.categoryId).toBeNull();
  });
});
