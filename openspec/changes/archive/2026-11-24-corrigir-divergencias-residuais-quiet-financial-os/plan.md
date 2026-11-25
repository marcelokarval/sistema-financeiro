# Implementation plan

**Goal:** Corrigir as quatro divergências residuais do contrato Quiet Financial OS em `balance-projection.tsx`, `monthly-budget-tracker.tsx`, `accounts-view.tsx`, `cards-view.tsx`, `consortiums-view.tsx` e `savings-view.tsx`, reconciliar seus testes/runners `.qa.mjs` e atualizar a Seção 5 de `docs/reference/frontend-componentization-coverage.md`.
**Architecture:** Aplicar guarda de requisição + `AbortController` em `balance-projection.tsx` (espelhando `expense-breakdown.tsx`), retorno antecipado em `!res.ok` com parse resiliente em `monthly-budget-tracker.tsx` (espelhando `budget-goals.tsx`), limpeza de referência de retorno à linha antes de fechar o alerta pós-`DELETE` `2xx` em `accounts-view.tsx`, `cards-view.tsx` e `consortiums-view.tsx` (espelhando `investments-view.tsx` e `recurring-transactions.tsx`), e efeito pós-remoção para `#savings-create` em `savings-view.tsx` preservando fechamento Radix (espelhando `budget-goals.tsx`).
**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand, Radix AlertDialog, Bun test runner, Playwright CLI (`.qa.mjs`), OpenSpec + `superpowers-bridge` v2.
**Spec:** `openspec/changes/corrigir-divergencias-residuais-quiet-financial-os/specs/interface-quiet-financial-os/spec.md`
**Skill mapping and observed invocation:** `writing-plans` (`/home/marcelo-karval/.agents/skills/writing-plans/SKILL.md`), invocada nesta sessão de planejamento após `brainstorming` e `openspec-propose` para estruturar `plan.md` contra `tasks.md` e `design.md`.

### Global Constraints

- Nenhuma alteração em `src/components/ui/*`, `src/app/api/*`, `src/app/globals.css`, `prisma/schema.prisma`, `package.json`, `bun.lock` ou `src/components/finance/global-search.tsx`.
- Preservar integralmente o baseline AST `.zscripts/frontend-architecture-baseline.json` (incluindo a identidade `MonthSelector` em `balance-projection.tsx`) sem criar novas entradas `raw-conditional-class-name` ou erros no gate AST.
- Manter textos da UI em português brasileiro (`pt-BR`), valores monetários via `currencyFmt()` e foco visível/nomes acessíveis em claro e escuro.
- Seguir TDD estrito (`RED -> GREEN -> REFACTOR`) em cada tarefa independente antes de iniciar a consolidação `3.1`.

### Review Focus

- `balance-projection.tsx`: troca rápida `6 meses -> 3 meses -> 6 meses` (reabertura do mesmo horizonte) e falha `503` ou rejeição de rede tardia de `6 meses` após `3 meses` já resolvido.
- `monthly-budget-tracker.tsx`: resposta HTTP `400` com JSON `{ error }` e resposta HTTP `503` com corpo texto não-JSON em `POST` e `PUT` devem ambas preservar diálogo aberto, rascunho digitado e zero `GET /api/monthly-budgets`.
- `accounts-view.tsx` e `cards-view.tsx`: cancelamento (`Escape`/`Cancelar`) e erro `503` de `DELETE` continuam devolvendo foco ao botão da linha, enquanto `DELETE` `2xx` com `GET` tardio move o foco para o botão sobrevivente (`Nova conta` / `Novo cartão`) sem cair em `document.body`.
- `consortiums-view.tsx` e `savings-view.tsx`: em Consórcios detalhe, `DELETE` continua respeitando mudança `A -> B`; em Caixinhas, falha de `DELETE` mantém foco no acionador da linha (`Mais ações de Meta A`), enquanto `DELETE` `2xx` + `GET` tardio restaura `#savings-create` apenas se o foco caiu em `document.body`/desconectado sem roubar foco movido pelo usuário.
- Runners `.qa.mjs`: manter comparação estrita por `Bun.deepEquals` contra `baseRef` em todos os cenários não remediados enquanto valida explicitamente conformidade Quiet nos cenários corrigidos com `preexistingQuietDivergences` vazio.

## Task 1.1: Proteger balance-projection contra corrida assíncrona de selectedMonths

