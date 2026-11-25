# Implementation plan

Bridge task contract: 1

**Goal:** Corrigir atomicidade transacional, guardas TOCTOU, validação de entrada, registro/isolamento de `type: "TRANSFER"` e bugs matemáticos em `quick-stats` e `networth` com cobertura TDD completa por rota em Onda 1.
**Architecture:** Conforme `design.md` (D1–D4), cada rota mutadora executa leituras e escritas críticas dentro de `db.$transaction` com `updateMany` condicional e `{ increment }`/`{ decrement }` atômicos; `POST /api/transfer` grava `type: "TRANSFER"` e os agregadores com ramo `else` (`financial-calendar`, `timeline`, `advisor`) passam a filtrar ou distinguir `TRANSFER`; `quick-stats` reconstrói `balanceSparkline` retroativamente a partir de `netWorth` e `networth` soma `Consortium` e parcelas `PENDING`/`OVERDUE` preservando passivos históricos sob `netWorth` negativo. Esta change executa em **Onda 1**, antes da change `endurecer-api-datas-calculos-e-schema` (Change 5, **Onda 2**).
**Tech Stack:** Next.js 16, TypeScript, Prisma 6 (SQLite), Bun test.
**Spec:** `openspec/changes/corrigir-transacoes-calculos-criticos-api/specs/integridade-fluxos-financeiros/spec.md` e `openspec/changes/corrigir-transacoes-calculos-criticos-api/design.md`.
**Leituras obrigatórias verificadas:** `/home/marcelo-karval/.agents/AGENTS.md`, `/home/marcelo-karval/.local/share/openspec/schemas/superpowers-bridge/README.md`, `/home/marcelo-karval/.agents/skills/brainstorming/SKILL.md`, `/home/marcelo-karval/.agents/skills/writing-plans/SKILL.md`.
**Skill mapping and observed invocation:** `writing-plans` (`/home/marcelo-karval/.agents/skills/writing-plans/SKILL.md`), resolvida e lida integralmente via `read_file` antes da redação deste plano.

## Global Constraints

- Idioma pt-BR nas mensagens de domínio existentes onde aplicável; manter contrato de resposta JSON compatível com os consumidores existentes.
- Proibido editar `db/custom.db`, `.env`, `prisma/schema.prisma`, `src/components/ui/**` ou rodar `git commit` sem autorização explícita.
- Todas as tasks executam em **Onda 1**; a change `endurecer-api-datas-calculos-e-schema` (Change 5) executa em **Onda 2** após conclusão desta change, evitando conflito em `src/app/api/timeline/route.ts` e `src/app/api/advisor/route.ts`.
- Não alterar datas civis, cálculo de recorrências ou sanitização de contexto LLM em `forecast`, `balance-projection`, `insights`, `upcoming-bills`, `export`, `savings/deposit` e `monthly-budgets`.
- Todo teste deve usar SQLite isolado temporário (`mkdtempSync` em `os.tmpdir()`), nunca `db/custom.db`.

## Review Focus

- Transferência concorrente (`Promise.all`) disputando saldo insuficiente na conta origem: apenas 1 pode passar e o saldo final não pode ficar negativo.
- Pagamento concorrente do mesmo `installmentId` em `/api/installments/pay` e `/api/consortiums/installments`: `paidInstallments` e `fundedAmount` incrementam exatamente uma vez e a segunda chamada retorna `400`.
- Processamento recorrente concorrente em `POST /api/recurring/process`: `nextDate` avança uma única vez e nenhuma transação duplicada é gerada.
- `POST /api/transactions` e `POST /api/investments/transactions` com `amount` igual a `0`, negativo, `NaN`, `Infinity`, string não numérica ou `date` inválida: retornam `400` sem alterar saldos.
- `GET /api/networth` quando `netWorth` histórico é menor ou igual a `-currentLiabilities` (ex.: `-2500` com `currentLiabilities = 2000`): `liabilities` permanece positivo (`2500`) e `assets - liabilities === netWorth`.

## Task 1.1: Transferências atômicas com TRANSFER e filtro nos agregadores else

