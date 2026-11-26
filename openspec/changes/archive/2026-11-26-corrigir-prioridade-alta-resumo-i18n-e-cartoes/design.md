# Design — Correções de Prioridade Alta: Resumo, Privacidade, i18n e Cartões

## Context

O sistema opera com Next.js `16.1.1`, React `19`, Zustand (`src/lib/store.ts`), `next-intl` (`src/i18n/provider.tsx`) e Tailwind CSS v4 sob governança do gate AST `.zscripts/check-frontend-architecture.ts` (6 identidades baselined em `.zscripts/frontend-architecture-baseline.json` e limiar `<= 500` linhas). A auditoria ao vivo de `localhost:3000` (`#405`) apontou seis defeitos de alta prioridade (#1–#6) que exigem correção coordenada sem quebrar assinaturas standalone testadas por `withPtIntlDispatcher` / `runWithReactHarness`, sem alterar URLs `fetch('/api/...')` esperadas pelos runners `.qa.mjs` e sem ultrapassar 500 linhas nos arquivos monitorados.

## Goals / Non-Goals

**Goals:**
- (#1) Cachear `getServerSnapshot` em `src/hooks/use-realtime.ts` e mover os botões `Recarregar` e `Expandir/Recolher navegação` de `Sidebar` para fora da zona inferior esquerda ocupada pelo `<nextjs-portal>` em dev.
- (#2) Adicionar `min-w-0` no wrapper de `DashboardWithWidgets`, em `<Tabs>` (`transaction-analytics.tsx`) e nos `<TabsContent>` / container da tabela (`transaction-analysis-tabs.tsx`) para zerar o overflow horizontal (`539px` → `<= 390px`) na aba `Padrões`.
- (#3) Centralizar `showValues` em `useAppStore` (`src/lib/store.ts`) e repassar `showValues?: boolean = true` a todos os 18 sub-widgets de `Mais detalhes financeiros`, ocultando montantes, percentuais, tooltips, `aria-valuetext` e ticks `YAxis` sem desmontar `.recharts-wrapper`.
- (#4) Filtrar o grupo `Este mês` de `UpcomingBills` pelo mês calendário corrente excluindo itens `overdue` já exibidos em `Atrasados`.
- (#5) Atualizar `AppIntlProvider` de forma otimista e imediata na troca via `LanguageSwitcher` com estado pendente via `useTransition`, incluir `locale` nos `useEffect` de fetch dos widgets mantendo as URLs `fetch('/api/...')` intactas e remover comparações PT legadas de `insightActionDestination`.
- (#6) Condicionar métricas de fatura, limite, disponibilidade, uso e ciclo de datas em `CardsView` a cartões não-débito (`type !== 'DEBIT'`), mantendo resumo coerente para débito em `pt`, `es` e `en`.

**Non-Goals:**
- Não abordar itens Médios (#7–#18) ou Baixos (#19–#22) — tratados no Pacote 2.
- Não alterar rotas `src/app/api/**`, `src/components/ui/**`, `db/custom.db`, nem adicionar `?locale=...` obrigatório em `fetch('/api/...')`.
- Não alterar nenhuma das 6 expressões `className` do `.zscripts/frontend-architecture-baseline.json`.

## Approaches

### Abordagem A — Contexto novo de privacidade (`PrivacyContext`) + fetch com `?locale=`
- **Contras:** introduz novo arquivo compartilhado que criaria dependência sequencial entre tarefas paralelas no `share` workspace e quebraria seletores de URL exata em `quiet-analytics-calendar.qa.mjs` (`url === '/api/upcoming-bills'`, `url === '/api/debts'`) e `quiet-componentization.qa.mjs`. Descartada.

### Abordagem B — Store `useAppStore` + prop opcional `showValues = true` nos widgets + cookie `NEXT_LOCALE` + atualização otimista em `AppIntlProvider` (Escolhida)
- **Descrição:**
  1. Cada widget das Tasks `1.1`, `1.2` e `1.3` recebe prop opcional `showValues = true` (sem chamar `useSyncExternalStore` internamente, preservando 100% dos testes unitários com `withPtIntlDispatcher` / `runWithReactHarness`), enquanto `Task 2.1` conecta `src/app/page.tsx` e `src/components/finance/dashboard-view.tsx` ao `useAppStore` (`showValues`) para propagar a todos os 18 sub-widgets.
  2. `LanguageSwitcher` + `AppIntlProvider` gravam o cookie `NEXT_LOCALE` primeiro, aplicam atualização otimista local e executam `router.refresh()` em `useTransition`, disparando o refetch dos widgets via `[..., locale]` usando o cookie já atualizado sem mudar as URLs de fetch.
- **Prós:** permite que Tasks `1.1`, `1.2` e `1.3` executem e passem `typecheck`/`lint`/`arch:check` em paralelo sem conflitos de escrita (`Declared conflicts: none`), preserva URLs exatas dos `.qa.mjs` e mantém compatibilidade total com testes existentes.
- **Contras:** requer que `Task 2.1` faça a ligação final em `page.tsx` e `dashboard-view.tsx` após `1.1`–`1.3` (custo mínimo, pois `2.1` já é o join natural de testes e integração).

## Decisions

### 1. Realtime e `Sidebar` (#1)
- `src/hooks/use-realtime.ts`: declarar constante de módulo `SERVER_SNAPSHOT` imutável e retorná-la em `getServerSnapshot()` para eliminar a recriação de referência em `useSyncExternalStore`.
- `src/components/finance/sidebar.tsx`: mover o par de botões `Recarregar` e `Expandir/Recolher navegação` para o topo da `<aside>` (integrado ao cabeçalho quando expandida e em faixa compacta logo abaixo do logotipo quando recolhida), mantendo `aria-label`, `<Tooltip>` e o rodapé passivo com status de conexão e `personalSpace`.

### 2. Contenção de overflow em `TransactionAnalytics` (#2)
- `src/app/page.tsx`: adicionar `min-w-0` ao `<div key={refreshCounter} className="min-w-0 space-y-4">` de `DashboardWithWidgets`.
- `src/components/finance/transaction-analytics.tsx`: adicionar `min-w-0` em `<Tabs value={activeTab} ... className="min-w-0">`.
- `src/components/finance/transaction-analysis-tabs.tsx`: adicionar `min-w-0` em `<TabsContent value="patterns" ...>` (bem como `overview` e `distribution`) e no wrapper `min-w-0 rounded-lg border border-border overflow-hidden` ao redor de `overflow-x-auto`.

### 3. Privacidade integral de `Ocultar valores` (#3)
- `src/lib/store.ts`: adicionar `showValues: boolean` (`true`), `setShowValues` e `toggleShowValues` ao `AppState`.
- Todos os 18 sub-widgets de `Mais detalhes financeiros` recebem `showValues = true` opcional e ocultam:
  - Valores monetários (`R$ ••••••` / `tShared('maskedValue')` para manter consistência com `DashboardContent` e `FinanceMetric`);
  - Percentuais, taxas de poupança, retornos, variações, badges numéricos e `aria-valuetext` (`'•••'`);
  - Ticks de `YAxis` (quando `!showValues`, retornar `'•••'`) e tooltips (`showValues={showValues}`), mantendo `<ResponsiveContainer>` / `.recharts-wrapper` montado para preservar `quiet-componentization.qa.mjs:728`;
  - `title` em barras CSS (`SpendingTimelineChart`) e itens no seletor/prévia de `ReceiptGenerator` / `ReceiptPreview`.
- Widgets que já aceitam `showValues` na borda (`balance-projection.tsx`, `cash-flow-forecast.tsx`, `networth-evolution.tsx`) estendem a máscara do tooltip para seus KPIs, listas e barras; `cards-view.tsx` não pertence ao Resumo (fora do escopo do `#3`).
- Para manter `balance-projection.tsx` (`464`), `networth-evolution.tsx` (`431`), `debt-sections.tsx` (`443`), `transaction-analysis-tabs.tsx` (`476`) e `recurring-transactions.tsx` (`471`) abaixo de `500` linhas, usar helpers locais concisos (`money` / `pct`) sem expandir blocos repetitivos e preservando intactas todas as 6 expressões `className` de `.zscripts/frontend-architecture-baseline.json`.

### 4. Filtro `Este mês` em `UpcomingBills` (#4)
- `src/components/finance/upcoming-bills.tsx`: aceitar `referenceDate?: Date` opcional em `UpcomingBillsPanel` (default `new Date()`). Para o grupo `thisMonth`, filtrar contas onde `bill.status !== 'overdue'` e cuja data `bill.dueDate` corresponda ao mesmo mês/ano de `referenceDate` (fazendo parse civil seguro quando `YYYY-MM-DD` para evitar deslocamento por fuso e comparação local `getFullYear()`/`getMonth()` para ISO timestamps). Quando nenhuma conta atender ao filtro, o `<details>` `Este mês` é naturalmente omitido, zerando a duplicação com `Atrasados`.

### 5. Troca de idioma imediata e refetch dos widgets (#5)
- `src/i18n/provider.tsx` & `src/components/finance/language-switcher.tsx`:
  - `NextRouterRefreshBridge` encapsula `router.refresh()` em `useTransition()`, fornecendo `isPending` via contexto dedicado sem quebrar `AppRefreshContext` nem `applyLocaleSelection(nextLocale, currentLocale, onLocaleSelect, refresh)`.
  - `AppIntlProvider` expõe contexto interno opcional `setOptimisticLocale` para que, ao selecionar um idioma diferente no `LanguageSwitcher`, `effectiveLocale` e `effectiveMessages` (`getMessagesForLocale(nextLocale)`) atualizem imediatamente no cliente junto de `document.documentElement.lang` enquanto `router.refresh()` sincroniza o servidor em transição com `aria-busy` e indicador visual discreto. Quando a prop `locale` muda externamente (testes/QA), a prop prevalece.
- Todos os widgets com `useEffect` que buscam APIs localizadas (`dashboard-view.tsx`, `upcoming-bills.tsx`, `quick-stats-overview.tsx`, `financial-health-score.tsx`, `smart-insights.tsx`, `achievement-badges.tsx`, `savings-challenge.tsx`, `budget-goals.tsx`, `monthly-budget-tracker.tsx`, `goals-dashboard.tsx`, `balance-projection.tsx`, `cash-flow-forecast.tsx`, `debt-overview.tsx`, `expense-breakdown.tsx`, `financial-calendar.tsx`, `financial-reports.tsx`, `networth-evolution.tsx`, `spending-timeline.tsx`, `transaction-analytics.tsx`, `recurring-transactions.tsx`) adicionam `locale = useSafeLocale()` às dependências do `useEffect` preservando as URLs exatas `fetch('/api/...')`.
- `src/components/finance/smart-insights.tsx`: simplificar `insightActionDestination` para rotear apenas por `insight.id` (`card-`, `category-`, `goal-`, `emergency-fund`, `income-vs-expense`), removendo comparações contra strings PT.

### 6. Cartão de Débito em `CardsView` (#6)
- `src/components/finance/cards-view.tsx` + `src/messages/{pt,es,en}/cards.json`:
  - Em `CardRow` e na visão de detalhe (`selectedCard`), detectar `const isDebit = card.type === 'DEBIT'`.
  - Para `isDebit`, omitir `list.cycleDates`, `Fatura atual`, `Disponível`, `Limite`, `Fechamento`, `Vencimento` e `CardUsage`, exibindo rótulo claro de cartão de débito (`list.debitSubtitle`, `list.debitMode`, `detail.debitNotice`) e mantendo número mascarado + `QueryPanel` de compras vinculadas.
  - Manter `cards-view.tsx <= 500` linhas e paridade estrita de chaves entre `pt`, `es` e `en` em `cards.json`.

## Risks / Trade-offs

- **Risco:** `balance-projection.tsx` (464) ou `transaction-analysis-tabs.tsx` (476) ou `recurring-transactions.tsx` (471) ou `cards-view.tsx` (453) ultrapassar `500` linhas e gerar novo aviso `large-tsx-file` no `arch:check`.
  - **Mitigação:** aplicar helpers concisos (`money`/`pct`), evitar blocos duplicados e conferir `wc -l` + `bun --no-env-file run arch:check` ao final de cada tarefa.
- **Risco:** alterações em `upcoming-bills.tsx` ou gráficos quebrarem a paridade de `quiet-analytics-calendar.qa.mjs` (`baseline` vs `candidate`) ou `quiet-componentization.qa.mjs` (`.recharts-wrapper`).
  - **Mitigação:** manter `<ResponsiveContainer>` montado quando `showValues === false` e validar todos os `.qa.mjs` no sandbox `bwrap` na Task `2.1`.
- **Risco:** `useTransition` ou `useAppStore` quebrarem testes que mockam `React.__CLIENT_INTERNALS...H` (`withPtIntlDispatcher` / `runWithReactHarness`).
  - **Mitigação:** não chamar `useAppStore` dentro de sub-componentes testados sob `withPtIntlDispatcher` (apenas em `DashboardView` e `DashboardWithWidgets`); `useTransition` fica restrito a `NextRouterRefreshBridge` e `LanguageSwitcher`.

## Migration Plan

1. **Wave 1 (paralela, `Declared conflicts: none`):** executar Tasks `1.1` (realtime, sidebar, store, provider, language-switcher, upcoming-bills, quick-stats, receipt), `1.2` (22 módulos `goals` + `analytics`) e `1.3` (recorrências + cartões + `cards.json`).
2. **Wave 2 (join):** executar Task `2.1` conectando `showValues` e `min-w-0` em `src/app/page.tsx` e `src/components/finance/dashboard-view.tsx`, atualizando as 8 suítes `.test.*` e `quiet-i18n.qa.mjs`, e validando `check`, `test:sqlite`, `build` e os runners `.qa.mjs` em sandbox `bwrap`.
3. **Rollback:** cada frente `1.1`, `1.2`, `1.3` e `2.1` possui fronteiras isoladas e sem conflitos de escrita.
