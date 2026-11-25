# Implementation plan

Bridge task contract: 1

**Goal:** Endurecer validação JSON/FK/PUT, datas civis sem truncamento em fusos negativos, fórmulas secundárias de projeção/vencimentos, bordas de segurança (CSV, advisor, finance-ws) e índices/relações do schema Prisma na Onda 2 após a Change 2.
**Architecture:** Centralizar helpers puros em `src/lib/api-validation.ts` (`parseJsonBody`, `mapPrismaError`, `parseCivilDateStart`, `parseCivilDateEnd`, `toLocalCivilDateKey`, `parseFiniteNumber`, `parsePositiveFiniteNumber`, `normalizeRecurringToMonthly`, `resolveCardDueDate`, `computeEndOfWeek`) e aplicá-los por domínio com isolamento de `Write paths`, preservando os contratos testados em `purchases`, `consortiums`, `installments`, `savings`, `monthly-budgets`, `advisor` e `insights`, sem alterar `db/custom.db` nem arquivos exclusivos da Change 2.
**Skill mapping and observed invocation:** `brainstorming` (`/home/marcelo-karval/.agents/skills/brainstorming/SKILL.md`), `writing-plans` (`/home/marcelo-karval/.agents/skills/writing-plans/SKILL.md`), `security-audit` em modo guidance (`/home/marcelo-karval/.agents/skills/security-audit/SKILL.md` + `/home/marcelo-karval/.agents/SECURITY-REVIEW.md`), `test-driven-development` (`/home/marcelo-karval/.agents/skills/test-driven-development/SKILL.md`, obrigatório durante a aplicação).
**Wave sequencing:** Execução estritamente em **Onda 2**, após conclusão e integração da Change 2 (`corrigir-transacoes-calculos-criticos-api`), evitando colisão em `src/app/api/**` (em especial `src/app/api/transactions/route.ts`).

## Task 1.1: Implementar helpers compartilhados em src/lib/api-validation.ts com testes unitários

- Depends on: none
- Needs: none
- Outcome: Módulo `src/lib/api-validation.ts` exportando helpers testados para parse JSON seguro (HTTP 400), mapeamento Prisma (`P2003` -> 400, `P2025` -> 404), validação numérica finita, datas civis `YYYY-MM-DD`, chave civil local, normalização mensal de recorrências, vencimento seguro de cartão e fim de semana no domingo.
- Owner/resolver: Executor de aplicação Onda 2 / Coordenador
- Inputs: `openspec/changes/endurecer-api-datas-calculos-e-schema/design.md`, `src/lib/purchase-date.ts`
- Produces: api-validation-helpers
- Write paths: src/lib/api-validation.ts, src/lib/api-validation.test.ts
- Exclusions: db/custom.db, src/lib/purchase-date.ts
- Shared resources: none
- Acceptance: `bun --no-env-file test ./src/lib/api-validation.test.ts` e `TZ=America/Bahia bun --no-env-file test ./src/lib/api-validation.test.ts` e `TZ=UTC bun --no-env-file test ./src/lib/api-validation.test.ts` passam integralmente, e `bun --no-env-file run typecheck` passa com zero erros.
- Stop: Conflito com assinaturas já usadas em `src/lib/purchase-date.ts` ou falha de tipagem em NextRequest/NextResponse.
- Resume: Alinhamento de assinatura com `src/lib/purchase-date.ts` e reexecução dos testes em ambos os fusos.
- RED command and observed failure: `bun --no-env-file test ./src/lib/api-validation.test.ts` -> saída 1 (`error: Cannot find module './api-validation'`, 0 aprovados, 1 reprovação, 1 erro).
- GREEN command and observed result: `TZ=America/Bahia bun --no-env-file test ./src/lib/api-validation.test.ts` (28 aprovados, 0 reprovações, 114 expect), `TZ=UTC bun --no-env-file test ./src/lib/api-validation.test.ts` (28 aprovados, 0 reprovações, 114 expect), `./node_modules/.bin/tsc --noEmit` (saída 0) e `./node_modules/.bin/eslint` nos arquivos de escopo (saída 0).
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: `verifier-apply-6` (Fase 2 sobre o candidato final pós-`#274`).
- Remaining gaps: nenhum (QA integrado `#274` aprovado; revisão independente Fase 2 solicitada sobre o candidato final).

Passos TDD:
1. Escrever testes falhando em `src/lib/api-validation.test.ts` cobrindo:
   - `parseJsonBody`: JSON válido objeto retorna `{ ok: true, data }`; JSON malformado, corpo vazio, `null`, array ou primitivo retorna `{ ok: false, response }` com status `400`.
   - `mapPrismaError`: objeto/erro com `code: 'P2003'` retorna status `400`; `code: 'P2025'` retorna status `404`; outros erros retornam `null`.
   - `parseCivilDateStart` e `parseCivilDateEnd`: para `"2026-11-25"`, retorna início `00:00:00.000` local e fim `23:59:59.999` local tanto em `America/Bahia` quanto em `UTC`; rejeita `"2026-02-30"` e `"invalida"` com `null`.
   - `toLocalCivilDateKey`: `2026-11-26T01:30:00Z` gera `"2026-11-25"` em `America/Bahia` e `"2026-11-26"` em `UTC`.
   - `normalizeRecurringToMonthly`: `WEEKLY` (`* 52 / 12`), `BIWEEKLY` (`* 26 / 12`), `MONTHLY` (`* 1`), `QUARTERLY` (`/ 3`), `YEARLY` (`/ 12`).
   - `resolveCardDueDate`: `dueDay = 31` em fevereiro de 2026 retorna `2026-02-28`, em fevereiro de 2024 retorna `2024-02-29`; avança para o mês seguinte quando já passou de `todayStart`.
   - `computeEndOfWeek`: quando `now` é domingo (`getDay() === 0`), retorna `23:59:59.999` do próprio domingo (não +7 dias).
