# Implementation plan

Bridge task contract: 1

**Goal:** Corrigir concorrência assíncrona em 4 widgets de análise/linha do tempo, completar a Busca Global segundo a Alternativa A com `AbortController` e exibição neutra de `TRANSFER`, e sanar falhas silenciosas/parse inseguro de erro HTTP em orçamento, transferência, dívidas, relatórios e dividendos de investimentos.
**Architecture:** Replicar o padrão puro testável `request*`/`current*` de `balance-projection.tsx` (`AbortController` + identidade de objeto de requisição + limpeza imediata em troca/erro), preservar assinaturas `*Content` e hashes AST do baseline em `NetworthEvolutionContent`, estender `GlobalSearch`/`GlobalSearchResult` para 8 domínios alinhados a `src/app/page.tsx`, e proteger leitura/erro HTTP nos fluxos restantes seguindo TDD estrito (RED -> GREEN -> REFACTOR).
**Skill mapping and observed invocation:** `brainstorming` (`/home/marcelo-karval/.agents/skills/brainstorming/SKILL.md`), `writing-plans` (`/home/marcelo-karval/.agents/skills/writing-plans/SKILL.md`), `/home/marcelo-karval/.agents/AGENTS.md` e `/home/marcelo-karval/.local/share/openspec/schemas/superpowers-bridge/README.md` lidos integralmente via `read_file` antes da escrita dos artefatos de planejamento.

## Task 1.1: Implementar AbortController, identidade de requisição e limpeza de dado antigo em networth-evolution, financial-calendar, transaction-analytics e spending-timeline com testes TDD em quiet-analysis-calendar.test.tsx

- Depends on: none
- Needs: none
- Outcome: Os quatro widgets (`NetworthEvolution`, `FinancialCalendar`, `TransactionAnalytics` e `SpendingTimeline`) descartam respostas e erros de requisições anteriores via `AbortController` + identidade de requisição, limpam dados antigos quando `!res.ok` ou `catch` ocorre e possuem testes TDD cobrindo o ciclo completo sem quebrar os checks AST de callbacks e baseline.
- Owner/resolver: Executor designado na Onda 1 Frontend
- Inputs: `src/components/finance/balance-projection.tsx`, `src/components/finance/expense-breakdown.tsx`, `src/components/finance/networth-evolution.tsx`, `src/components/finance/financial-calendar.tsx`, `src/components/finance/transaction-analytics.tsx`, `src/components/finance/spending-timeline.tsx`, `src/components/finance/quiet-analysis-calendar.test.tsx`
- Produces: concurrency-widgets-hardened
- Write paths: src/components/finance/networth-evolution.tsx, src/components/finance/financial-calendar.tsx, src/components/finance/transaction-analytics.tsx, src/components/finance/spending-timeline.tsx, src/components/finance/quiet-analysis-calendar.test.tsx
- Exclusions: db/custom.db, .zscripts/frontend-architecture-baseline.json
- Shared resources: none
- Acceptance: `bun --no-env-file test src/components/finance/quiet-analysis-calendar.test.tsx` passa 100% e `bun --no-env-file .zscripts/check-frontend-architecture.ts --baseline-ref 25b44535c5068b99044afa03f7ecf318e7a9726f` termina com 0 erros mantendo intactas as duas ocorrências baseline de `NetworthEvolutionContent`.
- Stop: Divergência de assinatura em `*Content` que quebre `hasControl` em `quiet-analysis-calendar.test.tsx` ou alteração acidental nas expressões baseline de `NetworthEvolutionContent`.
- Resume: Assinaturas `fetchData` preservadas em `*Content`, testes RED observados antes da edição de produção e testes GREEN observados após a implementação.

### Passos TDD da Task 1.1

1. **RED em `src/components/finance/quiet-analysis-calendar.test.tsx`:**
   - Adicionar testes para `networth-evolution` (`requestNetworthEvolution` / `currentNetworthEvolution`), `financial-calendar` (`requestFinancialCalendar` / `currentFinancialCalendar`), `transaction-analytics` (`requestTransactionAnalytics` / `currentTransactionAnalytics`) e `spending-timeline` (`requestSpendingTimeline` / `currentSpendingTimeline`) cobrindo:
     - Descarte de `200 OK`, `503` e rejeição de transporte após `AbortSignal` abortado ou identidade de requisição vencida (inclusive ao retornar ao mesmo período/filtro).
     - Limpeza de dados anteriores quando consulta subsequente falha (`503` ou erro de rede) e recuperação no retry com `200 OK`.
   - Executar `bun --no-env-file test src/components/finance/quiet-analysis-calendar.test.tsx` e registrar a falha esperada (funções `request*` / `current*` ainda ausentes).

