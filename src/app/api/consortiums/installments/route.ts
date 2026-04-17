import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/consortiums/installments - Listar parcelas de consórcio
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const consortiumId = searchParams.get("consortiumId");

    const installments = await db.consortiumInstallment.findMany({
      where: {
        ...(consortiumId && { consortiumId }),
      },
      orderBy: { number: "asc" },
      include: {
        consortium: {
          select: { id: true, description: true, status: true },
        },
      },
    });

    return NextResponse.json(installments);
  } catch (error) {
    console.error("Erro ao buscar parcelas do consórcio:", error);
    return NextResponse.json(
      { error: "Falha ao buscar parcelas do consórcio" },
      { status: 500 }
    );
  }
}

// POST /api/consortiums/installments - Pagar parcela de consórcio
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { installmentId, paidDate, notes, assemblyDate, assemblyResult } = body;

    if (!installmentId) {
      return NextResponse.json(
        { error: "ID da parcela é obrigatório" },
        { status: 400 }
      );
    }

    const installment = await db.consortiumInstallment.findUnique({
      where: { id: installmentId },
      include: { consortium: true },
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

    // Atualizar a parcela como paga
    const updatedInstallment = await db.consortiumInstallment.update({
      where: { id: installmentId },
      data: {
        status: "PAID",
        paidDate: paidDate ? new Date(paidDate) : new Date(),
        ...(notes !== undefined && { notes: notes || "" }),
        ...(assemblyDate !== undefined && { assemblyDate: assemblyDate ? new Date(assemblyDate) : null }),
        ...(assemblyResult !== undefined && { assemblyResult: assemblyResult || "" }),
      },
    });

    // Atualizar o consórcio: incrementar paidInstallments e fundedAmount
    const newPaidInstallments = installment.consortium.paidInstallments + 1;
    const newFundedAmount = installment.consortium.fundedAmount + installment.amount;

    const allPaid = newPaidInstallments >= installment.consortium.installmentCount;

    const updatedConsortium = await db.consortium.update({
      where: { id: installment.consortium.id },
      data: {
        paidInstallments: newPaidInstallments,
        fundedAmount: newFundedAmount,
        ...(allPaid && { status: "COMPLETED" }),
      },
    });

    return NextResponse.json({
      installment: updatedInstallment,
      consortium: updatedConsortium,
    });
  } catch (error) {
    console.error("Erro ao pagar parcela do consórcio:", error);
    return NextResponse.json(
      { error: "Falha ao pagar parcela do consórcio" },
      { status: 500 }
    );
  }
}
