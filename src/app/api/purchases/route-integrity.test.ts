import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { closeSync, existsSync, openSync, realpathSync, unlinkSync } from "node:fs";
import { NextRequest } from "next/server";

const fixturePath = "/scratch/purchases-integrity.db";
const fixtureUrl = `file:${fixturePath}`;

// Execute em bwrap com /scratch privado e gravável, fontes somente leitura, sem .env:
// DATABASE_URL=file:/scratch/purchases-integrity.db bun --no-env-file test ./src/app/api/purchases/route-integrity.test.ts
let db: typeof import("@/lib/db").db;
let handlers: typeof import("./route");
let ownsFixture = false;

const fixtureSchema = [
  `CREATE TABLE "Card" (
    "id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CREDIT',
    "brand" TEXT NOT NULL DEFAULT 'VISA', "lastFourDigits" TEXT NOT NULL,
    "creditLimit" REAL NOT NULL DEFAULT 0, "currentBalance" REAL NOT NULL DEFAULT 0,
    "closingDay" INTEGER NOT NULL DEFAULT 1, "dueDay" INTEGER NOT NULL DEFAULT 10,
    "color" TEXT NOT NULL DEFAULT '#8b5cf6', "flag" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "icon" TEXT NOT NULL DEFAULT 'tag',
    "type" TEXT NOT NULL DEFAULT 'EXPENSE', "color" TEXT NOT NULL DEFAULT '#6b7280',
    "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL PRIMARY KEY, "merchant" TEXT NOT NULL, "totalAmount" REAL NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT NOT NULL DEFAULT '',
    "installmentNumber" INTEGER NOT NULL DEFAULT 1, "installmentTotal" INTEGER NOT NULL DEFAULT 1,
    "cardId" TEXT REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE, "accountId" TEXT,
    "categoryId" TEXT REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE "PurchaseItem" (
    "id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" REAL NOT NULL, "totalPrice" REAL NOT NULL,
    "purchaseId" TEXT NOT NULL REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
  )`,
];

function request(method: "PUT" | "DELETE", body: object) {
  return new NextRequest("http://fixture.test/api/purchases", { method, body: JSON.stringify(body) });
}

function readPurchases() {
  return db.purchase.findMany({ orderBy: { id: "asc" }, include: { items: { orderBy: { id: "asc" } } } });
}

async function seedPurchase(id: string) {
  await db.purchase.create({
    data: {
      id, merchant: `Loja ${id}`, totalAmount: 30, notes: "Compra sintética",
      cardId: "cartao-fixture", categoryId: "categoria-fixture",
      items: { create: [
        { id: `${id}-a`, name: "Arroz", quantity: 2, unitPrice: 10, totalPrice: 20 },
        { id: `${id}-b`, name: "Feijão", unitPrice: 10, totalPrice: 10 },
      ] },
    },
  });
}

