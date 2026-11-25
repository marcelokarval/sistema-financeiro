import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mapPrismaError, parseJsonBody } from "@/lib/api-validation";

const CATEGORY_TYPES = new Set(["INCOME", "EXPENSE"]);

// GET /api/categories - List all categories
export async function GET() {
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
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

// POST /api/categories - Create category
export async function POST(request: NextRequest) {
  try {
    const parsedBody = await parseJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { name, icon, type, color, isActive } = parsedBody.data;

    if (typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    const resolvedType = type === undefined || type === null ? "EXPENSE" : type;
    if (typeof resolvedType !== "string" || !CATEGORY_TYPES.has(resolvedType)) {
      return NextResponse.json(
        { error: "Invalid category type" },
        { status: 400 }
      );
    }

    if (icon !== undefined && icon !== null && typeof icon !== "string") {
      return NextResponse.json({ error: "Invalid icon" }, { status: 400 });
    }
    if (color !== undefined && color !== null && typeof color !== "string") {
      return NextResponse.json({ error: "Invalid color" }, { status: 400 });
    }
    if (isActive !== undefined && typeof isActive !== "boolean") {
      return NextResponse.json({ error: "Invalid isActive flag" }, { status: 400 });
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
    const prismaResponse = mapPrismaError(error);
    if (prismaResponse) {
      return prismaResponse;
    }
    console.error("Error creating category:", error);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }
}

// PUT /api/categories - Update category
export async function PUT(request: NextRequest) {
  try {
    const parsedBody = await parseJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { id, name, icon, type, color, isActive } = parsedBody.data;
    const categoryId = typeof id === "string" ? id.trim() : "";

    if (!categoryId) {
      return NextResponse.json(
        { error: "Category id is required" },
        { status: 400 }
      );
    }

    if (name !== undefined && (typeof name !== "string" || name.trim() === "")) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    if (type !== undefined && (typeof type !== "string" || !CATEGORY_TYPES.has(type))) {
      return NextResponse.json(
        { error: "Invalid category type" },
        { status: 400 }
      );
    }

    if (icon !== undefined && typeof icon !== "string") {
      return NextResponse.json({ error: "Invalid icon" }, { status: 400 });
    }
    if (color !== undefined && typeof color !== "string") {
      return NextResponse.json({ error: "Invalid color" }, { status: 400 });
    }
    if (isActive !== undefined && typeof isActive !== "boolean") {
      return NextResponse.json({ error: "Invalid isActive flag" }, { status: 400 });
    }

    const existing = await db.category.findUnique({ where: { id: categoryId } });
    if (!existing) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
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
    const prismaResponse = mapPrismaError(error, { notFound: "Category not found" });
    if (prismaResponse) {
      return prismaResponse;
    }
    console.error("Error updating category:", error);
    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 }
    );
  }
}

// DELETE /api/categories - Delete category
export async function DELETE(request: NextRequest) {
  try {
    const parsedBody = await parseJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { id } = parsedBody.data;
    const categoryId = typeof id === "string" ? id.trim() : "";

    if (!categoryId) {
      return NextResponse.json(
        { error: "Category id is required" },
        { status: 400 }
      );
    }

    const existing = await db.category.findUnique({ where: { id: categoryId } });
    if (!existing) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    await db.category.delete({ where: { id: categoryId } });

    return NextResponse.json({ success: true, message: "Category deleted" });
  } catch (error) {
    const prismaResponse = mapPrismaError(error, { notFound: "Category not found" });
    if (prismaResponse) {
      return prismaResponse;
    }
    console.error("Error deleting category:", error);
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 }
    );
  }
}
