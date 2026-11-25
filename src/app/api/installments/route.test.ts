/// <reference types="bun-types" />

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { NextRequest } from "next/server";

// Run only with a new /tmp fixture provisioned inside an isolated bwrap.
const fixture = "/tmp/installments-d2.db";
const enabled = process.env.INSTALLMENTS_D2_SQLITE === "1";

describe.skipIf(!enabled)("GET /api/installments com SQLite descartável", () => {
  let db: typeof import("@/lib/db").db;
  let GET: typeof import("./route").GET;

  beforeAll(async () => {
    if (process.env.DATABASE_URL !== `file:${fixture}` || !existsSync(fixture)) {
      throw new Error("Fixture descartável não provisionada");
    }
    ({ db } = await import("@/lib/db"));
    expect(await db.$queryRaw<{ seq: bigint; name: string; file: string }[]>`PRAGMA database_list`)
      .toContainEqual({ seq: BigInt(0), name: "main", file: fixture });
    expect(await db.$queryRaw<{ foreign_keys: bigint }[]>`PRAGMA foreign_keys`)
      .toEqual([{ foreign_keys: BigInt(1) }]);
    expect(await db.installmentPlan.count()).toBe(0);
    expect(await db.installment.count()).toBe(0);
    ({ GET } = await import("./route"));

    await db.installmentPlan.create({ data: {
      id: "plan-a", description: "Plano A", totalAmount: 100, installmentCount: 2, monthlyValue: 50,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      installments: { create: [
        { id: "a-2", number: 2, amount: 50, dueDate: new Date("2026-02-15T00:00:00Z") },
        { id: "a-1", number: 1, amount: 50, dueDate: new Date("2026-01-15T00:00:00Z") },
      ] },
    } });
    await db.installmentPlan.create({ data: {
      id: "plan-b", description: "Plano B", status: "OVERDUE", totalAmount: 20, installmentCount: 1, monthlyValue: 20,
      createdAt: new Date("2026-01-02T00:00:00Z"),
      installments: { create: { id: "b-1", number: 1, amount: 20, dueDate: new Date("2026-01-20T00:00:00Z") } },
    } });
  });

  afterAll(async () => { await db?.$disconnect(); });

  const request = (query = "") => new NextRequest(`http://fixture.invalid/api/installments${query}`);

  test("preserva coleção em ordem de criação, contagem, relações e filtro existente", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    const collection = await response.json();
    expect(collection.map((plan: { id: string }) => plan.id)).toEqual(["plan-b", "plan-a"]);
    expect(collection[1]).toMatchObject({ status: "ACTIVE", _count: { installments: 2 }, card: null, category: null });
    expect(collection[1]).not.toHaveProperty("installments");
    expect(await (await GET(request("?status=OVERDUE"))).json()).toEqual([collection[0]]);
  });

  test("retorna só o plano pedido e seus filhos em ordem numérica, mesmo com status na URL", async () => {
    const response = await GET(request("?id=plan-a&status=OVERDUE"));
    expect(response.status).toBe(200);
    const detail = await response.json();
    expect(Array.isArray(detail)).toBe(false);
    expect(detail).toMatchObject({ id: "plan-a", description: "Plano A" });
    expect(detail.installments.map(({ id, number, installmentPlanId }: { id: string; number: number; installmentPlanId: string }) => [id, number, installmentPlanId])).toEqual([
      ["a-1", 1, "plan-a"], ["a-2", 2, "plan-a"],
    ]);
  });

  test.each(["inexistente", ""])("responde 404 para id presente na URL e sem plano: %s", async (id) => {
    const response = await GET(request(`?id=${id}`));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Plano de parcelamento não encontrado" });
  });
});
