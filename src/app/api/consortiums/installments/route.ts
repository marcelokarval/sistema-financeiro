import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseJsonBodyLocalized } from "@/lib/api-validation";
import {
  apiErrorResponse,
  resolveRequestLocale,
  translateApiMessage,
} from "@/lib/server-i18n";

class ConsortiumDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

// GET /api/consortiums/installments - Listar parcelas de consórcio
export async function GET(request: NextRequest) {
  const locale = resolveRequestLocale(request);

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
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "crud.consortiums.installmentsFetchFailed"),
      500
    );
  }
}

// POST /api/consortiums/installments - Pagar parcela de consórcio
export async function POST(request: NextRequest) {
  const locale = resolveRequestLocale(request);

  try {
    const parsedBody = await parseJsonBodyLocalized(request, { locale });
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { installmentId, paidDate, notes, assemblyDate, assemblyResult } =
      parsedBody.data;
    const resolvedId = typeof installmentId === "string" ? installmentId.trim() : "";

    if (!resolvedId) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.consortiums.installmentIdRequired"),
        400
      );
    }

    if (
      paidDate !== undefined &&
      paidDate !== null &&
      ((typeof paidDate !== "string" && typeof paidDate !== "number") ||
        isNaN(new Date(paidDate).getTime()))
    ) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.consortiums.invalidPayDate"),
        400
      );
    }

    if (
      assemblyDate !== undefined &&
      assemblyDate !== null &&
      ((typeof assemblyDate !== "string" && typeof assemblyDate !== "number") ||
        isNaN(new Date(assemblyDate).getTime()))
    ) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.consortiums.invalidInstallmentAssemblyDate"),
        400
      );
    }

    const result = await db.$transaction(async (tx) => {
      // Acquire write lock upfront in SQLite and guard against concurrent payments
      const claimed = await tx.consortiumInstallment.updateMany({
        where: { id: resolvedId, status: { not: "PAID" } },
        data: {
          status: "PAID",
          paidDate: paidDate ? new Date(paidDate as string | number) : new Date(),
          ...(notes !== undefined && { notes: typeof notes === "string" ? notes : "" }),
          ...(assemblyDate !== undefined && {
            assemblyDate: assemblyDate ? new Date(assemblyDate as string | number) : null,
          }),
          ...(assemblyResult !== undefined && {
            assemblyResult: typeof assemblyResult === "string" ? assemblyResult : "",
          }),
        },
      });

      const installment = await tx.consortiumInstallment.findUnique({
        where: { id: resolvedId },
        include: { consortium: true },
      });

      if (!installment) {
        throw new ConsortiumDomainError(
          "NOT_FOUND",
          translateApiMessage(locale, "crud.consortiums.installmentNotFound"),
          404
        );
      }

      if (claimed.count === 0) {
        throw new ConsortiumDomainError(
          "ALREADY_PAID",
          translateApiMessage(locale, "crud.consortiums.installmentAlreadyPaid"),
          400
        );
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
      return apiErrorResponse(error.code, error.message, error.status);
    }
    console.error("Erro ao pagar parcela do consórcio:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "crud.consortiums.installmentPayFailed"),
      500
    );
  }
}