- Depends on: none
- Needs: none
- Outcome: `POST /api/transfer` executa atomicamente em `db.$transaction` com guarda TOCTOU de saldo (`updateMany` condicional), grava `type: "TRANSFER"` em `withdrawal` e `deposit`, valida `amount` finito positivo e `date` válida; `financial-calendar` e `timeline` filtram `TRANSFER` de receitas/despesas e `advisor` distingue `TRANSFER` de `Despesa` em transações recentes, com suíte RED/GREEN passando.
- Owner/resolver: Executor designado na Onda 1 / Coordenador para decisões de contrato.
- Inputs: `src/app/api/transfer/route.ts`, `src/app/api/financial-calendar/route.ts`, `src/app/api/timeline/route.ts`, `src/app/api/advisor/route.ts`, `src/app/api/advisor/route.test.ts`.
- Produces: transfer_atomicity_and_filter
- Write paths: src/app/api/transfer/route.ts, src/app/api/transfer/route.test.ts, src/app/api/financial-calendar/route.ts, src/app/api/financial-calendar/route.test.ts, src/app/api/timeline/route.ts, src/app/api/timeline/route.test.ts, src/app/api/advisor/route.ts, src/app/api/advisor/route.test.ts
- Exclusions: db/custom.db, prisma/schema.prisma, src/app/api/forecast/route.ts, src/app/api/balance-projection/route.ts, src/app/api/insights/route.ts, src/app/api/upcoming-bills/route.ts, src/app/api/export/route.ts, src/app/api/savings/deposit/route.ts, src/app/api/monthly-budgets/route.ts
- Shared resources: none
- Acceptance: `bun --no-env-file test src/app/api/transfer/route.test.ts src/app/api/financial-calendar/route.test.ts src/app/api/timeline/route.test.ts src/app/api/advisor/route.test.ts` passa com 0 falhas e 0 skips após a implementação.
- Stop: Falha em validar comportamento esperado de `TRANSFER` nos testes existentes de UI ou divergência de contrato em `financial-calendar`/`timeline`/`advisor`.
- Resume: Confirmar ajuste mínimo no escopo de `TRANSFER` ou reconciliar contrato com o coordenador.
- RED command and observed failure: `bun --no-env-file test src/app/api/transfer/route.test.ts src/app/api/financial-calendar/route.test.ts src/app/api/timeline/route.test.ts src/app/api/advisor/route.test.ts` -> 2 aprovados, 7 reprovações (`timeline` esperava 300 e recebeu 800; `advisor` rotulou TRANSFER como `[Despesa]`; `transfer` gravou `EXPENSE`, retornou 500 para valor inválido, debitou 750 sem rollback e permitiu corrida TOCTOU `[201, 201]`; `financial-calendar` esperava 400 e recebeu 1300).
- GREEN command and observed result: `bun --no-env-file test src/app/api/transfer/route.test.ts src/app/api/financial-calendar/route.test.ts src/app/api/timeline/route.test.ts src/app/api/advisor/route.test.ts` -> 9 aprovados, 0 reprovações (44 expect() calls, 4 arquivos).
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: `verifier-apply-6` (Fase 1 PASS em `#260`; Fase 2 sobre o candidato final pós-`#274`).
- Remaining gaps: nenhum (QA integrado `#256` e `#274` aprovados, com `test:sqlite` `54` aprovados e `0` reprovações; revisão Fase 2 solicitada sobre o candidato final).

Passos TDD (1.1):
1. Escrever testes falhando em `src/app/api/transfer/route.test.ts` cobrindo: criação de duas transações com `type: "TRANSFER"`, validação `400` para `amount` inválido (`0`, `-10`, `NaN`, `Infinity`) e `date` inválida, rollback se o segundo passo falhar (simulando falha em `tx.account.update` / conta destino inexistente), e concorrência TOCTOU com `Promise.all` disputando o mesmo saldo.
2. Escrever testes falhando em `src/app/api/financial-calendar/route.test.ts`, `src/app/api/timeline/route.test.ts` e caso adicional em `src/app/api/advisor/route.test.ts` verificando que transações `type: "TRANSFER"` não entram como despesa em `financial-calendar`/`timeline` e aparecem como `Transferência` (não `Despesa`) em `advisor`.
3. Rodar comando RED e confirmar falha esperada.
4. Atualizar `src/app/api/transfer/route.ts` para validar entrada, executar dentro de `db.$transaction`, usar `updateMany` condicional `balance: { gte: parsedAmount }` e gravar `type: "TRANSFER"`.
5. Atualizar `src/app/api/financial-calendar/route.ts` e `src/app/api/timeline/route.ts` com filtro `type: { in: ["INCOME", "EXPENSE"] }` nas consultas `db.transaction.findMany`, e atualizar a formatação em `src/app/api/advisor/route.ts` linha 149 para distinguir `TRANSFER` como `Transferência`.
6. Rodar comando GREEN e confirmar aprovação total.

