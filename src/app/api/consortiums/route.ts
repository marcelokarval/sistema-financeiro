import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  mapPrismaError,
  parseCivilDateStart,
  parseJsonBody,
  parsePositiveFiniteNumber,
} from "@/lib/api-validation";

const VALID_CONSORTIUM_STATUSES = [
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
  "CONTEMPLATED",
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

async function validateConsortiumRelations(ids: {
  categoryId?: string | null;
  accountId?: string | null;
}): Promise<NextResponse | null> {
  if (ids.categoryId) {
    const category = await db.category.findUnique({
      where: { id: ids.categoryId },
      select: { id: true },
    });
    if (!category) {
      return NextResponse.json({ error: "Categoria não encontrada" }, { status: 400 });
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
  return null;
}

// GET /api/consortiums - Listar todos os consórcios
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const consortiums = await db.consortium.findMany({
      where: {
        ...(status && { status }),
      },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { installments: true },
        },
        category: {
          select: { id: true, name: true, color: true, icon: true },
        },
      },
    });

    return NextResponse.json(consortiums);
  } catch (error) {
    console.error("Erro ao buscar consórcios:", error);
    return NextResponse.json(
      { error: "Falha ao buscar consórcios" },
      { status: 500 }
    );
  }
}

// POST /api/consortiums - Criar consórcio
export async function POST(request: NextRequest) {
  try {
    const parsedBody = await parseJsonBody(request, "Corpo da requisição JSON inválido.");
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const {
      description,
      totalAmount,
      monthlyPayment,
      installmentCount,
      group,
      quota,
      administrator,
      startDate,
      nextAssemblyDate,
      categoryId,
      accountId,
    } = parsedBody.data;

    if (typeof description !== "string" || description.trim() === "") {
      return NextResponse.json(
        { error: "Descrição do consórcio é obrigatória" },
        { status: 400 }
      );
    }

    const parsedTotalAmount = parsePositiveFiniteNumber(totalAmount);
    if (parsedTotalAmount === null) {
      return NextResponse.json(
        { error: "Valor total do consórcio é obrigatório e deve ser maior que zero" },
        { status: 400 }
      );
    }

    const parsedMonthlyPayment = parsePositiveFiniteNumber(monthlyPayment);
    if (parsedMonthlyPayment === null) {
      return NextResponse.json(
        { error: "Valor da parcela mensal é obrigatório e deve ser maior que zero" },
        { status: 400 }
      );
    }

    const parsedInstallmentCount = parsePositiveFiniteNumber(installmentCount);
    if (parsedInstallmentCount === null || !Number.isInteger(parsedInstallmentCount)) {
      return NextResponse.json(
        { error: "Quantidade de parcelas é obrigatória e deve ser um inteiro maior que zero" },
        { status: 400 }
      );
    }

    if (
      (group !== undefined && group !== null && typeof group !== "string") ||
      (quota !== undefined && quota !== null && typeof quota !== "string") ||
      (administrator !== undefined &&
        administrator !== null &&
        typeof administrator !== "string")
    ) {
      return NextResponse.json(
        { error: "Dados de grupo/cota/administradora inválidos" },
        { status: 400 }
      );
    }

    let start = new Date();
    if (startDate !== undefined && startDate !== null && startDate !== "") {
      if (typeof startDate !== "string" || parseCivilDateStart(startDate) === null) {
        return NextResponse.json(
          { error: "Data de início inválida" },
          { status: 400 }
        );
      }
      start = new Date(startDate);
    }

    let resolvedNextAssemblyDate: Date | null = null;
    if (
      nextAssemblyDate !== undefined &&
      nextAssemblyDate !== null &&
      nextAssemblyDate !== ""
    ) {
      if (
        typeof nextAssemblyDate !== "string" ||
        parseCivilDateStart(nextAssemblyDate) === null
      ) {
        return NextResponse.json(
          { error: "Data da próxima assembleia inválida" },
          { status: 400 }
        );
      }
      resolvedNextAssemblyDate = new Date(nextAssemblyDate);
    }

    const parsedCategoryId = parseOptionalId(categoryId);
    const parsedAccountId = parseOptionalId(accountId);
    if (!parsedCategoryId.valid || !parsedAccountId.valid) {
      return NextResponse.json(
        { error: "Identificador de vínculo inválido" },
        { status: 400 }
      );
    }

    const relationError = await validateConsortiumRelations({
      categoryId: parsedCategoryId.value,
      accountId: parsedAccountId.value,
    });
    if (relationError) {
      return relationError;
    }

    // Gerar as parcelas do consórcio
    const installmentsData = Array.from({ length: parsedInstallmentCount }, (_, i) => {
      const dueDate = new Date(start);
      dueDate.setMonth(dueDate.getMonth() + i);

      return {
        number: i + 1,
        amount: parsedMonthlyPayment,
        dueDate,
        status: "PENDING" as const,
      };
    });

    const consortium = await db.consortium.create({
      data: {
        description: description.trim(),
        group: typeof group === "string" ? group.trim() : "",
        quota: typeof quota === "string" ? quota.trim() : "",
        administrator: typeof administrator === "string" ? administrator.trim() : "",
        totalAmount: parsedTotalAmount,
        monthlyPayment: parsedMonthlyPayment,
        installmentCount: parsedInstallmentCount,
        startDate: start,
        nextAssemblyDate: resolvedNextAssemblyDate,
        categoryId: parsedCategoryId.value,
        accountId: parsedAccountId.value,
        installments: {
          create: installmentsData,
        },
      },
      include: {
        installments: true,
        category: {
          select: { id: true, name: true, color: true, icon: true },
        },
      },
    });

    return NextResponse.json(consortium, { status: 201 });
  } catch (error) {
    const mapped = mapPrismaError(error);
    if (mapped) return mapped;
    console.error("Erro ao criar consórcio:", error);
    return NextResponse.json(
      { error: "Falha ao criar consórcio" },
      { status: 500 }
    );
  }
}

