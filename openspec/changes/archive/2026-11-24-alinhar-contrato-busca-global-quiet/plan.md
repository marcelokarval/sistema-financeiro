# Implementation plan

**Goal:** Alinhar o contrato da Busca Global entre `src/app/page.tsx`, `docs/reference/design-system.contract.md#L24`, `openspec/specs/interface-quiet-financial-os/spec.md`, `docs/reference/frontend-componentization-coverage.md` (Seção 5.1), `src/components/finance/quiet-navigation.test.tsx` e `src/components/finance/quiet-search-parity.qa.mjs` após confirmação da decisão de produto.
**Architecture:** Conforme `design.md` (D1–D3), o plano preserva os invariantes de segurança (fallback sem abertura para ID inexistente, retorno de foco no `Escape` e bloqueio de `Ctrl/⌘+K` sobre diálogos abertos) e condiciona a execução da Task 1.1 à escolha explícita do responsável de produto entre **Alternativa A (Recomendada)** e **Alternativa B**.
**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand (`src/lib/store.ts`), Bun test, ESLint, Playwright CLI (`quiet-search-parity.qa.mjs`).
**Spec:** `openspec/changes/alinhar-contrato-busca-global-quiet/specs/interface-quiet-financial-os/spec.md` e `openspec/changes/alinhar-contrato-busca-global-quiet/design.md`.
**Skill mapping and observed invocation:** `writing-plans` (`/home/marcelo-karval/.agents/skills/writing-plans/SKILL.md`), resolvida e lida integralmente antes da elaboração deste plano.

**Global Constraints:**
- Idioma pt-BR e moeda BRL; preservar os nove destinos da SPA e todos os contratos de `/api/**`, Prisma e `src/components/ui/**`.
- Nenhuma edição em código de produção, contrato visual ou spec pode iniciar antes da decisão explícita do responsável de produto entre Alternativa A e Alternativa B.
- Retorno de foco no `Escape` (`closeSearch`): retorna à origem conectada e distinta de `document.body`, ou ao botão `Abrir busca global`.
- ID inexistente em `accounts`, `transactions` (`meta.accountId`), `cards`, `purchases`, `investments`, `installments` ou `consortiums` MUST limpar a seleção na store sem abrir nem expandir outro registro.

**Review Focus:**
- Seleção de `transactions` com `meta.accountId` ausente ou inexistente na lista de contas carregada (não pode abrir nenhuma conta aleatória).
- Seleção de `accounts`, `cards` ou `purchases` com ID removido/fantasma entre a busca e a navegação (não pode abrir detalhe nem expandir outra compra).
- Seleção de `categories` (em ambas as alternativas, deve apenas navegar para `categories` sem selecionar registro).
- Fechamento via `Escape` com origem conectada, `document.body`, origem `null` e origem desconectada (deve restaurar foco conforme contrato).
- Coerência cruzada: `historicalAutoOpenDeviation` ausente em `quiet-search-parity.qa.mjs` e Seção 5.1 de `frontend-componentization-coverage.md` reconciliada sem tocar a linha de `BalanceProjection`.

## Task 1.1: Alinhar código, contrato e testes da Busca Global conforme decisão de produto

- Depends on: none

- Outcome: Comportamento de `handleSearchSelect` em `src/app/page.tsx`, cláusula de busca global em `docs/reference/design-system.contract.md#L24`, delta em `specs/interface-quiet-financial-os/spec.md`, testes focados em `src/components/finance/quiet-navigation.test.tsx` e cenários de `src/components/finance/quiet-search-parity.qa.mjs` totalmente alinhados à decisão aprovada pelo responsável de produto.
- Inputs and dependencies: Decisão explícita do responsável de produto (Q1 em `design.md`: **Alternativa A recomendada** ou **Alternativa B**); fontes lidas `src/app/page.tsx`, `src/components/finance/global-search.tsx`, `src/lib/store.ts`, `docs/reference/design-system.contract.md#L24` e `src/components/finance/quiet-search-parity.qa.mjs`. Sem dependência de outra task, porém bloqueada até resolução de Q1.
- Scope and decisions:
  - Arquivos no escopo: `src/app/page.tsx`, `docs/reference/design-system.contract.md`, `src/components/finance/quiet-navigation.test.tsx`, `src/components/finance/quiet-search-parity.qa.mjs` (e `specs/interface-quiet-financial-os/spec.md` somente se Q1 = Alternativa B).
  - Fora de escopo: `BalanceProjection`, rotas `/api/**`, schema Prisma, `src/components/ui/**` e inclusão de novos tipos em `global-search.tsx`.
  - Resolvedor da decisão aberta: **responsável de produto** antes do despacho desta tarefa.
