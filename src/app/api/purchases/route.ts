import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  parseCivilDateStart,
  parseFiniteNumber,
  parseJsonBodyLocalized,
  parsePositiveFiniteNumber,
} from "@/lib/api-validation";
import {
  apiErrorResponse,
  apiSuccessMessage,
  hasExplicitLocaleSignal,
  INTL_LOCALE_MAP,
  resolveRequestLocale,
  translateApiMessage,
  type SupportedLocale,
} from "@/lib/server-i18n";

type OptionalIdResult =
  | { valid: true; value: string | null }
  | { valid: false };

function purchaseError(
  code: string,
  messageKey: string,
  legacyMessage: string,
  status: number,
  locale: SupportedLocale,
  explicitLocale: boolean
): NextResponse {
  return apiErrorResponse(
    code,
    explicitLocale ? translateApiMessage(locale, messageKey) : legacyMessage,
    status,
    { includeCode: explicitLocale }
  );
}

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

async function validatePurchaseRelations(
  ids: {
    cardId?: string | null;
    accountId?: string | null;
    categoryId?: string | null;
  },
  locale: SupportedLocale,
  explicitLocale: boolean
): Promise<NextResponse | null> {
  if (ids.cardId) {
    const card = await db.card.findUnique({
      where: { id: ids.cardId },
      select: { id: true },
    });
    if (!card) {
      return purchaseError(
        "FOREIGN_KEY_ERROR",
        "crud.purchases.cardNotFound",
        "Cartão não encontrado",
        400,
        locale,
        explicitLocale
      );
    }
  }
  if (ids.accountId) {
    const account = await db.account.findUnique({
      where: { id: ids.accountId },
      select: { id: true },
    });
    if (!account) {
      return purchaseError(
        "FOREIGN_KEY_ERROR",
        "crud.purchases.accountNotFound",
        "Conta não encontrada",
        400,
        locale,
        explicitLocale
      );
    }
  }
  if (ids.categoryId) {
    const category = await db.category.findUnique({
      where: { id: ids.categoryId },
      select: { id: true },
    });
    if (!category) {
      return purchaseError(
        "FOREIGN_KEY_ERROR",
        "crud.purchases.categoryNotFound",
        "Categoria não encontrada",
        400,
        locale,
        explicitLocale
      );
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
  allowEmpty: boolean,
  locale: SupportedLocale,
  explicitLocale: boolean
): { ok: true; items: NormalizedPurchaseItem[] } | { ok: false; error: string } {
  const err = (key: string, legacy: string) =>
    explicitLocale ? translateApiMessage(locale, key) : legacy;

  if (!Array.isArray(rawItems)) {
    return {
      ok: false,
      error: err("crud.purchases.itemRequired", "At least one purchase item is required"),
    };
  }
  if (!allowEmpty && rawItems.length === 0) {
    return {
      ok: false,
      error: err("crud.purchases.itemRequired", "At least one purchase item is required"),
    };
  }

  const normalized: NormalizedPurchaseItem[] = [];
  for (const rawItem of rawItems) {
    if (rawItem === null || typeof rawItem !== "object" || Array.isArray(rawItem)) {
      return {
        ok: false,
        error: err("crud.purchases.invalidItem", "Invalid purchase item"),
      };
    }
    const item = rawItem as Record<string, unknown>;
    if (typeof item.name !== "string" || item.name.trim() === "") {
      return {
        ok: false,
        error: err("crud.purchases.itemNameRequired", "Purchase item name is required"),
      };
    }

    const quantity = item.quantity === undefined ? 1 : parsePositiveFiniteNumber(item.quantity);
    if (quantity === null || !Number.isInteger(quantity)) {
      return {
        ok: false,
        error: err("crud.purchases.invalidItemQuantity", "Invalid purchase item quantity"),
      };
    }

    const unitPrice = item.unitPrice === undefined ? 0 : parseFiniteNumber(item.unitPrice);
    if (unitPrice === null || unitPrice < 0) {
      return {
        ok: false,
        error: err("crud.purchases.invalidItemUnitPrice", "Invalid purchase item unit price"),
      };
    }

    const totalPrice =
      item.totalPrice === undefined
        ? unitPrice * quantity
        : parseFiniteNumber(item.totalPrice);
    if (totalPrice === null || totalPrice < 0) {
      return {
        ok: false,
        error: err("crud.purchases.invalidItemTotalPrice", "Invalid purchase item total price"),
      };
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
  const locale = resolveRequestLocale(request);
  const explicitLocale = hasExplicitLocaleSignal(request);

  try {
    const { searchParams } = new URL(request.url);

    const cardId = searchParams.get("cardId");
    const merchant = searchParams.get("merchant");

    const where: Prisma.PurchaseWhereInput = {};
    const intlLocale = INTL_LOCALE_MAP[locale];

    if (cardId) where.cardId = cardId;
    const merchantFilter = merchant?.trim().toLocaleLowerCase(intlLocale);

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
    // is ASCII-only; filter in JS for consistent locale-aware case-insensitive matching.
    const filteredPurchases = merchantFilter
      ? purchases.filter((p) =>
          p.merchant.toLocaleLowerCase(intlLocale).includes(merchantFilter)
        )
      : purchases;

    return NextResponse.json(filteredPurchases);
  } catch (error) {
    console.error("Error fetching purchases:", error);
    return purchaseError(
      "INTERNAL_ERROR",
      "crud.purchases.fetchFailed",
      "Failed to fetch purchases",
      500,
      locale,
      explicitLocale
    );
  }
}

// POST /api/purchases - Create purchase with items
export async function POST(request: NextRequest) {
  const locale = resolveRequestLocale(request);
  const explicitLocale = hasExplicitLocaleSignal(request);

  try {
    const parsedBody = await parseJsonBodyLocalized(request, {
      locale,
      includeCode: explicitLocale,
    });
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
      return purchaseError(
        "VALIDATION_ERROR",
        "crud.purchases.merchantRequired",
        "Merchant name is required",
        400,
        locale,
        explicitLocale
      );
    }

    const parsedTotalAmount = parsePositiveFiniteNumber(totalAmount);
    if (parsedTotalAmount === null) {
      return purchaseError(
        "VALIDATION_ERROR",
        "crud.purchases.validTotalRequired",
        "Valid total amount is required",
        400,
        locale,
        explicitLocale
      );
    }

    let resolvedDate = new Date();
    if (date !== undefined && date !== null && date !== "") {
      if (typeof date !== "string" || parseCivilDateStart(date) === null) {
        return purchaseError(
          "VALIDATION_ERROR",
          "validation.invalidDate",
          "Data inválida",
          400,
          locale,
          explicitLocale
        );
      }
      resolvedDate = new Date(date);
    }

    if (notes !== undefined && notes !== null && typeof notes !== "string") {
      return purchaseError(
        "VALIDATION_ERROR",
        "validation.invalidNotes",
        "Observações inválidas",
        400,
        locale,
        explicitLocale
      );
    }

    const resolvedInstallmentNumber =
      installmentNumber === undefined || installmentNumber === null
        ? 1
        : parsePositiveInt(installmentNumber);
    if (resolvedInstallmentNumber === null) {
      return purchaseError(
        "VALIDATION_ERROR",
        "crud.purchases.invalidInstallmentNumber",
        "Número da parcela inválido",
        400,
        locale,
        explicitLocale
      );
    }

    const resolvedInstallmentTotal =
      installmentTotal === undefined || installmentTotal === null
        ? 1
        : parsePositiveInt(installmentTotal);
    if (resolvedInstallmentTotal === null) {
      return purchaseError(
        "VALIDATION_ERROR",
        "crud.purchases.invalidInstallmentTotal",
        "Total de parcelas inválido",
        400,
        locale,
        explicitLocale
      );
    }

    const parsedItems = parsePurchaseItems(items, false, locale, explicitLocale);
    if (!parsedItems.ok) {
      return apiErrorResponse("VALIDATION_ERROR", parsedItems.error, 400, {
        includeCode: explicitLocale,
      });
    }

    const parsedCardId = parseOptionalId(cardId);
    const parsedAccountId = parseOptionalId(accountId);
    const parsedCategoryId = parseOptionalId(categoryId);
    if (!parsedCardId.valid || !parsedAccountId.valid || !parsedCategoryId.valid) {
      return purchaseError(
        "VALIDATION_ERROR",
        "validation.invalidLinkId",
        "Identificador de vínculo inválido",
        400,
        locale,
        explicitLocale
      );
    }

    const relationError = await validatePurchaseRelations(
      {
        cardId: parsedCardId.value,
        accountId: parsedAccountId.value,
        categoryId: parsedCategoryId.value,
      },
      locale,
      explicitLocale
    );
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
    return purchaseError(
      "INTERNAL_ERROR",
      "crud.purchases.createFailed",
      "Failed to create purchase",
      500,
      locale,
      explicitLocale
    );
  }
}

// PUT /api/purchases - Update purchase
export async function PUT(request: NextRequest) {
  const locale = resolveRequestLocale(request);
  const explicitLocale = hasExplicitLocaleSignal(request);

  try {
    const parsedBody = await parseJsonBodyLocalized(request, {
      locale,
      includeCode: explicitLocale,
    });
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
      return purchaseError(
        "VALIDATION_ERROR",
        "crud.purchases.idRequired",
        "Purchase id is required",
        400,
        locale,
        explicitLocale
      );
    }

    if (merchant !== undefined && (typeof merchant !== "string" || merchant.trim() === "")) {
      return purchaseError(
        "VALIDATION_ERROR",
        "crud.purchases.merchantRequired",
        "Merchant name is required",
        400,
        locale,
        explicitLocale
      );
    }

    const parsedTotalAmount =
      totalAmount !== undefined ? parsePositiveFiniteNumber(totalAmount) : undefined;
    if (totalAmount !== undefined && parsedTotalAmount === null) {
      return purchaseError(
        "VALIDATION_ERROR",
        "crud.purchases.validTotalRequired",
        "Valid total amount is required",
        400,
        locale,
        explicitLocale
      );
    }

    let resolvedDate: Date | undefined;
    if (date !== undefined) {
      if (date === null || date === "") {
        resolvedDate = new Date();
      } else if (typeof date !== "string" || parseCivilDateStart(date) === null) {
        return purchaseError(
          "VALIDATION_ERROR",
          "validation.invalidDate",
          "Data inválida",
          400,
          locale,
          explicitLocale
        );
      } else {
        resolvedDate = new Date(date);
      }
    }

    if (notes !== undefined && typeof notes !== "string") {
      return purchaseError(
        "VALIDATION_ERROR",
        "validation.invalidNotes",
        "Observações inválidas",
        400,
        locale,
        explicitLocale
      );
    }

    const parsedInstallmentNumber =
      installmentNumber !== undefined ? parsePositiveInt(installmentNumber) : undefined;
    if (installmentNumber !== undefined && parsedInstallmentNumber === null) {
      return purchaseError(
        "VALIDATION_ERROR",
        "crud.purchases.invalidInstallmentNumber",
        "Número da parcela inválido",
        400,
        locale,
        explicitLocale
      );
    }

    const parsedInstallmentTotal =
      installmentTotal !== undefined ? parsePositiveInt(installmentTotal) : undefined;
    if (installmentTotal !== undefined && parsedInstallmentTotal === null) {
      return purchaseError(
        "VALIDATION_ERROR",
        "crud.purchases.invalidInstallmentTotal",
        "Total de parcelas inválido",
        400,
        locale,
        explicitLocale
      );
    }

    let parsedItems: NormalizedPurchaseItem[] | undefined;
    if (items !== undefined) {
      const result = parsePurchaseItems(items, true, locale, explicitLocale);
      if (!result.ok) {
        return apiErrorResponse("VALIDATION_ERROR", result.error, 400, {
          includeCode: explicitLocale,
        });
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
      return purchaseError(
        "VALIDATION_ERROR",
        "validation.invalidLinkId",
        "Identificador de vínculo inválido",
        400,
        locale,
        explicitLocale
      );
    }

    const existing = await db.purchase.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) {
      return purchaseError(
        "NOT_FOUND",
        "crud.purchases.notFound",
        "Purchase not found",
        404,
        locale,
        explicitLocale
      );
    }

    const relationError = await validatePurchaseRelations(
      {
        cardId: parsedCardId && parsedCardId.valid ? parsedCardId.value : null,
        accountId: parsedAccountId && parsedAccountId.valid ? parsedAccountId.value : null,
        categoryId: parsedCategoryId && parsedCategoryId.valid ? parsedCategoryId.value : null,
      },
      locale,
      explicitLocale
    );
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
    return purchaseError(
      "INTERNAL_ERROR",
      "crud.purchases.updateFailed",
      "Failed to update purchase",
      500,
      locale,
      explicitLocale
    );
  }
}

// DELETE /api/purchases - Delete purchase (cascade deletes items)
export async function DELETE(request: NextRequest) {
  const locale = resolveRequestLocale(request);
  const explicitLocale = hasExplicitLocaleSignal(request);

  try {
    const parsedBody = await parseJsonBodyLocalized(request, {
      locale,
      includeCode: explicitLocale,
    });
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const { id } = parsedBody.data;

    if (typeof id !== "string" || id.trim() === "") {
      return purchaseError(
        "VALIDATION_ERROR",
        "crud.purchases.idRequired",
        "Purchase id is required",
        400,
        locale,
        explicitLocale
      );
    }

    const existing = await db.purchase.findUnique({ where: { id } });
    if (!existing) {
      return purchaseError(
        "NOT_FOUND",
        "crud.purchases.notFound",
        "Purchase not found",
        404,
        locale,
        explicitLocale
      );
    }

    // PurchaseItem.purchase uses ON DELETE CASCADE in the database.
    await db.purchase.delete({ where: { id } });

    return apiSuccessMessage(
      explicitLocale
        ? translateApiMessage(locale, "crud.purchases.deleted")
        : "Purchase deleted"
    );
  } catch (error) {
    console.error("Error deleting purchase:", error);
    return purchaseError(
      "INTERNAL_ERROR",
      "crud.purchases.deleteFailed",
      "Failed to delete purchase",
      500,
      locale,
      explicitLocale
    );
  }
}