2. **GREEN em `networth-evolution.tsx`, `financial-calendar.tsx`, `transaction-analytics.tsx` e `spending-timeline.tsx`:**
   - Exportar em cada arquivo os tipos e funções puras `request*(request, signal, publish, fetcher = fetch)` e `current*(request, settled)` seguindo `balance-projection.tsx:161-192`.
   - Atualizar cada componente raiz para armazenar `request` (objeto imutável por seleção/retry) e `settled`, executando `useEffect` com `new AbortController()` e `return () => controller.abort()`.
   - Preservar `fetchData` nos props e handlers de `NetworthEvolutionContent` (`onClick={() => fetchData(selectedMonths)}`), `FinancialCalendarContent` (`onClick={() => fetchData(activeDays)}`) e `TransactionAnalyticsContent` (`onClick={fetchData}`), mantendo intactas as duas expressões baseline de `NetworthEvolutionContent` e o limite abaixo de 500 linhas por arquivo.
   - Em `SpendingTimeline`, passar `data = query.status === 'ready' ? query.data : []`, `loading = query.status === 'loading'` e `error = query.status === 'error'` para `SpendingTimelineContent`.

3. **VERIFICAÇÃO da Task 1.1:**
   - Rodar `bun --no-env-file test src/components/finance/quiet-analysis-calendar.test.tsx` e `bun --no-env-file .zscripts/check-frontend-architecture.ts --baseline-ref 25b44535c5068b99044afa03f7ecf318e7a9726f`.
   - **RED observado:** `bun --no-env-file test src/components/finance/quiet-analysis-calendar.test.tsx` falhou com `19 pass, 2 fail` (`TypeError: networth.currentNetworthEvolution is not a function` e `Expected: true / Received: undefined` para `signals[0]?.aborted`).
   - **GREEN observado:** Implementadas as funções puras `request*`/`current*` com `AbortController`, identidade de requisição e limpeza de estado em falha nos quatro widgets (preservando os callbacks `fetchData` e as duas expressões baseline de `NetworthEvolutionContent`), resultando em `21 pass, 0 fail, 237 expect() calls` em `quiet-analysis-calendar.test.tsx` e `0 erros` no gate AST (`77 arquivos; 6 ocorrências em 6 identidades; 34 avisos; 0 erros`).

## Task 1.2: Estender GlobalSearch e GlobalSearchResult para os oito domínios da Alternativa A, TRANSFER neutro e AbortController com testes TDD em quiet-navigation.test.tsx e ajuste de fixture em quiet-search-parity.qa.mjs

- Depends on: none
- Needs: none
- Outcome: `GlobalSearch` e `GlobalSearchResult` indexam e navegam pelos 8 domínios da Alternativa A (`transactions`, `purchases`, `accounts`, `cards`, `categories`, `investments`, `installments`, `consortiums`), abortam `fetchAll()` anterior com `AbortController`, exibem `type === 'TRANSFER'` de forma neutra sem ícone vermelho de despesa e mantêm a fixture de `quiet-search-parity.qa.mjs` compatível.
- Owner/resolver: Executor designado na Onda 1 Frontend
- Inputs: `src/components/finance/global-search.tsx`, `src/components/finance/global-search-result.tsx`, `src/app/page.tsx`, `src/components/finance/sidebar.tsx`, `src/components/finance/quiet-navigation.test.tsx`, `src/components/finance/quiet-search-parity.qa.mjs`, `openspec/specs/interface-quiet-financial-os/spec.md`
- Produces: global-search-alt-a-complete
- Write paths: src/components/finance/global-search.tsx, src/components/finance/global-search-result.tsx, src/components/finance/quiet-navigation.test.tsx, src/components/finance/quiet-search-parity.qa.mjs
- Exclusions: db/custom.db, .zscripts/frontend-architecture-baseline.json
- Shared resources: none
- Acceptance: `bun --no-env-file test src/components/finance/quiet-navigation.test.tsx src/components/finance/quiet-transversal.test.tsx src/components/finance/quiet-core-residuals.test.tsx` passa 100% e `global-search.tsx` permanece abaixo de 500 linhas sem violações AST.
- Stop: Divergência de contrato de payload em `/api/investments`, `/api/installments` ou `/api/consortiums`, ou falha no teste `quiet-transversal.test.tsx` para `'investment'` singular.
- Resume: Contrato dos 8 endpoints verificado, testes RED observados antes da edição e suíte completa da Busca passando após implementação.

