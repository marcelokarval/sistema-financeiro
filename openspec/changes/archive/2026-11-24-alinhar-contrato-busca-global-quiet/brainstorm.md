# Brainstorm: Alinhamento do Contrato da Busca Global no Quiet Financial OS

- **Skill resolvida e invocada:** `brainstorming` (`/home/marcelo-karval/.agents/skills/brainstorming/SKILL.md`), lida integralmente antes da redação deste artefato.
- **Change:** `alinhar-contrato-busca-global-quiet` (`--schema superpowers-bridge` v2)
- **Escopo:** Somente planejamento e definição de decisão de produto; nenhuma alteração em código de produção neste ciclo.

---

## 1. Contexto e Problema Observado no Repositório

Durante a consolidação da interface Quiet Financial OS (`recriar-interface-quiet-financial-os` / `formalizar-componentizacao-extrema-frontend`), foi registrada uma divergência histórica entre o contrato visual escrito e o comportamento real implementado na busca global (`Ctrl/⌘+K`):

1. **Contrato visual vigente (`docs/reference/design-system.contract.md#L24`):**
   Afirma literalmente:
   > "Na busca global, ativar um resultado encaminha ao destino correspondente, sem abrir automaticamente o registro; Escape devolve o foco ao controle de origem quando ele permanece disponível."
2. **Comportamento real implementado (`src/app/page.tsx#L164-L175`, `src/components/finance/global-search.tsx`, `src/lib/store.ts`):**
   - `GlobalSearch` consulta `/api/transactions`, `/api/purchases`, `/api/accounts`, `/api/cards` e `/api/categories` (mapeados por `searchDestinations` para `accounts`, `purchases`, `cards` e `categories`).
   - Ao ativar um resultado (Enter ou clique), `handleSearchSelect(type, id, meta)` em `src/app/page.tsx` calcula `destination = searchDestination(type)` e popula os seletores no Zustand (`useAppStore`):
     - `accounts` -> `setSelectedAccountId(id)` (`AccountsView` abre o detalhe da conta se existir na lista);
     - `transactions` com `meta?.accountId` -> `setSelectedAccountId(meta.accountId)` (`AccountsView` abre o detalhe da conta vinculada se existir);
     - `cards` -> `setSelectedCardId(id)` (`CardsView` abre o detalhe do cartão se existir);
     - `purchases` -> `setSelectedPurchaseId(id)` (`PurchasesView` expande a linha da compra via `setExpandedId` se existir);
     - `categories` -> apenas `setCurrentView('categories')` (não há seleção automática de categoria);
     - `investments`, `installments`, `consortiums` -> `handleSearchSelect` também prevê `setSelectedInvestmentId(id)`, `setSelectedInstallmentPlanId(id)` e `setSelectedConsortiumId(id)` quando `destination` corresponder a um desses destinos, e as respectivas views (`InvestmentsView`, `InstallmentsView`, `ConsortiumsView`) consomem e limpam o ID na store quando presente.
   - **Fallback para ID inexistente:** Em todos os consumidores (`accounts-view.tsx`, `cards-view.tsx`, `purchases-view.tsx`, `investments-view.tsx`, `installments-view.tsx`, `consortiums-view.tsx`), se o ID informado não existir na coleção carregada, a seleção na store é limpa (`setSelected*Id(null)`) sem abrir nem expandir outro registro.
   - **Retorno de foco no `Escape` (`closeSearch` em `src/app/page.tsx#L144-L162`):** Ao fechar a busca sem seleção ou por `Escape`, o foco retorna a `searchOrigin.current` se estiver conectado e não for `document.body`; caso contrário, recai sobre o botão `Abrir busca global` (`searchButton.current`).
3. **Evidência documental e de QA existente:**
   - `docs/reference/frontend-componentization-coverage.md` (Seção 5.1) registra explicitamente que a autoabertura da Busca Global mantém paridade 100% com o baseline histórico (`eb76f7d` / `55fa76d`), marcada com `historicalAutoOpenDeviation: true` em `src/components/finance/quiet-search-parity.qa.mjs#L283-L327,L670-L671`, sem afirmação de conformidade Quiet até decisão explícita do responsável de produto.
   - `openspec/specs/interface-quiet-financial-os/spec.md` (`### Requirement: Paridade de navegação e ações`) possui hoje 5 cenários (`Ação de lançamento`, `Assistente sob demanda`, `Uso por teclado`, `Editar Caixinha com opcionais vazios`, `Gravar dados da assembleia`), sem cenário normativo específico para seleção de resultado na busca global.

---

## 2. Questão de Produto em Aberto (Decisão Obrigatória Antes do `apply`)

O comportamento atual (navegar + pré-selecionar/abrir o registro encontrado) diverge da frase "sem abrir automaticamente o registro" em `docs/reference/design-system.contract.md#L24`. Como essa diferença altera contrato normativo vs. comportamento observável pelo usuário final, a escolha cabe ao **responsável de produto** antes de iniciar a implementação (`openspec apply`):

### Alternativa A (Recomendada na proposta) — Ratificar o atalho direto com fallback seguro

