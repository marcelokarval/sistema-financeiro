import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, lstatSync, realpathSync, statfsSync } from "node:fs";
import { NextRequest } from "next/server";

const fixturePath = "/scratch/savings-route.sqlite";
const fixtureUrl = `file:${fixturePath}`;
const account = { id: "conta-fixture", name: "Conta sintética", color: "#6366f1", icon: "wallet" };
const goalFields = {
  name: "Reserva de viagem", type: "PIGGY_BANK", description: "Descrição anterior",
  targetAmount: 50, currentAmount: 10, monthlyContribution: 5, yieldRate: 1,
  targetDate: "2027-03-05", accountId: account.id, color: "#22c55e",
};

let db: typeof import("@/lib/db").db;
let handlers: typeof import("./route");
let deposit: typeof import("./deposit/route").POST;

function request(method: "POST" | "PUT", body: object, depositPath = "") {
  return new NextRequest(`http://fixture.test/api/savings${depositPath}`, {
    method, body: JSON.stringify(body), headers: { "content-type": "application/json" },
  });
}

function readGoal(id: string) {
  return db.savingsGoal.findUniqueOrThrow({ where: { id } });
}

function stableFields<T extends { updatedAt: unknown }>({ updatedAt: _updatedAt, ...goal }: T) {
  return goal;
}

async function createGoal(payload: object = goalFields) {
  const response = await handlers.POST(request("POST", payload));
  expect(response.status).toBe(201);
  return await response.json() as { id: string; description: string };
}

// Opt-in: em bwrap com /scratch em tmpfs privado, gere o SQLite vazio a partir de
// prisma/schema.prisma (migrate diff --from-empty --to-schema-datamodel ... --script | sqlite3 -bail).
// DATABASE_URL=file:/scratch/savings-route.sqlite bun --no-env-file test ./src/app/api/savings/route.test.ts
describe.skipIf(process.env.DATABASE_URL !== fixtureUrl)("Caixinhas com SQLite isolado", () => {
  beforeAll(async () => {
    expect(existsSync(".env")).toBe(false);
    expect(existsSync("prisma/.env")).toBe(false);
    expect(realpathSync(fixturePath)).toBe(fixturePath);
    expect(statfsSync("/scratch").type).toBe(0x01021994); // TMPFS_MAGIC
    const fixture = lstatSync(fixturePath);
    expect(fixture.isFile()).toBe(true);
    expect(fixture.nlink).toBe(1);
    ({ db } = await import("@/lib/db"));
    const databases = await db.$queryRaw<{ seq: bigint; name: string; file: string }[]>`PRAGMA database_list`;
    expect(databases).toEqual([{ seq: BigInt(0), name: "main", file: fixturePath }]);
    const foreignKeys = await db.$queryRaw<{ foreign_keys: bigint }[]>`PRAGMA foreign_keys`;
    expect(foreignKeys).toEqual([{ foreign_keys: BigInt(1) }]);
    expect(await Promise.all([db.account.count(), db.savingsGoal.count(), db.transaction.count()])).toEqual([0, 0, 0]);
    await db.account.create({ data: { ...account, balance: 720.50 } });
    handlers = await import("./route");
    ({ POST: deposit } = await import("./deposit/route"));
  });

  afterAll(async () => { await db?.$disconnect(); });

  test("POST aceita os campos opcionais nulos e persiste seus valores padrão", async () => {
    const created = await createGoal({ ...goalFields, description: null, monthlyContribution: null, yieldRate: null });
    expect(created.description).toBe("");
    expect(await readGoal(created.id)).toMatchObject({ description: "", monthlyContribution: 0, yieldRate: 0 });
  });

  test.each([
    { label: "nula", patch: { ...goalFields, description: null }, expected: "" },
    { label: "e campos numéricos vazios (formulário A061)", patch: {
      type: "SAVINGS", description: null, targetAmount: 50, currentAmount: 10,
      monthlyContribution: null, yieldRate: null, targetDate: null, accountId: account.id, color: "#22c55e",
    }, expected: "", persisted: { type: "SAVINGS", monthlyContribution: 0, yieldRate: 0, targetDate: null } },
    { label: "omitida com mensalidade nula", patch: { monthlyContribution: null }, expected: "Descrição anterior",
      persisted: { monthlyContribution: 0 } },
    { label: "omitida com rendimento nulo", patch: { yieldRate: null }, expected: "Descrição anterior",
      persisted: { yieldRate: 0 } },
    { label: "omitida", patch: {}, expected: "Descrição anterior" },
    { label: "omitida com valores numéricos informados", patch: { monthlyContribution: 8.25, yieldRate: 3.5 },
      expected: "Descrição anterior", persisted: { monthlyContribution: 8.25, yieldRate: 3.5 } },
    { label: "só espaços", patch: { description: " 	  " }, expected: "" },
    { label: "texto com espaços nas pontas", patch: { description: "  Nova  descrição 	" }, expected: "Nova  descrição" },
  ])("PUT com descrição $label preserva os outros campos e a sentinela", async ({ patch, expected, persisted }) => {
    const { id } = await createGoal();
    const sentinel = await createGoal({ ...goalFields, name: "Caixinha sentinela", currentAmount: 31 });
    const previous = await readGoal(id);
    const sentinelBefore = await readGoal(sentinel.id);
    const accountBefore = await db.account.findUniqueOrThrow({ where: { id: account.id } });

    const response = await handlers.PUT(request("PUT", { ...patch, id, name: "Viagem atualizada" }));
    expect(response.status).toBe(200);
    const actual = await response.json();
    const readback = await readGoal(id);
    expect(stableFields(readback)).toEqual({ ...stableFields(previous), name: "Viagem atualizada", description: expected, ...persisted });
    expect(actual).toEqual({ ...JSON.parse(JSON.stringify(readback)), account });
    expect(await readGoal(sentinel.id)).toEqual(sentinelBefore);
    expect(await db.account.findUniqueOrThrow({ where: { id: account.id } })).toEqual(accountBefore);
    expect(await db.transaction.count()).toBe(0);
  });

  test("editar a descrição preserva o saldo de depósitos e seu contrato de conclusão", async () => {
    const { id } = await createGoal();
    const accountBefore = await db.account.findUniqueOrThrow({ where: { id: account.id } });
    const first = await deposit(request("POST", { savingsGoalId: id, amount: 12.25, description: "Primeiro depósito" }, "/deposit"));
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ currentAmount: 22.25, depositAmount: 12.25, depositDescription: "Primeiro depósito", goalCompleted: false, account });

    const edit = await handlers.PUT(request("PUT", { id, description: null }));
    expect(edit.status).toBe(200);
    expect(await readGoal(id)).toMatchObject({ currentAmount: 22.25, description: "", isCompleted: false });

    const last = await deposit(request("POST", { savingsGoalId: id, amount: 27.75 }, "/deposit"));
    expect(last.status).toBe(200);
    expect(await last.json()).toMatchObject({ currentAmount: 50, depositAmount: 27.75, depositDescription: "Depósito", goalCompleted: true, account });
    const completed = await readGoal(id);
    expect(completed).toMatchObject({ currentAmount: 50, isCompleted: true, description: "" });
    const rejected = await deposit(request("POST", { savingsGoalId: id, amount: 1 }, "/deposit"));
    expect(rejected.status).toBe(400);
    expect(await readGoal(id)).toEqual(completed);
    expect(await db.account.findUniqueOrThrow({ where: { id: account.id } })).toEqual(accountBefore);
    expect(await db.transaction.count()).toBe(0);
  });
});
