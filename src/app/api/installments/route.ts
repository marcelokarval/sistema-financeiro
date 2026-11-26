import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  mapPrismaErrorLocalized,
  parseCivilDateStart,
  parseFiniteNumber,
  parseJsonBodyLocalized,
  parsePositiveFiniteNumber,
} from "@/lib/api-validation";
import {
  apiErrorResponse,
  apiSuccessMessage,
  hasExplicitLocaleSignal,
  resolveRequestLocale,
  translateApiMessage,
  type SupportedLocale,
} from "@/lib/server-i18n";

const VALID_INSTALLMENT_TYPES = [
  "FINANCING",
  "CARD_INSTALLMENT",
  "LOAN",
  "PERSONAL",
  "RENTAL",
] as const;

const VALID_INSTALLMENT_STATUSES = [
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
  "OVERDUE",
] as const;

function parseOptionalId(
  value: unknown
): { valid: true; value: string | null } | { valid: false } {
  if (value === undefined || value === null) {
    return { valid: true, value: null };
  }
  if (typeof value !== "string") {
    return { valid: false };
  }
  const trimmed = value.trim();
  return { valid: true, value: trimmed || null };
}

async function validateInstallmentRelations(
  ids: {
    cardId?: string | null;
    accountId?: string | null;
    categoryId?: string | null;
  },
  locale: SupportedLocale
): Promise<NextResponse | null> {
  if (ids.cardId) {
    const card = await db.card.findUnique({
      where: { id: ids.cardId },
      select: { id: true },
    });
    if (!card) {
      return apiErrorResponse(
        "FOREIGN_KEY_ERROR",
        translateApiMessage(locale, "crud.cards.notFound"),
        400
      );
    }
  }
  if (ids.accountId) {
    const account = await db.account.findUnique({
      where: { id: ids.accountId },
      select: { id: true },
    });
    if (!account) {
      return apiErrorResponse(
        "FOREIGN_KEY_ERROR",
        translateApiMessage(locale, "crud.accounts.notFound"),
        400
      );
    }
  }
  if (ids.categoryId) {
    const category = await db.category.findUnique({
      where: { id: ids.categoryId },
      select: { id: true },
    });
    if (!category) {
      return apiErrorResponse(
        "FOREIGN_KEY_ERROR",
        translateApiMessage(locale, "crud.categories.notFound"),
        400
      );
    }
  }
  return null;
}

// GET /api/installments - Listar planos ou consultar o detalhe pelo ID
export async function GET(request: NextRequest) {
  const locale = resolveRequestLocale(request);
  const explicitLocale = hasExplicitLocaleSignal(request);

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id !== null) {
      const plan = await db.installmentPlan.findUnique({
        where: { id },
        include: { installments: { orderBy: { number: "asc" } } },
      });

      if (!plan) {
        return apiErrorResponse(
          "NOT_FOUND",
          explicitLocale
            ? translateApiMessage(locale, "crud.installments.notFound")
            : "Plano de parcelamento não encontrado",
          404,
          { includeCode: explicitLocale }
        );
      }

      return NextResponse.json(plan);
    }

    const status = searchParams.get("status");

    const where = status ? { status } : {};

    const plans = await db.installmentPlan.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { installments: true },
        },
        card: {
          select: { id: true, name: true, lastFourDigits: true },
        },
        category: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    return NextResponse.json(plans);
  } catch (error) {
    console.error("Erro ao buscar planos de parcelamento:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "crud.installments.fetchFailed"),
      500
    );
  }
}

