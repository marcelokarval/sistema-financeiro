import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { format, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export async function GET() {
  try {
    const [budgetGoals, savingsGoals, investments] = await Promise.all([
      db.budgetGoal.findMany({
        include: { category: { select: { id: true, name: true, color: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      db.savingsGoal.findMany({
        orderBy: { createdAt: 'desc' },
      }),
      db.investment.findMany({
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // ── Budget Goals ──────────────────────────────────────────────
    const mappedBudgetGoals = budgetGoals.map((g) => {
      const progress = g.targetAmount > 0 ? Math.min((g.currentAmount / g.targetAmount) * 100, 100) : 0;
      return {
        id: g.id,
        name: g.name,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        progress: Math.round(progress * 10) / 10,
        isCompleted: g.isCompleted || g.currentAmount >= g.targetAmount,
        categoryName: g.category?.name || null,
        categoryColor: g.category?.color || null,
        startDate: g.startDate,
        endDate: g.endDate,
      };
    });

    // ── Savings Goals ─────────────────────────────────────────────
    const mappedSavingsGoals = savingsGoals.map((g) => {
      const progress = g.targetAmount > 0 ? Math.min((g.currentAmount / g.targetAmount) * 100, 100) : 0;
      return {
        id: g.id,
        name: g.name,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        progress: Math.round(progress * 10) / 10,
        isCompleted: g.isCompleted || g.currentAmount >= g.targetAmount,
        monthlyContribution: g.monthlyContribution || 0,
        type: g.type,
        color: g.color,
        startDate: g.startDate,
        targetDate: g.targetDate,
        yieldRate: g.yieldRate || 0,
      };
    });

    // ── Investments ──────────────────────────────────────────────
    const mappedInvestments = investments.map((inv) => {
      const returnRate = inv.investedAmount > 0
        ? ((inv.currentBalance - inv.investedAmount) / inv.investedAmount) * 100
        : 0;
      const progress = inv.investedAmount > 0
        ? Math.min((inv.currentBalance / inv.investedAmount) * 100, 100)
        : 0;
      return {
        id: inv.id,
        name: inv.name,
        type: inv.type,
        currentAmount: inv.currentBalance,
        totalInvested: inv.investedAmount,
        returnRate: Math.round(returnRate * 100) / 100,
        progress: Math.round(progress * 10) / 10,
        ticker: inv.ticker || null,
      };
    });

    // ── Summary Computation ──────────────────────────────────────
    const allGoals = [...mappedBudgetGoals, ...mappedSavingsGoals];
    const totalGoals = allGoals.length + mappedInvestments.length;
    const completedGoals = [...allGoals.filter((g) => g.isCompleted), ...mappedInvestments].length;
    const inProgressGoals = totalGoals - completedGoals;

    const totalTargetAmount = allGoals.reduce((sum, g) => sum + g.targetAmount, 0)
      + mappedInvestments.reduce((sum, inv) => sum + inv.totalInvested, 0);
    const totalCurrentAmount = allGoals.reduce((sum, g) => sum + g.currentAmount, 0)
      + mappedInvestments.reduce((sum, inv) => sum + inv.currentAmount, 0);

    const overallProgress = totalTargetAmount > 0
      ? Math.min((totalCurrentAmount / totalTargetAmount) * 100, 100)
      : 0;

    // Estimated completion: based on average monthly contribution from active savings goals
    const activeGoalsWithContrib = mappedSavingsGoals.filter(
      (g) => !g.isCompleted && g.monthlyContribution > 0
    );
    let estimatedCompletion: string | null = null;
    if (activeGoalsWithContrib.length > 0) {
      const totalRemaining = activeGoalsWithContrib.reduce(
        (sum, g) => sum + Math.max(g.targetAmount - g.currentAmount, 0),
        0
      );
      const totalMonthlyContrib = activeGoalsWithContrib.reduce(
        (sum, g) => sum + g.monthlyContribution,
        0
      );
      if (totalMonthlyContrib > 0 && totalRemaining > 0) {
        const monthsToComplete = Math.ceil(totalRemaining / totalMonthlyContrib);
        estimatedCompletion = format(addMonths(new Date(), monthsToComplete), 'MMM yyyy', { locale: ptBR });
      }
    }

    return NextResponse.json({
      summary: {
        totalGoals,
        completedGoals,
        inProgressGoals,
        totalTargetAmount: Math.round(totalTargetAmount * 100) / 100,
        totalCurrentAmount: Math.round(totalCurrentAmount * 100) / 100,
        overallProgress: Math.round(overallProgress * 10) / 10,
        estimatedCompletion,
      },
      budgetGoals: mappedBudgetGoals,
      savingsGoals: mappedSavingsGoals,
      investments: mappedInvestments,
    });
  } catch (error) {
    console.error('Erro ao carregar central de metas:', error);
    return NextResponse.json(
      { error: 'Erro interno ao carregar dados das metas' },
      { status: 500 }
    );
  }
}
