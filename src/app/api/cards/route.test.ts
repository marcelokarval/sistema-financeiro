import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

describe("POST, PUT e DELETE /api/cards - validação JSON e domínio", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let POST: typeof import("./route").POST;
  let PUT: typeof import("./route").PUT;
  let DELETE: typeof import("./route").DELETE;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "cards-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    await localDb.$executeRawUnsafe(
      `CREATE TABLE "Card" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CREDIT', "brand" TEXT NOT NULL DEFAULT 'VISA', "lastFourDigits" TEXT NOT NULL, "creditLimit" REAL NOT NULL DEFAULT 0, "currentBalance" REAL NOT NULL DEFAULT 0, "closingDay" INTEGER NOT NULL DEFAULT 1, "dueDay" INTEGER NOT NULL DEFAULT 10, "color" TEXT NOT NULL DEFAULT '#8b5cf6', "flag" TEXT NOT NULL DEFAULT '', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    );

    mock.module("@/lib/db", () => ({ db: localDb }));
    ({ POST, PUT, DELETE } = await import("./route"));
  });

  beforeEach(async () => {
    await localDb.card.deleteMany();
    await localDb.card.create({
      data: {
        id: "card-1",
        name: "Cartão Principal",
        type: "CREDIT",
        brand: "VISA",
        lastFourDigits: "1234",
        creditLimit: 3000,
        closingDay: 5,
        dueDay: 15,
      },
    });
  });

  afterAll(async () => {
    await localDb?.$disconnect();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test("POST, PUT e DELETE retornam HTTP 400 para JSON malformado", async () => {
    for (const raw of ["{invalido", "", "null"]) {
      expect((await POST(new NextRequest("http://localhost/api/cards", { method: "POST", body: raw }))).status).toBe(400);
      expect((await PUT(new NextRequest("http://localhost/api/cards", { method: "PUT", body: raw }))).status).toBe(400);
      expect((await DELETE(new NextRequest("http://localhost/api/cards", { method: "DELETE", body: raw }))).status).toBe(400);
    }
  });

  test("POST e PUT rejeitam nome vazio, closingDay/dueDay fora de 1..31, limite inválido e enums inválidos com HTTP 400", async () => {
    for (const payload of [
      { name: "   ", lastFourDigits: "4321" },
      { name: "Cartão", lastFourDigits: "   " },
      { name: "Cartão", lastFourDigits: "4321", closingDay: 0 },
      { name: "Cartão", lastFourDigits: "4321", dueDay: 32 },
      { name: "Cartão", lastFourDigits: "4321", closingDay: 10.5 },
      { name: "Cartão", lastFourDigits: "4321", creditLimit: -1 },
      { name: "Cartão", lastFourDigits: "4321", type: "INVALIDO" },
      { name: "Cartão", lastFourDigits: "4321", brand: "INVALIDA" },
    ]) {
      const res = await POST(
        new NextRequest("http://localhost/api/cards", { method: "POST", body: JSON.stringify(payload) })
      );
      expect(res.status).toBe(400);
    }

    for (const payload of [
      { id: "card-1", name: "   " },
      { id: "card-1", lastFourDigits: "   " },
      { id: "card-1", closingDay: 0 },
      { id: "card-1", closingDay: 32 },
      { id: "card-1", dueDay: 0 },
      { id: "card-1", dueDay: 32 },
      { id: "card-1", creditLimit: "NaN" },
      { id: "card-1", currentBalance: "Infinity" },
      { id: "card-1", type: "PREPAID" },
      { id: "card-1", brand: "DINERS" },
    ]) {
      const res = await PUT(
        new NextRequest("http://localhost/api/cards", { method: "PUT", body: JSON.stringify(payload) })
      );
      expect(res.status).toBe(400);
    }

    const card = await localDb.card.findUniqueOrThrow({ where: { id: "card-1" } });
    expect(card.name).toBe("Cartão Principal");
    expect(card.dueDay).toBe(15);
  });

  test("PUT atualiza cartão válido e retorna 404 para cartão inexistente", async () => {
    const missing = await PUT(
      new NextRequest("http://localhost/api/cards", {
        method: "PUT",
        body: JSON.stringify({ id: "card-missing", name: "Teste" }),
      })
    );
    expect(missing.status).toBe(404);

    const ok = await PUT(
      new NextRequest("http://localhost/api/cards", {
        method: "PUT",
        body: JSON.stringify({
          id: "card-1",
          name: "  Cartão Black  ",
          brand: "MASTERCARD",
          closingDay: 28,
          dueDay: 5,
          creditLimit: 5000,
        }),
      })
    );
    expect(ok.status).toBe(200);
    const updated = await localDb.card.findUniqueOrThrow({ where: { id: "card-1" } });
    expect(updated.name).toBe("Cartão Black");
    expect(updated.brand).toBe("MASTERCARD");
    expect(updated.closingDay).toBe(28);
    expect(updated.creditLimit).toBe(5000);
  });
});
