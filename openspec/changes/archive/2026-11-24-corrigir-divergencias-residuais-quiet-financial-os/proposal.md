## Why

O relatório `docs/reference/frontend-componentization-coverage.md` (Seção 5) documenta quatro divergências residuais contra o contrato `Quiet Financial OS` herdadas do snapshot original: corrida assíncrona em `balance-projection.tsx`, fechamento prematuro com releitura em erro HTTP de `monthly-budget-tracker.tsx`, e perda de foco pós-exclusão com `GET` tardio em Contas, Cartões, Consórcios (lista) e Caixinhas. Corrigi-las agora elimina as últimas exceções de conformidade Quiet fora da Busca Global.

## What Changes

**Projeção de saldo (`balance-projection.tsx`)**
- From: `fetchData(months)` publica `data` e `loading` sem guarda de requisição ou `AbortController`, permitindo que resposta/erro tardio do período `A` sobrescreva o período vigente `B`.
- To: Identidade explícita de requisição `{ months }` + `AbortController` descartando respostas e falhas de períodos anteriores ao selecionado (espelhando `expense-breakdown.tsx`).
- Reason: Garantir o requisito de que troca de período nunca exibe dados ou erros de intervalo anterior.
- Impact: Non-breaking; altera apenas `balance-projection.tsx` e `quiet-analysis-calendar.test.tsx`.

**Orçamento mensal (`monthly-budget-tracker.tsx`)**
- From: `handleSubmit` fecha `MonthlyBudgetEditor` e dispara `refreshBudgets()` mesmo após resposta HTTP não OK com JSON válido.
- To: Retorno antecipado em `!res.ok` com parse seguro de erro, mantendo o diálogo aberto e o rascunho preservado sem disparar `refreshBudgets()` (alinhado a `budget-goals.tsx`).
- Reason: Evitar perda de edição do usuário e chamadas `GET` desnecessárias em falhas de validação/servidor.
- Impact: Non-breaking; atualiza `monthly-budget-tracker.tsx`, `quiet-goals-health.test.tsx` e `quiet-goals-widgets.qa.mjs`.

**Foco sobrevivente após `DELETE` + `GET` tardio (`accounts-view.tsx`, `cards-view.tsx`, `consortiums-view.tsx`, `savings-view.tsx`)**
- From: Em `account/Excluir/late`, `card/Excluir/late`, `list/Excluir/late` e `caixinhas/exclusao/late`, o foco retorna ao acionador da linha prestes a ser removida e cai em `document.body` quando o `GET` tardio desmonta o registro.
- To: Contas, Cartões e Consórcios limpam a referência à linha após `DELETE` `2xx` antes de fechar o alerta (focando o controle sobrevivente, como `investments-view.tsx`); Caixinhas restaura `#savings-create` via efeito pós-remoção quando `activeElement` cai em `body`/desconectado após o `GET` (como `budget-goals.tsx`).
- Reason: Cumprir a regra de foco sobrevivente após exclusão em `design-system.contract.md` e zerar `preexistingQuietDivergences`.
- Impact: Non-breaking; atualiza os 4 controladores, suas suítes de teste e os runners `.qa.mjs`, além da Seção 5 de `docs/reference/frontend-componentization-coverage.md`.

## Capabilities

### New Capabilities
<!-- Nenhuma nova capacidade introduzida. -->

### Modified Capabilities
- `interface-quiet-financial-os`: Refinar cenários de guarda temporal de período em projeção de saldos, política de erro HTTP sem fechamento/releitura prematura no orçamento mensal, foco sobrevivente após `DELETE` + `GET` tardio em Contas, Cartões, Consórcios e Caixinhas, e reconciliação da Seção 5 da cobertura frontend.

## Impact

- Código de produção: `src/components/finance/balance-projection.tsx`, `src/components/finance/monthly-budget-tracker.tsx`, `src/components/finance/accounts-view.tsx`, `src/components/finance/cards-view.tsx`, `src/components/finance/consortiums-view.tsx`, `src/components/finance/savings-view.tsx`.
- Testes e runners QA: `src/components/finance/quiet-analysis-calendar.test.tsx`, `src/components/finance/quiet-goals-health.test.tsx`, `src/components/finance/quiet-goals-widgets.qa.mjs`, `src/components/finance/quiet-accounts-cards.test.tsx`, `src/components/finance/quiet-keyed-deletion-focus.qa.mjs`, `src/components/finance/quiet-cards-purchases-categories.qa.mjs`, `src/components/finance/quiet-consortiums-savings.test.tsx`, `src/components/finance/quiet-consortiums-editor.qa.mjs`, `src/components/finance/quiet-installments-savings-dialogs.qa.mjs`.
- Documentação: `docs/reference/frontend-componentization-coverage.md` (Seção 5).
- Nenhuma alteração em rotas API, schema Prisma, `src/components/ui/`, `package.json`, `bun.lock` ou `global-search.tsx`.
