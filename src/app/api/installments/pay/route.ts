import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseJsonBodyLocalized } from "@/lib/api-validation";
import {
  apiErrorResponse,
  resolveRequestLocale,
  translateApiMessage,
} from "@/lib/server-i18n";

class InstallmentPayError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

// POST /api/installments/pay - Pagar parcela individual
export async function POST(request: NextRequest) {
  const locale = resolveRequestLocale(request);

  try {
    const parsedBody = await parseJsonBodyLocalized(request, { locale });
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { installmentId, paidDate } = parsedBody.data;
    const resolvedId = typeof installmentId === "string" ? installmentId.trim() : "";

    if (!resolvedId) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.installments.payIdRequired"),
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
        translateApiMessage(locale, "crud.installments.payInvalidDate"),
        400
      );
    }

    const updatedInstallment = await db.$transaction(async (tx) => {
      // Acquire write lock upfront in SQLite and guard against concurrent payments
      const claimed = await tx.installment.updateMany({
        where: { id: resolvedId, status: { not: "PAID" } },
        data: {
          status: "PAID",
          paidDate: paidDate ? new Date(paidDate as string | number) : new Date(),
        },
      });

      const installment = await tx.installment.findUnique({
        where: { id: resolvedId },
        include: {
          installmentPlan: true,
        },
      });

      if (!installment) {
        throw new InstallmentPayError(
          "NOT_FOUND",
          translateApiMessage(locale, "crud.installments.installmentNotFound"),
          404
        );
      }

      if (installment.installmentPlan.status === "COMPLETED") {
        throw new InstallmentPayError(
          "PLAN_COMPLETED",
          translateApiMessage(locale, "crud.installments.planCompleted"),
          400
        );
      }

      if (claimed.count === 0) {
        throw new InstallmentPayError(
          "ALREADY_PAID",
          translateApiMessage(locale, "crud.installments.alreadyPaid"),
          400
        );
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
          ? translateApiMessage(locale, "crud.installments.paidAndCompleted")
          : translateApiMessage(locale, "crud.installments.paidSuccess"),
      installment: updatedInstallment.installment,
      plan: updatedInstallment.plan,
    });
  } catch (error) {
    if (error instanceof InstallmentPayError) {
      return apiErrorResponse(error.code, error.message, error.status);
    }
    console.error("Erro ao pagar parcela:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "crud.installments.payFailed"),
      500
    );
  }
}
