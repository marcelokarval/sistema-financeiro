# Design — corrigir-transacoes-calculos-criticos-api

## Context

A auditoria técnica da base (`/api/**`) identificou vulnerabilidades transacionais e erros matemáticos em rotas financeiras críticas:
- Mutações multi-tabela executadas fora de `db.$transaction` ou com validações pré-transacionais sujeitas a TOCTOU (`transfer`, `transactions POST`, `consortiums/installments POST`, `recurring/process POST`, `installments/pay POST`).
- Gravação de transferências entre contas como `EXPENSE` e `INCOME` em `transfer/route.ts`, somando movimentações internas aos totais de receitas e despesas.
- Validação incompleta em `POST /api/transactions` e `POST /api/investments/transactions` em comparação aos respectivos handlers `PUT`.
- Erros de cálculo em `GET /api/quick-stats` (`balanceSparkline` divergente de `netWorth`) e `GET /api/networth` (ausência de `Consortium`, cálculo aproximado de `Installment`, ausência de filtro de `TRANSFER` na query e colapso de passivos históricos para zero quando `netWorth <= -currentLiabilities`).

Restrições do projeto e coordenação entre waves:
- Banco SQLite via Prisma (`prisma/schema.prisma`); `db/custom.db` nunca é editado ou versionado.
- Esta change pertence à **Onda 1**. A change `endurecer-api-datas-calculos-e-schema` (Change 5), que atua em datas civis, helpers compartilhados (`src/lib/api-validation.ts`), `forecast`, `balance-projection`, `insights`, `upcoming-bills`, `export`, `savings/deposit`, `monthly-budgets`, `timeline`, `advisor` e `prisma/schema.prisma`, executará em **Onda 2** após a conclusão desta change.

## Goals / Non-Goals

**Goals:**
- Garantir atomicidade completa (`db.$transaction`) e proteção contra concorrência TOCTOU nas mutações financeiras listadas no escopo.
- Padronizar validações de entrada em `POST /api/transactions`, `POST /api/investments/transactions` e `POST /api/transfer`.
- Registrar transferências com `type: "TRANSFER"` e assegurar que nenhum agregador que utilize ramo `else` some `TRANSFER` como despesa.
- Corrigir a reconstrução retroativa de `balanceSparkline` em `quick-stats` e a apuração de passivos e histórico em `networth`.
- Garantir cobertura automatizada (RED/GREEN) por rota alterada usando SQLite isolado temporário.

**Non-Goals:**
- Alterar regras de data civil (`YYYY-MM-DD` / fuso horário `America/Bahia`), normalização de recorrências em `forecast`/`insights`, limites de contexto do `advisor` ou `prisma/schema.prisma` (escopo exclusivo da Change 5 em Onda 2).
- Criar novos helpers compartilhados em `src/lib/` ou modificar rotas não listadas fora do filtro de `TRANSFER` em agregadores `else`.
- Alterar componentes de UI (`src/components/**`) ou executar migração retroativa de registros legados em `db/custom.db`.

## Decisions

