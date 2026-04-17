import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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

    const installment = await db.installment.findUnique({
      where: { id: installmentId },
      include: {
        installmentPlan: true,
      },
    });

    if (!installment) {
      return NextResponse.json(
        { error: "Parcela não encontrada" },
        { status: 404 }
      );
    }

    if (installment.status === "PAID") {
      return NextResponse.json(
        { error: "Esta parcela já foi paga" },
        { status: 400 }
      );
    }

    if (installment.installmentPlan.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Este plano de parcelamento já foi concluído" },
        { status: 400 }
      );
    }

    const updatedInstallment = await db.$transaction(async (tx) => {
      // Marcar parcela como paga
      const paid = await tx.installment.update({
        where: { id: installmentId },
        data: {
          status: "PAID",
          paidDate: paidDate ? new Date(paidDate) : new Date(),
        },
      });

      // Incrementar paidInstallments do plano
      const newPaidCount = installment.installmentPlan.paidInstallments + 1;

      const updatedPlan = await tx.installmentPlan.update({
        where: { id: installment.installmentPlanId },
        data: {
          paidInstallments: newPaidCount,
          // Se todas as parcelas foram pagas, marcar como concluído
          ...(newPaidCount >= installment.installmentPlan.installmentCount
            ? { status: "COMPLETED" }
            : {}),
        },
      });

      return { installment: paid, plan: updatedPlan };
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
    console.error("Erro ao pagar parcela:", error);
    return NextResponse.json(
      { error: "Erro ao pagar parcela" },
      { status: 500 }
    );
  }
}
