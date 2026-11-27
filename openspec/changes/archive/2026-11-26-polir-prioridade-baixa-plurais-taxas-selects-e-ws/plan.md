# Implementation plan

Bridge task contract: 1

**Goal:** Polir as quatro arestas de prioridade baixa (`#19` a `#22`) após a integração dos Pacotes 1 e 2: plurais `=0` em todos os catálogos PT, localização decimal de taxas e percentuais com `Intl.NumberFormat`, opção explícita `"Nenhum(a)"` nos selects opcionais de investimentos e parcelas, e reconexão WebSocket finita com backoff exponencial em `useRealtime`.
**Architecture:** O trabalho divide-se em três frentes paralelas sem sobreposição de escrita (`1.1` os 14 JSONs PT com `, plural,` e `src/i18n/invariants.test.ts`; `1.2` `src/lib/helpers.ts`, `src/messages/{pt,es,en}/shared.json` e os componentes de `src/components/finance/`; `1.3` `src/hooks/use-realtime.ts` e `src/hooks/use-realtime.test.ts`), convergindo na Task `2.1` que ajusta e amplia os testes unitários e `quiet-i18n.qa.mjs` e executa a bateria completa (`check`, `test:sqlite`, `build` e Playwright isolado).
**Skill mapping and observed invocation:** `brainstorming` (`/home/marcelo-karval/.agents/skills/brainstorming/SKILL.md`) e `writing-plans` (`/home/marcelo-karval/.agents/skills/writing-plans/SKILL.md`) lidas integralmente e aplicadas na redação de `brainstorm.md`, `proposal.md`, `design.md`, `specs/*/spec.md`, `tasks.md`, `plan.md` e `candidate-manifest.json`.

## Global Constraints

- Executa **sequencialmente após os Pacotes 1 e 2**, preservando especialmente a correção de `SERVER_SNAPSHOT` em `src/hooks/use-realtime.ts` (`#1`) e demais contratos de a11y/validação introduzidos anteriormente.
- Proibido editar `src/components/ui/**` (shadcn), `src/app/api/**`, `mini-services/finance-ws/**`, `db/custom.db`, `.env` ou `bun.lock`.
- Todas as chaves `, plural,` em `src/messages/pt/*.json` MUST manter exatamente o mesmo conjunto de chaves aninhadas e variáveis ICU `{...}` que `es` e `en` (`src/i18n/invariants.test.ts` e `src/components/finance/quiet-transversal.test.tsx`).
- `src/lib/helpers.ts` MUST preservar compatibilidade retroativa da assinatura `percentFmt(v, locale)` (`+12.3%` / `-4.5%` em `src/lib/purchase-date.test.ts:119-120`) e centralizar formatação numérica/decimal via `Intl.NumberFormat`.
- Gate AST (`.zscripts/check-frontend-architecture.ts`): preservar intactas as 6 entradas aprovadas em `.zscripts/frontend-architecture-baseline.json` (`balance-projection.tsx`, `dashboard-view.tsx`, `installments-view.tsx`, `investments-view.tsx`, `networth-evolution.tsx` x2), usar `cn()` em novas composições condicionais e manter todos os arquivos originalmente até 500 linhas abaixo do limite de 500 linhas.

## Review Focus

- **Paridade ICU entre `pt`, `es` e `en` (`#19`):** todas as 41 chaves (42 cláusulas `, plural,`) atualizadas em `src/messages/pt/*.json` (incluindo os dois plurais `activeCount` e `completedCount` de `goals.json:47` e as formas sem `#` de `categories.json:45-46`) devem passar em `invariants.test.ts` e `quiet-transversal.test.tsx` sem divergir nos placeholders `{...}`.
- **Retrocompatibilidade de `percentFmt` vs taxas sem sinal (`#20`):** `percentFmt(12.34, 'en')` deve continuar retornando `'+12.3%'` enquanto `rateFmt` e `percentFmt(..., { signed: false })` não prefixam `+` em taxas de juros (`1,5%`), rendimento (`12,5% a.a.`) ou participação (`20,0%`).
- **Payload de `saveInvestment` ao desvincular vs campo originalmente vazio (`#21`):** selecionar `"Nenhum(a)"` (`none`) na edição de investimento que tinha `accountId`/`categoryId` deve enviar `null` no `PUT` para limpar o banco, mas campos já vazios na criação/edição sem vínculo prévio devem continuar omitidos (`undefined`) para preservar os testes de mutação existentes.
- **Limpeza e recuperação manual no `useRealtime` (`#22`):** exaurir `MAX_RECONNECTION_ATTEMPTS = 3` deve desconectar o socket e limpar listeners sem emitir erros não tratados nem spam no console, e acionar `reconnect()` manualmente deve abrir nova tentativa com orçamento renovado, preservando `SERVER_SNAPSHOT` estável.
- **Preservação do baseline AST e limite de 500 linhas:** alterações em `dashboard-view.tsx`, `balance-projection.tsx`, `installments-view.tsx`, `investments-view.tsx` e `networth-evolution.tsx` não podem tocar as expressões `className` do baseline nem empurrar arquivos de até 500 linhas além do limite.

