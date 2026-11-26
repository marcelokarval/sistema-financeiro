# Implementation plan

Bridge task contract: 1

**Goal:** Internacionalizar a camada de APIs, exportação CSV, assistente IA e helpers de validação HTTP/Prisma para `pt`, `es` e `en` mantendo `'pt'` como fallback retrocompatível, `BRL` como moeda contábil fixa e 100% de aprovação em `check` e `test:sqlite`.
**Architecture:** Um módulo puro `src/lib/server-i18n.ts` carrega catálogos estáticos `src/messages/{pt,es,en}/api.json`, resolve o locale via `?locale=` → cookie `NEXT_LOCALE` → header `Accept-Language` → `'pt'` e fornece formatadores `Intl` (`BRL` e datas civis) e respostas de erro `{ error, code }` + `X-Error-Code`. Após a fundação (Task 1.1), três frentes disjuntas em `Write paths` (Task 1.2 analíticas/calendário/faturas/recibo, Task 1.3 narrativas e Task 1.4 export/advisor/CRUD) aplicam o contrato preservando todas as suítes `test:sqlite` e evitando qualquer edição em `src/i18n/*`, `src/components/*` ou `src/lib/purchase-date.ts`.
**Skill mapping and observed invocation:** `openspec-propose` (`/home/marcelo-karval/.agents/skills/openspec-propose/SKILL.md`), `brainstorming` (`/home/marcelo-karval/.agents/skills/brainstorming/SKILL.md`) e `writing-plans` (`/home/marcelo-karval/.agents/skills/writing-plans/SKILL.md`) lidas integralmente e aplicadas nesta sessão na produção de `brainstorm.md`, `proposal.md`, `design.md`, `specs/internacionalizacao-apis-e-exportacao/spec.md`, `tasks.md`, `plan.md` e `candidate-manifest.json`.

## Global Constraints

- Runtime exclusivo Bun `1.4.2` (`bun --no-env-file`); proibido usar `npm` ou `yarn` e proibido alterar `dependencies`, `devDependencies` ou `bun.lock`.
- Moeda contábil fixa `BRL` em todas as APIs, CSVs e prompt do assistente, sem conversão cambial.
- Fallback padrão `'pt'` obrigatório quando `?locale=`, cookie `NEXT_LOCALE` e header `Accept-Language` estiverem ausentes ou não suportados.
- Proibido editar `src/i18n/*` (Change 1), `src/components/{finance,shared}/*` (Change 2), `src/lib/purchase-date.ts`, `src/lib/purchase-date.test.ts`, `db/custom.db` e os 4 arquivos de teste `test:sqlite` (`src/app/api/installments/route.test.ts`, `src/app/api/purchases/route-integrity.test.ts`, `src/app/api/consortiums/assembly.test.ts`, `src/app/api/savings/route.test.ts`).
- Toda alteração comportamental deve seguir TDD estrito (`RED -> GREEN`), validado ao final por `bun --no-env-file run check`, `bun --no-env-file run test:sqlite` e `DATABASE_URL="file:/tmp/ci-build-inert.db" bun --no-env-file run build`.

## Review Focus

