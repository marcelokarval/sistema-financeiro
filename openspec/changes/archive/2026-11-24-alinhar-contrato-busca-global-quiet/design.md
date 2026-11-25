## Context

A mudança `alinhar-contrato-busca-global-quiet` trata exclusivamente da divergência remanescente de **Busca Global** documentada na Seção 5.1 de `docs/reference/frontend-componentization-coverage.md`:

- **Contrato atual (`docs/reference/design-system.contract.md#L24`):** declara que "Na busca global, ativar um resultado encaminha ao destino correspondente, sem abrir automaticamente o registro; Escape devolve o foco ao controle de origem quando ele permanece disponível."
- **Implementação atual (`src/app/page.tsx#L164-L175`, `src/components/finance/global-search.tsx`, `src/lib/store.ts`):**
  - `searchDestination(type)` mapeia `transactions -> accounts`, `purchases -> purchases`, `accounts -> accounts`, `cards -> cards`, `categories -> categories`.
  - `handleSearchSelect(type, id, meta)` define os seletores da store (`setSelectedAccountId(id)`, `setSelectedAccountId(meta.accountId)` para transações, `setSelectedCardId(id)`, `setSelectedPurchaseId(id)`, além de `setSelectedInvestmentId(id)`, `setSelectedInstallmentPlanId(id)` e `setSelectedConsortiumId(id)` caso o destino corresponda a esses domínios) e chama `setCurrentView(destination)`.
  - Nas views consumidoras (`accounts-view.tsx`, `cards-view.tsx`, `purchases-view.tsx`, `investments-view.tsx`, `installments-view.tsx`, `consortiums-view.tsx`), quando o ID existe na coleção carregada, o detalhe é aberto (ou a linha é expandida em Compras) e a seleção na store é limpa; quando o ID não existe, a seleção na store é limpa sem abrir ou expandir outro registro.
  - Em `closeSearch` (`src/app/page.tsx#L144-L162`), ao fechar por `Escape` ou cancelamento, o foco volta para `searchOrigin.current` quando conectado e distinto de `document.body`, ou para `searchButton.current` (`Abrir busca global`).
- **QA e Spec:** `src/components/finance/quiet-search-parity.qa.mjs` marca os 4 cenários de autoabertura com `historicalAutoOpenDeviation: true` e imprime nota de desvio histórico sem ratificação contratual; `openspec/specs/interface-quiet-financial-os/spec.md` ainda não possui cenário específico para seleção de resultado na busca global.

## Goals / Non-Goals

**Goals:**
- Submeter ao responsável de produto, antes do `apply`, uma decisão binária clara entre **Alternativa A (Recomendada)** e **Alternativa B**.
- Eliminar a contradição entre `docs/reference/design-system.contract.md#L24`, `openspec/specs/interface-quiet-financial-os/spec.md`, `src/app/page.tsx`, `src/components/finance/quiet-navigation.test.tsx`, `src/components/finance/quiet-search-parity.qa.mjs` e a Seção 5.1 de `docs/reference/frontend-componentization-coverage.md`.
- Garantir cobertura automatizada (unitária e QA de paridade/navegação em 360/390/1440 × claro/escuro) para seleção válida, ID inexistente, `Categorias` e retorno de foco no `Escape`.

**Non-Goals:**
- Alterar `BalanceProjection` ou outras divergências pós-exclusão da Seção 5.2 de `docs/reference/frontend-componentization-coverage.md`.
- Expandir os tipos indexados em `GlobalSearch` (como adicionar endpoints de investimentos/parcelas/consórcios em `global-search.tsx`).
- Alterar rotas `/api/**`, schema Prisma, cálculos ou componentes `src/components/ui/**`.

## Decisions

### D1: Escolha de produto entre ratificação do atalho direto (Alternativa A) e navegação simples (Alternativa B)
- **Estado:** Resolvida com **Alternativa A** pelo responsável de produto antes da execução (`apply`), implementada e ratificada no Commit 1 (`842223348705d087b2e6d9e3031a04a3d33237f4`).
- **Alternativa A (Recomendada na proposta):**
  - **Comportamento:** Ratificar o atalho direto já existente (`GlobalSearch -> setSelected*Id` quando o ID existir em Contas, Transações com `accountId` válido, Cartões, Compras, Investimentos, Parcelas e Consórcios; `Categorias` apenas navega ao destino; ID inexistente não abre nem expande outro registro; `Escape` devolve foco à origem conectada não-`body` ou ao botão `Abrir busca global`).
  - **Arquivos afetados na aplicação:**
    - `docs/reference/design-system.contract.md#L24`: atualizar a cláusula da busca global para documentar a abertura/expansão direta quando o ID existir, o fallback seguro para ID inexistente e o retorno de foco no `Escape`.
    - `openspec/specs/interface-quiet-financial-os/spec.md`: aplicar o delta desta change com o cenário `Seleção de resultado na busca global`.
    - `src/components/finance/quiet-navigation.test.tsx`: acrescentar testes unitários explícitos cobrindo seleção com ID válido/inválido na store/contrato de `handleSearchSelect` e ausência de seleção em `categories`.
    - `src/components/finance/quiet-search-parity.qa.mjs`: remover `historicalAutoOpenDeviation: true` (linhas 287, 299, 311, 325) e a nota de desvio histórico (linhas 670-671), mantendo a verificação nas 6 células (`360/390/1440` × `light/dark`) com paridade total.
    - `docs/reference/frontend-componentization-coverage.md` (Seção 5.1): atualizar a linha de Busca Global de divergência histórica para contrato alinhado e verificado.
    - `src/app/page.tsx`: preservado (ou refatorado apenas se necessário para exportar helper testável de `handleSearchSelect` sem mudar comportamento).
  - **Motivo da recomendação:** O comportamento já opera de ponta a ponta com isolamento de ID inexistente validado em 6 células de navegador (`quiet-search-parity.qa.mjs`) e nos testes unitários das views (`quiet-accounts-cards.test.tsx`, `quiet-purchases-categories.test.tsx`, `quiet-investments-installments.test.tsx`, `quiet-consortiums-savings.test.tsx`), entregando melhor usabilidade sem quebrar a paridade com o baseline `55fa76d`.