2. Executar `bun --no-env-file test ./src/lib/api-validation.test.ts` (RED esperado: módulo inexistente).
3. Implementar `src/lib/api-validation.ts` com as assinaturas:
```ts
export async function parseJsonBody<T extends Record<string, unknown> = Record<string, unknown>>(
  request: Request,
  errorMessage?: string
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }>;
export function mapPrismaError(
  error: unknown,
  messages?: { fk?: string; notFound?: string }
): NextResponse | null;
export function parseCivilDateStart(value: string): Date | null;
export function parseCivilDateEnd(value: string): Date | null;
export function toLocalCivilDateKey(date: Date): string;
export function parseFiniteNumber(value: unknown): number | null;
export function parsePositiveFiniteNumber(value: unknown): number | null;
export function normalizeRecurringToMonthly(amount: number, frequency: string): number;
export function resolveCardDueDate(year: number, month: number, dueDay: number): Date;
export function computeEndOfWeek(reference: Date): Date;
```
4. Executar `TZ=America/Bahia bun --no-env-file test ./src/lib/api-validation.test.ts` e `TZ=UTC bun --no-env-file test ./src/lib/api-validation.test.ts` (GREEN esperado).

## Task 2.1: Corrigir filtro de data civil e chave local em dashboard, timeline e transactions GET

- Depends on: 1.1
- Needs: 1.1 => api-validation-helpers
- Outcome: `GET /api/dashboard`, `GET /api/timeline` e `GET /api/transactions` interpretam datas civis `YYYY-MM-DD` sem cortar o dia final em fusos negativos, `timeline` usa chave civil local `YYYY-MM-DD` e ignora `TRANSFER` nos totais, e `transactions` valida JSON/FK consistentemente preservando a atomicidade do `POST` da Change 2.
- Owner/resolver: Executor de aplicação Onda 2 / Coordenador
- Inputs: Change 2 (`corrigir-transacoes-calculos-criticos-api`) já integrada em `src/app/api/transactions/route.ts` e `src/app/api/timeline/route.ts`
- Produces: civil-date-queries-fixed
- Write paths: src/app/api/dashboard/route.ts, src/app/api/dashboard/route.test.ts, src/app/api/timeline/route.ts, src/app/api/timeline/route.test.ts, src/app/api/transactions/route.ts, src/app/api/transactions/route.test.ts
- Exclusions: db/custom.db, src/app/api/quick-stats/route.ts, src/app/api/networth/route.ts
- Shared resources: wave2-post-change2
- Acceptance: `TZ=America/Bahia bun --no-env-file test ./src/app/api/dashboard/route.test.ts ./src/app/api/timeline/route.test.ts ./src/app/api/transactions/route.test.ts` passa com 0 falhas.
- Stop: Change 2 ainda não tiver sido aplicada em `src/app/api/transactions/route.ts` ou `src/app/api/timeline/route.ts`, ou regressão nos testes existentes de `transactions/route.test.ts`.
- Resume: Confirmar integração da Change 2 e reler `src/app/api/transactions/route.ts` e `src/app/api/timeline/route.ts` antes de editar.
- RED command and observed failure: `TZ=America/Bahia bun --no-env-file test ./src/app/api/dashboard/route.test.ts ./src/app/api/timeline/route.test.ts ./src/app/api/transactions/route.test.ts ./src/app/api/forecast/route.test.ts ./src/app/api/insights/route.test.ts ./src/app/api/balance-projection/route.test.ts ./src/app/api/upcoming-bills/route.test.ts` -> saída 1 (`8 pass, 11 fail, 66 expect() calls` em 7 arquivos; 11 novos testes falharam pelos motivos esperados na suíte da sub-onda 2B).
- GREEN command and observed result: `TZ=America/Bahia` e `TZ=UTC` na mesma suíte de 7 arquivos (19 aprovados, 0 reprovações, 94 expect em 7 arquivos), `./node_modules/.bin/tsc --noEmit` (saída 0) e `./node_modules/.bin/eslint` nos 14 arquivos de escopo (saída 0, 0 erros, 4 avisos pré-existentes em `insights/route.ts` e `upcoming-bills/route.ts`).
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: `verifier-apply-6` (Fase 2 sobre o candidato final pós-`#274`).
- Remaining gaps: nenhum (QA integrado `#274` aprovado; revisão independente Fase 2 solicitada sobre o candidato final).

Passos TDD:
1. Reler `src/app/api/transactions/route.ts` e `src/app/api/timeline/route.ts` pós-Change 2 para preservar integralmente as correções de `POST` e tratamento de `TRANSFER`.
2. Escrever testes falhando em `src/app/api/dashboard/route.test.ts`, `src/app/api/timeline/route.test.ts` e adicionar casos em `src/app/api/transactions/route.test.ts` usando SQLite isolado em `mkdtempSync` cobrindo:
   - `dashboard`: `from=2026-11-25&to=2026-11-25` inclui transação às `2026-11-25T23:30:00` local (`2026-11-26T02:30Z` em `America/Bahia`) e retorna `400` para data inválida.
   - `timeline`: transação às `2026-11-25T22:30` local é agrupada em `date === '2026-11-25'` (não `'2026-11-26'`) e registros `TRANSFER` não somam como despesa.
   - `transactions GET`: `from=2026-11-01&to=2026-11-25` inclui transação no fim do dia `2026-11-25` em `America/Bahia`, retorna `400` para data `from`/`to` inválida, e `POST`/`PUT` retornam `400` em JSON inválido ou `P2003`.
3. Rodar os testes para confirmar RED.
4. Atualizar `src/app/api/dashboard/route.ts`, `src/app/api/timeline/route.ts` e `src/app/api/transactions/route.ts` utilizando `parseCivilDateStart`, `parseCivilDateEnd`, `toLocalCivilDateKey`, `parseJsonBody` e `mapPrismaError`.
5. Rodar `TZ=America/Bahia bun --no-env-file test ./src/app/api/dashboard/route.test.ts ./src/app/api/timeline/route.test.ts ./src/app/api/transactions/route.test.ts` (GREEN esperado).

