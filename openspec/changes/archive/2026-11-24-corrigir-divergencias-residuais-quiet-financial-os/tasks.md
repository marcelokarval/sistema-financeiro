## 1. Consultas Assíncronas e Política de Erro HTTP

- [x] 1.1 Corrigir corrida assíncrona de `selectedMonths` em `src/components/finance/balance-projection.tsx` com guarda de requisição + `AbortController`, atualizando `src/components/finance/quiet-analysis-calendar.test.tsx`.
- [x] 1.2 Reter `MonthlyBudgetEditor` e o rascunho em erro HTTP sem `refreshBudgets()` prematuro em `src/components/finance/monthly-budget-tracker.tsx`, atualizando `src/components/finance/quiet-goals-health.test.tsx` e `src/components/finance/quiet-goals-widgets.qa.mjs`.

## 2. Foco Sobrevivente Após DELETE + GET Tardio

- [x] 2.1 Garantir foco sobrevivente após `DELETE` + `GET` tardio em `src/components/finance/accounts-view.tsx` (`account/Excluir/late`) e `src/components/finance/cards-view.tsx` (`card/Excluir/late`), removendo-os de `preexistingQuietDivergences` e atualizando `src/components/finance/quiet-accounts-cards.test.tsx`, `src/components/finance/quiet-keyed-deletion-focus.qa.mjs` e `src/components/finance/quiet-cards-purchases-categories.qa.mjs`.
- [x] 2.2 Garantir foco sobrevivente após `DELETE` + `GET` tardio na lista de `src/components/finance/consortiums-view.tsx` (`list/Excluir/late`) e em `src/components/finance/savings-view.tsx` (`caixinhas/exclusao/late`), removendo-os de `preexistingQuietDivergences` e atualizando `src/components/finance/quiet-consortiums-savings.test.tsx`, `src/components/finance/quiet-consortiums-editor.qa.mjs` e `src/components/finance/quiet-installments-savings-dialogs.qa.mjs`.

## 3. Reconciliação Documental e Bateria Integrada

- [x] 3.1 Reconciliar a Seção 5 de `docs/reference/frontend-componentization-coverage.md` e executar a bateria integrada (`check-frontend-architecture.ts`, `typecheck`, `lint`, `bun --no-env-file test` e runners `.qa.mjs` nas 6 células `360/390/1440 × light/dark`).
