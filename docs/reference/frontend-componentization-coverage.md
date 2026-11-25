# Cobertura de Componentização Frontend (Task 0023)

Relatório de fechamento da mudança `formalizar-componentizacao-extrema-frontend` no snapshot integrado em `HEAD` (`980110c0555c44b516e00f0961b56e7821abd0f4`), confrontado com o baseline histórico `eb76f7d0f3ced99248ed3c8e5334fcc8792a348f` e com a calibração aprovada do gate AST em `ARCH_BASE_REF` (`25b44535c5068b99044afa03f7ecf318e7a9726f`).

---

## 1. Sumário Quantitativo Verificado no Disco

| Grupo | Contagem em `eb76f7d` | Contagem no `HEAD` atual | Observação |
|---|---:|---:|---|
| Módulos próprios de produção originais (`App Router` + `finance` + `shared`) | 38 | 38 | Todos os 38 caminhos têm disposição e evidência individual na Seção 2 |
| Novos submódulos TSX próprios extraídos e componentes `shared` criados (Ondas 1–5) | 0 | 39 | 33 submódulos em `src/components/finance/` + 6 módulos em `src/components/shared/` (total: **77** TSX próprios analisados pelo gate AST) |
| Biblioteca shadcn (`src/components/ui/*.tsx`) | 48 | 48 | **Excluídos** de dívida JSX; `git diff --exit-code eb76f7d -- src/components/ui` = `0` (nenhuma edição manual) |
| Suítes de teste TSX do snapshot original | 14 | 14 | **Excluídos** de dívida JSX; JSX de fixture não é dívida de produção |
| Exemplo demo (`examples/websocket/frontend.tsx`) | 1 | 1 | **Excluído** da migração de produção e do recorte do gate |
| Total de arquivos `.tsx` no repositório | **101** | **140** | `77` produção + `48` shadcn + `14` testes `.tsx` + `1` demo |
| Testes não-TSX e runners `.qa.mjs` auxiliares (Ondas 1–6) | 12 | 34 testes + 14 `.qa.mjs` | Novos testes e harnesses não contam como dívida de UI |

---

## 2. Disposição Individual dos 38 Módulos Próprios Originais

### 2.1 App Router e Compartilhado (3)

| Caminho original | Linhas (`HEAD`) | Disposição | Submódulos / Padrões adotados | Onda / Task / Commit | Evidência principal |
|---|---:|---|---|---|---|
| `src/app/layout.tsx` | 48 | **Mantido (composição legítima)** | Shell raiz (`html`, `body`, `ThemeProvider`, `Toaster`); 1 aviso não bloqueante (`non-literal-class-interpolation` em fonte) | — | `quiet-tokens.test.ts`, `store.test.ts`, `quiet-componentization.qa.mjs` |
| `src/app/page.tsx` | 263 | **Migrado / Extraído** | `AppHeader` (`app-header.tsx`), `AppOverlays` (`app-overlays.tsx`); preserva 9 destinos, `Ctrl/⌘+K`, `startLaunch`, fallback `Escape` | Onda 3 / `0016` / `70ed596` | `quiet-navigation.test.tsx`, `store.test.ts`, `quiet-search-parity.qa.mjs` |
| `src/components/shared/ui-helpers.tsx` | 37 | **Mantido (precedente legítimo)** | `EmptyState` e `StatusBadge`; complementado por 6 novos módulos em `src/components/shared/` | — | `ui-helpers.test.tsx` |

### 2.2 Operacionais (8)