## Task 2.2: Normalizar frequências recorrentes e janela de 3 meses completos em forecast, insights e balance-projection

- Depends on: 1.1
- Needs: 1.1 => api-validation-helpers
- Outcome: `GET /api/forecast` e `GET /api/insights` normalizam `WEEKLY`, `BIWEEKLY`, `QUARTERLY` e `YEARLY` para equivalente mensal; `GET /api/insights` e `GET /api/balance-projection` calculam médias trimestrais exclusivamente sobre os 3 meses fechados anteriores ao mês atual.
- Owner/resolver: Executor de aplicação Onda 2 / Coordenador
- Inputs: `src/app/api/forecast/route.ts`, `src/app/api/insights/route.ts`, `src/app/api/balance-projection/route.ts`
- Produces: forecast-insights-projection-fixed
- Write paths: src/app/api/forecast/route.ts, src/app/api/forecast/route.test.ts, src/app/api/insights/route.ts, src/app/api/insights/route.test.ts, src/app/api/balance-projection/route.ts, src/app/api/balance-projection/route.test.ts
- Exclusions: db/custom.db, src/app/api/quick-stats/route.ts, src/app/api/networth/route.ts
- Shared resources: none
- Acceptance: `bun --no-env-file test ./src/app/api/forecast/route.test.ts ./src/app/api/insights/route.test.ts ./src/app/api/balance-projection/route.test.ts` passa incluindo os testes preexistentes de `insights/route.test.ts`.
- Stop: Divergência de contrato de resposta esperado pelos widgets frontend consumidores.
- Resume: Conferir formato de resposta JSON consumido em `cash-flow-forecast.tsx`, `financial-insights.tsx` e `balance-projection.tsx`.
- RED command and observed failure: `TZ=America/Bahia bun --no-env-file test ./src/app/api/dashboard/route.test.ts ./src/app/api/timeline/route.test.ts ./src/app/api/transactions/route.test.ts ./src/app/api/forecast/route.test.ts ./src/app/api/insights/route.test.ts ./src/app/api/balance-projection/route.test.ts ./src/app/api/upcoming-bills/route.test.ts` -> saída 1 (`8 pass, 11 fail, 66 expect() calls` em 7 arquivos; 11 novos testes falharam pelos motivos esperados na suíte da sub-onda 2B).
- GREEN command and observed result: `TZ=America/Bahia` e `TZ=UTC` na mesma suíte de 7 arquivos (19 aprovados, 0 reprovações, 94 expect em 7 arquivos), `./node_modules/.bin/tsc --noEmit` (saída 0) e `./node_modules/.bin/eslint` nos 14 arquivos de escopo (saída 0, 0 erros, 4 avisos pré-existentes em `insights/route.ts` e `upcoming-bills/route.ts`).
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: `verifier-apply-6` (Fase 2 sobre o candidato final pós-`#274`).
- Remaining gaps: nenhum (QA integrado `#274` aprovado; revisão independente Fase 2 solicitada sobre o candidato final).

Passos TDD:
1. Escrever testes falhando em `src/app/api/forecast/route.test.ts`, `src/app/api/balance-projection/route.test.ts` e adicionar novos casos em `src/app/api/insights/route.test.ts` (com `setSystemTime` fixado em `2026-11-15T12:00:00Z`) cobrindo:
   - `forecast`: recorrência `WEEKLY` de `100` e `YEARLY` de `1200` contribuem com `100 * (52/12) + 100` no cálculo mensal projetado.
   - `insights`: recorrência `WEEKLY` de `100` exibe equivalente mensal normalizado no card `recurring-summary`, e média `emergency-fund` / `category-overspend` usa janela `[2026-08-01 .. 2026-10-31 23:59:59.999]`, ignorando gastos parciais de novembro na média trimestral.
   - `balance-projection`: `avgMonthlyIncome` e `avgMonthlyExpense` consideram apenas `[2026-08-01 .. 2026-10-31 23:59:59.999]` dividido por `3`, sem incluir lançamentos de novembro na média dos 3 meses fechados.
2. Executar os 3 arquivos de teste e confirmar RED.
3. Atualizar `forecast/route.ts`, `insights/route.ts` e `balance-projection/route.ts` usando `normalizeRecurringToMonthly` e limite superior `threeCompleteMonthsEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)`.
4. Reexecutar os 3 arquivos de teste e confirmar GREEN (garantindo que os testes preexistentes em `insights/route.test.ts` continuam passando).

## Task 2.3: Corrigir vencimento de cartão, fim de semana no domingo e fatura zero em upcoming-bills

- Depends on: 1.1
- Needs: 1.1 => api-validation-helpers
- Outcome: `GET /api/upcoming-bills` evita overflow em dias 29–31 via `resolveCardDueDate`, calcula `endOfWeek` no próprio domingo via `computeEndOfWeek` e ignora cartões com `currentBalance <= 0`.
- Owner/resolver: Executor de aplicação Onda 2 / Coordenador
- Inputs: `src/app/api/upcoming-bills/route.ts`
- Produces: upcoming-bills-fixed
- Write paths: src/app/api/upcoming-bills/route.ts, src/app/api/upcoming-bills/route.test.ts
- Exclusions: db/custom.db
- Shared resources: none
- Acceptance: `bun --no-env-file test ./src/app/api/upcoming-bills/route.test.ts` passa com 0 falhas.
- Stop: Ambiguidade na ordenação ou cálculo de `daysUntilDue` em `upcoming-bills`.
- Resume: Reconciliar formato de `Bill` e `summary` com `src/app/api/upcoming-bills/route.ts`.
- RED command and observed failure: `TZ=America/Bahia bun --no-env-file test ./src/app/api/dashboard/route.test.ts ./src/app/api/timeline/route.test.ts ./src/app/api/transactions/route.test.ts ./src/app/api/forecast/route.test.ts ./src/app/api/insights/route.test.ts ./src/app/api/balance-projection/route.test.ts ./src/app/api/upcoming-bills/route.test.ts` -> saída 1 (`8 pass, 11 fail, 66 expect() calls` em 7 arquivos; 11 novos testes falharam pelos motivos esperados na suíte da sub-onda 2B).
- GREEN command and observed result: `TZ=America/Bahia` e `TZ=UTC` na mesma suíte de 7 arquivos (19 aprovados, 0 reprovações, 94 expect em 7 arquivos), `./node_modules/.bin/tsc --noEmit` (saída 0) e `./node_modules/.bin/eslint` nos 14 arquivos de escopo (saída 0, 0 erros, 4 avisos pré-existentes em `insights/route.ts` e `upcoming-bills/route.ts`).
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: `verifier-apply-6` (Fase 2 sobre o candidato final pós-`#274`).
- Remaining gaps: nenhum (QA integrado `#274` aprovado; revisão independente Fase 2 solicitada sobre o candidato final).

