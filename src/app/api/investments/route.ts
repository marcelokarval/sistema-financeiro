import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  mapPrismaErrorLocalized,
  parseFiniteNumber,
  parseJsonBodyLocalized,
} from "@/lib/api-validation";
import {
  apiErrorResponse,
  apiSuccessMessage,
  resolveRequestLocale,
  translateApiMessage,
} from "@/lib/server-i18n";

const INVESTMENT_TYPES = new Set([
  "STOCK",
  "BOND",
  "FII",
  "CDB",
  "LCI",
  "LCA",
  "TESOURO",
  "CRYPTO",
  "ETF",
  "OTHER",
]);

function parseOptionalString(value: unknown): { ok: true; value: string } | { ok: false } {
  if (value === undefined || value === null) {
    return { ok: true, value: "" };
  }
  if (typeof value !== "string") {
    return { ok: false };
  }
  return { ok: true, value: value.trim() };
}

function parseOptionalRelationId(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }
  if (typeof value !== "string" || value.trim() === "") {
    return { ok: false };
  }
  return { ok: true, value: value.trim() };
}

function parseNonNegativeOrZero(value: unknown): number | null {
  if (value === undefined || value === null) {
    return 0;
  }
  const parsed = parseFiniteNumber(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}

// GET /api/investments - Listar todos os investimentos
export async function GET(request: NextRequest) {
  const locale = resolveRequestLocale(request);

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    const where = type ? { type } : {};

    const investments = await db.investment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    });

    return NextResponse.json(investments);
  } catch (error) {
    console.error("Erro ao buscar investimentos:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "crud.investments.fetchFailed"),
      500
    );
  }
}

// POST /api/investments - Criar investimento
export async function POST(request: NextRequest) {
  const locale = resolveRequestLocale(request);

  try {
    const parsedBody = await parseJsonBodyLocalized(request, { locale });
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const {
      name,
      type,
      description,
      investedAmount,
      currentBalance,
      yieldRate,
      brokerage,
      ticker,
      accountId,
      categoryId,
    } = parsedBody.data;

    if (typeof name !== "string" || name.trim() === "") {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.investments.nameRequired"),
        400
      );
    }

    if (typeof type !== "string" || type.trim() === "" || !INVESTMENT_TYPES.has(type.trim())) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.investments.invalidTypeRequired"),
        400
      );
    }

    const parsedDescription = parseOptionalString(description);
    const parsedBrokerage = parseOptionalString(brokerage);
    const parsedTicker = parseOptionalString(ticker);
    if (!parsedDescription.ok || !parsedBrokerage.ok || !parsedTicker.ok) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.investments.invalidTextFields"),
        400
      );
    }

    const parsedInvested = parseNonNegativeOrZero(investedAmount);
    if (parsedInvested === null) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.investments.invalidInvestedAmount"),
        400
      );
    }

    const parsedBalance = parseNonNegativeOrZero(currentBalance);
    if (parsedBalance === null) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.investments.invalidCurrentBalance"),
        400
      );
    }

    const parsedYield =
      yieldRate === undefined || yieldRate === null ? 0 : parseFiniteNumber(yieldRate);
    if (parsedYield === null) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.investments.invalidYieldRate"),
        400
      );
    }

    const parsedAccount = parseOptionalRelationId(accountId);
    const parsedCategory = parseOptionalRelationId(categoryId);
    if (!parsedAccount.ok || !parsedCategory.ok) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.investments.invalidAccountOrCategory"),
        400
      );
    }

    const investment = await db.investment.create({
      data: {
        name: name.trim(),
        type: type.trim(),
        description: parsedDescription.value,
        investedAmount: parsedInvested,
        currentBalance: parsedBalance,
        yieldRate: parsedYield,
        brokerage: parsedBrokerage.value,
        ticker: parsedTicker.value,
        accountId: parsedAccount.value,
        categoryId: parsedCategory.value,
      },
    });

    return NextResponse.json(investment, { status: 201 });
  } catch (error) {
    const prismaResponse = mapPrismaErrorLocalized(error, locale, {
      fk: translateApiMessage(locale, "crud.investments.invalidAccountOrCategory"),
    });
    if (prismaResponse) {
      return prismaResponse;
    }
    console.error("Erro ao criar investimento:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "crud.investments.createFailed"),
      500
    );
  }
}