### D1: Guardas atômicas intra-transacionais contra TOCTOU e rollback limpo
- **Escolha:** Em todas as rotas mutadoras no escopo, mover leituras de estado crítico e verificações para dentro de `await db.$transaction(async (tx) => { ... })` e usar `updateMany` condicional antes de gravar efeitos dependentes:
  - `POST /api/transfer`: verificar `fromAccount` e `toAccount` dentro de `tx`; executar `tx.account.updateMany({ where: { id: fromAccountId, balance: { gte: parsedAmount } }, data: { balance: { decrement: parsedAmount } } })` — se `count === 0`, abortar transação com resposta `400`; creditar `toAccount` com `{ increment: parsedAmount }` e criar ambas as transações com `type: "TRANSFER"`.
  - `POST /api/consortiums/installments`: executar `tx.consortiumInstallment.updateMany({ where: { id: installmentId, status: { not: "PAID" } }, data: { status: "PAID", ... } })`; se `count === 0`, abortar com `400`; atualizar `Consortium` com `{ paidInstallments: { increment: 1 }, fundedAmount: { increment: installment.amount } }` e, se atingir `installmentCount`, marcar `status: "COMPLETED"` dentro da mesma `tx`.
  - `POST /api/installments/pay`: mover leitura e checagem de plano `COMPLETED` para dentro de `tx`, executar `tx.installment.updateMany({ where: { id: installmentId, status: { not: "PAID" } }, data: { status: "PAID", paidDate } })` e atualizar `InstallmentPlan` com `{ paidInstallments: { increment: 1 } }`, promovendo para `COMPLETED` se atingir `installmentCount`.
  - `POST /api/recurring/process`: executar dentro de `db.$transaction`; para cada recorrência devida, reivindicar primeiro via `tx.recurringTransaction.updateMany({ where: { id: recurring.id, isActive: true, nextDate: recurring.nextDate }, data: { nextDate: newNextDate } })` e somente criar a transação e atualizar o saldo da conta se `count === 1`.
  - `POST /api/transactions`: validar existência da conta (quando `accountId` informado) e executar `tx.transaction.create` + `tx.account.update` atomicamente dentro de `db.$transaction`.
- **Razão:** No SQLite/Prisma, ler fora da transação ou incrementar usando valores pré-lidos causa lost updates e duplo pagamento/processamento sob requisições concorrentes. Erros de domínio (`400`/`404`) são sinalizados por erro tipado interno capturado fora da transação, garantindo rollback automático sem retornar `500`.
- **Alternativa considerada:** Locks em memória no processo Node/Bun (`Map` de mutexes). Rejeitada porque não protege em múltiplas instâncias/workers nem substitui atomicidade de banco em falha parcial.

### D2: `type: "TRANSFER"` e proteção dos agregadores que usam `else`
- **Escolha:** `POST /api/transfer` passa a gravar `type: "TRANSFER"` nas duas transações (`withdrawal` e `deposit`). Na auditoria read-only dos agregadores:
  - `dashboard`, `quick-stats`, `reports`, `forecast`, `savings-challenge`, `expense-breakdown`, `insights`, `networth` e `balance-projection` já filtram `INCOME` e `EXPENSE` explicitamente.
  - `src/app/api/financial-calendar/route.ts` e `src/app/api/timeline/route.ts` usavam `tx.type === "INCOME" ? tx.amount : -tx.amount`, somando `TRANSFER` como despesa. Ambos recebem filtro `type: { in: ["INCOME", "EXPENSE"] }` na consulta `db.transaction.findMany`.
  - `src/app/api/advisor/route.ts` (linha 149) formatava `recentTransactions` com `t.type === "INCOME" ? "Receita" : "Despesa"`; passa a distinguir `t.type === "TRANSFER" ? "Transferência" : ...`.
- **Razão:** Impede regressão imediata ao passar a gravar `type: "TRANSFER"` sem invadir as alterações de data civil, recorrência ou sanitização de LLM planejadas na Change 5.
- **Alternativa considerada:** Filtrar apenas no frontend ou deixar `timeline`/`advisor` para Onda 2. Rejeitada para `timeline`/`financial-calendar` porque `TRANSFER` passaria a aparecer como despesa nos gráficos de linha do tempo e calendário logo após a Onda 1.

### D3: Alinhamento de validação de `POST` com `PUT`
- **Escolha:**
  - `POST /api/transactions`: validar `type` em `["INCOME", "EXPENSE", "TRANSFER"]`, `Number.isFinite(Number(amount)) && Number(amount) > 0`, `typeof description === "string" && description.trim() !== ""` e `date` válida (`!isNaN(new Date(date).getTime())`).
  - `POST /api/investments/transactions`: validar `Number.isFinite(Number(amount)) && Number(amount) > 0`, `date` válida quando informada, e persistir o valor numérico `parsedAmount` em `create` e `applyTransactionEffect`.