Passos TDD:
1. Escrever testes falhando em `src/app/api/upcoming-bills/route.test.ts` usando `setSystemTime` cobrindo:
   - Cartão com `dueDay: 31` e `currentBalance: 450` consultado em `2026-02-10` gera vencimento em fevereiro (`2026-02-28`), não março.
   - Cartão com `currentBalance: 0` não aparece em `bills`.
   - Consulta no domingo (`2026-11-22T12:00:00Z`) contabiliza em `summary.thisWeek` apenas contas até `2026-11-22 23:59:59.999`, excluindo contas da segunda-feira seguinte (`2026-11-23`).
2. Rodar `bun --no-env-file test ./src/app/api/upcoming-bills/route.test.ts` e confirmar RED.
3. Atualizar `src/app/api/upcoming-bills/route.ts` usando `computeEndOfWeek`, `resolveCardDueDate` e `if (card.currentBalance <= 0) continue;`.
4. Rodar `bun --no-env-file test ./src/app/api/upcoming-bills/route.test.ts` e confirmar GREEN.

## Task 3.1: Tornar savings/deposit atômico em transação e endurecer validação de monthly-budgets

- Depends on: 1.1
- Needs: 1.1 => api-validation-helpers
- Outcome: `POST /api/savings/deposit` valida `Number.isFinite(amount)` positivo e aplica `{ increment: amount }` + conclusão dentro de `db.$transaction`; `GET /api/monthly-budgets` valida `month`/`year` numéricos (HTTP 400) e `POST`/`PUT` validam `Number.isFinite(amount)` e `P2003` (HTTP 400).
- Owner/resolver: Executor de aplicação Onda 2 / Coordenador
- Inputs: `src/app/api/savings/deposit/route.ts`, `src/app/api/savings/route.test.ts`, `src/app/api/monthly-budgets/route.ts`, `src/app/api/monthly-budgets/route.test.ts`
- Produces: savings-deposit-and-monthly-budgets-hardened
- Write paths: src/app/api/savings/deposit/route.ts, src/app/api/savings/deposit/route.test.ts, src/app/api/monthly-budgets/route.ts, src/app/api/monthly-budgets/route.test.ts
- Exclusions: db/custom.db, src/app/api/savings/route.test.ts
- Shared resources: none
- Acceptance: `bun --no-env-file test ./src/app/api/savings/deposit/route.test.ts ./src/app/api/monthly-budgets/route.test.ts` passa e a suíte opt-in `savings/route.test.ts` permanece compatível.
- Stop: Quebra no formato de resposta esperado por `src/app/api/savings/route.test.ts:105-120`.
- Resume: Ajustar retorno de `deposit/route.ts` mantendo exatamente `{ ...updatedGoal, depositAmount, depositDescription, goalCompleted }`.
- RED command and observed failure: `bun --no-env-file test ./src/app/api/savings/deposit/route.test.ts ./src/app/api/monthly-budgets/route.test.ts ./src/app/api/accounts/route.test.ts ./src/app/api/cards/route.test.ts ./src/app/api/categories/route.test.ts ./src/app/api/budgets/route.test.ts ./src/app/api/savings/validation.test.ts ./src/app/api/investments/route.test.ts` -> saída 1 (`7 pass, 19 fail, 67 expect() calls` em 8 arquivos da frente 3.1/3.2; falhas esperadas em JSON inválido, valores inválidos e `P2003`).
- GREEN command and observed result: mesma suíte de 8 arquivos da frente 3.1/3.2 (26 aprovados, 0 reprovações, 229 expect), `./node_modules/.bin/tsc --noEmit` (saída 0) e `./node_modules/.bin/eslint` nos 16 arquivos de escopo (saída 0, 0 erros).
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: `verifier-apply-6` (Fase 2 sobre o candidato final pós-`#274`).
- Remaining gaps: nenhum (QA integrado `#274` aprovado; revisão independente Fase 2 solicitada sobre o candidato final).

Passos TDD:
1. Escrever testes falhando em `src/app/api/savings/deposit/route.test.ts` e adicionar novos casos em `src/app/api/monthly-budgets/route.test.ts` cobrindo:
   - `savings/deposit`: rejeita JSON inválido, `amount` `NaN`/`Infinity`/`<= 0` com `400`, meta ausente com `404`, e dois depósitos concorrentes via `Promise.all` somam ambos os valores sem lost update, marcando `isCompleted: true` ao atingir `targetAmount`.
   - `monthly-budgets`: `GET ?month=abc&year=2026` e `GET ?month=13&year=2026` retornam `400`; `POST` com JSON inválido, `amount: "NaN"` ou `categoryId` inexistente (`P2003`) retorna `400`; `PUT` com `amount <= 0` ou JSON inválido retorna `400`.
2. Executar os testes e confirmar RED.
3. Atualizar `src/app/api/savings/deposit/route.ts` (`parseJsonBody`, `parsePositiveFiniteNumber`, `db.$transaction` com `{ increment: parsedAmount }`) e `src/app/api/monthly-budgets/route.ts` (validação numérica estrita + `parseJsonBody` + `mapPrismaError`).
4. Reexecutar os testes e confirmar GREEN.

