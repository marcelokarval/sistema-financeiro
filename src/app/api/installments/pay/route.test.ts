import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

describe("POST /api/installments/pay - guarda TOCTOU e incremento atômico", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let POST: typeof import("./route").POST;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "installments-pay-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `CREATE TABLE "InstallmentPlan" ("id" TEXT NOT NULL PRIMARY KEY, "description" TEXT NOT NULL, "totalAmount" REAL NOT NULL, "installmentCount" INTEGER NOT NULL, "paidInstallments" INTEGER NOT NULL DEFAULT 0, "monthlyValue" REAL NOT NULL, "interestRate" REAL NOT NULL DEFAULT 0, "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "nextPaymentDate" DATETIME, "type" TEXT NOT NULL DEFAULT 'FINANCING', "status" TEXT NOT NULL DEFAULT 'ACTIVE', "cardId" TEXT, "accountId" TEXT, "categoryId" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Installment" ("id" TEXT NOT NULL PRIMARY KEY, "number" INTEGER NOT NULL, "amount" REAL NOT NULL, "dueDate" DATETIME NOT NULL, "paidDate" DATETIME, "status" TEXT NOT NULL DEFAULT 'PENDING', "notes" TEXT NOT NULL DEFAULT '', "installmentPlanId" TEXT NOT NULL REFERENCES "InstallmentPlan"("id") ON DELETE CASCADE, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ];
    for (const sql of ddl) {
      await localDb.$executeRawUnsafe(sql);
    }

    mock.module("@/lib/db", () => ({ db: localDb }));
    ({ POST } = await import("./route"));
  });

  beforeEach(async () => {
    await localDb.installment.deleteMany();
    await localDb.installmentPlan.deleteMany();

    await localDb.installmentPlan.create({
      data: {
        id: "plan-1",
        description: "Notebook",
        totalAmount: 1000,
        installmentCount: 2,
        paidInstallments: 1,
        monthlyValue: 500,
        status: "ACTIVE",
      },
    });
    await localDb.installment.createMany({
      data: [
        {
          id: "inst-1",
          installmentPlanId: "plan-1",
          number: 1,
          amount: 500,
          dueDate: new Date(2026, 9, 10),
          paidDate: new Date(2026, 9, 10),
          status: "PAID",
        },
        {
          id: "inst-2",
          installmentPlanId: "plan-1",
          number: 2,
          amount: 500,
          dueDate: new Date(2026, 10, 10),
          status: "PENDING",
        },
      ],
    });
  });

  afterAll(async () => {
    await localDb?.$disconnect();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test("retorna 404 para parcela inexistente", async () => {
    const req = new NextRequest("http://localhost/api/installments/pay", {
      method: "POST",
      body: JSON.stringify({ installmentId: "inexistente" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  test("retorna 400 para parcela já paga ou plano concluído", async () => {
    const paidReq = new NextRequest("http://localhost/api/installments/pay", {
      method: "POST",
      body: JSON.stringify({ installmentId: "inst-1" }),
    });
    expect((await POST(paidReq)).status).toBe(400);

    await localDb.installmentPlan.update({
      where: { id: "plan-1" },
      data: { status: "COMPLETED" },
    });
    const completedReq = new NextRequest("http://localhost/api/installments/pay", {
      method: "POST",
      body: JSON.stringify({ installmentId: "inst-2" }),
    });
    expect((await POST(completedReq)).status).toBe(400);
  });

  test("marca parcela como paga, incrementa paidInstallments e conclui plano na última parcela", async () => {
    const req = new NextRequest("http://localhost/api/installments/pay", {
      method: "POST",
      body: JSON.stringify({ installmentId: "inst-2" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.installment.status).toBe("PAID");
    expect(data.plan.paidInstallments).toBe(2);
    expect(data.plan.status).toBe("COMPLETED");
  });

  test("garante incremento único em pagamento concorrente da mesma parcela (TOCTOU)", async () => {
    const req1 = new NextRequest("http://localhost/api/installments/pay", {
      method: "POST",
      body: JSON.stringify({ installmentId: "inst-2" }),
    });
    const req2 = new NextRequest("http://localhost/api/installments/pay", {
      method: "POST",
      body: JSON.stringify({ installmentId: "inst-2" }),
    });

    const [res1, res2] = await Promise.all([POST(req1), POST(req2)]);
    expect([res1.status, res2.status].sort()).toEqual([200, 400]);

    const plan = await localDb.installmentPlan.findUniqueOrThrow({ where: { id: "plan-1" } });
    expect(plan.paidInstallments).toBe(2);
    expect(plan.status).toBe("COMPLETED");
  });
});
