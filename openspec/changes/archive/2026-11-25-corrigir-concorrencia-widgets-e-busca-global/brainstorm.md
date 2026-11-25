# Brainstorm — Corrigir concorrência assíncrona em widgets, Busca Global (Alternativa A) e resiliência HTTP

## Leituras obrigatórias e mapeamento de skills

- Política global lida via `read_file`: `/home/marcelo-karval/.agents/AGENTS.md`.
- Contrato do schema lido via `read_file`: `/home/marcelo-karval/.local/share/openspec/schemas/superpowers-bridge/README.md` (`superpowers-bridge` v2 em `/home/marcelo-karval/.local/share/openspec/schemas/superpowers-bridge`).
- Skill `brainstorming` resolvida e lida via `read_file`: `/home/marcelo-karval/.agents/skills/brainstorming/SKILL.md`.
- Skill `writing-plans` resolvida e lida via `read_file`: `/home/marcelo-karval/.agents/skills/writing-plans/SKILL.md`.
- Spec canônica lida via `read_file`: `openspec/specs/interface-quiet-financial-os/spec.md`.

## Contexto observado no código atual (reconhecimento)

1. **Padrão de referência em concorrência (`balance-projection.tsx` e `expense-breakdown.tsx`):**
   - `src/components/finance/balance-projection.tsx:161-206` modela a consulta com um objeto de requisição novo por seleção/retry (`{ months }`), compara identidade de objeto (`settled?.request === request`), passa `AbortController.signal` ao `fetch` e só publica `setSettled` quando `!signal.aborted`. Dessa forma, troca de período ou retry limpa imediatamente os dados antigos (`status === 'loading'`) e descarta respostas/erros tardios de requisições anteriores.
   - Em contraste, quatro widgets ainda usam `useCallback` sem `AbortController` nem identidade de requisição e mantêm `data` antigo quando `!res.ok` ou `catch` ocorre:
     - `src/components/finance/networth-evolution.tsx:91-122` (mantém `data` anterior em falha e possui 2 ocorrências no baseline AST em `NetworthEvolutionContent`).
     - `src/components/finance/financial-calendar.tsx:70-118` (sem `AbortController`, sem identidade de requisição e mantém `data` antigo em falha).
     - `src/components/finance/transaction-analytics.tsx:60-96` (sem `AbortController`, sem identidade de requisição e mantém `data` antigo em falha).
     - `src/components/finance/spending-timeline.tsx:23-65` (possui estado `error`, mas não aborta nem descarta resposta/erro de período anterior e não limpa `data` em falha).
   - Atenção crítica de testes existentes: `src/components/finance/quiet-analysis-calendar.test.tsx:45-53` verifica no AST os callbacks exatos `onClick={() => fetchData(activeDays)}` (`financial-calendar`), `onClick={() => fetchData(selectedMonths)}` (`networth-evolution`), `onClick={fetchData}` (`debt-overview` e `transaction-analytics`) e `onClick={fetchReports}` (`financial-reports`). Além disso, `.zscripts/frontend-architecture-baseline.json` fixa os hashes AST das duas expressões condicionais em `NetworthEvolutionContent`.

2. **Busca Global (`global-search.tsx`, `global-search-result.tsx`, `src/app/page.tsx`):**
   - `openspec/specs/interface-quiet-financial-os/spec.md:47-48` e `src/app/page.tsx:61-63` já suportam os oito domínios da Alternativa A (`transactions`, `purchases`, `accounts`, `cards`, `categories`, `investments`, `installments`, `consortiums`).
   - Porém `src/components/finance/global-search-result.tsx:17,35-41` e `src/components/finance/global-search.tsx:41-47,114-149,169-255` ainda indexam e mapeiam apenas 5 domínios, omitindo `/api/investments`, `/api/installments` e `/api/consortiums`.
   - `fetchAll()` em `global-search.tsx:114-149` não usa `AbortController`, expondo estado obsoleto ao fechar ou reexecutar busca.
   - `global-search.tsx:174-182` trata `t.type === 'INCOME'` vs restante, exibindo `t.type === 'TRANSFER'` com sinal `'-'` e ícone vermelho `ArrowDownRight` (`text-(--ds-accent-danger)`).
   - `src/components/finance/quiet-search-parity.qa.mjs:100-155` rejeita qualquer `GET` não previsto na fixture (`Fetch fora da fixture`), portanto precisará responder `[]` para os 3 novos endpoints na fixture de QA caso seja executado após a mudança.

3. **Resiliência HTTP pontual nos fluxos restantes:**
   - `src/components/finance/monthly-budget-tracker.tsx:201`: `handleDelete` faz `await res.json()` sem `.catch(() => ({}))`, convertendo erro HTTP não-JSON em `'Erro de conexão'`.
   - `src/components/finance/accounts-view.tsx:619`: `saveTransfer` faz `await res.json()` sem `.catch(() => ({}))`, mascarando corpo não-JSON como falha genérica de transporte.
   - `src/components/finance/debt-overview.tsx:134-151` e `src/components/finance/financial-reports.tsx:47-61`: quando um retry/refresh subsequente falha (`!res.ok` ou `catch`), mantêm `data` antigo na tela em vez de limpar `data` e exibir o estado de erro.
   - `src/components/finance/investments-view.tsx:198-207`: `fetchDividends` ignora `!res.ok` e `catch` silenciosamente, deixando `dividendEntries` vazio e exibindo `R$ 0,00` como dividendos recebidos.

## Alternativas consideradas e decisões adotadas

- **Abordagem para concorrência assíncrona:**
  - *Alternativa 1 (escolhida):* Replicar exatamente o padrão puro testável de `balance-projection.tsx` e `expense-breakdown.tsx` (`request*` + `current*` com `AbortController` e objeto de requisição por identidade) nos 4 widgets afetados, mantendo as assinaturas dos componentes `*Content` (`fetchData`, `NetworthEvolutionContent`) exigidas pelos testes AST e pelo baseline.
  - *Alternativa 2 (descartada):* Criar um hook genérico global compartilhado entre todos os widgets. Descartada por acoplar widgets já aprovados (`balance-projection`, `expense-breakdown`) e aumentar risco de regressão no baseline AST sem ganho para esta onda.
- **Abordagem para dividendos em `investments-view.tsx`:**
  - *Alternativa 1 (escolhida):* Rastrear `dividendLoadError` em `InvestmentsView`, limpar `dividendEntries` em erro, exibir `'—'` (ou valor indisponível sem `R$ 0,00` enganoso) na métrica de dividendos quando `dividendLoadError` for verdadeiro e exibir alerta acessível (`role="alert"`) com botão `Tentar novamente`, preservando a listagem da carteira quando `/api/investments` responder `200 OK`.
  - *Alternativa 2 (descartada):* Misturar `dividendLoadError` no mesmo `loadError` que bloqueia ou contradiz a lista carregada de investimentos.
- **Não-objetivos (YAGNI):**
  - Não alterar `.zscripts/frontend-architecture-baseline.json`.
  - Não refatorar os 18 widgets de `details` / `showValues`.
  - Não alterar rotas de API ou `db/custom.db`.
