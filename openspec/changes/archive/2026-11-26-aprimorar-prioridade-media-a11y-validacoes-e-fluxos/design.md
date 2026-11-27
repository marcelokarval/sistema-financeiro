# Design — Melhorias de Prioridade Média em Acessibilidade, Validações e Fluxos (#7 a #18)

## Context

O FinanceApp já conta com o tema Quiet Financial OS, a internacionalização completa em `pt`, `es` e `en` (`next-intl` + `useSafeTranslations`/`useSafeLocale`), o gate AST `.zscripts/check-frontend-architecture.ts` (6 ocorrências aprovadas em `.zscripts/frontend-architecture-baseline.json`) e a política de nunca editar manualmente arquivos em `src/components/ui/**` (`AGENTS.md`).

Esta mudança (**Pacote 2**) executa **sequencialmente após a integração do Pacote 1** (`corrigir-prioridade-alta-resumo-i18n-e-cartoes`) e resolve os **12 itens de prioridade média (#7 a #18)** levantados na auditoria ao vivo em `http://127.0.0.1:3000`.

## Goals / Non-Goals

**Goals:**
- Garantir cabeçalho mobile sem quebra extra do CTA em `pt`, `es` e `en` (`390x844`) e alvos táteis `>= 44×44px` em `accounts-view.tsx`, `cards-view.tsx`, `investments-view.tsx` e `installments-view.tsx` (#7, #17).
- Eliminar `"Close"` em inglês de todos os 11 diálogos afetados (incluindo `global-search.tsx`) usando apenas `FinanceFormDialogShell` e `<DialogClose>` dentro de `src/components/shared/` e `src/components/finance/`, sem alterar `src/components/ui/dialog.tsx` (#8).
- Normalizar buscas em `GlobalSearch` e `PurchasesView` via helper único NFD sem diacríticos (`src/lib/search-normalize.ts`) (#9).
- Suportar fechamento por clique externo/backdrop em `NotificationPanel` e `<dialog>` de `AIAdvisor`, com erro amigável localizado no assistente (#10).
- Corrigir interatividade de dias vazios no `FinancialCalendar` (#11), série `monthlyTrend` do preset `Tudo` preservando totais desde 2000 (#12) e retorno de foco ao cancelar `MonthlyBudgetEditor` (#13).
- Corrigir exibição/edição de `TRANSFER` e expor `notes` em Contas (#14), ocultar `Depositar` no menu de meta concluída em Caixinhas (#15), endurecer validações client-side com propagação de `data.error` (#16) e adicionar filtro/salto em listas longas de Consórcios e Parcelas preservando ordem `1..N` e guardas `A/B` (#18).

**Non-Goals:**
- Não editar `src/components/ui/**`, `db/custom.db`, `.env` nem `bun.lock`.
- Não alterar itens de Prioridade Alta (#1–#6, Pacote 1) nem itens de Prioridade Baixa (#19–#22, Pacote 3).
- Não adicionar novas rotas de API (como resgate em Caixinhas) nem ampliar campos editáveis além do contrato atual.

## Approaches

### Abordagem A — Alterar diretamente `src/components/ui/dialog.tsx` e `button.tsx` para `"Close"` e `44px`
- **Prós:** mudança centralizada em dois arquivos.
- **Contras:** viola diretamente a regra canônica de `AGENTS.md` ("NÃO edite componentes em `src/components/ui/` manualmente — use a CLI do shadcn") e acopla componentes primitivos gerados à camada de tradução. **Descartada.**

### Abordagem B — Solução na camada de domínio (`src/components/shared/` + `src/components/finance/`) e helper puro compartilhado (Escolhida)
- **Descrição:** manter `src/components/ui/**` intocado; prover fallback localizado em `FinanceFormDialogShell` (`src/components/shared/finance-dialog-shell.tsx`) + `closeLabel` explícito nos diálogos e `showCloseButton={false}` + `<DialogClose>` nos diálogos diretos; centralizar normalização NFD em `src/lib/search-normalize.ts`; aplicar `min-h-11`/`size-11` nos botões de ação das 4 visões; e isolar toda a alteração em 3 frentes paralelas disjuntas (`1.1`, `1.2`, `1.3`) convergindo em `2.1` para atualização de suítes unitárias e `.qa.mjs`.
- **Prós:** 100% aderente a `AGENTS.md`, `Declared conflicts: none` entre `1.1`, `1.2` e `1.3`, preserva baseline AST e mantém contratos existentes.
- **Contras:** requer atualização explícita de 6 testes unitários que antes asseriam `closeLabel === undefined`, do passo `'Close'` em `quiet-primary-operations.qa.mjs` e de fixtures sintéticas de Cartões/Compras que enviavam campos vazios/zerados.

## Decisions

### 1. Cabeçalho mobile (#7) e Overlays (#10)
- **`src/components/finance/app-header.tsx`:** manter `aria-label={t('newEntry')}` no botão `newEntryButtonRef`, ajustando a apresentação móvel (`<640px`) para evitar quebra de linha do CTA em `pt`/`es` (ex.: ocultar o texto longo em `<sm` via `<span className="hidden sm:inline">{t('newEntry')}</span>` com `size-9 px-0 sm:w-auto sm:px-2.5` ou usar rótulo compacto móvel em `shell.json`, mantendo altura da barra de cabeçalho `<= 76px` em `390x844` nos 3 idiomas sem overflow nem clipping).
- **Clique fora em `NotificationPanel` (`app-header.tsx`):** anexar `ref` ao contêiner que envolve o botão de sino e `<NotificationPanel>` em `app-header.tsx`, registrando listener `pointerdown` no `document` apenas quando `showNotifications === true` para chamar `onCloseNotifications()` quando o alvo não estiver contido no wrapper (mantendo `Escape` e clique no gatilho funcionais).
- **Backdrop em `AIAdvisor` (`app-overlays.tsx`):** remover padding direto de `<dialog>` (passando `p-0` no `<dialog>` e `p-4` em uma `<div>` filha) e tratar `onClick={(event) => { if (event.target === event.currentTarget) onCloseAdvisor(); }}` no `<dialog>`.
- **Erro de rede localizado (`ai-advisor.tsx`):** no `catch` de `sendMessage`, distinguir erros semânticos retornados pelo servidor (já localizados pela rota `/api/advisor`) de falhas de transporte/fetch (`TypeError` ou rejeição de rede genérica), usando `t('errors.connectFailed')` nesses casos para evitar `"Erro: Failed to fetch"`.

### 2. Localização do botão fechar nos 11 diálogos (#8)
- **`src/components/shared/finance-dialog-shell.tsx` + `src/messages/{pt,es,en}/shared.json`:** adicionar `dialogCloseLabel` em `shared.json` (`"Fechar formulário"`, `"Cerrar formulario"`, `"Close form"`) e usá-lo como fallback em `FinanceFormDialogShell` (`const resolvedCloseLabel = closeLabel ?? tShared('dialogCloseLabel')`), mantendo `showCloseButton={false}` e renderizando `<DialogClose asChild><Button aria-label={resolvedCloseLabel} ... /></DialogClose>`.
- **8 diálogos com `FinanceFormDialogShell`:** passar `closeLabel` localizado explicitamente em `monthly-budget-editor.tsx` (`goals`), `budget-goal-editor.tsx` (`goals`), `account-transfer-dialog.tsx` (`accounts`), `card-editor.tsx` (`cards`), `consortium-editor.tsx` (`consortiums`), `consortium-installment-payment.tsx` (`consortiums`), `savings-goal-editor.tsx` (`savings`) e `savings-contribution-dialog.tsx` (`savings`).
- **3 componentes com `<Dialog>` direto (`consortiums-view.tsx`, `accounts-view.tsx`, `global-search.tsx`):** em `consortiums-view.tsx` (criação de consórcio), migrar para `FinanceFormDialogShell` (ou `showCloseButton={false}` + `<DialogClose>`); em `accounts-view.tsx` (Nova Conta, Nova Transação, Editar Transação), usar `showCloseButton={false}` + `<DialogClose asChild>` com `aria-label` localizado dentro de `<DialogHeader className="relative pr-10 text-left">`; em `global-search.tsx:394`, passar `showCloseButton={false}` no `<DialogContent>` e renderizar `<DialogClose asChild>` posicionado no cabeçalho usando `shared.dialogCloseLabel` (`useSafeTranslations('shared')`), mantendo `1.1` e `1.2` estritamente disjuntas e sem tocar em `src/components/ui/dialog.tsx`.

### 3. Normalização NFD compartilhada na busca (#9)
- **`src/lib/search-normalize.ts`:** exportar `normalizeSearchText(value: string): string` (`value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()`).
- **`src/components/finance/global-search.tsx` e `purchases-view.tsx`:** substituir comparações cruas `.toLowerCase()` sobre `query` / `search` e textos pesquisáveis por `normalizeSearchText(...)`.

### 4. Calendário (#11), preset `Tudo` (#12) e foco do `MonthlyBudgetEditor` (#13)
- **Calendário (`financial-calendar.tsx`, `financial-calendar-grid.tsx`):** em `activityMap`, gravar entrada apenas quando `day.income > 0 || day.expense > 0 || day.events.length > 0`. Dias sem atividade mantêm `activity === undefined`, `aria-disabled="true"` e não disparam seleção ao clicar.
- **Preset `Tudo` (`dashboard-query.ts`, `src/app/api/dashboard/route.ts`):** `quickRange('all')` permanece com início em `2000-01-01` para preservar os agregados completos desde 2000 (`monthIncome`, `monthExpense`, `recentTransactions`, `recentPurchases`, `expenseByCategory`). Em `GET /api/dashboard`, ao construir `monthlyTrend`, quando `trendMonths > 12`, determinar o primeiro mês com movimento entre `monthlyTransactions` e `monthlyPurchases` e iniciar `monthlyTrend` nesse mês até `rangeEnd` (ou emitir apenas o mês de `rangeEnd` caso não haja movimentos no intervalo), mantendo intacta a série completa para intervalos de até 12 meses (inclusive `route.test.ts` com banco vazio).
- **Foco em `MonthlyBudgetTracker` (`monthly-budget-tracker.tsx`, `monthly-budget-editor.tsx`):** manter `defaultCloseAutoFocus = () => {}` em `MonthlyBudgetEditor` quando `onCloseAutoFocus` for omitido (preservando o teste unitário isolado `quiet-goals-health.test.tsx:545-547`), e em `MonthlyBudgetTracker` capturar o botão disparador (`Novo limite` ou gatilho `MoreHorizontal` da linha) em `dialogOriginRef` e passar `onCloseAutoFocus` restaurando o foco com `event.preventDefault()`.

### 5. `TRANSFER` e `notes` em Contas (#14) e guarda em Caixinhas (#15)
- **Contas (`accounts-view.tsx`, `account-transaction-fields.tsx`, `accounts.json`):**
  - Em `accounts-view.tsx`, quando `tx.type === 'TRANSFER'`, passar `tone="neutral"` para `FinanceRow` e exibir `t('detail.transferType')` nos metadados em vez de `detail.expenseType`.
  - Em `AccountTransactionFields`, adicionar o campo `notes` (`id={`${prefix}-notes`}`) vinculado a `value.notes` e `onChange('notes', ...)` e preservar `TRANSFER` como opção/estado quando `value.type === 'TRANSFER'` para que editar descrição/data/notas de uma transferência não a converta em despesa.
- **Caixinhas (`savings-view.tsx`):** condicionar `<DropdownMenuItem>` de `Depositar` em `SavingsGoalRow` a `!isComplete`, alinhando o menu `Mais ações` ao botão direto já oculto quando a meta foi atingida.

### 6. Validações client-side (#16), alvos táteis (#17) e paginação/filtro de parcelas (#18)
- **Validações client-side e leitura de `data.error` (#16):**
  - `cards-view.tsx`: validar `form.name.trim()`, `lastFourDigits.trim()` com `/^\d{4}$/`, e para `type === 'CREDIT'` validar `creditLimit` finito `>= 0` e `closingDay`/`dueDay` inteiros em `1..31` (sem `|| 1`/`|| 10`), enviando `name: form.name.trim()` e lendo `data?.error` quando `!res.ok`.
  - `purchases-view.tsx`: validar `form.merchant.trim()`, ao menos 1 item com nome não vazio, quantidades inteiras `>= 1`, preços `>= 0` e `formTotal > 0`, enviando `merchant: form.merchant.trim()` e lendo `data?.error` quando `!res.ok`.
  - `categories-view.tsx`: validar `form.name.trim()` e enviar `name: form.name.trim()`.
  - `consortiums-view.tsx` (`createConsortium`) e `installments-view.tsx` (`createPlan`): validar `description.trim()`, valores monetários positivos finitos e `installmentCount` inteiro `>= 1` (plus `interestRate >= 0` em Parcelas), emitindo `toast.error` localizado sem disparar `fetch` inválido nem manter lock preso.
- **Alvos táteis `>= 44×44px` no mobile (#17):** em `accounts-view.tsx`, `cards-view.tsx`, `investments-view.tsx` e `installments-view.tsx`, padronizar `min-h-11` em botões de voltar/ação/filtro/pagamento e `size-11` em botões de ícone (alinhado a `purchases-view.tsx` e `categories-view.tsx`), mantendo `InstallmentMetrics` e `InvestmentMetrics` idênticos ao baseline AST e mantendo `cards-view.tsx <= 500` linhas.
- **Filtro e salto para próxima pendente (#18):** em `consortiums-view.tsx` (`ConsortiumDetail`) e `installments-view.tsx` (`InstallmentEntries`), adicionar filtro local (`ALL` / `PENDING` / `PAID`, em que `PENDING` agrupa `PENDING` e `OVERDUE`) e botão `Ir para próxima pendente` que alterna o filtro caso necessário e rola/foca o controle da primeira parcela em aberto, mantendo ordem numérica `1..N` e todas as guardas `A/B`.

## Risks / Trade-offs

- **Risco:** testes unitários e `.qa.mjs` existentes quebrarem com `closeLabel` localizado (#8) ou validações estritas (#16).
  - **Mitigação:** mapear explicitamente na Task `2.1` a atualização de `quiet-consortiums-savings.test.tsx:670,770,825,1023`, `quiet-goals-health.test.tsx:503,542`, `quiet-accounts-cards.test.tsx:753`, `quiet-purchases-categories.test.tsx:524`, `quiet-accounts-cards.qa.mjs:174` e `quiet-primary-operations.qa.mjs:370,543`.
- **Risco:** `cards-view.tsx` (`453` linhas), `purchases-view.tsx` (`414` linhas) ou `categories-view.tsx` (`458` linhas) ultrapassarem 500 linhas e gerarem novo aviso `large-tsx-file`.
  - **Mitigação:** manter validações em helpers enxutos e verificar contagem de linhas + `arch:check` em cada task.
- **Risco:** conflito de merge entre Pacote 1 e Pacote 2 em `cards-view.tsx`, `app-header.tsx` ou `dashboard-query.ts`.
  - **Mitigação:** execução estritamente sequencial do Pacote 2 após o Pacote 1 estar integrado na `main`, com novo `preflight` antes da aplicação se necessário.

## Migration Plan

1. **Pré-condição:** confirmar Pacote 1 (`corrigir-prioridade-alta-resumo-i18n-e-cartoes`) integrado na branch alvo antes de iniciar a implementação das Tasks `1.1`–`1.3`.
2. **Onda 1 (paralela, `Declared conflicts: none`):** executar Tasks `1.1`, `1.2` e `1.3` em conjuntos disjuntos de arquivos e namespaces JSON.
3. **Onda 2 (integração e validação):** executar Task `2.1` para novos testes unitários, reconciliação dos testes/QA existentes, paridade JSON `pt`/`es`/`en`, `bun --no-env-file run check`, `test:sqlite`, `build`, sandbox `.qa.mjs` e inspeção Playwright ao vivo.
4. **Rollback:** cada frente (`1.1`–`1.3`) opera em subconjuntos isolados de componentes e pode ser revertida independentemente sem afetar schema SQLite nem `src/components/ui/**`.