| Caminho original | Linhas (`HEAD`) | Disposição | Submódulos / Padrões adotados | Onda / Task / Commit | Evidência principal |
|---|---:|---|---|---|---|
| `src/components/finance/investments-view.tsx` | 894 | **Migrado / Extraído** | `InvestmentEditor`, `InvestmentDeleteConfirmation`, `InvestmentEntryEditor`, `FinanceFormDialogShell`, `FinanceConfirmationDialogShell`; exclusão de movimentação preservada no controlador | Onda 1 (`0003` / `87d8c5f`), Onda 2 (`0008` / `5f3afe6`), Onda 4 (`0013` / `e59cad8`) | `quiet-investments-installments.test.tsx`, `quiet-investment-mutations.test.tsx`, `quiet-investments-editor.qa.mjs`, `quiet-finance-dialog-shell.qa.mjs`, `quiet-primary-operations.qa.mjs` |
| `src/components/finance/consortiums-view.tsx` | 994 | **Migrado / Extraído** | `ConsortiumEditor`, `ConsortiumDeleteConfirmation`, `ConsortiumInstallmentPayment`, `FinanceFormDialogShell`, `FinanceConfirmationDialogShell` | Onda 1 (`0004` / `eb55260`), Onda 2 (`0008` / `5f3afe6`), Onda 4 (`0013` / `e59cad8`) | `quiet-consortiums-savings.test.tsx`, `consortium-selection.test.ts`, `assembly.test.ts`, `quiet-consortiums-editor.qa.mjs`, `quiet-finance-dialog-shell.qa.mjs`, `quiet-primary-operations.qa.mjs` |
| `src/components/finance/accounts-view.tsx` | 1067 | **Migrado / Extraído** | `AccountTransactionFields`, `AccountTransferDialog`, `AccountPicker`, `useKeyedMutationLock`, `FinanceRow`, `FinanceMetric`, `FinanceFormDialogShell` | Onda 1 (`0005` / `a55192c`), Onda 2 (`0006` / `558aac5`), Onda 3 (`0009` / `0e457d1`), Onda 4 (`0013` / `e59cad8`) | `quiet-accounts-cards.test.tsx`, `use-keyed-mutation-lock.test.ts`, `quiet-accounts-cards.qa.mjs`, `quiet-account-transaction-focus.qa.mjs`, `quiet-keyed-deletion-focus.qa.mjs`, `quiet-primary-operations.qa.mjs` |
| `src/components/finance/cards-view.tsx` | 429 | **Migrado / Extraído** | `CardEditor`, `useKeyedMutationLock`, `FinanceMetric`, `QueryPanel`, `FinanceFormDialogShell`, `FinanceConfirmationDialogShell` | Onda 2 (`0006` / `558aac5`), Onda 3 (`0009` / `0e457d1`), Onda 5 (`0014` / `3014776`) | `quiet-accounts-cards.test.tsx`, `quiet-accounts-cards.qa.mjs`, `quiet-keyed-deletion-focus.qa.mjs`, `quiet-cards-purchases-categories.qa.mjs` |
| `src/components/finance/purchases-view.tsx` | 407 | **Migrado / Extraído** | `PurchaseEditor`, `PurchaseItemsEditor`, `FinanceFormDialogShell`, `FinanceConfirmationDialogShell`, `FinanceMetric`, `QueryPanel` | Onda 5 (`0014` / `3014776`) | `quiet-purchases-categories.test.tsx`, `route-integrity.test.ts`, `purchase-date.test.ts` (UTC + Bahia), `quiet-cards-purchases-categories.qa.mjs` |
| `src/components/finance/categories-view.tsx` | 455 | **Migrado / Extraído** | `CategoryEditor`, `CategoryIconColorPicker`, `FinanceFormDialogShell`, `FinanceConfirmationDialogShell`, `FinanceMetric`, `QueryPanel` | Onda 5 (`0014` / `3014776`) | `quiet-purchases-categories.test.tsx`, `quiet-cards-purchases-categories.qa.mjs` |
| `src/components/finance/installments-view.tsx` | 647 | **Migrado / Extraído** | `InstallmentPlanEditor`, `InstallmentDeleteConfirmation`, `FinanceFormDialogShell`, `FinanceConfirmationDialogShell`; guarda `confirmedPlanId` / `Excluir plano` focável e `aria-disabled` preservados | Onda 3 (`0015` / `55fa76d`) | `quiet-investments-installments.test.tsx`, `installment-selection.test.ts`, `installments/route.test.ts`, `quiet-installments-savings-dialogs.qa.mjs`, `quiet-componentization.qa.mjs` |
| `src/components/finance/savings-view.tsx` | 547 | **Migrado / Extraído** | `SavingsGoalEditor`, `SavingsContributionDialog`, `FinanceFormDialogShell`, `FinanceProgress` (em `SavingsGoalRow`); `AlertDialogAction` de exclusão preservado sem `preventDefault` | Onda 3 (`0015` / `55fa76d`) | `quiet-consortiums-savings.test.tsx`, `savings/route.test.ts`, `quiet-installments-savings-dialogs.qa.mjs` |

### 2.3 Navegação e Serviços de Interface (6)

| Caminho original | Linhas (`HEAD`) | Disposição | Submódulos / Padrões adotados | Onda / Task / Commit | Evidência principal |
|---|---:|---|---|---|---|
| `src/components/finance/sidebar.tsx` | 127 | **Mantido (composição legítima)** | Grupos/itens nomeados exportando `navigationGroups` e `navigationItems`; tooltips em modo recolhido | — | `quiet-navigation.test.tsx`, `quiet-search-parity.qa.mjs`, `quiet-componentization.qa.mjs` |
| `src/components/finance/mobile-nav.tsx` | 73 | **Mantido (composição legítima)** | Reusa `navigationGroups`/`navigationItems` e `Sheet` (`md:hidden`) | — | `quiet-navigation.test.tsx`, `quiet-search-parity.qa.mjs`, `quiet-componentization.qa.mjs` |
| `src/components/finance/quick-actions.tsx` | 78 | **Mantido (composição legítima)** | Composição enxuta de `DropdownMenu` sem `<div>` supérflua | — | `store.test.ts`, `quiet-navigation.test.tsx` |
| `src/components/finance/global-search.tsx` | 352 | **Migrado / Extraído** | `GlobalSearchResult`, `SearchResults` (`global-search-result.tsx`); `cn()` sanou 2 ocorrências baseline; autoabertura e fallback `Escape` preservados | Onda 3 (`0016` / `70ed596`), pré-`0023` (`980110c`) | `quiet-navigation.test.tsx`, `quiet-search-parity.qa.mjs`, `quiet-componentization.qa.mjs` |
| `src/components/finance/notification-panel.tsx` | 230 | **Migrado** | Adota `QueryPanel` mantendo `<section>` sem `role="dialog"`, retry e persistência `localStorage` | Onda 3 (`0016` / `70ed596`) | `quiet-core-residuals.test.tsx`, `quiet-search-parity.qa.mjs` |
| `src/components/finance/ai-advisor.tsx` | 204 | **Migrado / Extraído** | `AdvisorComposer` (`advisor-composer.tsx`), `cn()` sanou 1 ocorrência baseline; abertura sob demanda preservada | Onda 3 (`0016` / `70ed596`) | `quiet-core-residuals.test.tsx`, `quiet-search-parity.qa.mjs` |

