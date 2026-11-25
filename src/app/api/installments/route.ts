import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  mapPrismaError,
  parseCivilDateStart,
  parseFiniteNumber,
  parseJsonBody,
  parsePositiveFiniteNumber,
} from "@/lib/api-validation";

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

async function validateInstallmentRelations(ids: {
  cardId?: string | null;
  accountId?: string | null;
  categoryId?: string | null;
}): Promise<NextResponse | null> {
  if (ids.cardId) {
    const card = await db.card.findUnique({
      where: { id: ids.cardId },
      select: { id: true },
    });
    if (!card) {
      return NextResponse.json({ error: "Cartão não encontrado" }, { status: 400 });
    }
  }
  if (ids.accountId) {
    const account = await db.account.findUnique({
      where: { id: ids.accountId },
      select: { id: true },
    });
    if (!account) {
      return NextResponse.json({ error: "Conta não encontrada" }, { status: 400 });
    }
  }
  if (ids.categoryId) {
    const category = await db.category.findUnique({
      where: { id: ids.categoryId },
      select: { id: true },
    });
    if (!category) {
      return NextResponse.json({ error: "Categoria não encontrada" }, { status: 400 });
    }
  }
  return null;
}

// GET /api/installments - Listar planos ou consultar o detalhe pelo ID
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id !== null) {
      const plan = await db.installmentPlan.findUnique({
        where: { id },
        include: { installments: { orderBy: { number: "asc" } } },
      });

      if (!plan) {
        return NextResponse.json(
          { error: "Plano de parcelamento não encontrado" },
          { status: 404 }
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
    return NextResponse.json(
      { error: "Erro ao buscar planos de parcelamento" },
      { status: 500 }
    );
  }
}

// POST /api/installments - Criar plano de parcelamento
export async function POST(request: NextRequest) {
  try {
    const parsedBody = await parseJsonBody(request, "Corpo da requisição JSON inválido.");
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
      return NextResponse.json(
        { error: "Descrição do plano é obrigatória" },
        { status: 400 }
      );
    }

    const parsedTotalAmount = parsePositiveFiniteNumber(totalAmount);
    if (parsedTotalAmount === null) {
      return NextResponse.json(
        { error: "Valor total do plano é obrigatório e deve ser maior que zero" },
        { status: 400 }
      );
    }

    const parsedInstallmentCount = parsePositiveFiniteNumber(installmentCount);
    if (parsedInstallmentCount === null || !Number.isInteger(parsedInstallmentCount)) {
      return NextResponse.json(
        { error: "Quantidade de parcelas deve ser um inteiro maior que zero" },
        { status: 400 }
      );
    }

    let calculatedMonthlyValue: number;
    if (monthlyValue !== undefined && monthlyValue !== null) {
      const parsedMonthly = parsePositiveFiniteNumber(monthlyValue);
      if (parsedMonthly === null) {
        return NextResponse.json(
          { error: "Valor da parcela deve ser maior que zero" },
          { status: 400 }
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
      return NextResponse.json(
        { error: "Taxa de juros inválida" },
        { status: 400 }
      );
    }

    let planStartDate = new Date();
    if (startDate !== undefined && startDate !== null && startDate !== "") {
      if (typeof startDate !== "string" || parseCivilDateStart(startDate) === null) {
        return NextResponse.json(
          { error: "Data de início inválida" },
          { status: 400 }
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
      return NextResponse.json(
        { error: "Tipo de parcelamento inválido" },
        { status: 400 }
      );
    }

    const parsedCardId = parseOptionalId(cardId);
    const parsedAccountId = parseOptionalId(accountId);
    const parsedCategoryId = parseOptionalId(categoryId);
    if (!parsedCardId.valid || !parsedAccountId.valid || !parsedCategoryId.valid) {
      return NextResponse.json(
        { error: "Identificador de vínculo inválido" },
        { status: 400 }
      );
    }

    const relationError = await validateInstallmentRelations({
      cardId: parsedCardId.value,
      accountId: parsedAccountId.value,
      categoryId: parsedCategoryId.value,
    });
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
    const mapped = mapPrismaError(error);
    if (mapped) return mapped;
    console.error("Erro ao criar plano de parcelamento:", error);
    return NextResponse.json(
      { error: "Erro ao criar plano de parcelamento" },
      { status: 500 }
    );
  }
}

// PUT /api/installments - Atualizar plano de parcelamento
export async function PUT(request: NextRequest) {
  try {
    const parsedBody = await parseJsonBody(request, "Corpo da requisição JSON inválido.");
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
      return NextResponse.json(
        { error: "ID do plano é obrigatório" },
        { status: 400 }
      );
    }

    if (description !== undefined && (typeof description !== "string" || description.trim() === "")) {
      return NextResponse.json(
        { error: "Descrição do plano é obrigatória" },
        { status: 400 }
      );
    }

    const parsedTotalAmount =
      totalAmount !== undefined ? parsePositiveFiniteNumber(totalAmount) : undefined;
    if (totalAmount !== undefined && parsedTotalAmount === null) {
      return NextResponse.json(
        { error: "Valor total do plano deve ser maior que zero" },
        { status: 400 }
      );
    }

    const parsedInstallmentCount =
      installmentCount !== undefined ? parsePositiveFiniteNumber(installmentCount) : undefined;
    if (
      installmentCount !== undefined &&
      (parsedInstallmentCount === null || !Number.isInteger(parsedInstallmentCount))
    ) {
      return NextResponse.json(
        { error: "Quantidade de parcelas deve ser um inteiro maior que zero" },
        { status: 400 }
      );
    }

    const parsedMonthlyValue =
      monthlyValue !== undefined ? parsePositiveFiniteNumber(monthlyValue) : undefined;
    if (monthlyValue !== undefined && parsedMonthlyValue === null) {
      return NextResponse.json(
        { error: "Valor da parcela deve ser maior que zero" },
        { status: 400 }
      );
    }

    const parsedInterestRate =
      interestRate !== undefined ? parseFiniteNumber(interestRate) : undefined;
    if (
      parsedInterestRate !== undefined &&
      (parsedInterestRate === null || parsedInterestRate < 0)
    ) {
      return NextResponse.json(
        { error: "Taxa de juros inválida" },
        { status: 400 }
      );
    }

    let resolvedStartDate: Date | undefined;
    if (startDate !== undefined) {
      if (typeof startDate !== "string" || parseCivilDateStart(startDate) === null) {
        return NextResponse.json(
          { error: "Data de início inválida" },
          { status: 400 }
        );
      }
      resolvedStartDate = new Date(startDate);
    }

    if (
      type !== undefined &&
      (typeof type !== "string" ||
        !VALID_INSTALLMENT_TYPES.includes(type as (typeof VALID_INSTALLMENT_TYPES)[number]))
    ) {
      return NextResponse.json(
        { error: "Tipo de parcelamento inválido" },
        { status: 400 }
      );
    }

    if (
      status !== undefined &&
      (typeof status !== "string" ||
        !VALID_INSTALLMENT_STATUSES.includes(
          status as (typeof VALID_INSTALLMENT_STATUSES)[number]
        ))
    ) {
      return NextResponse.json(
        { error: "Status do parcelamento inválido" },
        { status: 400 }
      );
    }

    if (isActive !== undefined && typeof isActive !== "boolean") {
      return NextResponse.json(
        { error: "Valor de isActive inválido" },
        { status: 400 }
      );
    }

    if (
      paidInstallments !== undefined &&
      (typeof paidInstallments !== "number" ||
        !Number.isInteger(paidInstallments) ||
        paidInstallments < 0)
    ) {
      return NextResponse.json(
        { error: "Quantidade de parcelas pagas inválida" },
        { status: 400 }
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
      return NextResponse.json(
        { error: "Identificador de vínculo inválido" },
        { status: 400 }
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
      return NextResponse.json(
        { error: "Plano de parcelamento não encontrado" },
        { status: 404 }
      );
    }

    const effectiveInstallmentCount =
      parsedInstallmentCount ?? existingPlan.installmentCount;
    if (
      typeof paidInstallments === "number" &&
      paidInstallments > effectiveInstallmentCount
    ) {
      return NextResponse.json(
        { error: "Parcelas pagas não pode exceder a quantidade total de parcelas" },
        { status: 400 }
      );
    }

    const relationError = await validateInstallmentRelations({
      cardId: parsedCardId && parsedCardId.valid ? parsedCardId.value : null,
      accountId: parsedAccountId && parsedAccountId.valid ? parsedAccountId.value : null,
      categoryId: parsedCategoryId && parsedCategoryId.valid ? parsedCategoryId.value : null,
    });
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
    const mapped = mapPrismaError(error);
    if (mapped) return mapped;
    console.error("Erro ao atualizar plano de parcelamento:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar plano de parcelamento" },
      { status: 500 }
    );
  }
}

// DELETE /api/installments - Excluir plano de parcelamento
export async function DELETE(request: NextRequest) {
  try {
    const parsedBody = await parseJsonBody(request, "Corpo da requisição JSON inválido.");
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { id } = parsedBody.data;

    if (typeof id !== "string" || id.trim() === "") {
      return NextResponse.json(
        { error: "ID do plano é obrigatório" },
        { status: 400 }
      );
    }

    const existing = await db.installmentPlan.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Plano de parcelamento não encontrado" },
        { status: 404 }
      );
    }

    // Cascade delete remove as parcelas automaticamente
    await db.installmentPlan.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: "Plano de parcelamento excluído com sucesso",
    });
  } catch (error) {
    const mapped = mapPrismaError(error);
    if (mapped) return mapped;
    console.error("Erro ao excluir plano de parcelamento:", error);
    return NextResponse.json(
      { error: "Erro ao excluir plano de parcelamento" },
      { status: 500 }
    );
  }
}
