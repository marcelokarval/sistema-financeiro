import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // End of this week (Sunday)
    const dayOfWeek = now.getDay();
    const endOfWeek = new Date(todayStart);
    endOfWeek.setDate(endOfWeek.getDate() + (7 - dayOfWeek));
    endOfWeek.setHours(23, 59, 59, 999);

    // End of this month
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // 30 days from now
    const in30Days = new Date(now);
    in30Days.setDate(in30Days.getDate() + 30);
    in30Days.setHours(23, 59, 59, 999);

    // ─── Parallel fetches ──────────────────────────────────────────
    const [
      pendingInstallments,
      pendingConsortiumInstallments,
      activeCards,
      recurringTransactions,
    ] = await Promise.all([
      // 1. Pending installments due within 30 days
      db.installment.findMany({
        where: {
          status: { in: ['PENDING', 'OVERDUE'] },
          dueDate: { lte: in30Days },
        },
        include: {
          installmentPlan: {
            include: { card: true, category: true },
          },
        },
        orderBy: { dueDate: 'asc' },
      }),

      // 2. Pending consortium installments due within 30 days
      db.consortiumInstallment.findMany({
        where: {
          status: { in: ['PENDING', 'OVERDUE'] },
          dueDate: { lte: in30Days },
        },
        include: {
          consortium: true,
        },
        orderBy: { dueDate: 'asc' },
      }),

      // 3. Active credit cards (to calculate closing/due dates)
      db.card.findMany({
        where: { isActive: true, type: 'CREDIT' },
        orderBy: { dueDay: 'asc' },
      }),

      // 4. Active recurring transactions with nextDate within 30 days
      db.recurringTransaction.findMany({
        where: {
          isActive: true,
          nextDate: { lte: in30Days },
        },
        include: { category: true, card: true, account: true },
        orderBy: { nextDate: 'asc' },
      }),
    ]);

    // ─── Normalize bills into unified array ────────────────────────
    type Bill = {
      id: string;
      type: 'installment' | 'consortium' | 'card' | 'recurring';
      title: string;
      amount: number;
      dueDate: string;
      daysUntilDue: number;
      status: 'overdue' | 'urgent' | 'upcoming' | 'later';
      source: string;
    };

    const bills: Bill[] = [];

    // 1. Installments
    for (const inst of pendingInstallments) {
      const dueDate = new Date(inst.dueDate);
      const diffMs = dueDate.getTime() - now.getTime();
      const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const status = daysUntil < 0 ? 'overdue' : daysUntil <= 3 ? 'urgent' : daysUntil <= 7 ? 'upcoming' : 'later';

      bills.push({
        id: inst.id,
        type: 'installment',
        title: inst.installmentPlan.description,
        amount: inst.amount,
        dueDate: inst.dueDate.toISOString(),
        daysUntilDue: daysUntil,
        status,
        source: inst.installmentPlan.type || 'Parcelamento',
      });
    }

    // 2. Consortium installments
    for (const ci of pendingConsortiumInstallments) {
      const dueDate = new Date(ci.dueDate);
      const diffMs = dueDate.getTime() - now.getTime();
      const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const status = daysUntil < 0 ? 'overdue' : daysUntil <= 3 ? 'urgent' : daysUntil <= 7 ? 'upcoming' : 'later';

      bills.push({
        id: ci.id,
        type: 'consortium',
        title: ci.consortium.description,
        amount: ci.amount,
        dueDate: ci.dueDate.toISOString(),
        daysUntilDue: daysUntil,
        status,
        source: 'Consórcio',
      });
    }

    // 3. Credit cards - closing date = when statement closes, due day = when payment is due
    // We show the payment due date as the "bill"
    for (const card of activeCards) {
      // Calculate this month's due date
      let dueDateThisMonth = new Date(now.getFullYear(), now.getMonth(), card.dueDay);
      // If due day already passed this month, show next month's
      if (dueDateThisMonth < todayStart) {
        dueDateThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, card.dueDay);
      }

      const diffMs = dueDateThisMonth.getTime() - now.getTime();
      const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      // Only include if within 30 days
      if (daysUntil <= 30) {
        const status = daysUntil < 0 ? 'overdue' : daysUntil <= 3 ? 'urgent' : daysUntil <= 7 ? 'upcoming' : 'later';
        bills.push({
          id: `card-${card.id}`,
          type: 'card',
          title: `Fatura ${card.name}`,
          amount: card.currentBalance,
          dueDate: dueDateThisMonth.toISOString(),
          daysUntilDue: daysUntil,
          status,
          source: `${card.brand} ****${card.lastFourDigits}`,
        });
      }
    }

    // 4. Recurring transactions
    for (const rt of recurringTransactions) {
      const dueDate = new Date(rt.nextDate);
      const diffMs = dueDate.getTime() - now.getTime();
      const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const status = daysUntil < 0 ? 'overdue' : daysUntil <= 3 ? 'urgent' : daysUntil <= 7 ? 'upcoming' : 'later';

      bills.push({
        id: rt.id,
        type: 'recurring',
        title: rt.description,
        amount: rt.amount,
        dueDate: rt.nextDate.toISOString(),
        daysUntilDue: daysUntil,
        status,
        source: 'Recorrente',
      });
    }

    // ─── Sort by daysUntilDue ──────────────────────────────────────
    bills.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

    // ─── Calculate summary ─────────────────────────────────────────
    const overdueBills = bills.filter((b) => b.status === 'overdue');
    const urgentBills = bills.filter((b) => b.status === 'urgent');
    const upcomingBills = bills.filter((b) => b.status === 'upcoming');
    const laterBills = bills.filter((b) => b.status === 'later');

    // This week: due by end of week (overdue + urgent + some upcoming)
    const thisWeekBills = bills.filter((b) => {
      const bd = new Date(b.dueDate);
      return bd <= endOfWeek;
    });

    // This month: due by end of month
    const thisMonthBills = bills.filter((b) => {
      const bd = new Date(b.dueDate);
      return bd <= endOfMonth;
    });

    // All 30 days
    const all30Bills = bills;

    const summary = {
      thisWeek: {
        count: thisWeekBills.length,
        amount: Math.round(thisWeekBills.reduce((s, b) => s + b.amount, 0) * 100) / 100,
      },
      thisMonth: {
        count: thisMonthBills.length,
        amount: Math.round(thisMonthBills.reduce((s, b) => s + b.amount, 0) * 100) / 100,
      },
      totalAmount: Math.round(bills.reduce((s, b) => s + b.amount, 0) * 100) / 100,
      overdueCount: overdueBills.length,
      urgentCount: urgentBills.length,
      upcomingCount: upcomingBills.length,
      laterCount: laterBills.length,
    };

    return NextResponse.json({ bills, summary });
  } catch (error) {
    console.error('Erro ao buscar próximos pagamentos:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar próximos pagamentos.' },
      { status: 500 }
    );
  }
}
