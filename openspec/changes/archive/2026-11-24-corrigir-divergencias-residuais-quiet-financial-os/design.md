## Context

Após a conclusão de `formalizar-componentizacao-extrema-frontend` no commit base `80f1f406443f235f4659aad2ff0ded8f20f3c6bc`, quatro divergências residuais frente ao contrato `Quiet Financial OS` permaneceram abertas e documentadas em `docs/reference/frontend-componentization-coverage.md` (Seção 5), deliberadamente isoladas da decisão de produto sobre a Busca Global (`alinhar-contrato-busca-global-quiet`).

Restrições invariantes:
- Manter intactas todas as rotas `/api/*`, `prisma/schema.prisma`, `src/components/ui/*`, `src/app/globals.css` e os tokens `--ds-*`.
- Não alterar `global-search.tsx` nem o contrato da Busca Global.
- Preservar integralmente a semântica do gate AST (`check-frontend-architecture.ts`) e suas 6 identidades aprovadas em `.zscripts/frontend-architecture-baseline.json` (incluindo `MonthSelector` em `balance-projection.tsx`).
- Provar todas as correções via TDD (`RED -> GREEN -> REFACTOR`), suíte `bun --no-env-file test`, `typecheck`, `lint`, gate AST e runners Playwright `.qa.mjs` nas 6 células (`360/390/1440 × light/dark`).

## Goals / Non-Goals

**Goals:**
- Eliminar corrida assíncrona de `selectedMonths` em `balance-projection.tsx` para respostas tardias de sucesso ou erro.
- Reter `MonthlyBudgetEditor`, o rascunho digitado e zero `refreshBudgets()` em respostas HTTP não OK de `monthly-budget-tracker.tsx`.
- Garantir foco conectado em controle sobrevivente após `DELETE` + `GET` tardio em `accounts-view.tsx`, `cards-view.tsx`, `consortiums-view.tsx` (lista) e `savings-view.tsx`, removendo essas entradas de `preexistingQuietDivergences` nos runners `.qa.mjs`.
- Reconciliar a Seção 5 de `docs/reference/frontend-componentization-coverage.md` com as evidências obtidas.

**Non-Goals:**
- Alterar o comportamento ou contrato de `global-search.tsx` e da navegação da Busca Global.
- Alterar contratos de API backend, payload de endpoints ou persistência SQLite.
- Extrair ou alterar layout visual dos componentes além dos fluxos de estado, foco e tratamento de resposta especificados.

## Decisions

### D1: Guarda de período com `AbortController` e objeto de requisição em `balance-projection.tsx`
- **Escolha:** Introduzir `BalanceProjectionRequest = { months: number }`, `BalanceProjectionResult`, `requestBalanceProjection(request, signal, publish, fetcher)` e `currentBalanceProjection(request, settled)` (modelo idêntico ao de `src/components/finance/expense-breakdown.tsx`). `BalanceProjection` passa a armazenar `request` e `settled`, cancelando a requisição anterior via `AbortController` no cleanup do `useEffect` e ignorando publicações se `signal.aborted` for verdadeiro; `onRetry` cria um novo objeto `{ months: request.months }` para iniciar nova consulta mesmo mantendo o mesmo horizonte.
- **Motivo:** Resolve simultaneamente duas falhas: a limpeza imediata para estado `loading` durante a transição e a rejeição determinística de respostas/erros tardios de períodos anteriores sem depender de ref mutável ad hoc, mantendo a superfície exportada testável em `quiet-analysis-calendar.test.tsx`. Preserva `MonthSelector` e seu `className` exatamente iguais para não perturbar o hash AST baselineado (`87145e91...`).
- **Alternativa considerada:** Contador numérico `latestRequestRef` sem `AbortController` nem estado derivado. Rejeitada por não abortar conexões obsoletas nem permitir transição síncrona atômica entre `request` e `settled`.

