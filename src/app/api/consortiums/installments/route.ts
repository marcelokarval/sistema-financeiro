import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

class ConsortiumDomainError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

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

    if (paidDate !== undefined && paidDate !== null && isNaN(new Date(paidDate).getTime())) {
      return NextResponse.json(
        { error: "Data de pagamento inválida" },
        { status: 400 }
      );
    }

    if (assemblyDate !== undefined && assemblyDate !== null && isNaN(new Date(assemblyDate).getTime())) {
      return NextResponse.json(
        { error: "Data da assembleia inválida" },
        { status: 400 }
      );
    }

    const result = await db.$transaction(async (tx) => {
      // Acquire write lock upfront in SQLite and guard against concurrent payments
      const claimed = await tx.consortiumInstallment.updateMany({
        where: { id: installmentId, status: { not: "PAID" } },
        data: {
          status: "PAID",
          paidDate: paidDate ? new Date(paidDate) : new Date(),
          ...(notes !== undefined && { notes: notes || "" }),
          ...(assemblyDate !== undefined && {
            assemblyDate: assemblyDate ? new Date(assemblyDate) : null,
          }),
          ...(assemblyResult !== undefined && { assemblyResult: assemblyResult || "" }),
        },
      });

      const installment = await tx.consortiumInstallment.findUnique({
        where: { id: installmentId },
        include: { consortium: true },
      });

      if (!installment) {
        throw new ConsortiumDomainError("Parcela não encontrada", 404);
      }

      if (claimed.count === 0) {
        throw new ConsortiumDomainError("Esta parcela já foi paga", 400);
      }

      const updatedConsortium = await tx.consortium.update({
        where: { id: installment.consortiumId },
        data: {
          paidInstallments: { increment: 1 },
          fundedAmount: { increment: installment.amount },
        },
      });

      const finalConsortium =
        updatedConsortium.paidInstallments >= updatedConsortium.installmentCount &&
        updatedConsortium.status !== "COMPLETED"
          ? await tx.consortium.update({
              where: { id: updatedConsortium.id },
              data: { status: "COMPLETED" },
            })
          : updatedConsortium;

      return {
        installment,
        consortium: finalConsortium,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ConsortiumDomainError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Erro ao pagar parcela do consórcio:", error);
    return NextResponse.json(
      { error: "Falha ao pagar parcela do consórcio" },
      { status: 500 }
    );
  }
}
