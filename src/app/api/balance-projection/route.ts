import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let months = parseInt(searchParams.get('months') || '6', 10);
    months = Math.max(1, Math.min(12, isNaN(months) ? 6 : months));

    // ── Fetch all active accounts ──
    const accounts = await db.account.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    // ── Date range: last 3 complete months ──
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const threeCompleteMonthsEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
      999
    );

    // ── Fetch transactions (income + expense) in last 3 complete months ──
    const transactions = await db.transaction.findMany({
      where: {
        date: { gte: threeMonthsAgo, lte: threeCompleteMonthsEnd },
        type: { in: ['INCOME', 'EXPENSE'] },
        accountId: { not: null },
      },
    });

    // ── Fetch purchases (expenses) in last 3 complete months ──
    const purchases = await db.purchase.findMany({
      where: {
        date: { gte: threeMonthsAgo, lte: threeCompleteMonthsEnd },
        accountId: { not: null },
      },
    });

    // ── Per-account averages ──
    const totalMonths = 3;

    const accountProjections = accounts.map((account) => {
      // Income from transactions
      const accountIncome = transactions
        .filter((t) => t.accountId === account.id && t.type === 'INCOME')
        .reduce((sum, t) => sum + t.amount, 0);

      // Expense from transactions
      const accountExpense = transactions
        .filter((t) => t.accountId === account.id && t.type === 'EXPENSE')
        .reduce((sum, t) => sum + t.amount, 0);

      // Expense from purchases
      const purchaseExpense = purchases
        .filter((p) => p.accountId === account.id)
        .reduce((sum, p) => sum + p.totalAmount, 0);

      const avgMonthlyIncome = accountIncome / totalMonths;
      const avgMonthlyExpense = (accountExpense + purchaseExpense) / totalMonths;
      const monthlyNet = avgMonthlyIncome - avgMonthlyExpense;

      // Project future balances
      const projectedBalances: number[] = [];
      for (let m = 0; m <= months; m++) {
        projectedBalances.push(Math.round(account.balance + monthlyNet * m));
      }

      // Trend
      const lastProjected = projectedBalances[projectedBalances.length - 1];
      const diff = lastProjected - account.balance;
      const pctThreshold = Math.abs(account.balance) * 0.05;
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (diff > pctThreshold) trend = 'up';
      else if (diff < -pctThreshold) trend = 'down';

      return {
        accountId: account.id,
        accountName: account.name,
        accountColor: account.color,
        accountType: account.type,
        currentBalance: account.balance,
        projectedBalances,
        avgMonthlyIncome: Math.round(avgMonthlyIncome),
        avgMonthlyExpense: Math.round(avgMonthlyExpense),
        monthlyNet: Math.round(monthlyNet),
        trend,
      };
    });

    // ── Totals ──
    const totalCurrentBalance = accounts.reduce((s, a) => s + a.balance, 0);
    const totalProjected = accountProjections.length > 0
      ? accountProjections.reduce((s, a) => s + a.projectedBalances[months], 0)
      : 0;
    const totalAvgIncome = accountProjections.reduce((s, a) => s + a.avgMonthlyIncome, 0);
    const totalAvgExpense = accountProjections.reduce((s, a) => s + a.avgMonthlyExpense, 0);
    const averageMonthlySavings = totalAvgIncome - totalAvgExpense;

    // ── Risk level ──
    const savingsRate = totalAvgIncome > 0 ? (averageMonthlySavings / totalAvgIncome) * 100 : 0;
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';
    if (savingsRate > 20) riskLevel = 'low';
    else if (savingsRate < 0) riskLevel = 'high';

    // ── Month labels ──
    const monthLabels: string[] = [];
    for (let m = 0; m <= months; m++) {
      const d = new Date(now.getFullYear(), now.getMonth() + m, 1);
      monthLabels.push(
        d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      );
    }

    return NextResponse.json({
      accounts: accountProjections,
      monthLabels,
      totalCurrentBalance: Math.round(totalCurrentBalance),
      totalProjected: Math.round(totalProjected),
      averageMonthlySavings: Math.round(averageMonthlySavings),
      savingsRate: Math.round(savingsRate * 10) / 10,
      riskLevel,
      months,
    });
  } catch (error) {
    console.error('Erro ao calcular projeção de saldo:', error);
    return NextResponse.json(
      { error: 'Erro ao calcular projeção de saldo.' },
      { status: 500 }
    );
  }
}
