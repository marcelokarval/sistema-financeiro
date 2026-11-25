## 1. Helpers Compartilhados de Validação, Prisma e Datas Civis

- [x] 1.1 Implementar helpers compartilhados em src/lib/api-validation.ts com testes unitários

## 2. Datas Civis e Fórmulas Secundárias (Onda 2, pós-Change 2)

- [x] 2.1 Corrigir filtro de data civil e chave local em dashboard, timeline e transactions GET
- [x] 2.2 Normalizar frequências recorrentes e janela de 3 meses completos em forecast, insights e balance-projection
- [x] 2.3 Corrigir vencimento de cartão, fim de semana no domingo e fatura zero em upcoming-bills

## 3. Atomicidade e Validação JSON, FK e PUT nas Rotas CRUD

- [x] 3.1 Tornar savings/deposit atômico em transação e endurecer validação de monthly-budgets
- [x] 3.2 Padronizar validação JSON, FK e PUT em accounts, cards, categories, budgets, savings e investments
- [x] 3.3 Padronizar validação JSON, FK e PUT em purchases, installments, consortiums e recurring

## 4. Hardening de Exportação CSV, Advisor e Finance-WS

- [x] 4.1 Neutralizar formula injection CSV e corrigir filtro de data civil em /api/export
- [x] 4.2 Omitir lastFourDigits e limitar e delimitar context no prompt de /api/advisor
- [x] 4.3 Restringir bind loopback e CORS configurável em mini-services/finance-ws

## 5. Índices e Integridade Referencial no Schema Prisma

- [x] 5.1 Adicionar índices e onDelete SetNull em prisma/schema.prisma e executar validação completa da change