- Depends on: none
- Outcome: `BalanceProjection` descarta qualquer resposta ou erro de requisições de período anteriores (`selectedMonths`) via `AbortController` e identidade de objeto de requisição, impedindo que `A` atrasada sobrescreva `B`, com teste unitário/integração verde em `quiet-analysis-calendar.test.tsx`.
- Inputs and dependencies: Nenhuma dependência de outras tarefas; consome `design.md` (Decisão D1), `src/components/finance/expense-breakdown.tsx` (referência de proteção de período) e o cenário `Descarte de resposta ou erro de período anterior na projeção de saldos` da spec delta. Escopo exclusivo em `balance-projection.tsx` e `quiet-analysis-calendar.test.tsx`, permitindo execução paralela com `1.2`, `2.1` e `2.2`.
- Scope and decisions: Exportar tipos/funções puras `BalanceProjectionRequest`, `BalanceProjectionResult`, `requestBalanceProjection` e `currentBalanceProjection` em `balance-projection.tsx`; substituir estado solto `data`/`loading` em `BalanceProjection` por `request` (`{ months: number }`) + `settled` (`BalanceProjectionResult | null`) + `useEffect` com `AbortController` e `onRetry` criando `{ months: request.months }`. Manter `MonthSelector`, `BalanceProjectionTooltip` e `BalanceProjectionContent` visualmente idênticos para preservar o hash AST `87145e91...` de `MonthSelector`.
- Expected acceptance evidence: `bun --no-env-file test src/components/finance/quiet-analysis-calendar.test.tsx` passa integralmente após remover o teste de caracterização da divergência e validar ambos os casos (sucesso tardio e erro `503`/rejeição tardia de `6 meses` preservando `3 meses`, além de retry no mesmo período).

### Files
- Modify: `src/components/finance/balance-projection.tsx` (linhas ~160-198 e exports auxiliares)
- Test: `src/components/finance/quiet-analysis-calendar.test.tsx` (linhas ~497-576)

### Interfaces
- Consumes: `ProjectionData` e `BalanceProjectionContent` internos em `src/components/finance/balance-projection.tsx`.
- Produces:
```ts
export type BalanceProjectionRequest = { months: number };
export type BalanceProjectionStatus =
  | { status: 'ready'; data: ProjectionData }
  | { status: 'error' };
export type BalanceProjectionResult = {
  request: BalanceProjectionRequest;
  result: BalanceProjectionStatus;
};
export async function requestBalanceProjection(
  request: BalanceProjectionRequest,
  signal: AbortSignal,
  publish: (response: BalanceProjectionResult) => void,
  fetcher?: (url: string, init?: RequestInit) => Promise<Response>,
): Promise<void>;
export function currentBalanceProjection(
  request: BalanceProjectionRequest,
  settled: BalanceProjectionResult | null,
): BalanceProjectionStatus | { status: 'loading' };
```

### Passos TDD (RED -> GREEN -> REFACTOR)
1. **RED — Atualizar teste em `src/components/finance/quiet-analysis-calendar.test.tsx`**: substituir `'caracterização eb76f7d (divergência aberta, não conformidade Quiet): balance-projection sem guarda em selectedMonths permite A atrasada sobrescrever B'` pelo teste de conformidade Quiet `'balance-projection descarta resposta e erro de selectedMonths anterior sem sobrescrever período vigente e permite retry'`, afirmando que após `6 meses -> 3 meses -> resolve(3)` nem sucesso tardio (`9999`) nem `503`/rejeição tardia de `6 meses` sobrescrevem `R$ 3.333,00`, e que `onRetry` reconsulta o horizonte atual.
2. **Verificar RED**: executar `bun --no-env-file test src/components/finance/quiet-analysis-calendar.test.tsx` e confirmar que o novo teste de conformidade reprova porque `R$ 9.999,00` e `'Não foi possível carregar a projeção de saldos.'` ainda sobrescrevem `3 meses`.
3. **GREEN — Implementar guarda em `src/components/finance/balance-projection.tsx`**: definir `BalanceProjectionRequest`, `BalanceProjectionResult`, `requestBalanceProjection` (passando `{ signal }` ao `fetcher` e verificando `if (!signal.aborted) publish({ request, result })`) e `currentBalanceProjection` (`settled?.request === request ? settled.result : { status: 'loading' }`); atualizar `BalanceProjection` para usar `request`/`settled`, `useEffect` com `AbortController` (`return () => controller.abort()`), `onSelectMonths={(months) => { if (months !== request.months) setRequest({ months }); }}` e `onRetry={() => setRequest({ months: request.months })}`.
4. **Verificar GREEN**: reexecutar `bun --no-env-file test src/components/finance/quiet-analysis-calendar.test.tsx` e confirmar todos os testes verdes sem regressão.

- RED command and observed failure: `bun --no-env-file test src/components/finance/quiet-analysis-calendar.test.tsx` -> saída `1` (`18 pass`, `1` reprovação no novo teste de conformidade: esperado verdadeiro para `signals[0]?.signal?.aborted`, recebido valor ausente porque `fetch` não recebia sinal de cancelamento).
- GREEN command and observed result: `bun --no-env-file test src/components/finance/quiet-analysis-calendar.test.tsx` -> saída `0` (`19 pass`, `0` reprovações, `197 expect() calls`).
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: verifier-3 (digest registrado em verify.md e evidence.json)
- Remaining gaps: Nenhum

