import { db } from '@/lib/db';

async function main() {
  console.log('🌱 Seeding database...');

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

  // Create transactions
  const now = new Date();
  const transactions = [
    // Incomes
    { accountId: account3.id, categoryId: 'cat-salary', type: 'INCOME', amount: 8500, description: 'Salário Mensal', date: new Date(now.getFullYear(), now.getMonth(), 5) },
    { accountId: account3.id, categoryId: 'cat-freelance', type: 'INCOME', amount: 2200, description: 'Projeto Freelance - Site', date: new Date(now.getFullYear(), now.getMonth(), 12) },
    { accountId: account4.id, categoryId: 'cat-investment', type: 'INCOME', amount: 350, description: 'Dividendos ITSA4', date: new Date(now.getFullYear(), now.getMonth(), 15) },
    // Cash expenses
    { accountId: account1.id, categoryId: 'cat-food', type: 'EXPENSE', amount: 45, description: 'Almoço no trabalho', date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2) },
    { accountId: account1.id, categoryId: 'cat-transport', type: 'EXPENSE', amount: 32, description: 'Uber - trabalho → casa', date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1) },
    { accountId: account4.id, categoryId: 'cat-bills', type: 'EXPENSE', amount: 189.90, description: 'Netflix + Spotify + Disney+', date: new Date(now.getFullYear(), now.getMonth(), 3) },
    { accountId: account3.id, categoryId: 'cat-home', type: 'EXPENSE', amount: 1800, description: 'Aluguel', date: new Date(now.getFullYear(), now.getMonth(), 10) },
    { accountId: account3.id, categoryId: 'cat-bills', type: 'EXPENSE', amount: 320, description: 'Conta de Luz', date: new Date(now.getFullYear(), now.getMonth(), 8) },
    { accountId: account3.id, categoryId: 'cat-bills', type: 'EXPENSE', amount: 85, description: 'Internet', date: new Date(now.getFullYear(), now.getMonth(), 8) },
    { accountId: account3.id, categoryId: 'cat-health', type: 'EXPENSE', amount: 450, description: 'Plano de Saúde', date: new Date(now.getFullYear(), now.getMonth(), 5) },
    { accountId: account4.id, categoryId: 'cat-education', type: 'EXPENSE', amount: 197, description: 'Alura Plus', date: new Date(now.getFullYear(), now.getMonth(), 1) },
    { accountId: account3.id, categoryId: 'cat-transport', type: 'EXPENSE', amount: 350, description: 'Combustível', date: new Date(now.getFullYear(), now.getMonth(), 14) },
  ];

  for (const t of transactions) {
    await db.transaction.create({ data: t });
  }
  console.log(`✅ Created ${transactions.length} transactions`);

  // Create purchases with items
  const purchases = [
    {
      merchant: 'Carrefour', totalAmount: 456.80, date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3), cardId: card1.id, categoryId: 'cat-food',
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
      merchant: 'Extra Hipermercado', totalAmount: 789.50, date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 10), cardId: card2.id, categoryId: 'cat-shopping',
      items: [
        { name: 'Camiseta Nike', quantity: 2, unitPrice: 129.90, totalPrice: 259.80 },
        { name: 'Tênis Adidas', quantity: 1, unitPrice: 399.90, totalPrice: 399.90 },
        { name: 'Meias Sport 3pç', quantity: 2, unitPrice: 34.90, totalPrice: 69.80 },
        { name: 'Cinto Couro', quantity: 1, unitPrice: 59.90, totalPrice: 59.90 },
      ]
    },
    {
      merchant: 'Farmácia Raia', totalAmount: 167.40, date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 5), cardId: card1.id, categoryId: 'cat-health',
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
      merchant: 'iFood - Restaurante Outback', totalAmount: 189.90, date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1), cardId: card1.id, categoryId: 'cat-food',
      items: [
        { name: 'Onion Rings', quantity: 1, unitPrice: 39.90, totalPrice: 39.90 },
        { name: 'Baby Back Ribs', quantity: 1, unitPrice: 89.90, totalPrice: 89.90 },
        { name: 'Coca-Cola 350ml', quantity: 2, unitPrice: 12.90, totalPrice: 25.80 },
        { name: 'Cheese Cake', quantity: 1, unitPrice: 34.30, totalPrice: 34.30 },
      ]
    },
    {
      merchant: 'Amazon Brasil', totalAmount: 1299.00, date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7), cardId: card2.id, categoryId: 'cat-entertainment',
      items: [
        { name: 'Kindle Paperwhite', quantity: 1, unitPrice: 649.00, totalPrice: 649.00 },
        { name: 'Capa Kindle', quantity: 1, unitPrice: 89.90, totalPrice: 89.90 },
        { name: 'Fone Bluetooth JBL', quantity: 1, unitPrice: 399.00, totalPrice: 399.00 },
        { name: 'Película Kindle', quantity: 2, unitPrice: 34.90, totalPrice: 69.80 },
        { name: 'Carregador USB-C', quantity: 1, unitPrice: 90.40, totalPrice: 90.40 },
      ]
    },
    {
      merchant: 'Mercado Livre - Eletrônicos', totalAmount: 549.90, date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 4), cardId: card1.id, categoryId: 'cat-education',
      items: [
        { name: 'Mouse Logitech MX Master 3S', quantity: 1, unitPrice: 499.90, totalPrice: 499.90 },
        { name: 'Mousepad XL', quantity: 1, unitPrice: 49.90, totalPrice: 49.90 },
      ]
    },
  ];

  for (const p of purchases) {
    await db.purchase.create({
      data: {
        merchant: p.merchant,
        totalAmount: p.totalAmount,
        date: p.date,
        cardId: p.cardId!,
        categoryId: p.categoryId!,
        items: { create: p.items }
      }
    });
  }
  console.log(`✅ Created ${purchases.length} purchases with items`);

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