// POST /api/installments - Criar plano de parcelamento
export async function POST(request: NextRequest) {
  const locale = resolveRequestLocale(request);

  try {
    const parsedBody = await parseJsonBodyLocalized(request, { locale });
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const {
      description,
      totalAmount,
      installmentCount,
      monthlyValue,
      interestRate,
      startDate,
      type,
      cardId,
      accountId,
      categoryId,
    } = parsedBody.data;

    if (typeof description !== "string" || description.trim() === "") {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.installments.descriptionRequired"),
        400
      );
    }

    const parsedTotalAmount = parsePositiveFiniteNumber(totalAmount);
    if (parsedTotalAmount === null) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.installments.totalPositive"),
        400
      );
    }

    const parsedInstallmentCount = parsePositiveFiniteNumber(installmentCount);
    if (parsedInstallmentCount === null || !Number.isInteger(parsedInstallmentCount)) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.installments.countInvalid"),
        400
      );
    }

    let calculatedMonthlyValue: number;
    if (monthlyValue !== undefined && monthlyValue !== null) {
      const parsedMonthly = parsePositiveFiniteNumber(monthlyValue);
      if (parsedMonthly === null) {
        return apiErrorResponse(
          "VALIDATION_ERROR",
          translateApiMessage(locale, "crud.installments.monthlyPositive"),
          400
        );
      }
      calculatedMonthlyValue = parsedMonthly;
    } else {
      calculatedMonthlyValue =
        Math.ceil((parsedTotalAmount / parsedInstallmentCount) * 100) / 100;
    }

    const parsedInterestRate =
      interestRate === undefined || interestRate === null
        ? 0
        : parseFiniteNumber(interestRate);
    if (parsedInterestRate === null || parsedInterestRate < 0) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.installments.invalidInterestRate"),
        400
      );
    }

    let planStartDate = new Date();
    if (startDate !== undefined && startDate !== null && startDate !== "") {
      if (typeof startDate !== "string" || parseCivilDateStart(startDate) === null) {
        return apiErrorResponse(
          "VALIDATION_ERROR",
          translateApiMessage(locale, "crud.installments.invalidStartDate"),
          400
        );
      }
      planStartDate = new Date(startDate);
    }

    const resolvedType =
      type === undefined || type === null || type === "" ? "FINANCING" : type;
    if (
      typeof resolvedType !== "string" ||
      !VALID_INSTALLMENT_TYPES.includes(
        resolvedType as (typeof VALID_INSTALLMENT_TYPES)[number]
      )
    ) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.installments.invalidType"),
        400
      );
    }

    const parsedCardId = parseOptionalId(cardId);
    const parsedAccountId = parseOptionalId(accountId);
    const parsedCategoryId = parseOptionalId(categoryId);
    if (!parsedCardId.valid || !parsedAccountId.valid || !parsedCategoryId.valid) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "validation.invalidLinkId"),
        400
      );
    }

    const relationError = await validateInstallmentRelations(
      {
        cardId: parsedCardId.value,
        accountId: parsedAccountId.value,
        categoryId: parsedCategoryId.value,
      },
      locale
    );
    if (relationError) {
      return relationError;
    }

    const plan = await db.$transaction(async (tx) => {
      const newPlan = await tx.installmentPlan.create({
        data: {
          description: description.trim(),
          totalAmount: parsedTotalAmount,
          installmentCount: parsedInstallmentCount,
          paidInstallments: 0,
          monthlyValue: calculatedMonthlyValue,
          interestRate: parsedInterestRate,
          startDate: planStartDate,
          type: resolvedType,
          status: "ACTIVE",
          cardId: parsedCardId.value,
          accountId: parsedAccountId.value,
          categoryId: parsedCategoryId.value,
        },
      });

      // Gerar parcelas individuais
      const installmentsData: Prisma.InstallmentCreateManyInput[] = [];
      for (let i = 1; i <= parsedInstallmentCount; i++) {
        const dueDate = new Date(planStartDate);
        dueDate.setMonth(dueDate.getMonth() + (i - 1));

        installmentsData.push({
          number: i,
          amount: calculatedMonthlyValue,
          dueDate,
          status: "PENDING",
          notes: "",
          installmentPlanId: newPlan.id,
        });
      }

      await tx.installment.createMany({
        data: installmentsData,
      });

      return newPlan;
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    const mapped = mapPrismaErrorLocalized(error, locale);
    if (mapped) return mapped;
    console.error("Erro ao criar plano de parcelamento:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "crud.installments.createFailed"),
      500
    );
  }
}