## Task 3.2: Padronizar validação JSON, FK e PUT em accounts, cards, categories, budgets, savings e investments

- Depends on: 1.1
- Needs: 1.1 => api-validation-helpers
- Outcome: Rotas CRUD `accounts`, `cards`, `categories`, `budgets`, `savings` e `investments` retornam HTTP 400 para JSON malformado e FK inválida (`P2003`), HTTP 404 para `P2025`, e aplicam no `PUT` as mesmas regras de domínio do `POST`, preservando os contratos de nulos de `savings/route.test.ts`.
- Owner/resolver: Executor de aplicação Onda 2 / Coordenador
- Inputs: `src/app/api/accounts/route.ts`, `src/app/api/cards/route.ts`, `src/app/api/categories/route.ts`, `src/app/api/budgets/route.ts`, `src/app/api/savings/route.ts`, `src/app/api/investments/route.ts`, `src/app/api/savings/route.test.ts`
- Produces: core-crud-routes-hardened
- Write paths: src/app/api/accounts/route.ts, src/app/api/accounts/route.test.ts, src/app/api/cards/route.ts, src/app/api/cards/route.test.ts, src/app/api/categories/route.ts, src/app/api/categories/route.test.ts, src/app/api/budgets/route.ts, src/app/api/budgets/route.test.ts, src/app/api/savings/route.ts, src/app/api/savings/validation.test.ts, src/app/api/investments/route.ts, src/app/api/investments/route.test.ts
- Exclusions: db/custom.db, src/app/api/savings/route.test.ts, src/app/api/investments/transactions/route.ts, src/app/api/transfer/route.ts
- Shared resources: none
- Acceptance: `bun --no-env-file test ./src/app/api/accounts/route.test.ts ./src/app/api/cards/route.test.ts ./src/app/api/categories/route.test.ts ./src/app/api/budgets/route.test.ts ./src/app/api/savings/validation.test.ts ./src/app/api/investments/route.test.ts` passa com 0 falhas.
- Stop: Regressão no comportamento de campos nulos exigido por `src/app/api/savings/route.test.ts`.
- Resume: Verificar mapeamento de `null` vs `undefined` em `savings/route.ts` e revalidar.
- RED command and observed failure: `bun --no-env-file test ./src/app/api/savings/deposit/route.test.ts ./src/app/api/monthly-budgets/route.test.ts ./src/app/api/accounts/route.test.ts ./src/app/api/cards/route.test.ts ./src/app/api/categories/route.test.ts ./src/app/api/budgets/route.test.ts ./src/app/api/savings/validation.test.ts ./src/app/api/investments/route.test.ts` -> saída 1 (`7 pass, 19 fail, 67 expect() calls` em 8 arquivos da frente 3.1/3.2; falhas esperadas em JSON inválido, valores inválidos e `P2003`).
- GREEN command and observed result: mesma suíte de 8 arquivos da frente 3.1/3.2 (26 aprovados, 0 reprovações, 229 expect), `./node_modules/.bin/tsc --noEmit` (saída 0) e `./node_modules/.bin/eslint` nos 16 arquivos de escopo (saída 0, 0 erros).
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: `verifier-apply-6` (Fase 2 sobre o candidato final pós-`#274`).
- Remaining gaps: nenhum (QA integrado `#274` aprovado; revisão independente Fase 2 solicitada sobre o candidato final).

Passos TDD:
1. Escrever suítes `route.test.ts` / `validation.test.ts` para cada uma das 6 rotas cobrindo:
   - `POST`/`PUT`/`DELETE` com JSON inválido retornando `400`.
   - `PUT` rejeitando `name: "   "`, números inválidos (`NaN`, `targetAmount <= 0`, `closingDay`/`dueDay` fora de `1..31` em `cards`) e enums inválidos com `400`.
   - FK inválida (`categoryId` ou `accountId` inexistente, quando aplicável em `budgets`, `savings`, `investments`) retornando `400` (`P2003`).
   - Preservação explícita em `savings/validation.test.ts` de `PUT` com `description: null`, `monthlyContribution: null` e `yieldRate: null` retornando `200` com defaults `""`/`0`.
2. Executar as 6 suítes e confirmar RED.
3. Atualizar `accounts/route.ts`, `cards/route.ts`, `categories/route.ts`, `budgets/route.ts`, `savings/route.ts` e `investments/route.ts` com `parseJsonBody`, `mapPrismaError` e helpers numéricos/data.
4. Reexecutar as 6 suítes e confirmar GREEN.

## Task 3.3: Padronizar validação JSON, FK e PUT em purchases, installments, consortiums e recurring