## Task 1.2: Atomicidade e validação estrita em POST /api/transactions

- Depends on: none
- Needs: none
- Outcome: `POST /api/transactions` valida `type` (`INCOME`, `EXPENSE`, `TRANSFER`), `amount` finito positivo, `description` string não vazia e `date` válida (alinhado ao `PUT`), e executa criação + atualização de saldo atomicamente em `db.$transaction`, com testes RED/GREEN em `src/app/api/transactions/route.test.ts`.
- Owner/resolver: Executor designado na Onda 1 / Coordenador para decisões de contrato.
- Inputs: `src/app/api/transactions/route.ts`, `src/app/api/transactions/route.test.ts`.
- Produces: transactions_post_atomicity_validation
- Write paths: src/app/api/transactions/route.ts, src/app/api/transactions/route.test.ts
- Exclusions: db/custom.db, prisma/schema.prisma
- Shared resources: none
- Acceptance: `bun --no-env-file test src/app/api/transactions/route.test.ts` passa com 0 falhas e 0 skips após a implementação.
- Stop: Erro de compatibilidade com chamadas existentes de criação na suíte geral.
- Resume: Ajustar payload ou validação preservando o contrato da suíte e retestar.
- RED command and observed failure: `bun --no-env-file test src/app/api/transactions/route.test.ts` -> 3 aprovados, 2 reprovações (`POST` inválido retornou 201 em vez de 400 e `accountId` inexistente retornou 500 em vez de 400/404).
- GREEN command and observed result: `bun --no-env-file test src/app/api/transactions/route.test.ts` -> 5 aprovados, 0 reprovações (24 expect() calls).
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: `verifier-apply-6` (Fase 1 PASS em `#260`; Fase 2 sobre o candidato final pós-`#274`).
- Remaining gaps: nenhum (QA integrado `#256` e `#274` aprovados, com `test:sqlite` `54` aprovados e `0` reprovações; revisão Fase 2 solicitada sobre o candidato final).

Passos TDD (1.2):
1. Adicionar casos RED em `src/app/api/transactions/route.test.ts` cobrindo `POST` com `type` inválido, `amount` igual a `0`, `-10`, `NaN`, `Infinity`, `date` inválida (`"data-invalida"`), e rollback atômico quando `accountId` inexistente ou atualização de conta falha dentro da transação (sem deixar `Transaction` órfã).
2. Rodar comando RED e confirmar falha esperada.
3. Atualizar `POST` em `src/app/api/transactions/route.ts` para validar `type`, `parsedAmount = Number(amount)`, `description` e `date`, verificar `accountId` e executar `tx.transaction.create` + `tx.account.update` dentro de `db.$transaction`.
4. Rodar comando GREEN e confirmar todos os testes de `POST`, `PUT` e `DELETE` aprovados.

## Task 1.3: Pagamento atômico e guarda TOCTOU em POST /api/consortiums/installments