### Passos TDD da Task 1.2

1. **RED em `src/components/finance/quiet-navigation.test.tsx`:**
   - Adicionar testes cobrindo:
     - `searchDestination` e `searchGroupMeta` mapeando todos os 8 domínios (`transactions`, `purchases`, `accounts`, `cards`, `categories`, `investments`, `installments`, `consortiums`) e mantendo `investment` singular e `__proto__` como `undefined`.
     - `applySearchSelection` usando diretamente `searchDestination` para `investments`, `installments` e `consortiums` (removendo dependência do wrapper temporário `resolveExtended`).
     - Função testável de coleta/indexação de `GlobalSearch` consultando os 8 endpoints, descartando resultados/erros quando `AbortSignal` é abortado e construindo resultados para `investments`, `installments` e `consortiums`.
     - Renderização de transação `type === 'TRANSFER'` com `ArrowLeftRight` e `text-muted-foreground`, sem `text-(--ds-accent-danger)` e sem prefixo `'-'`.
   - Executar `bun --no-env-file test src/components/finance/quiet-navigation.test.tsx` e confirmar a falha esperada (RED).

2. **GREEN em `global-search-result.tsx`, `global-search.tsx` e `quiet-search-parity.qa.mjs`:**
   - Em `global-search-result.tsx`: ampliar `SearchResultType` com `'investments' | 'installments' | 'consortiums'` e adicionar em `searchGroupMeta` `investments` (`TrendingUp`), `installments` (`CalendarClock`) e `consortiums` (`Building2`).
   - Em `global-search.tsx`:
     - Ampliar `searchDestinations` para os 8 domínios.
     - Extrair `requestGlobalSearch(signal, publish, fetcher = fetch)` e usar `AbortController` em `GlobalSearch` (abortando coleta anterior em `fetchAll` manual e no cleanup de `useEffect`).
     - Indexar `/api/investments`, `/api/installments` e `/api/consortiums`, atualizar `order` de `groupedResults` e `DialogDescription`.
     - Tratar `t.type === 'TRANSFER'` com ícone `ArrowLeftRight`, `iconTone: 'text-muted-foreground'` e texto secundário neutro sem sinal `'-'`.
     - Manter `global-search.tsx` enxuto (abaixo de 500 linhas) e sem ternários em template literals no `className`.
   - Em `quiet-search-parity.qa.mjs`: adicionar retorno `Response.json([])` para `/api/investments`, `/api/installments` e `/api/consortiums` na fixture `window.fetch` de `installFixture` preservando `historicalAutoOpenDeviation` ausente e os 17 cenários existentes.

3. **VERIFICAÇÃO da Task 1.2:**
   - Rodar `bun --no-env-file test src/components/finance/quiet-navigation.test.tsx src/components/finance/quiet-transversal.test.tsx src/components/finance/quiet-core-residuals.test.tsx`.
   - **RED observado:** `bun --no-env-file test src/components/finance/quiet-navigation.test.tsx` falhou com `11 pass, 3 fail` (`applySearchSelection` para `investments` manteve `currentView: "dashboard"`, `searchDestination('investments')` retornou `undefined` e `requestGlobalSearch` estava indefinida).
   - **GREEN observado:** Estendidos `GlobalSearchResult` (`searchGroupMeta` e `SearchResultType`) e `GlobalSearch` (`searchDestinations`, `requestGlobalSearch` com `AbortController` e os 8 endpoints, `buildSearchResults` com `investments`/`installments`/`consortiums` e `TRANSFER` neutro com `ArrowLeftRight` e `text-muted-foreground`), além da fixture `[]` para os três endpoints em `quiet-search-parity.qa.mjs`, passando `36 pass, 0 fail, 228 expect() calls` nos 3 arquivos (`global-search.tsx` com 443 linhas).

