import { NextResponse } from "next/server";
import { db } from "@/lib/db";

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
export async function POST() {
  try {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Find all active recurring transactions where nextDate <= today
    const dueTransactions = await db.recurringTransaction.findMany({
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

    let processedCount = 0;

    for (const recurring of dueTransactions) {
      // Create actual transaction
      await db.transaction.create({
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
          await db.account.update({
            where: { id: recurring.accountId },
            data: { balance: { increment: recurring.amount } },
          });
        } else if (recurring.type === "EXPENSE") {
          await db.account.update({
            where: { id: recurring.accountId },
            data: { balance: { decrement: recurring.amount } },
          });
        }
      }

      // Advance the nextDate
      const newNextDate = advanceDate(recurring.nextDate, recurring.frequency);
      await db.recurringTransaction.update({
        where: { id: recurring.id },
        data: { nextDate: newNextDate },
      });

      processedCount++;
    }

    return NextResponse.json({
      success: true,
      processed: processedCount,
      message:
        processedCount > 0
          ? `${processedCount} transação(ões) recorrente(s) processada(s)`
          : "Nenhuma transação recorrente pendente",
    });
  } catch (error) {
    console.error("Error processing recurring transactions:", error);
    return NextResponse.json(
      { error: "Erro ao processar transações recorrentes" },
      { status: 500 }
    );
  }
}
