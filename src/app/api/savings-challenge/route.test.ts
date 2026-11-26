import { afterAll, beforeAll, beforeEach, describe, expect, mock, setSystemTime, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { formatServerCurrencyBRL } from "@/lib/server-i18n";

describe("GET /api/savings-challenge - i18n (pt/es/en) e BRL", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let GET: typeof import("./route").GET;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "savings-challenge-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `CREATE TABLE "Transaction" ("id" TEXT NOT NULL PRIMARY KEY, "type" TEXT NOT NULL, "amount" REAL NOT NULL, "description" TEXT NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "categoryId" TEXT, "accountId" TEXT, "cardId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Purchase" ("id" TEXT NOT NULL PRIMARY KEY, "merchant" TEXT NOT NULL, "totalAmount" REAL NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "installmentNumber" INTEGER NOT NULL DEFAULT 1, "installmentTotal" INTEGER NOT NULL DEFAULT 1, "cardId" TEXT, "accountId" TEXT, "categoryId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ];
    for (const sql of ddl) {
      await localDb.$executeRawUnsafe(sql);
    }

    mock.module("@/lib/db", () => ({ db: localDb }));
    ({ GET } = await import("./route"));
  });

  beforeEach(async () => {
    setSystemTime(new Date("2026-11-15T12:00:00Z"));
    await localDb.purchase.deleteMany();
    await localDb.transaction.deleteMany();
  });

  afterAll(async () => {
    setSystemTime();
    await localDb?.$disconnect();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test("GET() sem argumentos retorna desafios em pt com BRL contábil", async () => {
    await localDb.transaction.createMany({
      data: [
        { id: "inc-1", type: "INCOME", amount: 2000, description: "Salário", date: new Date(2026, 10, 5, 12, 0) },
        { id: "exp-1", type: "EXPENSE", amount: 600, description: "Mercado", date: new Date(2026, 10, 10, 12, 0) },
      ],
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.currentMonthSavings).toBe(1400);
    expect(data.challengeTargets).toHaveLength(3);
    expect(data.challengeTargets[0].id).toBe("daily-spend");
    expect(data.challengeTargets[0].title).toBe("Gastar menos hoje");
    expect(data.challengeTargets[0].description).toContain(formatServerCurrencyBRL(data.dailyTarget, "pt"));
    expect(data.challengeTargets[1].id).toBe("monthly-save");
    expect(data.challengeTargets[1].title).toBe(`Economizar ${formatServerCurrencyBRL(500, "pt")} este mês`);
    expect(data.challengeTargets[1].description).toContain(formatServerCurrencyBRL(1400, "pt"));
    expect(data.challengeTargets[2].id).toBe("savings-rate");
    expect(data.challengeTargets[2].title).toBe("Taxa de poupança acima de 20%");
    expect(data.challengeTargets[2].description).toContain("70.0%");
  });

  test("GET(req) localiza os 3 challengeTargets para en e es mantendo valores numéricos e BRL", async () => {
    await localDb.transaction.createMany({
      data: [
        { id: "inc-1", type: "INCOME", amount: 2000, description: "Salário", date: new Date(2026, 10, 5, 12, 0) },
        { id: "exp-1", type: "EXPENSE", amount: 600, description: "Mercado", date: new Date(2026, 10, 10, 12, 0) },
      ],
    });

    const resEn = await GET(new NextRequest("http://localhost/api/savings-challenge?locale=en"));
    expect(resEn.status).toBe(200);
    const dataEn = await resEn.json();
    expect(dataEn.currentMonthSavings).toBe(1400);
    expect(dataEn.challengeTargets[0].title).toBe("Spend less today");
    expect(dataEn.challengeTargets[0].description).toBe(
      `Stay below ${formatServerCurrencyBRL(dataEn.dailyTarget, "en")} today`
    );
    expect(dataEn.challengeTargets[1].title).toBe(`Save ${formatServerCurrencyBRL(500, "en")} this month`);
    expect(dataEn.challengeTargets[1].description).toBe(
      `Saved ${formatServerCurrencyBRL(1400, "en")} of ${formatServerCurrencyBRL(500, "en")} so far`
    );
    expect(dataEn.challengeTargets[2].title).toBe("Savings rate above 20%");
    expect(dataEn.challengeTargets[2].description).toBe("Current rate: 70.0% — keep up the pace!");

    const resEs = await GET(new NextRequest("http://localhost/api/savings-challenge?locale=es"));
    expect(resEs.status).toBe(200);
    const dataEs = await resEs.json();
    expect(dataEs.currentMonthSavings).toBe(1400);
    expect(dataEs.challengeTargets[0].title).toBe("Gastar menos hoy");
    expect(dataEs.challengeTargets[0].description).toBe(
      `Manténgase por debajo de ${formatServerCurrencyBRL(dataEs.dailyTarget, "es")} hoy`
    );
    expect(dataEs.challengeTargets[1].title).toBe(`Ahorrar ${formatServerCurrencyBRL(500, "es")} este mes`);
    expect(dataEs.challengeTargets[1].description).toBe(
      `Ya ahorró ${formatServerCurrencyBRL(1400, "es")} de ${formatServerCurrencyBRL(500, "es")}`
    );
    expect(dataEs.challengeTargets[2].title).toBe("Tasa de ahorro superior al 20%");
    expect(dataEs.challengeTargets[2].description).toBe("Tasa actual: 70.0% — ¡mantenga el ritmo!");
  });

  test("retorna erro 500 localizado com code e X-Error-Code em falha inesperada", async () => {
    const originalAggregate = localDb.transaction.aggregate;
    localDb.transaction.aggregate = (() => Promise.reject(new Error("db down"))) as typeof originalAggregate;
    try {
      const resEs = await GET(new NextRequest("http://localhost/api/savings-challenge?locale=es"));
      expect(resEs.status).toBe(500);
      expect(resEs.headers.get("X-Error-Code")).toBe("INTERNAL_ERROR");
      expect(await resEs.json()).toEqual({
        error: "Error al cargar los datos del desafío de ahorro.",
        code: "INTERNAL_ERROR",
      });
    } finally {
      localDb.transaction.aggregate = originalAggregate;
    }
  });
});