// PUT /api/installments - Atualizar plano de parcelamento
export async function PUT(request: NextRequest) {
  const locale = resolveRequestLocale(request);

  try {
    const parsedBody = await parseJsonBodyLocalized(request, { locale });
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const {
      id,
      description,
      totalAmount,
      installmentCount,
      monthlyValue,
      interestRate,
      startDate,
      type,
      status,
      cardId,
      accountId,
      categoryId,
      isActive,
      paidInstallments,
    } = parsedBody.data;

    if (typeof id !== "string" || id.trim() === "") {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.installments.idRequired"),
        400
      );
    }

    if (description !== undefined && (typeof description !== "string" || description.trim() === "")) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.installments.descriptionRequired"),
        400
      );
    }

    const parsedTotalAmount =
      totalAmount !== undefined ? parsePositiveFiniteNumber(totalAmount) : undefined;
    if (totalAmount !== undefined && parsedTotalAmount === null) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.installments.totalPositiveUpdate"),
        400
      );
    }

    const parsedInstallmentCount =
      installmentCount !== undefined ? parsePositiveFiniteNumber(installmentCount) : undefined;
    if (
      installmentCount !== undefined &&
      (parsedInstallmentCount === null || !Number.isInteger(parsedInstallmentCount))
    ) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.installments.countInvalid"),
        400
      );
    }

    const parsedMonthlyValue =
      monthlyValue !== undefined ? parsePositiveFiniteNumber(monthlyValue) : undefined;
    if (monthlyValue !== undefined && parsedMonthlyValue === null) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.installments.monthlyPositive"),
        400
      );
    }

    const parsedInterestRate =
      interestRate !== undefined ? parseFiniteNumber(interestRate) : undefined;
    if (
      parsedInterestRate !== undefined &&
      (parsedInterestRate === null || parsedInterestRate < 0)
    ) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.installments.invalidInterestRate"),
        400
      );
    }

    let resolvedStartDate: Date | undefined;
    if (startDate !== undefined) {
      if (typeof startDate !== "string" || parseCivilDateStart(startDate) === null) {
        return apiErrorResponse(
          "VALIDATION_ERROR",
          translateApiMessage(locale, "crud.installments.invalidStartDate"),
          400
        );
      }
      resolvedStartDate = new Date(startDate);
    }

    if (
      type !== undefined &&
      (typeof type !== "string" ||
        !VALID_INSTALLMENT_TYPES.includes(type as (typeof VALID_INSTALLMENT_TYPES)[number]))
    ) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.installments.invalidType"),
        400
      );
    }

    if (
      status !== undefined &&
      (typeof status !== "string" ||
        !VALID_INSTALLMENT_STATUSES.includes(
          status as (typeof VALID_INSTALLMENT_STATUSES)[number]
        ))
    ) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.installments.invalidStatus"),
        400
      );
    }

    if (isActive !== undefined && typeof isActive !== "boolean") {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "validation.invalidActiveFlag"),
        400
      );
    }

    if (
      paidInstallments !== undefined &&
      (typeof paidInstallments !== "number" ||
        !Number.isInteger(paidInstallments) ||
        paidInstallments < 0)
    ) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.installments.invalidPaidCount"),
        400
      );
    }

    const parsedCardId = cardId !== undefined ? parseOptionalId(cardId) : undefined;
    const parsedAccountId = accountId !== undefined ? parseOptionalId(accountId) : undefined;
    const parsedCategoryId = categoryId !== undefined ? parseOptionalId(categoryId) : undefined;
    if (
      (parsedCardId && !parsedCardId.valid) ||
      (parsedAccountId && !parsedAccountId.valid) ||
      (parsedCategoryId && !parsedCategoryId.valid)
    ) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "validation.invalidLinkId"),
        400
      );
    }

    const existingPlan = await db.installmentPlan.findUnique({
      where: { id },
      include: {
        installments: {
          orderBy: { number: "asc" },
        },
      },
    });

    if (!existingPlan) {
      return apiErrorResponse(
        "NOT_FOUND",
        translateApiMessage(locale, "crud.installments.notFound"),
        404
      );
    }

    const effectiveInstallmentCount =
      parsedInstallmentCount ?? existingPlan.installmentCount;
    if (
      typeof paidInstallments === "number" &&
      paidInstallments > effectiveInstallmentCount
    ) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.installments.paidExceedsTotal"),
        400
      );
    }

    const relationError = await validateInstallmentRelations(
      {
        cardId: parsedCardId && parsedCardId.valid ? parsedCardId.value : null,
        accountId: parsedAccountId && parsedAccountId.valid ? parsedAccountId.value : null,
        categoryId: parsedCategoryId && parsedCategoryId.valid ? parsedCategoryId.value : null,
      },
      locale
    );
    if (relationError) {
      return relationError;
    }

    const plan = await db.$transaction(async (tx) => {
      // Se paidInstallments foi alterado, atualizar o status das parcelas
      if (
        typeof paidInstallments === "number" &&
        paidInstallments !== existingPlan.paidInstallments
      ) {
        const oldPaid = existingPlan.paidInstallments;
        const newPaid = paidInstallments;

        if (newPaid > oldPaid) {
          // Marcar parcelas como pagas (do oldPaid+1 até newPaid)
          for (let i = oldPaid + 1; i <= newPaid && i <= existingPlan.installments.length; i++) {
            const installment = existingPlan.installments[i - 1];
            if (installment && installment.status !== "PAID") {
              await tx.installment.update({
                where: { id: installment.id },
                data: {
                  status: "PAID",
                  paidDate: new Date(),
                },
              });
            }
          }
        } else if (newPaid < oldPaid) {
          // Desmarcar parcelas (do oldPaid até newPaid+1)
          for (let i = oldPaid; i > newPaid && i >= 1; i--) {
            const installment = existingPlan.installments[i - 1];
            if (installment && installment.status === "PAID") {
              await tx.installment.update({
                where: { id: installment.id },
                data: {
                  status: "PENDING",
                  paidDate: null,
                },
              });
            }
          }
        }
      }

      const updatedPlan = await tx.installmentPlan.update({
        where: { id },
        data: {
          ...(typeof description === "string" && { description: description.trim() }),
          ...(parsedTotalAmount !== undefined &&
            parsedTotalAmount !== null && { totalAmount: parsedTotalAmount }),
          ...(parsedInstallmentCount !== undefined &&
            parsedInstallmentCount !== null && {
              installmentCount: parsedInstallmentCount,
            }),
          ...(parsedMonthlyValue !== undefined &&
            parsedMonthlyValue !== null && { monthlyValue: parsedMonthlyValue }),
          ...(parsedInterestRate !== undefined &&
            parsedInterestRate !== null && { interestRate: parsedInterestRate }),
          ...(resolvedStartDate !== undefined && { startDate: resolvedStartDate }),
          ...(typeof type === "string" && { type }),
          ...(typeof status === "string" && { status }),
          ...(parsedCardId && parsedCardId.valid && { cardId: parsedCardId.value }),
          ...(parsedAccountId && parsedAccountId.valid && { accountId: parsedAccountId.value }),
          ...(parsedCategoryId && parsedCategoryId.valid && { categoryId: parsedCategoryId.value }),
          ...(typeof isActive === "boolean" && { isActive }),
          ...(typeof paidInstallments === "number" && { paidInstallments }),
        },
      });

      return updatedPlan;
    });

    return NextResponse.json(plan);
  } catch (error) {
    const mapped = mapPrismaErrorLocalized(error, locale, {
      notFound: translateApiMessage(locale, "crud.installments.notFound"),
    });
    if (mapped) return mapped;
    console.error("Erro ao atualizar plano de parcelamento:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "crud.installments.updateFailed"),
      500
    );
  }
}

// DELETE /api/installments - Excluir plano de parcelamento
export async function DELETE(request: NextRequest) {
  const locale = resolveRequestLocale(request);

  try {
    const parsedBody = await parseJsonBodyLocalized(request, { locale });
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { id } = parsedBody.data;

    if (typeof id !== "string" || id.trim() === "") {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.installments.idRequired"),
        400
      );
    }

    const existing = await db.installmentPlan.findUnique({ where: { id } });
    if (!existing) {
      return apiErrorResponse(
        "NOT_FOUND",
        translateApiMessage(locale, "crud.installments.notFound"),
        404
      );
    }

    // Cascade delete remove as parcelas automaticamente
    await db.installmentPlan.delete({ where: { id } });

    return apiSuccessMessage(
      translateApiMessage(locale, "crud.installments.deleted")
    );
  } catch (error) {
    const mapped = mapPrismaErrorLocalized(error, locale, {
      notFound: translateApiMessage(locale, "crud.installments.notFound"),
    });
    if (mapped) return mapped;
    console.error("Erro ao excluir plano de parcelamento:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "crud.installments.deleteFailed"),
      500
    );
  }
}
