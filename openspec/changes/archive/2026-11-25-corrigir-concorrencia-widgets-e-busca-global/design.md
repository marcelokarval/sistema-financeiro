# Design — Onda 1 Frontend: Concorrência em Widgets, Busca Global e Resiliência HTTP

## Contexto e restrições arquiteturais

- **Padrão de design system:** Preservar tokens `--ds-*` e utilitários semânticos Tailwind (`bg-card`, `text-muted-foreground`, `text-destructive`), sem hex/oklch hardcoded e sem `framer-motion`.
- **Gate AST (`.zscripts/check-frontend-architecture.ts`):**
  - `.zscripts/frontend-architecture-baseline.json` NÃO será alterado.
  - Em `src/components/finance/networth-evolution.tsx`, `NetworthEvolutionContent` possui duas ocorrências de `raw-conditional-class-name` registradas no baseline (`selectedMonths === m` e `current.changePercent >= 0`). Essas expressões devem permanecer intactas para manter os hashes AST idênticos.
  - Nenhum arquivo novo ou editado pode introduzir `raw-conditional-class-name` fora do baseline ou ultrapassar 500 linhas quando ainda estiver abaixo desse limite (`global-search.tsx`, `financial-calendar.tsx`, `transaction-analytics.tsx`, `spending-timeline.tsx`, `networth-evolution.tsx`, `debt-overview.tsx`, `financial-reports.tsx`, `monthly-budget-tracker.tsx`).
- **Contratos de teste existentes (`src/components/finance/quiet-analysis-calendar.test.tsx:45-53`):**
  - Os botões de atualização iconográficos em `*Content` devem manter seus callbacks exatos esperados pela inspeção AST:
    - `financial-calendar.tsx`: `onClick={() => fetchData(activeDays)}`
    - `networth-evolution.tsx`: `onClick={() => fetchData(selectedMonths)}`
    - `debt-overview.tsx`: `onClick={fetchData}`
    - `transaction-analytics.tsx`: `onClick={fetchData}`
    - `financial-reports.tsx`: `onClick={fetchReports}`
- **Exclusões estritas:** `db/custom.db` e `.zscripts/frontend-architecture-baseline.json` não devem ser tocados.

## Decisões de desenho por frente

### Frente 1 — Concorrência assíncrona nos 4 widgets

Adotar o padrão já validado em `src/components/finance/balance-projection.tsx:161-206` e `src/components/finance/expense-breakdown.tsx:23-62`:

1. Cada widget passa a modelar a consulta como um objeto de requisição imutável (`request`) criado a cada seleção de período/filtro ou retry/atualização:
   - `networth-evolution.tsx`: `NetworthRequest = { months: number }`, `requestNetworthEvolution(request, signal, publish, fetcher = fetch)` e `currentNetworthEvolution(request, settled)`.
   - `financial-calendar.tsx`: `FinancialCalendarRequest = { days: number }`, `requestFinancialCalendar(request, signal, publish, fetcher = fetch)` e `currentFinancialCalendar(request, settled)`.
   - `transaction-analytics.tsx`: `TransactionAnalyticsRequest = { typeFilter: 'ALL' | 'INCOME' | 'EXPENSE' }`, `requestTransactionAnalytics(request, signal, publish, fetcher = fetch)` e `currentTransactionAnalytics(request, settled)`.
   - `spending-timeline.tsx`: `SpendingTimelineRequest = { days: number }`, `requestSpendingTimeline(request, signal, publish, fetcher = fetch)` e `currentSpendingTimeline(request, settled)`.
2. O `useEffect([request])` cria `const controller = new AbortController()`, dispara a função `request*` passando `controller.signal` e `setSettled`, e retorna `() => controller.abort()`.
3. Como `request` é um novo objeto literal a cada troca de parâmetro ou retry (`setRequest({ ... })`), `current*(request, settled)` avalia `settled?.request === request` e retorna `{ status: 'loading' }` imediatamente, limpando qualquer `data` antigo enquanto a nova requisição está em voo ou se ela resultar em `{ status: 'error' }`.
4. Nos componentes internos de apresentação (`*Content`), manter os props de atualização (`fetchData`) mapeados para uma função estável que chama `setRequest({ ... })`, preservando 100% da compatibilidade com `quiet-analysis-calendar.test.tsx`.

### Frente 2 — Busca Global em conformidade total com a Alternativa A

1. **`src/components/finance/global-search-result.tsx`:**
   - Estender `SearchResultType` para `'transactions' | 'purchases' | 'accounts' | 'cards' | 'categories' | 'investments' | 'installments' | 'consortiums'`.
   - Estender `searchGroupMeta` com os ícones do `sidebar.tsx`:
     - `investments`: `{ title: 'Investimentos', icon: TrendingUp }`
     - `installments`: `{ title: 'Parcelas', icon: CalendarClock }`
     - `consortiums`: `{ title: 'Consórcios', icon: Building2 }`