- Depends on: 1.1
- Needs: 1.1 => api-validation-helpers
- Outcome: Rotas `purchases`, `installments`, `consortiums` e `recurring` retornam HTTP 400 para JSON malformado, validações numéricas/data inválidas no `POST` e `PUT`, e FK inválida (`400`), preservando os contratos de `purchases/route-integrity.test.ts`, `consortiums/assembly.test.ts` e `installments/route.test.ts`.
- Owner/resolver: Executor de aplicação Onda 2 / Coordenador
- Inputs: `src/app/api/purchases/route.ts`, `src/app/api/purchases/route-integrity.test.ts`, `src/app/api/installments/route.ts`, `src/app/api/installments/route.test.ts`, `src/app/api/consortiums/route.ts`, `src/app/api/consortiums/assembly.test.ts`, `src/app/api/recurring/route.ts`
- Produces: credit-and-recurring-crud-hardened
- Write paths: src/app/api/purchases/route.ts, src/app/api/purchases/validation.test.ts, src/app/api/installments/route.ts, src/app/api/installments/validation.test.ts, src/app/api/consortiums/route.ts, src/app/api/consortiums/validation.test.ts, src/app/api/recurring/route.ts, src/app/api/recurring/route.test.ts
- Exclusions: db/custom.db, src/app/api/purchases/route-integrity.test.ts, src/app/api/consortiums/assembly.test.ts, src/app/api/installments/route.test.ts, src/app/api/installments/pay/route.ts, src/app/api/consortiums/installments/route.ts, src/app/api/recurring/process/route.ts
- Shared resources: none
- Acceptance: `bun --no-env-file test ./src/app/api/purchases/validation.test.ts ./src/app/api/purchases/route.test.ts ./src/app/api/installments/validation.test.ts ./src/app/api/consortiums/validation.test.ts ./src/app/api/recurring/route.test.ts` passa com 0 falhas e preserva o contrato `500` para trigger `RAISE(ABORT)` em `purchases`.
- Stop: Risco de `mapPrismaError` transformar o trigger `RAISE(ABORT)` de `purchases/route-integrity.test.ts` (`P2003`) em `400` em vez de `500`.
- Resume: Em `purchases/route.ts`, validar `cardId`/`accountId`/`categoryId` existentes antes da escrita (retornando `400` para FK inexistente) e não mapear `P2003` no `catch` de `PUT`/`DELETE`.
- RED command and observed failure: `bun --no-env-file test ./src/app/api/purchases/validation.test.ts ./src/app/api/installments/validation.test.ts ./src/app/api/consortiums/validation.test.ts ./src/app/api/recurring/route.test.ts` -> saída 1 (`12 pass, 29 fail, 64 expect() calls` em 4 arquivos).
- GREEN command and observed result: `bun --no-env-file test ./src/app/api/purchases/validation.test.ts ./src/app/api/purchases/route.test.ts ./src/app/api/installments/validation.test.ts ./src/app/api/consortiums/validation.test.ts ./src/app/api/recurring/route.test.ts` (43 aprovados, 0 reprovações, 156 expect em 5 arquivos), `./node_modules/.bin/tsc --noEmit` (saída 0) e `./node_modules/.bin/eslint` nos 8 arquivos de escopo (saída 0, 0 erros).
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: `verifier-apply-6` (Fase 2 sobre o candidato final pós-`#274`).
- Remaining gaps: nenhum (QA integrado `#274` aprovado; revisão independente Fase 2 solicitada sobre o candidato final).

Passos TDD:
1. Escrever testes falhando em `purchases/validation.test.ts`, `installments/validation.test.ts`, `consortiums/validation.test.ts` e `recurring/route.test.ts` cobrindo:
   - JSON inválido em `POST`/`PUT`/`DELETE` retornando `400`.
   - `PUT` validando campos editados (`merchant`/`description` não vazios, valores numéricos finitos positivos, datas válidas, enums `type`/`frequency` em `recurring`, `paidInstallments` dentro de `0..installmentCount` em `installments`, mantendo `assembliesAttended` em `consortiums`).
   - FK inválida (`cardId`/`accountId`/`categoryId`) retornando `400` (em `purchases` via validação explícita antes de `create`/`update`, sem capturar `P2003` de trigger no `PUT`/`DELETE`).
2. Rodar os 4 arquivos de teste e confirmar RED.
3. Atualizar `purchases/route.ts`, `installments/route.ts`, `consortiums/route.ts` e `recurring/route.ts`.
4. Rodar os 4 arquivos de teste mais `purchases/route.test.ts` e confirmar GREEN.

## Task 4.1: Neutralizar formula injection CSV e corrigir filtro de data civil em /api/export

- Depends on: 1.1
- Needs: 1.1 => api-validation-helpers
- Outcome: `GET /api/export` neutraliza células CSV iniciadas por `=`, `+`, `-`, `@`, `\t` ou `\r`, aplica `parseCivilDateStart`/`parseCivilDateEnd` aos parâmetros `startDate`/`endDate` e retorna HTTP 400 para intervalo/data inválido.
- Owner/resolver: Executor de aplicação Onda 2 / Coordenador
- Inputs: `src/app/api/export/route.ts`
- Produces: export-csv-hardened
- Write paths: src/app/api/export/route.ts, src/app/api/export/route.test.ts
- Exclusions: db/custom.db
- Shared resources: none
- Acceptance: `TZ=America/Bahia bun --no-env-file test ./src/app/api/export/route.test.ts` passa com 0 falhas.
- Stop: Quebra no BOM UTF-8 ou separador `;` esperado pelo Excel brasileiro.
- Resume: Garantir preservação do BOM `\uFEFF` e delimitador `;` em `buildCsv`.
- RED command and observed failure: `TZ=America/Bahia bun --no-env-file test ./src/app/api/export/route.test.ts` -> saída 1 (`0 pass, 3 fail, 6 expect() calls` em 1 arquivo).
- GREEN command and observed result: `TZ=America/Bahia bun --no-env-file test ./src/app/api/export/route.test.ts` (3 aprovados, 0 reprovações, 24 expect em 1 arquivo), `./node_modules/.bin/tsc --noEmit` (saída 0) e `./node_modules/.bin/eslint` nos 2 arquivos de escopo (saída 0, 0 erros).
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: `verifier-apply-6` (Fase 2 sobre o candidato final pós-`#274`).
- Remaining gaps: nenhum (QA integrado `#274` aprovado; revisão independente Fase 2 solicitada sobre o candidato final).

Passos TDD:
1. Escrever testes falhando em `src/app/api/export/route.test.ts` cobrindo:
   - Neutralização de formula injection para células iniciadas por `=SUM(A1)`, `+1+1`, `-cmd|'/C calc'!A0`, `@SUM(1,2)`, `\t=1` e `\r=1` (prefixo `'` presente no CSV, além de aspas quando contém `;`, `"`, `\n` ou `\r`).
   - Filtro `startDate=2026-11-25&endDate=2026-11-25` em `America/Bahia` inclui lançamento às `22:30` local; `startDate` ou `endDate` inválido retorna `400`.
2. Executar `bun --no-env-file test ./src/app/api/export/route.test.ts` e confirmar RED.
3. Atualizar `escapeCsv` e `buildDateFilter` em `src/app/api/export/route.ts`.
4. Executar `TZ=America/Bahia bun --no-env-file test ./src/app/api/export/route.test.ts` e confirmar GREEN.

