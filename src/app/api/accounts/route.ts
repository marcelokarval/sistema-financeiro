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

const ACCOUNT_TYPES = new Set(["CASH", "BANK", "DIGITAL_WALLET"]);

// GET /api/accounts - List all accounts
export async function GET(request?: NextRequest) {
  const locale = resolveRequestLocale(request);
  try {
    const accounts = await db.account.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    });
    return NextResponse.json(accounts);
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "crud.accounts.fetchFailed"),
      500
    );
  }
}

// POST /api/accounts - Create account
export async function POST(request: NextRequest) {
  const locale = resolveRequestLocale(request);
  try {
    const parsedBody = await parseJsonBodyLocalized(request, { locale });
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { name, type, balance, color, icon, isActive } = parsedBody.data;

    if (typeof name !== "string" || name.trim() === "") {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.accounts.nameRequired"),
        400
      );
    }

    const resolvedType = type === undefined || type === null ? "CASH" : type;
    if (typeof resolvedType !== "string" || !ACCOUNT_TYPES.has(resolvedType)) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.accounts.invalidType"),
        400
      );
    }

    let resolvedBalance = 0;
    if (balance !== undefined && balance !== null) {
      const parsedBalance = parseFiniteNumber(balance);
      if (parsedBalance === null) {
        return apiErrorResponse(
          "VALIDATION_ERROR",
          translateApiMessage(locale, "crud.accounts.invalidBalance"),
          400
        );
      }
      resolvedBalance = parsedBalance;
    }

    if (color !== undefined && color !== null && typeof color !== "string") {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "validation.invalidColor"),
        400
      );
    }
    if (icon !== undefined && icon !== null && typeof icon !== "string") {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "validation.invalidIcon"),
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

    const account = await db.account.create({
      data: {
        name: name.trim(),
        type: resolvedType,
        balance: resolvedBalance,
        color: typeof color === "string" && color.trim() ? color.trim() : "#6366f1",
        icon: typeof icon === "string" && icon.trim() ? icon.trim() : "wallet",
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    const prismaResponse = mapPrismaErrorLocalized(error, locale);
    if (prismaResponse) {
      return prismaResponse;
    }
    console.error("Error creating account:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "crud.accounts.createFailed"),
      500
    );
  }
}

// PUT /api/accounts - Update account
export async function PUT(request: NextRequest) {
  const locale = resolveRequestLocale(request);
  try {
    const parsedBody = await parseJsonBodyLocalized(request, { locale });
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { id, name, type, balance, color, icon, isActive } = parsedBody.data;
    const accountId = typeof id === "string" ? id.trim() : "";

    if (!accountId) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.accounts.idRequired"),
        400
      );
    }

    if (name !== undefined && (typeof name !== "string" || name.trim() === "")) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.accounts.nameRequired"),
        400
      );
    }

    if (type !== undefined && (typeof type !== "string" || !ACCOUNT_TYPES.has(type))) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.accounts.invalidType"),
        400
      );
    }

    let parsedBalance: number | undefined;
    if (balance !== undefined) {
      const finite = parseFiniteNumber(balance);
      if (finite === null) {
        return apiErrorResponse(
          "VALIDATION_ERROR",
          translateApiMessage(locale, "crud.accounts.invalidBalance"),
          400
        );
      }
      parsedBalance = finite;
    }

    if (color !== undefined && typeof color !== "string") {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "validation.invalidColor"),
        400
      );
    }
    if (icon !== undefined && typeof icon !== "string") {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "validation.invalidIcon"),
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

    const existing = await db.account.findUnique({ where: { id: accountId } });
    if (!existing) {
      return apiErrorResponse(
        "NOT_FOUND",
        translateApiMessage(locale, "crud.accounts.notFound"),
        404
      );
    }

    const account = await db.account.update({
      where: { id: accountId },
      data: {
        ...(name !== undefined && { name: (name as string).trim() }),
        ...(type !== undefined && { type: type as string }),
        ...(parsedBalance !== undefined && { balance: parsedBalance }),
        ...(color !== undefined && { color: (color as string).trim() }),
        ...(icon !== undefined && { icon: (icon as string).trim() }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(account);
  } catch (error) {
    const prismaResponse = mapPrismaErrorLocalized(error, locale, {
      notFound: translateApiMessage(locale, "crud.accounts.notFound"),
    });
    if (prismaResponse) {
      return prismaResponse;
    }
    console.error("Error updating account:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "crud.accounts.updateFailed"),
      500
    );
  }
}

// DELETE /api/accounts - Delete account
export async function DELETE(request: NextRequest) {
  const locale = resolveRequestLocale(request);
  try {
    const parsedBody = await parseJsonBodyLocalized(request, { locale });
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { id } = parsedBody.data;
    const accountId = typeof id === "string" ? id.trim() : "";

    if (!accountId) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.accounts.idRequired"),
        400
      );
    }

    const existing = await db.account.findUnique({ where: { id: accountId } });
    if (!existing) {
      return apiErrorResponse(
        "NOT_FOUND",
        translateApiMessage(locale, "crud.accounts.notFound"),
        404
      );
    }

    await db.account.delete({ where: { id: accountId } });

    return apiSuccessMessage(translateApiMessage(locale, "crud.accounts.deleted"));
  } catch (error) {
    const prismaResponse = mapPrismaErrorLocalized(error, locale, {
      notFound: translateApiMessage(locale, "crud.accounts.notFound"),
    });
    if (prismaResponse) {
      return prismaResponse;
    }
    console.error("Error deleting account:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "crud.accounts.deleteFailed"),
      500
    );
  }
}