---

## Task 1.2: Reter MonthlyBudgetEditor e rascunho em erro HTTP sem refreshBudgets prematuro

- Depends on: none
- Outcome: `MonthlyBudgetTracker` mantém `MonthlyBudgetEditor` aberto com todos os campos do rascunho preservados e zero chamadas `refreshBudgets()` (`GET /api/monthly-budgets`) diante de qualquer resposta HTTP não OK (`400` JSON ou `503` não-JSON) ou erro de transporte em `POST`/`PUT`, verificado em `quiet-goals-health.test.tsx` e `quiet-goals-widgets.qa.mjs`.
- Inputs and dependencies: Nenhuma dependência de outras tarefas; consome `design.md` (Decisão D2), `src/components/finance/budget-goals.tsx` (referência de retorno antecipado em `!res.ok`) e o cenário `Retenção de editor e rascunho em erro HTTP do orçamento mensal` da spec delta. Escopo exclusivo em `monthly-budget-tracker.tsx`, `quiet-goals-health.test.tsx` e `quiet-goals-widgets.qa.mjs`, paralelo a `1.1`, `2.1` e `2.2`.
- Scope and decisions: Em `handleSubmit` de `monthly-budget-tracker.tsx`, mover `setDialogOpen(false)` e `refreshBudgets()` exclusivamente para o caminho `res.ok` (ou retornar imediatamente dentro de `if (!res.ok)`), usando `const data = await res.json().catch(() => ({}))` e `toast.error(data?.error || (editingBudget ? 'Erro ao atualizar' : 'Erro ao criar'))`. Atualizar `quiet-goals-health.test.tsx` para exigir `open === true`, `form.amount === '750'` e `budgetGets === initialBudgetGets` nos 3 modos (`http-json`, `invalid-json`, `transport`) para `POST` e `PUT`, e atualizar `quiet-goals-widgets.qa.mjs` nos cenários `orcamento/gravacao/{POST,PUT}/http-json` para validar o comportamento Quiet no `candidate` sem exigir igualdade com a falha legada do `baseline`.
- Expected acceptance evidence: `bun --no-env-file test src/components/finance/quiet-goals-health.test.tsx` e a suíte `quiet-goals-widgets.qa.mjs` em sandbox isolado passam com 0 violações e 0 skips.

### Files
- Modify: `src/components/finance/monthly-budget-tracker.tsx` (linhas ~148-195)
- Test: `src/components/finance/quiet-goals-health.test.tsx` (linhas ~601-663)
- Test: `src/components/finance/quiet-goals-widgets.qa.mjs` (linhas ~551-621 e ~862-872)

### Interfaces
- Consumes: `MonthlyBudgetEditor` (`src/components/finance/monthly-budget-editor.tsx`) e `MonthlyBudgetDraft` sem alteração de props.
- Produces: Mesmo contrato público de `MonthlyBudgetTracker` e `BudgetHeader`, agora garantindo pós-condição de erro em `handleSubmit`:
```ts
// Quando !res.ok em POST/PUT:
// 1) toast.error(data?.error || (editingBudget ? 'Erro ao atualizar' : 'Erro ao criar'))
// 2) return antecipado: open permanece true, form preserva rascunho, refreshBudgets() não é chamado.
```

### Passos TDD (RED -> GREEN -> REFACTOR)
1. **RED — Atualizar teste em `src/components/finance/quiet-goals-health.test.tsx`**: alterar o teste `'MonthlyBudgetTracker fecha e dispara 1 GET em HTTP não OK JSON, mas retém diálogo e rascunho no catch em POST/PUT'` para `'MonthlyBudgetTracker retém diálogo e rascunho sem GET em HTTP não OK (JSON ou não-JSON) e erro de transporte em POST/PUT'`, esperando `after.props.open === true`, `after.props.form.amount === '750'`, `budgetGets === initialBudgetGets` em `http-json` (`'Limite inválido'`), `invalid-json` (`'Erro ao criar'` / `'Erro ao atualizar'`) e `transport` (`'Erro de conexão'`).
2. **Verificar RED**: executar `bun --no-env-file test src/components/finance/quiet-goals-health.test.tsx` e confirmar reprovação em `http-json` (diálogo fechando e `budgetGets` incrementado) e `invalid-json` (mensagem `'Erro de conexão'` quando esperado erro HTTP).
3. **GREEN — Corrigir `handleSubmit` em `src/components/finance/monthly-budget-tracker.tsx`**: no `if (editingBudget)` e no ramo `POST`, verificar `if (!res.ok) { const data = await res.json().catch(() => ({})); toast.error(data?.error || (editingBudget ? 'Erro ao atualizar' : 'Erro ao criar')); return; }`, mantendo `setDialogOpen(false)` e `refreshBudgets()` somente após `toast.success(...)`.
4. **Atualizar `src/components/finance/quiet-goals-widgets.qa.mjs`**: nos cenários `orcamento/gravacao/{POST,PUT}/http-json`, validar no `candidate` que `dialog` permanece visível com valor `'777'`, toast `'Falha HTTP sintética'` anexado e `trace === [[method, '/api/monthly-budgets']]`, tratando o desvio intencional do `baseline` antigo (`7bbd1e6`) apenas para `orcamento/gravacao/*/http-json` e preservando `Bun.deepEquals` estrito para todos os demais cenários.
5. **Verificar GREEN**: executar `bun --no-env-file test src/components/finance/quiet-goals-health.test.tsx` e validar o runner `quiet-goals-widgets.qa.mjs`.