2. **`src/components/finance/global-search.tsx`:**
   - Estender `searchDestinations` com `investments: 'investments'`, `installments: 'installments'` e `consortiums: 'consortiums'`, alinhando com `applySearchSelection` em `src/app/page.tsx:61-63`.
   - Extrair função testável `fetchGlobalSearchData(signal, fetcher = fetch)` (ou `requestGlobalSearch`) e gerenciar um `AbortController` ativo em `GlobalSearch` (via `useRef` + cleanup no `useEffect` de abertura/fechamento e abortando requisição anterior ao acionar `fetchAll()` manualmente no retry). Descartar atualizações de `rawData`, `error` e `loading` quando `signal.aborted` for verdadeiro.
   - Indexar os 8 endpoints em paralelo: `/api/transactions`, `/api/purchases`, `/api/accounts`, `/api/cards`, `/api/categories`, `/api/investments`, `/api/installments`, `/api/consortiums`.
   - Montar resultados para `investments` (`name`, `ticker`, `type`, `brokerage`, exibindo `currentBalance`), `installments` (`description`, `type`, `status`, `card?.name`, `category?.name`, exibindo `monthlyValue` e progresso `paidInstallments/installmentCount`) e `consortiums` (`description`, `group`, `quota`, `administrator`, `status`, exibindo `totalAmount`).
   - Atualizar `DialogDescription` para listar os oito domínios.
   - Para `transactions` com `t.type === 'TRANSFER'`, usar estilo e sinal neutros: ícone `ArrowLeftRight`, `iconTone: 'text-muted-foreground'` e texto secundário sem prefixo negativo/vermelho (`${currencyFmt(t.amount)} · Transferência · ${txDate}`), mantendo `+` verde para `INCOME` e `-` vermelho para `EXPENSE`.
3. **`src/components/finance/quiet-search-parity.qa.mjs`:**
   - Adicionar resposta vazia `[]` na fixture `window.fetch` para `/api/investments`, `/api/installments` e `/api/consortiums` dentro de `installFixture` para que a execução pareada com `GlobalSearch` não gere falsos erros de `Fetch fora da fixture`.

### Frente 3 — Resiliência HTTP pontual nos fluxos restantes

1. **`src/components/finance/monthly-budget-tracker.tsx:201` (`handleDelete`):**
   - Substituir `const data = await res.json();` por `const data = await res.json().catch(() => ({}));` e usar `toast.error(data?.error || 'Erro ao excluir')` para evitar que respostas `!res.ok` sem JSON caiam no `catch` exibindo `'Erro de conexão'`.
2. **`src/components/finance/accounts-view.tsx:619` (`saveTransfer`):**
   - Substituir `const data = await res.json();` por `const data = await res.json().catch(() => ({}));` e usar `toast.error(data?.error || 'Erro na transferência')`, evitando mascarar erros HTTP não-JSON como erro de rede.
3. **`src/components/finance/debt-overview.tsx:134-151` e `src/components/finance/financial-reports.tsx:47-61`:**
   - Adotar o mesmo controle de requisição com `AbortController` + objeto de requisição (`{}` por invocação) ou limpeza explícita (`setData(null)` / estado `error`) no início/falha de `fetchData` e `fetchReports`, garantindo que uma falha (`!res.ok` ou `catch`) após carregamento prévio bem-sucedido limpe os dados obsoletos e exiba o estado de erro com `Tentar novamente`. Preservar `onClick={fetchData}` e `onClick={fetchReports}` em `*Content`.
4. **`src/components/finance/investments-view.tsx:198-207` (`fetchDividends`):**
   - Adicionar estado `dividendLoadError` (iniciado em `false`). Ao iniciar `fetchDividends`, limpar `setDividendLoadError(false)`. Se `!res.ok` ou ocorrer exceção no `catch`, executar `setDividendEntries([])` e `setDividendLoadError(true)`.
   - Em `InvestmentPortfolio`, quando `dividendLoadError` for verdadeiro: exibir na métrica `Dividendos recebidos` o marcador `'—'` com nota `'Não foi possível carregar os dividendos'` (evitando exibir `R$ 0,00` enganoso) e renderizar alerta `role="alert"` com botão `Tentar novamente` quando `!loadError` para permitir retry direto dos dividendos.

## Estratégia de verificação e testes

- Cada frente segue TDD estrito (RED antes de código de produção -> GREEN -> verificação de AST/tipos):
  - `src/components/finance/quiet-analysis-calendar.test.tsx`: testes unitários de concorrência (`request*`/`current*`) para os 4 widgets e testes de falha subsequente limpando dado antigo em `debt-overview` e `financial-reports`.
  - `src/components/finance/quiet-navigation.test.tsx`: testes de mapeamento dos 8 domínios em `searchDestination` e `searchGroupMeta`, `applySearchSelection` direto sem wrapper temporário, indexação dos 8 domínios e cancelamento via `AbortController` em `GlobalSearch`, e renderização neutra de `TRANSFER`.
  - `src/components/finance/quiet-goals-health.test.tsx`: teste de `handleDelete` em `MonthlyBudgetTracker` com resposta `503` não-JSON.
  - `src/components/finance/quiet-accounts-cards.test.tsx`: teste de `saveTransfer` em `AccountsView` com resposta `503` não-JSON.
  - `src/components/finance/quiet-investments-installments.test.tsx`: teste de `fetchDividends` falhando (`503` / erro de rede) em `InvestmentsView` sem exibir `R$ 0,00` silencioso e recuperando no retry.
- Gate integrado final: `bun --no-env-file run typecheck`, `bun --no-env-file run lint`, `bun --no-env-file .zscripts/check-frontend-architecture.ts --baseline-ref 25b44535c5068b99044afa03f7ecf318e7a9726f`, `bun --no-env-file test` e `bun --no-env-file run build`.