### 2.4 Resumo e Consultas (6)

| Caminho original | Linhas (`HEAD`) | Disposição | Submódulos / Padrões adotados | Onda / Task / Commit | Evidência principal |
|---|---:|---|---|---|---|
| `src/components/finance/dashboard-view.tsx` | 290 | **Migrado + Exceção declarada** | Adota `FinanceRow` em `RecentTransactions` (2 ocorrências sanadas); mantém `Metric` dominante (`text-4xl sm:text-5xl`) com 1 entrada declarada no baseline | Onda 3 (`0009` / `0e457d1`) | `dashboard-view.test.tsx`, `quiet-insights-flow.test.tsx`, `quiet-componentization.qa.mjs` |
| `src/components/finance/balance-projection.tsx` | 480 | **Migrado + Exceção declarada** | Adota `QueryPanel` e `FinanceChartTooltip` (`BalanceProjectionTooltip`); mantém `MonthSelector` com 1 entrada declarada no baseline; divergência de concorrência registrada | Onda 2 (`0010` / `7bbd1e6`), Onda 4 (`0011` / `528e83f`) | `quiet-analysis-calendar.test.tsx`, `quiet-insights-flow.test.tsx` |
| `src/components/finance/cash-flow-forecast.tsx` | 418 | **Migrado** | Adota `QueryPanel` e `FinanceChartTooltip` (`CashFlowForecastTooltip`) preservando séries e cálculos | Onda 2 (`0010` / `7bbd1e6`), Onda 4 (`0011` / `528e83f`) | `quiet-analysis-calendar.test.tsx`, `quiet-insights-flow.test.tsx`, `quiet-componentization.qa.mjs` |
| `src/components/finance/expense-breakdown.tsx` | 251 | **Migrado / Extraído** | `ExpenseCategoryDetails` (`expense-category-details.tsx`), `QueryPanel`, `FinanceProgress`, `FinanceChartTooltip`; preserva guarda de período | Onda 2 (`0010` / `7bbd1e6`), Onda 5 (`0018` / `75fdd94`) | `quiet-analysis-calendar.test.tsx`, `quiet-analytics-calendar.qa.mjs` |
| `src/components/finance/networth-evolution.tsx` | 421 | **Migrado + Exceção declarada** | Adota `FinanceChartTooltip` (`NetworthEvolutionTooltip`); mantém 2 ocorrências (`NetworthEvolutionContent`) declaradas no baseline | Onda 4 (`0011` / `528e83f`) | `quiet-analysis-calendar.test.tsx`, `quiet-insights-flow.test.tsx` |
| `src/components/finance/quick-stats-overview.tsx` | 287 | **Migrado** | Adota `QueryPanel` e `FinanceMetric` preservando `refreshCounter`, zero real, sparklines e `HealthBar` | Onda 4 (`0017` / `5ec4d99`) | `quiet-core-residuals.test.tsx` |

### 2.5 Indicadores e Metas (7)

| Caminho original | Linhas (`HEAD`) | Disposição | Submódulos / Padrões adotados | Onda / Task / Commit | Evidência principal |
|---|---:|---|---|---|---|
| `src/components/finance/achievement-badges.tsx` | 210 | **Migrado** | Adota `QueryPanel`, `FinanceMetric` e `FinanceProgress` preservando critérios de conquista | Onda 4 (`0017` / `5ec4d99`) | `quiet-goals-health.test.tsx` |
| `src/components/finance/budget-goals.tsx` | 394 | **Migrado / Extraído** | `BudgetGoalEditor` (`budget-goal-editor.tsx`), `FinanceFormDialogShell`, `FinanceProgress`; preserva retorno explícito e política pós-DELETE | Onda 2 (`0010` / `7bbd1e6`), Onda 4 (`0017` / `5ec4d99`) | `quiet-goals-health.test.tsx`, `quiet-goals-widgets.qa.mjs` |
| `src/components/finance/financial-health-score.tsx` | 304 | **Migrado** | Adota `FinanceProgress` (`HealthBreakdown`) e `QueryPanel` preservando critérios e faixas | Onda 2 (`0010` / `7bbd1e6`), Onda 4 (`0017` / `5ec4d99`) | `quiet-goals-health.test.tsx` |
| `src/components/finance/goals-dashboard.tsx` | 399 | **Migrado** | Adota `QueryPanel`, `FinanceProgress` e `FinanceMetric` preservando metadados e cálculos | Onda 4 (`0017` / `5ec4d99`) | `quiet-goals-health.test.tsx` |
| `src/components/finance/monthly-budget-tracker.tsx` | 317 | **Migrado / Extraído** | `MonthlyBudgetEditor` (`monthly-budget-editor.tsx`), `FinanceFormDialogShell`, `FinanceProgress`; preserva fechamento/releitura em HTTP não OK | Onda 4 (`0017` / `5ec4d99`) | `quiet-goals-health.test.tsx`, `monthly-budgets/route.test.ts`, `quiet-goals-widgets.qa.mjs` |
| `src/components/finance/savings-challenge.tsx` | 221 | **Migrado** | Adota `QueryPanel` e `FinanceProgress` preservando `acceptChallengeInStorage` e estado local | Onda 4 (`0017` / `5ec4d99`) | `quiet-goals-health.test.tsx` |
| `src/components/finance/smart-insights.tsx` | 244 | **Migrado** | Adota `QueryPanel` preservando abas, contagem e estado vazio/erro | Onda 4 (`0017` / `5ec4d99`) | `quiet-core-residuals.test.tsx`, `insights/route.test.ts` |