- RED command and observed failure: `bun --no-env-file test src/components/finance/quiet-goals-health.test.tsx` -> saída `1` (`25 pass`, `1` reprovação em `MonthlyBudgetTracker retém diálogo e rascunho sem GET em HTTP não OK (JSON ou não-JSON) e erro de transporte em POST/PUT`: `Expected: true, Received: false` para `after.props.open` no primeiro caso `http-json`).
- GREEN command and observed result: `bun --no-env-file test src/components/finance/quiet-goals-health.test.tsx` -> saída `0` (`26 pass`, `0` reprovações, `214 expect() calls`) e `quiet-goals-widgets.qa.mjs` (`60 cenários pareados; 0 skips`, saída `0`, `task-237.log`).
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: verifier-3 (digest registrado em verify.md e evidence.json)
- Remaining gaps: Nenhum

---

## Task 2.1: Garantir foco sobrevivente pós-DELETE com GET tardio em Contas e Cartões

- Depends on: none
- Outcome: Após `DELETE` `2xx` seguido de `GET` tardio em `accounts-view.tsx` (`account/Excluir/late`) e `cards-view.tsx` (`card/Excluir/late`), o foco permanece em um controle sobrevivente (`newAccountButton` / `newCardButton`) sem cair em `document.body`, com remoção completa de `preexistingQuietDivergences` em `quiet-keyed-deletion-focus.qa.mjs` e `quiet-cards-purchases-categories.qa.mjs` e testes de unidade em `quiet-accounts-cards.test.tsx`.
- Inputs and dependencies: Nenhuma dependência de outras tarefas; consome `design.md` (Decisões D3 e D5), `src/components/finance/investments-view.tsx` / `recurring-transactions.tsx` e o cenário `Foco sobrevivente após exclusão com releitura tardia em Contas, Cartões, Consórcios e Caixinhas` da spec delta. Escopo exclusivo em `accounts-view.tsx`, `cards-view.tsx`, `quiet-accounts-cards.test.tsx`, `quiet-keyed-deletion-focus.qa.mjs` e `quiet-cards-purchases-categories.qa.mjs`, paralelo a `1.1`, `1.2` e `2.2`.
- Scope and decisions: Em `deleteAccount` (`accounts-view.tsx`) e `deleteCard` (`cards-view.tsx`), após confirmar `res.ok` e `if (deleteOpening.current === opening)`, atribuir `dialogReturn.current = null` imediatamente antes de `setShowDeleteDialog(null)`, fazendo `restoreDialogFocus` focar o botão sobrevivente `newAccountButton.current` ou `newCardButton.current`. Preservar `dialogReturn.current` intacto em cancelamento (`Escape`/`Cancelar`) e erro de `DELETE`. Atualizar `quiet-accounts-cards.test.tsx` para exercitar explicitamente foco pós-`DELETE` `2xx` com `dialogReturn` apontando para um botão desconectado vs conectado e fallback no botão `Nova conta`/`Novo cartão`. Atualizar `quiet-keyed-deletion-focus.qa.mjs` e `quiet-cards-purchases-categories.qa.mjs` removendo `preexistingQuietDivergences` e validando que `account/Excluir/late`, `card/Excluir/late` e `cartoes/exclusao-matriz-temporal` terminam com `violations: []` e foco conectado no controle sobrevivente (`Nova conta` / `Novo cartão`).
- Expected acceptance evidence: `bun --no-env-file test src/components/finance/quiet-accounts-cards.test.tsx` passa; `quiet-keyed-deletion-focus.qa.mjs` e `quiet-cards-purchases-categories.qa.mjs` passam nas 6 células com zero violações e zero divergências Quiet abertas.