## Task 1.3: Proteger parse de erro não-JSON em handleDelete de monthly-budget-tracker.tsx e saveTransfer de accounts-view.tsx com testes TDD em quiet-goals-health.test.tsx e quiet-accounts-cards.test.tsx

- Depends on: none
- Needs: none
- Outcome: `handleDelete` em `MonthlyBudgetTracker` e `saveTransfer` em `AccountsView` usam `.json().catch(() => ({}))` em respostas `!res.ok`, anunciando a mensagem de erro da operação sem cair no fallback genérico de rede e preservando os diálogos abertos.
- Owner/resolver: Executor designado na Onda 1 Frontend
- Inputs: `src/components/finance/monthly-budget-tracker.tsx`, `src/components/finance/accounts-view.tsx`, `src/components/finance/quiet-goals-health.test.tsx`, `src/components/finance/quiet-accounts-cards.test.tsx`
- Produces: mutation-error-parse-hardened
- Write paths: src/components/finance/monthly-budget-tracker.tsx, src/components/finance/quiet-goals-health.test.tsx, src/components/finance/accounts-view.tsx, src/components/finance/quiet-accounts-cards.test.tsx
- Exclusions: db/custom.db, .zscripts/frontend-architecture-baseline.json
- Shared resources: none
- Acceptance: `bun --no-env-file test src/components/finance/quiet-goals-health.test.tsx src/components/finance/quiet-accounts-cards.test.tsx` passa 100% com os novos testes cobrindo corpo `503` não-JSON em `handleDelete` e `saveTransfer`.
- Stop: Alteração de contrato de erro JSON existente ou regressão no foco pós-exclusão em `accounts-view.tsx`.
- Resume: Testes RED observados para corpo não-JSON em `handleDelete` e `saveTransfer`, seguidos de GREEN após `.json().catch(() => ({}))`.

### Passos TDD da Task 1.3

1. **RED em `quiet-goals-health.test.tsx` e `quiet-accounts-cards.test.tsx`:**
   - Em `quiet-goals-health.test.tsx`: adicionar teste exercitando `MonthlyBudgetTracker` ao confirmar exclusão (`DELETE /api/monthly-budgets?id=...`) com resposta `new Response('não JSON', { status: 503 })`, exigindo `toast.error('Erro ao excluir')` (não `'Erro de conexão'`), diálogo de confirmação mantido aberto e ausência de `GET /api/monthly-budgets`.
   - Em `quiet-accounts-cards.test.tsx`: adicionar teste exercitando `AccountsView` ao enviar transferência (`POST /api/transfer`) com resposta `new Response('não JSON', { status: 503 })`, exigindo `toast.error('Erro na transferência')` (não `'Erro ao realizar transferência'`), `AccountTransferDialog` mantido aberto e ausência de releitura.
   - Executar `bun --no-env-file test src/components/finance/quiet-goals-health.test.tsx src/components/finance/quiet-accounts-cards.test.tsx` e confirmar as falhas esperadas (RED).

2. **GREEN em `monthly-budget-tracker.tsx` e `accounts-view.tsx`:**
   - Em `src/components/finance/monthly-budget-tracker.tsx:201`: alterar `const data = await res.json();` para `const data = await res.json().catch(() => ({}));` e usar `data?.error || 'Erro ao excluir'`.
   - Em `src/components/finance/accounts-view.tsx:619`: alterar `const data = await res.json();` para `const data = await res.json().catch(() => ({}));` e usar `data?.error || 'Erro na transferência'`.

3. **VERIFICAÇÃO da Task 1.3:**
   - Rodar `bun --no-env-file test src/components/finance/quiet-goals-health.test.tsx src/components/finance/quiet-accounts-cards.test.tsx`.
   - **RED observado:** `bun --no-env-file test src/components/finance/quiet-goals-health.test.tsx src/components/finance/quiet-accounts-cards.test.tsx` falhou com `55 pass, 2 fail` (`handleDelete` em `MonthlyBudgetTracker` exibiu `'Erro de conexão'` em vez de `'Erro ao excluir'`; `saveTransfer` em `AccountsView` exibiu `'erro: Erro ao realizar transferência'` em vez de `'erro: Erro na transferência'`).
   - **GREEN observado:** Adicionado `.catch(() => ({}))` com `data?.error` em `handleDelete` (`monthly-budget-tracker.tsx`) e `saveTransfer` (`accounts-view.tsx`), resultando em `57 pass, 0 fail, 473 expect() calls` nos dois arquivos de teste.

