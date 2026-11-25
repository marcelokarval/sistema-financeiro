import { afterAll, beforeAll, beforeEach, describe, expect, mock, setSystemTime, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

describe("GET /api/timeline - isolamento de TRANSFER", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let GET: typeof import("./route").GET;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "timeline-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "icon" TEXT NOT NULL DEFAULT 'tag', "type" TEXT NOT NULL DEFAULT 'EXPENSE', "color" TEXT NOT NULL DEFAULT '#6b7280', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Transaction" ("id" TEXT NOT NULL PRIMARY KEY, "type" TEXT NOT NULL, "amount" REAL NOT NULL, "description" TEXT NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "categoryId" TEXT REFERENCES "Category"("id"), "accountId" TEXT, "cardId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Purchase" ("id" TEXT NOT NULL PRIMARY KEY, "merchant" TEXT NOT NULL, "totalAmount" REAL NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "installmentNumber" INTEGER NOT NULL DEFAULT 1, "installmentTotal" INTEGER NOT NULL DEFAULT 1, "cardId" TEXT, "accountId" TEXT, "categoryId" TEXT REFERENCES "Category"("id"), "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ];
    for (const sql of ddl) {
      await localDb.$executeRawUnsafe(sql);
    }

    mock.module("@/lib/db", () => ({ db: localDb }));
    ({ GET } = await import("./route"));
  });

  beforeEach(async () => {
    setSystemTime(new Date(2026, 10, 15, 12, 0, 0));
    await localDb.purchase.deleteMany();
    await localDb.transaction.deleteMany();
  });

  afterAll(async () => {
    setSystemTime();
    await localDb?.$disconnect();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test("exclui transações TRANSFER dos itens, despesas e saldo acumulado", async () => {
    await localDb.transaction.createMany({
      data: [
        { id: "tx-in", type: "INCOME", amount: 1000, description: "Receita", date: new Date(2026, 10, 15, 10, 0) },
        { id: "tx-out", type: "EXPENSE", amount: 300, description: "Despesa", date: new Date(2026, 10, 15, 11, 0) },
        { id: "tx-tr", type: "TRANSFER", amount: 500, description: "Transferência interna", date: new Date(2026, 10, 15, 11, 30) },
      ],
    });

    const req = new NextRequest("http://localhost/api/timeline?days=7");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const days = await res.json();
    const todayEntry = days[0];

    expect(todayEntry.income).toBe(1000);
    expect(todayEntry.expense).toBe(300);
    expect(todayEntry.net).toBe(700);
    expect(todayEntry.runningBalance).toBe(700);
    expect(todayEntry.items.some((i: { description: string }) => i.description === "Transferência interna")).toBe(false);
  });

  test("agrupa transação e compra às 22:30 local na chave civil local YYYY-MM-DD", async () => {
    setSystemTime(new Date(2026, 10, 25, 12, 0, 0));

    await localDb.transaction.create({
      data: {
        id: "tx-late",
        type: "INCOME",
        amount: 500,
        description: "Pix noturno",
        date: new Date(2026, 10, 25, 22, 30, 0),
      },
    });
    await localDb.purchase.create({
      data: {
        id: "pur-late",
        merchant: "Farmácia 24h",
        totalAmount: 120,
        date: new Date(2026, 10, 25, 22, 45, 0),
      },
    });

    const req = new NextRequest("http://localhost/api/timeline?days=7");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const days = await res.json();
    const day25 = days.find((d: { date: string }) => d.date === "2026-11-25");

    expect(day25).toBeDefined();
    expect(day25.income).toBe(500);
    expect(day25.expense).toBe(120);
    expect(day25.count).toBe(2);
    expect(days.some((d: { date: string }) => d.date === "2026-11-26")).toBe(false);
  });
});