### Files
- Modify: `src/components/finance/accounts-view.tsx` (linhas ~443-465 e ~1037-1063)
- Modify: `src/components/finance/cards-view.tsx` (linhas ~259-271 e ~406-425)
- Test: `src/components/finance/quiet-accounts-cards.test.tsx` (seção de exclusão e retorno de foco)
- Test: `src/components/finance/quiet-keyed-deletion-focus.qa.mjs` (linhas ~421-433 e ~602-653)
- Test: `src/components/finance/quiet-cards-purchases-categories.qa.mjs` (linhas ~349-373 e ~710-771)

### Interfaces
- Consumes: `restoreDialogFocus`, `dialogReturn`, `newAccountButton` (`accounts-view.tsx`) e `newCardButton` (`cards-view.tsx`), além de `useKeyedMutationLock`.
- Produces: Mesmo contrato de props e refs internas, garantindo que na conclusão de `deleteAccount` / `deleteCard` (`res.ok` + mesma abertura) `dialogReturn.current = null` antes de fechar o `AlertDialog`, direcionando `onCloseAutoFocus` ao fallback sobrevivente `newAccountButton.current` / `newCardButton.current`.

### Passos TDD (RED -> GREEN -> REFACTOR)
1. **RED — Adicionar testes focados em `src/components/finance/quiet-accounts-cards.test.tsx`**: adicionar cenários para Contas e Cartões em que `dialogReturn.current` aponta para o botão da linha (ainda conectado no momento do `DELETE` `2xx` antes do `GET` tardio resolver), confirmando que `onCloseAutoFocus` do `AlertDialogContent` limpa a referência da linha e foca o botão sobrevivente (`Nova conta` / `Novo cartão`) após `DELETE` `2xx`, mantendo o retorno à origem quando o diálogo é cancelado ou quando `DELETE` falha.
2. **Verificar RED**: executar `bun --no-env-file test src/components/finance/quiet-accounts-cards.test.tsx` e confirmar que os novos testes reprovam porque `dialogReturn.current` ainda foca o botão condenado da linha no fechamento pós-`DELETE`.
3. **GREEN — Atualizar `deleteAccount` e `deleteCard`**:
   - Em `src/components/finance/accounts-view.tsx`: dentro de `if (deleteOpening.current === opening)`, definir `dialogReturn.current = null;` antes de `setShowDeleteDialog(null);`.
   - Em `src/components/finance/cards-view.tsx`: dentro de `if (deleteOpening.current === opening)`, definir `dialogReturn.current = null;` antes de `setShowDeleteDialog(null);`.
4. **Atualizar runners `.qa.mjs`**:
   - Em `src/components/finance/quiet-keyed-deletion-focus.qa.mjs`: para `order === 'late' && entity !== 'tx'`, passar a exigir no `candidate` que `point.focus` e `afterFocus` estejam no controle sobrevivente (`fallbackAtClose` / `fallbackFocus`, sem cair em `body`), remover `preexistingQuietDivergences` e comparar `Bun.deepEquals` contra `baseline` apenas nos cenários não remediados.
   - Em `src/components/finance/quiet-cards-purchases-categories.qa.mjs`: remover `isPreexistingCardsRemoval` e `preexistingQuietDivergences`, exigindo `violations: []` em `cartoes/exclusao-matriz-temporal` no `candidate` e preservando `Bun.deepEquals` contra `baseline` nos demais cenários.
5. **Verificar GREEN**: executar `bun --no-env-file test src/components/finance/quiet-accounts-cards.test.tsx` e validar os dois runners `.qa.mjs` em sandbox isolado.

- RED command and observed failure: `bun --no-env-file test src/components/finance/quiet-accounts-cards.test.tsx` -> saída `1` (`27 pass`, `2` reprovações: após `DELETE` 2xx em Contas e Cartões, foco no fechamento retornava ao acionador condenado da linha `"Excluir conta Conta A"` / `"Excluir cartão Cartão A"` em vez do botão sobrevivente `"Nova conta"` / `"Novo cartão"`).
- GREEN command and observed result: `bun --no-env-file test src/components/finance/quiet-accounts-cards.test.tsx` -> saída `0` (`29 pass`, `0` reprovações, `250 expect() calls`), `quiet-keyed-deletion-focus.qa.mjs` (`78 cenários verificados; 0 skips; 0 divergências Quiet abertas`, `task-158.log`) e `quiet-cards-purchases-categories.qa.mjs` (`120 cenários verificados; 0 skips; 0 divergências Quiet abertas`, `task-237.log`).
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: verifier-3 (digest registrado em verify.md e evidence.json)
- Remaining gaps: Nenhum

---

## Task 2.2: Garantir foco sobrevivente pós-DELETE com GET tardio em Consórcios (lista) e Caixinhas