- **Descrição:** Reconhecer como comportamento oficial Quiet o atalho direto já implementado (`GlobalSearch -> handleSearchSelect -> setSelected*Id` quando o ID existir para Contas, Transações com `accountId` válido, Cartões, Compras, Investimentos, Parcelas e Consórcios; `Categorias` apenas navega ao destino; ID inexistente não abre nem expande outro registro; `Escape` devolve foco à origem conectada não-`body` ou ao botão `Abrir busca global`).
- **Impacto nos artefatos e código:**
  - `docs/reference/design-system.contract.md#L24`: atualizar a sentença da busca global para especificar o encaminhamento ao destino com abertura/expansão do registro quando o ID existir, fallback seguro para ID ausente e retorno de foco no `Escape`.
  - `openspec/specs/interface-quiet-financial-os/spec.md`: incorporar o cenário `Seleção de resultado na busca global` ao requisito `Paridade de navegação e ações`.
  - `docs/reference/frontend-componentization-coverage.md` (Seção 5.1): reconciliar o status de Busca Global de divergência histórica para contrato ratificado e validado.
  - `src/components/finance/quiet-search-parity.qa.mjs`: remover a flag/nota `historicalAutoOpenDeviation` (linhas 287, 299, 311, 325 e 670-671), mantendo as verificações de paridade nas 6 células (`360/390/1440` × `light/dark`).
  - `src/components/finance/quiet-navigation.test.tsx`: adicionar testes unitários cobrindo seleção com ID válido/inválido e ausência de efeito colateral em Categorias (e comportamento de `handleSearchSelect` / `searchDestination`).
  - `src/app/page.tsx`: nenhuma mudança de fluxo necessária além de eventual validação/consistência se coberto por teste de contrato.
- **Prós:** Preserva a UX mais útil de busca global (1 clique/Enter leva direto ao registro), mantém 100% de compatibilidade com a suíte e o baseline histórico (`55fa76d`) e elimina a dívida documental sem regressão de funcionalidade.
- **Contras / Riscos:** Requer atualização formal do contrato visual (`design-system.contract.md#L24`) e da spec principal (`openspec/specs/interface-quiet-financial-os/spec.md`) na aplicação.

### Alternativa B — Restringir a busca global à navegação simples (sem autoabertura)

- **Descrição:** Alterar `handleSearchSelect` em `src/app/page.tsx` para executar exclusivamente `setCurrentView(destination)`, removendo todas as chamadas `setSelected*Id(...)` originadas da busca global, preservando literalmente `docs/reference/design-system.contract.md#L24` ("sem abrir automaticamente o registro").
- **Impacto nos artefatos e código:**
  - `src/app/page.tsx`: remover o despacho de `setSelectedAccountId`, `setSelectedCardId`, `setSelectedPurchaseId`, `setSelectedInvestmentId`, `setSelectedInstallmentPlanId` e `setSelectedConsortiumId` em `handleSearchSelect`.
  - `src/components/finance/quiet-navigation.test.tsx`: validar que `handleSearchSelect` apenas altera `currentView` e mantém todos os `selected*Id` da store em `null`.
  - `src/components/finance/quiet-search-parity.qa.mjs`: atualizar os cenários de busca (`busca-accounts-existente`, `busca-transactions-accountId-valido`, `busca-cards-existente`, `busca-purchases-existente`) para esperar `detailOpened: false` / `expanded: false`, remover `historicalAutoOpenDeviation` e ajustar a comparação contra o baseline histórico `55fa76d` (que abria o detalhe, portanto deixa de ter paridade literal nesses 4 cenários).
  - `docs/reference/frontend-componentization-coverage.md` (Seção 5.1): registrar que o código foi alinhado ao contrato literal, encerrando a divergência histórica.
- **Prós:** Preserva palavra por palavra a redação original de `design-system.contract.md#L24`.
- **Contras / Riscos:** Reduz a conveniência da busca global (usuário precisa localizar o item manualmente após navegar), quebra a paridade histórica com `55fa76d` nos 4 cenários de seleção e obriga redefinir a comparação do runner `quiet-search-parity.qa.mjs`.

---

## 3. Critérios de Decisão e Limites Técnicos

1. Independentemente da alternativa escolhida pelo responsável de produto, ficam preservados os invariantes:
   - Os 9 destinos da SPA e o mapeamento atual de `searchDestination` (`transactions -> accounts`, `purchases -> purchases`, `accounts -> accounts`, `cards -> cards`, `categories -> categories`);
   - Isolamento de ID inexistente (nenhum registro aleatório ou incorreto pode ser aberto/expandido);
   - Retorno de foco no `Escape` (`searchOrigin` conectado e distinto de `document.body`, ou fallback `Abrir busca global`);
   - Proibição de regressão nos 17 cenários por célula de `quiet-search-parity.qa.mjs` (`360/390/1440` × `light/dark`).
2. O escopo desta change não altera `BalanceProjection` (tratada em change separada) nem realiza edições em `src/` antes da confirmação da decisão pelo responsável de produto.
