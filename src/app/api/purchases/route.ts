import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  parseCivilDateStart,
  parseFiniteNumber,
  parseJsonBody,
  parsePositiveFiniteNumber,
} from "@/lib/api-validation";

type OptionalIdResult =
  | { valid: true; value: string | null }
  | { valid: false };

function parseOptionalId(value: unknown): OptionalIdResult {
  if (value === undefined || value === null) {
    return { valid: true, value: null };
  }
  if (typeof value !== "string") {
    return { valid: false };
  }
  const trimmed = value.trim();
  return { valid: true, value: trimmed || null };
}

async function validatePurchaseRelations(ids: {
  cardId?: string | null;
  accountId?: string | null;
  categoryId?: string | null;
}): Promise<NextResponse | null> {
  if (ids.cardId) {
    const card = await db.card.findUnique({
      where: { id: ids.cardId },
      select: { id: true },
    });
    if (!card) {
      return NextResponse.json({ error: "Cartão não encontrado" }, { status: 400 });
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
  if (ids.categoryId) {
    const category = await db.category.findUnique({
      where: { id: ids.categoryId },
      select: { id: true },
    });
    if (!category) {
      return NextResponse.json({ error: "Categoria não encontrada" }, { status: 400 });
    }
  }
  return null;
}

type NormalizedPurchaseItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

function parsePurchaseItems(
  rawItems: unknown,
  allowEmpty: boolean
): { ok: true; items: NormalizedPurchaseItem[] } | { ok: false; error: string } {
  if (!Array.isArray(rawItems)) {
    return { ok: false, error: "At least one purchase item is required" };
  }
  if (!allowEmpty && rawItems.length === 0) {
    return { ok: false, error: "At least one purchase item is required" };
  }

  const normalized: NormalizedPurchaseItem[] = [];
  for (const rawItem of rawItems) {
    if (rawItem === null || typeof rawItem !== "object" || Array.isArray(rawItem)) {
      return { ok: false, error: "Invalid purchase item" };
    }
    const item = rawItem as Record<string, unknown>;
    if (typeof item.name !== "string" || item.name.trim() === "") {
      return { ok: false, error: "Purchase item name is required" };
    }

    const quantity = item.quantity === undefined ? 1 : parsePositiveFiniteNumber(item.quantity);
    if (quantity === null || !Number.isInteger(quantity)) {
      return { ok: false, error: "Invalid purchase item quantity" };
    }

    const unitPrice = item.unitPrice === undefined ? 0 : parseFiniteNumber(item.unitPrice);
    if (unitPrice === null || unitPrice < 0) {
      return { ok: false, error: "Invalid purchase item unit price" };
    }

    const totalPrice =
      item.totalPrice === undefined
        ? unitPrice * quantity
        : parseFiniteNumber(item.totalPrice);
    if (totalPrice === null || totalPrice < 0) {
      return { ok: false, error: "Invalid purchase item total price" };
    }

    normalized.push({
      name: item.name.trim(),
      quantity,
      unitPrice,
      totalPrice,
    });
  }

  return { ok: true, items: normalized };
}

function parsePositiveInt(value: unknown): number | null {
  const parsed = parsePositiveFiniteNumber(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

// GET /api/purchases - List purchases with items and relations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const cardId = searchParams.get("cardId");
    const merchant = searchParams.get("merchant");

    const where: Prisma.PurchaseWhereInput = {};

    if (cardId) where.cardId = cardId;
    const merchantFilter = merchant?.trim().toLocaleLowerCase("pt-BR");

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

    // SQLite StringFilter does not support `mode: "insensitive"`, and SQLite LIKE
    // is ASCII-only; filter in JS for consistent pt-BR case-insensitive matching.
    const filteredPurchases = merchantFilter
      ? purchases.filter((p) =>
          p.merchant.toLocaleLowerCase("pt-BR").includes(merchantFilter)
        )
      : purchases;

    return NextResponse.json(filteredPurchases);
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
    const parsedBody = await parseJsonBody(request, "Corpo da requisição JSON inválido.");
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

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
    } = parsedBody.data;

    if (typeof merchant !== "string" || merchant.trim() === "") {
      return NextResponse.json(
        { error: "Merchant name is required" },
        { status: 400 }
      );
    }

    const parsedTotalAmount = parsePositiveFiniteNumber(totalAmount);
    if (parsedTotalAmount === null) {
      return NextResponse.json(
        { error: "Valid total amount is required" },
        { status: 400 }
      );
    }

    let resolvedDate = new Date();
    if (date !== undefined && date !== null && date !== "") {
      if (typeof date !== "string" || parseCivilDateStart(date) === null) {
        return NextResponse.json(
          { error: "Data inválida" },
          { status: 400 }
        );
      }
      resolvedDate = new Date(date);
    }

    if (notes !== undefined && notes !== null && typeof notes !== "string") {
      return NextResponse.json(
        { error: "Observações inválidas" },
        { status: 400 }
      );
    }

    const resolvedInstallmentNumber =
      installmentNumber === undefined || installmentNumber === null
        ? 1
        : parsePositiveInt(installmentNumber);
    if (resolvedInstallmentNumber === null) {
      return NextResponse.json(
        { error: "Número da parcela inválido" },
        { status: 400 }
      );
    }

    const resolvedInstallmentTotal =
      installmentTotal === undefined || installmentTotal === null
        ? 1
        : parsePositiveInt(installmentTotal);
    if (resolvedInstallmentTotal === null) {
      return NextResponse.json(
        { error: "Total de parcelas inválido" },
        { status: 400 }
      );
    }

    const parsedItems = parsePurchaseItems(items, false);
    if (!parsedItems.ok) {
      return NextResponse.json(
        { error: parsedItems.error },
        { status: 400 }
      );
    }

    const parsedCardId = parseOptionalId(cardId);
    const parsedAccountId = parseOptionalId(accountId);
    const parsedCategoryId = parseOptionalId(categoryId);
    if (!parsedCardId.valid || !parsedAccountId.valid || !parsedCategoryId.valid) {
      return NextResponse.json(
        { error: "Identificador de vínculo inválido" },
        { status: 400 }
      );
    }

    const relationError = await validatePurchaseRelations({
      cardId: parsedCardId.value,
      accountId: parsedAccountId.value,
      categoryId: parsedCategoryId.value,
    });
    if (relationError) {
      return relationError;
    }

    const purchase = await db.purchase.create({
      data: {
        merchant: merchant.trim(),
        totalAmount: parsedTotalAmount,
        date: resolvedDate,
        notes: typeof notes === "string" ? notes : "",
        installmentNumber: resolvedInstallmentNumber,
        installmentTotal: resolvedInstallmentTotal,
        cardId: parsedCardId.value,
        accountId: parsedAccountId.value,
        categoryId: parsedCategoryId.value,
        items: {
          create: parsedItems.items,
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
    const parsedBody = await parseJsonBody(request, "Corpo da requisição JSON inválido.");
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

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
    } = parsedBody.data;

    if (typeof id !== "string" || id.trim() === "") {
      return NextResponse.json(
        { error: "Purchase id is required" },
        { status: 400 }
      );
    }

    if (merchant !== undefined && (typeof merchant !== "string" || merchant.trim() === "")) {
      return NextResponse.json(
        { error: "Merchant name is required" },
        { status: 400 }
      );
    }

    const parsedTotalAmount =
      totalAmount !== undefined ? parsePositiveFiniteNumber(totalAmount) : undefined;
    if (totalAmount !== undefined && parsedTotalAmount === null) {
      return NextResponse.json(
        { error: "Valid total amount is required" },
        { status: 400 }
      );
    }

    let resolvedDate: Date | undefined;
    if (date !== undefined) {
      if (date === null || date === "") {
        resolvedDate = new Date();
      } else if (typeof date !== "string" || parseCivilDateStart(date) === null) {
        return NextResponse.json(
          { error: "Data inválida" },
          { status: 400 }
        );
      } else {
        resolvedDate = new Date(date);
      }
    }

    if (notes !== undefined && typeof notes !== "string") {
      return NextResponse.json(
        { error: "Observações inválidas" },
        { status: 400 }
      );
    }

    const parsedInstallmentNumber =
      installmentNumber !== undefined ? parsePositiveInt(installmentNumber) : undefined;
    if (installmentNumber !== undefined && parsedInstallmentNumber === null) {
      return NextResponse.json(
        { error: "Número da parcela inválido" },
        { status: 400 }
      );
    }

    const parsedInstallmentTotal =
      installmentTotal !== undefined ? parsePositiveInt(installmentTotal) : undefined;
    if (installmentTotal !== undefined && parsedInstallmentTotal === null) {
      return NextResponse.json(
        { error: "Total de parcelas inválido" },
        { status: 400 }
      );
    }

    let parsedItems: NormalizedPurchaseItem[] | undefined;
    if (items !== undefined) {
      const result = parsePurchaseItems(items, true);
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }
      parsedItems = result.items;
    }

    const parsedCardId = cardId !== undefined ? parseOptionalId(cardId) : undefined;
    const parsedAccountId = accountId !== undefined ? parseOptionalId(accountId) : undefined;
    const parsedCategoryId = categoryId !== undefined ? parseOptionalId(categoryId) : undefined;
    if (
      (parsedCardId && !parsedCardId.valid) ||
      (parsedAccountId && !parsedAccountId.valid) ||
      (parsedCategoryId && !parsedCategoryId.valid)
    ) {
      return NextResponse.json(
        { error: "Identificador de vínculo inválido" },
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

    const relationError = await validatePurchaseRelations({
      cardId: parsedCardId && parsedCardId.valid ? parsedCardId.value : null,
      accountId: parsedAccountId && parsedAccountId.valid ? parsedAccountId.value : null,
      categoryId: parsedCategoryId && parsedCategoryId.valid ? parsedCategoryId.value : null,
    });
    if (relationError) {
      return relationError;
    }

    const purchase = await db.purchase.update({
      where: { id },
      data: {
        ...(typeof merchant === "string" && { merchant: merchant.trim() }),
        ...(parsedTotalAmount !== undefined &&
          parsedTotalAmount !== null && { totalAmount: parsedTotalAmount }),
        ...(resolvedDate !== undefined && { date: resolvedDate }),
        ...(typeof notes === "string" && { notes }),
        ...(parsedInstallmentNumber !== undefined &&
          parsedInstallmentNumber !== null && {
            installmentNumber: parsedInstallmentNumber,
          }),
        ...(parsedInstallmentTotal !== undefined &&
          parsedInstallmentTotal !== null && {
            installmentTotal: parsedInstallmentTotal,
          }),
        ...(parsedCardId && parsedCardId.valid && { cardId: parsedCardId.value }),
        ...(parsedAccountId && parsedAccountId.valid && { accountId: parsedAccountId.value }),
        ...(parsedCategoryId && parsedCategoryId.valid && { categoryId: parsedCategoryId.value }),
        ...(parsedItems !== undefined && {
          items: {
            deleteMany: {},
            create: parsedItems,
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
    const parsedBody = await parseJsonBody(request, "Corpo da requisição JSON inválido.");
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { id } = parsedBody.data;

    if (typeof id !== "string" || id.trim() === "") {
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

    // PurchaseItem.purchase uses ON DELETE CASCADE in the database.
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
