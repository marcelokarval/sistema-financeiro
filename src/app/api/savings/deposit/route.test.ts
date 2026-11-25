import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

describe("POST /api/savings/deposit - validação e atomicidade", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let POST: typeof import("./route").POST;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "savings-deposit-test-"));
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
    ({ POST } = await import("./route"));
  });

  beforeEach(async () => {
    await localDb.savingsGoal.deleteMany();
    await localDb.account.deleteMany();
    await localDb.account.create({
      data: { id: "acc-1", name: "Conta Reserva", color: "#6366f1", icon: "wallet" },
    });
    await localDb.savingsGoal.create({
      data: {
        id: "goal-1",
        name: "Reserva",
        type: "PIGGY_BANK",
        targetAmount: 200,
        currentAmount: 10,
        accountId: "acc-1",
      },
    });
  });

  afterAll(async () => {
    await localDb?.$disconnect();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test("rejeita JSON malformado ou não-objeto com HTTP 400", async () => {
    for (const rawBody of ["{invalido", "", "null", "[]", '"texto"']) {
      const req = new NextRequest("http://localhost/api/savings/deposit", {
        method: "POST",
        body: rawBody,
        headers: { "content-type": "application/json" },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    }

    const goal = await localDb.savingsGoal.findUniqueOrThrow({ where: { id: "goal-1" } });
    expect(goal.currentAmount).toBe(10);
  });

  test("rejeita amount inválido (NaN, Infinity, <= 0, texto, booleano) com HTTP 400", async () => {
    for (const amount of [0, -25, "NaN", "Infinity", "abc", "", true, null, undefined]) {
      const req = new NextRequest("http://localhost/api/savings/deposit", {
        method: "POST",
        body: JSON.stringify({ savingsGoalId: "goal-1", amount }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    }

    const goal = await localDb.savingsGoal.findUniqueOrThrow({ where: { id: "goal-1" } });
    expect(goal.currentAmount).toBe(10);
  });

  test("retorna 404 para meta inexistente", async () => {
    const req = new NextRequest("http://localhost/api/savings/deposit", {
      method: "POST",
      body: JSON.stringify({ savingsGoalId: "goal-inexistente", amount: 50 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  test("aplica depósitos concorrentes atomicamente sem lost update e marca isCompleted ao atingir targetAmount", async () => {
    await localDb.savingsGoal.update({
      where: { id: "goal-1" },
      data: { targetAmount: 110, currentAmount: 10 },
    });

    const [resA, resB] = await Promise.all([
      POST(
        new NextRequest("http://localhost/api/savings/deposit", {
          method: "POST",
          body: JSON.stringify({ savingsGoalId: "goal-1", amount: 50, description: "Aporte A" }),
        })
      ),
      POST(
        new NextRequest("http://localhost/api/savings/deposit", {
          method: "POST",
          body: JSON.stringify({ savingsGoalId: "goal-1", amount: 50 }),
        })
      ),
    ]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    const bodyA = (await resA.json()) as {
      depositAmount: number;
      depositDescription: string;
      goalCompleted: boolean;
      account: { id: string; name: string } | null;
    };
    const bodyB = (await resB.json()) as {
      depositAmount: number;
      depositDescription: string;
      goalCompleted: boolean;
      account: { id: string; name: string } | null;
    };

    expect(bodyA.depositAmount).toBe(50);
    expect(bodyA.depositDescription).toBe("Aporte A");
    expect(bodyA.account).toMatchObject({ id: "acc-1", name: "Conta Reserva" });
    expect(bodyB.depositAmount).toBe(50);
    expect(bodyB.depositDescription).toBe("Depósito");
    expect(bodyA.goalCompleted || bodyB.goalCompleted).toBe(true);

    const finalGoal = await localDb.savingsGoal.findUniqueOrThrow({ where: { id: "goal-1" } });
    expect(finalGoal.currentAmount).toBe(110);
    expect(finalGoal.isCompleted).toBe(true);
  });
});