## Task 4.2: Omitir lastFourDigits e limitar e delimitar context no prompt de /api/advisor

- Depends on: 1.1
- Needs: 1.1 => api-validation-helpers
- Outcome: `POST /api/advisor` não consulta nem inclui `lastFourDigits` no prompt enviado ao LLM, usa `parseJsonBody`, limita tamanho de `message` (`<= 2000`) e `context` (`<= 1000`), e encapsula `context` como dado não confiável sem quebrar `(superávit)`/`(déficit)` sem emojis.
- Owner/resolver: Executor de aplicação Onda 2 / Coordenador
- Inputs: `src/app/api/advisor/route.ts` (pós-Change 2), `src/app/api/advisor/route.test.ts`
- Produces: advisor-prompt-hardened
- Write paths: src/app/api/advisor/route.ts, src/app/api/advisor/route.test.ts
- Exclusions: db/custom.db
- Shared resources: none
- Acceptance: `bun --no-env-file test ./src/app/api/advisor/route.test.ts` passa com todos os cenários antigos e novos em GREEN.
- Stop: Falha em preservar os testes preexistentes de `(superávit)` / `(déficit)` sem emojis em `advisor/route.test.ts`.
- Resume: Conferir template do `financialContext` e reexecutar `advisor/route.test.ts`.
- RED command and observed failure: `bun --no-env-file test ./src/app/api/advisor/route.test.ts` -> saída 1 (`3 pass, 3 fail, 17 expect() calls` em 1 arquivo).
- GREEN command and observed result: `bun --no-env-file test ./src/app/api/advisor/route.test.ts` (6 aprovados, 0 reprovações, 29 expect em 1 arquivo), `./node_modules/.bin/tsc --noEmit` (saída 0) e `./node_modules/.bin/eslint` nos 2 arquivos de escopo (saída 0, 0 erros, 1 aviso pré-existente em `src/app/api/advisor/route.ts:71`).
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: `verifier-apply-6` (Fase 2 sobre o candidato final pós-`#274`).
- Remaining gaps: nenhum (QA integrado `#274` aprovado; revisão independente Fase 2 solicitada sobre o candidato final).

Passos TDD:
1. Adicionar testes falhando em `src/app/api/advisor/route.test.ts` cobrindo:
   - Cartão cadastrado com `lastFourDigits: "9876"` não tem `"9876"` nem `"****9876"` presentes no `systemPrompt`.
   - `context` maior que 1000 chars ou contendo sequências de controle/delimitadores é truncado e encapsulado em bloco delimitado de dados não confiáveis (com instrução no `systemPrompt` para tratar esse bloco apenas como dado).
   - JSON malformado retorna `400`; `message` vazia ou acima de 2000 chars retorna `400`.
2. Executar `bun --no-env-file test ./src/app/api/advisor/route.test.ts` e confirmar RED.
3. Atualizar `src/app/api/advisor/route.ts` removendo `lastFourDigits` do `select` e do `financialContext`, aplicando `parseJsonBody`, validação de tamanho e delimitação explícita de `context`.
4. Executar `bun --no-env-file test ./src/app/api/advisor/route.test.ts` e confirmar GREEN.

## Task 4.3: Restringir bind loopback e CORS configurável em mini-services/finance-ws

- Depends on: none
- Needs: none
- Outcome: `mini-services/finance-ws` resolve configuração explícita em `config.ts` com `host` padrão `127.0.0.1` (`HOST` configurável) e `corsOrigin` restrito a origens locais configuráveis via `FINANCE_WS_CORS_ORIGIN` (sem `'*'`), consumida por `index.ts`.
- Owner/resolver: Executor de aplicação Onda 2 / Coordenador
- Inputs: `mini-services/finance-ws/index.ts`, `Caddyfile`, `src/hooks/use-realtime.ts`
- Produces: finance-ws-loopback-cors-hardened
- Write paths: mini-services/finance-ws/config.ts, mini-services/finance-ws/config.test.ts, mini-services/finance-ws/index.ts
- Exclusions: db/custom.db, Caddyfile, src/hooks/use-realtime.ts
- Shared resources: port:3004
- Acceptance: `bun --no-env-file test ./mini-services/finance-ws/config.test.ts` e `bun --no-env-file run lint` passam com 0 erros, e `mini-services/finance-ws/index.ts` usa `host` e `corsOrigin` retornados por `resolveFinanceWsConfig(process.env)`.
- Stop: Quebra no build standalone de `.zscripts/build.sh` ao importar `./config` de `mini-services/finance-ws/index.ts`.
- Resume: Confirmar sintaxe compatível com `bun build index.ts --target bun` e revalidar.
- RED command and observed failure: `bun --no-env-file test ./mini-services/finance-ws/config.test.ts` -> saída 1 (`error: Cannot find module './config'`, 0 aprovados, 1 reprovação, 1 erro).
- GREEN command and observed result: `bun --no-env-file test ./mini-services/finance-ws/config.test.ts` (3 aprovados, 0 reprovações, 11 expect), `./node_modules/.bin/tsc --noEmit` (saída 0) e `./node_modules/.bin/eslint` nos arquivos de escopo (saída 0).
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: `verifier-apply-6` (Fase 2 sobre o candidato final pós-`#274`).
- Remaining gaps: nenhum (QA integrado `#274` aprovado; revisão independente Fase 2 solicitada sobre o candidato final).

Passos TDD:
1. Escrever testes falhando em `mini-services/finance-ws/config.test.ts` cobrindo:
   - Sem env vars: `host === "127.0.0.1"`, `port === 3004`, `corsOrigin` igual a `["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:81", "http://127.0.0.1:81"]` (nunca `"*"`).
   - Com `HOST="127.0.0.2"`, `PORT="3010"` e `FINANCE_WS_CORS_ORIGIN="http://localhost:3000, https://finance.local"`: retorna os valores configurados e ignora entradas vazias ou `"*"`.