## Task 1.4: Limpar dados obsoletos e sinalizar erro em retry ou falha subsequente de debt-overview.tsx e financial-reports.tsx com testes TDD em quiet-analysis-calendar.test.tsx

- Depends on: 1.1
- Needs: 1.1 => concurrency-widgets-hardened
- Outcome: `DebtOverview` e `FinancialReportsWidget` limpam `data` obsoleto e exibem o estado explícito de erro com `Tentar novamente` quando uma consulta inicial ou subsequente falha (`!res.ok` ou rejeição de transporte), usando `AbortController` e preservando `onClick={fetchData}` e `onClick={fetchReports}`.
- Owner/resolver: Executor designado na Onda 1 Frontend
- Inputs: `src/components/finance/debt-overview.tsx`, `src/components/finance/financial-reports.tsx`, `src/components/finance/quiet-analysis-calendar.test.tsx`
- Produces: debt-reports-retry-hardened
- Write paths: src/components/finance/debt-overview.tsx, src/components/finance/financial-reports.tsx, src/components/finance/quiet-analysis-calendar.test.tsx
- Exclusions: db/custom.db, .zscripts/frontend-architecture-baseline.json
- Shared resources: none
- Acceptance: `bun --no-env-file test src/components/finance/quiet-analysis-calendar.test.tsx` passa 100% cobrindo falha subsequente e recuperação em `DebtOverview` e `FinancialReportsWidget`.
- Stop: Quebra da inspeção AST de `hasControl` para `Atualizar dívidas` (`{fetchData}`) ou `Atualizar relatórios` (`{fetchReports}`).
- Resume: Testes RED comprovando retenção indevida de `data` antigo antes da mudança, seguidos de GREEN após a atualização dos dois componentes.

### Passos TDD da Task 1.4

1. **RED em `src/components/finance/quiet-analysis-calendar.test.tsx`:**
   - Adicionar testes para `DebtOverview` (`requestDebtOverview` / `currentDebtOverview` e ciclo via harness) e `FinancialReportsWidget` (`requestFinancialReports` / `currentFinancialReports` e ciclo via harness) verificando que, após uma carga inicial `200 OK`, uma segunda atualização que retorna `503` ou rejeita por rede limpa `data` anterior (`data === null`), exibe `role="alert"` com `Tentar novamente` e recupera quando a tentativa seguinte retorna `200 OK`.
   - Executar `bun --no-env-file test src/components/finance/quiet-analysis-calendar.test.tsx` e confirmar a falha esperada (RED).

2. **GREEN em `debt-overview.tsx` e `financial-reports.tsx`:**
   - Em `debt-overview.tsx`: adotar padrão `requestDebtOverview` / `currentDebtOverview` com `AbortController` e novo objeto de requisição em cada atualização/retry (`fetchData = useCallback(() => setRequest({}), [])`), limpando `data` anterior durante carregamento/erro e preservando `onClick={fetchData}` em `DebtOverviewContent`.
   - Em `financial-reports.tsx`: adotar padrão `requestFinancialReports` / `currentFinancialReports` com `AbortController` e novo objeto de requisição em cada atualização/retry (`fetchReports = useCallback(() => setRequest({}), [])`), limpando `data` anterior durante carregamento/erro e preservando `onClick={fetchReports}` em `FinancialReportsContent`.

3. **VERIFICAÇÃO da Task 1.4:**
   - Rodar `bun --no-env-file test src/components/finance/quiet-analysis-calendar.test.tsx`.
   - **RED observado:** `bun --no-env-file test src/components/finance/quiet-analysis-calendar.test.tsx` falhou com `21 pass, 1 fail` (`failedTree.props.data` manteve `{ totalDebt: 1500, ... }` após falha `503` no refresh de `DebtOverview`).
   - **GREEN observado:** Adotado `requestDebtOverview`/`currentDebtOverview` em `debt-overview.tsx` e `requestFinancialReports`/`currentFinancialReports` em `financial-reports.tsx` com `AbortController` e novo objeto de requisição por chamada (preservando `onClick={fetchData}` e `onClick={fetchReports}`), resultando em `22 pass, 0 fail, 253 expect() calls`.