- Depends on: none
- Outcome: Após `DELETE` + `GET` tardio na lista de Consórcios (`list/Excluir/late` em `consortiums-view.tsx`) e em Caixinhas (`caixinhas/exclusao/late` em `savings-view.tsx`), o foco permanece em um controle sobrevivente (`#consortium-create` / `#savings-create` ou controle já focado) sem cair em `document.body`, removendo ambos de `preexistingQuietDivergences` em `quiet-consortiums-editor.qa.mjs` e `quiet-installments-savings-dialogs.qa.mjs`, com cobertura em `quiet-consortiums-savings.test.tsx`.
- Inputs and dependencies: Nenhuma dependência de outras tarefas; consome `design.md` (Decisões D3, D4 e D5), `src/components/finance/budget-goals.tsx` (`restoreBudgetGoalFocusAfterDeletion`) e o cenário `Foco sobrevivente após exclusão com releitura tardia em Contas, Cartões, Consórcios e Caixinhas` da spec delta. Escopo exclusivo em `consortiums-view.tsx`, `savings-view.tsx`, `quiet-consortiums-savings.test.tsx`, `quiet-consortiums-editor.qa.mjs` e `quiet-installments-savings-dialogs.qa.mjs`, paralelo a `1.1`, `1.2` e `2.1`.
- Scope and decisions:
  - Em `consortiums-view.tsx` (`confirmDelete`), após `res.ok` e antes de `setShowDeleteDialog(...)`, limpar `dialogOrigin.current = null;` quando a exclusão confirmada corresponde à origem atual (`!showDeleteDialog || ...`), garantindo que `restoreDialogFocus` foque `#consortium-detail-title ?? #consortium-create` (ou `#consortium-create` na lista) em vez do botão de linha prestes a ser desmontado; manter `dialogOrigin.current` preservado em cancelamento e erro de `DELETE`.
  - Em `savings-view.tsx`, preservar `AlertDialogAction` sem `event.preventDefault()`, adicionar `pendingDeletionFocus = useRef(new Set<string>())`, exportar `restoreSavingsFocusAfterDeletion(deletedId, goals, activeElement, body, fallback)` (espelho de `restoreBudgetGoalFocusAfterDeletion`), registrar `pendingDeletionFocus.current.add(id)` em `handleDeleteGoal` quando `res.ok`, e executar `useEffect` sobre `[goals]` que, assim que `goals` não contiver `id`, aciona `restoreSavingsFocusAfterDeletion` restaurando `#savings-create` somente se `activeElement === body` (ou `!activeElement?.isConnected`).
  - Atualizar `quiet-consortiums-savings.test.tsx`, `quiet-consortiums-editor.qa.mjs` e `quiet-installments-savings-dialogs.qa.mjs` removendo `preexistingQuietDivergences`.
- Expected acceptance evidence: `bun --no-env-file test src/components/finance/quiet-consortiums-savings.test.tsx` passa; `quiet-consortiums-editor.qa.mjs` e `quiet-installments-savings-dialogs.qa.mjs` passam nas 6 células com zero violações e zero divergências Quiet abertas.

### Files
- Modify: `src/components/finance/consortiums-view.tsx` (linhas ~471-498 e ~549-562)
- Modify: `src/components/finance/savings-view.tsx` (linhas ~279-297, ~343-354 e novo `useEffect` pós-remoção)
- Test: `src/components/finance/quiet-consortiums-savings.test.tsx` (testes de foco pós-exclusão em Consórcios e Caixinhas)
- Test: `src/components/finance/quiet-consortiums-editor.qa.mjs` (linhas ~239-250 e ~371-420)
- Test: `src/components/finance/quiet-installments-savings-dialogs.qa.mjs` (linhas ~688-793 e ~928-990)

### Interfaces
- Consumes: `restoreDialogFocus`, `dialogOrigin` (`consortiums-view.tsx`) e `#savings-create` (`savings-view.tsx`).
- Produces: Função auxiliar pura exportada em `src/components/finance/savings-view.tsx`:
```ts
type FocusTarget = Pick<HTMLElement, 'isConnected' | 'focus'>;
export function restoreSavingsFocusAfterDeletion(
  deletedId: string,
  goals: readonly Pick<SavingsGoal, 'id'>[],
  activeElement: Pick<HTMLElement, 'isConnected'> | null,
  body: object,
  fallback: FocusTarget | null,
): boolean;
```

### Passos TDD (RED -> GREEN -> REFACTOR)
1. **RED — Adicionar testes unitários em `src/components/finance/quiet-consortiums-savings.test.tsx`**:
   - Para `ConsortiumsView` (`list` e `detail`): verificar que `confirmDelete` com `res.ok` limpa a origem de linha antes do fechamento de modo que `onCloseAutoFocus` foca o fallback sobrevivente (`#consortium-create` / `#consortium-detail-title`), enquanto cancelamento e falha mantêm a origem.
   - Para `SavingsView`: testar `restoreSavingsFocusAfterDeletion` (não age enquanto `id` ainda está em `goals`; não rouba foco se `activeElement` está em outro controle conectado diferente de `body`; move foco para `fallback` `#savings-create` quando `activeElement === body` ou desconectado e `id` saiu de `goals`) e exercitar o fluxo `handleDeleteGoal` garantindo que falha HTTP não registra restauração enquanto `2xx` registra e restaura após `fetchGoals()` remover a meta.