## Task 1.1: Plurais `=0` em português nos catálogos JSON e invariantes de paridade

- Depends on: none
- Needs: none
- Outcome: Todas as 41 chaves (42 cláusulas `, plural,`) sem `=0` nos 14 catálogos `src/messages/pt/*.json` atualizadas com ramo `=0 {...}` no plural correto em português mantendo paridade estrita de chaves e placeholders com `es` e `en`, e `src/i18n/invariants.test.ts` ampliado para validar presença de `=0` e formatação ICU real para `count = 0, 1, 2`.
- Owner/resolver: executor da Task 1.1; eventuais divergências em chaves de namespaces ficam restritas a `src/messages/pt/*.json`.
- Inputs: `src/messages/pt/*.json`, `src/messages/es/*.json`, `src/messages/en/*.json`, `src/i18n/messages.ts`, `src/test-utils/intl.tsx`, `src/lib/purchase-date.test.ts`.
- Produces: pt-zero-plurals-and-parity-ready
- Write paths: src/messages/pt/accounts.json, src/messages/pt/analytics.json, src/messages/pt/cards.json, src/messages/pt/categories.json, src/messages/pt/consortiums.json, src/messages/pt/dashboard.json, src/messages/pt/goals.json, src/messages/pt/installments.json, src/messages/pt/investments.json, src/messages/pt/notifications.json, src/messages/pt/purchases.json, src/messages/pt/recurring.json, src/messages/pt/savings.json, src/messages/pt/shell.json, src/i18n/invariants.test.ts
- Exclusions: src/messages/pt/shared.json, src/messages/pt/common.json, src/messages/pt/receipts.json, src/messages/pt/advisor.json, src/messages/pt/api.json, src/messages/es/shared.json, src/messages/en/shared.json, src/components/finance/quiet-transversal.test.tsx, src/lib/helpers.ts, src/hooks/use-realtime.ts, db/custom.db
- Shared resources: none
- Acceptance: `bun --no-env-file test ./src/i18n/invariants.test.ts ./src/lib/purchase-date.test.ts` retorna código 0; varredura nos 14 JSONs PT confirma 0 cláusulas `, plural,` sem `=0`; renderização ICU com `count = 0` retorna forma plural (`0 compras encontradas`, `0 transações`, `0 planos no total`, `0 investimentos`, `0 novas`, `0 resultados`) sem regredir `0 itens`.
- Stop: Parar se alguma alteração alterar nomes de variáveis `{...}` em relação a `es` ou `en` ou quebrar `src/lib/purchase-date.test.ts:91-92`.
- Resume: Retomar após restaurar os placeholders exatos da chave divergente nos catálogos `pt`.

