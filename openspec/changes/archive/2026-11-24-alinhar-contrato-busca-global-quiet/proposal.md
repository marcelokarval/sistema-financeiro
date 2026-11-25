## Why

O contrato visual em `docs/reference/design-system.contract.md#L24` afirma que ativar um resultado na busca global encaminha ao destino sem abrir automaticamente o registro. Na prática, `handleSearchSelect` em `src/app/page.tsx` preenche `selected*Id` na store e as views abrem ou expandem o registro correspondente, divergência mantida com `historicalAutoOpenDeviation: true` em `quiet-search-parity.qa.mjs` e registrada na Seção 5.1 de `docs/reference/frontend-componentization-coverage.md`. Além disso, `openspec/specs/interface-quiet-financial-os/spec.md` ainda não especifica o comportamento esperado ao selecionar um resultado da busca. Alinhar código, contrato, spec e testes agora elimina essa ambiguidade sob decisão explícita do responsável de produto.

## What Changes

**Contrato de seleção na Busca Global (`GlobalSearch` -> `handleSearchSelect`)**
- From: `docs/reference/design-system.contract.md#L24` proíbe autoabertura de registro na busca global, `openspec/specs/interface-quiet-financial-os/spec.md` omite esse cenário, e `src/app/page.tsx` executa abertura/expansão automática registrada como desvio histórico (`historicalAutoOpenDeviation: true` em `quiet-search-parity.qa.mjs`).
- To (Alternativa A — recomendada na proposta, sujeita à confirmação do responsável de produto antes do `apply`): Ratificar o atalho direto já implementado (`GlobalSearch -> setSelected*Id` quando o ID existir em Contas, Transações com `accountId` válido, Cartões, Compras, Investimentos, Parcelas e Consórcios, mantendo `Categorias` apenas como navegação, fallback seguro sem abertura para ID inexistente e retorno de foco no `Escape`), atualizando `docs/reference/design-system.contract.md#L24`, `openspec/specs/interface-quiet-financial-os/spec.md`, Seção 5.1 de `docs/reference/frontend-componentization-coverage.md` e removendo `historicalAutoOpenDeviation` de `src/components/finance/quiet-search-parity.qa.mjs`.
- To (Alternativa B — alternativa explícita caso o responsável de produto opte pelo texto literal atual): Restringir `handleSearchSelect` em `src/app/page.tsx` apenas a `setCurrentView(destination)` (sem `setSelected*Id`), preservando literalmente `docs/reference/design-system.contract.md#L24` e ajustando `src/components/finance/quiet-navigation.test.tsx`, `src/components/finance/quiet-search-parity.qa.mjs` e Seção 5.1 de `docs/reference/frontend-componentization-coverage.md`.
- Reason: Encerrar a divergência histórica documentada na Seção 5.1 de `frontend-componentization-coverage.md` com contrato único entre spec, referência visual, código e QA.
- Impact: Não altera APIs, schema Prisma ou cálculos financeiros; afeta somente o fluxo de seleção da Busca Global, seus testes, runner de QA e documentos normativos.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `interface-quiet-financial-os`: acrescentar o cenário normativo `Seleção de resultado na busca global` ao requisito `Paridade de navegação e ações` (com dependência explícita da escolha do responsável de produto entre Alternativa A e Alternativa B no `design.md`).

## Impact

- Código e testes: `src/app/page.tsx`, `src/components/finance/global-search.tsx` (contrato/referência), `src/components/finance/quiet-navigation.test.tsx`, `src/components/finance/quiet-search-parity.qa.mjs`.
- Documentação e specs: `docs/reference/design-system.contract.md#L24`, `docs/reference/frontend-componentization-coverage.md` (Seção 5.1) e `openspec/specs/interface-quiet-financial-os/spec.md` (via delta desta change).
- Fora de escopo: `BalanceProjection` (tratada em change própria), rotas `/api/**`, banco de dados, `src/components/ui/**` e novas features de busca.