2. **Verificar RED**: executar `bun --no-env-file test src/components/finance/quiet-consortiums-savings.test.tsx` e confirmar reprovação pela ausência de `restoreSavingsFocusAfterDeletion` e pela retenção da origem de linha em `confirmDelete`.
3. **GREEN — Implementar correções**:
   - Em `src/components/finance/consortiums-view.tsx`: em `confirmDelete`, quando `res.ok`, definir `dialogOrigin.current = null;` antes de `setShowDeleteDialog(...)`.
   - Em `src/components/finance/savings-view.tsx`: implementar e exportar `restoreSavingsFocusAfterDeletion`, adicionar `pendingDeletionFocus` e `useEffect([goals])` verificando `document.activeElement === document.body || !document.activeElement?.isConnected`, alimentado apenas quando `res.ok` em `handleDeleteGoal`.
4. **Atualizar runners `.qa.mjs`**:
   - Em `src/components/finance/quiet-consortiums-editor.qa.mjs`: em `list/Excluir/late`, validar no `candidate` que `point.focus` e `afterFocus` estão em `createFocus` (`#consortium-create`), remover `isPreexistingListLateFocus` e `preexistingQuietDivergences`, mantendo `Bun.deepEquals` nos demais cenários.
   - Em `src/components/finance/quiet-installments-savings-dialogs.qa.mjs`: remover `isPreexistingSavingsRemoval` e `preexistingQuietDivergences`, exigindo que `caixinhas/exclusao/late` (assim como `early` e `falha-delete`) termine com `violations: []` no `candidate` e mantendo `Bun.deepEquals` nos demais cenários.
5. **Verificar GREEN**: executar `bun --no-env-file test src/components/finance/quiet-consortiums-savings.test.tsx` e validar os dois runners `.qa.mjs` em sandbox isolado.

- RED command and observed failure: `bun --no-env-file test src/components/finance/quiet-consortiums-savings.test.tsx` -> saída `1` (`51 pass`, `4` reprovações: retorno para `row-delete`/`detail-delete` após `res.ok` em Consórcios; ausência de `restoreSavingsFocusAfterDeletion` e foco não restaurado para `#savings-create` em Caixinhas).
- GREEN command and observed result: `bun --no-env-file test src/components/finance/quiet-consortiums-savings.test.tsx` -> saída `0` (`55 pass`, `0` reprovações, `338 expect() calls`), `quiet-consortiums-editor.qa.mjs` (`108 cenários pareados; 0 skips`, `task-237.log`) e `quiet-installments-savings-dialogs.qa.mjs` (`54 cenários pareados; 0 skips`, `task-158.log`).
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: verifier-3 (digest registrado em verify.md e evidence.json)
- Remaining gaps: Nenhum

---

## Task 3.1: Reconciliar Seção 5 de cobertura frontend e executar bateria integrada

- Depends on: 1.1, 1.2, 2.1, 2.2
- Outcome: `docs/reference/frontend-componentization-coverage.md` (Seção 5) reflete com precisão a resolução das quatro divergências residuais (mantendo Busca Global separada conforme seu próprio estado) e toda a bateria integrada (`check-frontend-architecture.ts`, `typecheck`, `lint`, `bun --no-env-file test` e todos os runners `.qa.mjs` nas 6 células `360/390/1440 × light/dark`) passa com 0 erros, 0 violações e 0 `preexistingQuietDivergences` nos itens remediados.
- Inputs and dependencies: Requer conclusão verificada das tasks `1.1`, `1.2`, `2.1` e `2.2` com seus respectivos arquivos candidatos já alterados e testes unitários/runners individuais verdes. Consome as evidências reais coletadas nessas tasks para atualizar a Seção 5 de `docs/reference/frontend-componentization-coverage.md`.
- Scope and decisions: Atualizar apenas a Seção 5 (e eventuais contadores/referências de linhas afetados na Seção 2 caso citado, sem reescrever histórico da Onda 6) de `docs/reference/frontend-componentization-coverage.md`, registrando explicitamente o estado sanado de `balance-projection.tsx`, `monthly-budget-tracker.tsx`, Contas (`account/Excluir/late`), Cartões (`card/Excluir/late`), Consórcios (`list/Excluir/late`) e Caixinhas (`caixinhas/exclusao/late`). Executar em sequência o gate AST, `typecheck`, `lint`, `bun --no-env-file test` e os 5 runners `.qa.mjs` afetados em sandboxes isolados nas 6 células `360/390/1440 × light/dark`.
- Expected acceptance evidence: Saídas observadas com exit `0` de:
  1. `bun run .zscripts/check-frontend-architecture.ts --baseline-ref 25b44535c5068b99044afa03f7ecf318e7a9726f` (0 erros, 0 unbaselined, 0 orphan);
  2. `bun run typecheck` (`tsc --noEmit`);
  3. `bun run lint` (`eslint .`);
  4. `bun --no-env-file test`;
  5. Os 5 runners `.qa.mjs` (`quiet-goals-widgets.qa.mjs`, `quiet-keyed-deletion-focus.qa.mjs`, `quiet-cards-purchases-categories.qa.mjs`, `quiet-consortiums-editor.qa.mjs`, `quiet-installments-savings-dialogs.qa.mjs`) nas 6 células (`360/390/1440 × light/dark`) com 0 skips e 0 `preexistingQuietDivergences`.

