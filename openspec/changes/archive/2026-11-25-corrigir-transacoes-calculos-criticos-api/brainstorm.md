# Brainstorm — corrigir-transacoes-calculos-criticos-api

## Leituras obrigatórias e mapeamento de skills

- Políticas e contratos lidos integralmente antes da criação dos artefatos:
  - `/home/marcelo-karval/.agents/AGENTS.md`
  - `/home/marcelo-karval/.local/share/openspec/schemas/superpowers-bridge/README.md`
  - `/home/marcelo-karval/.agents/skills/brainstorming/SKILL.md`
  - `/home/marcelo-karval/.agents/skills/writing-plans/SKILL.md`
- Mapeamento e invocação observada da skill: `brainstorming` -> `/home/marcelo-karval/.agents/skills/brainstorming/SKILL.md` (carregada integralmente via `read_file` nesta sessão; execução direta sem perguntas ao usuário pois o escopo e as decisões técnicas foram definidos na matriz consolidada da auditoria `#221`/`#226`).
- Capability modificada: `integridade-fluxos-financeiros` (`openspec/specs/integridade-fluxos-financeiros/spec.md`), em Onda 1 de aplicação (antes da Change 5 `endurecer-api-datas-calculos-e-schema`, que roda em Onda 2).

## Diagnóstico do código inspecionado

### Frente 1 — Atomicidade `db.$transaction`, guarda TOCTOU e `type: "TRANSFER"`

1. `src/app/api/transfer/route.ts` (`POST`):
   - Lê `fromAccount` e `toAccount` (linhas 32–33) e checa `fromAccount.balance < amount` (linha 43) fora de transação.
   - Executa 4 escritas separadas sem `db.$transaction` (linhas 54–88): cria `withdrawalTx` com `type: "EXPENSE"` (linha 56), cria `depositTx` com `type: "INCOME"` (linha 69), decrementa `fromAccount.balance` e incrementa `toAccount.balance`.
   - Não valida `Number.isFinite(Number(amount))` nem `date` válida.
   - Consequência: risco de corrida TOCTOU em transferências concorrentes, estado inconsistente em falha parcial e inflação artificial de receitas/despesas quando `withdrawalTx`/`depositTx` são somadas em agregadores.
2. Inspeção read-only dos agregadores quanto ao tratamento de `TRANSFER` (sem alterar datas civis/recorrências da Change 5):
   - Já filtram explicitamente `INCOME` e `EXPENSE` (sem `else` tratando `TRANSFER` como despesa): `src/app/api/dashboard/route.ts`, `src/app/api/quick-stats/route.ts`, `src/app/api/reports/route.ts`, `src/app/api/forecast/route.ts`, `src/app/api/savings-challenge/route.ts`, `src/app/api/expense-breakdown/route.ts`, `src/app/api/insights/route.ts`, `src/app/api/networth/route.ts`, `src/app/api/balance-projection/route.ts`.
   - Possuem `else`/ternário que trata qualquer `type !== "INCOME"` como despesa ou rótulo `"Despesa"`:
     - `src/app/api/financial-calendar/route.ts` (linhas 101–107 e 154: `const isIncome = tx.type === "INCOME"; amount: isIncome ? tx.amount : -tx.amount`), rota não tocada pela Change 5.
     - `src/app/api/timeline/route.ts` (linhas 40–46 e 62: `const isIncome = tx.type === 'INCOME'; amount: isIncome ? tx.amount : -tx.amount`), rota da Change 5 (Onda 2) que precisa de filtro `type: { in: ['INCOME', 'EXPENSE'] }` já na Onda 1 para não somar `TRANSFER` como despesa.
     - `src/app/api/advisor/route.ts` (linhas 48–53 e 149: `t.type === "INCOME" ? "Receita" : "Despesa"` no resumo de `recentTransactions`), rota da Change 5 (Onda 2) que precisa distinguir `TRANSFER` (`"Transferência"`) na linha 149 sem alterar limites de contexto ou `lastFourDigits` (que pertencem à Change 5).
3. `src/app/api/transactions/route.ts` (`POST`):
   - Linhas 62–74: não valida enum de `type` (`INCOME`, `EXPENSE`, `TRANSFER`), não usa `Number.isFinite(Number(amount))` nem valida `date` válida (ao contrário de `PUT` nas linhas 139–165).
   - Linhas 83–114: cria `db.transaction.create` e atualiza `db.account.update` fora de `db.$transaction`.
4. `src/app/api/consortiums/installments/route.ts` (`POST`):
   - Linhas 45–89: lê parcela, verifica `installment.status === "PAID"` fora de transação e executa `db.consortiumInstallment.update` + `db.consortium.update` fora de `db.$transaction` com `paidInstallments + 1` e `fundedAmount + installment.amount` pré-calculados.