2. Executar `bun --no-env-file test ./mini-services/finance-ws/config.test.ts` e confirmar RED.
3. Criar `mini-services/finance-ws/config.ts` com `resolveFinanceWsConfig(env)` e atualizar `mini-services/finance-ws/index.ts` para usar `cors: { origin: wsConfig.corsOrigin, methods: ['GET', 'POST'] }` e `httpServer.listen(wsConfig.port, wsConfig.host, ...)`.
4. Executar `bun --no-env-file test ./mini-services/finance-ws/config.test.ts` e confirmar GREEN.

## Task 5.1: Adicionar índices e onDelete SetNull em prisma/schema.prisma e executar validação completa da change

- Depends on: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3
- Needs: 2.1 => civil-date-queries-fixed
- Needs: 2.2 => forecast-insights-projection-fixed
- Needs: 2.3 => upcoming-bills-fixed
- Needs: 3.1 => savings-deposit-and-monthly-budgets-hardened
- Needs: 3.2 => core-crud-routes-hardened
- Needs: 3.3 => credit-and-recurring-crud-hardened
- Needs: 4.1 => export-csv-hardened
- Needs: 4.2 => advisor-prompt-hardened
- Needs: 4.3 => finance-ws-loopback-cors-hardened
- Outcome: `prisma/schema.prisma` contém todos os `@@index` em FKs/colunas de filtro/data e `@relation(fields: [accountId], references: [id], onDelete: SetNull)` em `Purchase`, `InstallmentPlan` e `Consortium`, validado via `prisma validate`, `bun run db:generate`, DDL em SQLite descartável em `/tmp` e suíte completa de regressão sem modificar `db/custom.db`.
- Owner/resolver: Executor de aplicação Onda 2 / Coordenador
- Inputs: `prisma/schema.prisma`
- Produces: prisma-schema-indexed-and-validated
- Write paths: prisma/schema.prisma
- Exclusions: db/custom.db
- Shared resources: prisma-schema
- Acceptance: `bunx prisma validate`, `bun run db:generate`, aplicação do DDL gerado por `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` em SQLite temporário em `/tmp`, `bun --no-env-file run typecheck`, `bun --no-env-file run lint` e `bun --no-env-file test` passam sem alterações em `db/custom.db`.
- Stop: Erro de relação inversa ou conflito de nome de índice no `prisma validate`.
- Resume: Corrigir declarações de relação inversa em `Account` / nomes de índices em `prisma/schema.prisma` e revalidar.
- RED command and observed failure: `bunx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script | grep -E "CREATE INDEX|Purchase_accountId_fkey|InstallmentPlan_accountId_fkey|Consortium_accountId_fkey" | wc -l` -> `0` (ausência dos 20 índices `*_idx` e das 3 FKs `ON DELETE SET NULL`).
- GREEN command and observed result: `bunx prisma validate` (schema válido), `bun run db:generate` (Prisma Client v6.19.2 gerado), DDL aplicado em SQLite temporário em `/tmp` via `sqlite3` confirmando 20 índices `*_idx` e 3 FKs `ON DELETE SET NULL` com remoção imediata do temporário, `./node_modules/.bin/tsc --noEmit` (saída 0), `bun --no-env-file run lint` (saída 0, 0 erros, 18 avisos pré-existentes), `bun --no-env-file test` (533 aprovados, 0 reprovações, 3504 expect em 57 arquivos, 41 cenários opt-in SQLite via `test:sqlite`) e `db/custom.db` intacto; QA integrado `#274` aprovou `bun --no-env-file run check` (`exit 0`), `TZ=America/Bahia` nas 5 suítes de data civil (`42` aprovados, `0` reprovações), `test:sqlite` (`54` aprovados, `0` reprovações em 6 runs `bwrap`) e `build` isolado (`41/41` páginas estáticas).
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: `verifier-apply-6` (Fase 2 sobre o candidato final pós-`#274`).
- Remaining gaps: nenhum (QA integrado `#274` aprovado; revisão independente Fase 2 solicitada sobre o candidato final).

Passos TDD:
1. Verificar estado atual antes da edição: confirmar via `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` que os índices (`Transaction_*_idx`, `Purchase_*_idx`, `Installment_*_idx`, `ConsortiumInstallment_*_idx`, `InvestmentTransaction_*_idx`, `RecurringTransaction_*_idx`) e as FKs `Purchase_accountId_fkey`, `InstallmentPlan_accountId_fkey`, `Consortium_accountId_fkey` com `ON DELETE SET NULL` estão ausentes (RED estrutural).
2. Atualizar `prisma/schema.prisma` adicionando:
   - Em `Account`: relações inversas `purchases Purchase[]`, `installmentPlans InstallmentPlan[]`, `consortiums Consortium[]`.
   - Em `Purchase`, `InstallmentPlan`, `Consortium`: `account Account? @relation(fields: [accountId], references: [id], onDelete: SetNull)`.
   - Índices `@@index`:
     - `Transaction`: `[date]`, `[type, date]`, `[accountId]`, `[categoryId]`, `[cardId]`
     - `Purchase`: `[date]`, `[cardId]`, `[accountId]`, `[categoryId]`
     - `Installment`: `[installmentPlanId]`, `[status, dueDate]`
     - `ConsortiumInstallment`: `[consortiumId]`, `[status, dueDate]`
     - `InvestmentTransaction`: `[investmentId]`, `[accountId]`, `[date]`
     - `RecurringTransaction`: `[isActive, nextDate]`, `[accountId]`, `[categoryId]`, `[cardId]`
3. Rodar `bunx prisma validate`, `bun run db:generate` e testar a geração e execução do DDL em `/tmp` via `sqlite3` descartável (removendo o `/tmp` após o check) confirmando índices e `ON DELETE SET NULL` sem tocar em `db/custom.db` (GREEN).
4. Rodar verificação global pós-edição: `bun --no-env-file run typecheck && bun --no-env-file run lint && bun --no-env-file test`.