### Files
- Modify: `docs/reference/frontend-componentization-coverage.md` (Seção 5: 5.1, 5.2 e 5.3)
- Verify: Todos os arquivos de `candidate-manifest.json`

### Interfaces
- Consumes: Resultados observados de `1.1`, `1.2`, `2.1` e `2.2`.
- Produces: Seção 5 reconciliada de `docs/reference/frontend-componentization-coverage.md` e relatório de evidências para `bridge_guard.py candidate`, `evidence.json` e `verify.md`.

### Passos TDD / Reconciliação e Verificação Integrada
1. **RED (Auditoria documental pré-edição)**: conferir por leitura/busca que `docs/reference/frontend-componentization-coverage.md` Seção 5 ainda registra as 4 divergências como abertas e que todos os 5 runners `.qa.mjs` e suítes unitárias das tasks `1.1`–`2.2` já refletem os novos comportamentos no código.
2. **GREEN — Reconciliar `docs/reference/frontend-componentization-coverage.md` Seção 5**:
   - Na Seção 5.1: atualizar a linha **Projeção de Saldo (`balance-projection.tsx`)** para **Conforme Quiet** (guarda por identidade de requisição `{ months }` + `AbortController`, evidência em `quiet-analysis-calendar.test.tsx`), mantendo a linha **Busca Global** inalterada quanto à decisão separada da change `alinhar-contrato-busca-global-quiet` (caso ainda não aplicada).
   - Na Seção 5.2: atualizar os itens `3` (`Consórcios — exclusão em lista`), `4` (`Contas e Cartões`) e `6` (`Caixinhas`) registrando a remoção de `preexistingQuietDivergences` e o foco sobrevivente após `DELETE` + `GET` tardio nas 6 células.
   - Na Seção 5.3: atualizar o item **Metas vs Orçamento mensal** registrando que `monthly-budget-tracker.tsx` passou a reter diálogo e rascunho em erro HTTP sem disparar `refreshBudgets()`, alinhado a `budget-goals.tsx`.
3. **Executar bateria integrada final (após a última edição)**:
   - `bun run .zscripts/check-frontend-architecture.ts --baseline-ref 25b44535c5068b99044afa03f7ecf318e7a9726f`
   - `bun run typecheck`
   - `bun run lint`
   - `bun --no-env-file test`
   - Executar os 5 runners `.qa.mjs` em sandboxes isolados nas 6 células (`360/390/1440 × light/dark`) e confirmar `0` violações e `0` `preexistingQuietDivergences`.

- RED command and observed failure: Auditoria documental pré-edição da Seção 5 de `docs/reference/frontend-componentization-coverage.md` + `bun --no-env-file test src/components/finance/quiet-navigation.test.tsx` -> saída `1` (`11 pass`, `1` reprovação: Seção 5 ainda registrava as 4 divergências residuais como abertas e a Busca Global com `historicalAutoOpenDeviation` / `Não afirma conformidade Quiet`).
- GREEN command and observed result: `bun --no-env-file .zscripts/check-frontend-architecture.ts --baseline-ref 25b44535c5068b99044afa03f7ecf318e7a9726f` (`77 arquivos; 6 ocorrências em 6 identidades; 34 avisos; 0 erros`), `./node_modules/.bin/tsc --noEmit` (`0` erros), `./node_modules/.bin/eslint .` (`0` erros), `bun --no-env-file test` (`388 pass, 41 skip [opt-ins SQLite], 0 fail`, `2664 expect() calls`), e todos os 7 runners `.qa.mjs` aprovados nas 6 células em `systemd-run --user` + `bwrap` (`task-59.log`, `task-158.log`, `task-237.log`), Commit 1 `842223348705d087b2e6d9e3031a04a3d33237f4`.
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: verifier-3 (digest registrado em verify.md e evidence.json)
- Remaining gaps: Nenhum