### D2: Retorno antecipado com parse seguro de erro HTTP em `monthly-budget-tracker.tsx`
- **Escolha:** Em `handleSubmit` (`POST` e `PUT`), substituir o bloco `if (res.ok) ... else ...` seguido de `setDialogOpen(false); refreshBudgets();` por guarda explícita de `!res.ok`:
  `if (!res.ok) { const data = await res.json().catch(() => ({})); toast.error(data?.error || (editingBudget ? 'Erro ao atualizar' : 'Erro ao criar')); return; }`
  Somente no caminho `res.ok` executar `toast.success(...)`, `setDialogOpen(false)` e `refreshBudgets()`. No `catch` (falha de transporte), manter `toast.error('Erro de conexão')` sem fechar o diálogo nem chamar `refreshBudgets()`.
- **Motivo:** Alinha integralmente `monthly-budget-tracker.tsx` à política já adotada por `budget-goals.tsx` e `accounts-view.tsx`, tratando também HTTP não OK sem corpo JSON (ex.: `503` texto plano) como erro HTTP sem perder o rascunho nem disparar `GET /api/monthly-budgets`.
- **Alternativa considerada:** Manter `await res.json()` sem `.catch()` antes do `return`. Rejeitada porque faria HTTP `503` não-JSON cair no `catch` exibindo `"Erro de conexão"` em vez da mensagem HTTP apropriada.

### D3: Limpeza de `dialogReturn` / `dialogOrigin` pós-`DELETE` `2xx` em Contas, Cartões e Consórcios
- **Escolha:** Em `accounts-view.tsx` (`deleteAccount`), `cards-view.tsx` (`deleteCard`) e `consortiums-view.tsx` (`confirmDelete`), após confirmar `res.ok` e antes de chamar `setShowDeleteDialog(null)`, limpar a referência do acionador da linha (`dialogReturn.current = null` em Contas/Cartões; `dialogOrigin.current = null` em Consórcios). Assim, `restoreDialogFocus` no fechamento do `AlertDialog` promove diretamente o foco ao controle sobrevivente da superfície (`newAccountButton.current` em Contas, `newCardButton.current` em Cartões e `document.getElementById('consortium-detail-title') ?? document.getElementById('consortium-create')` em Consórcios). Em cancelamento (`Escape`/`Cancelar`) ou falha de `DELETE`, a referência permanece intacta e devolve o foco ao acionador original.
- **Motivo:** Reaproveita o mesmo padrão já comprovado em `investments-view.tsx` (`prepareDeleteFocus()`) e `recurring-transactions.tsx` (`returnFocus.current = null`), evitando foco transitório em um botão de linha condenado a ser desmontado quando o `GET` tardio resolver.
- **Alternativa considerada:** Devolver foco à linha no fechamento e movê-lo apenas depois que o `GET` tardio removesse o item via `useEffect`. Descartada para esses 3 módulos porque neles o `DELETE` já foi confirmado antes de fechar o diálogo; manter foco momentâneo em elemento prestes a desmontar cria janela desnecessária de perda de foco entre o commit do `GET` e o efeito posterior.

### D4: Restauração pós-remoção em Caixinhas (`savings-view.tsx`) mantendo fechamento Radix
- **Escolha:** Preservar `AlertDialogAction` sem `event.preventDefault()` em `savings-view.tsx` (mantendo intactos os fluxos `caixinhas/exclusao/early` e `caixinhas/exclusao/falha-delete`) e introduzir `pendingDeletionFocus = useRef(new Set<string>())` + `restoreSavingsFocusAfterDeletion(...)` acionado em `useEffect` sobre `goals`:
  - Em `handleDeleteGoal(id)`, quando `res.ok` confirma a exclusão, adicionar `id` a `pendingDeletionFocus.current` antes de `fetchGoals()`.
  - No `useEffect([goals])`, após a lista atualizada remover `id` do DOM, verificar via função pura exportada `restoreSavingsFocusAfterDeletion(deletedId, goals, activeElement, body, fallback)` se `!goals.some((g) => g.id === id)`. Se `activeElement === body` (ou `!activeElement?.isConnected`), focar o botão `#savings-create` (`createButton.current`); se o usuário já moveu o foco para outro controle conectado, não roubar foco e remover `id` de `pendingDeletionFocus.current`.
