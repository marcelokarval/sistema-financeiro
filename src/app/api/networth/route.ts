import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  apiErrorResponse,
  formatServerMonthLabel,
  resolveRequestLocale,
  toMonthKey,
  translateApiMessage,
} from '@/lib/server-i18n';

export async function GET(request?: Request | NextRequest) {
  const locale = resolveRequestLocale(request);
  try {
    const { searchParams } = new URL(request?.url ?? 'http://localhost');
    const monthsParam = searchParams.get('months');
    const months = Math.min(Math.max(parseInt(monthsParam || '6', 10) || 6, 1), 24);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // ─── Fetch current balances ─────────────────────────────────────
    const [
      accounts,
      cards,
      investments,
      savingsGoals,
      installmentPlans,
      consortiums,
      allTransactions,
      allPurchases,
    ] = await Promise.all([
      // Accounts: sum of balances
      db.account.findMany({
        where: { isActive: true },
        select: { id: true, balance: true },
      }),
      // Cards: sum of currentBalance (debt)
      db.card.findMany({
        where: { isActive: true },
        select: { id: true, currentBalance: true },
      }),
      // Investments: sum of currentBalance (asset)
      db.investment.findMany({
        where: { isActive: true },
        select: { id: true, currentBalance: true, investedAmount: true },
      }),
      // SavingsGoals: sum of currentAmount (asset)
      db.savingsGoal.findMany({
        select: { id: true, currentAmount: true, targetAmount: true },
      }),
      // InstallmentPlans: sum of PENDING and OVERDUE installments
      db.installmentPlan.findMany({
        where: { isActive: true, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
        select: {
          id: true,
          installments: {
            where: { status: { in: ['PENDING', 'OVERDUE'] } },
            select: { amount: true },
          },
        },
      }),
      // Consortiums: remaining = totalAmount - fundedAmount
      db.consortium.findMany({
        where: { isActive: true, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
        select: { id: true, totalAmount: true, fundedAmount: true },
      }),
      // Transactions for historical flow estimation (exclude TRANSFER)
      db.transaction.findMany({
        where: {
          type: { in: ['INCOME', 'EXPENSE'] },
          date: {
            gte: new Date(currentYear, currentMonth - (months - 1), 1),
            lte: new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999),
          },
        },
        select: { type: true, amount: true, date: true },
        orderBy: { date: 'asc' },
      }),
      // Purchases for historical flow estimation
      db.purchase.findMany({
        where: {
          date: {
            gte: new Date(currentYear, currentMonth - (months - 1), 1),
            lte: new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999),
          },
        },
        select: { totalAmount: true, date: true },
        orderBy: { date: 'asc' },
      }),
    ]);

    // ─── Current snapshot ───────────────────────────────────────────
    const accountBalances = accounts.reduce((sum, a) => sum + a.balance, 0);
    const cardDebt = cards.reduce((sum, c) => sum + c.currentBalance, 0);
    const investmentValues = investments.reduce((sum, inv) => sum + inv.currentBalance, 0);
    const savingsValues = savingsGoals.reduce((sum, sg) => sum + sg.currentAmount, 0);

    const installmentDebt = installmentPlans.reduce(
      (sum, ip) => sum + ip.installments.reduce((s, inst) => s + inst.amount, 0),
      0
    );

    const consortiumDebt = consortiums.reduce(
      (sum, c) => sum + Math.max(0, c.totalAmount - c.fundedAmount),
      0
    );

    const currentAssets = accountBalances + investmentValues + savingsValues;
    const currentLiabilities = cardDebt + installmentDebt + consortiumDebt;
    const currentNetWorth = currentAssets - currentLiabilities;

    // ─── Monthly transaction flows ──────────────────────────────────
    // For each past month, compute net flow = income - (expense + purchases)
    const monthlyFlows: number[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date(currentYear, currentMonth - i, 1);
      const monthEnd = new Date(currentYear, currentMonth - i + 1, 0, 23, 59, 59, 999);

      const monthTxnIncome = allTransactions
        .filter((t) => t.date >= monthStart && t.date <= monthEnd && t.type === 'INCOME')
        .reduce((s, t) => s + t.amount, 0);

      const monthTxnExpense = allTransactions
        .filter((t) => t.date >= monthStart && t.date <= monthEnd && t.type === 'EXPENSE')
        .reduce((s, t) => s + t.amount, 0);

      const monthPurchaseExpense = allPurchases
        .filter((p) => p.date >= monthStart && p.date <= monthEnd)
        .reduce((s, p) => s + p.totalAmount, 0);

      monthlyFlows.push(monthTxnIncome - monthTxnExpense - monthPurchaseExpense);
    }

    // ─── Build monthly data ─────────────────────────────────────────
    // Current month = current net worth
    // Past months = current net worth - cumulative future flows
    const monthlyData: {
      month: string;
      monthKey: string;
      netWorth: number;
      assets: number;
      liabilities: number;
      changePercent: number;
      changeAmount: number;
    }[] = [];
    for (let i = 0; i < months; i++) {
      const monthDate = new Date(currentYear, currentMonth - (months - 1) + i, 1);
      const label = formatServerMonthLabel(monthDate, locale);

      // Net worth for this month: subtract all flows from (month+1) to current
      let netWorth = currentNetWorth;
      for (let j = i + 1; j < months; j++) {
        netWorth -= monthlyFlows[j];
      }

      // Preserve coherent positive liabilities even when historical netWorth <= -currentLiabilities
      const liabilities = netWorth < -currentLiabilities
        ? Math.abs(netWorth)
        : currentLiabilities;
      const assets = Math.max(0, netWorth + liabilities);

      // Change from previous month
      const prevNetWorth = i > 0
        ? (() => {
            let prev = currentNetWorth;
            for (let j = i; j < months; j++) {
              prev -= monthlyFlows[j];
            }
            return prev;
          })()
        : null;

      const changeAmount = prevNetWorth !== null ? netWorth - prevNetWorth : 0;
      const changePercent = prevNetWorth !== null && prevNetWorth !== 0
        ? ((changeAmount / Math.abs(prevNetWorth)) * 100)
        : 0;

      monthlyData.push({
        month: label,
        monthKey: toMonthKey(monthDate),
        netWorth: Math.round(netWorth * 100) / 100,
        assets: Math.round(assets * 100) / 100,
        liabilities: Math.round(liabilities * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        changeAmount: Math.round(changeAmount * 100) / 100,
      });
    }

    return NextResponse.json({ monthlyData });
  } catch (error) {
    console.error('Erro ao buscar dados de patrimônio:', error);
    return apiErrorResponse(
      'INTERNAL_ERROR',
      translateApiMessage(locale, 'analytics.networthFetchFailed'),
      500
    );
  }
}