- Depends on: none
- Needs: none
- Outcome: `POST /api/consortiums/installments` executa integralmente em `db.$transaction` usando `updateMany` condicional (`status: { not: "PAID" }`) e `{ increment: 1 }` / `{ increment: installment.amount }` no consórcio, promovendo para `COMPLETED` ao atingir `installmentCount`, com testes RED/GREEN dedicados.
- Owner/resolver: Executor designado na Onda 1 / Coordenador para decisões de contrato.
- Inputs: `src/app/api/consortiums/installments/route.ts`.
- Produces: consortium_installment_payment_atomicity
- Write paths: src/app/api/consortiums/installments/route.ts, src/app/api/consortiums/installments/route.test.ts
- Exclusions: db/custom.db, prisma/schema.prisma, src/app/api/consortiums/route.ts, src/app/api/consortiums/assembly.test.ts
- Shared resources: none
- Acceptance: `bun --no-env-file test src/app/api/consortiums/installments/route.test.ts` passa com 0 falhas e 0 skips após a implementação.
- Stop: Erro de DDL ou comportamento divergente do Prisma no `updateMany` em SQLite temporário.
- Resume: Reconciliar DDL de teste com `prisma/schema.prisma` e retestar.
- RED command and observed failure: `bun --no-env-file test src/app/api/consortiums/installments/route.test.ts` -> 2 aprovados, 2 reprovações (parcela permaneceu `PAID` após falha do consórcio sem rollback e corrida concorrente retornou `[200, 200]`).
- GREEN command and observed result: `bun --no-env-file test src/app/api/consortiums/installments/route.test.ts` -> 4 aprovados, 0 reprovações (14 expect() calls).
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: `verifier-apply-6` (Fase 1 PASS em `#260`; Fase 2 sobre o candidato final pós-`#274`).
- Remaining gaps: nenhum (QA integrado `#256` e `#274` aprovados, com `test:sqlite` `54` aprovados e `0` reprovações; revisão Fase 2 solicitada sobre o candidato final).

Passos TDD (1.3):
1. Criar `src/app/api/consortiums/installments/route.test.ts` (padrão SQLite isolado em `tmpdir()`) com testes RED para: pagamento válido atualizando parcela e consórcio, rejeição `400` em parcela já paga, conclusão `COMPLETED` na última parcela, rollback atômico e corrida concorrente (`Promise.all` de duas chamadas ao mesmo `installmentId` permitindo apenas 1 sucesso).
2. Rodar comando RED e confirmar falha esperada.
3. Refatorar `POST` em `src/app/api/consortiums/installments/route.ts` para rodar em `db.$transaction`, validar datas opcionais (`paidDate`, `assemblyDate`), executar `tx.consortiumInstallment.updateMany({ where: { id: installmentId, status: { not: "PAID" } }, ... })` e atualizar `Consortium` com `{ increment: 1 }` e `{ increment: installment.amount }`.
4. Rodar comando GREEN e confirmar aprovação total.

## Task 1.4: Processamento atômico e idempotente em POST /api/recurring/process

- Depends on: none
- Needs: none
- Outcome: `POST /api/recurring/process` executa dentro de `db.$transaction` reivindicando cada recorrência vencida via `updateMany` condicional (`id`, `isActive: true`, `nextDate: recurring.nextDate`) antes de criar a transação e atualizar o saldo da conta, com testes RED/GREEN dedicados.
- Owner/resolver: Executor designado na Onda 1 / Coordenador para decisões de contrato.
- Inputs: `src/app/api/recurring/process/route.ts`.
- Produces: recurring_process_atomicity
- Write paths: src/app/api/recurring/process/route.ts, src/app/api/recurring/process/route.test.ts
- Exclusions: db/custom.db, prisma/schema.prisma, src/app/api/recurring/route.ts
- Shared resources: none
- Acceptance: `bun --no-env-file test src/app/api/recurring/process/route.test.ts` passa com 0 falhas e 0 skips após a implementação.
- Stop: Falha em serialização de `nextDate` ou comportamento inesperado de `Date` em SQLite temporário.
- Resume: Ajustar comparação exata de `nextDate` ou captura de rollback na transação e retestar.
- RED command and observed failure: `bun --no-env-file test src/app/api/recurring/process/route.test.ts` -> 1 aprovado, 2 reprovações (transação criada permaneceu com count 1 após falha de conta e corrida concorrente processou 2 em vez de 1).
- GREEN command and observed result: `bun --no-env-file test src/app/api/recurring/process/route.test.ts` -> 3 aprovados, 0 reprovações (14 expect() calls).
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: `verifier-apply-6` (Fase 1 PASS em `#260`; Fase 2 sobre o candidato final pós-`#274`).
- Remaining gaps: nenhum (QA integrado `#256` e `#274` aprovados, com `test:sqlite` `54` aprovados e `0` reprovações; revisão Fase 2 solicitada sobre o candidato final).