- **Razão:** Elimina assimetria onde `PUT` já rejeitava `NaN`/`Infinity`/datas inválidas enquanto `POST` permitia gravação corrompida.

### D4: Reconstrução retroativa em `quick-stats` e passivos em `networth`
- **Escolha:**
  - `GET /api/quick-stats`: construir `balanceSparkline` de trás para frente a partir de `netWorth` atual (`points[5] = netWorth`; para `i = 4..0`, `points[i] = points[i + 1] - (monthlyData[i + 1].income - monthlyData[i + 1].expense)`), arredondando cada ponto para 2 casas decimais, mantendo `allTransactions` filtrado para `INCOME`/`EXPENSE`.
  - `GET /api/networth`:
    - Incluir `db.consortium.findMany({ where: { isActive: true, status: { notIn: ['COMPLETED', 'CANCELLED'] } }, select: { id: true, totalAmount: true, fundedAmount: true } })` e somar `Math.max(0, c.totalAmount - c.fundedAmount)` em `consortiumDebt`.
    - Calcular `installmentDebt` somando `inst.amount` das parcelas com `status: { in: ['PENDING', 'OVERDUE'] }` dos planos ativos (`status: { notIn: ['COMPLETED', 'CANCELLED'] }`).
    - Adicionar `type: { in: ['INCOME', 'EXPENSE'] }` na query `db.transaction.findMany`.
    - Substituir o escalonamento por `ratio` por:
      ```ts
      const liabilities = netWorth < -currentLiabilities
        ? Math.abs(netWorth)
        : currentLiabilities;
      const assets = Math.max(0, netWorth + liabilities);
      ```
      garantindo `assets >= 0`, `liabilities >= 0`, `assets - liabilities === netWorth` e passivos nunca zerados quando `currentLiabilities > 0` ou `netWorth <= -currentLiabilities`.
- **Razão:** Corrige exatamente a deriva acumulada de `balanceSparkline` e preserva coerência contábil em `networth` sob qualquer sinal de patrimônio.

## Risks / Trade-offs

- [Risk] Sobreposição de arquivo em Onda 1 vs Onda 2 (`src/app/api/timeline/route.ts` e `src/app/api/advisor/route.ts` também estão no escopo da Change 5 `endurecer-api-datas-calculos-e-schema`). → Mitigation: mudança mínima isolada ao filtro/rótulo `TRANSFER` aqui e sequenciamento explícito da Change 5 para Onda 2 (após conclusão e merge/aceite da Change 2).
- [Risk] SQLite em testes concorrentes (`Promise.all`) pode retornar erro transiente `SQLITE_BUSY` se múltiplos escritores disputarem conexão sem timeout. → Mitigation: usar SQLite isolado por suíte em `tmpdir()` e validar se `db.$transaction` serializa adequadamente os fluxos concorrentes no mesmo `PrismaClient`.
- [Trade-off] Manter validação local por rota em vez de extrair `src/lib/api-validation.ts` nesta change. → Aceito para não criar conflito de escrita com a Task 1.1 da Change 5 e manter Onda 1 enxuta e reversível.

## Migration Plan

1. Executar Change 2 (`corrigir-transacoes-calculos-criticos-api`) em **Onda 1**, validando cada task via TDD (RED → GREEN), `bun --no-env-file test`, `bun run typecheck` e `bun run lint`.
2. Somente após concluir e integrar a Change 2, liberar a execução da Change 5 (`endurecer-api-datas-calculos-e-schema`) em **Onda 2**.
3. Não altera `prisma/schema.prisma` nem executa migrações em `db/custom.db`.

## Open Questions

Nenhuma. Todas as decisões técnicas estão fechadas pelo escopo aprovado da auditoria.
