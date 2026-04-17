import { db } from '@/lib/db';

async function main() {
  console.log('🌱 Seeding database...');

  // Clean up old data from previous seed runs (without prefixed IDs)
  // Delete all purchase items, purchases, and transactions, then re-seed with upsert
  await db.purchaseItem.deleteMany({});
  await db.purchase.deleteMany({});
  await db.transaction.deleteMany({});

  // Clean up old monthly budgets
  await db.monthlyBudget.deleteMany({
    where: { id: { startsWith: 'mb-' } },
  });

  // Remove old budget goals with previous "goal-*" IDs
  await db.budgetGoal.deleteMany({
    where: { id: { startsWith: 'goal-' } },
  });

  // Clean up new feature seed data
  await db.investmentTransaction.deleteMany({
    where: { investmentId: { startsWith: 'inv-' } },
  });
  await db.investment.deleteMany({
    where: { id: { startsWith: 'inv-' } },
  });
  await db.installment.deleteMany({
    where: { installmentPlanId: { startsWith: 'inst-' } },
  });
  await db.installmentPlan.deleteMany({
    where: { id: { startsWith: 'inst-' } },
  });
  await db.consortiumInstallment.deleteMany({
    where: { consortiumId: { startsWith: 'cons-' } },
  });
  await db.consortium.deleteMany({
    where: { id: { startsWith: 'cons-' } },
  });
  await db.savingsGoal.deleteMany({
    where: { id: { startsWith: 'sav-' } },
  });
  console.log('🧹 Cleaned up old transactions, purchases, budget goals, and new feature data');

  // Create categories
  const categories = await Promise.all([
    db.category.upsert({ where: { id: 'cat-salary' }, update: {}, create: { id: 'cat-salary', name: 'Salário', icon: 'banknote', type: 'INCOME', color: '#22c55e' } }),
    db.category.upsert({ where: { id: 'cat-freelance' }, update: {}, create: { id: 'cat-freelance', name: 'Freelance', icon: 'laptop', type: 'INCOME', color: '#06b6d4' } }),
    db.category.upsert({ where: { id: 'cat-investment' }, update: {}, create: { id: 'cat-investment', name: 'Investimentos', icon: 'trending-up', type: 'INCOME', color: '#8b5cf6' } }),
    db.category.upsert({ where: { id: 'cat-food' }, update: {}, create: { id: 'cat-food', name: 'Alimentação', icon: 'utensils', type: 'EXPENSE', color: '#f97316' } }),
    db.category.upsert({ where: { id: 'cat-transport' }, update: {}, create: { id: 'cat-transport', name: 'Transporte', icon: 'car', type: 'EXPENSE', color: '#3b82f6' } }),
    db.category.upsert({ where: { id: 'cat-health' }, update: {}, create: { id: 'cat-health', name: 'Saúde', icon: 'heart-pulse', type: 'EXPENSE', color: '#ef4444' } }),
    db.category.upsert({ where: { id: 'cat-education' }, update: {}, create: { id: 'cat-education', name: 'Educação', icon: 'graduation-cap', type: 'EXPENSE', color: '#a855f7' } }),
    db.category.upsert({ where: { id: 'cat-entertainment' }, update: {}, create: { id: 'cat-entertainment', name: 'Entretenimento', icon: 'gamepad-2', type: 'EXPENSE', color: '#ec4899' } }),
    db.category.upsert({ where: { id: 'cat-shopping' }, update: {}, create: { id: 'cat-shopping', name: 'Compras', icon: 'shopping-bag', type: 'EXPENSE', color: '#f59e0b' } }),
    db.category.upsert({ where: { id: 'cat-bills' }, update: {}, create: { id: 'cat-bills', name: 'Contas', icon: 'receipt', type: 'EXPENSE', color: '#64748b' } }),
    db.category.upsert({ where: { id: 'cat-home' }, update: {}, create: { id: 'cat-home', name: 'Moradia', icon: 'home', type: 'EXPENSE', color: '#84cc16' } }),
    db.category.upsert({ where: { id: 'cat-other' }, update: {}, create: { id: 'cat-other', name: 'Outros', icon: 'more-horizontal', type: 'EXPENSE', color: '#94a3b8' } }),
  ]);
  console.log(`✅ Created ${categories.length} categories`);

  // Create accounts
  const account1 = await db.account.upsert({
    where: { id: 'acc-wallet' }, update: {}, create: { id: 'acc-wallet', name: 'Carteira', type: 'CASH', balance: 350.00, color: '#22c55e', icon: 'wallet' }
  });
  const account2 = await db.account.upsert({
    where: { id: 'acc-savings' }, update: {}, create: { id: 'acc-savings', name: 'Poupança', type: 'BANK', balance: 12500.00, color: '#3b82f6', icon: 'piggy-bank' }
  });
  const account3 = await db.account.upsert({
    where: { id: 'acc-checking' }, update: {}, create: { id: 'acc-checking', name: 'Conta Corrente', type: 'BANK', balance: 4500.00, color: '#8b5cf6', icon: 'landmark' }
  });
  const account4 = await db.account.upsert({
    where: { id: 'acc-pix' }, update: {}, create: { id: 'acc-pix', name: 'PIX', type: 'DIGITAL_WALLET', balance: 890.00, color: '#06b6d4', icon: 'smartphone' }
  });
  console.log(`✅ Created 4 accounts`);

  // Create cards
  const card1 = await db.card.upsert({
    where: { id: 'card-nubank' }, update: {}, create: { id: 'card-nubank', name: 'Nubank Platinum', type: 'CREDIT', brand: 'MASTERCARD', lastFourDigits: '4532', creditLimit: 8000, currentBalance: 2340.50, closingDay: 3, dueDay: 10, color: '#8b5cf6', flag: 'Nubank' }
  });
  const card2 = await db.card.upsert({
    where: { id: 'card-inter' }, update: {}, create: { id: 'card-inter', name: 'Inter Gold', type: 'CREDIT', brand: 'MASTERCARD', lastFourDigits: '7891', creditLimit: 5000, currentBalance: 1280.00, closingDay: 15, dueDay: 22, color: '#f97316', flag: 'Inter' }
  });
  const card3 = await db.card.upsert({
    where: { id: 'card-itau-debit' }, update: {}, create: { id: 'card-itau-debit', name: 'Itaú Débito', type: 'DEBIT', brand: 'MASTERCARD', lastFourDigits: '3456', creditLimit: 0, currentBalance: 0, closingDay: 1, dueDay: 10, color: '#ef4444', flag: 'Itaú' }
  });
  console.log(`✅ Created 3 cards`);

  const now = new Date();
  const Y = now.getFullYear();
  const M = now.getMonth();
  const D = now.getDate();

  // ============================
  // HISTORICAL DATA: 5 months back
  // ============================
  const historicalData: { monthOffset: number; transactions: any[]; purchases: any[] }[] = [
    // Month -5
    {
      monthOffset: 5,
      transactions: [
        { accountId: account3.id, categoryId: 'cat-salary', type: 'INCOME', amount: 8500, description: 'Salário Mensal', date: new Date(Y, M - 5, 5) },
        { accountId: account3.id, categoryId: 'cat-home', type: 'EXPENSE', amount: 1750, description: 'Aluguel', date: new Date(Y, M - 5, 10) },
        { accountId: account3.id, categoryId: 'cat-bills', type: 'EXPENSE', amount: 290, description: 'Conta de Luz', date: new Date(Y, M - 5, 8) },
        { accountId: account3.id, categoryId: 'cat-health', type: 'EXPENSE', amount: 450, description: 'Plano de Saúde', date: new Date(Y, M - 5, 5) },
        { accountId: account3.id, categoryId: 'cat-bills', type: 'EXPENSE', amount: 80, description: 'Internet', date: new Date(Y, M - 5, 8) },
      ],
      purchases: [
        {
          merchant: 'Carrefour', totalAmount: 389.40, date: new Date(Y, M - 5, 12), cardId: card1.id, categoryId: 'cat-food',
          items: [
            { name: 'Arroz 5kg', quantity: 2, unitPrice: 24.90, totalPrice: 49.80 },
            { name: 'Feijão 1kg', quantity: 3, unitPrice: 8.50, totalPrice: 25.50 },
            { name: 'Leite 1L', quantity: 6, unitPrice: 5.49, totalPrice: 32.94 },
            { name: 'Carne Moida 500g', quantity: 2, unitPrice: 22.90, totalPrice: 45.80 },
            { name: 'Frango Kg', quantity: 2, unitPrice: 16.90, totalPrice: 33.80 },
            { name: 'Diversos limpeza', quantity: 1, unitPrice: 85.00, totalPrice: 85.00 },
            { name: 'Higiene pessoal', quantity: 1, unitPrice: 116.56, totalPrice: 116.56 },
          ]
        },
        {
          merchant: 'Farmácia Drogasil', totalAmount: 124.90, date: new Date(Y, M - 5, 18), cardId: card1.id, categoryId: 'cat-health',
          items: [
            { name: 'Dipirona 500mg', quantity: 2, unitPrice: 8.90, totalPrice: 17.80 },
            { name: 'Vitamina C 60cp', quantity: 1, unitPrice: 42.90, totalPrice: 42.90 },
            { name: 'Protetor Solar', quantity: 1, unitPrice: 64.20, totalPrice: 64.20 },
          ]
        },
        {
          merchant: 'Americanas', totalAmount: 259.80, date: new Date(Y, M - 5, 22), cardId: card2.id, categoryId: 'cat-entertainment',
          items: [
            { name: 'Jogo PS5', quantity: 1, unitPrice: 249.90, totalPrice: 249.90 },
            { name: 'Pilha AA 4un', quantity: 1, unitPrice: 9.90, totalPrice: 9.90 },
          ]
        },
      ]
    },
    // Month -4
    {
      monthOffset: 4,
      transactions: [
        { accountId: account3.id, categoryId: 'cat-salary', type: 'INCOME', amount: 8500, description: 'Salário Mensal', date: new Date(Y, M - 4, 5) },
        { accountId: account4.id, categoryId: 'cat-freelance', type: 'INCOME', amount: 1800, description: 'Freelance - Logo Design', date: new Date(Y, M - 4, 15) },
        { accountId: account3.id, categoryId: 'cat-home', type: 'EXPENSE', amount: 1750, description: 'Aluguel', date: new Date(Y, M - 4, 10) },
        { accountId: account3.id, categoryId: 'cat-bills', type: 'EXPENSE', amount: 310, description: 'Conta de Luz', date: new Date(Y, M - 4, 8) },
        { accountId: account3.id, categoryId: 'cat-health', type: 'EXPENSE', amount: 450, description: 'Plano de Saúde', date: new Date(Y, M - 4, 5) },
        { accountId: account3.id, categoryId: 'cat-transport', type: 'EXPENSE', amount: 380, description: 'Combustível', date: new Date(Y, M - 4, 14) },
      ],
      purchases: [
        {
          merchant: 'Extra Hipermercado', totalAmount: 523.70, date: new Date(Y, M - 4, 10), cardId: card2.id, categoryId: 'cat-shopping',
          items: [
            { name: 'Camiseta Lacoste', quantity: 1, unitPrice: 289.90, totalPrice: 289.90 },
            { name: 'Cinto Armani', quantity: 1, unitPrice: 159.90, totalPrice: 159.90 },
            { name: 'Meias 3pç', quantity: 2, unitPrice: 36.95, totalPrice: 73.90 },
          ]
        },
        {
          merchant: 'Carrefour', totalAmount: 312.60, date: new Date(Y, M - 4, 18), cardId: card1.id, categoryId: 'cat-food',
          items: [
            { name: 'Supermercado semanal', quantity: 1, unitPrice: 312.60, totalPrice: 312.60 },
          ]
        },
      ]
    },
    // Month -3
    {
      monthOffset: 3,
      transactions: [
        { accountId: account3.id, categoryId: 'cat-salary', type: 'INCOME', amount: 8500, description: 'Salário Mensal', date: new Date(Y, M - 3, 5) },
        { accountId: account3.id, categoryId: 'cat-home', type: 'EXPENSE', amount: 1750, description: 'Aluguel', date: new Date(Y, M - 3, 10) },
        { accountId: account3.id, categoryId: 'cat-bills', type: 'EXPENSE', amount: 275, description: 'Conta de Luz', date: new Date(Y, M - 3, 8) },
        { accountId: account3.id, categoryId: 'cat-health', type: 'EXPENSE', amount: 450, description: 'Plano de Saúde', date: new Date(Y, M - 3, 5) },
        { accountId: account4.id, categoryId: 'cat-bills', type: 'EXPENSE', amount: 189.90, description: 'Netflix + Spotify + Disney+', date: new Date(Y, M - 3, 3) },
      ],
      purchases: [
        {
          merchant: 'Magazine Luiza', totalAmount: 899.00, date: new Date(Y, M - 3, 8), cardId: card2.id, categoryId: 'cat-education',
          items: [
            { name: 'Monitor LG 27"', quantity: 1, unitPrice: 849.00, totalPrice: 849.00 },
            { name: 'Cabo HDMI 2m', quantity: 1, unitPrice: 50.00, totalPrice: 50.00 },
          ]
        },
        {
          merchant: 'iFood - Restaurante Siri', totalAmount: 145.80, date: new Date(Y, M - 3, 20), cardId: card1.id, categoryId: 'cat-food',
          items: [
            { name: 'Moqueca', quantity: 1, unitPrice: 59.90, totalPrice: 59.90 },
            { name: 'Arroz Tropeiro', quantity: 1, unitPrice: 42.90, totalPrice: 42.90 },
            { name: 'Suco Natural 500ml', quantity: 2, unitPrice: 12.90, totalPrice: 25.80 },
            { name: 'Pudim', quantity: 1, unitPrice: 17.20, totalPrice: 17.20 },
          ]
        },
        {
          merchant: 'Farmácia Raia', totalAmount: 89.70, date: new Date(Y, M - 3, 25), cardId: card1.id, categoryId: 'cat-health',
          items: [
            { name: 'Ibuprofeno 400mg', quantity: 1, unitPrice: 22.90, totalPrice: 22.90 },
            { name: 'Gelol 500g', quantity: 2, unitPrice: 16.90, totalPrice: 33.80 },
            { name: 'Banda Sport', quantity: 1, unitPrice: 33.00, totalPrice: 33.00 },
          ]
        },
      ]
    },
    // Month -2
    {
      monthOffset: 2,
      transactions: [
        { accountId: account3.id, categoryId: 'cat-salary', type: 'INCOME', amount: 8500, description: 'Salário Mensal', date: new Date(Y, M - 2, 5) },
        { accountId: account3.id, categoryId: 'cat-freelance', type: 'INCOME', amount: 3200, description: 'Freelance - App Mobile', date: new Date(Y, M - 2, 20) },
        { accountId: account3.id, categoryId: 'cat-home', type: 'EXPENSE', amount: 1750, description: 'Aluguel', date: new Date(Y, M - 2, 10) },
        { accountId: account3.id, categoryId: 'cat-bills', type: 'EXPENSE', amount: 340, description: 'Conta de Luz', date: new Date(Y, M - 2, 8) },
        { accountId: account3.id, categoryId: 'cat-health', type: 'EXPENSE', amount: 450, description: 'Plano de Saúde', date: new Date(Y, M - 2, 5) },
        { accountId: account4.id, categoryId: 'cat-education', type: 'EXPENSE', amount: 197, description: 'Alura Plus', date: new Date(Y, M - 2, 1) },
      ],
      purchases: [
        {
          merchant: 'Carrefour', totalAmount: 478.30, date: new Date(Y, M - 2, 7), cardId: card1.id, categoryId: 'cat-food',
          items: [
            { name: 'Compras do mês', quantity: 1, unitPrice: 478.30, totalPrice: 478.30 },
          ]
        },
        {
          merchant: 'Netshoes', totalAmount: 689.70, date: new Date(Y, M - 2, 14), cardId: card2.id, categoryId: 'cat-entertainment',
          items: [
            { name: 'Tênis Nike Air Max', quantity: 1, unitPrice: 649.90, totalPrice: 649.90 },
            { name: 'Cadarço Premium', quantity: 1, unitPrice: 39.80, totalPrice: 39.80 },
          ]
        },
      ]
    },
    // Month -1
    {
      monthOffset: 1,
      transactions: [
        { accountId: account3.id, categoryId: 'cat-salary', type: 'INCOME', amount: 9000, description: 'Salário Mensal', date: new Date(Y, M - 1, 5) },
        { accountId: account4.id, categoryId: 'cat-investment', type: 'INCOME', amount: 280, description: 'Dividendos BBDC4', date: new Date(Y, M - 1, 15) },
        { accountId: account3.id, categoryId: 'cat-home', type: 'EXPENSE', amount: 1800, description: 'Aluguel', date: new Date(Y, M - 1, 10) },
        { accountId: account3.id, categoryId: 'cat-bills', type: 'EXPENSE', amount: 305, description: 'Conta de Luz', date: new Date(Y, M - 1, 8) },
        { accountId: account3.id, categoryId: 'cat-health', type: 'EXPENSE', amount: 450, description: 'Plano de Saúde', date: new Date(Y, M - 1, 5) },
        { accountId: account4.id, categoryId: 'cat-bills', type: 'EXPENSE', amount: 189.90, description: 'Netflix + Spotify + Disney+', date: new Date(Y, M - 1, 3) },
        { accountId: account3.id, categoryId: 'cat-transport', type: 'EXPENSE', amount: 320, description: 'Combustível', date: new Date(Y, M - 1, 12) },
      ],
      purchases: [
        {
          merchant: 'Extra Hipermercado', totalAmount: 345.90, date: new Date(Y, M - 1, 6), cardId: card2.id, categoryId: 'cat-shopping',
          items: [
            { name: 'Cama Queen Casal', quantity: 1, unitPrice: 319.90, totalPrice: 319.90 },
            { name: 'Travesseiro', quantity: 1, unitPrice: 26.00, totalPrice: 26.00 },
          ]
        },
        {
          merchant: 'Carrefour', totalAmount: 523.40, date: new Date(Y, M - 1, 11), cardId: card1.id, categoryId: 'cat-food',
          items: [
            { name: 'Supermercado quinzenal', quantity: 1, unitPrice: 523.40, totalPrice: 523.40 },
          ]
        },
        {
          merchant: 'iFood - Burger King', totalAmount: 67.80, date: new Date(Y, M - 1, 22), cardId: card1.id, categoryId: 'cat-food',
          items: [
            { name: 'Whopper Duplo', quantity: 1, unitPrice: 34.90, totalPrice: 34.90 },
            { name: 'Batata Frita M', quantity: 1, unitPrice: 16.90, totalPrice: 16.90 },
            { name: 'Coca-Cola 400ml', quantity: 1, unitPrice: 9.90, totalPrice: 9.90 },
            { name: 'Sundae Chocolate', quantity: 1, unitPrice: 6.10, totalPrice: 6.10 },
          ]
        },
      ]
    },
  ];

  // Insert historical transactions with specific IDs to avoid duplicates
  for (const monthData of historicalData) {
    const offset = monthData.monthOffset;
    for (const t of monthData.transactions) {
      const suffix = `${offset}-${t.description.replace(/\s+/g, '-').toLowerCase().substring(0, 30)}`;
      await db.transaction.upsert({
        where: { id: `hist-tx-${suffix}` },
        update: {},
        create: { id: `hist-tx-${suffix}`, ...t },
      });
    }
    for (const p of monthData.purchases) {
      const suffix = `${offset}-${p.merchant.replace(/\s+/g, '-').toLowerCase().substring(0, 25)}`;
      await db.purchase.upsert({
        where: { id: `hist-pur-${suffix}` },
        update: {},
        create: {
          id: `hist-pur-${suffix}`,
          merchant: p.merchant,
          totalAmount: p.totalAmount,
          date: p.date,
          cardId: p.cardId,
          categoryId: p.categoryId,
          items: { create: p.items },
        },
      });
    }
    console.log(`✅ Created ${monthData.transactions.length} transactions + ${monthData.purchases.length} purchases for month ${offset} ago`);
  }

  // ============================
  // CURRENT MONTH DATA
  // ============================
  const transactions = [
    // Incomes
    { accountId: account3.id, categoryId: 'cat-salary', type: 'INCOME', amount: 8500, description: 'Salário Mensal', date: new Date(Y, M, 5) },
    { accountId: account3.id, categoryId: 'cat-freelance', type: 'INCOME', amount: 2200, description: 'Projeto Freelance - Site', date: new Date(Y, M, 12) },
    { accountId: account4.id, categoryId: 'cat-investment', type: 'INCOME', amount: 350, description: 'Dividendos ITSA4', date: new Date(Y, M, 15) },
    // Cash expenses
    { accountId: account1.id, categoryId: 'cat-food', type: 'EXPENSE', amount: 45, description: 'Almoço no trabalho', date: new Date(Y, M, D - 2) },
    { accountId: account1.id, categoryId: 'cat-transport', type: 'EXPENSE', amount: 32, description: 'Uber - trabalho → casa', date: new Date(Y, M, D - 1) },
    { accountId: account4.id, categoryId: 'cat-bills', type: 'EXPENSE', amount: 189.90, description: 'Netflix + Spotify + Disney+', date: new Date(Y, M, 3) },
    { accountId: account3.id, categoryId: 'cat-home', type: 'EXPENSE', amount: 1800, description: 'Aluguel', date: new Date(Y, M, 10) },
    { accountId: account3.id, categoryId: 'cat-bills', type: 'EXPENSE', amount: 320, description: 'Conta de Luz', date: new Date(Y, M, 8) },
    { accountId: account3.id, categoryId: 'cat-bills', type: 'EXPENSE', amount: 85, description: 'Internet', date: new Date(Y, M, 8) },
    { accountId: account3.id, categoryId: 'cat-health', type: 'EXPENSE', amount: 450, description: 'Plano de Saúde', date: new Date(Y, M, 5) },
    { accountId: account4.id, categoryId: 'cat-education', type: 'EXPENSE', amount: 197, description: 'Alura Plus', date: new Date(Y, M, 1) },
    { accountId: account3.id, categoryId: 'cat-transport', type: 'EXPENSE', amount: 350, description: 'Combustível', date: new Date(Y, M, 14) },
  ];

  for (const t of transactions) {
    const suffix = t.description.replace(/\s+/g, '-').toLowerCase().substring(0, 30);
    await db.transaction.upsert({
      where: { id: `cur-tx-${suffix}` },
      update: {},
      create: { id: `cur-tx-${suffix}`, ...t },
    });
  }
  console.log(`✅ Created ${transactions.length} current month transactions`);

  // Current month purchases
  const purchases = [
    {
      merchant: 'Carrefour', totalAmount: 456.80, date: new Date(Y, M, D - 3), cardId: card1.id, categoryId: 'cat-food',
      items: [
        { name: 'Arroz 5kg Tio João', quantity: 2, unitPrice: 24.90, totalPrice: 49.80 },
        { name: 'Feijão Carioca 1kg', quantity: 3, unitPrice: 8.50, totalPrice: 25.50 },
        { name: 'Óleo de Soja 900ml', quantity: 2, unitPrice: 7.90, totalPrice: 15.80 },
        { name: 'Açúcar Cristal 1kg', quantity: 1, unitPrice: 5.90, totalPrice: 5.90 },
        { name: 'Café Torrado 500g', quantity: 2, unitPrice: 18.90, totalPrice: 37.80 },
        { name: 'Leite Integral 1L', quantity: 6, unitPrice: 5.49, totalPrice: 32.94 },
        { name: 'Carne Moida 500g', quantity: 2, unitPrice: 22.90, totalPrice: 45.80 },
        { name: 'Frango Inteiro Kg', quantity: 2, unitPrice: 16.90, totalPrice: 33.80 },
        { name: 'Banana Kg', quantity: 1.5, unitPrice: 5.90, totalPrice: 8.85 },
        { name: 'Tomate Kg', quantity: 1, unitPrice: 8.90, totalPrice: 8.90 },
        { name: 'Sabão em Pó 1kg', quantity: 1, unitPrice: 14.90, totalPrice: 14.90 },
        { name: 'Detergente 500ml', quantity: 2, unitPrice: 3.49, totalPrice: 6.98 },
        { name: 'Papel Higiênico 12un', quantity: 1, unitPrice: 22.90, totalPrice: 22.90 },
        { name: 'Cerveja Heineken Long Neck', quantity: 6, unitPrice: 4.99, totalPrice: 29.94 },
        { name: 'Refrigerante Coca-Cola 2L', quantity: 2, unitPrice: 10.90, totalPrice: 21.80 },
        { name: 'Biscoito Maizena 400g', quantity: 3, unitPrice: 6.90, totalPrice: 20.70 },
        { name: 'Macarrão Espaguete 500g', quantity: 4, unitPrice: 4.90, totalPrice: 19.60 },
        { name: 'Molho de Tomate 340g', quantity: 4, unitPrice: 3.29, totalPrice: 13.16 },
        { name: 'Presunto Fatiado 200g', quantity: 2, unitPrice: 12.90, totalPrice: 25.80 },
        { name: 'Queijo Mussarela 300g', quantity: 1, unitPrice: 19.90, totalPrice: 19.90 },
      ]
    },
    {
      merchant: 'Extra Hipermercado', totalAmount: 789.50, date: new Date(Y, M, D - 10), cardId: card2.id, categoryId: 'cat-shopping',
      items: [
        { name: 'Camiseta Nike', quantity: 2, unitPrice: 129.90, totalPrice: 259.80 },
        { name: 'Tênis Adidas', quantity: 1, unitPrice: 399.90, totalPrice: 399.90 },
        { name: 'Meias Sport 3pç', quantity: 2, unitPrice: 34.90, totalPrice: 69.80 },
        { name: 'Cinto Couro', quantity: 1, unitPrice: 59.90, totalPrice: 59.90 },
      ]
    },
    {
      merchant: 'Farmácia Raia', totalAmount: 167.40, date: new Date(Y, M, D - 5), cardId: card1.id, categoryId: 'cat-health',
      items: [
        { name: 'Dipirona 500mg 10cp', quantity: 2, unitPrice: 8.90, totalPrice: 17.80 },
        { name: 'Ibuprofeno 400mg 30cp', quantity: 1, unitPrice: 22.90, totalPrice: 22.90 },
        { name: 'Vitamina D3 60cp', quantity: 1, unitPrice: 45.90, totalPrice: 45.90 },
        { name: 'Pomada Cicatrizante', quantity: 1, unitPrice: 32.90, totalPrice: 32.90 },
        { name: 'Álcool Gel 500ml', quantity: 2, unitPrice: 12.45, totalPrice: 24.90 },
        { name: 'Máscara Cirúrgica 50un', quantity: 1, unitPrice: 23.00, totalPrice: 23.00 },
      ]
    },
    {
      merchant: 'iFood - Restaurante Outback', totalAmount: 189.90, date: new Date(Y, M, D - 1), cardId: card1.id, categoryId: 'cat-food',
      items: [
        { name: 'Onion Rings', quantity: 1, unitPrice: 39.90, totalPrice: 39.90 },
        { name: 'Baby Back Ribs', quantity: 1, unitPrice: 89.90, totalPrice: 89.90 },
        { name: 'Coca-Cola 350ml', quantity: 2, unitPrice: 12.90, totalPrice: 25.80 },
        { name: 'Cheese Cake', quantity: 1, unitPrice: 34.30, totalPrice: 34.30 },
      ]
    },
    {
      merchant: 'Amazon Brasil', totalAmount: 1299.00, date: new Date(Y, M, D - 7), cardId: card2.id, categoryId: 'cat-entertainment',
      items: [
        { name: 'Kindle Paperwhite', quantity: 1, unitPrice: 649.00, totalPrice: 649.00 },
        { name: 'Capa Kindle', quantity: 1, unitPrice: 89.90, totalPrice: 89.90 },
        { name: 'Fone Bluetooth JBL', quantity: 1, unitPrice: 399.00, totalPrice: 399.00 },
        { name: 'Película Kindle', quantity: 2, unitPrice: 34.90, totalPrice: 69.80 },
        { name: 'Carregador USB-C', quantity: 1, unitPrice: 90.40, totalPrice: 90.40 },
      ]
    },
    {
      merchant: 'Mercado Livre - Eletrônicos', totalAmount: 549.90, date: new Date(Y, M, D - 4), cardId: card1.id, categoryId: 'cat-education',
      items: [
        { name: 'Mouse Logitech MX Master 3S', quantity: 1, unitPrice: 499.90, totalPrice: 499.90 },
        { name: 'Mousepad XL', quantity: 1, unitPrice: 49.90, totalPrice: 49.90 },
      ]
    },
  ];

  for (const p of purchases) {
    const suffix = p.merchant.replace(/\s+/g, '-').toLowerCase().substring(0, 25);
    await db.purchase.upsert({
      where: { id: `cur-pur-${suffix}` },
      update: {},
      create: {
        id: `cur-pur-${suffix}`,
        merchant: p.merchant,
        totalAmount: p.totalAmount,
        date: p.date,
        cardId: p.cardId,
        categoryId: p.categoryId,
        items: { create: p.items },
      },
    });
  }
  console.log(`✅ Created ${purchases.length} current month purchases with items`);

  // ============================
  // BUDGET GOALS (cur-bg-* prefix)
  // ============================
  const budgetGoals = [
    {
      id: 'cur-bg-cursos',
      name: 'Cursos e Certificações',
      description: 'Investimento em qualificação profissional',
      targetAmount: 5000,
      currentAmount: 5000,
      categoryId: 'cat-education',
      startDate: new Date(Y, M - 6, 1),
      endDate: new Date(Y, M - 1, 0),
      isCompleted: true,
    },
    {
      id: 'cur-bg-carro',
      name: 'Entrada do Carro',
      description: 'Reserva para entrada de um carro novo',
      targetAmount: 25000,
      currentAmount: 3200,
      categoryId: 'cat-transport',
      startDate: new Date(Y, M - 5, 1),
      endDate: new Date(Y + 2, 0, 0),
      isCompleted: false,
    },
    {
      id: 'cur-bg-macbook',
      name: 'MacBook Pro M4',
      description: 'Novo notebook para trabalho freelancer',
      targetAmount: 14000,
      currentAmount: 10500,
      categoryId: 'cat-education',
      startDate: new Date(Y, M - 2, 1),
      endDate: new Date(Y, M + 1, 0),
      isCompleted: false,
    },
    {
      id: 'cur-bg-europa',
      name: 'Viagem para Europa',
      description: 'Passagens + hospedagem + passeios por 15 dias',
      targetAmount: 18000,
      currentAmount: 6400,
      categoryId: 'cat-entertainment',
      startDate: new Date(Y, M - 4, 1),
      endDate: new Date(Y + 1, 5, 0),
      isCompleted: false,
    },
    {
      id: 'cur-bg-emergencia',
      name: 'Reserva de Emergência',
      description: '6 meses de gastos essenciais guardados para imprevistos',
      targetAmount: 35000,
      currentAmount: 12500,
      categoryId: 'cat-home',
      startDate: new Date(Y, M - 3, 1),
      endDate: new Date(Y + 1, M, 0),
      isCompleted: false,
    },
    {
      id: 'cur-bg-investimentos',
      name: 'Investimentos em Ações',
      description: 'Carteira diversificada de ações para longo prazo',
      targetAmount: 50000,
      currentAmount: 15000,
      categoryId: 'cat-investment',
      startDate: new Date(Y, M - 8, 1),
      endDate: new Date(Y + 2, 5, 0),
      isCompleted: false,
    },
  ];

  for (const g of budgetGoals) {
    await db.budgetGoal.upsert({
      where: { id: g.id },
      update: {},
      create: g,
    });
  }
  console.log(`✅ Created ${budgetGoals.length} budget goals`);

  // ============================
  // RECURRING TRANSACTIONS
  // ============================
  const recurringTransactions = [
    {
      id: 'rec-salary',
      description: 'Salário Mensal',
      amount: 8500,
      type: 'INCOME',
      frequency: 'MONTHLY',
      nextDate: new Date(Y, M + 1, 5),
      categoryId: 'cat-salary',
      accountId: account3.id,
      cardId: null,
      isActive: true,
    },
    {
      id: 'rec-rent',
      description: 'Aluguel',
      amount: 1800,
      type: 'EXPENSE',
      frequency: 'MONTHLY',
      nextDate: new Date(Y, M + 1, 10),
      categoryId: 'cat-home',
      accountId: account3.id,
      cardId: null,
      isActive: true,
    },
    {
      id: 'rec-health',
      description: 'Plano de Saúde',
      amount: 450,
      type: 'EXPENSE',
      frequency: 'MONTHLY',
      nextDate: new Date(Y, M + 1, 5),
      categoryId: 'cat-health',
      accountId: account3.id,
      cardId: null,
      isActive: true,
    },
    {
      id: 'rec-internet',
      description: 'Internet',
      amount: 85,
      type: 'EXPENSE',
      frequency: 'MONTHLY',
      nextDate: new Date(Y, M + 1, 8),
      categoryId: 'cat-bills',
      accountId: account3.id,
      cardId: null,
      isActive: true,
    },
    {
      id: 'rec-netflix',
      description: 'Netflix',
      amount: 55.90,
      type: 'EXPENSE',
      frequency: 'MONTHLY',
      nextDate: new Date(Y, M + 1, 3),
      categoryId: 'cat-entertainment',
      accountId: account4.id,
      cardId: null,
      isActive: true,
    },
  ];

  for (const r of recurringTransactions) {
    await db.recurringTransaction.upsert({
      where: { id: r.id },
      update: {},
      create: r,
    });
  }
  console.log(`✅ Created ${recurringTransactions.length} recurring transactions`);

  // ============================
  // INVESTMENTS
  // ============================
  const investment1 = await db.investment.upsert({
    where: { id: 'inv-stock-1' },
    update: {},
    create: {
      id: 'inv-stock-1',
      name: 'Ações PETR4',
      type: 'STOCK',
      description: 'Petrobras PN - Ações',
      investedAmount: 15000,
      currentBalance: 18500,
      yieldRate: 12.5,
      ticker: 'PETR4',
      brokerage: 'XP Investimentos',
      accountId: account2.id,
      categoryId: 'cat-investment',
      isActive: true,
    },
  });

  // PETR4 transactions: 3 aportes + 2 dividendos
  const petr4Transactions = [
    { id: 'inv-tx-stock-1', type: 'APORTE', amount: 5000, quantity: 200, unitPrice: 25.0, date: new Date(Y, M - 3, 10), description: 'Aporte PETR4' },
    { id: 'inv-tx-stock-2', type: 'APORTE', amount: 5000, quantity: 190, unitPrice: 26.32, date: new Date(Y, M - 2, 10), description: 'Aporte PETR4' },
    { id: 'inv-tx-stock-3', type: 'APORTE', amount: 5000, quantity: 185, unitPrice: 27.03, date: new Date(Y, M - 1, 10), description: 'Aporte PETR4' },
    { id: 'inv-tx-stock-4', type: 'DIVIDENDO', amount: 350, quantity: 0, unitPrice: 0, date: new Date(Y, M - 2, 15), description: 'Dividendo PETR4' },
    { id: 'inv-tx-stock-5', type: 'DIVIDENDO', amount: 420, quantity: 0, unitPrice: 0, date: new Date(Y, M - 1, 15), description: 'Dividendo PETR4' },
  ];
  for (const t of petr4Transactions) {
    await db.investmentTransaction.upsert({
      where: { id: t.id },
      update: {},
      create: { ...t, investmentId: investment1.id, accountId: account2.id },
    });
  }

  const investment2 = await db.investment.upsert({
    where: { id: 'inv-fii-1' },
    update: {},
    create: {
      id: 'inv-fii-1',
      name: 'FII MXRF11',
      type: 'FII',
      description: 'Maxi Renda - Fundo Imobiliário',
      investedAmount: 25000,
      currentBalance: 27800,
      yieldRate: 9.8,
      ticker: 'MXRF11',
      brokerage: 'Rico',
      accountId: account2.id,
      categoryId: 'cat-investment',
      isActive: true,
    },
  });

  // MXRF11 transactions: 2 aportes + 3 dividendos mensais
  const mxrf11Transactions = [
    { id: 'inv-tx-fii-1', type: 'APORTE', amount: 15000, quantity: 300, unitPrice: 50.0, date: new Date(Y, M - 3, 5), description: 'Aporte MXRF11' },
    { id: 'inv-tx-fii-2', type: 'APORTE', amount: 10000, quantity: 195, unitPrice: 51.28, date: new Date(Y, M - 1, 5), description: 'Aporte MXRF11' },
    { id: 'inv-tx-fii-3', type: 'DIVIDENDO', amount: 210, quantity: 0, unitPrice: 0, date: new Date(Y, M - 3, 20), description: 'Dividendo Mensal MXRF11' },
    { id: 'inv-tx-fii-4', type: 'DIVIDENDO', amount: 225, quantity: 0, unitPrice: 0, date: new Date(Y, M - 2, 20), description: 'Dividendo Mensal MXRF11' },
    { id: 'inv-tx-fii-5', type: 'DIVIDENDO', amount: 235, quantity: 0, unitPrice: 0, date: new Date(Y, M - 1, 20), description: 'Dividendo Mensal MXRF11' },
  ];
  for (const t of mxrf11Transactions) {
    await db.investmentTransaction.upsert({
      where: { id: t.id },
      update: {},
      create: { ...t, investmentId: investment2.id, accountId: account2.id },
    });
  }

  const investment3 = await db.investment.upsert({
    where: { id: 'inv-cdb-1' },
    update: {},
    create: {
      id: 'inv-cdb-1',
      name: 'CDB Banco Inter',
      type: 'CDB',
      description: 'CDB 120% CDI Banco Inter',
      investedAmount: 50000,
      currentBalance: 52400,
      yieldRate: 14.2,
      brokerage: 'Banco Inter',
      accountId: account2.id,
      categoryId: 'cat-investment',
      isActive: true,
    },
  });

  // CDB transactions: 1 aporte
  await db.investmentTransaction.upsert({
    where: { id: 'inv-tx-cdb-1' },
    update: {},
    create: {
      id: 'inv-tx-cdb-1',
      type: 'APORTE',
      amount: 50000,
      quantity: 1,
      unitPrice: 50000,
      date: new Date(Y, M - 6, 1),
      description: 'Aporte CDB Banco Inter',
      investmentId: investment3.id,
      accountId: account2.id,
    },
  });

  console.log('✅ Created 3 investments with transactions');

  // ============================
  // INSTALLMENT PLANS
  // ============================
  const installmentPlan1 = await db.installmentPlan.upsert({
    where: { id: 'inst-fin-1' },
    update: {},
    create: {
      id: 'inst-fin-1',
      description: 'Financiamento Honda Civic',
      totalAmount: 120000,
      installmentCount: 60,
      paidInstallments: 12,
      monthlyValue: 2000,
      interestRate: 1.5,
      startDate: new Date(Y, M - 12, 1),
      nextPaymentDate: new Date(Y, M + 1, 10),
      type: 'FINANCING',
      status: 'ACTIVE',
      categoryId: 'cat-transport',
      isActive: true,
    },
  });

  // Generate 60 installments for Financiamento Honda Civic
  for (let i = 1; i <= 60; i++) {
    const dueDate = new Date(Y, M - 12 + i, 10);
    const isPaid = i <= 12;
    await db.installment.upsert({
      where: { id: `inst-fin-1-parc-${i}` },
      update: {},
      create: {
        id: `inst-fin-1-parc-${i}`,
        number: i,
        amount: 2000,
        dueDate,
        paidDate: isPaid ? new Date(dueDate.getTime() - 86400000 * 2) : null,
        status: isPaid ? 'PAID' : 'PENDING',
        installmentPlanId: installmentPlan1.id,
      },
    });
  }

  const installmentPlan2 = await db.installmentPlan.upsert({
    where: { id: 'inst-card-1' },
    update: {},
    create: {
      id: 'inst-card-1',
      description: 'iPhone 15 Pro 12x',
      totalAmount: 9600,
      installmentCount: 12,
      paidInstallments: 7,
      monthlyValue: 800,
      interestRate: 0,
      startDate: new Date(Y, M - 7, 15),
      nextPaymentDate: new Date(Y, M + 1, 15),
      type: 'CARD_INSTALLMENT',
      status: 'ACTIVE',
      cardId: card1.id,
      categoryId: 'cat-shopping',
      isActive: true,
    },
  });

  // Generate 12 installments for iPhone
  for (let i = 1; i <= 12; i++) {
    const dueDate = new Date(Y, M - 7 + i, 15);
    const isPaid = i <= 7;
    await db.installment.upsert({
      where: { id: `inst-card-1-parc-${i}` },
      update: {},
      create: {
        id: `inst-card-1-parc-${i}`,
        number: i,
        amount: 800,
        dueDate,
        paidDate: isPaid ? new Date(dueDate.getTime() - 86400000) : null,
        status: isPaid ? 'PAID' : 'PENDING',
        installmentPlanId: installmentPlan2.id,
      },
    });
  }

  const installmentPlan3 = await db.installmentPlan.upsert({
    where: { id: 'inst-loan-1' },
    update: {},
    create: {
      id: 'inst-loan-1',
      description: 'Empréstimo Pessoal',
      totalAmount: 10000,
      installmentCount: 24,
      paidInstallments: 0,
      monthlyValue: 500,
      interestRate: 2.0,
      startDate: new Date(Y, M, 1),
      nextPaymentDate: new Date(Y, M + 1, 5),
      type: 'PERSONAL',
      status: 'ACTIVE',
      categoryId: 'cat-other',
      isActive: true,
    },
  });

  // Generate 24 installments for Empréstimo Pessoal - all PENDING
  for (let i = 1; i <= 24; i++) {
    const dueDate = new Date(Y, M + i, 5);
    await db.installment.upsert({
      where: { id: `inst-loan-1-parc-${i}` },
      update: {},
      create: {
        id: `inst-loan-1-parc-${i}`,
        number: i,
        amount: 500,
        dueDate,
        paidDate: null,
        status: 'PENDING',
        installmentPlanId: installmentPlan3.id,
      },
    });
  }

  console.log('✅ Created 3 installment plans with installments');

  // ============================
  // CONSORTIUMS
  // ============================
  const consortium1 = await db.consortium.upsert({
    where: { id: 'cons-car-1' },
    update: {},
    create: {
      id: 'cons-car-1',
      description: 'Honda Civic Touring 2024',
      group: 'Grupo 1234',
      quota: 'Cota 015',
      administrator: 'Banco Honda',
      totalAmount: 150000,
      fundedAmount: 27000,
      monthlyPayment: 2500,
      installmentCount: 60,
      paidInstallments: 10,
      startDate: new Date(Y, M - 10, 1),
      endDate: new Date(Y, M + 50, 1),
      nextAssemblyDate: new Date(Y, M + 1, 15),
      assembliesAttended: 10,
      status: 'ACTIVE',
      categoryId: 'cat-transport',
      isActive: true,
    },
  });

  // Generate 60 consortium installments for Honda Civic
  for (let i = 1; i <= 60; i++) {
    const dueDate = new Date(Y, M - 10 + i, 10);
    const isPaid = i <= 10;
    await db.consortiumInstallment.upsert({
      where: { id: `cons-car-1-inst-${i}` },
      update: {},
      create: {
        id: `cons-car-1-inst-${i}`,
        number: i,
        amount: 2500,
        dueDate,
        paidDate: isPaid ? new Date(dueDate.getTime() + 86400000 * 5) : null,
        status: isPaid ? 'PAID' : 'PENDING',
        assemblyDate: isPaid ? new Date(dueDate.getTime() + 86400000 * 5) : null,
        consortiumId: consortium1.id,
      },
    });
  }

  const consortium2 = await db.consortium.upsert({
    where: { id: 'cons-imovel-1' },
    update: {},
    create: {
      id: 'cons-imovel-1',
      description: 'Apartamento 3 quartos São Paulo',
      group: 'Grupo 5678',
      quota: 'Cota 042',
      administrator: 'Caixa Econômica',
      totalAmount: 350000,
      fundedAmount: 42000,
      monthlyPayment: 3500,
      installmentCount: 100,
      paidInstallments: 12,
      startDate: new Date(Y, M - 12, 1),
      endDate: new Date(Y, M + 88, 1),
      assembliesAttended: 12,
      status: 'ACTIVE',
      categoryId: 'cat-home',
      isActive: true,
    },
  });

  // Generate 100 consortium installments for Apartamento
  for (let i = 1; i <= 100; i++) {
    const dueDate = new Date(Y, M - 12 + i, 10);
    const isPaid = i <= 12;
    await db.consortiumInstallment.upsert({
      where: { id: `cons-imovel-1-inst-${i}` },
      update: {},
      create: {
        id: `cons-imovel-1-inst-${i}`,
        number: i,
        amount: 3500,
        dueDate,
        paidDate: isPaid ? new Date(dueDate.getTime() + 86400000 * 3) : null,
        status: isPaid ? 'PAID' : 'PENDING',
        assemblyDate: isPaid ? new Date(dueDate.getTime() + 86400000 * 3) : null,
        consortiumId: consortium2.id,
      },
    });
  }

  console.log('✅ Created 2 consortiums with installments');

  // ============================
  // MONTHLY BUDGETS (mb-* prefix)
  // ============================
  const monthlyBudgets = [
    { id: 'mb-alimentacao', categoryId: 'cat-food', amount: 1500, month: M + 1, year: Y },
    { id: 'mb-transporte', categoryId: 'cat-transport', amount: 800, month: M + 1, year: Y },
    { id: 'mb-entretenimento', categoryId: 'cat-entertainment', amount: 500, month: M + 1, year: Y },
    { id: 'mb-educacao', categoryId: 'cat-education', amount: 1200, month: M + 1, year: Y },
    { id: 'mb-saude', categoryId: 'cat-health', amount: 600, month: M + 1, year: Y },
    { id: 'mb-moradia', categoryId: 'cat-home', amount: 3000, month: M + 1, year: Y },
  ];

  for (const b of monthlyBudgets) {
    await db.monthlyBudget.upsert({
      where: { id: b.id },
      update: { amount: b.amount },
      create: b,
    });
  }
  console.log(`✅ Created ${monthlyBudgets.length} monthly budgets`);

  // ============================
  // SAVINGS GOALS
  // ============================
  const savingsGoals = [
    {
      id: 'sav-emerg-1',
      name: 'Reserva de Emergência',
      description: 'Reserva para imprevistos - 6 meses de gastos',
      type: 'EMERGENCY_FUND',
      targetAmount: 50000,
      currentAmount: 32500,
      monthlyContribution: 1500,
      yieldRate: 12.5,
      accountId: account2.id,
      color: '#22c55e',
    },
    {
      id: 'sav-viagem-1',
      name: 'Viagem Europa',
      description: 'Passagens + hospedagem + passeios por 15 dias',
      type: 'SAVINGS',
      targetAmount: 20000,
      currentAmount: 8500,
      monthlyContribution: 1000,
      yieldRate: 0,
      accountId: account3.id,
      color: '#3b82f6',
    },
    {
      id: 'sav-cdi-1',
      name: 'Conta CDI 100%',
      description: 'Rendimento atrelado ao CDI 100%',
      type: 'CDI',
      targetAmount: 100000,
      currentAmount: 45000,
      monthlyContribution: 3000,
      yieldRate: 14.0,
      accountId: account2.id,
      color: '#06b6d4',
    },
    {
      id: 'sav-pig-1',
      name: 'Porquinho Natal',
      description: 'Economia para presentes de Natal',
      type: 'PIGGY_BANK',
      targetAmount: 3000,
      currentAmount: 1200,
      monthlyContribution: 300,
      yieldRate: 0,
      accountId: account1.id,
      color: '#f59e0b',
    },
  ];

  for (const g of savingsGoals) {
    await db.savingsGoal.upsert({
      where: { id: g.id },
      update: {},
      create: g,
    });
  }
  console.log('✅ Created 4 savings goals');

  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
