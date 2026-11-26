import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { civilPurchaseDate } from "@/lib/purchase-date";
import {
  apiErrorResponse,
  formatServerWeekdayShort,
  resolveRequestLocale,
  translateApiMessage,
} from "@/lib/server-i18n";
import {
  addDays,
  addWeeks,
  addMonths,
  addQuarters,
  addYears,
  format,
  startOfDay,
  isBefore,
  isSameDay,
  parseISO,
} from "date-fns";

// ─── Types ──────────────────────────────────────────────────────────
interface CalendarEvent {
  id: string;
  type: "transaction" | "purchase" | "recurring";
  description: string;
  amount: number;
  time?: string;
  category?: string;
  account?: string;
  isRecurring: boolean;
}

interface CalendarDay {
  date: string;
  dateKey: string;
  dayOfWeek: string;
  dayIndex: number;
  income: number;
  expense: number;
  events: CalendarEvent[];
}

interface CalendarSummary {
  totalUpcoming: number;
  totalBills: number;
  totalIncome: number;
  totalExpense: number;
  upcomingBiggestExpense: { description: string; amount: number; date: string } | null;
  nextPaymentDate: string | null;
}

interface CalendarResponse {
  days: CalendarDay[];
  summary: CalendarSummary;
}

// ─── Helpers ────────────────────────────────────────────────────────
function getNextOccurrences(nextDate: Date, frequency: string, endDate: Date): Date[] {
  const occurrences: Date[] = [];
  let current = new Date(nextDate);

  while (isBefore(current, endDate) || isSameDay(current, endDate)) {
    occurrences.push(new Date(current));

    switch (frequency) {
      case "WEEKLY":
        current = addWeeks(current, 1);
        break;
      case "BIWEEKLY":
        current = addWeeks(current, 2);
        break;
      case "MONTHLY":
        current = addMonths(current, 1);
        break;
      case "QUARTERLY":
        current = addQuarters(current, 1);
        break;
      case "YEARLY":
        current = addYears(current, 1);
        break;
      default:
        current = addMonths(current, 1);
    }

    // Safety: max 100 occurrences per recurring transaction
    if (occurrences.length >= 100) break;
  }

  return occurrences;
}

