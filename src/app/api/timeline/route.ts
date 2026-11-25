import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { toLocalCivilDateKey } from '@/lib/api-validation';

interface TimelineItem {
  type: 'transaction' | 'purchase';
  description: string;
  amount: number;
  category: string;
}

interface TimelineDay {
  date: string;
  income: number;
  expense: number;
  net: number;
  count: number;
  runningBalance: number;
  items: TimelineItem[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days');
    let days = parseInt(daysParam || '30', 10);

    if (isNaN(days) || days < 1) days = 30;
    if (days > 90) days = 90;

    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    // Fetch all transactions and purchases in parallel
    const [transactions, purchases] = await Promise.all([
      db.transaction.findMany({
        where: {
          type: { in: ['INCOME', 'EXPENSE'] },
          date: { gte: startDate, lte: endDate },
        },
        include: { category: true },
        orderBy: { date: 'desc' },
      }),
      db.purchase.findMany({
        where: {
          date: { gte: startDate, lte: endDate },
        },
        include: { category: true },
        orderBy: { date: 'desc' },
      }),
    ]);

    // Build a map of date -> items
    const dateMap = new Map<string, TimelineItem[]>();

    for (const tx of transactions) {
      const dateKey = toLocalCivilDateKey(tx.date);
      const items = dateMap.get(dateKey) || [];
      const isIncome = tx.type === 'INCOME';
      items.push({
        type: 'transaction',
        description: tx.description,
        amount: isIncome ? tx.amount : -tx.amount,
        category: tx.category?.name || 'Sem categoria',
      });
      dateMap.set(dateKey, items);
    }

    for (const p of purchases) {
      const dateKey = toLocalCivilDateKey(p.date);
      const items = dateMap.get(dateKey) || [];
      items.push({
        type: 'purchase',
        description: p.merchant,
        amount: -p.totalAmount,
        category: p.category?.name || 'Sem categoria',
      });
      dateMap.set(dateKey, items);
    }

    // Build array of all dates in range
    const result: TimelineDay[] = [];
    let runningBalance = 0;

    // We need to go from oldest to newest for running balance, then reverse for desc output
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateKey = toLocalCivilDateKey(currentDate);
      const items = dateMap.get(dateKey) || [];

      let income = 0;
      let expense = 0;

      for (const item of items) {
        if (item.amount > 0) {
          income += item.amount;
        } else {
          expense += Math.abs(item.amount);
        }
      }

      const net = income - expense;
      runningBalance += net;

      result.push({
        date: dateKey,
        income: Math.round(income * 100) / 100,
        expense: Math.round(expense * 100) / 100,
        net: Math.round(net * 100) / 100,
        count: items.length,
        runningBalance: Math.round(runningBalance * 100) / 100,
        items,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Sort desc by date
    result.sort((a, b) => b.date.localeCompare(a.date));

    // Recompute running balance in desc order (cumulative from end backwards)
    // Actually, runningBalance should represent cumulative net from oldest day to that day
    // Since we computed it chronologically, we just need to reverse the running balance display
    // The running balance for each day should be the cumulative net from start up to that day
    // When sorted desc, the "latest" day has the most recent running balance
    // Let's recompute properly: running balance = sum of net from oldest to this day
    // We already have that correct in chronological order. But since we sort desc, we need to remap.
    // Actually the running balance stored is correct for each day regardless of sort order.
    // The runningBalance for a given date represents the cumulative net from startDate to that date.

    return NextResponse.json(result);
  } catch (error) {
    console.error('Erro ao buscar linha do tempo:', error);
    return NextResponse.json(
      { error: 'Falha ao buscar dados da linha do tempo' },
      { status: 500 }
    );
  }
}
