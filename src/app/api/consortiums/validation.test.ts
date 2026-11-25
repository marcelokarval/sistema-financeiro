/// <reference types="bun-types" />

import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

describe("POST, PUT e DELETE /api/consortiums - validação JSON, domínio e FKs", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let POST: typeof import("./route").POST;
  let PUT: typeof import("./route").PUT;
  let DELETE: typeof import("./route").DELETE;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "consortiums-val-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `CREATE TABLE "Account" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CASH', "balance" REAL NOT NULL DEFAULT 0, "color" TEXT NOT NULL DEFAULT '#6366f1', "icon" TEXT NOT NULL DEFAULT 'wallet', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "icon" TEXT NOT NULL DEFAULT 'tag', "type" TEXT NOT NULL DEFAULT 'EXPENSE', "color" TEXT NOT NULL DEFAULT '#6b7280', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Consortium" ("id" TEXT NOT NULL PRIMARY KEY, "description" TEXT NOT NULL, "group" TEXT NOT NULL DEFAULT '', "quota" TEXT NOT NULL DEFAULT '', "administrator" TEXT NOT NULL DEFAULT '', "totalAmount" REAL NOT NULL, "fundedAmount" REAL NOT NULL DEFAULT 0, "monthlyPayment" REAL NOT NULL, "installmentCount" INTEGER NOT NULL, "paidInstallments" INTEGER NOT NULL DEFAULT 0, "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "endDate" DATETIME, "nextAssemblyDate" DATETIME, "assembliesAttended" INTEGER NOT NULL DEFAULT 0, "status" TEXT NOT NULL DEFAULT 'ACTIVE', "categoryId" TEXT REFERENCES "Category"("id"), "accountId" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "ConsortiumInstallment" ("id" TEXT NOT NULL PRIMARY KEY, "number" INTEGER NOT NULL, "amount" REAL NOT NULL, "dueDate" DATETIME NOT NULL, "paidDate" DATETIME, "status" TEXT NOT NULL DEFAULT 'PENDING', "notes" TEXT NOT NULL DEFAULT '', "assemblyDate" DATETIME, "assemblyResult" TEXT NOT NULL DEFAULT '', "consortiumId" TEXT NOT NULL REFERENCES "Consortium"("id") ON DELETE CASCADE, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ];
    for (const sql of ddl) {
      await localDb.$executeRawUnsafe(sql);
    }

    mock.module("@/lib/db", () => ({ db: localDb }));
    ({ POST, PUT, DELETE } = await import("./route"));
  });

  beforeEach(async () => {
    await localDb.consortiumInstallment.deleteMany();
    await localDb.consortium.deleteMany();
    await localDb.account.deleteMany();
    await localDb.category.deleteMany();

    await localDb.account.create({
      data: { id: "acc-1", name: "Conta", balance: 1000 },
    });
    await localDb.category.create({
      data: { id: "cat-1", name: "Automóvel" },
    });
    await localDb.consortium.create({
      data: {
        id: "con-1",
        description: "Consórcio Carro",
        totalAmount: 30000,
        monthlyPayment: 500,
        installmentCount: 60,
        assembliesAttended: 2,
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
    ["PUT", "{malformed"],
    ["PUT", "[]"],
    ["DELETE", "{malformed"],
    ["DELETE", "123"],
  ] as const)("%s rejeita JSON inválido (%s) com HTTP 400", async (method, rawBody) => {
    const req = new NextRequest("http://localhost/api/consortiums", {
      method,
      body: rawBody,
    });
    const handler = method === "POST" ? POST : method === "PUT" ? PUT : DELETE;
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  test("POST rejeita dados inválidos e FKs inexistentes com HTTP 400", async () => {
    const base = {
      description: "Moto",
      totalAmount: 12000,
      monthlyPayment: 500,
      installmentCount: 24,
    };

    for (const payload of [
      { ...base, description: "   " },
      { ...base, totalAmount: 0 },
      { ...base, totalAmount: "NaN" },
      { ...base, monthlyPayment: -10 },
      { ...base, installmentCount: 0 },
      { ...base, installmentCount: 12.5 },
      { ...base, startDate: "2026-02-30" },
      { ...base, nextAssemblyDate: "invalida" },
      { ...base, categoryId: "cat-inexistente" },
      { ...base, accountId: "acc-inexistente" },
    ]) {
      const req = new NextRequest("http://localhost/api/consortiums", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    }

    expect(await localDb.consortium.count()).toBe(1);
  });

  test("PUT rejeita dados inválidos e FKs inexistentes com HTTP 400 sem alterar consórcio", async () => {
    for (const payload of [
      { id: "con-1", description: "   " },
      { id: "con-1", totalAmount: 0 },
      { id: "con-1", totalAmount: "NaN" },
      { id: "con-1", monthlyPayment: -100 },
      { id: "con-1", status: "INVALID_STATUS" },
      { id: "con-1", nextAssemblyDate: "2026-02-30" },
      { id: "con-1", assembliesAttended: -1 },
      { id: "con-1", assembliesAttended: 1.5 },
      { id: "con-1", categoryId: "cat-inexistente" },
      { id: "con-1", accountId: "acc-inexistente" },
    ]) {
      const req = new NextRequest("http://localhost/api/consortiums", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    }

    const stored = await localDb.consortium.findUniqueOrThrow({ where: { id: "con-1" } });
    expect(stored.description).toBe("Consórcio Carro");
    expect(stored.assembliesAttended).toBe(2);
  });

  test("PUT aceita atualização válida com assembliesAttended e FKs válidas", async () => {
    const req = new NextRequest("http://localhost/api/consortiums", {
      method: "PUT",
      body: JSON.stringify({
        id: "con-1",
        description: "Consórcio Atualizado",
        totalAmount: 36000,
        monthlyPayment: 600,
        assembliesAttended: 5,
        nextAssemblyDate: null,
        categoryId: "cat-1",
        accountId: "acc-1",
      }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.description).toBe("Consórcio Atualizado");
    expect(updated.assembliesAttended).toBe(5);
    expect(updated.nextAssemblyDate).toBeNull();
  });
});
