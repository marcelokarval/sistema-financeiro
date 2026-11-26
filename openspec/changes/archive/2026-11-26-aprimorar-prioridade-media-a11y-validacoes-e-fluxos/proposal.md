## Why

A auditoria ao vivo em desktop e celular identificou 12 falhas médias de acessibilidade, validações e usabilidade (#7 a #18): quebra do cabeçalho mobile em `pt`/`es`, botão fechar `"Close"` em inglês nos diálogos, busca sensível a acentos, overlays sem dismiss por clique externo/backdrop e com erro cru `Failed to fetch`, dias vazios clicáveis no calendário, 323 meses zerados no preset `Tudo`, perda de foco ao cancelar `MonthlyBudgetEditor`, rotulagem incorreta de `TRANSFER` e omissão de `notes` em Contas, depósito habilitado em meta concluída, validações client-side incompletas, alvos táteis `< 44×44px` e listas extensas sem filtro ou atalho em Consórcios e Parcelas. Corrigi-las em sequência após o Pacote 1 consolida conformidade a11y, mobile e integridade sem alterar `src/components/ui/**`.

## What Changes

**Cabeçalho mobile, overlays e busca sem acentos (#7, #9, #10)**
- From: CTA `Novo lançamento`/`Nuevo movimiento` quebrando para linha extra em `390px`, `NotificationPanel` e `<dialog>` do `AIAdvisor` sem fechamento por clique externo/backdrop, erro `Failed to fetch` cru no assistente e busca sensível a diacríticos em `GlobalSearch` e `PurchasesView`.
- To: cabeçalho mobile em altura previsível nos 3 idiomas, dismiss externo em `NotificationPanel` e backdrop de `AIAdvisor`, mensagens localizadas para falhas de rede no assistente e normalização NFD compartilhada (`src/lib/search-normalize.ts`).
- Reason: eliminar ruído multilíngue, falhas de ergonomia móvel e falsos vazios na busca.
- Impact: non-breaking; preserva callbacks, atalhos e contratos de navegação.

**Botão fechar localizado, retorno de foco e calendário/preset Tudo (#8, #11, #12, #13)**
- From: 11 diálogos (incluindo `global-search.tsx`) vazando `"Close"` em `sr-only`, dias sem eventos marcados como `aria-disabled="false"`, `monthlyTrend` do preset `Tudo` gerando 323 meses zerados desde 2000 e foco de `MonthlyBudgetEditor` caindo em `document.body`.
- To: `FinanceFormDialogShell` com fallback localizado em `shared.dialogCloseLabel` + `closeLabel` localizado nos diálogos (e `showCloseButton={false}` + `<DialogClose asChild>` em `accounts-view.tsx` e `global-search.tsx`), `activityMap` restrito a dias com atividade, recorte inteligente de meses vazios iniciais em `monthlyTrend` preservando agregados desde 2000, e retorno de foco ao disparador em `MonthlyBudgetTracker`.
- Reason: cumprir acessibilidade em leitores de tela, teclado e legibilidade da série histórica sem editar `src/components/ui/**`.
- Impact: non-breaking; mantém 100% de retrocompatibilidade nas faixas curtas de `/api/dashboard`.

**Contas, Caixinhas, validações client-side, alvos táteis e listas de parcelas (#14, #15, #16, #17, #18)**
- From: transações `TRANSFER` exibidas como despesa e `notes` oculto em `AccountTransactionFields`, item `Depositar` ativo em meta concluída, envios inválidos chegando à API em Cartões/Compras/Categorias/Consórcios/Parcelas, botões `< 44×44px` em 4 visões e listas de 60–100 parcelas sem filtro ou atalho.
- To: exibição neutra de `TRANSFER` e campo `notes` no formulário de transação, ocultação de `Depositar` no menu de meta concluída, validação prévia `.trim()`/numérica com exibição de `data.error`, botões mobile `>= 44×44px` (`min-h-11`/`size-11`) e filtro `Todas`/`Pendentes`/`Pagas` com botão para próxima parcela pendente preservando ordem `1..N` e guardas `A/B`.
- Reason: prevenir erros 400 evitáveis, uniformizar alvos táteis e agilizar pagamento de parcelas.
- Impact: non-breaking nos payloads válidos; requer atualização pontual de testes/QA que enviavam formulários sintéticos incompletos ou esperavam `'Close'`/`closeLabel: undefined`.

## Capabilities

### New Capabilities
- `acessibilidade-validacoes-e-fluxos`: melhorias médias (#7 a #18) cobrindo responsividade do cabeçalho mobile, rótulos de fechamento localizados sem editar shadcn/ui, normalização de busca NFD compartilhada, fechamento e erros de overlays, calendário e série `Tudo`, retorno de foco em orçamento mensal, fluxo `TRANSFER`/`notes` em Contas, guarda de meta concluída em Caixinhas, validações client-side, alvos táteis `>= 44×44px` e navegação de parcelas longas.

### Modified Capabilities
Nenhuma capability existente tem seus requisitos alterados; todas as garantias de `interface-quiet-financial-os`, `integridade-fluxos-financeiros`, `arquitetura-componentes-frontend` e `internacionalizacao-frontend` permanecem intactas.

## Impact

- Código de produção: `src/lib/search-normalize.ts`, `src/app/api/dashboard/route.ts`, `src/components/shared/finance-dialog-shell.tsx`, componentes em `src/components/finance/` (`app-header.tsx`, `notification-panel.tsx`, `app-overlays.tsx`, `ai-advisor.tsx`, `global-search.tsx`, `financial-calendar.tsx`, `financial-calendar-grid.tsx`, `dashboard-query.ts`, `monthly-budget-tracker.tsx`, `monthly-budget-editor.tsx`, `budget-goal-editor.tsx`, `accounts-view.tsx`, `account-transaction-fields.tsx`, `account-transfer-dialog.tsx`, `cards-view.tsx`, `card-editor.tsx`, `purchases-view.tsx`, `categories-view.tsx`, `consortiums-view.tsx`, `consortium-editor.tsx`, `consortium-installment-payment.tsx`, `savings-view.tsx`, `savings-goal-editor.tsx`, `savings-contribution-dialog.tsx`, `investments-view.tsx`, `installments-view.tsx`) e catálogos `src/messages/{pt,es,en}/{shared,shell,goals,accounts,cards,purchases,categories,consortiums,installments,savings}.json`.
- Testes e QA: `src/lib/search-normalize.test.ts`, `src/app/api/dashboard/route.test.ts`, suítes `src/components/finance/*.test.*` e runners `src/components/finance/*.qa.mjs` afetados.
- Exclusões garantidas: `src/components/ui/**`, `openspec/specs/**`, `README.md`, `AGENTS.md`, `db/custom.db`, `.env` e `bun.lock`.