- Header `Accept-Language` com múltiplos idiomas e pesos `q=` (ex.: `fr-FR,es-MX;q=0.9,en;q=0.8`) ou `?locale=invalid` combinado com cookie `NEXT_LOCALE=en`: deve ignorar o inválido/não suportado, respeitar a precedência e cair para `'en'` ou `'pt'` sem lançar exceção (coberto por `src/lib/server-i18n.test.ts` na Task 1.1).
- Data civil meia-noite UTC (`2026-11-19T00:00:00.000Z`) consultada em fuso negativo `America/Bahia` (`UTC-3`) em `/api/receipt` e `/api/export`: deve exibir o dia `19` nos três locales (`19/11/2026`, `19/11/2026`, `11/19/2026`) sem recuar para dia `18` (coberto por `src/app/api/receipt/route.test.ts` na Task 1.2 e `src/app/api/export/route.test.ts` na Task 1.4).
- Handlers `GET()` invocados sem argumento `request` em testes unitários (`quick-stats`, `goals-dashboard`, `upcoming-bills`, `insights`, `achievements`, `savings-challenge`, `debts`): devem aceitar `request?: NextRequest` opcional e responder com default `'pt'` sem TypeError (coberto pelos testes das Tasks 1.2 e 1.3).
- Injeção de delimitadores ou instruções no campo `context` de `POST /api/advisor` em `es` e `en`: deve manter sanitização, truncamento em 1000 chars, `<user_context>`, `BRL` e ausência de `lastFourDigits` e emojis (coberto por `src/app/api/advisor/route.test.ts` na Task 1.4).
- Contratos JSON estritos `.toEqual({ error: ... })` sem campo `code` em `src/lib/api-validation.test.ts`, `src/app/api/installments/route.test.ts` e `src/app/api/purchases/route-integrity.test.ts`: chamadas sem sinal explícito de locale devem manter o payload exato legado e enviar `code` no header `X-Error-Code` (coberto na Task 1.1 e pelo gate `test:sqlite` na Task 1.4).

---

## Task 1.1: Fundação `server-i18n.ts`, catálogos `src/messages/{pt,es,en}/api.json` e `api-validation.ts`

- Depends on: none
- Needs: none
- Outcome: Módulo `src/lib/server-i18n.ts` completo (`resolveRequestLocale`, `hasExplicitLocaleSignal`, `getApiMessages`, `translateApiMessage`, `formatServerCurrencyBRL`, `formatServerNumber`, `formatServerMonthLabel`, `formatServerDate`, `formatServerPurchaseDate`, `formatServerWeekdayShort`, `apiErrorResponse`), catálogos paritários `src/messages/{pt,es,en}/api.json` e `src/lib/api-validation.ts` atualizado com `parseJsonBodyLocalized`, `mapPrismaErrorLocalized` e compatibilidade retroativa comprovada por testes unitários.
- Owner/resolver: executor da Task 1.1; decisões materiais escaladas ao coordenador.
- Inputs: `src/lib/api-validation.ts`, `src/lib/api-validation.test.ts`, `src/lib/purchase-date.ts`.
- Produces: server-i18n-foundation-ready
- Write paths: src/lib/server-i18n.ts, src/lib/server-i18n.test.ts, src/lib/api-validation.ts, src/lib/api-validation.test.ts, src/messages/pt/api.json, src/messages/es/api.json, src/messages/en/api.json
- Exclusions: src/lib/purchase-date.ts, src/lib/purchase-date.test.ts, src/app/api/installments/route.test.ts, src/app/api/purchases/route-integrity.test.ts, src/app/api/consortiums/assembly.test.ts, src/app/api/savings/route.test.ts, db/custom.db
- Shared resources: none
- Acceptance: `bun --no-env-file test src/lib/server-i18n.test.ts src/lib/api-validation.test.ts` passa com 0 falhas e 0 skips, comprovando paridade de chaves entre `pt`/`es`/`en`, precedência de locale, `BRL` contábil, datas civis sem recuo de fuso e preservação das asserções existentes de `api-validation.test.ts`.
- Stop: Parar se `src/messages/{pt,es,en}/api.json` apresentar chaves divergentes entre idiomas ou se qualquer teste pré-existente de `src/lib/api-validation.test.ts` falhar.
- Resume: Retomar após reconciliar as chaves dos três catálogos JSON ou restaurar a compatibilidade de retorno da assinatura legada de `parseJsonBody`/`mapPrismaError`.