Passos TDD (1.4):
1. Criar `src/app/api/recurring/process/route.test.ts` com testes RED cobrindo: processamento de recorrências vencidas (`INCOME` e `EXPENSE`), avanço de `nextDate`, rollback total quando a atualização da conta falha, e invocação concorrente (`Promise.all([POST(), POST()])`) processando a recorrência uma única vez sem duplicar transação ou saldo.
2. Rodar comando RED e confirmar falha esperada.
3. Refatorar `POST` em `src/app/api/recurring/process/route.ts` para usar `db.$transaction` e `tx.recurringTransaction.updateMany({ where: { id: recurring.id, isActive: true, nextDate: recurring.nextDate }, data: { nextDate: newNextDate } })` antes de criar a transação e atualizar a conta.
4. Rodar comando GREEN e confirmar aprovação total.

## Task 1.5: Guarda TOCTOU e incremento atômico em POST /api/installments/pay

- Depends on: none
- Needs: none
- Outcome: `POST /api/installments/pay` executa leitura e guarda dentro de `tx`, usa `updateMany` condicional (`status: { not: "PAID" }`) e incrementa `paidInstallments` com `{ increment: 1 }`, marcando `status: "COMPLETED"` ao atingir `installmentCount`, com testes RED/GREEN dedicados.
- Owner/resolver: Executor designado na Onda 1 / Coordenador para decisões de contrato.
- Inputs: `src/app/api/installments/pay/route.ts`.
- Produces: installments_pay_toctou_guard
- Write paths: src/app/api/installments/pay/route.ts, src/app/api/installments/pay/route.test.ts
- Exclusions: db/custom.db, prisma/schema.prisma, src/app/api/installments/route.ts, src/app/api/installments/route.test.ts
- Shared resources: none
- Acceptance: `bun --no-env-file test src/app/api/installments/pay/route.test.ts` passa com 0 falhas e 0 skips após a implementação.
- Stop: Divergência de resposta HTTP ou mensagem em parcelas já pagas / planos concluídos.
- Resume: Reconciliar contrato de status `400`/`404` e retestar.
- RED command and observed failure: `bun --no-env-file test src/app/api/installments/pay/route.test.ts` -> 3 aprovados, 1 reprovação (pagamento concorrente da mesma parcela retornou `[200, 200]` em vez de `[200, 400]`).
- GREEN command and observed result: `bun --no-env-file test src/app/api/installments/pay/route.test.ts` -> 4 aprovados, 0 reprovações (10 expect() calls).
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: `verifier-apply-6` (Fase 1 PASS em `#260`; Fase 2 sobre o candidato final pós-`#274`).
- Remaining gaps: nenhum (QA integrado `#256` e `#274` aprovados, com `test:sqlite` `54` aprovados e `0` reprovações; revisão Fase 2 solicitada sobre o candidato final).

Passos TDD (1.5):
1. Criar `src/app/api/installments/pay/route.test.ts` com testes RED cobrindo: pagamento válido, `404` para parcela inexistente, `400` para parcela já paga ou plano concluído, promoção para `COMPLETED` na última parcela e corrida concorrente (`Promise.all` para o mesmo `installmentId` incrementando `paidInstallments` apenas uma vez).
2. Rodar comando RED e confirmar falha esperada.
3. Refatorar `POST` em `src/app/api/installments/pay/route.ts` para mover a checagem para dentro de `tx`, usar `tx.installment.updateMany({ where: { id: installmentId, status: { not: "PAID" } }, ... })` e atualizar o plano com `paidInstallments: { increment: 1 }`.
4. Rodar comando GREEN e confirmar aprovação total.

## Task 1.6: Validação estrita em POST /api/investments/transactions