## Task 1.5: Tratar erro HTTP e falha de rede em fetchDividends de investments-view.tsx evitando zero silencioso com testes TDD em quiet-investments-installments.test.tsx

- Depends on: none
- Needs: none
- Outcome: `fetchDividends` em `InvestmentsView` trata `!res.ok` e `catch` limpando `dividendEntries`, ativando `dividendLoadError`, evitando exibir `R$ 0,00` enganoso na métrica `Dividendos recebidos` e exibindo alerta acessível (`role="alert"`) com ação `Tentar novamente`.
- Owner/resolver: Executor designado na Onda 1 Frontend
- Inputs: `src/components/finance/investments-view.tsx`, `src/components/finance/quiet-investments-installments.test.tsx`
- Produces: investments-dividends-error-hardened
- Write paths: src/components/finance/investments-view.tsx, src/components/finance/quiet-investments-installments.test.tsx
- Exclusions: db/custom.db, .zscripts/frontend-architecture-baseline.json
- Shared resources: none
- Acceptance: `bun --no-env-file test src/components/finance/quiet-investments-installments.test.tsx src/components/finance/quiet-core-residuals.test.tsx` passa 100% e `InvestmentMetrics` preserva intacta a ocorrência baseline em `.zscripts/frontend-architecture-baseline.json`.
- Stop: Alteração na expressão baseline de `InvestmentMetrics` ou regressão quando `/api/investments/transactions` retorna `200 OK` com `[]` (zero real deve continuar exibindo `R$ 0,00`).
- Resume: Teste RED comprovando exibição indevida de `R$ 0,00` quando `/api/investments/transactions` retorna `503`, seguido de GREEN preservando zero real quando `200 OK` retornar `[]`.

### Passos TDD da Task 1.5

1. **RED em `src/components/finance/quiet-investments-installments.test.tsx`:**
   - Adicionar teste exercitando `InvestmentsView` com `GET /api/investments` retornando `200 OK` e `GET /api/investments/transactions` retornando `503` (e outro caso rejeitando por rede), exigindo:
     - Métrica `Dividendos recebidos` não exibe `R$ 0,00` como valor real (exibe `'—'` e nota de indisponibilidade).
     - Alerta `role="alert"` visível informando falha ao carregar dividendos com botão `Tentar novamente`.
     - Ao clicar em `Tentar novamente` com `GET /api/investments/transactions` retornando `200 OK` (`DIVIDENDO` de `R$ 50,00`), o alerta desaparece e a métrica exibe o valor atualizado; quando retornar `[]` com `200 OK`, exibe `R$ 0,00`.
   - Executar `bun --no-env-file test src/components/finance/quiet-investments-installments.test.tsx` e confirmar a falha esperada (RED).

2. **GREEN em `src/components/finance/investments-view.tsx`:**
   - Adicionar estado `dividendLoadError` em `InvestmentsView`.
   - Em `fetchDividends`: iniciar com `setDividendLoadError(false)`; se `!res.ok` ou no `catch`, chamar `setDividendEntries([])` e `setDividendLoadError(true)`.
   - Passar `dividendLoadError` (e retry quando `!loadError`) para `InvestmentPortfolio`, renderizando `'—'` na métrica `Dividendos recebidos` quando `dividendLoadError` for verdadeiro e exibindo alerta `role="alert"` com `Tentar novamente`.

3. **VERIFICAÇÃO da Task 1.5:**
   - Rodar `bun --no-env-file test src/components/finance/quiet-investments-installments.test.tsx src/components/finance/quiet-core-residuals.test.tsx`.
   - **RED observado:** `bun --no-env-file test src/components/finance/quiet-investments-installments.test.tsx` falhou com `28 pass, 1 fail` (ausência de `role="alert"` e exibição silenciosa de `R$ 0,00` quando `/api/investments/transactions` retornava `503`).
   - **GREEN observado:** Adicionado estado `dividendLoadError` em `investments-view.tsx` com limpeza de `dividendEntries` e alerta acessível `role="alert"` + `Tentar novamente` quando `fetchDividends` falha, exibindo `'—'` na métrica sem alterar `InvestmentMetrics` nem o zero real em `200 OK` com `[]`, resultando em `37 pass, 0 fail, 243 expect() calls` nos dois arquivos.

