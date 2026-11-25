## Why

Quatro widgets de análise financeira ainda aceitam respostas atrasadas entre períodos, a Busca Global indexa apenas cinco dos oito domínios previstos na Alternativa A e exibe transferências como despesas, e cinco fluxos HTTP mascaram falhas não-JSON ou mantêm dados obsoletos em erro. Corrigir essas lacunas nesta Onda 1 Frontend garante consistência de dados, previsibilidade de erro e conformidade integral com a spec Quiet.

## What Changes

**Concorrência assíncrona e descarte de estado obsoleto em widgets**
- From: `networth-evolution.tsx`, `financial-calendar.tsx`, `transaction-analytics.tsx` e `spending-timeline.tsx` disparam `fetch` sem `AbortController` nem identidade de requisição e preservam `data` antigo quando `!res.ok` ou `catch` ocorre.
- To: Todos os quatro widgets seguem o padrão de `balance-projection.tsx` (`AbortController` + identidade de requisição + estado explícito de carregamento/erro que descarta respostas/erros anteriores e limpa dados antigos em falha).
- Impact: Non-breaking para APIs e contratos `*Content`; adiciona funções puras exportadas testáveis para cada widget.

**Busca Global conforme Alternativa A (`global-search.tsx` e `global-search-result.tsx`)**
- From: `GlobalSearch` indexa apenas 5 endpoints, não possui `AbortController` em `fetchAll()`, não mapeia `investments`, `installments` nem `consortiums` em `searchDestinations`/`searchGroupMeta`, e renderiza `type === 'TRANSFER'` com ícone vermelho de despesa e sinal negativo.
- To: Indexar também `/api/investments`, `/api/installments` e `/api/consortiums`, mapear os 8 domínios em `searchDestinations` e `searchGroupMeta`, adicionar `AbortController` em `fetchAll()` e exibir `type === 'TRANSFER'` com sinal e estilo neutros.
- Impact: Non-breaking; alinha implementação em `global-search.tsx` com `src/app/page.tsx:61-63` e `openspec/specs/interface-quiet-financial-os/spec.md`.

**Resiliência HTTP pontual em mutações e leituras restantes**
- From: `monthly-budget-tracker.tsx` (`handleDelete`) e `accounts-view.tsx` (`saveTransfer`) usam `res.json()` sem fallback; `debt-overview.tsx` e `financial-reports.tsx` mantêm `data` antigo em falha subsequente; `investments-view.tsx` (`fetchDividends`) silencia `!res.ok` e exibe `R$ 0,00`.
- To: Parse resiliente `.json().catch(() => ({}))` em `handleDelete` e `saveTransfer`, limpeza de `data` com sinalização de erro em `debt-overview.tsx` e `financial-reports.tsx`, e estado explícito de erro para dividendos em `investments-view.tsx` sem exibir zero fictício.
- Impact: Non-breaking; sem alterações de backend, schema ou baseline AST.

## Capabilities

### New Capabilities

### Modified Capabilities

- `interface-quiet-financial-os`: exigir descarte de respostas/erros obsoletos em `networth-evolution`, `financial-calendar`, `transaction-analytics` e `spending-timeline`, indexação dos oito domínios e tratamento neutro de `TRANSFER` na Busca Global com `AbortController`, e resiliência HTTP nos fluxos de exclusão de orçamento, transferência entre contas, retry de dívidas/relatórios e falha de dividendos em investimentos.

## Impact

- Código frontend modificado apenas em componentes sob `src/components/finance/` e seus testes em `src/components/finance/*.test.tsx` (além da fixture de `quiet-search-parity.qa.mjs`).
- Sem alterações em rotas `/api/**`, schema Prisma, `db/custom.db`, `.zscripts/frontend-architecture-baseline.json` ou nos 18 widgets de `details`/`showValues`.
