import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

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
export async function GET() {
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
        title: 'Primeira Economia',
        description:
          'Economize dinheiro pela primeira vez — mês com receita maior que despesa',
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
        title: 'Poupador Dedicado',
        description: 'Taxa de poupança acima de 20% no mês atual',
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
        title: 'Mestre da Poupança',
        description: 'Taxa de poupança acima de 40% — você é um mestre em economizar',
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
        title: 'Investidor Iniciante',
        description: 'Possua pelo menos 1 investimento ativo',
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
        title: 'Carteira Diversificada',
        description: 'Tenha 3 ou mais tipos diferentes de investimento',
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
        title: 'Meta Conquistada',
        description: 'Complete qualquer meta de poupança',
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
        title: 'Sem Dívidas',
        description: 'Fatura zerada em todos os cartões de crédito',
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
        title: 'Organizado',
        description: 'Utilize 3 ou mais categorias diferentes',
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
        title: 'Colecionador de Contas',
        description: 'Possua 4 ou mais contas bancárias ativas',
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
        title: 'Registros Consistentes',
        description: 'Registre 20 ou mais transações no mês atual',
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
        title: 'Patrimônio Crescendo',
        description:
          'Patrimônio líquido positivo e acima de R$ 1.000,00',
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
        title: 'Financeiro Completo',
        description:
          'Utilize todos os recursos: investimentos, metas e parcelamentos',
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
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