- Depends on: none
- Needs: none
- Outcome: `POST /api/investments/transactions` valida `Number.isFinite(Number(amount))` maior que zero e `date` válida (mesmos critérios do `PUT`), persistindo `parsedAmount` numérico atomicamente, com testes RED/GREEN em `src/app/api/investments/transactions/route.test.ts`.
- Owner/resolver: Executor designado na Onda 1 / Coordenador para decisões de contrato.
- Inputs: `src/app/api/investments/transactions/route.ts`, `src/app/api/investments/transactions/route.test.ts`.
- Produces: investment_transactions_post_validation
- Write paths: src/app/api/investments/transactions/route.ts, src/app/api/investments/transactions/route.test.ts
- Exclusions: db/custom.db, prisma/schema.prisma, src/app/api/investments/route.ts
- Shared resources: none
- Acceptance: `bun --no-env-file test src/app/api/investments/transactions/route.test.ts` passa com 0 falhas e 0 skips após a implementação.
- Stop: Quebra nos testes existentes de `PUT`/`DELETE` ou UI de investimentos.
- Resume: Ajustar validação mantendo compatibilidade com payloads numéricos válidos e retestar.
- RED command and observed failure: `bun --no-env-file test src/app/api/investments/transactions/route.test.ts` -> 3 aprovados, 2 reprovações (`POST` inválido retornou 201 em vez de 400 e string numérica `"250"` gerou 500 por PrismaClientValidationError).
- GREEN command and observed result: `bun --no-env-file test src/app/api/investments/transactions/route.test.ts` -> 5 aprovados, 0 reprovações (26 expect() calls).
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: `verifier-apply-6` (Fase 1 PASS em `#260`; Fase 2 sobre o candidato final pós-`#274`).
- Remaining gaps: nenhum (QA integrado `#256` e `#274` aprovados, com `test:sqlite` `54` aprovados e `0` reprovações; revisão Fase 2 solicitada sobre o candidato final).

Passos TDD (1.6):
1. Adicionar casos RED para `POST` em `src/app/api/investments/transactions/route.test.ts` cobrindo rejeição `400` para `amount` igual a `0`, `-10`, `NaN`, `Infinity`, string não numérica e `date` inválida, além de criação `201` válida atualizando `currentBalance` e `investedAmount`.
2. Rodar comando RED e confirmar falha esperada.
3. Atualizar `POST` em `src/app/api/investments/transactions/route.ts` com validação de `parsedAmount = Number(amount)` (`!Number.isFinite(parsedAmount) || parsedAmount <= 0`) e `date` válida (`isNaN(new Date(date).getTime())`), usando `parsedAmount` na transação.
4. Rodar comando GREEN e confirmar aprovação total.

## Task 2.1: Reconstrução retroativa de balanceSparkline em GET /api/quick-stats

- Depends on: none
- Needs: none
- Outcome: `GET /api/quick-stats` reconstrói `balanceSparkline` retroativamente a partir do `netWorth` atual de forma que `balanceSparkline[5]` seja exatamente igual a `current.netWorth` e cada mês anterior reflita a subtração do saldo líquido subsequente, ignorando `TRANSFER` em receitas/despesas, com asserções exatas em `src/app/api/quick-stats/route.test.ts`.
- Owner/resolver: Executor designado na Onda 1 / Coordenador para decisões de contrato.
- Inputs: `src/app/api/quick-stats/route.ts`, `src/app/api/quick-stats/route.test.ts`.
- Produces: quick_stats_balance_sparkline
- Write paths: src/app/api/quick-stats/route.ts, src/app/api/quick-stats/route.test.ts
- Exclusions: db/custom.db, prisma/schema.prisma
- Shared resources: none
- Acceptance: `bun --no-env-file test src/app/api/quick-stats/route.test.ts` passa com 0 falhas e 0 skips após a implementação.
- Stop: Divergência com testes de UI do dashboard que consomem `sparklines.balance`.
- Resume: Confirmar fórmula retroativa e atualizar/validar suíte completa.
- RED command and observed failure: `bun --no-env-file test src/app/api/quick-stats/route.test.ts` -> 0 aprovados, 1 reprovação (`sparklines.balance` retornou `[5450, 5250, 5250, 5250, 6200, 7500]` em vez de `[3700, 3500, 3500, 3500, 4450, 5750]`).
- GREEN command and observed result: `bun --no-env-file test src/app/api/quick-stats/route.test.ts` -> 1 aprovado, 0 reprovações (14 expect() calls).
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: `verifier-apply-6` (Fase 1 PASS em `#260`; Fase 2 sobre o candidato final pós-`#274`).
- Remaining gaps: nenhum (QA integrado `#256` e `#274` aprovados, com `test:sqlite` `54` aprovados e `0` reprovações; revisão Fase 2 solicitada sobre o candidato final).