// Sem opt-in, a suíte normal não importa o cliente da rota nem toca no banco.
describe.skipIf(process.env.DATABASE_URL !== fixtureUrl)("integridade de Compra em SQLite isolado", () => {
  beforeAll(async () => {
    expect(process.env.DATABASE_URL).toBe(fixtureUrl);
    expect(realpathSync("/scratch")).toBe("/scratch");
    // O Prisma também pode buscar .env independentemente de --no-env-file.
    expect(existsSync(".env")).toBe(false);
    expect(existsSync("prisma/.env")).toBe(false);
    // Criação exclusiva: nunca reutiliza arquivo, link ou banco existente.
    const fd = openSync(fixturePath, "wx", 0o600);
    ownsFixture = true;
    closeSync(fd);
    ({ db } = await import("@/lib/db"));
    expect(await db.$queryRaw<{ seq: bigint; name: string; file: string }[]>`PRAGMA database_list`).toEqual([{ seq: BigInt(0), name: "main", file: fixturePath }]);
    expect(await db.$queryRaw<{ foreign_keys: bigint }[]>`PRAGMA foreign_keys`).toEqual([{ foreign_keys: BigInt(1) }]);
    expect(await db.$queryRaw<{ name: string }[]>`SELECT name FROM sqlite_schema`).toEqual([]);
    for (const sql of fixtureSchema) await db.$executeRawUnsafe(sql);
    expect(await db.$queryRaw`PRAGMA foreign_key_list("PurchaseItem")`).toMatchObject([
      { table: "Purchase", from: "purchaseId", to: "id", on_delete: "CASCADE" },
    ]);
    handlers = await import("./route");
    await db.card.create({ data: { id: "cartao-fixture", name: "Cartão sentinela", lastFourDigits: "0000" } });
    await db.category.create({ data: { id: "categoria-fixture", name: "Categoria sentinela" } });
    for (const id of ["alvo-put", "alvo-delete", "alvo-nominal", "sentinela"]) await seedPurchase(id);
    await db.$executeRaw`CREATE TRIGGER fixture_put_abort BEFORE INSERT ON "PurchaseItem"
      WHEN NEW."purchaseId" = 'alvo-put' AND NEW."name" = 'item-bloqueado'
        AND NOT EXISTS (SELECT 1 FROM "PurchaseItem" WHERE "id" = 'alvo-put-a')
      BEGIN SELECT RAISE(ABORT, 'fixture_put_abort'); END`;
    await db.$executeRaw`CREATE TRIGGER fixture_delete_abort AFTER DELETE ON "Purchase"
      WHEN OLD."id" = 'alvo-delete'
        AND NOT EXISTS (SELECT 1 FROM "PurchaseItem" WHERE "purchaseId" = OLD."id")
      BEGIN SELECT RAISE(ABORT, 'fixture_delete_abort'); END`;
  });

  afterAll(async () => {
    try {
      await db?.$disconnect();
    } finally {
      if (ownsFixture) unlinkSync(fixturePath);
    }
  });

  test.each([
    {
      method: "PUT", error: "Failed to update purchase",
      body: {
        id: "alvo-put", merchant: "Loja alterada", totalAmount: 40,
        items: [{ name: "item-válido", unitPrice: 15 }, { name: "item-bloqueado", unitPrice: 25 }],
      },
    },
    { method: "DELETE", error: "Failed to delete purchase", body: { id: "alvo-delete" } },
  ] as const)("$method preserva compras, filhos e sentinelas se o SQLite abortar", async ({ method, error, body }) => {
    const before = await readPurchases();
    const references = { card: await db.card.findMany(), category: await db.category.findMany() };
    const log = spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await handlers[method](request(method, body));
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error });
      // O engine Prisma/SQLite reporta RAISE(ABORT) como P2003 sem o texto do gatilho.
      expect(log.mock.calls.at(-1)?.[1]).toMatchObject({ code: "P2003" });
    } finally {
      log.mockRestore();
    }
    expect(await db.card.findMany()).toEqual(references.card);
    expect(await db.category.findMany()).toEqual(references.category);
    expect(await readPurchases()).toEqual(before);
  });

  test("PUT substitui somente os itens do alvo e DELETE remove a compra e seus filhos", async () => {
    const id = "alvo-nominal";
    const others = (await readPurchases()).filter((purchase) => purchase.id !== id);
    const update = await handlers.PUT(request("PUT", {
      id, merchant: "  Loja nova  ", totalAmount: "15",
      items: [{ name: "Café", quantity: 2, unitPrice: 7.5 }],
    }));
    expect(update.status).toBe(200);
    const expected = {
      id, merchant: "Loja nova", totalAmount: 15, notes: "Compra sintética",
      cardId: "cartao-fixture", categoryId: "categoria-fixture",
      items: [expect.objectContaining({ name: "Café", quantity: 2, unitPrice: 7.5, totalPrice: 15 })],
    };
    expect(await update.json()).toMatchObject({
      ...expected, card: { id: "cartao-fixture" }, category: { id: "categoria-fixture" },
    });
    expect(await db.purchase.findUnique({ where: { id }, include: { items: true } })).toMatchObject(expected);
    expect(await db.purchaseItem.count({ where: { purchaseId: id } })).toBe(1);

    const item = await db.purchaseItem.findFirstOrThrow({ where: { purchaseId: id } });
    const updateWithoutItems = await handlers.PUT(request("PUT", { id, notes: "Somente metadados" }));
    expect(updateWithoutItems.status).toBe(200);
    expect(await db.purchaseItem.findMany({ where: { purchaseId: id } })).toEqual([item]);
    expect(await db.purchase.findUnique({ where: { id } })).toMatchObject({ notes: "Somente metadados" });

    const deleted = await handlers.DELETE(request("DELETE", { id }));
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toEqual({ success: true, message: "Purchase deleted" });
    expect(await db.purchaseItem.count({ where: { purchaseId: id } })).toBe(0);
    expect(await readPurchases()).toEqual(others);
  });

  test("PUT com lista vazia mantém a compra e remove todos os seus itens", async () => {
    const id = "alvo-vazio";
    await seedPurchase(id);
    const others = (await readPurchases()).filter((purchase) => purchase.id !== id);
    const response = await handlers.PUT(request("PUT", { id, items: [] }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id, items: [] });
    expect(await db.purchase.findUnique({ where: { id }, include: { items: true } }))
      .toMatchObject({ id, merchant: "Loja alvo-vazio", totalAmount: 30, items: [] });
    expect((await readPurchases()).filter((purchase) => purchase.id !== id)).toEqual(others);
  });

  test.each(["PUT", "DELETE"] as const)("%s mantém 400 sem ID e 404 para compra ausente", async (method) => {
    const before = await readPurchases();
    const missing = await handlers[method](request(method, {}));
    expect(missing.status).toBe(400);
    expect(await missing.json()).toEqual({ error: "Purchase id is required" });
    const absent = await handlers[method](request(method, { id: "não-existe" }));
    expect(absent.status).toBe(404);
    expect(await absent.json()).toEqual({ error: "Purchase not found" });
    expect(await readPurchases()).toEqual(before);
  });
});