- Expected acceptance evidence: Teste focado em `src/components/finance/quiet-navigation.test.tsx` falhando pelo motivo esperado antes da edição (RED) e passando após o alinhamento (GREEN), remoção completa de `historicalAutoOpenDeviation` em `src/components/finance/quiet-search-parity.qa.mjs` e coerência integral entre `src/app/page.tsx` e `docs/reference/design-system.contract.md#L24`.
- Passos planejados (TDD):
  1. Confirmar no registro da execução a decisão de Q1 (**Alternativa A** ou **Alternativa B**).
  2. Escrever teste unitário focado em `src/components/finance/quiet-navigation.test.tsx` cobrindo `handleSearchSelect` / helper extraído (`applySearchSelection`) e o contrato de `docs/reference/design-system.contract.md#L24`:
     - Na **Alternativa A**: verificar que `accounts`, `transactions` (com `meta.accountId`), `cards`, `purchases`, `investments`, `installments` e `consortiums` preenchem o respectivo `selected*Id` + `currentView`, que `categories` muda apenas `currentView`, que `design-system.contract.md` reflete a abertura/expansão direta com fallback para ID inexistente, e que `quiet-search-parity.qa.mjs` não possui mais `historicalAutoOpenDeviation`.
     - Na **Alternativa B**: verificar que `handleSearchSelect` altera apenas `currentView` e mantém todos os `selected*Id` em `null`, além de preservar a frase literal em `design-system.contract.md#L24` e remover `historicalAutoOpenDeviation` de `quiet-search-parity.qa.mjs`.
  3. Executar RED: `bun --no-env-file test src/components/finance/quiet-navigation.test.tsx` e confirmar falha na asserção contratual esperada antes de aplicar a correção.
  4. Aplicar a implementação mínima conforme Q1:
     - Se **Alternativa A**: atualizar `docs/reference/design-system.contract.md#L24` (documentando encaminhamento ao destino, abertura/expansão quando o ID existir, fallback seguro para ID inexistente e retorno de foco no `Escape`); remover `historicalAutoOpenDeviation` (linhas 287, 299, 311, 325 e 670-671) em `src/components/finance/quiet-search-parity.qa.mjs`; se necessário para teste unitário puro sem montar toda a página, extrair `applySearchSelection` em `src/app/page.tsx` mantendo comportamento idêntico.
     - Se **Alternativa B**: simplificar `handleSearchSelect` em `src/app/page.tsx` para chamar apenas `setCurrentView(destination)`; atualizar o cenário em `specs/interface-quiet-financial-os/spec.md` para navegação sem autoabertura; ajustar os 4 cenários em `src/components/finance/quiet-search-parity.qa.mjs` para `detailOpened: false` / `expanded: false`, removendo `historicalAutoOpenDeviation` e a comparação literal contra autoabertura do baseline `55fa76d`.
  5. Executar GREEN: `bun --no-env-file test src/components/finance/quiet-navigation.test.tsx` e confirmar aprovação total.
- RED command and observed failure: `bun --no-env-file test src/components/finance/quiet-navigation.test.tsx` -> saída `1` (`8 pass`, `3` reprovações: `applySearchSelection` indefinido em `src/app/page.tsx`, frase `"sem abrir automaticamente o registro"` ainda presente em `docs/reference/design-system.contract.md#L24`, e `historicalAutoOpenDeviation` ainda presente em `src/components/finance/quiet-search-parity.qa.mjs`).
- GREEN command and observed result: `bun --no-env-file test src/components/finance/quiet-navigation.test.tsx` -> saída `0` (`11 pass`, `0` reprovações, `69 expect() calls`); com `src/lib/store.test.ts` -> saída `0` (`25 pass`, `0` reprovações, `125 expect() calls`).
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: verifier-3 (digest registrado em verify.md e evidence.json)
- Remaining gaps: Nenhum

