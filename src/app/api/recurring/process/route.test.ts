import { afterAll, beforeAll, beforeEach, describe, expect, mock, setSystemTime, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

describe("POST /api/recurring/process - atomicidade e idempotência concorrente", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let POST: typeof import("./route").POST;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "recurring-process-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `CREATE TABLE "Account" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CASH', "balance" REAL NOT NULL DEFAULT 0, "color" TEXT NOT NULL DEFAULT '#6366f1', "icon" TEXT NOT NULL DEFAULT 'wallet', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Card" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CREDIT', "brand" TEXT NOT NULL DEFAULT 'VISA', "lastFourDigits" TEXT NOT NULL, "creditLimit" REAL NOT NULL DEFAULT 0, "currentBalance" REAL NOT NULL DEFAULT 0, "closingDay" INTEGER NOT NULL DEFAULT 1, "dueDay" INTEGER NOT NULL DEFAULT 10, "color" TEXT NOT NULL DEFAULT '#8b5cf6', "flag" TEXT NOT NULL DEFAULT '', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "icon" TEXT NOT NULL DEFAULT 'tag', "type" TEXT NOT NULL DEFAULT 'EXPENSE', "color" TEXT NOT NULL DEFAULT '#6b7280', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Transaction" ("id" TEXT NOT NULL PRIMARY KEY, "type" TEXT NOT NULL, "amount" REAL NOT NULL, "description" TEXT NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "categoryId" TEXT REFERENCES "Category"("id"), "accountId" TEXT REFERENCES "Account"("id"), "cardId" TEXT REFERENCES "Card"("id"), "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "RecurringTransaction" ("id" TEXT NOT NULL PRIMARY KEY, "description" TEXT NOT NULL, "amount" REAL NOT NULL, "type" TEXT NOT NULL, "frequency" TEXT NOT NULL, "nextDate" DATETIME NOT NULL, "categoryId" TEXT REFERENCES "Category"("id"), "accountId" TEXT REFERENCES "Account"("id"), "cardId" TEXT REFERENCES "Card"("id"), "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ];
    for (const sql of ddl) {
      await localDb.$executeRawUnsafe(sql);
    }

    mock.module("@/lib/db", () => ({ db: localDb }));
    ({ POST } = await import("./route"));
  });

  beforeEach(async () => {
    setSystemTime(new Date(2026, 10, 15, 12, 0, 0));
    await localDb.transaction.deleteMany();
    await localDb.recurringTransaction.deleteMany();
    await localDb.account.deleteMany();

    await localDb.account.create({
      data: { id: "acc-1", name: "Conta", balance: 1000 },
    });
  });

  afterAll(async () => {
    setSystemTime();
    await localDb?.$disconnect();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test("processa recorrências vencidas INCOME e EXPENSE e avança nextDate", async () => {
    const dueDate = new Date(2026, 10, 10, 12, 0, 0);
    await localDb.recurringTransaction.createMany({
      data: [
        {
          id: "rec-in",
          description: "Salário",
          amount: 2000,
          type: "INCOME",
          frequency: "MONTHLY",
          nextDate: dueDate,
          accountId: "acc-1",
          isActive: true,
        },
        {
          id: "rec-out",
          description: "Internet",
          amount: 150,
          type: "EXPENSE",
          frequency: "WEEKLY",
          nextDate: dueDate,
          accountId: "acc-1",
          isActive: true,
        },
      ],
    });

    const res = await POST();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.processed).toBe(2);

    const acc = await localDb.account.findUniqueOrThrow({ where: { id: "acc-1" } });
    expect(acc.balance).toBe(2850); // 1000 + 2000 - 150

    const recIn = await localDb.recurringTransaction.findUniqueOrThrow({ where: { id: "rec-in" } });
    const recOut = await localDb.recurringTransaction.findUniqueOrThrow({ where: { id: "rec-out" } });
    expect(recIn.nextDate.getMonth()).toBe(11);
    expect(recOut.nextDate.getDate()).toBe(17);
  });

  test("faz rollback completo quando atualização de conta falha durante processamento", async () => {
    const dueDate = new Date(2026, 10, 10, 12, 0, 0);
    await localDb.recurringTransaction.create({
      data: {
        id: "rec-fail",
        description: "Assinatura",
        amount: 100,
        type: "EXPENSE",
        frequency: "MONTHLY",
        nextDate: dueDate,
        accountId: "acc-1",
        isActive: true,
      },
    });

    await localDb.$executeRawUnsafe(
      `CREATE TRIGGER fail_rec_acc_update BEFORE UPDATE ON "Account" WHEN NEW.id = 'acc-1' BEGIN SELECT RAISE(ABORT, 'simulated failure'); END;`
    );
    try {
      const res = await POST();
      expect(res.status).toBe(500);

      expect(await localDb.transaction.count()).toBe(0);
      const rec = await localDb.recurringTransaction.findUniqueOrThrow({ where: { id: "rec-fail" } });
      expect(rec.nextDate.getTime()).toBe(dueDate.getTime());
      const acc = await localDb.account.findUniqueOrThrow({ where: { id: "acc-1" } });
      expect(acc.balance).toBe(1000);
    } finally {
      await localDb.$executeRawUnsafe(`DROP TRIGGER IF EXISTS fail_rec_acc_update;`);
    }
  });

  test("processa apenas uma vez em chamadas concorrentes (Promise.all)", async () => {
    const dueDate = new Date(2026, 10, 10, 12, 0, 0);
    await localDb.recurringTransaction.create({
      data: {
        id: "rec-conc",
        description: "Aluguel",
        amount: 400,
        type: "EXPENSE",
        frequency: "MONTHLY",
        nextDate: dueDate,
        accountId: "acc-1",
        isActive: true,
      },
    });

    const [res1, res2] = await Promise.all([POST(), POST()]);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    const d1 = await res1.json();
    const d2 = await res2.json();
    expect(d1.processed + d2.processed).toBe(1);

    expect(await localDb.transaction.count()).toBe(1);
    const acc = await localDb.account.findUniqueOrThrow({ where: { id: "acc-1" } });
    expect(acc.balance).toBe(600);
  });
});
