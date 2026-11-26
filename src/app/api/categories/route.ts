import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mapPrismaErrorLocalized, parseJsonBodyLocalized } from "@/lib/api-validation";
import {
  apiErrorResponse,
  apiSuccessMessage,
  resolveRequestLocale,
  translateApiMessage,
} from "@/lib/server-i18n";

const CATEGORY_TYPES = new Set(["INCOME", "EXPENSE"]);

// GET /api/categories - List all categories
export async function GET(request?: NextRequest) {
  const locale = resolveRequestLocale(request);
  try {
    const categories = await db.category.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { transactions: true, purchases: true },
        },
      },
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "crud.categories.fetchFailed"),
      500
    );
  }
}

// POST /api/categories - Create category
export async function POST(request: NextRequest) {
  const locale = resolveRequestLocale(request);
  try {
    const parsedBody = await parseJsonBodyLocalized(request, { locale });
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { name, icon, type, color, isActive } = parsedBody.data;

    if (typeof name !== "string" || name.trim() === "") {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.categories.nameRequired"),
        400
      );
    }

    const resolvedType = type === undefined || type === null ? "EXPENSE" : type;
    if (typeof resolvedType !== "string" || !CATEGORY_TYPES.has(resolvedType)) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.categories.invalidType"),
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
    if (color !== undefined && color !== null && typeof color !== "string") {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "validation.invalidColor"),
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

    const category = await db.category.create({
      data: {
        name: name.trim(),
        icon: typeof icon === "string" && icon.trim() ? icon.trim() : "tag",
        type: resolvedType,
        color: typeof color === "string" && color.trim() ? color.trim() : "#6b7280",
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    const prismaResponse = mapPrismaErrorLocalized(error, locale);
    if (prismaResponse) {
      return prismaResponse;
    }
    console.error("Error creating category:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "crud.categories.createFailed"),
      500
    );
  }
}

// PUT /api/categories - Update category
export async function PUT(request: NextRequest) {
  const locale = resolveRequestLocale(request);
  try {
    const parsedBody = await parseJsonBodyLocalized(request, { locale });
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { id, name, icon, type, color, isActive } = parsedBody.data;
    const categoryId = typeof id === "string" ? id.trim() : "";

    if (!categoryId) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.categories.idRequired"),
        400
      );
    }

    if (name !== undefined && (typeof name !== "string" || name.trim() === "")) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.categories.nameRequired"),
        400
      );
    }

    if (type !== undefined && (typeof type !== "string" || !CATEGORY_TYPES.has(type))) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.categories.invalidType"),
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
    if (color !== undefined && typeof color !== "string") {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "validation.invalidColor"),
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

    const existing = await db.category.findUnique({ where: { id: categoryId } });
    if (!existing) {
      return apiErrorResponse(
        "NOT_FOUND",
        translateApiMessage(locale, "crud.categories.notFound"),
        404
      );
    }

    const category = await db.category.update({
      where: { id: categoryId },
      data: {
        ...(name !== undefined && { name: (name as string).trim() }),
        ...(icon !== undefined && { icon: (icon as string).trim() }),
        ...(type !== undefined && { type: type as string }),
        ...(color !== undefined && { color: (color as string).trim() }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    const prismaResponse = mapPrismaErrorLocalized(error, locale, {
      notFound: translateApiMessage(locale, "crud.categories.notFound"),
    });
    if (prismaResponse) {
      return prismaResponse;
    }
    console.error("Error updating category:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "crud.categories.updateFailed"),
      500
    );
  }
}

// DELETE /api/categories - Delete category
export async function DELETE(request: NextRequest) {
  const locale = resolveRequestLocale(request);
  try {
    const parsedBody = await parseJsonBodyLocalized(request, { locale });
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { id } = parsedBody.data;
    const categoryId = typeof id === "string" ? id.trim() : "";

    if (!categoryId) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        translateApiMessage(locale, "crud.categories.idRequired"),
        400
      );
    }

    const existing = await db.category.findUnique({ where: { id: categoryId } });
    if (!existing) {
      return apiErrorResponse(
        "NOT_FOUND",
        translateApiMessage(locale, "crud.categories.notFound"),
        404
      );
    }

    await db.category.delete({ where: { id: categoryId } });

    return apiSuccessMessage(translateApiMessage(locale, "crud.categories.deleted"));
  } catch (error) {
    const prismaResponse = mapPrismaErrorLocalized(error, locale, {
      notFound: translateApiMessage(locale, "crud.categories.notFound"),
    });
    if (prismaResponse) {
      return prismaResponse;
    }
    console.error("Error deleting category:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "crud.categories.deleteFailed"),
      500
    );
  }
}