- **Motivo:** Espelha o padrão já aprovado em `budget-goals.tsx` (`restoreBudgetGoalFocusAfterDeletion`), atendendo simultaneamente `caixinhas/exclusao/late` (onde o diálogo já fechou durante o `DELETE` em voo e devolveu foco ao item antes da remoção) e `caixinhas/exclusao/falha-delete` (onde falha do `DELETE` preserva foco no acionador da linha). Nota de implementação: executar a checagem diretamente no `useEffect([goals])` após o commit de remoção (sem atrasar com `requestAnimationFrame` adicional ou usando verificação síncrona pós-commit), para que o foco seja restaurado imediatamente após a desmontagem da linha sem corrida com leitores ou testes.
- **Alternativa considerada:** Adicionar `event.preventDefault()` em `AlertDialogAction` para segurar o diálogo até `DELETE` `2xx`. Rejeitada porque quebraria o comportamento esperado e testado de `caixinhas/exclusao/falha-delete` e `caixinhas/exclusao/early`.

### D5: Reconciliação dos runners `.qa.mjs` contra baselines históricos congelados
- **Escolha:** Os runners `quiet-goals-widgets.qa.mjs`, `quiet-keyed-deletion-focus.qa.mjs`, `quiet-cards-purchases-categories.qa.mjs`, `quiet-consortiums-editor.qa.mjs` e `quiet-installments-savings-dialogs.qa.mjs` comparam o código candidato com commits anteriores congelados (`baseRef`). Como essas 4 correções resolvem divergências que existiam no próprio `baseRef`, os runners serão atualizados apenas nos cenários agora corrigidos para: (a) verificar o comportamento Quiet-compliant no `candidate`, (b) remover as listas/filtros `preexistingQuietDivergences` correspondentes, e (c) continuar exigindo `Bun.deepEquals` estrito contra o `baseline` em todos os demais cenários não relacionados.
- **Motivo:** Preserva a utilidade da regressão pareada contra o baseline nos demais fluxos enquanto permite atestar 0 divergências abertas nos fluxos remediados.

## Risks / Trade-offs

- [Risk] Alterar `balance-projection.tsx` pode afetar a identidade AST `MonthSelector` (`87145e91...`) em `.zscripts/frontend-architecture-baseline.json` → Mitigation: Não modificar JSX nem `className` de `MonthSelector`; rodar `bun run .zscripts/check-frontend-architecture.ts --baseline-ref 25b44535c5068b99044afa03f7ecf318e7a9726f` na verificação final (`Task 3.1`).
- [Risk] Em `savings-view.tsx`, um `useEffect([goals])` disparado na montagem inicial ou antes da resolução do `GET` pode consumir `pendingDeletionFocus` cedo demais → Mitigation: Só marcar `pendingDeletionFocus.current.add(id)` quando `DELETE` retorna `res.ok` e só remover/restaurar quando `!goals.some((g) => g.id === id)`, ignorando execuções enquanto `id` ainda está presente na lista.
- [Trade-off] Atualizar asserções de paridade pontuais nos runners `.qa.mjs` para os cenários remediados → Aceito porque o `baseRef` histórico congelado contém o defeito original e não pode ser alterado retroativamente.

## Migration Plan

1. Executar em paralelo (escopos disjuntos de arquivos) as correções `1.1` (`balance-projection`), `1.2` (`monthly-budget-tracker`), `2.1` (`accounts-view` + `cards-view`) e `2.2` (`consortiums-view` + `savings-view`) seguindo estritamente TDD (`RED -> GREEN -> REFACTOR`).
2. Na `Task 3.1` (após `1.1`, `1.2`, `2.1` e `2.2`), atualizar a Seção 5 de `docs/reference/frontend-componentization-coverage.md` e executar a validação integrada: `check-frontend-architecture.ts`, `typecheck`, `lint`, `bun --no-env-file test` e todos os runners `.qa.mjs` afetados nas 6 células (`360/390/1440 × light/dark`).
3. Rollback: todas as alterações são restritas ao frontend/testes/documentação e podem ser revertidas integralmente por `git checkout` / `git revert` sem migração de banco ou API.

## Open Questions

- Nenhuma decisão material em aberto; o alinhamento da Busca Global permanece isolado na change `alinhar-contrato-busca-global-quiet`, e a Seção 5.1 de `frontend-componentization-coverage.md` manterá o status da Busca Global inalterado caso aquela change ainda não tenha sido aplicada.
