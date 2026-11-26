import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

describe("POST, PUT e DELETE /api/accounts - validação JSON e domínio", () => {
  let tempDir: string;
  let localDb: PrismaClient;
  let POST: typeof import("./route").POST;
  let PUT: typeof import("./route").PUT;
  let DELETE: typeof import("./route").DELETE;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "accounts-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    localDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

    await localDb.$executeRawUnsafe(
      `CREATE TABLE "Account" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'CASH', "balance" REAL NOT NULL DEFAULT 0, "color" TEXT NOT NULL DEFAULT '#6366f1', "icon" TEXT NOT NULL DEFAULT 'wallet', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    );

    mock.module("@/lib/db", () => ({ db: localDb }));
    ({ POST, PUT, DELETE } = await import("./route"));
  });

  beforeEach(async () => {
    await localDb.account.deleteMany();
    await localDb.account.create({
      data: { id: "acc-1", name: "Conta Principal", type: "BANK", balance: 500 },
    });
  });

  afterAll(async () => {
    await localDb?.$disconnect();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  test("POST, PUT e DELETE retornam HTTP 400 para JSON malformado ou não-objeto", async () => {
    for (const raw of ["{invalido", "", "[]"]) {
      const postRes = await POST(new NextRequest("http://localhost/api/accounts", { method: "POST", body: raw }));
      const putRes = await PUT(new NextRequest("http://localhost/api/accounts", { method: "PUT", body: raw }));
      const delRes = await DELETE(new NextRequest("http://localhost/api/accounts", { method: "DELETE", body: raw }));
      expect(postRes.status).toBe(400);
      expect(putRes.status).toBe(400);
      expect(delRes.status).toBe(400);
    }
  });

  test("POST e PUT rejeitam nome vazio, tipo inválido e balance não finito com HTTP 400", async () => {
    for (const payload of [
      { name: "   ", type: "CASH", balance: 100 },
      { name: "Conta", type: "INVALIDO", balance: 100 },
      { name: "Conta", type: "CASH", balance: "NaN" },
      { name: "Conta", type: "CASH", balance: "Infinity" },
      { name: "Conta", type: "CASH", balance: true },
    ]) {
      const postRes = await POST(
        new NextRequest("http://localhost/api/accounts", { method: "POST", body: JSON.stringify(payload) })
      );
      expect(postRes.status).toBe(400);
    }

    for (const payload of [
      { id: "acc-1", name: "   " },
      { id: "acc-1", type: "INVALIDO" },
      { id: "acc-1", balance: "NaN" },
      { id: "acc-1", balance: "Infinity" },
      { id: "acc-1", balance: null },
    ]) {
      const putRes = await PUT(
        new NextRequest("http://localhost/api/accounts", { method: "PUT", body: JSON.stringify(payload) })
      );
      expect(putRes.status).toBe(400);
    }

    const acc = await localDb.account.findUniqueOrThrow({ where: { id: "acc-1" } });
    expect(acc.name).toBe("Conta Principal");
    expect(acc.balance).toBe(500);
  });

  test("PUT atualiza conta válida e retorna 404 para conta inexistente", async () => {
    const missing = await PUT(
      new NextRequest("http://localhost/api/accounts", {
        method: "PUT",
        body: JSON.stringify({ id: "acc-missing", name: "Nova" }),
      })
    );
    expect(missing.status).toBe(404);

    const ok = await PUT(
      new NextRequest("http://localhost/api/accounts", {
        method: "PUT",
        body: JSON.stringify({ id: "acc-1", name: "  Conta Atualizada  ", type: "DIGITAL_WALLET", balance: -25.5 }),
      })
    );
    expect(ok.status).toBe(200);
    const updated = await localDb.account.findUniqueOrThrow({ where: { id: "acc-1" } });
    expect(updated.name).toBe("Conta Atualizada");
    expect(updated.type).toBe("DIGITAL_WALLET");
    expect(updated.balance).toBe(-25.5);
  });

  test("retorna erros e mensagens localizadas com code e X-Error-Code em pt, es e en", async () => {
    const ptErr = await POST(
      new NextRequest("http://localhost/api/accounts", {
        method: "POST",
        body: JSON.stringify({ name: " " }),
      })
    );
    expect(ptErr.status).toBe(400);
    expect(ptErr.headers.get("X-Error-Code")).toBe("VALIDATION_ERROR");
    expect(await ptErr.json()).toEqual({
      error: "Nome da conta é obrigatório",
      code: "VALIDATION_ERROR",
    });

    const esJsonErr = await POST(
      new NextRequest("http://localhost/api/accounts?locale=es", {
        method: "POST",
        body: "{bad",
      })
    );
    expect(esJsonErr.status).toBe(400);
    expect(esJsonErr.headers.get("X-Error-Code")).toBe("INVALID_JSON");
    expect(await esJsonErr.json()).toEqual({
      error: "Cuerpo de la solicitud JSON inválido.",
      code: "INVALID_JSON",
    });

    const enMissing = await PUT(
      new NextRequest("http://localhost/api/accounts?locale=en", {
        method: "PUT",
        body: JSON.stringify({ id: "acc-missing", name: "Updated" }),
      })
    );
    expect(enMissing.status).toBe(404);
    expect(enMissing.headers.get("X-Error-Code")).toBe("NOT_FOUND");
    expect(await enMissing.json()).toEqual({
      error: "Account not found",
      code: "NOT_FOUND",
    });

    const esDel = await DELETE(
      new NextRequest("http://localhost/api/accounts?locale=es", {
        method: "DELETE",
        body: JSON.stringify({ id: "acc-1" }),
      })
    );
    expect(esDel.status).toBe(200);
    expect(await esDel.json()).toEqual({
      success: true,
      message: "Cuenta eliminada correctamente",
    });
  });
});