### 2.6 Análises e Outros Fluxos (8)

| Caminho original | Linhas (`HEAD`) | Disposição | Submódulos / Padrões adotados | Onda / Task / Commit | Evidência principal |
|---|---:|---|---|---|---|
| `src/components/finance/debt-overview.tsx` | 302 | **Migrado / Extraído** | `DebtSections` (`debt-sections.tsx`), `FinanceProgress`, `FinanceMetric`, `QueryPanel`; 4 ocorrências baseline sanadas | Onda 5 (`0018` / `75fdd94`) | `quiet-analysis-calendar.test.tsx`, `quiet-analytics-calendar.qa.mjs` |
| `src/components/finance/financial-calendar.tsx` | 291 | **Migrado / Extraído** | `FinancialCalendarGrid`, `FinancialCalendarAgenda` (`financial-calendar-grid.tsx`), `FinanceMetric`, `QueryPanel`; 5 ocorrências baseline sanadas | Onda 5 (`0018` / `75fdd94`) | `quiet-analysis-calendar.test.tsx`, `purchase-date.test.ts` (UTC + Bahia), `quiet-analytics-calendar.qa.mjs`, `quiet-componentization.qa.mjs` |
| `src/components/finance/financial-reports.tsx` | 143 | **Migrado / Extraído** | `FinancialReportTabs` (`financial-report-tabs.tsx`), `FinanceChartTooltip`, `FinanceMetric`, `QueryPanel`; 3 ocorrências baseline sanadas | Onda 5 (`0018` / `75fdd94`) | `quiet-analysis-calendar.test.tsx`, `quiet-analytics-calendar.qa.mjs` |
| `src/components/finance/receipt-generator.tsx` | 430 | **Migrado / Extraído** | Modelo puro `receipt-fields.ts` + `ReceiptPreview` (`receipt-preview.tsx`); impressão standalone preservada separada | Onda 1 (`0020` / `36c68b9`) | `quiet-recurring-receipts.test.tsx` |
| `src/components/finance/recurring-transactions.tsx` | 482 | **Migrado / Extraído** | `RecurringTransactionEditor` (`recurring-transaction-editor.tsx`), `RecurringDeleteConfirmation` (`recurring-delete-confirmation.tsx`), `FinanceFormDialogShell`, `FinanceConfirmationDialogShell` | Onda 3 (`0019` / `9410840`) | `quiet-recurring-receipts.test.tsx`, `quiet-recurring-focus.qa.mjs` |
| `src/components/finance/spending-timeline.tsx` | 194 | **Migrado / Extraído** | `SpendingDayDetails` (`spending-day-details.tsx`), `FinanceRow`, `QueryPanel`; 4 ocorrências baseline sanadas (1 em `0009` + 3 em `0018`) | Onda 3 (`0009` / `0e457d1`), Onda 5 (`0018` / `75fdd94`) | `quiet-analysis-calendar.test.tsx`, `quiet-insights-flow.test.tsx`, `quiet-analytics-calendar.qa.mjs` |
| `src/components/finance/transaction-analytics.tsx` | 225 | **Migrado / Extraído** | `TransactionAnalysisTabs` (`transaction-analysis-tabs.tsx`), `FinanceChartTooltip`, `FinanceMetric`, `FinanceProgress`, `QueryPanel`; 2 ocorrências baseline sanadas | Onda 5 (`0018` / `75fdd94`) | `quiet-analysis-calendar.test.tsx`, `quiet-analytics-calendar.qa.mjs` |
| `src/components/finance/upcoming-bills.tsx` | 135 | **Mantido (composição legítima)** | `UpcomingBillsPanel` e `BillList` já coesos; preserva disclosure e máscara de valores `showValues` | Onda 5 (`0018` / `75fdd94`) | `dashboard-view.test.tsx`, `quiet-goals-health.test.tsx`, `quiet-analytics-calendar.qa.mjs` |

---

## 3. Novos Módulos Compartilhados e Submódulos de Produção Criados (39 TSX)

