import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

describe("POST, PUT e DELETE /api/categories - validação JSON e domínio", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let POST: typeof import("./route").POST;
  let PUT: typeof import("./route").PUT;
  let DELETE: typeof import("./route").DELETE;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "categories-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    await localDb.$executeRawUnsafe(
      `CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "icon" TEXT NOT NULL DEFAULT 'tag', "type" TEXT NOT NULL DEFAULT 'EXPENSE', "color" TEXT NOT NULL DEFAULT '#6b7280', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    );

    mock.module("@/lib/db", () => ({ db: localDb }));
    ({ POST, PUT, DELETE } = await import("./route"));
  });

  beforeEach(async () => {
    await localDb.category.deleteMany();
    await localDb.category.create({
      data: { id: "cat-1", name: "Moradia", type: "EXPENSE" },
    });
  });

  afterAll(async () => {
    await localDb?.$disconnect();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test("POST, PUT e DELETE retornam HTTP 400 para JSON malformado", async () => {
    for (const raw of ["{invalido", "", "[]"]) {
      expect((await POST(new NextRequest("http://localhost/api/categories", { method: "POST", body: raw }))).status).toBe(400);
      expect((await PUT(new NextRequest("http://localhost/api/categories", { method: "PUT", body: raw }))).status).toBe(400);
      expect((await DELETE(new NextRequest("http://localhost/api/categories", { method: "DELETE", body: raw }))).status).toBe(400);
    }
  });

  test("POST e PUT rejeitam nome vazio e type inválido com HTTP 400", async () => {
    for (const payload of [
      { name: "   ", type: "EXPENSE" },
      { name: "Salário", type: "INVALIDO" },
    ]) {
      const res = await POST(
        new NextRequest("http://localhost/api/categories", { method: "POST", body: JSON.stringify(payload) })
      );
      expect(res.status).toBe(400);
    }

    for (const payload of [
      { id: "cat-1", name: "   " },
      { id: "cat-1", type: "TRANSFER" },
      { id: "cat-1", isActive: "true" },
    ]) {
      const res = await PUT(
        new NextRequest("http://localhost/api/categories", { method: "PUT", body: JSON.stringify(payload) })
      );
      expect(res.status).toBe(400);
    }

    const cat = await localDb.category.findUniqueOrThrow({ where: { id: "cat-1" } });
    expect(cat.name).toBe("Moradia");
  });

  test("PUT atualiza categoria válida e retorna 404 para categoria inexistente", async () => {
    const missing = await PUT(
      new NextRequest("http://localhost/api/categories", {
        method: "PUT",
        body: JSON.stringify({ id: "cat-missing", name: "Nova" }),
      })
    );
    expect(missing.status).toBe(404);

    const ok = await PUT(
      new NextRequest("http://localhost/api/categories", {
        method: "PUT",
        body: JSON.stringify({ id: "cat-1", name: "  Aluguel  ", type: "EXPENSE" }),
      })
    );
    expect(ok.status).toBe(200);
    const updated = await localDb.category.findUniqueOrThrow({ where: { id: "cat-1" } });
    expect(updated.name).toBe("Aluguel");
  });
});
