import { z } from "zod";

const installmentSchema = z.object({
  id: z.string().min(1),
  installmentPlanId: z.string().min(1),
  number: z.number().int().positive(),
  dueDate: z.string(),
  paidDate: z.string().nullable(),
  amount: z.number(),
  status: z.enum(["PAID", "PENDING", "OVERDUE"]),
});

const planSchema = z.object({
  id: z.string().min(1),
  description: z.string(),
  type: z.string(),
  totalAmount: z.number(),
  installmentCount: z.number(),
  monthlyValue: z.number(),
  paidInstallments: z.number(),
  interestRate: z.number(),
  startDate: z.string(),
  status: z.string(),
  cardId: z.string().nullable(),
  categoryId: z.string().nullable(),
  card: z.object({ id: z.string(), name: z.string(), lastFourDigits: z.string().nullable() }).nullable().optional(),
  category: z.object({ id: z.string(), name: z.string(), color: z.string() }).nullable().optional(),
});

const detailSchema = planSchema.extend({ installments: z.array(installmentSchema) });
export type InstallmentPlan = z.infer<typeof planSchema> & { installments?: z.infer<typeof installmentSchema>[] };
type PlanIdentity = Pick<InstallmentPlan, "id" | "description">;
export type InstallmentSelection = null | (PlanIdentity & (
  | { phase: "loading" | "error" }
  | { phase: "ready"; detail: z.infer<typeof detailSchema> }
));

export function createInstallmentSelection(
  publish: (state: InstallmentSelection) => void,
  request: (url: string) => Promise<Response> = (url) => fetch(url),
) {
  let current: InstallmentSelection = null;

  function commit(state: InstallmentSelection) {
    current = state;
    publish(state);
  }

  async function open({ id, description }: PlanIdentity) {
    // A nova referência troca a geração, inclusive em A → B → A.
    const pending = { phase: "loading", id, description } as const;
    commit(pending);

    try {
      const response = await request(`/api/installments?id=${encodeURIComponent(id)}`);
      if (current !== pending) return;
      if (!response.ok) throw new Error("Falha ao consultar plano");

      const parsed = detailSchema.safeParse(await response.json());
      if (current !== pending) return;
      if (!parsed.success || parsed.data.id !== id ||
          parsed.data.installments.some((installment) => installment.installmentPlanId !== id)) {
        throw new Error("Detalhe incompatível com o plano selecionado");
      }

      commit({ phase: "ready", id, description: parsed.data.description, detail: parsed.data });
    } catch {
      if (current === pending) commit({ phase: "error", id, description });
    }
  }

  return {
    open,
    close(expected?: InstallmentSelection) {
      if (expected === undefined || current === expected) commit(null);
    },
    refresh(expected: InstallmentSelection) {
      // O pagamento muda o plano por ID, mesmo se ele foi reaberto durante o envio.
      if (expected?.phase === "ready" && current?.id === expected.id) return open(current);
    },
    paymentTarget(expected: InstallmentSelection, installmentId: string) {
      if (expected?.phase !== "ready" || current !== expected) return null;
      return expected.detail.installments.find((installment) =>
        installment.id === installmentId && installment.installmentPlanId === expected.id && installment.status !== "PAID",
      )?.id ?? null;
    },
  };
}
