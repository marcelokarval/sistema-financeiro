import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

describe("POST /api/consortiums/installments - pagamento atômico e TOCTOU", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let POST: typeof import("./route").POST;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "consortium-inst-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "icon" TEXT NOT NULL DEFAULT 'tag', "type" TEXT NOT NULL DEFAULT 'EXPENSE', "color" TEXT NOT NULL DEFAULT '#6b7280', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Consortium" ("id" TEXT NOT NULL PRIMARY KEY, "description" TEXT NOT NULL, "group" TEXT NOT NULL DEFAULT '', "quota" TEXT NOT NULL DEFAULT '', "administrator" TEXT NOT NULL DEFAULT '', "totalAmount" REAL NOT NULL, "fundedAmount" REAL NOT NULL DEFAULT 0, "monthlyPayment" REAL NOT NULL, "installmentCount" INTEGER NOT NULL, "paidInstallments" INTEGER NOT NULL DEFAULT 0, "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "endDate" DATETIME, "nextAssemblyDate" DATETIME, "assembliesAttended" INTEGER NOT NULL DEFAULT 0, "status" TEXT NOT NULL DEFAULT 'ACTIVE', "categoryId" TEXT REFERENCES "Category"("id"), "accountId" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "ConsortiumInstallment" ("id" TEXT NOT NULL PRIMARY KEY, "number" INTEGER NOT NULL, "amount" REAL NOT NULL, "dueDate" DATETIME NOT NULL, "paidDate" DATETIME, "status" TEXT NOT NULL DEFAULT 'PENDING', "notes" TEXT NOT NULL DEFAULT '', "assemblyDate" DATETIME, "assemblyResult" TEXT NOT NULL DEFAULT '', "consortiumId" TEXT NOT NULL REFERENCES "Consortium"("id") ON DELETE CASCADE, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ];
    for (const sql of ddl) {
      await localDb.$executeRawUnsafe(sql);
    }

    mock.module("@/lib/db", () => ({ db: localDb }));
    ({ POST } = await import("./route"));
  });

  beforeEach(async () => {
    await localDb.consortiumInstallment.deleteMany();
    await localDb.consortium.deleteMany();
    await localDb.consortium.create({
      data: {
        id: "cons-1",
        description: "Consórcio Carro",
        totalAmount: 1000,
        fundedAmount: 500,
        monthlyPayment: 500,
        installmentCount: 2,
        paidInstallments: 1,
        status: "ACTIVE",
      },
    });
    await localDb.consortiumInstallment.createMany({
      data: [
        {
          id: "cinst-1",
          consortiumId: "cons-1",
          number: 1,
          amount: 500,
          dueDate: new Date(2026, 9, 10),
          paidDate: new Date(2026, 9, 10),
          status: "PAID",
        },
        {
          id: "cinst-2",
          consortiumId: "cons-1",
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

  test("paga última parcela pendente, incrementa contadores e conclui consórcio", async () => {
    const req = new NextRequest("http://localhost/api/consortiums/installments", {
      method: "POST",
      body: JSON.stringify({ installmentId: "cinst-2" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.installment.status).toBe("PAID");
    expect(data.consortium.paidInstallments).toBe(2);
    expect(data.consortium.fundedAmount).toBe(1000);
    expect(data.consortium.status).toBe("COMPLETED");
  });

  test("rejeita com 400 parcela já paga sem incrementar consórcio", async () => {
    const req = new NextRequest("http://localhost/api/consortiums/installments", {
      method: "POST",
      body: JSON.stringify({ installmentId: "cinst-1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);

    const cons = await localDb.consortium.findUniqueOrThrow({ where: { id: "cons-1" } });
    expect(cons.paidInstallments).toBe(1);
    expect(cons.fundedAmount).toBe(500);
  });

  test("faz rollback da parcela se atualização do consórcio falhar", async () => {
    await localDb.$executeRawUnsafe(
      `CREATE TRIGGER fail_consortium_update BEFORE UPDATE ON "Consortium" WHEN NEW.id = 'cons-1' BEGIN SELECT RAISE(ABORT, 'simulated failure'); END;`
    );
    try {
      const req = new NextRequest("http://localhost/api/consortiums/installments", {
        method: "POST",
        body: JSON.stringify({ installmentId: "cinst-2" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(500);

      const inst = await localDb.consortiumInstallment.findUniqueOrThrow({ where: { id: "cinst-2" } });
      expect(inst.status).toBe("PENDING");
      const cons = await localDb.consortium.findUniqueOrThrow({ where: { id: "cons-1" } });
      expect(cons.paidInstallments).toBe(1);
    } finally {
      await localDb.$executeRawUnsafe(`DROP TRIGGER IF EXISTS fail_consortium_update;`);
    }
  });

  test("permite apenas um pagamento em chamadas concorrentes da mesma parcela (TOCTOU)", async () => {
    const req1 = new NextRequest("http://localhost/api/consortiums/installments", {
      method: "POST",
      body: JSON.stringify({ installmentId: "cinst-2" }),
    });
    const req2 = new NextRequest("http://localhost/api/consortiums/installments", {
      method: "POST",
      body: JSON.stringify({ installmentId: "cinst-2" }),
    });

    const [res1, res2] = await Promise.all([POST(req1), POST(req2)]);
    expect([res1.status, res2.status].sort()).toEqual([200, 400]);

    const cons = await localDb.consortium.findUniqueOrThrow({ where: { id: "cons-1" } });
    expect(cons.paidInstallments).toBe(2);
    expect(cons.fundedAmount).toBe(1000);
  });
});