- **Shared (`6` TSX, cada padrão com 2+ consumidores reais comprovados):**
  - `src/components/shared/finance-chart-tooltip.tsx` (`cash-flow-forecast`, `balance-projection`, `networth-evolution`, `financial-report-tabs`, `transaction-analysis-tabs`)
  - `src/components/shared/finance-dialog-shell.tsx` (`FinanceFormDialogShell` e `FinanceConfirmationDialogShell`, adotados por `investment-*`, `consortium-*`, `installment-*`, `savings-*`, `card-editor`, `purchase-editor`, `category-editor`, `budget-goal-editor`, `monthly-budget-editor`, `recurring-*`, `account-transfer-dialog`)
  - `src/components/shared/finance-metric.tsx` (`accounts-view`, `cards-view`, `debt-overview`, `financial-calendar`, `financial-reports`, `quick-stats-overview`, `achievement-badges`, `goals-dashboard`)
  - `src/components/shared/finance-progress.tsx` (`budget-goals`, `financial-health-score`, `savings-view`, `achievement-badges`, `goals-dashboard`, `monthly-budget-tracker`, `savings-challenge`, `debt-sections`, `expense-breakdown`, `transaction-analysis-tabs`)
  - `src/components/shared/finance-row.tsx` (`dashboard-view`, `accounts-view`, `spending-timeline`)
  - `src/components/shared/query-panel.tsx` (`balance-projection`, `cash-flow-forecast`, `expense-breakdown`, `notification-panel`, `cards-view`, `purchases-view`, `categories-view`, `quick-stats-overview`, `achievement-badges`, `financial-health-score`, `goals-dashboard`, `savings-challenge`, `smart-insights`, `debt-overview`, `financial-reports`, `spending-timeline`, `transaction-analytics`)
- **Submódulos de domínio em `src/components/finance/` (`33` TSX):**
  `account-picker.tsx`, `account-transaction-fields.tsx`, `account-transfer-dialog.tsx`, `advisor-composer.tsx`, `app-header.tsx`, `app-overlays.tsx`, `budget-goal-editor.tsx`, `card-editor.tsx`, `category-editor.tsx`, `category-icon-color-picker.tsx`, `consortium-delete-confirmation.tsx`, `consortium-editor.tsx`, `consortium-installment-payment.tsx`, `debt-sections.tsx`, `expense-category-details.tsx`, `financial-calendar-grid.tsx`, `financial-report-tabs.tsx`, `global-search-result.tsx`, `installment-delete-confirmation.tsx`, `installment-plan-editor.tsx`, `investment-delete-confirmation.tsx`, `investment-editor.tsx`, `investment-entry-editor.tsx`, `monthly-budget-editor.tsx`, `purchase-editor.tsx`, `purchase-items-editor.tsx`, `receipt-preview.tsx`, `recurring-delete-confirmation.tsx`, `recurring-transaction-editor.tsx`, `savings-contribution-dialog.tsx`, `savings-goal-editor.tsx`, `spending-day-details.tsx`, `transaction-analysis-tabs.tsx`.
- **Hooks e helpers puros `.ts` auxiliares (`2` módulos):**
  `src/hooks/use-keyed-mutation-lock.ts`, `src/components/finance/receipt-fields.ts`.

---

## 4. Grupos Excluídos da Dívida JSX (63 Entradas do Snapshot + Testes/Runners Adicionados)

### 4.1 Biblioteca shadcn (`48` arquivos em `src/components/ui/`, inalterados)

`accordion.tsx`, `alert-dialog.tsx`, `alert.tsx`, `aspect-ratio.tsx`, `avatar.tsx`, `badge.tsx`, `breadcrumb.tsx`, `button.tsx`, `calendar.tsx`, `card.tsx`, `carousel.tsx`, `chart.tsx`, `checkbox.tsx`, `collapsible.tsx`, `command.tsx`, `context-menu.tsx`, `dialog.tsx`, `drawer.tsx`, `dropdown-menu.tsx`, `form.tsx`, `hover-card.tsx`, `input-otp.tsx`, `input.tsx`, `label.tsx`, `menubar.tsx`, `navigation-menu.tsx`, `pagination.tsx`, `popover.tsx`, `progress.tsx`, `radio-group.tsx`, `resizable.tsx`, `scroll-area.tsx`, `select.tsx`, `separator.tsx`, `sheet.tsx`, `sidebar.tsx`, `skeleton.tsx`, `slider.tsx`, `sonner.tsx`, `switch.tsx`, `table.tsx`, `tabs.tsx`, `textarea.tsx`, `toast.tsx`, `toaster.tsx`, `toggle-group.tsx`, `toggle.tsx`, `tooltip.tsx`.

### 4.2 Testes TSX do Snapshot (`14`) e Demais Testes / Harnesses QA (não contam como dívida JSX)

- **14 testes TSX do snapshot original:** `src/components/finance/dashboard-view.test.tsx`, `quiet-accounts-cards.test.tsx`, `quiet-analysis-calendar.test.tsx`, `quiet-consortiums-savings.test.tsx`, `quiet-core-residuals.test.tsx`, `quiet-goals-health.test.tsx`, `quiet-insights-flow.test.tsx`, `quiet-investment-mutations.test.tsx`, `quiet-investments-installments.test.tsx`, `quiet-navigation.test.tsx`, `quiet-purchases-categories.test.tsx`, `quiet-recurring-receipts.test.tsx`, `quiet-transversal.test.tsx`, `src/components/shared/ui-helpers.test.tsx`.
- **Demais suítes `.test.ts` (`20`) e harnesses `.qa.mjs` (`14` com `quiet-componentization.qa.mjs`):** incluem `.zscripts/check-frontend-architecture.test.ts`, `src/hooks/use-keyed-mutation-lock.test.ts`, `src/lib/{consortium-selection,installment-selection,purchase-date,store}.test.ts`, `src/app/quiet-tokens.test.ts`, `src/components/finance/dashboard-query.test.ts`, suítes de API em `src/app/api/**` (incluindo as 4 opt-in SQLite), `.zscripts/tests/packaging.test.ts`, e os 14 runners `.qa.mjs` em `src/components/finance/`.

