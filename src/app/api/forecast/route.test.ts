import { afterAll, beforeAll, beforeEach, describe, expect, mock, setSystemTime, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

describe("GET /api/forecast - normalização mensal de recorrências", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let GET: typeof import("./route").GET;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "forecast-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "icon" TEXT NOT NULL DEFAULT 'tag', "type" TEXT NOT NULL DEFAULT 'EXPENSE', "color" TEXT NOT NULL DEFAULT '#6b7280', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Transaction" ("id" TEXT NOT NULL PRIMARY KEY, "type" TEXT NOT NULL, "amount" REAL NOT NULL, "description" TEXT NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "categoryId" TEXT REFERENCES "Category"("id"), "accountId" TEXT, "cardId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Purchase" ("id" TEXT NOT NULL PRIMARY KEY, "merchant" TEXT NOT NULL, "totalAmount" REAL NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "installmentNumber" INTEGER NOT NULL DEFAULT 1, "installmentTotal" INTEGER NOT NULL DEFAULT 1, "cardId" TEXT, "accountId" TEXT, "categoryId" TEXT REFERENCES "Category"("id"), "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "RecurringTransaction" ("id" TEXT NOT NULL PRIMARY KEY, "description" TEXT NOT NULL, "amount" REAL NOT NULL, "type" TEXT NOT NULL, "frequency" TEXT NOT NULL, "nextDate" DATETIME NOT NULL, "categoryId" TEXT REFERENCES "Category"("id"), "accountId" TEXT, "cardId" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ];
    for (const sql of ddl) {
      await localDb.$executeRawUnsafe(sql);
    }

    mock.module("@/lib/db", () => ({ db: localDb }));
    ({ GET } = await import("./route"));
  });

  beforeEach(async () => {
    setSystemTime(new Date("2026-11-15T12:00:00Z"));
    await localDb.recurringTransaction.deleteMany();
    await localDb.purchase.deleteMany();
    await localDb.transaction.deleteMany();
    await localDb.category.deleteMany();
  });

  afterAll(async () => {
    setSystemTime();
    await localDb?.$disconnect();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test("normaliza recorrências WEEKLY, BIWEEKLY, QUARTERLY e YEARLY para base mensal", async () => {
    await localDb.recurringTransaction.createMany({
      data: [
        {
          id: "rec-weekly",
          description: "Freela semanal",
          amount: 100,
          type: "INCOME",
          frequency: "WEEKLY",
          nextDate: new Date("2026-11-20T12:00:00Z"),
        },
        {
          id: "rec-yearly",
          description: "Bônus anual",
          amount: 1200,
          type: "INCOME",
          frequency: "YEARLY",
          nextDate: new Date("2026-12-20T12:00:00Z"),
        },
        {
          id: "rec-biweekly",
          description: "Mercado quinzenal",
          amount: 260,
          type: "EXPENSE",
          frequency: "BIWEEKLY",
          nextDate: new Date("2026-11-25T12:00:00Z"),
        },
        {
          id: "rec-quarterly",
          description: "Seguro trimestral",
          amount: 300,
          type: "EXPENSE",
          frequency: "QUARTERLY",
          nextDate: new Date("2026-12-10T12:00:00Z"),
        },
      ],
    });

    const req = new NextRequest("http://localhost/api/forecast?months=1");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    const expectedMonthlyIncome = 100 * (52 / 12) + 1200 / 12;
    const expectedMonthlyExpense = 260 * (26 / 12) + 300 / 3;
    const expectedProjIncome = Math.round(expectedMonthlyIncome * 0.4 * 100) / 100;
    const expectedProjExpense = Math.round(expectedMonthlyExpense * 0.4 * 100) / 100;

    expect(data.forecastMonths).toHaveLength(1);
    expect(data.forecastMonths[0].projectedIncome).toBe(expectedProjIncome);
    expect(data.forecastMonths[0].projectedExpense).toBe(expectedProjExpense);
    expect(data.forecastMonths[0].monthKey).toBe("2026-12");
  });

  test("localiza meses futuros com monthKey aditivo, categoria Outros e riskAlerts em en e es", async () => {
    await localDb.category.createMany({
      data: [
        { id: "cat-active", name: "Mercado", type: "EXPENSE", color: "#ef4444", isActive: true },
        { id: "cat-inactive", name: "Antiga", type: "EXPENSE", color: "#999999", isActive: false },
      ],
    });

    // Meses mais antigos (julho e agosto) com gastos menores que os últimos 3 meses (set, out, nov)
    await localDb.transaction.createMany({
      data: [
        { id: "t-inc-jul", type: "INCOME", amount: 1000, description: "Salário Jul", date: new Date(2026, 6, 10, 12, 0) },
        { id: "t-exp-jul", type: "EXPENSE", amount: 500, description: "Gasto Jul", date: new Date(2026, 6, 12, 12, 0), categoryId: "cat-active" },
        { id: "t-inc-aug", type: "INCOME", amount: 1000, description: "Salário Ago", date: new Date(2026, 7, 10, 12, 0) },
        { id: "t-exp-aug", type: "EXPENSE", amount: 500, description: "Gasto Ago", date: new Date(2026, 7, 12, 12, 0), categoryId: "cat-active" },
        { id: "t-inc-sep", type: "INCOME", amount: 1000, description: "Salário Set", date: new Date(2026, 8, 10, 12, 0) },
        { id: "t-exp-sep", type: "EXPENSE", amount: 1500, description: "Gasto Set", date: new Date(2026, 8, 12, 12, 0), categoryId: "cat-active" },
        { id: "t-inc-oct", type: "INCOME", amount: 1000, description: "Salário Out", date: new Date(2026, 9, 10, 12, 0) },
        { id: "t-exp-oct", type: "EXPENSE", amount: 1500, description: "Gasto Out", date: new Date(2026, 9, 12, 12, 0), categoryId: "cat-active" },
        { id: "t-inc-nov", type: "INCOME", amount: 1000, description: "Salário Nov", date: new Date(2026, 10, 10, 12, 0) },
        { id: "t-exp-nov", type: "EXPENSE", amount: 1500, description: "Gasto Nov", date: new Date(2026, 10, 12, 12, 0), categoryId: "cat-active" },
        { id: "t-exp-inact", type: "EXPENSE", amount: 100, description: "Inativa", date: new Date(2026, 10, 13, 12, 0), categoryId: "cat-inactive" },
      ],
    });

    const resEn = await GET(new NextRequest("http://localhost/api/forecast?months=2&locale=en"));
    expect(resEn.status).toBe(200);
    const dataEn = await resEn.json();
    expect(dataEn.forecastMonths[0].monthKey).toBe("2026-12");
    expect(dataEn.forecastMonths[1].monthKey).toBe("2027-01");
    expect(dataEn.forecastMonths[0].month.toLowerCase()).toContain("december");
    expect(dataEn.topExpenseCategories.some((c: { name: string }) => c.name === "Other")).toBe(true);
    expect(dataEn.riskAlerts).toContain("Your expenses exceed 90% of your average income. Risk of deficit.");
    expect(dataEn.riskAlerts).toContain("Your average monthly balance is negative. Review your spending urgently.");
    expect(dataEn.riskAlerts.some((a: string) => a.includes("Overall expenses are 207% above"))).toBe(true);
    expect(dataEn.riskAlerts.some((a: string) => a.includes("Spending on Mercado is 200% above"))).toBe(true);

    const resEs = await GET(new NextRequest("http://localhost/api/forecast?months=2&locale=es"));
    expect(resEs.status).toBe(200);
    const dataEs = await resEs.json();
    expect(dataEs.forecastMonths[0].monthKey).toBe("2026-12");
    expect(dataEs.forecastMonths[0].month.toLowerCase()).toContain("diciembre");
    expect(dataEs.topExpenseCategories.some((c: { name: string }) => c.name === "Otros")).toBe(true);
    expect(dataEs.riskAlerts).toContain("Sus gastos superan el 90% de sus ingresos promedio. Riesgo de déficit.");
    expect(dataEs.riskAlerts).toContain("Su saldo promedio mensual es negativo. Revise sus gastos con urgencia.");
    expect(dataEs.riskAlerts.some((a: string) => a.includes("Los gastos generales están un 207%"))).toBe(true);
    expect(dataEs.riskAlerts.some((a: string) => a.includes("Los gastos en Mercado están un 200%"))).toBe(true);
  });

  test("retorna erro 400 localizado com code e X-Error-Code quando months é inválido", async () => {
    const resPt = await GET(new NextRequest("http://localhost/api/forecast?months=99"));
    expect(resPt.status).toBe(400);
    expect(resPt.headers.get("X-Error-Code")).toBe("VALIDATION_ERROR");
    expect(await resPt.json()).toEqual({
      error: "O parâmetro 'months' deve ser um número entre 1 e 6.",
      code: "VALIDATION_ERROR",
    });

    const resEn = await GET(new NextRequest("http://localhost/api/forecast?months=99&locale=en"));
    expect(resEn.status).toBe(400);
    expect(resEn.headers.get("X-Error-Code")).toBe("VALIDATION_ERROR");
    expect(await resEn.json()).toEqual({
      error: "Parameter 'months' must be a number between 1 and 6.",
      code: "VALIDATION_ERROR",
    });

    const resEs = await GET(new NextRequest("http://localhost/api/forecast?months=99&locale=es"));
    expect(resEs.status).toBe(400);
    expect(resEs.headers.get("X-Error-Code")).toBe("VALIDATION_ERROR");
    expect(await resEs.json()).toEqual({
      error: "El parámetro 'months' debe ser un número entre 1 y 6.",
      code: "VALIDATION_ERROR",
    });
  });
});
