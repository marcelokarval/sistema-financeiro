import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

// GET /api/purchases - List purchases with items and relations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const cardId = searchParams.get("cardId");
    const merchant = searchParams.get("merchant");

    const where: Prisma.PurchaseWhereInput = {};

    if (cardId) where.cardId = cardId;
    if (merchant) {
      where.merchant = {
        contains: merchant,
        mode: "insensitive",
      };
    }

    const purchases = await db.purchase.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        items: {
          orderBy: { createdAt: "asc" },
        },
        card: true,
        category: true,
      },
    });

    return NextResponse.json(purchases);
  } catch (error) {
    console.error("Error fetching purchases:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchases" },
      { status: 500 }
    );
  }
}

// POST /api/purchases - Create purchase with items
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      merchant,
      totalAmount,
      date,
      notes,
      installmentNumber,
      installmentTotal,
      cardId,
      accountId,
      categoryId,
      items,
    } = body;

    if (!merchant || merchant.trim() === "") {
      return NextResponse.json(
        { error: "Merchant name is required" },
        { status: 400 }
      );
    }

    if (!totalAmount || totalAmount <= 0) {
      return NextResponse.json(
        { error: "Valid total amount is required" },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "At least one purchase item is required" },
        { status: 400 }
      );
    }

    const purchase = await db.purchase.create({
      data: {
        merchant: merchant.trim(),
        totalAmount: Number(totalAmount),
        date: date ? new Date(date) : new Date(),
        notes: notes || "",
        installmentNumber: installmentNumber ?? 1,
        installmentTotal: installmentTotal ?? 1,
        cardId: cardId || null,
        accountId: accountId || null,
        categoryId: categoryId || null,
        items: {
          create: items.map((item: { name: string; quantity?: number; unitPrice?: number; totalPrice?: number }) => ({
            name: item.name,
            quantity: item.quantity ?? 1,
            unitPrice: item.unitPrice ?? 0,
            totalPrice: item.totalPrice ?? (item.unitPrice ?? 0) * (item.quantity ?? 1),
          })),
        },
      },
      include: {
        items: true,
        card: true,
        category: true,
      },
    });

    return NextResponse.json(purchase, { status: 201 });
  } catch (error) {
    console.error("Error creating purchase:", error);
    return NextResponse.json(
      { error: "Failed to create purchase" },
      { status: 500 }
    );
  }
}

// PUT /api/purchases - Update purchase
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      merchant,
      totalAmount,
      date,
      notes,
      installmentNumber,
      installmentTotal,
      cardId,
      accountId,
      categoryId,
      items,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Purchase id is required" },
        { status: 400 }
      );
    }

    const existing = await db.purchase.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Purchase not found" },
        { status: 404 }
      );
    }

    // If items are provided, replace all existing items
    if (items && Array.isArray(items)) {
      // Delete existing items
      await db.purchaseItem.deleteMany({
        where: { purchaseId: id },
      });
    }

    const purchase = await db.purchase.update({
      where: { id },
      data: {
        ...(merchant !== undefined && { merchant: merchant.trim() }),
        ...(totalAmount !== undefined && { totalAmount: Number(totalAmount) }),
        ...(date !== undefined && { date: date ? new Date(date) : new Date() }),
        ...(notes !== undefined && { notes }),
        ...(installmentNumber !== undefined && { installmentNumber }),
        ...(installmentTotal !== undefined && { installmentTotal }),
        ...(cardId !== undefined && { cardId: cardId || null }),
        ...(accountId !== undefined && { accountId: accountId || null }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        ...(items && Array.isArray(items) && {
          items: {
            create: items.map((item: { name: string; quantity?: number; unitPrice?: number; totalPrice?: number }) => ({
              name: item.name,
              quantity: item.quantity ?? 1,
              unitPrice: item.unitPrice ?? 0,
              totalPrice: item.totalPrice ?? (item.unitPrice ?? 0) * (item.quantity ?? 1),
            })),
          },
        }),
      },
      include: {
        items: true,
        card: true,
        category: true,
      },
    });

    return NextResponse.json(purchase);
  } catch (error) {
    console.error("Error updating purchase:", error);
    return NextResponse.json(
      { error: "Failed to update purchase" },
      { status: 500 }
    );
  }
}

// DELETE /api/purchases - Delete purchase (cascade deletes items)
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Purchase id is required" },
        { status: 400 }
      );
    }

    const existing = await db.purchase.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Purchase not found" },
        { status: 404 }
      );
    }

    // Delete purchase items first (cascade should handle this, but explicit is safer)
    await db.purchaseItem.deleteMany({
      where: { purchaseId: id },
    });

    await db.purchase.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Purchase deleted" });
  } catch (error) {
    console.error("Error deleting purchase:", error);
    return NextResponse.json(
      { error: "Failed to delete purchase" },
      { status: 500 }
    );
  }
}
