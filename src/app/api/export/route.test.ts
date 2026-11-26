/// <reference types="bun-types" />

import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

describe("GET /api/export - neutralização de formula injection e datas civis", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let GET: typeof import("./route").GET;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "export-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    const ddl = [
      `CREATE TABLE "Account" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CASH', "balance" REAL NOT NULL DEFAULT 0, "color" TEXT NOT NULL DEFAULT '#6366f1', "icon" TEXT NOT NULL DEFAULT 'wallet', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Card" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CREDIT', "brand" TEXT NOT NULL DEFAULT 'VISA', "lastFourDigits" TEXT NOT NULL, "creditLimit" REAL NOT NULL DEFAULT 0, "currentBalance" REAL NOT NULL DEFAULT 0, "closingDay" INTEGER NOT NULL DEFAULT 1, "dueDay" INTEGER NOT NULL DEFAULT 10, "color" TEXT NOT NULL DEFAULT '#8b5cf6', "flag" TEXT NOT NULL DEFAULT '', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "icon" TEXT NOT NULL DEFAULT 'tag', "type" TEXT NOT NULL DEFAULT 'EXPENSE', "color" TEXT NOT NULL DEFAULT '#6b7280', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Transaction" ("id" TEXT NOT NULL PRIMARY KEY, "type" TEXT NOT NULL, "amount" REAL NOT NULL, "description" TEXT NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "categoryId" TEXT, "accountId" TEXT, "cardId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "Purchase" ("id" TEXT NOT NULL PRIMARY KEY, "merchant" TEXT NOT NULL, "totalAmount" REAL NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '', "installmentNumber" INTEGER NOT NULL DEFAULT 1, "installmentTotal" INTEGER NOT NULL DEFAULT 1, "cardId" TEXT, "accountId" TEXT, "categoryId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE "PurchaseItem" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "quantity" INTEGER NOT NULL DEFAULT 1, "unitPrice" REAL NOT NULL, "totalPrice" REAL NOT NULL, "purchaseId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ];
    for (const sql of ddl) {
      await localDb.$executeRawUnsafe(sql);
    }

    mock.module("@/lib/db", () => ({ db: localDb }));
    ({ GET } = await import("./route"));
  });

  beforeEach(async () => {
    await localDb.purchaseItem.deleteMany();
    await localDb.purchase.deleteMany();
    await localDb.transaction.deleteMany();
    await localDb.account.deleteMany();
  });

  afterAll(async () => {
    await localDb?.$disconnect();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test("neutraliza formula injection em transactions, purchases e accounts sem duplo escape", async () => {
    await localDb.transaction.createMany({
      data: [
        { id: "t-eq", type: "EXPENSE", amount: 10, description: "=SUM(A1)", date: new Date(2026, 10, 25, 10, 0) },
        { id: "t-plus", type: "EXPENSE", amount: 10, description: "+1+1", date: new Date(2026, 10, 25, 11, 0) },
        { id: "t-minus", type: "EXPENSE", amount: 10, description: "-cmd|'/C calc'!A0", date: new Date(2026, 10, 25, 12, 0) },
        { id: "t-at", type: "EXPENSE", amount: 10, description: "@SUM(1,2)", date: new Date(2026, 10, 25, 13, 0) },
        { id: "t-tab", type: "EXPENSE", amount: 10, description: "\t=1", date: new Date(2026, 10, 25, 14, 0) },
        { id: "t-cr", type: "EXPENSE", amount: 10, description: "\r=1", date: new Date(2026, 10, 25, 15, 0) },
        { id: "t-semi", type: "EXPENSE", amount: 10, description: "=1;2", date: new Date(2026, 10, 25, 16, 0) },
      ],
    });
    await localDb.purchase.create({
      data: { id: "p-eq", merchant: "=HYPERLINK(\"http://evil\",\"click\")", totalAmount: 99, date: new Date(2026, 10, 25, 10, 0) },
    });
    await localDb.account.create({
      data: { id: "a-plus", name: "+Conta;Principal", balance: 100 },
    });

    const txRes = await GET(new NextRequest("http://localhost/api/export?type=transactions&format=csv"));
    expect(txRes.status).toBe(200);
    const txCsv = await txRes.text();
    expect(txCsv.startsWith("\uFEFF")).toBe(true);
    expect(txCsv).toContain(";'=SUM(A1);");
    expect(txCsv).toContain(";'+1+1;");
    expect(txCsv).toContain(";'-cmd|'/C calc'!A0;");
    expect(txCsv).toContain(";'@SUM(1,2);");
    expect(txCsv).toContain(";'\t=1;");
    expect(txCsv).toContain(`;"'\r=1";`);
    expect(txCsv).toContain(`;"'=1;2";`);
    // Sem duplo escape ('') nem aspas duplicadas extras
    expect(txCsv).not.toContain("''=");
    expect(txCsv).not.toContain(`"''`);

    const purRes = await GET(new NextRequest("http://localhost/api/export?type=purchases&format=csv"));
    expect(purRes.status).toBe(200);
    const purCsv = await purRes.text();
    expect(purCsv).toContain(`;"'=HYPERLINK(""http://evil"",""click"")";`);
    expect(purCsv).not.toContain(`"''=`);

    const accRes = await GET(new NextRequest("http://localhost/api/export?type=accounts&format=csv"));
    expect(accRes.status).toBe(200);
    const accCsv = await accRes.text();
    expect(accCsv).toContain(`;"'+Conta;Principal";`);
    expect(accCsv).not.toContain(`"''+`);
  });

  test("interpreta startDate/endDate no fuso civil local e inclui lançamento às 22:30 BRT", async () => {
    await localDb.transaction.createMany({
      data: [
        { id: "tx-prev", type: "EXPENSE", amount: 15, description: "Dia anterior", date: new Date(2026, 10, 24, 22, 30, 0) },
        { id: "tx-late", type: "EXPENSE", amount: 25, description: "Compra noturna", date: new Date(2026, 10, 25, 22, 30, 0) },
        { id: "tx-next", type: "EXPENSE", amount: 35, description: "Dia seguinte", date: new Date(2026, 10, 26, 0, 30, 0) },
      ],
    });

    const res = await GET(
      new NextRequest("http://localhost/api/export?type=transactions&format=csv&startDate=2026-11-25&endDate=2026-11-25")
    );
    expect(res.status).toBe(200);
    const csv = await res.text();
    expect(csv).toContain("Compra noturna");
    expect(csv).not.toContain("Dia anterior");
    expect(csv).not.toContain("Dia seguinte");
  });

  test("retorna HTTP 400 para startDate/endDate inválidas ou intervalo invertido", async () => {
    for (const query of [
      "type=transactions&format=csv&startDate=2026-02-30",
      "type=transactions&format=csv&endDate=abc",
      "type=purchases&format=csv&startDate=2026-11-26&endDate=2026-11-25",
    ]) {
      const res = await GET(new NextRequest(`http://localhost/api/export?${query}`));
      expect(res.status).toBe(400);
    }
  });

  test("localiza cabeçalhos, enums, números, datas civis e nomes de arquivo para ?locale=en e ?locale=es preservando BOM e anti-formula-injection", async () => {
    await localDb.transaction.create({
      data: {
        id: "tx-i18n",
        type: "EXPENSE",
        amount: 1234.56,
        description: "=SUM(A1)",
        date: new Date(2026, 10, 25, 10, 0),
      },
    });
    await localDb.purchase.create({
      data: {
        id: "pur-i18n",
        merchant: "Supermarket",
        totalAmount: 250.5,
        date: new Date("2026-11-25T00:00:00.000Z"),
        installmentNumber: 1,
        installmentTotal: 1,
      },
    });
    await localDb.account.create({
      data: {
        id: "acc-i18n",
        name: "Wallet",
        type: "DIGITAL_WALLET",
        balance: 987.65,
        isActive: true,
      },
    });

    // English
    const enTxRes = await GET(new NextRequest("http://localhost/api/export?type=transactions&format=csv&locale=en"));
    expect(enTxRes.status).toBe(200);
    expect(enTxRes.headers.get("Content-Disposition")).toBe('attachment; filename="transactions.csv"');
    const enTxCsv = await enTxRes.text();
    expect(enTxCsv.startsWith("\uFEFF")).toBe(true);
    expect(enTxCsv).toContain("ID;Type;Amount (BRL);Description;Date;Category;Account;Card");
    expect(enTxCsv).toContain(";Expense;1,234.56;'=SUM(A1);");
    expect(enTxCsv).not.toContain("''=");

    const enPurRes = await GET(new NextRequest("http://localhost/api/export?type=purchases&format=csv&locale=en"));
    expect(enPurRes.status).toBe(200);
    expect(enPurRes.headers.get("Content-Disposition")).toBe('attachment; filename="purchases.csv"');
    const enPurCsv = await enPurRes.text();
    expect(enPurCsv).toContain("ID;Merchant;Total Amount (BRL);Date;Card;Items Count;Installment");
    expect(enPurCsv).toContain(";250.50;11/25/2026;");
    expect(enPurCsv).toContain(";In full");

    const enAccRes = await GET(new NextRequest("http://localhost/api/export?type=accounts&format=csv&locale=en"));
    expect(enAccRes.status).toBe(200);
    expect(enAccRes.headers.get("Content-Disposition")).toBe('attachment; filename="accounts.csv"');
    const enAccCsv = await enAccRes.text();
    expect(enAccCsv).toContain("ID;Name;Type;Balance (BRL);Active");
    expect(enAccCsv).toContain(";Digital Wallet;987.65;Yes");

    // Spanish
    const esTxRes = await GET(new NextRequest("http://localhost/api/export?type=transactions&format=csv&locale=es"));
    expect(esTxRes.status).toBe(200);
    expect(esTxRes.headers.get("Content-Disposition")).toBe('attachment; filename="transacciones.csv"');
    const esTxCsv = await esTxRes.text();
    expect(esTxCsv.startsWith("\uFEFF")).toBe(true);
    expect(esTxCsv).toContain("ID;Tipo;Monto (R$);Descripción;Fecha;Categoría;Cuenta;Tarjeta");
    expect(esTxCsv).toContain(";Gasto;");
    expect(esTxCsv).toContain(";'=SUM(A1);");

    const esPurRes = await GET(new NextRequest("http://localhost/api/export?type=purchases&format=csv&locale=es"));
    expect(esPurRes.status).toBe(200);
    expect(esPurRes.headers.get("Content-Disposition")).toBe('attachment; filename="compras.csv"');
    const esPurCsv = await esPurRes.text();
    expect(esPurCsv).toContain("ID;Comercio;Monto Total (R$);Fecha;Tarjeta;Cant. Artículos;Cuota");
    expect(esPurCsv).toContain(";25/11/2026;");
    expect(esPurCsv).toContain(";Al contado");

    const esAccRes = await GET(new NextRequest("http://localhost/api/export?type=accounts&format=csv&locale=es"));
    expect(esAccRes.status).toBe(200);
    expect(esAccRes.headers.get("Content-Disposition")).toBe('attachment; filename="cuentas.csv"');
    const esAccCsv = await esAccRes.text();
    expect(esAccCsv).toContain(";Billetera Digital;");
    expect(esAccCsv).toContain(";Sí");
  });

  test("retorna erros 400 localizados com code e X-Error-Code em pt, es e en", async () => {
    const enRes = await GET(new NextRequest("http://localhost/api/export?type=unknown&format=csv&locale=en"));
    expect(enRes.status).toBe(400);
    expect(enRes.headers.get("X-Error-Code")).toBe("VALIDATION_ERROR");
    expect(await enRes.json()).toEqual({
      error: "Invalid export type. Use: transactions, purchases, or accounts",
      code: "VALIDATION_ERROR",
    });

    const esRes = await GET(new NextRequest("http://localhost/api/export?type=transactions&format=json&locale=es"));
    expect(esRes.status).toBe(400);
    expect(esRes.headers.get("X-Error-Code")).toBe("VALIDATION_ERROR");
    expect(await esRes.json()).toEqual({
      error: "Formato inválido. Use: csv",
      code: "VALIDATION_ERROR",
    });
  });
});
