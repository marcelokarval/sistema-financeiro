/// <reference types="bun-types" />

import { expect, mock, test } from "bun:test";
import { createInstallmentSelection, type InstallmentSelection } from "./installment-selection";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

const detail = (id: string) => ({
  id, description: `Plano ${id}`, type: "FINANCING", totalAmount: 30, installmentCount: 2,
  monthlyValue: 15, paidInstallments: 0, interestRate: 0, startDate: "2026-01-01T00:00:00.000Z",
  status: "ACTIVE", cardId: null, categoryId: null,
  installments: [
    { id: `${id}-1`, installmentPlanId: id, number: 1, amount: 15, status: "PENDING", dueDate: "2026-01-01T00:00:00.000Z", paidDate: null },
    { id: `${id}-2`, installmentPlanId: id, number: 2, amount: 15, status: "PAID", dueDate: "2026-02-01T00:00:00.000Z", paidDate: "2026-02-01T00:00:00.000Z" },
  ],
});

function harness() {
  let current: InstallmentSelection = null;
  const transport = mock((_url: string) => Promise.resolve(new Response()));
  const selection = createInstallmentSelection((state) => { current = state; }, transport);
  const open = (id: string) => selection.open({ id, description: `Plano ${id}` });
  return { selection, transport, open, current: () => current };
}

test("A → B → A ignora sucesso e erro obsoletos, mesmo com ID reaberto", async () => {
  const { selection, transport, current, open } = harness();
  const a = deferred<Response>();
  const b = deferred<Response>();
  transport.mockImplementationOnce(() => a.promise).mockImplementationOnce(() => b.promise).mockResolvedValueOnce(Response.json(detail("A")));
  const oldA = open("A");
  const oldB = open("B");
  await open("A");
  const ready = current();
  expect(ready).toMatchObject({ phase: "ready", detail: detail("A") });
  b.reject(new Error("offline"));
  a.resolve(Response.json({ ...detail("A"), description: "Resposta original de A" }));
  await Promise.all([oldA, oldB]);
  expect(current()).toBe(ready);
  expect(selection.paymentTarget(ready, "A-1")).toBe("A-1");
  expect(selection.paymentTarget(ready, "B-1")).toBeNull();
  expect(selection.paymentTarget(ready, "A-2")).toBeNull();
  selection.close();
  expect(selection.paymentTarget(ready, "A-1")).toBeNull();
});

test("fechar durante GET impede a publicação tardia", async () => {
  const { selection, transport, current, open } = harness();
  const request = deferred<Response>();
  transport.mockImplementationOnce(() => request.promise);
  const pending = open("A");
  expect(selection.paymentTarget(current(), "A-1")).toBeNull();
  selection.close();
  request.resolve(Response.json(detail("A")));
  await pending;
  expect(current()).toBeNull();
});

test.each([
  ["coleção", () => Promise.resolve(Response.json([detail("A")]))],
  ["outro ID", () => Promise.resolve(Response.json(detail("B")))],
  ["filho de outro plano", () => Promise.resolve(Response.json({ ...detail("A"), installments: detail("B").installments }))],
  ["detalhe sem filhos no payload", () => Promise.resolve(Response.json({ ...detail("A"), installments: undefined }))],
  ["erro HTTP", () => Promise.resolve(Response.json(detail("A"), { status: 404 }))],
  ["JSON inválido", () => Promise.resolve(new Response("html"))],
  ["erro de transporte", () => Promise.reject(new Error("offline"))],
] as const)("falha fechada em %s", async (_label, response) => {
  const { selection, transport, open, current } = harness();
  transport.mockImplementationOnce(response);
  await open("A");
  expect(current()).toEqual({ phase: "error", id: "A", description: "Plano A" });
  expect(selection.paymentTarget(current(), "A-1")).toBeNull();
});

