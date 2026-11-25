import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

describe("POST, PUT e DELETE /api/savings - validação JSON, FK e preservação de nulos", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let POST: typeof import("./route").POST;
  let PUT: typeof import("./route").PUT;
  let DELETE: typeof import("./route").DELETE;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "savings-val-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `CREATE TABLE "Account" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CASH', "balance" REAL NOT NULL DEFAULT 0, "color" TEXT NOT NULL DEFAULT '#6366f1', "icon" TEXT NOT NULL DEFAULT 'wallet', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "SavingsGoal" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '', "type" TEXT NOT NULL DEFAULT 'SAVINGS', "targetAmount" REAL NOT NULL, "currentAmount" REAL NOT NULL DEFAULT 0, "monthlyContribution" REAL NOT NULL DEFAULT 0, "yieldRate" REAL NOT NULL DEFAULT 0, "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "targetDate" DATETIME, "accountId" TEXT REFERENCES "Account"("id") ON DELETE SET NULL, "isCompleted" BOOLEAN NOT NULL DEFAULT false, "color" TEXT NOT NULL DEFAULT '#22c55e', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ];
    for (const sql of ddl) {
      await localDb.$executeRawUnsafe(sql);
    }

    mock.module("@/lib/db", () => ({ db: localDb }));
    ({ POST, PUT, DELETE } = await import("./route"));
  });

  beforeEach(async () => {
    await localDb.savingsGoal.deleteMany();
    await localDb.account.deleteMany();
    await localDb.account.create({
      data: { id: "acc-1", name: "Conta Poupança" },
    });
    await localDb.savingsGoal.create({
      data: {
        id: "sg-1",
        name: "Viagem",
        description: "Descrição anterior",
        type: "PIGGY_BANK",
        targetAmount: 5000,
        currentAmount: 500,
        monthlyContribution: 200,
        yieldRate: 10,
        accountId: "acc-1",
      },
    });
  });

  afterAll(async () => {
    await localDb?.$disconnect();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test("POST, PUT e DELETE retornam HTTP 400 para JSON malformado", async () => {
    for (const raw of ["{invalido", "", "[]"]) {
      expect((await POST(new NextRequest("http://localhost/api/savings", { method: "POST", body: raw }))).status).toBe(400);
      expect((await PUT(new NextRequest("http://localhost/api/savings", { method: "PUT", body: raw }))).status).toBe(400);
      expect((await DELETE(new NextRequest("http://localhost/api/savings", { method: "DELETE", body: raw }))).status).toBe(400);
    }
  });

  test("POST e PUT rejeitam nome vazio, valores numéricos inválidos, enum inválido, data inválida e accountId inexistente com HTTP 400", async () => {
    for (const payload of [
      { name: "   ", targetAmount: 1000 },
      { name: "Meta", targetAmount: 0 },
      { name: "Meta", targetAmount: -10 },
      { name: "Meta", targetAmount: "NaN" },
      { name: "Meta", targetAmount: 1000, currentAmount: "Infinity" },
      { name: "Meta", targetAmount: 1000, type: "INVALIDO" },
      { name: "Meta", targetAmount: 1000, targetDate: "2026-02-30" },
      { name: "Meta", targetAmount: 1000, accountId: "acc-inexistente" },
    ]) {
      const res = await POST(
        new NextRequest("http://localhost/api/savings", { method: "POST", body: JSON.stringify(payload) })
      );
      expect(res.status).toBe(400);
    }

    for (const payload of [
      { id: "sg-1", name: "   " },
      { id: "sg-1", targetAmount: -10 },
      { id: "sg-1", targetAmount: "NaN" },
      { id: "sg-1", currentAmount: -1 },
      { id: "sg-1", monthlyContribution: "Infinity" },
      { id: "sg-1", yieldRate: "abc" },
      { id: "sg-1", type: "INVALIDO" },
      { id: "sg-1", targetDate: "data-invalida" },
      { id: "sg-1", accountId: "acc-inexistente" },
    ]) {
      const res = await PUT(
        new NextRequest("http://localhost/api/savings", { method: "PUT", body: JSON.stringify(payload) })
      );
      expect(res.status).toBe(400);
    }

    const goal = await localDb.savingsGoal.findUniqueOrThrow({ where: { id: "sg-1" } });
    expect(goal.targetAmount).toBe(5000);
    expect(goal.description).toBe("Descrição anterior");
  });

  test("PUT preserva explicitamente description: null, monthlyContribution: null e yieldRate: null retornando HTTP 200 com defaults", async () => {
    const res = await PUT(
      new NextRequest("http://localhost/api/savings", {
        method: "PUT",
        body: JSON.stringify({
          id: "sg-1",
          description: null,
          monthlyContribution: null,
          yieldRate: null,
          targetDate: null,
        }),
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      description: string;
      monthlyContribution: number;
      yieldRate: number;
      targetDate: null;
    };
    expect(body.description).toBe("");
    expect(body.monthlyContribution).toBe(0);
    expect(body.yieldRate).toBe(0);
    expect(body.targetDate).toBeNull();
  });
});