### 4.3 Demo (`1` arquivo, fora da aplicação de produção)

- `examples/websocket/frontend.tsx`

---

## 5. Divergências Quiet Pré-Existentes e Reconciliação das Matrizes

Em conformidade com R04, `design.md` (Decisões 5–8) e `verificacao-futura.md`, nenhuma divergência pré-existente foi corrigida silenciosamente, ampliada ou ratificada como conformidade Quiet. Para cada divergência confirmada, a correção futura depende de decisão e mudança separada sob responsabilidade do **responsável de produto**.

### 5.1 Busca Global e Projeção de Saldo

| Superfície | Requisito vigente | Fato da fonte e caso observado | Evidência de não ampliação e status |
|---|---|---|---|
| **Busca Global** (`global-search.tsx`, `page.tsx`, `accounts-view.tsx`, `cards-view.tsx`, `purchases-view.tsx`) | Contrato visual (`design-system.contract.md#L24`) descreve navegar ao destino sem abrir o registro automaticamente. | **Fonte + observado em browser (`0016`, `quiet-search-parity.qa.mjs`):** `page.tsx` encaminha IDs no store e os consumidores abrem o detalhe (`Contas`, `Transações` com `accountId` válido, `Cartões`) ou expandem a linha (`Compras`); `Categorias` apenas navega; ID inexistente não abre outro registro. Ao fechar por `Escape`, retorna à origem conectada não-`body` ou ao botão `Abrir busca global` (`body`, ausente ou desconectada). | **Não ampliada** (paridade 100% vs `eb76f7d`/`55fa76d` em 6 células, marcada com `historicalAutoOpenDeviation: true`). **Não afirma conformidade Quiet** no atalho de autoabertura; correção separada sob **responsável de produto**. |
| **Projeção de Saldo** (`balance-projection.tsx`) | Spec Quiet (`interface-quiet-financial-os/spec.md#L20-L25`) proíbe exibir dados de intervalo anterior como atuais após troca de período. | **Fonte + observado em teste (`0010`, `quiet-analysis-calendar.test.tsx`):** controlador não valida identidade de `selectedMonths` antes de publicar `data/loading`. Na ordem inversa (`A` pendente → troca `B` → `B` resolve → `A` resolve depois com sucesso ou `503`), `A` sobrescreve `B`; em contraste, `expense-breakdown.tsx` preserva `B`. | **Não ampliada** (controlador preservado, `QueryPanel` e `FinanceChartTooltip` não introduzem estado de período). **Não afirma conformidade Quiet**; correção separada sob **responsável de produto**. |

### 5.2 Checkpoints da Matriz Temporal (Fechamento, Exclusão e Releitura)

Distinção explícita entre **observado em navegador**, **fonte lida** e **controle do contrato visual** (`design-system.contract.md#L20-L24`, foco sobrevivente após excluir):