Passos detalhados da execução:
1. **RED:** Criar `src/lib/server-i18n.test.ts` testando:
   - `resolveRequestLocale(req)` para precedência `?locale=` → cookie `NEXT_LOCALE` → `Accept-Language` (com pesos `q=`) → `'pt'`, além de `?locale=invalid` caindo para cookie/header/fallback;
   - `hasExplicitLocaleSignal(req)` retornando `false` em requisição sem params/cookie/header e `true` quando qualquer um dos três informa idioma suportado;
   - `translateApiMessage(locale, key, params)` com interpolação `{var}` e paridade completa de chaves entre `pt`, `es` e `en`;
   - `formatServerCurrencyBRL` sempre em `BRL` nos três locales, `formatServerPurchaseDate('2026-11-19T00:00:00.000Z', locale, 'date')` sem recuo de dia, `formatServerWeekdayShort(0, 'pt') === 'Dom'` e `apiErrorResponse('VALIDATION_ERROR', '...', 400)` retornando header `X-Error-Code` e `{ error, code }`.
   - Adicionar em `src/lib/api-validation.test.ts` testes para `parseJsonBodyLocalized` e `mapPrismaErrorLocalized` em `pt`/`es`/`en` retornando `{ error, code }` e header `X-Error-Code`.
   - Rodar `bun --no-env-file test src/lib/server-i18n.test.ts src/lib/api-validation.test.ts` e confirmar falha esperada (`Cannot find module './server-i18n'` / export ausente).
