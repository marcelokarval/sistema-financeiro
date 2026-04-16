import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/accounts - List all accounts
export async function GET() {
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
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}

// POST /api/accounts - Create account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, balance, color, icon, isActive } = body;

    if (!name || name.trim() === "") {
      return NextResponse.json(
        { error: "Account name is required" },
        { status: 400 }
      );
    }

    const account = await db.account.create({
      data: {
        name: name.trim(),
        type: type || "CASH",
        balance: balance ?? 0,
        color: color || "#6366f1",
        icon: icon || "wallet",
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    console.error("Error creating account:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}

// PUT /api/accounts - Update account
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, type, balance, color, icon, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Account id is required" },
        { status: 400 }
      );
    }

    const existing = await db.account.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    const account = await db.account.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(type !== undefined && { type }),
        ...(balance !== undefined && { balance }),
        ...(color !== undefined && { color }),
        ...(icon !== undefined && { icon }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(account);
  } catch (error) {
    console.error("Error updating account:", error);
    return NextResponse.json(
      { error: "Failed to update account" },
      { status: 500 }
    );
  }
}

// DELETE /api/accounts - Delete account
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Account id is required" },
        { status: 400 }
      );
    }

    const existing = await db.account.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    await db.account.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Account deleted" });
  } catch (error) {
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