1. **Investimentos — carteira e detalhe (`0003`, `0008`):** *Fonte + observado (`quiet-investments-editor.qa.mjs`, `quiet-finance-dialog-shell.qa.mjs`):* limpa origem antes de fechar após `DELETE` OK e foca título/fallback sobrevivente (`#investments-title` / `#investment-detail-title`) no fechamento e após `GET`; alerta permanece aberto em falha/pendência.
2. **Movimentação de Investimentos (`0013`):** *Fonte + observado (`quiet-primary-operations.qa.mjs`):* edição/criação e exclusão de movimentação (mantida no controlador) preservam ID, rascunho/abertura e fechamento antes da releitura; em `201 OK` o loading desmonta o acionador da lista e `restoreDialogFocus` aplica o fallback conectado `#investment-detail-title`.
3. **Consórcios — exclusão em lista e detalhe (`0004`, `0008`):** *Fonte + observado (`quiet-consortiums-editor.qa.mjs`, `quiet-finance-dialog-shell.qa.mjs`):* `DELETE` por ID capturado e guarda `opening` impedem fechar abertura `B` posterior. Na **lista (`list/Excluir/late`)**, o alerta fecha antes do `GET` removendo a linha; quando o `GET` tardio remove a linha de `A`, o foco é perdido após a remoção — **divergência Quiet pré-existente confirmada** (`preexistingQuietDivergences`, `parityConfirmed: true`, `quietCompliant: false`), não ampliada e sob responsabilidade futura do **responsável de produto**. Baixa de parcela (`0013`) é contrato separado com revalidação pré-POST (`A/B` isolado).
4. **Contas, Transação de Conta e Cartões (`0006`, `0014`):** *Fonte + observado (`quiet-keyed-deletion-focus.qa.mjs`, `quiet-cards-purchases-categories.qa.mjs`):* trava síncrona `useKeyedMutationLock` + guarda `opening` mantidas em `A/B`. Em **Contas** e **Cartões (`account/Excluir/late` e `card/Excluir/late`)**, o fechamento antes do `GET` mira o acionador ainda conectado e o `GET` tardio que remove a linha causa perda de foco — **divergência Quiet pré-existente confirmada** (`preexistingQuietDivergences`, idêntica ao baseline `a55192c`/`5ec4d99`, `quietCompliant: false`, correção separada sob **responsável de produto**). Em **transação de Conta (`tx/Excluir/late`)**, o `GET` coloca a lista em loading desmontando `<ul>` antes do fechamento, levando o foco ao botão sobrevivente `Nova transação`.
5. **Compras e Categorias (`0014`):** *Fonte + observado (`quiet-cards-purchases-categories.qa.mjs`):* aguardam a tentativa de `GET` antes de fechar e usam o botão de criação como fallback sobrevivente na mesma abertura; erro de leitura após `DELETE` OK exibe retry sem fechar outra abertura `B`.
6. **Parcelas e Caixinhas (`0015`):** *Fonte + observado (`quiet-installments-savings-dialogs.qa.mjs`, `quiet-componentization.qa.mjs`):* em **Parcelas**, `prepareDeleteFocus()` prepara foco sobrevivente e `Excluir plano` permanece focável com `aria-disabled="true"` enquanto `selectedPlan` está indisponível. Em **Caixinhas**, `AlertDialogAction` fecha via Radix imediatamente no clique com `DELETE` pendente; em `caixinhas/exclusao/early`, o `GET` rápido já remove `Meta A` e cai no fallback `Nova meta`, enquanto em `caixinhas/exclusao/late` o `GET` tardio que remove `Meta A` após o fechamento perde o foco — **divergência Quiet pré-existente confirmada** (`preexistingQuietDivergences`, `parityConfirmed: true`, `quietCompliant: false`, correção separada sob **responsável de produto**).
7. **Metas e Orçamento Mensal (`0017`):** *Fonte + observado (`quiet-goals-widgets.qa.mjs`):* em **Metas**, o retorno explícito pós-DELETE restaura `Nova Meta` somente quando `activeElement` cai em `body` após remoção, sem roubar foco de outro controle sobrevivente (`#qa-surviving-control`). Em **Orçamento mensal**, o `AlertDialog` fecha após `DELETE` OK e invalida a consulta para loading antes da remoção da linha; nenhuma política inventada no `AlertDialog`.
8. **Recorrências (`0019`):** *Fonte + observado (`quiet-recurring-focus.qa.mjs`):* limpa origem antes de reler e fecha somente a abertura original, usando acionador de criação como fallback; resposta tardia de `A` não fecha `B`.
9. **Contas (campos) e Busca sem exclusão (`0005`, `0016`):** *Fonte + observado (`quiet-account-transaction-focus.qa.mjs`, `quiet-search-parity.qa.mjs`):* `Escape`/`Cancelar` fecham com zero mutações e retorno de foco previsto.

### 5.3 Reconciliação da Matriz de Gravação e Falhas

- **Erro de releitura vs falha de mutação:** Em todos os domínios (`Compras`, `Categorias`, `Contas`, `Cartões`, `Investimentos`, `Consórcios`, `Parcelas`, `Caixinhas`, `Recorrências`), mutação `2xx` seguida de `GET` malsucedido é tratada como erro/retry de leitura — nunca como falha ou repetição automática da mutação.
- **Metas vs Orçamento mensal (`0017`):** Não foram uniformizados: em **Metas** (`budget-goals.tsx`), HTTP não OK com JSON válido retorna antes de fechar mantendo rascunho; em **Orçamento mensal** (`monthly-budget-tracker.tsx`), HTTP não OK com JSON válido anuncia erro, fecha o diálogo e dispara 1 `GET` de releitura, enquanto rejeição de `fetch` ou corpo não JSON cai no `catch` antes do fechamento preservando o rascunho.
- **Investimentos (`0003`, `0008`, `0013`):** Preserva rascunho em erro HTTP/transporte e fronteira de consulta do histórico; fechamento da edição de investimento permanece condicionado ao booleano de diálogo como no baseline.
- **Consórcios (`0004`, `0008`, `0013`):** Edição só fecha em OK da abertura vigente; baixa de parcela revalida seleção/parcela antes do `POST`, impede gravação de confirmação obsoleta em `A→B` e executa `GET` de reconciliação no `finally` (sem repetir `POST`).
- **Contas, Cartões, Compras, Categorias, Parcelas, Caixinhas, Recorrências:** Todos preservam rascunho em HTTP não OK e falha de transporte, bloqueio concorrente (`useKeyedMutationLock` ou refs de envio), e separação entre `AlertDialogAction` de exclusão em Caixinhas (sem `preventDefault`) e os editores de Caixinhas (sem fechamento automático em erro).

---

## 6. Reconciliação do Gate AST, Avisos e Diff Protegido

### 6.1 Baseline Reconciliado (`ARCH_BASE_REF` = `25b44535c5068b99044afa03f7ecf318e7a9726f`)