## Task 1.2: Validar regressão completa e reconciliar a Seção 5.1 da cobertura

- Depends on: 1.1

- Outcome: Suíte completa de testes, checagem de tipos, lint e runner de navegador `quiet-search-parity.qa.mjs` aprovados nas 6 células (`360/390/1440` × `light/dark`) com Seção 5.1 de `docs/reference/frontend-componentization-coverage.md` reconciliada para Busca Global.
- Inputs and dependencies: Depende integralmente da conclusão validada da Task 1.1 (`src/app/page.tsx`, `docs/reference/design-system.contract.md`, `src/components/finance/quiet-navigation.test.tsx`, `src/components/finance/quiet-search-parity.qa.mjs`).
- Scope and decisions:
  - Arquivos modificados nesta task: `docs/reference/frontend-componentization-coverage.md` (exclusivamente a linha **Busca Global** na Seção 5.1, preservando a linha **Projeção de Saldo** intacta) e eventual asserção de consistência em `src/components/finance/quiet-navigation.test.tsx`.
  - Proibido editar código de `BalanceProjection` ou mascarar falhas de `quiet-search-parity.qa.mjs`.
- Expected acceptance evidence: Saída aprovada de `bun --no-env-file test`, `bun run typecheck`, `bun run lint`, execução completa de `src/components/finance/quiet-search-parity.qa.mjs` nas 6 células (17 cenários por célula, 102 cenários no total, 0 skips), `bridge_guard.py candidate`, revisão independente registrada em `verify.md` e `bridge_guard.py verify`.
- Passos planejados (TDD e verificação):
  1. Adicionar ou executar verificação de consistência em `src/components/finance/quiet-navigation.test.tsx` garantindo que a linha **Busca Global** em `docs/reference/frontend-componentization-coverage.md` (Seção 5.1) não mantenha mais o status de desvio histórico não ratificado (`historicalAutoOpenDeviation` / `Não afirma conformidade Quiet`).
  2. Executar RED: `bun --no-env-file test src/components/finance/quiet-navigation.test.tsx` e registrar a falha esperada antes de atualizar `docs/reference/frontend-componentization-coverage.md`.
  3. Executar GREEN: atualizar a linha **Busca Global** na Seção 5.1 de `docs/reference/frontend-componentization-coverage.md` para refletir o contrato alinhado conforme Q1 (Alternativa A ou Alternativa B) e as evidências observadas, mantendo intacta a linha **Projeção de Saldo**.
  4. Executar verificação completa no mesmo candidato:
     - `bun --no-env-file test`
     - `bun run typecheck`
     - `bun run lint`
     - `quiet-search-parity.qa.mjs` em sandbox isolado aprovado (6 células: 360/390/1440 × light/dark)
     - `python3 -B /home/marcelo-karval/.local/share/openspec/schemas/superpowers-bridge/scripts/bridge_guard.py candidate --repo /home/marcelo-karval/Backup/Projetos/nextjs/sistema-financeiro --base 80f1f406443f235f4659aad2ff0ded8f20f3c6bc --change openspec/changes/alinhar-contrato-busca-global-quiet`
     - Revisão independente, registro em `verify.md` / `evidence.json` e `bridge_guard.py verify`.
- RED command and observed failure: `bun --no-env-file test src/components/finance/quiet-navigation.test.tsx` -> saída `1` (`11 pass`, `1` reprovação na linha 342: Seção 5.1 de `docs/reference/frontend-componentization-coverage.md` ainda registrava `historicalAutoOpenDeviation` / `Não afirma conformidade Quiet`).
- GREEN command and observed result: `bun --no-env-file test src/components/finance/quiet-navigation.test.tsx` (`12 pass`, `0` reprovações, `75 expect() calls`), `bun --no-env-file test` (`388 pass, 41 skip, 0 fail`, `2664 expect() calls`), `./node_modules/.bin/tsc --noEmit` (`0` erros), `./node_modules/.bin/eslint .` (`0` erros), `quiet-search-parity.qa.mjs` nas 6 células (`102 cenários pareados; 0 skips`, `cellParity: true`, `task-158.log`), Commit 1 `842223348705d087b2e6d9e3031a04a3d33237f4`.
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: verifier-3 (digest registrado em verify.md e evidence.json)
- Remaining gaps: Nenhum