// ─── GET Handler ─────────────────────────────────────────────────────
export async function GET(request?: NextRequest) {
  const locale = resolveRequestLocale(request);
  try {
    const { searchParams } = new URL(request?.url ?? "http://localhost");
    let days = parseInt(searchParams.get("days") || "30", 10);

    // Clamp days to 7-90
    if (isNaN(days) || days < 7) days = 7;
    if (days > 90) days = 90;

    const today = startOfDay(new Date());
    const endDate = addDays(today, days);

    // Parallel fetches
    const [transactions, purchases, recurring] = await Promise.all([
      db.transaction.findMany({
        where: {
          type: { in: ["INCOME", "EXPENSE"] },
          date: {
            gte: today,
            lte: endDate,
          },
        },
        include: {
          category: true,
          account: true,
        },
        orderBy: { date: "asc" },
      }),
      db.purchase.findMany({
        where: {
          date: {
            gte: today,
            lte: endDate,
          },
        },
        include: {
          category: true,
          card: true,
        },
        orderBy: { date: "asc" },
      }),
      db.recurringTransaction.findMany({
        where: {
          isActive: true,
        },
        include: {
          category: true,
          account: true,
          card: true,
        },
      }),
    ]);

    // Build date → events map
    const dayMap = new Map<string, CalendarEvent[]>();

    // Seed all days in range
    for (let i = 0; i <= days; i++) {
      const d = addDays(today, i);
      const key = format(d, "yyyy-MM-dd");
      dayMap.set(key, []);
    }

    // Add transactions
    for (const tx of transactions) {
      const key = format(new Date(tx.date), "yyyy-MM-dd");
      if (!dayMap.has(key)) continue;

      const isIncome = tx.type === "INCOME";
      dayMap.get(key)!.push({
        id: tx.id,
        type: "transaction",
        description: tx.description,
        amount: isIncome ? tx.amount : -tx.amount,
        time: format(new Date(tx.date), "HH:mm"),
        category: tx.category?.name,
        account: tx.account?.name,
        isRecurring: false,
      });
    }

    // Add purchases (always expense)
    for (const purchase of purchases) {
      const civil = civilPurchaseDate(purchase.date);
      const key = civil ?? format(purchase.date, "yyyy-MM-dd");
      if (!dayMap.has(key)) continue;

      dayMap.get(key)!.push({
        id: purchase.id,
        type: "purchase",
        description: purchase.merchant,
        amount: -purchase.totalAmount,
        ...(civil === undefined && { time: format(purchase.date, "HH:mm") }),
        category: purchase.category?.name,
        account: purchase.card?.name,
        isRecurring: false,
      });
    }

    // Add recurring transactions (projected occurrences)
    for (const rec of recurring) {
      const occurrences = getNextOccurrences(new Date(rec.nextDate), rec.frequency, endDate);

      for (const occ of occurrences) {
        const key = format(occ, "yyyy-MM-dd");
        if (!dayMap.has(key)) continue;

        const isIncome = rec.type === "INCOME";
        dayMap.get(key)!.push({
          id: `rec-${rec.id}-${key}`,
          type: "recurring",
          description: rec.description,
          amount: isIncome ? rec.amount : -rec.amount,
          category: rec.category?.name,
          account: rec.account?.name,
          isRecurring: true,
        });
      }
    }

    // Build days array
    const daysArray: CalendarDay[] = [];

    let totalIncome = 0;
    let totalExpense = 0;
    let biggestExpense: { description: string; amount: number; date: string } | null = null;
    let nextPaymentDate: string | null = null;
    let totalEvents = 0;
    let totalBills = 0;

    // Sort events within each day (recurring first, then by time)
    for (const [dateStr, events] of dayMap) {
      events.sort((a, b) => {
        if (a.type === "recurring" && b.type !== "recurring") return -1;
        if (a.type !== "recurring" && b.type === "recurring") return 1;
        return (a.time || "").localeCompare(b.time || "");
      });

      const income = events
        .filter((e) => e.amount > 0)
        .reduce((sum, e) => sum + e.amount, 0);
      const expense = events
        .filter((e) => e.amount < 0)
        .reduce((sum, e) => sum + Math.abs(e.amount), 0);

      const dateObj = parseISO(dateStr);
      const dayIndex = dateObj.getDay();
      const dayOfWeek = formatServerWeekdayShort(dayIndex, locale);

      daysArray.push({
        date: dateStr,
        dateKey: dateStr,
        dayOfWeek,
        dayIndex,
        income,
        expense,
        events,
      });

      totalIncome += income;
      totalExpense += expense;
      totalEvents += events.length;

      // Track bills (expenses) count
      const dayExpenses = events.filter((e) => e.amount < 0);
      totalBills += dayExpenses.length;

      // Track biggest expense
      for (const ev of dayExpenses) {
        const absAmount = Math.abs(ev.amount);
        if (!biggestExpense || absAmount > biggestExpense.amount) {
          biggestExpense = {
            description: ev.description,
            amount: absAmount,
            date: dateStr,
          };
        }
      }

      // Find first future date with expenses (next payment)
      if (!nextPaymentDate && dateObj >= today && dayExpenses.length > 0) {
        nextPaymentDate = dateStr;
      }
    }

    // Build summary
    const summary: CalendarSummary = {
      totalUpcoming: totalEvents,
      totalBills,
      totalIncome,
      totalExpense,
      upcomingBiggestExpense: biggestExpense,
      nextPaymentDate,
    };

    const response: CalendarResponse = { days: daysArray, summary };
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching financial calendar:", error);
    return apiErrorResponse(
      "INTERNAL_ERROR",
      translateApiMessage(locale, "calendar.fetchFailed"),
      500
    );
  }
}