Passos detalhados da execução:
1. **RED:** adicionar em `src/i18n/invariants.test.ts` teste que percorre todos os 18 namespaces UI em `src/messages/pt/*.json`, exige `=0` em cada cláusula `, plural,` e verifica formatação ICU para `0`, `1` e `2` via `createTranslator`; executar `bun --no-env-file test ./src/i18n/invariants.test.ts` e observar falha esperada nas 41 cláusulas sem `=0`.
2. Atualizar as 41 cláusulas `, plural,` sem `=0` nos 14 arquivos `src/messages/pt/*.json` (incluindo os dois plurais de `goals.json` `budgetGoals.summary`, os rótulos sem `#` em `categories.json` `list.txCount` e `list.purchaseCount`, mantendo `dashboard.json` `details.recentPurchases.itemCount` intacto).
3. **GREEN:** executar `bun --no-env-file test ./src/i18n/invariants.test.ts ./src/lib/purchase-date.test.ts` e confirmar 100% de aprovação.
- RED command and observed failure: `bun --no-env-file test ./src/i18n/invariants.test.ts` falhou como esperado nas cláusulas `, plural,` sem `=0` (`Expected: "X resultados"`, `Received: "X resultado"`) (#483).
- GREEN command and observed result: `bun --no-env-file test ./src/i18n/invariants.test.ts ./src/lib/purchase-date.test.ts ./src/components/finance/quiet-transversal.test.tsx` (`37 pass, 1 skip pré-existente em purchase-date.test.ts, 0 fail`) e varredura em `src/messages/pt/*.json` confirmou `43` cláusulas `, plural,` com `0` ausências de `=0` e paridade integral com `es`/`en` (#483).
- Typed evidence outcomes: `i18n-invariants`: pass; `i18n-parity`: pass (`#19`).
- Review candidate identity and reviewer: `a85b021792342a3a005a548d9b94b71b4738f39162d128c203bef6fa552c1d1c` — `verifier-p3-13` (#501 PASS).
- Remaining gaps: none

## Task 1.2: Taxas percentuais localizadas e opção `"Nenhum(a)"` nos selects opcionais

- Depends on: none
- Needs: none
- Outcome: Formatadores numéricos/percentuais unificados em `src/lib/helpers.ts` aplicados em todas as taxas e percentuais decimais de `src/components/finance/`, mais opção explícita `"Nenhum(a)"` (`shared.noneOption` em `src/messages/{pt,es,en}/shared.json`) nos selects opcionais de `InvestmentEditor` (com envio de `null` em `investments-view.tsx` ao limpar vínculo existente) e `InstallmentPlanEditor`, mantendo `0` erros no `arch:check` e arquivos `<= 500` linhas dentro do limite.
- Owner/resolver: executor da Task 1.2; ajustes de compatibilidade de API não se aplicam pois `/api/investments` e `/api/installments` já aceitam `null`.
- Inputs: `src/app/api/investments/route.ts`, `src/app/api/installments/route.ts`, `.zscripts/frontend-architecture-baseline.json`, `src/components/finance/consortiums-view.tsx`, `src/components/finance/savings-goal-editor.tsx`.
- Produces: localized-rates-and-none-selects-ready
- Write paths: src/lib/helpers.ts, src/messages/pt/shared.json, src/messages/es/shared.json, src/messages/en/shared.json, src/components/finance/installments-view.tsx, src/components/finance/savings-view.tsx, src/components/finance/debt-overview.tsx, src/components/finance/debt-sections.tsx, src/components/finance/balance-projection.tsx, src/components/finance/financial-report-tabs.tsx, src/components/finance/quick-stats-overview.tsx, src/components/finance/dashboard-view.tsx, src/components/finance/networth-evolution.tsx, src/components/finance/goals-dashboard.tsx, src/components/finance/savings-challenge.tsx, src/components/finance/expense-breakdown.tsx, src/components/finance/expense-category-details.tsx, src/components/finance/transaction-analysis-tabs.tsx, src/components/finance/investment-editor.tsx, src/components/finance/investments-view.tsx, src/components/finance/installment-plan-editor.tsx
- Exclusions: src/messages/pt/investments.json, src/messages/pt/installments.json, src/messages/pt/savings.json, src/messages/pt/dashboard.json, src/messages/pt/analytics.json, src/messages/pt/goals.json, src/i18n/invariants.test.ts, src/hooks/use-realtime.ts, src/components/ui/select.tsx, src/app/api/investments/route.ts, src/app/api/installments/route.ts, db/custom.db
- Shared resources: none
- Acceptance: `bun --no-env-file run typecheck && bun --no-env-file run lint && bun --no-env-file run arch:check` retorna código 0 com `0` erros e `6 ocorrências em 6 identidades`; nenhuma exibição decimal percentual crua com `.toFixed(1)%` ou taxa numérica sem `Intl.NumberFormat` permanece nos componentes listados; todos os arquivos originalmente até 500 linhas permanecem no máximo em 500 linhas; `InvestmentEditor` e `InstallmentPlanEditor` exibem `SelectItem` com `value="none"` e texto `shared.noneOption`.
- Stop: Parar se qualquer alteração quebrar uma das 6 identidades AST do baseline, empurrar um arquivo de até 500 linhas para acima de 500 linhas ou alterar `percentFmt(v, locale)` padrão para omitir `+`.
- Resume: Retomar após restaurar as expressões AST intactas e manter defaults `precision = 1, signed = true` em `percentFmt`.

Passos detalhados da execução:
1. **RED:** verificar em `src/components/finance/` as ocorrências de `interestRate` / `yieldRate` sem formatação (`installments-view.tsx:402`, `savings-view.tsx:534`, `debt-sections.tsx:406`), `.toFixed(1)%` nos widgets e ausência de `SelectItem` `value="none"` em `investment-editor.tsx` e `installment-plan-editor.tsx`.
2. Em `src/lib/helpers.ts`, extrair `numberFmt(v, locale, options)` e `rateFmt(v, locale, maximumFractionDigits = 2)`, e parametrizar `percentFmt(v, locale, options?: { precision?: number; signed?: boolean })` preservando o comportamento padrão existente.
3. Atualizar os 14 componentes com percentuais/taxas decimais (`installments-view.tsx`, `savings-view.tsx`, `debt-overview.tsx:319,324`, `debt-sections.tsx`, `balance-projection.tsx`, `financial-report-tabs.tsx`, `quick-stats-overview.tsx`, `dashboard-view.tsx`, `networth-evolution.tsx`, `goals-dashboard.tsx`, `savings-challenge.tsx`, `expense-breakdown.tsx`, `expense-category-details.tsx`, `transaction-analysis-tabs.tsx`) para usar `rateFmt`, `numberFmt` ou `percentFmt(..., locale, { signed: false })` conforme cada caso, removendo `pctFmt` local duplicado em `financial-report-tabs.tsx` e `.toFixed(precision)` em `dashboard-view.tsx`.
4. Adicionar `"noneOption": "Nenhum(a)"` / `"Ninguno(a)"` / `"None"` em `src/messages/{pt,es,en}/shared.json`; adicionar `SelectItem` `value="none"` com `useSafeTranslations('shared')('noneOption')`, `value={form.<campo> || 'none'}` e limpeza para `''` nos selects `accountId`/`categoryId` de `investment-editor.tsx` e `cardId`/`categoryId` de `installment-plan-editor.tsx`; atualizar `saveInvestment` em `investments-view.tsx` para enviar `null` ao desvincular `editingInvestment.accountId`/`categoryId` prévio e `undefined` caso contrário.
5. **GREEN:** rodar `bun --no-env-file run typecheck && bun --no-env-file run lint && bun --no-env-file run arch:check` confirmando `0` erros e contagem de linhas preservada.
- RED command and observed failure: inspeção e suítes prévias confirmaram taxas sem `Intl.NumberFormat` (`installments-view.tsx:402`, `savings-view.tsx:534`, `debt-sections.tsx:406`), `.toFixed(1)%` nos widgets e ausência de `SelectItem value="none"` e `shared.noneOption` em `investment-editor.tsx` e `installment-plan-editor.tsx` (#485).
- GREEN command and observed result: `bun --no-env-file run typecheck` (exit 0, 0 erros), `bun --no-env-file run lint` (exit 0, 0 erros e 18 avisos pré-existentes), `bun --no-env-file run arch:check` (exit 0, `79 arquivos; 6 ocorrências em 6 identidades; 25 avisos; 0 erros`), `bun --no-env-file test ./src/lib/purchase-date.test.ts` (`13 pass, 1 skip, 0 fail`) e contagem `wc -l` preservada `<= 500` linhas nos arquivos originalmente até 500 linhas (`balance-projection.tsx` 469, `networth-evolution.tsx` 436, `debt-sections.tsx` 453) (#485).
- Typed evidence outcomes: `typecheck`: pass; `lint`: pass; `arch:check`: pass; `unit-checks`: pass (`#20`, `#21`).
- Review candidate identity and reviewer: `a85b021792342a3a005a548d9b94b71b4738f39162d128c203bef6fa552c1d1c` — `verifier-p3-13` (#501 PASS).
- Remaining gaps: none

## Task 1.3: Reconexão WebSocket finita com backoff exponencial e fallback silencioso

- Depends on: none
- Needs: none
- Outcome: `src/hooks/use-realtime.ts` configurado com `MAX_RECONNECTION_ATTEMPTS = 3`, backoff exponencial (`reconnectionDelay: 2000`, `reconnectionDelayMax: 30000`, `randomizationFactor: 0.5`), tratamento silencioso de `connect_error` e `reconnect_failed` (desconectando o socket após exaustão e mantendo `isConnected: false`), limpeza completa de listeners no `cleanup()` e preservação de `SERVER_SNAPSHOT` e `reconnect()` manual; além de `src/hooks/use-realtime.test.ts` validando o contrato.
- Owner/resolver: executor da Task 1.3; decisões sobre o servidor `:3004` em `mini-services/finance-ws/` ficam fora de escopo.
- Inputs: `src/hooks/use-realtime.ts`, `src/app/page.tsx`, `src/hooks/use-keyed-mutation-lock.test.ts`.
- Produces: finite-websocket-backoff-ready
- Write paths: src/hooks/use-realtime.ts, src/hooks/use-realtime.test.ts
- Exclusions: src/app/page.tsx, src/components/finance/sidebar.tsx, mini-services/finance-ws/index.ts, src/lib/helpers.ts, src/messages/pt/shared.json, db/custom.db
- Shared resources: none
- Acceptance: `bun --no-env-file test ./src/hooks/use-realtime.test.ts && bun --no-env-file run typecheck && bun --no-env-file run lint` retorna código 0; `REALTIME_SOCKET_OPTIONS` define `reconnectionAttempts: 3`, `reconnectionDelay: 2000`, `reconnectionDelayMax: 30000`; `connect_error` e `reconnect_failed` não emitem `console.error` nem lançam exceção; `getServerSnapshot()` retorna referência estável em chamadas consecutivas; `reconnect()` reinicia a conexão manualmente.
- Stop: Parar se o arquivo `src/hooks/use-realtime.ts` ainda não contiver a correção de `SERVER_SNAPSHOT` do Pacote 1 (`#1`) ou se alterar a assinatura pública `UseRealtimeReturn`.
- Resume: Retomar após integrar Pacote 1 (`#1`) ou restaurar a assinatura pública `{ isConnected, refreshCounter, lastEvent, reconnect }`.

Passos detalhados da execução:
1. **RED:** criar `src/hooks/use-realtime.test.ts` importando `REALTIME_SOCKET_OPTIONS` / `MAX_RECONNECTION_ATTEMPTS` e testando que tentativas não são `Infinity`, que `connect_error` e `reconnect_failed` desconectam silenciosamente sem erro de console e que `reconnect()` restabelece o socket; rodar `bun --no-env-file test ./src/hooks/use-realtime.test.ts` e confirmar falha esperada contra `reconnectionAttempts: Infinity`.
2. Atualizar `src/hooks/use-realtime.ts` preservando a constante `SERVER_SNAPSHOT` (Pacote 1 `#1`), exportando `MAX_RECONNECTION_ATTEMPTS = 3` e `REALTIME_SOCKET_OPTIONS` com backoff exponencial (`2000ms` a `30000ms`), tratando `connect_error` e `reconnect_failed` em `connect()` e limpando os mesmos listeners em `cleanup()`.
3. **GREEN:** rodar `bun --no-env-file test ./src/hooks/use-realtime.test.ts && bun --no-env-file run typecheck && bun --no-env-file run lint`.
- RED command and observed failure: `bun --no-env-file test ./src/hooks/use-realtime.test.ts` falhou como esperado antes da implementação (`1 pass, 6 fail`: `MAX_RECONNECTION_ATTEMPTS` `undefined`, `reconnectionAttempts: Infinity`, listeners `0`) (#484).
- GREEN command and observed result: `bun --no-env-file test ./src/hooks/use-realtime.test.ts ./src/components/finance/quiet-navigation.test.tsx` (`25 pass, 0 fail`: 7 em `use-realtime.test.ts`, 18 em `quiet-navigation.test.tsx`), `typecheck` (0 erros), `lint` (0 erros) e `arch:check` (0 erros, 6/6 identidades) (#484).
- Typed evidence outcomes: `unit-checks`: pass; `typecheck`: pass; `lint`: pass; `arch:check`: pass (`#22`).
- Review candidate identity and reviewer: `a85b021792342a3a005a548d9b94b71b4738f39162d128c203bef6fa552c1d1c` — `verifier-p3-13` (#501 PASS).
- Remaining gaps: none

## Task 2.1: Atualização de testes, suítes integradas, build e QA Playwright

- Depends on: 1.1, 1.2, 1.3
- Needs: 1.1 => pt-zero-plurals-and-parity-ready
- Needs: 1.2 => localized-rates-and-none-selects-ready
- Needs: 1.3 => finite-websocket-backoff-ready
- Outcome: Todos os testes unitários (`purchase-date.test.ts`, `dashboard-view.test.tsx`, `quiet-core-residuals.test.tsx`, `quiet-analysis-calendar.test.tsx`, `quiet-investment-mutations.test.tsx`, `quiet-investments-installments.test.tsx`, `quiet-consortiums-savings.test.tsx`, `quiet-transversal.test.tsx`) e `quiet-i18n.qa.mjs` atualizados e aprovados junto com `check`, `test:sqlite`, `build` e os runners `.qa.mjs` em sandbox isolado para `pt`, `es` e `en`.
- Owner/resolver: executor da Task 2.1; regressões em código de produção das Tasks `1.1`–`1.3` são escaladas de volta via coordenador.
- Inputs: `src/test-utils/intl.tsx`, `src/i18n/messages.ts`, `.zscripts/frontend-architecture-baseline.json`, `.zscripts/test-sqlite.sh`.
- Produces: priority-3-polish-verified
- Write paths: src/lib/purchase-date.test.ts, src/components/finance/dashboard-view.test.tsx, src/components/finance/quiet-core-residuals.test.tsx, src/components/finance/quiet-analysis-calendar.test.tsx, src/components/finance/quiet-investment-mutations.test.tsx, src/components/finance/quiet-investments-installments.test.tsx, src/components/finance/quiet-consortiums-savings.test.tsx, src/components/finance/quiet-transversal.test.tsx, src/components/finance/quiet-i18n.qa.mjs
- Exclusions: src/messages/pt/shared.json, src/messages/pt/investments.json, src/lib/helpers.ts, src/hooks/use-realtime.ts, src/components/shared/query-panel.tsx, src/components/ui/select.tsx, src/app/api/investments/route.ts, db/custom.db
- Shared resources: gate:static-toolchain, browser:playwright-qa
- Acceptance: `bun --no-env-file run check`, `bun --no-env-file run test:sqlite`, `DATABASE_URL="file:/tmp/ci-build-p3.db" bun --no-env-file run build` e os runners `src/components/finance/*.qa.mjs` em sandbox isolado (`CI=1`, `QUIET_QA_SCRATCH`) retornam código 0 com `0` erros AST, `0` falhas e `0` skips fora do opt-in SQLite padrão.
- Stop: Parar se alguma saída das Tasks `1.1`–`1.3` falhar na integração ou se qualquer runner `.qa.mjs` acusar regressão de payload ou layout.
- Resume: Retomar após reconciliar o teste ou devolver o ajuste pontual ao executor da frente afetada.

Passos detalhados da execução:
1. **RED (observado):** `bun --no-env-file test` retornou `641 pass, 41 skip, 9 fail, 16755 expect() calls, Ran 691 tests across 66 files. [22.21s]`, expondo exatamente as 9 falhas legadas esperadas:
   - `dashboard-view.test.tsx:160-162` (`-15.0%`, `25.0%`, `31.8%` com ponto em `'pt'`);
   - `quiet-core-residuals.test.tsx:305` (`0.0%` em `'pt'`);
   - `quiet-analysis-calendar.test.tsx:123,189,216,924` (`60.0%`, `25.0%`, `20.0%`, `35.0%` em `'pt'`);
   - `quiet-investment-mutations.test.tsx:216` (3 casos esperando valor inicial `''` em vez de `'none'`).
2. Atualizar as asserções afetadas e adicionar cobertura multi-idioma específica para:
   - `rateFmt`, `numberFmt` e `percentFmt(..., { signed: false })` em `src/lib/purchase-date.test.ts`;
   - taxas localizadas (`1,5%` / `1.5%`, `12,5% a.a.` / `12.5% p.a.`) e opção `"Nenhum(a)"` (`none` → `''` / `null` na edição) em `quiet-investment-mutations.test.tsx`, `quiet-investments-installments.test.tsx` e `quiet-consortiums-savings.test.tsx`;
   - paridade completa dos 18 namespaces UI após inclusão de `shared.noneOption` e ramos `=0` em `quiet-transversal.test.tsx`;
   - cenários de plurais `=0` em PT, taxas decimais por locale e selects `"Nenhum(a)"` em `quiet-i18n.qa.mjs`.
3. **GREEN (observado):**
   - `bun --no-env-file run check`: `exit 0` (`tsc --noEmit`: 0 erros; `eslint .`: 0 erros, 18 warnings; `arch:check`: `79 arquivos; 6 ocorrências em 6 identidades; 25 avisos; 0 erros`; `bun --no-env-file test`: `654 pass, 41 skip, 0 fail, 16948 expect() calls, Ran 695 tests across 66 files. [15.04s]`; `test:scripts`: `72 pass, 0 fail, 418 expect() calls, Ran 72 tests across 2 files. [11.58s]`).
   - `bun --no-env-file run test:sqlite`: `exit 0` nas 6 rodadas `bwrap` (`60 pass, 0 fail`: `purchase-date` UTC 14 + America/Bahia 14, `installments/route` 4, `purchases/route-integrity` 6, `consortiums/assembly` 12, `savings/route` 10).
   - `next build` isolado em `bwrap` (`--tmpfs /workspace/.next`, `DATABASE_URL="file:/tmp/ci-build-p3.db"`, `./node_modules/.bin/next build`): `exit 0` (`41/41` páginas estáticas).
   - Todos os 15 runners `src/components/finance/*.qa.mjs` executados em sandbox `bwrap` (`CI=1`, `QUIET_QA_SCRATCH=/scratch`): `exit 0`, `0 skips` (`quiet-i18n.qa.mjs` com 18 combinações `pt`/`es`/`en` em 6 células `360/390/1440 × light/dark`).
   - Inspeção Playwright GET-only ao vivo em `http://127.0.0.1:3000/` (`390x844` e `1440x900` × `light`/`dark` × `pt`/`es`/`en`, 12 células): `curl_http_code=200`, `consoleErrors=[]`, `pageErrors=[]`, `nonGetRequests=[]`, `overflow=false`, `hasMissingMessage=false`, `hasDecimalPct=true`, `Nenhum(a)`/`Ninguno(a)`/`None` confirmados em `InvestmentEditor` e `InstallmentPlanEditor`, `db/custom.db` preservado (`sha256: aa5ea1e9200992b3bd177bbfc6ae472d2f647ebb422443c317463e48ecf41ac8`).
- RED command and observed failure: `bun --no-env-file test` pré-Task 2.1 retornou `641 pass, 41 skip, 9 fail, 16755 expect() calls, Ran 691 tests across 66 files. [22.21s]`, expondo as 9 asserções legadas em `dashboard-view.test.tsx:160-162`, `quiet-core-residuals.test.tsx:305`, `quiet-analysis-calendar.test.tsx:123,189,216,924` e 3x `quiet-investment-mutations.test.tsx:216` (#499).
- GREEN command and observed result: `bun --no-env-file run check` (`exit 0`: `tsc --noEmit` 0 erros, `eslint .` 0 erros/18 warnings, `arch:check` `79 arquivos; 6 ocorrências em 6 identidades; 25 avisos; 0 erros`, `bun test` `654 pass, 41 skip, 0 fail` em 66 arquivos, `test:scripts` `72 pass, 0 fail` em 2 arquivos), `bun --no-env-file run test:sqlite` (`exit 0`, `60 pass, 0 fail` nas 6 execuções `bwrap`), `next build` isolado em `bwrap` (`exit 0`, 41/41 páginas estáticas), todos os 15 `.qa.mjs` em `bwrap` (`exit 0`, `0 skips`) e inspeção Playwright GET-only ao vivo em `:3000` (`200`, `db/custom.db` `aa5ea1e9200992b3bd177bbfc6ae472d2f647ebb422443c317463e48ecf41ac8`) (#487–#499, #501).
- Typed evidence outcomes: `check`: pass; `test:sqlite`: pass; `build-bwrap`: pass; `playwright-qa-bwrap`: pass; `playwright-live`: pass (`#19`–`#22`).
- Review candidate identity and reviewer: `a85b021792342a3a005a548d9b94b71b4738f39162d128c203bef6fa552c1d1c` — `verifier-p3-13` (#501 PASS).
- Remaining gaps: none
