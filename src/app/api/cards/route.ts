import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  mapPrismaError,
  parseFiniteNumber,
  parseJsonBody,
} from "@/lib/api-validation";

const CARD_TYPES = new Set(["CREDIT", "DEBIT"]);
const CARD_BRANDS = new Set(["VISA", "MASTERCARD", "ELO", "AMEX", "HIPER"]);

function parseDayOfMonth(value: unknown): number | null {
  const parsed = parseFiniteNumber(value);
  if (parsed === null || !Number.isInteger(parsed) || parsed < 1 || parsed > 31) {
    return null;
  }
  return parsed;
}

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
    const parsedBody = await parseJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

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
    } = parsedBody.data;

    if (typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "Card name is required" },
        { status: 400 }
      );
    }

    const digitsStr =
      typeof lastFourDigits === "string" || typeof lastFourDigits === "number"
        ? String(lastFourDigits).trim()
        : "";
    if (!digitsStr) {
      return NextResponse.json(
        { error: "Last four digits are required" },
        { status: 400 }
      );
    }

    const resolvedType = type === undefined || type === null ? "CREDIT" : type;
    if (typeof resolvedType !== "string" || !CARD_TYPES.has(resolvedType)) {
      return NextResponse.json({ error: "Invalid card type" }, { status: 400 });
    }

    const resolvedBrand = brand === undefined || brand === null ? "VISA" : brand;
    if (typeof resolvedBrand !== "string" || !CARD_BRANDS.has(resolvedBrand)) {
      return NextResponse.json({ error: "Invalid card brand" }, { status: 400 });
    }

    let resolvedLimit = 0;
    if (creditLimit !== undefined && creditLimit !== null) {
      const parsed = parseFiniteNumber(creditLimit);
      if (parsed === null || parsed < 0) {
        return NextResponse.json({ error: "Invalid credit limit" }, { status: 400 });
      }
      resolvedLimit = parsed;
    }

    let resolvedBalance = 0;
    if (currentBalance !== undefined && currentBalance !== null) {
      const parsed = parseFiniteNumber(currentBalance);
      if (parsed === null) {
        return NextResponse.json({ error: "Invalid current balance" }, { status: 400 });
      }
      resolvedBalance = parsed;
    }

    const resolvedClosingDay =
      closingDay !== undefined && closingDay !== null ? parseDayOfMonth(closingDay) : 1;
    if (resolvedClosingDay === null) {
      return NextResponse.json(
        { error: "Closing day must be an integer between 1 and 31" },
        { status: 400 }
      );
    }

    const resolvedDueDay =
      dueDay !== undefined && dueDay !== null ? parseDayOfMonth(dueDay) : 10;
    if (resolvedDueDay === null) {
      return NextResponse.json(
        { error: "Due day must be an integer between 1 and 31" },
        { status: 400 }
      );
    }

    if (color !== undefined && color !== null && typeof color !== "string") {
      return NextResponse.json({ error: "Invalid color" }, { status: 400 });
    }
    if (flag !== undefined && flag !== null && typeof flag !== "string") {
      return NextResponse.json({ error: "Invalid flag" }, { status: 400 });
    }
    if (isActive !== undefined && typeof isActive !== "boolean") {
      return NextResponse.json({ error: "Invalid isActive flag" }, { status: 400 });
    }

    const card = await db.card.create({
      data: {
        name: name.trim(),
        type: resolvedType,
        brand: resolvedBrand,
        lastFourDigits: digitsStr.slice(-4),
        creditLimit: resolvedLimit,
        currentBalance: resolvedBalance,
        closingDay: resolvedClosingDay,
        dueDay: resolvedDueDay,
        color: typeof color === "string" && color.trim() ? color.trim() : "#8b5cf6",
        flag: typeof flag === "string" ? flag.trim() : "",
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    const prismaResponse = mapPrismaError(error);
    if (prismaResponse) {
      return prismaResponse;
    }
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
    const parsedBody = await parseJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

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
    } = parsedBody.data;

    const cardId = typeof id === "string" ? id.trim() : "";
    if (!cardId) {
      return NextResponse.json(
        { error: "Card id is required" },
        { status: 400 }
      );
    }

    if (name !== undefined && (typeof name !== "string" || name.trim() === "")) {
      return NextResponse.json({ error: "Card name is required" }, { status: 400 });
    }

    if (type !== undefined && (typeof type !== "string" || !CARD_TYPES.has(type))) {
      return NextResponse.json({ error: "Invalid card type" }, { status: 400 });
    }

    if (brand !== undefined && (typeof brand !== "string" || !CARD_BRANDS.has(brand))) {
      return NextResponse.json({ error: "Invalid card brand" }, { status: 400 });
    }

    let resolvedDigits: string | undefined;
    if (lastFourDigits !== undefined) {
      const digitsStr =
        typeof lastFourDigits === "string" || typeof lastFourDigits === "number"
          ? String(lastFourDigits).trim()
          : "";
      if (!digitsStr) {
        return NextResponse.json(
          { error: "Last four digits are required" },
          { status: 400 }
        );
      }
      resolvedDigits = digitsStr.slice(-4);
    }

    let resolvedLimit: number | undefined;
    if (creditLimit !== undefined) {
      const parsed = parseFiniteNumber(creditLimit);
      if (parsed === null || parsed < 0) {
        return NextResponse.json({ error: "Invalid credit limit" }, { status: 400 });
      }
      resolvedLimit = parsed;
    }

    let resolvedBalance: number | undefined;
    if (currentBalance !== undefined) {
      const parsed = parseFiniteNumber(currentBalance);
      if (parsed === null) {
        return NextResponse.json({ error: "Invalid current balance" }, { status: 400 });
      }
      resolvedBalance = parsed;
    }

    let resolvedClosingDay: number | undefined;
    if (closingDay !== undefined) {
      const parsed = parseDayOfMonth(closingDay);
      if (parsed === null) {
        return NextResponse.json(
          { error: "Closing day must be an integer between 1 and 31" },
          { status: 400 }
        );
      }
      resolvedClosingDay = parsed;
    }

    let resolvedDueDay: number | undefined;
    if (dueDay !== undefined) {
      const parsed = parseDayOfMonth(dueDay);
      if (parsed === null) {
        return NextResponse.json(
          { error: "Due day must be an integer between 1 and 31" },
          { status: 400 }
        );
      }
      resolvedDueDay = parsed;
    }

    if (color !== undefined && typeof color !== "string") {
      return NextResponse.json({ error: "Invalid color" }, { status: 400 });
    }
    if (flag !== undefined && typeof flag !== "string") {
      return NextResponse.json({ error: "Invalid flag" }, { status: 400 });
    }
    if (isActive !== undefined && typeof isActive !== "boolean") {
      return NextResponse.json({ error: "Invalid isActive flag" }, { status: 400 });
    }

    const existing = await db.card.findUnique({ where: { id: cardId } });
    if (!existing) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const card = await db.card.update({
      where: { id: cardId },
      data: {
        ...(name !== undefined && { name: (name as string).trim() }),
        ...(type !== undefined && { type: type as string }),
        ...(brand !== undefined && { brand: brand as string }),
        ...(resolvedDigits !== undefined && { lastFourDigits: resolvedDigits }),
        ...(resolvedLimit !== undefined && { creditLimit: resolvedLimit }),
        ...(resolvedBalance !== undefined && { currentBalance: resolvedBalance }),
        ...(resolvedClosingDay !== undefined && { closingDay: resolvedClosingDay }),
        ...(resolvedDueDay !== undefined && { dueDay: resolvedDueDay }),
        ...(color !== undefined && { color: (color as string).trim() }),
        ...(flag !== undefined && { flag: (flag as string).trim() }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(card);
  } catch (error) {
    const prismaResponse = mapPrismaError(error, { notFound: "Card not found" });
    if (prismaResponse) {
      return prismaResponse;
    }
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
    const parsedBody = await parseJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { id } = parsedBody.data;
    const cardId = typeof id === "string" ? id.trim() : "";

    if (!cardId) {
      return NextResponse.json(
        { error: "Card id is required" },
        { status: 400 }
      );
    }

    const existing = await db.card.findUnique({ where: { id: cardId } });
    if (!existing) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    await db.card.delete({ where: { id: cardId } });

    return NextResponse.json({ success: true, message: "Card deleted" });
  } catch (error) {
    const prismaResponse = mapPrismaError(error, { notFound: "Card not found" });
    if (prismaResponse) {
      return prismaResponse;
    }
    console.error("Error deleting card:", error);
    return NextResponse.json(
      { error: "Failed to delete card" },
      { status: 500 }
    );
  }
}