Passos TDD (2.1):
1. Adicionar asserções RED em `src/app/api/quick-stats/route.test.ts` incluindo transações `type: "TRANSFER"` no cenário e validando os 6 valores exatos de `sparklines.balance` (`[3700, 3500, 3500, 3500, 4450, 5750]`) e `sparklines.balance[5] === current.netWorth`, além da não interferência de `TRANSFER` em `income`/`expense`/`monthlySavings`.
2. Rodar comando RED e confirmar falha esperada na série atual inflada.
3. Corrigir a reconstrução de `balanceSparkline` em `src/app/api/quick-stats/route.ts` retrocedendo a partir de `netWorth` (`points[5] = netWorth`, `points[i] = points[i + 1] - (monthlyData[i + 1].income - monthlyData[i + 1].expense)`).
4. Rodar comando GREEN e confirmar aprovação total.

## Task 2.2: Dívidas reais e passivos históricos negativos em GET /api/networth

- Depends on: none
- Needs: none
- Outcome: `GET /api/networth` inclui dívida ativa de `Consortium` (`totalAmount - fundedAmount`), calcula dívida de parcelamentos pela soma das parcelas `PENDING` e `OVERDUE`, filtra `TRANSFER` na consulta mensal e calcula `assets`/`liabilities` históricos sem zerar passivos quando `netWorth` é negativo ou menor ou igual a `-currentLiabilities`, com suíte RED/GREEN dedicada em `src/app/api/networth/route.test.ts`.
- Owner/resolver: Executor designado na Onda 1 / Coordenador para decisões de contrato.
- Inputs: `src/app/api/networth/route.ts`.
- Produces: networth_liabilities_and_history
- Write paths: src/app/api/networth/route.ts, src/app/api/networth/route.test.ts
- Exclusions: db/custom.db, prisma/schema.prisma
- Shared resources: none
- Acceptance: `bun --no-env-file test src/app/api/networth/route.test.ts` passa com 0 falhas e 0 skips após a implementação.
- Stop: Dúvida sobre status elegíveis de `Consortium` ou planos de parcelamento sem parcelas filhas.
- Resume: Confirmar alinhamento com `debts/route.ts` e `installments/route.ts` e retestar.
- RED command and observed failure: `bun --no-env-file test src/app/api/networth/route.test.ts` -> 0 aprovados, 1 reprovação (`nov.assets` retornou 434.78 em vez de 1000 por ausência de consórcio, fórmula aproximada de parcelamento e escalonamento por ratio).
- GREEN command and observed result: `bun --no-env-file test src/app/api/networth/route.test.ts` -> 1 aprovado, 0 reprovações (10 expect() calls).
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: `verifier-apply-6` (Fase 1 PASS em `#260`; Fase 2 sobre o candidato final pós-`#274`).
- Remaining gaps: nenhum (QA integrado `#256` e `#274` aprovados, com `test:sqlite` `54` aprovados e `0` reprovações; revisão Fase 2 solicitada sobre o candidato final).

Passos TDD (2.2):
1. Criar `src/app/api/networth/route.test.ts` (SQLite isolado em `tmpdir()`) com testes RED cobrindo: inclusão de consórcio ativo (`totalAmount - fundedAmount`), exclusão de consórcio `COMPLETED`/`CANCELLED`, dívida de parcelamento baseada na soma exata das parcelas `PENDING`/`OVERDUE` (com valores distintos de `monthlyValue * count`), exclusão de `TRANSFER` nos fluxos mensais, e cenário com `netWorth` negativo e menor ou igual a `-currentLiabilities` garantindo `liabilities` maior que zero e `assets - liabilities === netWorth` em todos os meses.
2. Rodar comando RED e confirmar falhas esperadas.
3. Atualizar `src/app/api/networth/route.ts` para consultar `db.consortium.findMany`, incluir `installments` com `status: { in: ['PENDING', 'OVERDUE'] }` em `installmentPlans`, adicionar `type: { in: ['INCOME', 'EXPENSE'] }` em `db.transaction.findMany` e substituir o cálculo por `ratio` pela regra `liabilities = netWorth < -currentLiabilities ? Math.abs(netWorth) : currentLiabilities` e `assets = Math.max(0, netWorth + liabilities)`.
4. Rodar comando GREEN e confirmar aprovação total.