- **Alternativa B (Alternativa explícita):**
  - **Comportamento:** Restringir `handleSearchSelect` em `src/app/page.tsx` apenas a `setCurrentView(destination)`, removendo todas as chamadas `setSelected*Id(...)` na seleção da busca global, preservando literalmente `docs/reference/design-system.contract.md#L24`.
  - **Arquivos afetados na aplicação:**
    - `src/app/page.tsx`: remover o bloco `if/else if` de `setSelected*Id` em `handleSearchSelect` (linhas 167-173), mantendo somente `const destination = searchDestination(type); if (!destination) return; setCurrentView(destination);`.
    - `src/components/finance/quiet-navigation.test.tsx`: validar que `handleSearchSelect` altera somente `currentView` e preserva `selected*Id` nulos.
    - `src/components/finance/quiet-search-parity.qa.mjs`: atualizar as expectativas de `busca-accounts-existente`, `busca-transactions-accountId-valido`, `busca-cards-existente` e `busca-purchases-existente` para `detailOpened: false` / `expanded: false`, remover `historicalAutoOpenDeviation` e ajustar a comparação contra o baseline histórico `55fa76d` (que possuía autoabertura).
    - `openspec/specs/interface-quiet-financial-os/spec.md` (se escolhida Alternativa B, atualizar o cenário da spec delta antes da sincronização para refletir `sem abrir automaticamente o registro`).
    - `docs/reference/frontend-componentization-coverage.md` (Seção 5.1): registrar o alinhamento do código ao contrato literal.

### D2: Invariantes compartilhados de segurança e foco
- **Escolha:** Manter inalterados nas duas alternativas:
  1. Fallback seguro de ID inexistente nas views consumidoras (nunca selecionar/abrir outro registro por engano);
  2. Retorno de foco de `closeSearch` (`searchOrigin.current` se `isConnected && origin !== document.body`, caso contrário `searchButton.current`);
  3. Bloqueio de `Ctrl/⌘+K` quando outro diálogo/sheet/menu já estiver aberto (`src/app/page.tsx#L104`).
- **Razão:** Esses invariantes já garantem acessibilidade por teclado e integridade de navegação em ambas as opções de produto.

### D3: Reconciliação obrigatória de documentação e QA
- **Escolha:** Nenhuma alternativa é considerada concluída enquanto `docs/reference/design-system.contract.md#L24`, `docs/reference/frontend-componentization-coverage.md` (Seção 5.1), `quiet-navigation.test.tsx`, `quiet-search-parity.qa.mjs` e o delta de `interface-quiet-financial-os` não refletirem exatamente a mesma regra aprovada.
- **Alternativa rejeitada:** Atualizar apenas `src/app/page.tsx` ou apenas `design-system.contract.md` sem limpar `historicalAutoOpenDeviation` e a Seção 5.1 — rejeitada porque perpetuaria contradição documental e de QA.

## Risks / Trade-offs

- **[Risk] Execução do `apply` antes da confirmação do responsável de produto** → **Mitigation:** A tarefa `1.1` do plano e as `Open Questions` bloqueiam qualquer edição em `src/`, `docs/` ou `openspec/specs/` até registro explícito da escolha (A ou B).
- **[Trade-off] Caso Alternativa B seja escolhida, a comparação direta contra o baseline histórico `55fa76d` em `quiet-search-parity.qa.mjs` deixa de ser idêntica nos 4 cenários de seleção** → **Aceite:** Na Alternativa B, a suíte de QA substitui a asserção de paridade cega nesses 4 cenários pela asserção explícita do contrato sem autoabertura, preservando a paridade nos outros 13 cenários de shell, navegação e foco.
- **[Risk] Se `handleSearchSelect` estiver acoplada internamente a `Page()` sem extração, testes unitários precisariam montar toda a árvore da página** → **Mitigation:** Se necessário na aplicação (Task 1.1), extrair função pura `applySearchSelection(...)` (ou helper equivalente) em `src/app/page.tsx` ou módulo auxiliar sem alterar assinatura pública de `GlobalSearch`.

## Migration Plan

N/A — Não há migração de banco, variáveis de ambiente ou alteração de API. A entrega consiste na atualização coordenada de contrato/spec, suíte de testes/QA e (se Alternativa B) ajuste em `handleSearchSelect`, verificados por `bun --no-env-file test`, `bun run typecheck`, `bun run lint` e `quiet-search-parity.qa.mjs` nas 6 células (`360/390/1440` × `light/dark`).

## Open Questions

- **Q1 (Resolvida — Alternativa A aprovada pelo responsável de produto):** Confirmada a **Alternativa A (ratificar atalho direto com fallback seguro)** pelo responsável de produto; `design-system.contract.md#L24`, `src/app/page.tsx`, `quiet-navigation.test.tsx`, `quiet-search-parity.qa.mjs` e `docs/reference/frontend-componentization-coverage.md` (Seção 5.1) foram alinhados a essa decisão (Commit 1 `842223348705d087b2e6d9e3031a04a3d33237f4`).
