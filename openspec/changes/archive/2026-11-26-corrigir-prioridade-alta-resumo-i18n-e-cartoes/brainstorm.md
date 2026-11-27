# Brainstorm — Correções de Prioridade Alta: Resumo, Privacidade, i18n e Cartões

**Skill mapping and observed invocation:** `brainstorming` (`/home/marcelo-karval/.agents/skills/brainstorming/SKILL.md`) lida integralmente e aplicada sobre o código real, catálogos `src/messages/{pt,es,en}/`, baseline AST (`.zscripts/frontend-architecture-baseline.json`), suítes `.test.*` e runners `.qa.mjs` após a auditoria viva consolidada em `#405` (base Git `ba4a9c14a624f21a3dfc21778b604e64352e9087`).

## Contexto

A auditoria independente ao vivo em `http://127.0.0.1:3000` (`#405`) confirmou que a base visual Quiet Financial OS e a internacionalização das Ondas 1–2 estão sólidas, porém identificou **6 defeitos de Prioridade Alta (#1 a #6)** que afetam hidratação React, layout móvel em `390x844`, privacidade ao ocultar valores, fidelidade de vencimentos, atualização dinâmica de widgets após troca de idioma e semântica de cartões de débito.

## Cadeia de Decisões (Q1–Q6)

### Q1 — Como eliminar o erro `getServerSnapshot` e desbloquear os controles da `Sidebar` recolhida (#1)?
- **Diagnóstico real:** `getServerSnapshot()` em `src/hooks/use-realtime.ts:87-89` cria um objeto literal novo a cada invocação de `useSyncExternalStore`, disparando `[ERROR] The result of getServerSnapshot should be cached to avoid an infinite loop` e expandindo `<nextjs-portal>` no canto inferior esquerdo, que por sua vez intercepta cliques em `Recarregar` e `Expandir navegação` no rodapé da `Sidebar` recolhida (`src/components/finance/sidebar.tsx:100-126`).
- **Decisão:**
  1. Cachear `SERVER_SNAPSHOT` em constante de módulo imutável em `src/hooks/use-realtime.ts` e retorná-la em `getServerSnapshot()`.
  2. Reposicionar os botões `Recarregar` e `Expandir/Recolher navegação` de `Sidebar` da zona inferior esquerda para o topo da barra lateral (junto ao cabeçalho da marca, mantendo `aria-label` e `<Tooltip>`), deixando no rodapé apenas o indicador passivo de conexão e `personalSpace`.

### Q2 — Como eliminar o overflow horizontal de `539px` em `390x844` na aba `Padrões` de `TransactionAnalytics` (#2)?
- **Diagnóstico real:** Em `src/app/page.tsx:71`, o container `<div key={refreshCounter} className="space-y-4">` dentro do `grid min-w-0` de `DashboardContent` não possui `min-w-0`. Como grid items assumem `min-width: auto`, a tabela `monthlyComparison` (`461px`) na aba `Padrões` força a expansão em cascata de `<TabsContent value="patterns">` (`transaction-analysis-tabs.tsx:402`), `<Tabs>` (`transaction-analytics.tsx:222`) e todos os 18 sub-widgets para `~493–539px`.
- **Decisão:** Adicionar `min-w-0` ao wrapper de `DashboardWithWidgets` (`src/app/page.tsx`), ao `<Tabs>` de `TransactionAnalytics` (`src/components/finance/transaction-analytics.tsx`) e aos `<TabsContent>` + container da tabela em `src/components/finance/transaction-analysis-tabs.tsx`, preservando `overflow-x-auto` contido apenas na região rolável da tabela.

### Q3 — Como propagar `Ocultar valores` (`showValues={false}`) para os 17 sub-widgets sem quebrar testes com dispatcher React customizado (#3)?
- **Diagnóstico real:** `DashboardView` guarda `showValues` em estado local e o repassa somente a `DashboardContent`, `UpcomingBills`, `MonthlyBudgetTracker` e `DashboardDetails`, deixando 17 sub-widgets em `Mais detalhes financeiros` exibindo `R$` e percentuais reais. Além disso, diversas suítes unitárias (`quiet-core-residuals.test.tsx`, `quiet-analysis-calendar.test.tsx`, `quiet-goals-health.test.tsx`) testam sub-componentes com `withPtIntlDispatcher` / `runWithReactHarness` que mockam apenas `useContext`/`useMemo`/`useCallback` (sem `useSyncExternalStore` exigido por Zustand).
- **Decisão:**
  1. Adicionar `showValues` (default `true`), `setShowValues` e `toggleShowValues` em `useAppStore` (`src/lib/store.ts`).
  2. `DashboardView` (`src/components/finance/dashboard-view.tsx`) e `DashboardWithWidgets` (`src/app/page.tsx`) leem `showValues` de `useAppStore` e passam `showValues={showValues}` via prop opcional (`showValues?: boolean = true`) para todos os 18 widgets de `Mais detalhes financeiros` (os 4 renderizados em `dashboard-view.tsx` e os 14 em `page.tsx`).
  3. Os sub-widgets consomem apenas a prop opcional `showValues = true` (sem `useSyncExternalStore` interno), mascarando valores monetários com `maskedValue` (`R$ ••••••`), percentuais/taxas com `'•••'`, `aria-label`/`aria-valuetext`/`title` e ticks `YAxis` dos gráficos, mantendo `.recharts-wrapper` montado para não quebrar `quiet-componentization.qa.mjs:728`.

### Q4 — Como corrigir a duplicação de `Atrasados` dentro de `Este mês` em `UpcomingBills` (#4)?
- **Diagnóstico real:** `src/components/finance/upcoming-bills.tsx:61` filtra o grupo `thisMonth` com `bills.filter((bill) => bill.status !== 'later')`, que equivale exatamente à união de `overdue` + `urgent` + `upcoming` (janela de 7 dias) sem filtrar pelo mês calendário corrente e sem excluir itens já agrupados em `Atrasados`.
- **Decisão:** Filtrar `thisMonth` para incluir apenas contas com `bill.status !== 'overdue'` cuja data (`bill.dueDate`, interpretada de forma segura para `YYYY-MM-DD` civil e timestamps ISO) pertença ao ano e mês calendário correntes (`referenceDate`, default `new Date()`), eliminando duplicação com `Atrasados` e preservando `summary.thisWeek`/`summary.thisMonth`/`summary.totalAmount` no bloco de totais.

### Q5 — Como eliminar o lag silencioso do `LanguageSwitcher` e atualizar os widgets dependentes da API sem quebrar URLs `.qa.mjs` (#5)?
- **Diagnóstico real:** `LanguageSwitcher` grava o cookie `NEXT_LOCALE` e dispara `router.refresh()` sem `useTransition` nem atualização otimista no `AppIntlProvider` (`1.6s–6.4s` sem feedback), e os widgets dependentes da API (`smart-insights.tsx`, `achievement-badges.tsx`, `financial-reports.tsx`, `cash-flow-forecast.tsx`, `savings-challenge.tsx`, `balance-projection.tsx`, `networth-evolution.tsx`, `expense-breakdown.tsx`, `transaction-analytics.tsx`, `upcoming-bills.tsx`, `quick-stats-overview.tsx`, `financial-health-score.tsx`, `budget-goals.tsx`, `monthly-budget-tracker.tsx`, `debt-overview.tsx`, `financial-calendar.tsx`, `spending-timeline.tsx`, `recurring-transactions.tsx`, `goals-dashboard.tsx`, `dashboard-view.tsx`) usam `useEffect` sem `locale` nas dependências. Além disso, `insightActionDestination` em `smart-insights.tsx:80-86` mantém comparações mortas contra strings PT.
- **Decisão:**
  1. Em `src/i18n/provider.tsx` e `src/components/finance/language-switcher.tsx`, aplicar atualização otimista imediata de `locale`/`messages`/`document.documentElement.lang` quando a troca parte do `LanguageSwitcher` (sem sobrescrever props controladas por testes/QA), executando `router.refresh()` dentro de `useTransition()` e expondo estado `isPending` (`aria-busy` e spinner acessível no botão) preservando a assinatura de `applyLocaleSelection`.
  2. Incluir `locale` (via `useSafeLocale()`) nas dependências de `useEffect` de todos os widgets que fazem `fetch('/api/...')`, **sem** anexar `?locale=...` às URLs (o cookie `NEXT_LOCALE` já é enviado em mesma origem e os runners `.qa.mjs` verificam URLs exatas).
  3. Limpar `insightActionDestination` em `src/components/finance/smart-insights.tsx`, mantendo roteamento determinístico por prefixo/ID (`card-`, `category-`, `goal-`, `emergency-fund`, `income-vs-expense`).

### Q6 — Como alinhar cartões de débito em `CardsView` ao `CardEditor` e respeitar AST/500 linhas (#6)?
- **Diagnóstico real:** `CardRow` (`cards-view.tsx:142-152`) e a visão de detalhe (`cards-view.tsx:342-354`) renderizam `Fecha dia X · Vence dia Y`, `Fatura atual R$ 0,00`, `Disponível R$ 0,00`, `Limite` e `Uso do limite 0%` mesmo quando `card.type === 'DEBIT'`, contradizendo `CardEditor` (`card-editor.tsx:150`).
- **Decisão:** Condicionar métricas e ciclo de crédito em `CardRow` e no detalhe de `CardsView` a `card.type !== 'DEBIT'`. Para `DEBIT`, exibir identificação clara de modalidade débito (com chaves localizadas em `src/messages/{pt,es,en}/cards.json`), número mascarado e lista de compras vinculadas, mantendo `cards-view.tsx` abaixo de 500 linhas (atual: 453) e todas as 6 identidades do baseline AST intactas.
