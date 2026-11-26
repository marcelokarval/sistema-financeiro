import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import {
  apiErrorResponse,
  formatServerCurrencyBRL,
  resolveRequestLocale,
  translateApiMessage,
} from '@/lib/server-i18n';

// ─── Types ──────────────────────────────────────────────────────
interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'poupanca' | 'controle' | 'investimento' | 'exploracao';
  unlocked: boolean;
  progress: number;
  currentValue: number;
  targetValue: number;
  unlockedAt: string | null;
}

// ─── GET /api/achievements ──────────────────────────────────────
export async function GET(request?: NextRequest) {
  const locale = resolveRequestLocale(request);

  try {
    // ── Current month boundaries ───────────────────────────────
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

    // ── Fetch all needed data in parallel ──────────────────────
    const [
      accounts,
      cards,
      transactions,
      purchases,
      savingsGoals,
      investments,
      allCategories,
      installmentPlans,
    ] = await Promise.all([
      db.account.findMany({ where: { isActive: true } }),
      db.card.findMany({ where: { isActive: true } }),
      db.transaction.findMany({
        where: { date: { gte: monthStart, lte: monthEnd } },
      }),
      db.purchase.findMany({
        where: { date: { gte: monthStart, lte: monthEnd } },
      }),
      db.savingsGoal.findMany(),
      db.investment.findMany({ where: { isActive: true } }),
      db.category.findMany({ where: { isActive: true } }),
      db.installmentPlan.findMany({ where: { isActive: true } }),
    ]);

    // ── Computed metrics ──────────────────────────────────────
    // Current month income from transactions
    const monthIncome = transactions
      .filter((t) => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0);

    // Current month expenses from transactions + purchases
    const monthExpenseTx = transactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);

    const monthExpensePurchases = purchases.reduce(
      (sum, p) => sum + p.totalAmount,
      0
    );

    const monthExpense = monthExpenseTx + monthExpensePurchases;
    const savingsRate =
      monthIncome > 0 ? ((monthIncome - monthExpense) / monthIncome) * 100 : 0;

    // Categories in use (have at least one transaction or purchase)
    const usedCategoryIds = new Set<string>();
    transactions.forEach((t) => {
      if (t.categoryId) usedCategoryIds.add(t.categoryId);
    });
    purchases.forEach((p) => {
      if (p.categoryId) usedCategoryIds.add(p.categoryId);
    });
    const categoriesInUse = usedCategoryIds.size;

    // All card balances zero?
    const allCardsZeroBalance = cards.every((c) => c.currentBalance === 0);

    // Completed savings goals
    const completedGoals = savingsGoals.filter((g) => g.isCompleted);

    // Net worth: total account balance - total card balance
    const totalAccountBalance = accounts.reduce(
      (sum, a) => sum + a.balance,
      0
    );
    const totalCardBalance = cards.reduce(
      (sum, c) => sum + c.currentBalance,
      0
    );
    const totalInvestmentBalance = investments.reduce(
      (sum, inv) => sum + inv.currentBalance,
      0
    );
    const netWorth =
      totalAccountBalance + totalInvestmentBalance - totalCardBalance;

    // Feature usage flags
    const hasInvestments = investments.length > 0;
    const hasSavingsGoals = savingsGoals.length > 0;
    const hasInstallments = installmentPlans.length > 0;

    // ── Build achievements array ──────────────────────────────
    const achievements: Achievement[] = [
      // 1. Primeira Economia
      {
        id: 'primeira-economia',
        title: translateApiMessage(locale, 'achievements.items.primeira-economia.title'),
        description: translateApiMessage(locale, 'achievements.items.primeira-economia.description'),
        icon: 'PiggyBank',
        category: 'poupanca',
        unlocked: monthIncome > monthExpense && monthIncome > 0,
        progress: monthIncome > 0
          ? Math.min(100, (Math.max(0, monthIncome - monthExpense) / monthIncome) * 100)
          : 0,
        currentValue: Math.max(0, monthIncome - monthExpense),
        targetValue: monthIncome > 0 ? monthIncome : 1,
        unlockedAt:
          monthIncome > monthExpense && monthIncome > 0
            ? new Date().toISOString()
            : null,
      },

      // 2. Poupador Dedicado
      {
        id: 'poupador-dedicado',
        title: translateApiMessage(locale, 'achievements.items.poupador-dedicado.title'),
        description: translateApiMessage(locale, 'achievements.items.poupador-dedicado.description'),
        icon: 'Target',
        category: 'poupanca',
        unlocked: savingsRate >= 20,
        progress: Math.min(100, (savingsRate / 20) * 100),
        currentValue: Math.round(savingsRate * 10) / 10,
        targetValue: 20,
        unlockedAt: savingsRate >= 20 ? new Date().toISOString() : null,
      },

      // 3. Mestre da Poupança
      {
        id: 'mestre-poupanca',
        title: translateApiMessage(locale, 'achievements.items.mestre-poupanca.title'),
        description: translateApiMessage(locale, 'achievements.items.mestre-poupanca.description'),
        icon: 'Crown',
        category: 'poupanca',
        unlocked: savingsRate >= 40,
        progress: Math.min(100, (savingsRate / 40) * 100),
        currentValue: Math.round(savingsRate * 10) / 10,
        targetValue: 40,
        unlockedAt: savingsRate >= 40 ? new Date().toISOString() : null,
      },

      // 4. Investidor Iniciante
      {
        id: 'investidor-iniciante',
        title: translateApiMessage(locale, 'achievements.items.investidor-iniciante.title'),
        description: translateApiMessage(locale, 'achievements.items.investidor-iniciante.description'),
        icon: 'TrendingUp',
        category: 'investimento',
        unlocked: investments.length >= 1,
        progress: Math.min(100, (investments.length / 1) * 100),
        currentValue: investments.length,
        targetValue: 1,
        unlockedAt:
          investments.length >= 1 ? new Date().toISOString() : null,
      },

      // 5. Carteira Diversificada
      {
        id: 'carteira-diversificada',
        title: translateApiMessage(locale, 'achievements.items.carteira-diversificada.title'),
        description: translateApiMessage(locale, 'achievements.items.carteira-diversificada.description'),
        icon: 'BarChart3',
        category: 'investimento',
        unlocked: investments.length >= 3,
        progress: Math.min(100, (investments.length / 3) * 100),
        currentValue: investments.length,
        targetValue: 3,
        unlockedAt:
          investments.length >= 3 ? new Date().toISOString() : null,
      },

      // 6. Meta Conquistada
      {
        id: 'meta-conquistada',
        title: translateApiMessage(locale, 'achievements.items.meta-conquistada.title'),
        description: translateApiMessage(locale, 'achievements.items.meta-conquistada.description'),
        icon: 'Award',
        category: 'poupanca',
        unlocked: completedGoals.length > 0,
        progress: savingsGoals.length > 0
          ? (completedGoals.length / savingsGoals.length) * 100
          : 0,
        currentValue: completedGoals.length,
        targetValue: Math.max(1, savingsGoals.length),
        unlockedAt:
          completedGoals.length > 0 ? new Date().toISOString() : null,
      },

      // 7. Sem Dívidas
      {
        id: 'sem-dividas',
        title: translateApiMessage(locale, 'achievements.items.sem-dividas.title'),
        description: translateApiMessage(locale, 'achievements.items.sem-dividas.description'),
        icon: 'Shield',
        category: 'controle',
        unlocked: allCardsZeroBalance && cards.length > 0,
        progress:
          cards.length > 0
            ? (cards.filter((c) => c.currentBalance === 0).length /
                cards.length) *
              100
            : 0,
        currentValue: cards.filter((c) => c.currentBalance === 0).length,
        targetValue: Math.max(1, cards.length),
        unlockedAt:
          allCardsZeroBalance && cards.length > 0
            ? new Date().toISOString()
            : null,
      },

      // 8. Organizado
      {
        id: 'organizado',
        title: translateApiMessage(locale, 'achievements.items.organizado.title'),
        description: translateApiMessage(locale, 'achievements.items.organizado.description'),
        icon: 'Tag',
        category: 'controle',
        unlocked: categoriesInUse >= 3,
        progress: Math.min(100, (categoriesInUse / 3) * 100),
        currentValue: categoriesInUse,
        targetValue: 3,
        unlockedAt: categoriesInUse >= 3 ? new Date().toISOString() : null,
      },

      // 9. Colecionador de Contas
      {
        id: 'colecionador-contas',
        title: translateApiMessage(locale, 'achievements.items.colecionador-contas.title'),
        description: translateApiMessage(locale, 'achievements.items.colecionador-contas.description'),
        icon: 'Wallet',
        category: 'exploracao',
        unlocked: accounts.length >= 4,
        progress: Math.min(100, (accounts.length / 4) * 100),
        currentValue: accounts.length,
        targetValue: 4,
        unlockedAt: accounts.length >= 4 ? new Date().toISOString() : null,
      },

      // 10. Registros Consistentes
      {
        id: 'registros-consistentes',
        title: translateApiMessage(locale, 'achievements.items.registros-consistentes.title'),
        description: translateApiMessage(locale, 'achievements.items.registros-consistentes.description'),
        icon: 'Zap',
        category: 'controle',
        unlocked: transactions.length >= 20,
        progress: Math.min(100, (transactions.length / 20) * 100),
        currentValue: transactions.length,
        targetValue: 20,
        unlockedAt:
          transactions.length >= 20 ? new Date().toISOString() : null,
      },

      // 11. Patrimônio Crescendo
      {
        id: 'patrimonio-crescendo',
        title: translateApiMessage(locale, 'achievements.items.patrimonio-crescendo.title'),
        description: translateApiMessage(locale, 'achievements.items.patrimonio-crescendo.description', {
          amount: formatServerCurrencyBRL(1000, locale),
        }),
        icon: 'Star',
        category: 'investimento',
        unlocked: netWorth > 1000,
        progress: Math.min(100, Math.max(0, (netWorth / 1000) * 100)),
        currentValue: Math.round(netWorth * 100) / 100,
        targetValue: 1000,
        unlockedAt: netWorth > 1000 ? new Date().toISOString() : null,
      },

      // 12. Financeiro Completo
      {
        id: 'financeiro-completo',
        title: translateApiMessage(locale, 'achievements.items.financeiro-completo.title'),
        description: translateApiMessage(locale, 'achievements.items.financeiro-completo.description'),
        icon: 'CreditCard',
        category: 'exploracao',
        unlocked: hasInvestments && hasSavingsGoals && hasInstallments,
        progress: [hasInvestments, hasSavingsGoals, hasInstallments].filter(
          Boolean
        ).length * (100 / 3),
        currentValue: [hasInvestments, hasSavingsGoals, hasInstallments].filter(
          Boolean
        ).length,
        targetValue: 3,
        unlockedAt:
          hasInvestments && hasSavingsGoals && hasInstallments
            ? new Date().toISOString()
            : null,
      },
    ];

    return NextResponse.json({ achievements });
  } catch (error) {
    console.error('Erro ao buscar conquistas:', error);
    return apiErrorResponse('INTERNAL_ERROR', translateApiMessage(locale, 'achievements.fetchFailed'), 500);
  }
}