5. `src/app/api/recurring/process/route.ts` (`POST`):
   - Linhas 34–87: lê `dueTransactions` e, em loop, cria `Transaction`, atualiza `Account` e avança `nextDate` fora de `db.$transaction` e sem guarda condicional contra processamento concorrente duplo.
6. `src/app/api/installments/pay/route.ts` (`POST`):
   - Linhas 17–70: já usa `db.$transaction`, mas lê `installment` e checa `status === "PAID"` antes da transação (TOCTOU) e atualiza o plano com `paidInstallments + 1` pré-calculado em vez de `updateMany` condicional + `{ increment: 1 }`.
7. `src/app/api/investments/transactions/route.ts` (`POST`):
   - Linhas 94–99 e 126: checa apenas `amount === undefined || amount === null` (aceitando `<= 0`, `NaN`, `Infinity`) e não valida `date` antes de `new Date(date)` (ao contrário de `PUT` nas linhas 188–201).

### Frente 2 — Bugs matemáticos críticos de leitura

1. `src/app/api/quick-stats/route.ts`:
   - Já filtra `type: { in: ["INCOME", "EXPENSE"] }` na query de `allTransactions` (linha 51).
   - Bug em `balanceSparkline` (linhas 136–140): inicia `runningBalance = netWorth - monthlySavings` e soma todos os 6 meses (`i = 0..5`), resultando em `balanceSparkline[5] === netWorth + soma(m[0..4])` em vez de `netWorth`.
2. `src/app/api/networth/route.ts`:
   - Não consulta `Consortium` (`totalAmount - fundedAmount`) em `currentLiabilities` (linhas 15–94), ao contrário de `src/app/api/debts/route.ts`.
   - Estima `installmentDebt` por `totalAmount - (paidInstallments * monthlyValue)` (linhas 85–90) em vez de somar parcelas com `status` `PENDING`/`OVERDUE`.
   - Não filtra `type: { in: ['INCOME', 'EXPENSE'] }` na query `db.transaction.findMany` (linhas 55–64).
   - Em `monthlyData` (linhas 139–144), usa `ratio = (netWorth + currentLiabilities) / (currentAssets + currentLiabilities)` e multiplica por `Math.max(0, ratio)`, zerando `assets` e `liabilities` históricos sempre que `netWorth <= -currentLiabilities` (ou reduzindo passivos quando `netWorth < 0`).

## Abordagens consideradas e decisão

- **Abordagem A (escolhida):**
  - Envolver todas as mutações financeiras multi-etapa em `db.$transaction` com guardas condicionais atômicas (`updateMany` com `balance: { gte: amount }`, `status: { not: "PAID" }`, `nextDate: recurring.nextDate`), `{ increment: ... }` / `{ decrement: ... }` atômicos, gravação de `type: "TRANSFER"` nas transferências e guarda explícita contra `TRANSFER` nos agregadores que usam `else` (`financial-calendar`, `timeline`, `advisor`).
  - Reconstruir `balanceSparkline` retroativamente a partir de `netWorth` (`balance[5] = netWorth`, `balance[i] = balance[i+1] - (m[i+1].income - m[i+1].expense)`), garantindo exatidão de `balanceSparkline[5] === netWorth` e consistência passo a passo.
  - Em `networth/route.ts`, somar `Consortium` ativo (`totalAmount - fundedAmount`), somar parcelas `PENDING`/`OVERDUE` de planos ativos não concluídos/cancelados, filtrar `type: { in: ['INCOME', 'EXPENSE'] }` na query de transações e computar `liabilities = netWorth < -currentLiabilities ? Math.abs(netWorth) : currentLiabilities` e `assets = Math.max(0, netWorth + liabilities)`, preservando sempre `assets >= 0`, `liabilities >= 0`, `assets - liabilities === netWorth` e impedindo que passivos históricos sejam zerados com patrimônio negativo.
- **Abordagem B (rejeitada):** Manter pré-validações fora da transação e tentar compensações manuais em `catch`, ou criar helpers compartilhados novos em `src/lib/` nesta change. Rejeitada porque compensações manuais não protegem contra concorrência TOCTOU e helpers novos em `src/lib/` colidiriam com o escopo da Change 5 (`src/lib/api-validation.ts` em Onda 2).
- **Sequenciamento entre Waves:** Change 2 (`corrigir-transacoes-calculos-criticos-api`) executa em **Onda 1**; Change 5 (`endurecer-api-datas-calculos-e-schema`) executa em **Onda 2** após conclusão da Change 2, evitando conflito em `timeline/route.ts` e `advisor/route.ts`.
