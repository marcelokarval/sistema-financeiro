import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Parallel queries
    const [cards, installmentPlans, consortiums, monthlyIncomeTransactions] = await Promise.all([
      // All active credit cards
      db.card.findMany({
        where: { isActive: true, type: 'CREDIT' },
        orderBy: { name: 'asc' },
      }),

      // All active installment plans
      db.installmentPlan.findMany({
        where: { status: { in: ['ACTIVE', 'OVERDUE'] } },
        include: { card: true },
        orderBy: { description: 'asc' },
      }),

      // All active consortiums
      db.consortium.findMany({
        where: { status: { in: ['ACTIVE', 'CONTEMPLATED'] } },
        orderBy: { description: 'asc' },
      }),

      // Current month income transactions
      db.transaction.findMany({
        where: {
          type: 'INCOME',
          date: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
    ]);

    // Card debt: sum of currentBalance
    const cardDebt = cards.reduce((sum, c) => sum + c.currentBalance, 0);
    const cardItems = cards.map((c) => ({
      id: c.id,
      name: c.name,
      brand: c.brand,
      lastFourDigits: c.lastFourDigits,
      creditLimit: c.creditLimit,
      currentBalance: c.currentBalance,
      utilizationRate: c.creditLimit > 0 ? (c.currentBalance / c.creditLimit) * 100 : 0,
      color: c.color,
      dueDay: c.dueDay,
    }));

    // Installment debt: totalAmount - (paidInstallments * monthlyValue)
    let installmentDebt = 0;
    const installmentItems = installmentPlans.map((ip) => {
      const paid = ip.paidInstallments * ip.monthlyValue;
      const remaining = ip.totalAmount - paid;
      installmentDebt += remaining;
      return {
        id: ip.id,
        description: ip.description,
        totalAmount: ip.totalAmount,
        paidAmount: paid,
        remaining,
        installmentCount: ip.installmentCount,
        paidInstallments: ip.paidInstallments,
        monthlyValue: ip.monthlyValue,
        interestRate: ip.interestRate,
        type: ip.type,
        status: ip.status,
        cardName: ip.card?.name ?? null,
        nextPaymentDate: ip.nextPaymentDate,
      };
    });

    // Consortium debt: totalAmount - fundedAmount
    let consortiumDebt = 0;
    const consortiumItems = consortiums.map((c) => {
      const remaining = c.totalAmount - c.fundedAmount;
      consortiumDebt += remaining;
      return {
        id: c.id,
        description: c.description,
        group: c.group,
        quota: c.quota,
        administrator: c.administrator,
        totalAmount: c.totalAmount,
        fundedAmount: c.fundedAmount,
        remaining,
        monthlyPayment: c.monthlyPayment,
        installmentCount: c.installmentCount,
        paidInstallments: c.paidInstallments,
        startDate: c.startDate,
        endDate: c.endDate,
        status: c.status,
        progress: c.installmentCount > 0 ? (c.paidInstallments / c.installmentCount) * 100 : 0,
      };
    });

    // Total debt
    const totalDebt = cardDebt + installmentDebt + consortiumDebt;

    // Monthly income for debt-to-income ratio
    const monthlyIncome = monthlyIncomeTransactions.reduce((sum, t) => sum + t.amount, 0);
    const debtToIncomeRatio = monthlyIncome > 0 ? (totalDebt / monthlyIncome) * 100 : 0;

    return NextResponse.json({
      totalDebt: Math.round(totalDebt * 100) / 100,
      cardDebt: Math.round(cardDebt * 100) / 100,
      installmentDebt: Math.round(installmentDebt * 100) / 100,
      consortiumDebt: Math.round(consortiumDebt * 100) / 100,
      debtToIncomeRatio: Math.round(debtToIncomeRatio * 10) / 10,
      monthlyIncome: Math.round(monthlyIncome * 100) / 100,
      cards: cardItems,
      installments: installmentItems,
      consortiums: consortiumItems,
    });
  } catch (error) {
    console.error('Erro ao buscar dados de dívidas:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar dados de dívidas.' },
      { status: 500 }
    );
  }
}