- **Baseline inicial (`25b44535`):** `38` entradas `raw-conditional-class-name` (multiplicidade `1` cada).
- **Entradas removidas na reconciliação de `0023` (`32` `orphan`s sanados via `cn()` / componentes compartilhados):**
  - Onda 3 / `0009` (`4`): `accounts-view.tsx` (`AccountsView`, `4993985c`), `dashboard-view.tsx` (`RecentTransactions`, `740a5e15` e `c36ccb3b`), `spending-timeline.tsx` (`SpendingTimelineContent`, `f29f9a23`).
  - Onda 3 / `0015` (`1`): `savings-view.tsx` (`SavingsView`, `d82d0a78`).
  - Onda 3 / `0016` (`3`): `ai-advisor.tsx` (`MessageBubble`, `28f95077`), `global-search.tsx` (`SearchResults`, `0bbf9a69` e `0ffbae5e`).
  - Onda 5 / `0014` (`7`): `cards-view.tsx` (`CardUsage`, `0ea5adb7`), `categories-view.tsx` (`CategoriesView`, `28344b31`, `afa39682`, `dd7efc81`, `f581a642`), `purchases-view.tsx` (`PurchasesView`, `44cbbeac`, `6e2c82be`).
  - Onda 5 / `0018` (`17`): `debt-overview.tsx` (`DebtOverviewContent`, `487a2898`, `50f129fe`, `9a807a72`, `b7150196`), `financial-calendar.tsx` (`FinancialCalendarContent`, `3833bcbd`, `5b90694b`, `cf2b9bc4`, `cfacdfb9`, `d0daecc4`), `financial-reports.tsx` (`FinancialReportsContent`, `3508837e`, `72324499`, `d7c39547`), `spending-timeline.tsx` (`SpendingTimelineContent`, `9960c560`, `ab58163d`, `bb844835`), `transaction-analytics.tsx` (`TransactionAnalyticsContent`, `2cf13d38`, `bf985185`).
- **Entradas mantidas no baseline (`6`, todas ativas e dentro do teto aprovado):**
  - `src/components/finance/balance-projection.tsx` (`MonthSelector`, `87145e91...`) — realce de período selecionado.
  - `src/components/finance/dashboard-view.tsx` (`Metric`, `2e770f03...`) — hierarquia dominante do saldo principal.
  - `src/components/finance/installments-view.tsx` (`InstallmentMetrics`, `dc801ca5...`) — tipografia da primeira métrica de parcelas.
  - `src/components/finance/investments-view.tsx` (`InvestmentMetrics`, `dc801ca5...`) — tipografia da primeira métrica de investimentos.
  - `src/components/finance/networth-evolution.tsx` (`NetworthEvolutionContent`, `6435d42a...` e `7926f6ea...`) — seletor de intervalo e tom de variação patrimonial.
- **Resultado do gate AST reconciliado:** `77 arquivos; 6 ocorrências em 6 identidades; 33 avisos; 0 erros.` (`exit 0`, `0 unbaselined`, `0 ceiling-exceeded`, `0 orphan`).

### 6.2 Classificação dos 33 Avisos Não Bloqueantes (`HEAD`)

Os `33` avisos restantes são **sinais de revisão estrutural** (não violações bloqueantes nem regressions, redução de `134` na Onda 2 para `33` no fechamento):

| Regra | Quantidade | Arquivos / Símbolos | Classificação técnica |
|---|---:|---|---|
| `non-literal-class-interpolation` | 20 | `layout.tsx` (`RootLayout`, 1), `accounts-view.tsx` (`AccountsView`, 1), `balance-projection.tsx` (`BalanceProjectionContent`, 5), `dashboard-view.tsx` (`DashboardView` 1, `Metric` 1, `Panel` 1, `Flow` 2, `DashboardDetails` 3), `installments-view.tsx` (`InstallmentEntries`, 1), `receipt-generator.tsx` (`ReceiptWorkspace`, 3) | Composição legítima de constantes tipográficas (`moneyClass`, `muted`, `disclosure`, `accountPanel`, `config.className`) e variáveis de fonte (`geistSans.variable`, `geistMono.variable`) em templates estáticos sem ternária crua. |
| `dense-jsx-callback` | 8 | `accounts-view.tsx` (13 tags), `balance-projection.tsx` (21 tags), `cash-flow-forecast.tsx` (14 tags), `dashboard-view.tsx` (`DashboardDetails`, 12 tags), `installments-view.tsx` (`InstallmentPortfolio`, 15 tags), `investments-view.tsx` (`InvestmentPortfolio` 18, `InvestmentEntries` 13), `recurring-transactions.tsx` (`RecurringPanel`, 18 tags) | Listas/cartões semânticos (`dl`/`ul`/`article`) com conteúdo de domínio coeso onde fragmentação adicional seria extração cosmética. |
| `large-tsx-file` | 5 | `accounts-view.tsx` (1067 linhas), `consortiums-view.tsx` (994 linhas), `investments-view.tsx` (894 linhas), `installments-view.tsx` (647 linhas), `savings-view.tsx` (547 linhas) | Controladores operacionais com estado de abertura, seleção, locks e listas após extração dos editores/confirmações/diálogos para submódulos. |

### 6.3 Verificação de Caminho Protegido (`eb76f7d` → `HEAD`)

Confirmado por `git diff --exit-code eb76f7d -- src/components/ui src/app/api src/app/globals.css prisma package.json bun.lock openspec/config.yaml openspec/specs` (`exit 0`): **nenhuma alteração** em primitivas shadcn, rotas API, `globals.css`, schema/armazenamento Prisma, manifestos/lockfile ou especificações vigentes do OpenSpec.
