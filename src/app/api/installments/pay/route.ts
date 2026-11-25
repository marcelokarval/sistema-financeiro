import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

class InstallmentPayError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

// POST /api/installments/pay - Pagar parcela individual
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { installmentId, paidDate } = body;

    if (!installmentId) {
      return NextResponse.json(
        { error: "ID da parcela é obrigatório" },
        { status: 400 }
      );
    }

    if (paidDate !== undefined && paidDate !== null && isNaN(new Date(paidDate).getTime())) {
      return NextResponse.json(
        { error: "Data de pagamento inválida" },
        { status: 400 }
      );
    }

    const updatedInstallment = await db.$transaction(async (tx) => {
      // Acquire write lock upfront in SQLite and guard against concurrent payments
      const claimed = await tx.installment.updateMany({
        where: { id: installmentId, status: { not: "PAID" } },
        data: {
          status: "PAID",
          paidDate: paidDate ? new Date(paidDate) : new Date(),
        },
      });

      const installment = await tx.installment.findUnique({
        where: { id: installmentId },
        include: {
          installmentPlan: true,
        },
      });

      if (!installment) {
        throw new InstallmentPayError("Parcela não encontrada", 404);
      }

      if (installment.installmentPlan.status === "COMPLETED") {
        throw new InstallmentPayError("Este plano de parcelamento já foi concluído", 400);
      }

      if (claimed.count === 0) {
        throw new InstallmentPayError("Esta parcela já foi paga", 400);
      }

      const updatedPlan = await tx.installmentPlan.update({
        where: { id: installment.installmentPlanId },
        data: {
          paidInstallments: { increment: 1 },
        },
      });

      const finalPlan =
        updatedPlan.paidInstallments >= updatedPlan.installmentCount &&
        updatedPlan.status !== "COMPLETED"
          ? await tx.installmentPlan.update({
              where: { id: updatedPlan.id },
              data: { status: "COMPLETED" },
            })
          : updatedPlan;

      return { installment, plan: finalPlan };
    });

    return NextResponse.json({
      message:
        updatedInstallment.plan.status === "COMPLETED"
          ? "Parcela paga com sucesso! Plano de parcelamento concluído."
          : "Parcela paga com sucesso",
      installment: updatedInstallment.installment,
      plan: updatedInstallment.plan,
    });
  } catch (error) {
    if (error instanceof InstallmentPayError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Erro ao pagar parcela:", error);
    return NextResponse.json(
      { error: "Erro ao pagar parcela" },
      { status: 500 }
    );
  }
}
