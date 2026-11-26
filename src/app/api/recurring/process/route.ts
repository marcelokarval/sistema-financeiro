import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  apiErrorResponse,
  resolveRequestLocale,
  translateApiMessage,
} from "@/lib/server-i18n";

// Helper: advance nextDate based on frequency
function advanceDate(currentDate: Date, frequency: string): Date {
  const next = new Date(currentDate);
  switch (frequency) {
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "BIWEEKLY":
      next.setDate(next.getDate() + 14);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
    case "QUARTERLY":
      next.setMonth(next.getMonth() + 3);
      break;
    case "YEARLY":
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

// POST /api/recurring/process - Process due recurring transactions
export async function POST(request?: NextRequest) {
  const locale = resolveRequestLocale(request);

  try {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const processedCount = await db.$transaction(async (tx) => {
      // Find all active recurring transactions where nextDate <= today
      const dueTransactions = await tx.recurringTransaction.findMany({
        where: {
          isActive: true,
          nextDate: {
            lte: today,
          },
        },
        include: {
          category: true,
          account: true,
          card: true,
        },
      });

      let count = 0;

      for (const recurring of dueTransactions) {
        const newNextDate = advanceDate(recurring.nextDate, recurring.frequency);
        const claimed = await tx.recurringTransaction.updateMany({
          where: {
            id: recurring.id,
            isActive: true,
            nextDate: recurring.nextDate,
          },
          data: { nextDate: newNextDate },
        });

        if (claimed.count !== 1) {
          continue;
        }

        // Create actual transaction
        await tx.transaction.create({
          data: {
            type: recurring.type,
            amount: recurring.amount,
            description: `${recurring.description} (Recorrente)`,
            date: recurring.nextDate,
            categoryId: recurring.categoryId,
            accountId: recurring.accountId,
            cardId: recurring.cardId,
          },
        });

        // Update account balance if account is specified
        if (recurring.accountId) {
          if (recurring.type === "INCOME") {
            await tx.account.update({
              where: { id: recurring.accountId },
              data: { balance: { increment: recurring.amount } },
            });
          } else if (recurring.type === "EXPENSE") {
            await tx.account.update({
              where: { id: recurring.accountId },
              data: { balance: { decrement: recurring.amount } },
            });
          }
        }

        count++;
      }

      return count;
    });

    return NextResponse.json({
      success: true,
      processed: processedCount,
      message:
        processedCount > 0
          ? translateApiMessage(locale, "crud.recurring.processedCount", {
              count: processedCount,
            })
          : translateApiMessage(locale, "crud.recurring.nonePending"),
    });
  } catch (error) {
    console.error("Error processing recurring transactions:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "crud.recurring.processFailed"),
      500
    );
  }
}