test("refresh revalida a identidade e não deixa o detalhe anterior acionável em erro", async () => {
  const { selection, transport, open, current } = harness();
  const id = "A & ?";
  transport.mockResolvedValueOnce(Response.json(detail(id)));
  await open(id);
  const before = current();
  expect(selection.paymentTarget(before, `${id}-1`)).toBe(`${id}-1`);
  const pending = deferred<Response>();
  transport.mockImplementationOnce(() => pending.promise);
  const refreshing = selection.refresh(before);
  expect(current()).toMatchObject({ phase: "loading", id });
  expect(selection.paymentTarget(before, `${id}-1`)).toBeNull();
  pending.resolve(Response.json(detail("B")));
  await refreshing;
  expect(current()).toMatchObject({ phase: "error", id });
  expect(selection.paymentTarget(current(), `${id}-1`)).toBeNull();
  expect(transport.mock.calls).toEqual([["/api/installments?id=A%20%26%20%3F"], ["/api/installments?id=A%20%26%20%3F"]]);
});

test.each(["resolvido", "pendente"] as const)("pagamento de A atualiza A reaberto com GET pré-gravação %s", async (timing) => {
  const { selection, transport, open, current } = harness();
  const before = detail("A");
  const after = { ...before, paidInstallments: 1, installments: before.installments.map((installment) =>
    installment.id === "A-1" ? { ...installment, status: "PAID", paidDate: "2026-02-01T00:00:00.000Z" } : installment,
  ) };
  const preWriteGet = deferred<Response>();
  const postWriteGet = deferred<Response>();
  transport.mockResolvedValueOnce(Response.json(before))
    .mockImplementationOnce(() => preWriteGet.promise)
    .mockImplementationOnce(() => postWriteGet.promise);
  await open("A");
  const paying = current();
  expect(selection.paymentTarget(paying, "A-1")).toBe("A-1");

  selection.close();
  const reopened = open("A");
  if (timing === "resolvido") {
    preWriteGet.resolve(Response.json(before));
    await reopened;
    expect(selection.paymentTarget(current(), "A-1")).toBe("A-1");
  }

  // Mesma chamada da view quando o POST de A termina com sucesso.
  const refreshed = selection.refresh(paying);
  postWriteGet.resolve(Response.json(after));
  await refreshed;
  if (timing === "pendente") {
    preWriteGet.resolve(Response.json(before));
    await reopened;
  }

  expect(current()).toMatchObject({ phase: "ready", detail: after });
  expect(selection.paymentTarget(current(), "A-1")).toBeNull();
  expect(transport.mock.calls).toEqual(Array(3).fill(["/api/installments?id=A"]));
});

test("pagamento de A não reabre a seleção fechada", async () => {
  const { selection, transport, open, current } = harness();
  transport.mockResolvedValueOnce(Response.json(detail("A")));
  await open("A");
  const paying = current();
  selection.close();
  await selection.refresh(paying);
  expect(current()).toBeNull();
  expect(transport).toHaveBeenCalledTimes(1);
});

test("refresh de A não publica dados em B e preserva a nova seleção", async () => {
  const { selection, transport, open, current } = harness();
  const updated = { ...detail("A"), paidInstallments: 1 };
  transport.mockResolvedValueOnce(Response.json(detail("A"))).mockResolvedValueOnce(Response.json(updated));
  await open("A");
  const first = current();
  await selection.refresh(first);
  const paid = current();
  expect(paid).toMatchObject({ phase: "ready", detail: updated });
  expect(selection.paymentTarget(first, "A-1")).toBeNull();

  const late = deferred<Response>();
  transport.mockImplementationOnce(() => late.promise).mockResolvedValueOnce(Response.json(detail("B")));
  const refresh = selection.refresh(paid);
  await open("B");
  late.resolve(Response.json(updated));
  await refresh;
  await selection.refresh(paid);
  expect(current()).toMatchObject({ phase: "ready", detail: detail("B") });
  expect(transport).toHaveBeenCalledTimes(4);
});
