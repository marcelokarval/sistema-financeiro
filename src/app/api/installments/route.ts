import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

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
    const body = await request.json();
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
    } = body;

    if (!description || description.trim() === "") {
      return NextResponse.json(
        { error: "Descrição do plano é obrigatória" },
        { status: 400 }
      );
    }

    if (totalAmount === undefined || totalAmount === null) {
      return NextResponse.json(
        { error: "Valor total do plano é obrigatório" },
        { status: 400 }
      );
    }

    if (!installmentCount || installmentCount < 1) {
      return NextResponse.json(
        { error: "Quantidade de parcelas deve ser maior que zero" },
        { status: 400 }
      );
    }

    const calculatedMonthlyValue =
      monthlyValue ?? Math.ceil((totalAmount / installmentCount) * 100) / 100;
    const planStartDate = startDate ? new Date(startDate) : new Date();

    const plan = await db.$transaction(async (tx) => {
      const newPlan = await tx.installmentPlan.create({
        data: {
          description: description.trim(),
          totalAmount,
          installmentCount,
          paidInstallments: 0,
          monthlyValue: calculatedMonthlyValue,
          interestRate: interestRate ?? 0,
          startDate: planStartDate,
          type: type || "FINANCING",
          status: "ACTIVE",
          cardId: cardId ?? null,
          accountId: accountId ?? null,
          categoryId: categoryId ?? null,
        },
      });

      // Gerar parcelas individuais
      const installmentsData: Prisma.InstallmentCreateManyInput[] = [];
      for (let i = 1; i <= installmentCount; i++) {
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
    const body = await request.json();
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
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID do plano é obrigatório" },
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

    const plan = await db.$transaction(async (tx) => {
      // Se paidInstallments foi alterado, atualizar o status das parcelas
      if (paidInstallments !== undefined && paidInstallments !== existingPlan.paidInstallments) {
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
          ...(description !== undefined && { description: description.trim() }),
          ...(totalAmount !== undefined && { totalAmount }),
          ...(installmentCount !== undefined && { installmentCount }),
          ...(monthlyValue !== undefined && { monthlyValue }),
          ...(interestRate !== undefined && { interestRate }),
          ...(startDate !== undefined && { startDate: new Date(startDate) }),
          ...(type !== undefined && { type }),
          ...(status !== undefined && { status }),
          ...(cardId !== undefined && { cardId: cardId ?? null }),
          ...(accountId !== undefined && { accountId: accountId ?? null }),
          ...(categoryId !== undefined && { categoryId: categoryId ?? null }),
          ...(isActive !== undefined && { isActive }),
          ...(paidInstallments !== undefined && { paidInstallments }),
        },
      });

      return updatedPlan;
    });

    return NextResponse.json(plan);
  } catch (error) {
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
    const body = await request.json();
    const { id } = body;

    if (!id) {
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
    console.error("Erro ao excluir plano de parcelamento:", error);
    return NextResponse.json(
      { error: "Erro ao excluir plano de parcelamento" },
      { status: 500 }
    );
  }
}
