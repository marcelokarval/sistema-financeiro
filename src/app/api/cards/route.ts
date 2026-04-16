import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/cards - List all cards with purchase count
export async function GET() {
  try {
    const cards = await db.card.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { purchases: true },
        },
      },
    });
    return NextResponse.json(cards);
  } catch (error) {
    console.error("Error fetching cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch cards" },
      { status: 500 }
    );
  }
}

// POST /api/cards - Create card
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      type,
      brand,
      lastFourDigits,
      creditLimit,
      currentBalance,
      closingDay,
      dueDay,
      color,
      flag,
      isActive,
    } = body;

    if (!name || name.trim() === "") {
      return NextResponse.json(
        { error: "Card name is required" },
        { status: 400 }
      );
    }

    if (!lastFourDigits) {
      return NextResponse.json(
        { error: "Last four digits are required" },
        { status: 400 }
      );
    }

    const card = await db.card.create({
      data: {
        name: name.trim(),
        type: type || "CREDIT",
        brand: brand || "VISA",
        lastFourDigits: String(lastFourDigits).slice(-4),
        creditLimit: creditLimit ?? 0,
        currentBalance: currentBalance ?? 0,
        closingDay: closingDay ?? 1,
        dueDay: dueDay ?? 10,
        color: color || "#8b5cf6",
        flag: flag || "",
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    console.error("Error creating card:", error);
    return NextResponse.json(
      { error: "Failed to create card" },
      { status: 500 }
    );
  }
}

// PUT /api/cards - Update card
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      name,
      type,
      brand,
      lastFourDigits,
      creditLimit,
      currentBalance,
      closingDay,
      dueDay,
      color,
      flag,
      isActive,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Card id is required" },
        { status: 400 }
      );
    }

    const existing = await db.card.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const card = await db.card.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(type !== undefined && { type }),
        ...(brand !== undefined && { brand }),
        ...(lastFourDigits !== undefined && {
          lastFourDigits: String(lastFourDigits).slice(-4),
        }),
        ...(creditLimit !== undefined && { creditLimit }),
        ...(currentBalance !== undefined && { currentBalance }),
        ...(closingDay !== undefined && { closingDay }),
        ...(dueDay !== undefined && { dueDay }),
        ...(color !== undefined && { color }),
        ...(flag !== undefined && { flag }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(card);
  } catch (error) {
    console.error("Error updating card:", error);
    return NextResponse.json(
      { error: "Failed to update card" },
      { status: 500 }
    );
  }
}

// DELETE /api/cards - Delete card
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Card id is required" },
        { status: 400 }
      );
    }

    const existing = await db.card.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    await db.card.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Card deleted" });
  } catch (error) {
    console.error("Error deleting card:", error);
    return NextResponse.json(
      { error: "Failed to delete card" },
      { status: 500 }
    );
  }
}