// PUT /api/investments - Atualizar investimento
export async function PUT(request: NextRequest) {
  const locale = resolveRequestLocale(request);

  try {
    const parsedBody = await parseJsonBodyLocalized(request, { locale });
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const {
      id,
      name,
      type,
      description,
      investedAmount,
      currentBalance,
      yieldRate,
      brokerage,
      ticker,
      accountId,
      categoryId,
      isActive,
    } = parsedBody.data;

    const investmentId = typeof id === "string" ? id.trim() : "";
    if (!investmentId) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.investments.idRequired"),
        400
      );
    }

    if (name !== undefined && (typeof name !== "string" || name.trim() === "")) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.investments.nameRequired"),
        400
      );
    }

    if (
      type !== undefined &&
      (typeof type !== "string" || type.trim() === "" || !INVESTMENT_TYPES.has(type.trim()))
    ) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.investments.invalidType"),
        400
      );
    }

    let resolvedDescription: string | undefined;
    if (description !== undefined) {
      const parsed = parseOptionalString(description);
      if (!parsed.ok) {
        return apiErrorResponse(
          "VALIDATION_ERROR",
          translateApiMessage(locale, "validation.invalidDescription"),
          400
        );
      }
      resolvedDescription = parsed.value;
    }

    let resolvedBrokerage: string | undefined;
    if (brokerage !== undefined) {
      const parsed = parseOptionalString(brokerage);
      if (!parsed.ok) {
        return apiErrorResponse(
          "VALIDATION_ERROR",
          translateApiMessage(locale, "crud.investments.invalidBroker"),
          400
        );
      }
      resolvedBrokerage = parsed.value;
    }

    let resolvedTicker: string | undefined;
    if (ticker !== undefined) {
      const parsed = parseOptionalString(ticker);
      if (!parsed.ok) {
        return apiErrorResponse(
          "VALIDATION_ERROR",
          translateApiMessage(locale, "crud.investments.invalidTicker"),
          400
        );
      }
      resolvedTicker = parsed.value;
    }

    let resolvedInvested: number | undefined;
    if (investedAmount !== undefined) {
      const parsed = parseFiniteNumber(investedAmount);
      if (parsed === null || parsed < 0) {
        return apiErrorResponse(
          "VALIDATION_ERROR",
          translateApiMessage(locale, "crud.investments.invalidInvestedAmount"),
          400
        );
      }
      resolvedInvested = parsed;
    }

    let resolvedBalance: number | undefined;
    if (currentBalance !== undefined) {
      const parsed = parseFiniteNumber(currentBalance);
      if (parsed === null || parsed < 0) {
        return apiErrorResponse(
          "VALIDATION_ERROR",
          translateApiMessage(locale, "crud.investments.invalidCurrentBalance"),
          400
        );
      }
      resolvedBalance = parsed;
    }

    let resolvedYield: number | undefined;
    if (yieldRate !== undefined) {
      const parsed = parseFiniteNumber(yieldRate);
      if (parsed === null) {
        return apiErrorResponse(
          "VALIDATION_ERROR",
          translateApiMessage(locale, "crud.investments.invalidYieldRate"),
          400
        );
      }
      resolvedYield = parsed;
    }

    let resolvedAccount: string | null | undefined;
    if (accountId !== undefined) {
      const parsed = parseOptionalRelationId(accountId);
      if (!parsed.ok) {
        return apiErrorResponse(
          "VALIDATION_ERROR",
          translateApiMessage(locale, "validation.invalidAccount"),
          400
        );
      }
      resolvedAccount = parsed.value;
    }

    let resolvedCategory: string | null | undefined;
    if (categoryId !== undefined) {
      const parsed = parseOptionalRelationId(categoryId);
      if (!parsed.ok) {
        return apiErrorResponse(
          "VALIDATION_ERROR",
          translateApiMessage(locale, "validation.invalidCategory"),
          400
        );
      }
      resolvedCategory = parsed.value;
    }

    if (isActive !== undefined && typeof isActive !== "boolean") {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "validation.invalidActiveFlag"),
        400
      );
    }

    const existing = await db.investment.findUnique({ where: { id: investmentId } });
    if (!existing) {
      return apiErrorResponse(
        "NOT_FOUND",
        translateApiMessage(locale, "crud.investments.notFound"),
        404
      );
    }

    const investment = await db.investment.update({
      where: { id: investmentId },
      data: {
        ...(name !== undefined && { name: (name as string).trim() }),
        ...(type !== undefined && { type: (type as string).trim() }),
        ...(resolvedDescription !== undefined && { description: resolvedDescription }),
        ...(resolvedInvested !== undefined && { investedAmount: resolvedInvested }),
        ...(resolvedBalance !== undefined && { currentBalance: resolvedBalance }),
        ...(resolvedYield !== undefined && { yieldRate: resolvedYield }),
        ...(resolvedBrokerage !== undefined && { brokerage: resolvedBrokerage }),
        ...(resolvedTicker !== undefined && { ticker: resolvedTicker }),
        ...(resolvedAccount !== undefined && { accountId: resolvedAccount }),
        ...(resolvedCategory !== undefined && { categoryId: resolvedCategory }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(investment);
  } catch (error) {
    const prismaResponse = mapPrismaErrorLocalized(error, locale, {
      fk: translateApiMessage(locale, "crud.investments.invalidAccountOrCategory"),
      notFound: translateApiMessage(locale, "crud.investments.notFound"),
    });
    if (prismaResponse) {
      return prismaResponse;
    }
    console.error("Erro ao atualizar investimento:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "crud.investments.updateFailed"),
      500
    );
  }
}

// DELETE /api/investments - Excluir investimento
export async function DELETE(request: NextRequest) {
  const locale = resolveRequestLocale(request);

  try {
    const parsedBody = await parseJsonBodyLocalized(request, { locale });
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { id } = parsedBody.data;
    const investmentId = typeof id === "string" ? id.trim() : "";

    if (!investmentId) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.investments.idRequired"),
        400
      );
    }

    const existing = await db.investment.findUnique({ where: { id: investmentId } });
    if (!existing) {
      return apiErrorResponse(
        "NOT_FOUND",
        translateApiMessage(locale, "crud.investments.notFound"),
        404
      );
    }

    await db.investment.delete({ where: { id: investmentId } });

    return apiSuccessMessage(
      translateApiMessage(locale, "crud.investments.deleted")
    );
  } catch (error) {
    const prismaResponse = mapPrismaErrorLocalized(error, locale, {
      notFound: translateApiMessage(locale, "crud.investments.notFound"),
    });
    if (prismaResponse) {
      return prismaResponse;
    }
    console.error("Erro ao excluir investimento:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "crud.investments.deleteFailed"),
      500
    );
  }
}
