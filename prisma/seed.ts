import { db } from '@/lib/db';

async function main() {
  console.log('🌱 Seeding database...');

  // Clean up old data from previous seed runs (without prefixed IDs)
  // Delete all purchase items, purchases, and transactions, then re-seed with upsert
  await db.purchaseItem.deleteMany({});
  await db.purchase.deleteMany({});
  await db.transaction.deleteMany({});
  console.log('🧹 Cleaned up old transactions and purchases');

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
  // BUDGET GOALS
  // ============================
  const budgetGoals = [
    {
      id: 'goal-emergency',
      name: 'Reserva de Emergência',
      description: '6 meses de gastos essenciais guardados para imprevistos',
      targetAmount: 35000,
      currentAmount: 12500,
      categoryId: null,
      startDate: new Date(Y, M - 3, 1),
      endDate: new Date(Y + 1, M, 0),
      isCompleted: false,
    },
    {
      id: 'goal-vacation',
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
      id: 'goal-notebook',
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
      id: 'goal-car',
      name: 'Entrada do Carro',
      description: 'Reserva para entrada de um carro novo',
      targetAmount: 25000,
      currentAmount: 3200,
      categoryId: null,
      startDate: new Date(Y, M - 5, 1),
      endDate: new Date(Y + 2, 0, 0),
      isCompleted: false,
    },
    {
      id: 'goal-courses',
      name: 'Cursos e Certificações',
      description: 'Investimento em qualificação profissional',
      targetAmount: 5000,
      currentAmount: 5000,
      categoryId: 'cat-education',
      startDate: new Date(Y, M - 6, 1),
      endDate: new Date(Y, M - 1, 0),
      isCompleted: true,
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