## Task 1.6: Executar verificação integrada de typecheck, lint, gate AST frontend, suíte de testes e build de produção

- Depends on: 1.1, 1.2, 1.3, 1.4, 1.5
- Needs: 1.1 => concurrency-widgets-hardened
- Needs: 1.2 => global-search-alt-a-complete
- Needs: 1.3 => mutation-error-parse-hardened
- Needs: 1.4 => debt-reports-retry-hardened
- Needs: 1.5 => investments-dividends-error-hardened
- Outcome: O candidato integrado após todas as implementações passa nos checks estáticos, arquiteturais, testes automatizados e build Next.js sem alterar `db/custom.db` nem `.zscripts/frontend-architecture-baseline.json`.
- Owner/resolver: Verificador independente / Coordenador
- Inputs: Candidato integrado após Tasks 1.1 a 1.5
- Produces: wave1-frontend-verified
- Write paths: none
- Exclusions: db/custom.db, .zscripts/frontend-architecture-baseline.json
- Shared resources: none
- Acceptance: `bun --no-env-file run typecheck`, `bun --no-env-file run lint`, `bun --no-env-file .zscripts/check-frontend-architecture.ts --baseline-ref 25b44535c5068b99044afa03f7ecf318e7a9726f`, `bun --no-env-file test` e `bun --no-env-file run build` finalizam com código 0 e 0 falhas.
- Stop: Qualquer erro de TypeScript, ESLint, baseline AST, teste falhando ou erro de build.
- Resume: Todas as falhas diagnosticadas devolvidas à task proprietária correspondente e revalidadas no mesmo candidato.

### Passos de verificação da Task 1.6

1. Executar em sequência encadeada:
   - `bun --no-env-file run typecheck`
   - `bun --no-env-file run lint`
   - `bun --no-env-file .zscripts/check-frontend-architecture.ts --baseline-ref 25b44535c5068b99044afa03f7ecf318e7a9726f`
   - `bun --no-env-file test`
   - `bun --no-env-file run build`
2. Confirmar que `db/custom.db` e `.zscripts/frontend-architecture-baseline.json` permanecem intactos no diff do candidato.
   - **Verificação integrada observada (registro `#256`):**
     - `bun --no-env-file run check`: `exit 0` (`tsc --noEmit` `exit 0`; `eslint .` `18 problems (0 errors, 18 warnings)`; `arch:check` `77 arquivos; 6 ocorrências em 6 identidades; 34 avisos; 0 erros`; `bun test` `419 pass, 41 skip, 0 fail, 2903 expect() calls` em 39 arquivos; `test:scripts` `66 pass, 0 fail, 387 expect() calls`).
     - `bun --no-env-file run test:sqlite`: `exit 0` (`54 pass, 0 skip, 0 fail, 318 expect() calls` em 6 execuções `bwrap`).
     - `DATABASE_URL="file:/tmp/ci-build-inert.db" bun --no-env-file run build`: `exit 0` (`41/41` páginas estáticas; `.next` e `/tmp/ci-build-inert.db*` removidos).
     - Runners `.qa.mjs` em `systemd-run --user` + `bwrap`: `quiet-componentization.qa.mjs` (`54` cenários, `0` omissões), `quiet-search-parity.qa.mjs` (`102` cenários pareados, `0` omissões, paridade verdadeira nas 6 células), `quiet-analytics-calendar.qa.mjs` (`48` cenários pareados, `0` omissões) e `quiet-goals-widgets.qa.mjs` (`60` cenários pareados, `0` omissões), todos com `exit 0` e `db/custom.db` e `.zscripts/frontend-architecture-baseline.json` preservados intactos.
     - **Verificação integrada pós-Onda 2 (`#274`) e revisão independente:** `bun --no-env-file run check` (`exit 0`; `test` `533` aprovados em 57 arquivos; `test:scripts` `66` aprovados; `arch:check` `0` erros), `test:sqlite` (`54` aprovados em 6 execuções `bwrap`), `build` isolado (`41/41` páginas estáticas) e `src/components/finance/**` inalterado desde `#256`. Revisão independente `verifier-apply-6`: Fase 1 PASS (`#260`) e Fase 2 solicitada sobre o candidato final.