2. **GREEN (catálogos):** Criar `src/messages/pt/api.json`, `src/messages/es/api.json` e `src/messages/en/api.json` com estrutura idêntica cobrindo `common`, `errors`, `validation`, `analytics`, `calendar`, `bills`, `receipt`, `insights`, `forecast`, `achievements`, `savingsChallenge`, `export`, `advisor` e `crud`.
3. **GREEN (`src/lib/server-i18n.ts`):** Implementar `SupportedLocale`, `INTL_LOCALE_MAP`, `resolveRequestLocale`, `hasExplicitLocaleSignal`, `getApiMessages`, `translateApiMessage`, `formatServerCurrencyBRL`, `formatServerNumber`, `formatServerMonthLabel`, `formatServerDate`, `formatServerPurchaseDate` (importando `civilPurchaseDate` de `@/lib/purchase-date`), `formatServerWeekdayShort` e `apiErrorResponse`.
4. **GREEN (`src/lib/api-validation.ts`):** Adicionar `parseJsonBodyLocalized` (usando `resolveRequestLocale` + `translateApiMessage(locale, 'validation.invalidJson')` + código `'INVALID_JSON'`) e `mapPrismaErrorLocalized` (mapeando `P2003` -> `'FOREIGN_KEY_ERROR'` e `P2025` -> `'NOT_FOUND'`), mantendo `parseJsonBody` e `mapPrismaError` retrocompatíveis (adicionando `X-Error-Code` no header sem adicionar `code` no JSON quando chamados na forma legada).
5. **Verificação:** Rodar `bun --no-env-file test src/lib/server-i18n.test.ts src/lib/api-validation.test.ts` e `bun --no-env-file run typecheck` confirmando `exit 0`.
- RED command and observed failure: `bun --no-env-file test ./src/lib/server-i18n.test.ts ./src/lib/api-validation.test.ts` -> exit 1 (`0 pass, 2 fail, 2 errors`: `Cannot find module './server-i18n'` e `Export named 'mapPrismaErrorLocalized' not found in module '.../src/lib/api-validation.ts'`).
- GREEN command and observed result: `bun --no-env-file x eslint src/lib/server-i18n.ts src/lib/server-i18n.test.ts src/lib/api-validation.ts src/lib/api-validation.test.ts && bun --no-env-file run typecheck && bun --no-env-file test ./src/lib/server-i18n.test.ts ./src/lib/api-validation.test.ts` -> exit 0 (`43 pass, 0 fail, 3726 expect() calls`).
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: `ba24597efca8286aae806cdc9abe28df44c02b228d3907893d7b8c96a8aa8997` (revisão independente aprovada por `verifier-w1-10` em #343 e reconfirmada intacta por `verifier-w1-r2-10` em #355).
- Remaining gaps: none.

## Task 1.2: Rotas analíticas, séries temporais, calendário, faturas, recibo e dívidas

- Depends on: 1.1
- Needs: 1.1 => server-i18n-foundation-ready
- Outcome: Todas as 13 rotas (`dashboard`, `quick-stats`, `networth`, `reports`, `balance-projection`, `expense-breakdown`, `transaction-analytics`, `financial-calendar`, `goals-dashboard`, `upcoming-bills`, `receipt`, `timeline`, `debts`) localizam rótulos, datas, valores em `BRL` e erros `{ error, code }` para `pt`/`es`/`en`, mantendo `'pt'` padrão, chaves ISO aditivas e assinaturas `GET(request?: NextRequest)`.
- Owner/resolver: executor da Task 1.2; decisões materiais escaladas ao coordenador.
- Inputs: `src/app/api/{dashboard,quick-stats,networth,reports,balance-projection,expense-breakdown,transaction-analytics,financial-calendar,goals-dashboard,upcoming-bills,receipt,timeline,debts}/route.ts` e seus testes existentes.
- Produces: analytical-routes-i18n-ready
- Write paths: src/app/api/dashboard/route.ts, src/app/api/dashboard/route.test.ts, src/app/api/quick-stats/route.ts, src/app/api/networth/route.ts, src/app/api/networth/route.test.ts, src/app/api/reports/route.ts, src/app/api/balance-projection/route.ts, src/app/api/balance-projection/route.test.ts, src/app/api/expense-breakdown/route.ts, src/app/api/transaction-analytics/route.ts, src/app/api/financial-calendar/route.ts, src/app/api/financial-calendar/route.test.ts, src/app/api/goals-dashboard/route.ts, src/app/api/upcoming-bills/route.ts, src/app/api/upcoming-bills/route.test.ts, src/app/api/receipt/route.ts, src/app/api/receipt/route.test.ts, src/app/api/timeline/route.ts, src/app/api/debts/route.ts
- Exclusions: src/lib/server-i18n.ts, src/lib/api-validation.ts, src/lib/purchase-date.ts, src/lib/purchase-date.test.ts, src/app/api/installments/route.test.ts, src/app/api/purchases/route-integrity.test.ts, src/app/api/consortiums/assembly.test.ts, src/app/api/savings/route.test.ts, db/custom.db
- Shared resources: none
- Acceptance: `bun --no-env-file test src/app/api/dashboard/route.test.ts src/app/api/quick-stats/route.test.ts src/app/api/networth/route.test.ts src/app/api/balance-projection/route.test.ts src/app/api/financial-calendar/route.test.ts src/app/api/upcoming-bills/route.test.ts src/app/api/receipt/route.test.ts src/app/api/timeline/route.test.ts` passa com 0 falhas, e todas as rotas em `Write paths` não contêm mais `"pt-BR"` ou `ptBR` hardcoded.
- Stop: Parar se alguma assinatura ou campo existente usado pelos testes atuais (`monthlyTrend`, `monthlyData`, `monthLabels`, `days`, `summary`, `bills`, `receipt.data`) perder compatibilidade em `'pt'`.
- Resume: Retomar após restaurar o campo compatível em `'pt'` preservando os novos campos ISO aditivos.

Passos detalhados da execução:
1. **RED:** Criar `src/app/api/receipt/route.test.ts` (testando `receipt` de transação e compra civil em `pt`, `es`, `en` com moeda `BRL`, datas civis preservadas e erros 400/404 com `code`) e adicionar casos `es`/`en` nos testes de `dashboard/route.test.ts` (`monthKey`, erro de data localizada), `networth/route.test.ts` (`monthKey`), `balance-projection/route.test.ts` (`monthKeys`), `financial-calendar/route.test.ts` (`dateKey`, `dayOfWeek` em `en`/`es`), `upcoming-bills/route.test.ts` (`Fatura`/`Bill`, `Parcelamento`/`Installment`). Rodar a suíte focada com `bun --no-env-file test ...` e confirmar falha esperada nos casos `es`/`en` e `receipt/route.test.ts`.
2. **GREEN (Séries e agregações):** Atualizar `dashboard`, `quick-stats`, `networth`, `reports`, `balance-projection`, `expense-breakdown`, `transaction-analytics` e `goals-dashboard` usando `resolveRequestLocale(request)`, `formatServerMonthLabel`, `formatServerWeekdayShort`, `translateApiMessage`, `apiErrorResponse` e chaves ISO aditivas (`monthKey`, `monthKeys`, `estimatedCompletionKey`, `dayIndex`), removendo o import `ptBR` de `goals-dashboard/route.ts`.
3. **GREEN (Calendário, contas, recibo, timeline e dívidas):** Atualizar `financial-calendar`, `upcoming-bills`, `receipt`, `timeline` e `debts` usando `server-i18n.ts` (`formatServerWeekdayShort`, `dateKey`, `formatServerPurchaseDate`, `formatServerDate`, `formatServerCurrencyBRL`, `translateApiMessage`, `apiErrorResponse`), preservando `amountRaw`/`totalAmountRaw`/`totalPriceRaw`/`rawType`.
4. **Verificação:** Rodar todos os testes das rotas da Task 1.2 + `bun --no-env-file run typecheck` + `rg -n "pt-BR|ptBR" src/app/api/{dashboard,quick-stats,networth,reports,balance-projection,expense-breakdown,transaction-analytics,financial-calendar,goals-dashboard,upcoming-bills,receipt,timeline,debts}/route.ts` confirmando 0 ocorrências hardcoded.
- RED command and observed failure: `TZ=America/Bahia bun --no-env-file test ./src/app/api/dashboard/route.test.ts ./src/app/api/quick-stats/route.test.ts ./src/app/api/networth/route.test.ts ./src/app/api/balance-projection/route.test.ts ./src/app/api/financial-calendar/route.test.ts ./src/app/api/upcoming-bills/route.test.ts ./src/app/api/receipt/route.test.ts ./src/app/api/timeline/route.test.ts` -> exit 1 (`10 pass, 8 fail, 99 expect() calls` across 8 files).
- GREEN command and observed result: `TZ=America/Bahia bun --no-env-file test ./src/app/api/dashboard/route.test.ts ./src/app/api/quick-stats/route.test.ts ./src/app/api/networth/route.test.ts ./src/app/api/balance-projection/route.test.ts ./src/app/api/financial-calendar/route.test.ts ./src/app/api/upcoming-bills/route.test.ts ./src/app/api/receipt/route.test.ts ./src/app/api/timeline/route.test.ts` -> exit 0 (`18 pass, 0 fail, 165 expect() calls` across 8 files); `bun --no-env-file x eslint` nos 19 arquivos -> exit 0 (`0 errors`, 3 warnings pré-existentes); `rg -n "pt-BR|ptBR"` -> 0 ocorrências.
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: `ba24597efca8286aae806cdc9abe28df44c02b228d3907893d7b8c96a8aa8997` (revisão independente aprovada por `verifier-w1-10` em #343 e reconfirmada intacta por `verifier-w1-r2-10` em #355).
- Remaining gaps: none.

## Task 1.3: Rotas narrativas (`insights`, `forecast`, `achievements`, `savings-challenge`)

- Depends on: 1.1
- Needs: 1.1 => server-i18n-foundation-ready
- Outcome: Rotas `insights`, `forecast`, `achievements` e `savings-challenge` emitem todas as narrativas, métricas, títulos, descrições e alertas localizados em `pt`/`es`/`en` mantendo `BRL` contábil, enums originais e compatibilidade integral com `insights/route.test.ts` e `forecast/route.test.ts`.
- Owner/resolver: executor da Task 1.3; decisões materiais escaladas ao coordenador.
- Inputs: `src/app/api/{insights,forecast,achievements,savings-challenge}/route.ts`, `src/app/api/insights/route.test.ts`, `src/app/api/forecast/route.test.ts`.
- Produces: narrative-routes-i18n-ready
- Write paths: src/app/api/insights/route.ts, src/app/api/insights/route.test.ts, src/app/api/forecast/route.ts, src/app/api/forecast/route.test.ts, src/app/api/achievements/route.ts, src/app/api/achievements/route.test.ts, src/app/api/savings-challenge/route.ts, src/app/api/savings-challenge/route.test.ts
- Exclusions: src/lib/server-i18n.ts, src/lib/api-validation.ts, src/lib/purchase-date.ts, src/app/api/installments/route.test.ts, src/app/api/purchases/route-integrity.test.ts, src/app/api/consortiums/assembly.test.ts, src/app/api/savings/route.test.ts, db/custom.db
- Shared resources: none
- Acceptance: `bun --no-env-file test src/app/api/insights/route.test.ts src/app/api/forecast/route.test.ts src/app/api/achievements/route.test.ts src/app/api/savings-challenge/route.test.ts` passa com 0 falhas, validando `pt`, `es` e `en` além de todas as asserções originais em `'pt'`.
- Stop: Parar se qualquer asserção existente em `insights/route.test.ts` (`"70% completa"`, `"533,33/mês"`, `"9.0 meses"`) ou `forecast/route.test.ts` falhar.
- Resume: Retomar após ajustar as chaves de `'pt'` em `src/messages/pt/api.json` ou a interpolação de template mantendo exatidão dos termos em `'pt'`.

Passos detalhados da execução:
1. **RED:** Criar `src/app/api/achievements/route.test.ts` e `src/app/api/savings-challenge/route.test.ts` (cobrindo `GET()` sem args em `'pt'`, `GET(req)` em `'es'` e `'en'`, preservação de `id`/`icon`/`category` e `BRL`), e acrescentar casos `es`/`en` em `insights/route.test.ts` e `forecast/route.test.ts` (`monthKey`, `riskAlerts` e erro `?months=99` com `code`). Rodar os 4 arquivos de teste e confirmar falha esperada nos novos casos multilíngues.
2. **GREEN (`insights`):** Atualizar `src/app/api/insights/route.ts` para `GET(request?: NextRequest)`, usando `resolveRequestLocale(request)`, `formatServerCurrencyBRL`, `translateApiMessage` e `apiErrorResponse` para todos os 10 insights e erro 500, mantendo exatamente `"70% completa"`, `"533,33/mês"` e `"9.0 meses"` em `'pt'`.
3. **GREEN (`forecast`):** Atualizar `src/app/api/forecast/route.ts` para usar `resolveRequestLocale(request)`, `formatServerMonthLabel(..., { month: 'long', year: 'numeric' })`, `monthKey` aditivo, `translateApiMessage` para `"Outros"`, os 5 `riskAlerts` e erros 400/500 com `code`.
4. **GREEN (`achievements` & `savings-challenge`):** Atualizar ambas as rotas para `GET(request?: NextRequest)` localizando `title`/`description` das 12 conquistas e dos 3 desafios com `formatServerCurrencyBRL` e `apiErrorResponse` no erro 500.
5. **Verificação:** Rodar `bun --no-env-file test src/app/api/insights/route.test.ts src/app/api/forecast/route.test.ts src/app/api/achievements/route.test.ts src/app/api/savings-challenge/route.test.ts` e `bun --no-env-file run typecheck` confirmando `exit 0`.
- RED command and observed failure: `bun --no-env-file test ./src/app/api/insights/route.test.ts ./src/app/api/forecast/route.test.ts ./src/app/api/achievements/route.test.ts ./src/app/api/savings-challenge/route.test.ts` -> exit 1 (`4 pass, 11 fail, 55 expect() calls`).
- GREEN command and observed result: `bun --no-env-file test ./src/app/api/insights/route.test.ts ./src/app/api/forecast/route.test.ts ./src/app/api/achievements/route.test.ts ./src/app/api/savings-challenge/route.test.ts` -> exit 0 (`15 pass, 0 fail, 128 expect() calls`); `bun --no-env-file x eslint` nos 8 arquivos -> exit 0 (`0 errors`, 3 warnings pré-existentes); `rg -n "pt-BR|ptBR"` -> 0 ocorrências.
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: `ba24597efca8286aae806cdc9abe28df44c02b228d3907893d7b8c96a8aa8997` (revisão independente aprovada por `verifier-w1-10` em #343 e reconfirmada intacta por `verifier-w1-r2-10` em #355).
- Remaining gaps: none.

## Task 1.4: `/api/export`, `/api/advisor` e padronização de erros nas rotas CRUD

- Depends on: 1.1
- Needs: 1.1 => server-i18n-foundation-ready
- Outcome: `/api/export` gera CSV localizado aceitando `?locale=`, `/api/advisor` instrui o LLM e formata contexto em `pt`/`es`/`en` preservando `BRL` e defesa anti-injection, e todas as rotas CRUD padronizam mensagens localizadas (default `'pt'`) + `code` (`X-Error-Code` e JSON `{ error, code }`) preservando integralmente as 5 suítes `test:sqlite`.
- Owner/resolver: executor da Task 1.4; decisões materiais escaladas ao coordenador.
- Inputs: `src/app/api/export/route.ts`, `src/app/api/advisor/route.ts`, todas as rotas CRUD em `src/app/api/{purchases,accounts,budgets,monthly-budgets,cards,categories,transfer,transactions,installments,installments/pay,consortiums,consortiums/installments,savings,savings/deposit,recurring,recurring/process,investments,investments/transactions}/route.ts` e seus testes.
- Produces: export-advisor-crud-i18n-ready
- Write paths: src/app/api/export/route.ts, src/app/api/export/route.test.ts, src/app/api/advisor/route.ts, src/app/api/advisor/route.test.ts, src/app/api/purchases/route.ts, src/app/api/purchases/route.test.ts, src/app/api/accounts/route.ts, src/app/api/accounts/route.test.ts, src/app/api/budgets/route.ts, src/app/api/budgets/route.test.ts, src/app/api/monthly-budgets/route.ts, src/app/api/cards/route.ts, src/app/api/categories/route.ts, src/app/api/transfer/route.ts, src/app/api/transactions/route.ts, src/app/api/installments/route.ts, src/app/api/installments/pay/route.ts, src/app/api/consortiums/route.ts, src/app/api/consortiums/installments/route.ts, src/app/api/savings/route.ts, src/app/api/savings/deposit/route.ts, src/app/api/recurring/route.ts, src/app/api/recurring/process/route.ts, src/app/api/investments/route.ts, src/app/api/investments/transactions/route.ts, src/app/api/crud-i18n.test.ts
- Exclusions: src/lib/server-i18n.ts, src/lib/api-validation.ts, src/lib/purchase-date.ts, src/lib/purchase-date.test.ts, src/app/api/installments/route.test.ts, src/app/api/purchases/route-integrity.test.ts, src/app/api/consortiums/assembly.test.ts, src/app/api/savings/route.test.ts, db/custom.db
- Shared resources: none
- Acceptance: `bun --no-env-file run check` e `bun --no-env-file run test:sqlite` passam com exit 0 (0 falhas, 0 skips nas 5 suítes SQLite), `DATABASE_URL="file:/tmp/ci-build-inert.db" bun --no-env-file run build` conclui com exit 0, e testes cobrem `export`, `advisor` e CRUDs em `pt`, `es` e `en`.
- Stop: Parar imediatamente se `test:sqlite` falhar em qualquer uma das 5 suítes ou se houver divergência na neutralização CSV ou na delimitação `user_context`.
- Resume: Retomar após ajustar a guarda `hasExplicitLocaleSignal(request)` nos fluxos legados (`GET /api/installments?id=...` e `/api/purchases`) ou corrigir a regressão apontada no gate.

Passos detalhados da execução:
1. **RED:**
   - Adicionar testes em `src/app/api/export/route.test.ts` validando `?locale=en` e `?locale=es` (cabeçalhos, `Content-Disposition`, formato numérico/data civil `2026-11-25` -> `11/25/2026`, `In full`/`Al contado`, BOM `\uFEFF` e neutralização de fórmula) e erros 400 com `code`.
   - Adicionar testes em `src/app/api/advisor/route.test.ts` validando `?locale=en` e `?locale=es` (instrução de idioma, moeda `BRL`, `[Transfer]`/`[Transferencia]`, `(surplus)`/`(deficit)`, `<user_context>` sanitizado e ausência de `lastFourDigits`/emojis).
   - Adicionar testes em `accounts/route.test.ts`, `budgets/route.test.ts`, `purchases/route.test.ts` e criar `src/app/api/crud-i18n.test.ts` cobrindo erros localizados em `pt`/`es`/`en` com `code` + `X-Error-Code` para `cards`, `categories`, `transfer`, `transactions`, `monthly-budgets`, `installments`, `installments/pay`, `consortiums`, `consortiums/installments`, `savings`, `savings/deposit`, `recurring`, `recurring/process`, `investments`, `investments/transactions`.
   - Rodar os testes focados e confirmar falha esperada antes da implementação.
2. **GREEN (`/api/export`):** Atualizar `src/app/api/export/route.ts` para usar `resolveRequestLocale(request)`, traduzir cabeçalhos/enums/datas/números/nomes de arquivo via `server-i18n.ts` mantendo BOM `\uFEFF`, `;` e `escapeCsv`, e padronizar erros com `apiErrorResponse`.
3. **GREEN (`/api/advisor`):** Atualizar `src/app/api/advisor/route.ts` usando `resolveRequestLocale(request)`, localizando contexto financeiro, rótulos de status sem emojis e instrução do `systemPrompt` para `pt`/`es`/`en`, mantendo `BRL`, omissão de `lastFourDigits` e bloco `<user_context>` delimitado e truncado.
4. **GREEN (CRUDs):** Atualizar todas as rotas CRUD listadas em `Write paths` usando `resolveRequestLocale(request)`, `parseJsonBodyLocalized`, `mapPrismaErrorLocalized`, `translateApiMessage` e `apiErrorResponse`. Em `purchases/route.ts` (também ajustando `toLocaleLowerCase(INTL_LOCALE_MAP[locale])` no filtro de `merchant`) e em `GET /api/installments?id=...`, aplicar guarda `hasExplicitLocaleSignal(request)` para preservar payloads e strings literais legadas (com `X-Error-Code` no header) quando nenhum sinal de locale for enviado, mantendo 100% intactos `purchases/route-integrity.test.ts` e `installments/route.test.ts`.
5. **Verificação global:** Executar `bun --no-env-file run check`, `bun --no-env-file run test:sqlite`, `DATABASE_URL="file:/tmp/ci-build-inert.db" bun --no-env-file run build` e conferir `git status --short` sem alterações fora de `Write paths`.
- RED command and observed failure: `bun --no-env-file test ./src/app/api/export/route.test.ts ./src/app/api/advisor/route.test.ts ./src/app/api/accounts/route.test.ts ./src/app/api/budgets/route.test.ts ./src/app/api/purchases/route.test.ts ./src/app/api/crud-i18n.test.ts` -> exit 1 (`16 pass, 14 fail, 142 expect() calls` across 6 files).
- GREEN command and observed result: `bun --no-env-file test` nos 22 arquivos de teste da 1.4 -> exit 0 (`118 pass, 0 fail, 741 expect() calls`); `bun --no-env-file x eslint` nos 26 arquivos -> exit 0 (`0 errors, 0 warnings`); `bun --no-env-file run typecheck` -> exit 0; `bun --no-env-file run test:sqlite` -> exit 0 (`purchase-date (UTC)` 14/14, `purchase-date (America/Bahia)` 14/14, `installments/route` 4/4, `purchases/route-integrity` 6/6, `consortiums/assembly` 12/12, `savings/route` 10/10, 0 fail, 0 skips).
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: `ba24597efca8286aae806cdc9abe28df44c02b228d3907893d7b8c96a8aa8997` (revisão independente aprovada por `verifier-w1-10` em #343 e reconfirmada intacta por `verifier-w1-r2-10` em #355).
- Remaining gaps: none.