// PUT /api/consortiums - Atualizar consórcio
export async function PUT(request: NextRequest) {
  try {
    const parsedBody = await parseJsonBody(request, "Corpo da requisição JSON inválido.");
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const {
      id,
      description,
      group,
      quota,
      administrator,
      totalAmount,
      monthlyPayment,
      status,
      nextAssemblyDate,
      assembliesAttended,
      categoryId,
      accountId,
      isActive,
    } = parsedBody.data;

    if (typeof id !== "string" || id.trim() === "") {
      return NextResponse.json(
        { error: "ID do consórcio é obrigatório" },
        { status: 400 }
      );
    }

    if (description !== undefined && (typeof description !== "string" || description.trim() === "")) {
      return NextResponse.json(
        { error: "Descrição do consórcio é obrigatória" },
        { status: 400 }
      );
    }

    if (
      (group !== undefined && typeof group !== "string") ||
      (quota !== undefined && typeof quota !== "string") ||
      (administrator !== undefined && typeof administrator !== "string")
    ) {
      return NextResponse.json(
        { error: "Dados de grupo/cota/administradora inválidos" },
        { status: 400 }
      );
    }

    const parsedTotalAmount =
      totalAmount !== undefined ? parsePositiveFiniteNumber(totalAmount) : undefined;
    if (totalAmount !== undefined && parsedTotalAmount === null) {
      return NextResponse.json(
        { error: "Valor total do consórcio deve ser maior que zero" },
        { status: 400 }
      );
    }

    const parsedMonthlyPayment =
      monthlyPayment !== undefined ? parsePositiveFiniteNumber(monthlyPayment) : undefined;
    if (monthlyPayment !== undefined && parsedMonthlyPayment === null) {
      return NextResponse.json(
        { error: "Valor da parcela mensal deve ser maior que zero" },
        { status: 400 }
      );
    }

    if (
      status !== undefined &&
      (typeof status !== "string" ||
        !VALID_CONSORTIUM_STATUSES.includes(
          status as (typeof VALID_CONSORTIUM_STATUSES)[number]
        ))
    ) {
      return NextResponse.json(
        { error: "Status do consórcio inválido" },
        { status: 400 }
      );
    }

    let resolvedNextAssemblyDate: Date | null | undefined;
    if (nextAssemblyDate !== undefined) {
      if (nextAssemblyDate === null || nextAssemblyDate === "") {
        resolvedNextAssemblyDate = null;
      } else if (
        typeof nextAssemblyDate !== "string" ||
        parseCivilDateStart(nextAssemblyDate) === null
      ) {
        return NextResponse.json(
          { error: "Data da próxima assembleia inválida" },
          { status: 400 }
        );
      } else {
        resolvedNextAssemblyDate = new Date(nextAssemblyDate);
      }
    }

    // O campo Int do Prisma aceita inteiros com sinal de 32 bits.
    if (
      assembliesAttended !== undefined &&
      (typeof assembliesAttended !== "number" ||
        !Number.isInteger(assembliesAttended) ||
        assembliesAttended < 0 ||
        assembliesAttended > 2_147_483_647)
    ) {
      return NextResponse.json(
        { error: "A contagem de assembleias deve ser um inteiro entre 0 e 2147483647" },
        { status: 400 }
      );
    }

    if (isActive !== undefined && typeof isActive !== "boolean") {
      return NextResponse.json(
        { error: "Valor de isActive inválido" },
        { status: 400 }
      );
    }

    const parsedCategoryId = categoryId !== undefined ? parseOptionalId(categoryId) : undefined;
    const parsedAccountId = accountId !== undefined ? parseOptionalId(accountId) : undefined;
    if (
      (parsedCategoryId && !parsedCategoryId.valid) ||
      (parsedAccountId && !parsedAccountId.valid)
    ) {
      return NextResponse.json(
        { error: "Identificador de vínculo inválido" },
        { status: 400 }
      );
    }

    const existing = await db.consortium.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Consórcio não encontrado" },
        { status: 404 }
      );
    }

    const relationError = await validateConsortiumRelations({
      categoryId: parsedCategoryId && parsedCategoryId.valid ? parsedCategoryId.value : null,
      accountId: parsedAccountId && parsedAccountId.valid ? parsedAccountId.value : null,
    });
    if (relationError) {
      return relationError;
    }

    const consortium = await db.consortium.update({
      where: { id },
      data: {
        ...(typeof description === "string" && { description: description.trim() }),
        ...(typeof group === "string" && { group: group.trim() || "" }),
        ...(typeof quota === "string" && { quota: quota.trim() || "" }),
        ...(typeof administrator === "string" && {
          administrator: administrator.trim() || "",
        }),
        ...(parsedTotalAmount !== undefined &&
          parsedTotalAmount !== null && { totalAmount: parsedTotalAmount }),
        ...(parsedMonthlyPayment !== undefined &&
          parsedMonthlyPayment !== null && { monthlyPayment: parsedMonthlyPayment }),
        ...(typeof status === "string" && { status }),
        ...(resolvedNextAssemblyDate !== undefined && {
          nextAssemblyDate: resolvedNextAssemblyDate,
        }),
        ...(typeof assembliesAttended === "number" && { assembliesAttended }),
        ...(parsedCategoryId && parsedCategoryId.valid && { categoryId: parsedCategoryId.value }),
        ...(parsedAccountId && parsedAccountId.valid && { accountId: parsedAccountId.value }),
        ...(typeof isActive === "boolean" && { isActive }),
      },
      include: {
        _count: {
          select: { installments: true },
        },
        category: {
          select: { id: true, name: true, color: true, icon: true },
        },
      },
    });

    return NextResponse.json(consortium);
  } catch (error) {
    const mapped = mapPrismaError(error);
    if (mapped) return mapped;
    console.error("Erro ao atualizar consórcio:", error);
    return NextResponse.json(
      { error: "Falha ao atualizar consórcio" },
      { status: 500 }
    );
  }
}

// DELETE /api/consortiums - Excluir consórcio
export async function DELETE(request: NextRequest) {
  try {
    const parsedBody = await parseJsonBody(request, "Corpo da requisição JSON inválido.");
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { id } = parsedBody.data;

    if (typeof id !== "string" || id.trim() === "") {
      return NextResponse.json(
        { error: "ID do consórcio é obrigatório" },
        { status: 400 }
      );
    }

    const existing = await db.consortium.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Consórcio não encontrado" },
        { status: 404 }
      );
    }

    await db.consortium.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Consórcio excluído com sucesso" });
  } catch (error) {
    const mapped = mapPrismaError(error);
    if (mapped) return mapped;
    console.error("Erro ao excluir consórcio:", error);
    return NextResponse.json(
      { error: "Falha ao excluir consórcio" },
      { status: 500 }
    );
  }
}
