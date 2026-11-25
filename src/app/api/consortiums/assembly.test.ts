import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, lstatSync, realpathSync, statfsSync } from "node:fs";
import { NextRequest } from "next/server";

const sqlitePath = "/scratch/consortium-assembly.sqlite";
const fixtureUrl = `file:${sqlitePath}`;
let db: typeof import("@/lib/db").db;
let POST: typeof import("./route").POST;
let PUT: typeof import("./route").PUT;
const contract = {
  description: "Consórcio sintético",
  totalAmount: 900,
  monthlyPayment: 300,
  installmentCount: 3,
  startDate: "2026-11-05",
};
const originalDate = "2026-12-10";
const updatedDate = "2027-03-05";
const isoDate = (date: string) => `${date}T00:00:00.000Z`;

function request(method: "POST" | "PUT", body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/consortiums", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

let selectedId: string;
let sentinel: Awaited<ReturnType<typeof seedSentinel>>;

async function seedSentinel() {
  const account = await db.account.create({ data: { name: "Conta sentinela", balance: 340 } });
  const transaction = await db.transaction.create({
    data: { accountId: account.id, type: "EXPENSE", amount: 300, description: "Pagamento sintético preexistente" },
  });
  const consortium = await db.consortium.create({
    data: {
      ...contract, startDate: new Date(contract.startDate), description: "Outro consórcio",
      status: "CONTEMPLATED", assembliesAttended: 8, nextAssemblyDate: new Date("2027-04-12"),
    },
  });
  return { account, transaction, consortium };
}

async function selectedRow() {
  return db.consortium.findUniqueOrThrow({ where: { id: selectedId }, include: { installments: true } });
}

async function expectSentinelsUnchanged() {
  expect(await db.consortium.findUnique({ where: { id: sentinel.consortium.id } })).toEqual(sentinel.consortium);
  expect(await db.account.findUnique({ where: { id: sentinel.account.id } })).toEqual(sentinel.account);
  expect(await db.transaction.findUnique({ where: { id: sentinel.transaction.id } })).toEqual(sentinel.transaction);
  expect(await db.transaction.count()).toBe(1);
}

async function expectCountUpdate(assembliesAttended: number) {
  const before = await selectedRow();
  const response = await PUT(request("PUT", { id: selectedId, assembliesAttended }));
  expect(response.status).toBe(200);
  const after = await selectedRow();
  expect({ ...after, updatedAt: before.updatedAt }).toEqual({ ...before, assembliesAttended });
  expect(await response.json()).toMatchObject({ id: selectedId, assembliesAttended, _count: { installments: 1 } });
  await expectSentinelsUnchanged();
}

async function expectCreate(datePayload: Record<string, unknown>, expectedDate: string | null) {
  const before = await selectedRow();
  const response = await POST(request("POST", { ...contract, accountId: sentinel.account.id, ...datePayload }));
  expect(response.status).toBe(201);
  const body = await response.json();
  expect(body.id).not.toBe(selectedId);
  const stored = await db.consortium.findUniqueOrThrow({
    where: { id: body.id }, include: { installments: { orderBy: { number: "asc" } } },
  });
  expect(stored.nextAssemblyDate?.toISOString() ?? null).toBe(expectedDate);
  expect(body).toMatchObject({ nextAssemblyDate: expectedDate, assembliesAttended: 0, status: "ACTIVE" });
  expect(stored.accountId).toBe(sentinel.account.id);
  expect(stored.startDate.toISOString()).toBe(isoDate(contract.startDate));
  expect(stored.installments.map(({ number, amount, dueDate, status }) => ({
    number, amount, dueDate: dueDate.toISOString(), status,
  }))).toEqual(["2026-11-05", "2026-12-05", "2027-01-05"].map((date, index) => ({
    number: index + 1, amount: 300, dueDate: isoDate(date), status: "PENDING",
  })));
  expect(await selectedRow()).toEqual(before);
  await expectSentinelsUnchanged();
}

// Opt-in: em bwrap sem rede, com /scratch em tmpfs privado e SQLite vazio
// criado a partir do schema montado somente para leitura.
// DATABASE_URL=file:/scratch/consortium-assembly.sqlite bun --no-env-file test ./src/app/api/consortiums/assembly.test.ts
describe.skipIf(process.env.DATABASE_URL !== fixtureUrl)("Assembleias de consórcio com SQLite isolado", () => {
  beforeAll(async () => {
    // Verifique a fixture antes de carregar o cliente ou qualquer handler.
    expect(existsSync(".env")).toBe(false);
    expect(existsSync("prisma/.env")).toBe(false);
    expect(realpathSync(sqlitePath)).toBe(sqlitePath);
    expect(statfsSync("/scratch").type).toBe(0x01021994); // TMPFS_MAGIC
    const fixture = lstatSync(sqlitePath);
    expect(fixture.isFile()).toBe(true);
    expect(fixture.nlink).toBe(1);
    ({ db } = await import("@/lib/db"));
    const databases = await db.$queryRaw<Array<{ seq: bigint; name: string; file: string }>>`PRAGMA database_list`;
    expect(databases).toEqual([{ seq: BigInt(0), name: "main", file: sqlitePath }]);
    const foreignKeys = await db.$queryRaw<Array<{ foreign_keys: bigint }>>`PRAGMA foreign_keys`;
    expect(foreignKeys).toEqual([{ foreign_keys: BigInt(1) }]);
    expect(await Promise.all([db.consortium.count(), db.account.count(), db.transaction.count()])).toEqual([0, 0, 0]);
    ({ POST, PUT } = await import("./route"));
  });

  afterAll(async () => { await db?.$disconnect(); });

  beforeEach(async () => {
    await db.consortium.deleteMany();
    await db.transaction.deleteMany();
    await db.account.deleteMany();
    sentinel = await seedSentinel();
    const selected = await db.consortium.create({
      data: {
        ...contract, startDate: new Date(contract.startDate), accountId: sentinel.account.id,
        nextAssemblyDate: new Date(originalDate), assembliesAttended: 2, fundedAmount: 300, paidInstallments: 1,
        installments: { create: { number: 1, amount: 300, dueDate: new Date(contract.startDate),
          paidDate: new Date("2026-11-06"), status: "PAID" } },
      },
    });
    selectedId = selected.id;
  });

  test("POST persiste data opcional sem mudar as parcelas geradas", async () => {
    await expectCreate({ nextAssemblyDate: originalDate }, isoDate(originalDate));
  });

  test("POST deixa a data nula quando omitida ou explicitamente nula", async () => {
    await expectCreate({}, null);
    await expectCreate({ nextAssemblyDate: null }, null);
  });

  test("PUT persiste a contagem apenas no consórcio selecionado", async () => {
    await expectCountUpdate(4); // Pode ser maior que o número de parcelas.
  });

  test("PUT persiste zero em vez de preservar a contagem antiga", async () => {
    await expectCountUpdate(0);
  });

  test("PUT preserva contagem omitida e mantém contrato de data e status", async () => {
    const before = await selectedRow();
    const update = await PUT(request("PUT", { id: selectedId, nextAssemblyDate: updatedDate, status: "CONTEMPLATED" }));
    expect(update.status).toBe(200);
    const changed = await selectedRow();
    expect({ ...changed, updatedAt: before.updatedAt }).toEqual({
      ...before, nextAssemblyDate: new Date(updatedDate), status: "CONTEMPLATED",
    });
    const clear = await PUT(request("PUT", { id: selectedId, nextAssemblyDate: null }));
    expect(clear.status).toBe(200);
    const cleared = await selectedRow();
    expect({ ...cleared, updatedAt: changed.updatedAt }).toEqual({ ...changed, nextAssemblyDate: null });
    await expectSentinelsUnchanged();
  });

  test.each([-1, 1.5, "4", null, true, 2_147_483_648])("PUT rejeita contagem inválida (%p) sem gravar", async (value) => {
    const before = await selectedRow();
    const response = await PUT(request("PUT", { id: selectedId, description: "Não gravar", assembliesAttended: value }));
    expect(response.status).toBe(400);
    expect(await selectedRow()).toEqual(before);
    await expectSentinelsUnchanged();
  });

  test("PUT mantém 400 sem ID e 404 para consórcio inexistente", async () => {
    const before = await selectedRow();
    expect((await PUT(request("PUT", { assembliesAttended: 4 }))).status).toBe(400);
    expect((await PUT(request("PUT", { id: "inexistente", assembliesAttended: 4 }))).status).toBe(404);
    expect(await selectedRow()).toEqual(before);
    await expectSentinelsUnchanged();
  });
});
