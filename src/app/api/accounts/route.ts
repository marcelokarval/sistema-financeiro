import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  mapPrismaError,
  parseFiniteNumber,
  parseJsonBody,
} from "@/lib/api-validation";

const ACCOUNT_TYPES = new Set(["CASH", "BANK", "DIGITAL_WALLET"]);

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
    const parsedBody = await parseJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { name, type, balance, color, icon, isActive } = parsedBody.data;

    if (typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "Account name is required" },
        { status: 400 }
      );
    }

    const resolvedType = type === undefined || type === null ? "CASH" : type;
    if (typeof resolvedType !== "string" || !ACCOUNT_TYPES.has(resolvedType)) {
      return NextResponse.json(
        { error: "Invalid account type" },
        { status: 400 }
      );
    }

    let resolvedBalance = 0;
    if (balance !== undefined && balance !== null) {
      const parsedBalance = parseFiniteNumber(balance);
      if (parsedBalance === null) {
        return NextResponse.json(
          { error: "Invalid account balance" },
          { status: 400 }
        );
      }
      resolvedBalance = parsedBalance;
    }

    if (color !== undefined && color !== null && typeof color !== "string") {
      return NextResponse.json({ error: "Invalid color" }, { status: 400 });
    }
    if (icon !== undefined && icon !== null && typeof icon !== "string") {
      return NextResponse.json({ error: "Invalid icon" }, { status: 400 });
    }
    if (isActive !== undefined && typeof isActive !== "boolean") {
      return NextResponse.json({ error: "Invalid isActive flag" }, { status: 400 });
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
    const prismaResponse = mapPrismaError(error);
    if (prismaResponse) {
      return prismaResponse;
    }
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
    const parsedBody = await parseJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { id, name, type, balance, color, icon, isActive } = parsedBody.data;
    const accountId = typeof id === "string" ? id.trim() : "";

    if (!accountId) {
      return NextResponse.json(
        { error: "Account id is required" },
        { status: 400 }
      );
    }

    if (name !== undefined && (typeof name !== "string" || name.trim() === "")) {
      return NextResponse.json(
        { error: "Account name is required" },
        { status: 400 }
      );
    }

    if (type !== undefined && (typeof type !== "string" || !ACCOUNT_TYPES.has(type))) {
      return NextResponse.json(
        { error: "Invalid account type" },
        { status: 400 }
      );
    }

    let parsedBalance: number | undefined;
    if (balance !== undefined) {
      const finite = parseFiniteNumber(balance);
      if (finite === null) {
        return NextResponse.json(
          { error: "Invalid account balance" },
          { status: 400 }
        );
      }
      parsedBalance = finite;
    }

    if (color !== undefined && typeof color !== "string") {
      return NextResponse.json({ error: "Invalid color" }, { status: 400 });
    }
    if (icon !== undefined && typeof icon !== "string") {
      return NextResponse.json({ error: "Invalid icon" }, { status: 400 });
    }
    if (isActive !== undefined && typeof isActive !== "boolean") {
      return NextResponse.json({ error: "Invalid isActive flag" }, { status: 400 });
    }

    const existing = await db.account.findUnique({ where: { id: accountId } });
    if (!existing) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
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
    const prismaResponse = mapPrismaError(error, { notFound: "Account not found" });
    if (prismaResponse) {
      return prismaResponse;
    }
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
    const parsedBody = await parseJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { id } = parsedBody.data;
    const accountId = typeof id === "string" ? id.trim() : "";

    if (!accountId) {
      return NextResponse.json(
        { error: "Account id is required" },
        { status: 400 }
      );
    }

    const existing = await db.account.findUnique({ where: { id: accountId } });
    if (!existing) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    await db.account.delete({ where: { id: accountId } });

    return NextResponse.json({ success: true, message: "Account deleted" });
  } catch (error) {
    const prismaResponse = mapPrismaError(error, { notFound: "Account not found" });
    if (prismaResponse) {
      return prismaResponse;
    }
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
