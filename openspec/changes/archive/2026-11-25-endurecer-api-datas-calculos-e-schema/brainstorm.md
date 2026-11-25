# Exploração e Decisões — Endurecimento de API, Datas Civis, Cálculos Secundários e Schema Prisma

**Mapeamento e invocação de skills registradas:**
- `brainstorming` → `/home/marcelo-karval/.agents/skills/brainstorming/SKILL.md` (lido integralmente e aplicado na exploração do código real, definição de fronteiras da Onda 2 e descarte de YAGNI).
- `security-audit` (modo guidance) + `/home/marcelo-karval/.agents/SECURITY-REVIEW.md` (lidos integralmente e aplicados às fronteiras CSV formula injection, prompt injection/minimização de dados no advisor e bind/CORS do `finance-ws`).
- Política compartilhada: `/home/marcelo-karval/.agents/AGENTS.md` e `/home/marcelo-karval/.local/share/openspec/schemas/superpowers-bridge/README.md` (lidos integralmente).

## Diagnóstico Verificado no Workspace

1. **Helpers compartilhados ausentes (`src/app/api/**`):**
   - A maioria das rotas chama `await request.json()` diretamente dentro de `try/catch` genérico, retornando HTTP `500` em JSON malformado ou corpo não-objeto.
   - Falhas de FK (`P2003`) e registro ausente (`P2025`) não são mapeadas uniformemente (`500` no lugar de `400`/`404`), com atenção especial a `src/app/api/purchases/route-integrity.test.ts:122-127`, onde triggers SQLite `RAISE(ABORT)` são reportados pelo Prisma como `P2003` e o teste exige `500` para falhas de gatilho em `PUT`/`DELETE`. Logo, em `purchases`, devemos validar FKs opcionais (`cardId`, `accountId`, `categoryId`) explicitamente antes da escrita para retornar `400`, preservando o `500` quando um trigger/abort interno ocorrer em `PUT`/`DELETE`.
   - `new Date("YYYY-MM-DD")` cria `00:00:00.000Z`, e `.setHours(23, 59, 59, 999)` ajusta no fuso local. Em `America/Bahia` (UTC-3), `"2026-11-25"` vira `2026-11-24T23:59:59.999` local (`02:59:59.999Z` do dia 25), cortando o dia final em `dashboard/route.ts:22-23`, `transactions/route.ts:30-32` e `export/route.ts:37-39`.

2. **Datas civis e fórmulas secundárias:**
   - `src/app/api/timeline/route.ts:31-36,60,73,92` mistura limites locais (`setHours`) com chaves `.toISOString().split('T')[0]` (UTC), deslocando registros após 21h BRT para o dia seguinte; além disso, `isIncome = tx.type === 'INCOME'` trata `TRANSFER` no ramo `else` como despesa.
   - `src/app/api/forecast/route.ts:145-151` e `src/app/api/insights/route.ts:295` somam `recurringTransaction.amount` bruto como mensal sem normalizar `WEEKLY`, `BIWEEKLY`, `QUARTERLY` e `YEARLY`.
   - `src/app/api/insights/route.ts:26,124-125` e `src/app/api/balance-projection/route.ts:18,38,57` consultam `gte: month - 3` (incluindo até o mês atual parcial, somando até 4 meses) e dividem por `3`. O `midpoint` em `insights/route.ts:317` confirma que a intenção original são exatamente os 3 meses fechados anteriores (`[month - 3 .. month - 1]`).
   - `src/app/api/upcoming-bills/route.ts:12,130-134` sofre overflow em `new Date(y, m, card.dueDay)` para dias 29–31 (ex.: 31/fev vira 03/mar), joga `endOfWeek` para o próximo domingo quando hoje já é domingo (`7 - 0 = 7`), e lista cartões com `currentBalance <= 0`.

3. **Validação JSON/FK/`PUT` e atomicidade:**
   - `src/app/api/savings/deposit/route.ts:17,42-50` não valida `Number.isFinite(amount)` e soma fora de transação sem `{ increment: amount }`. Deve preservar o contrato verificado em `src/app/api/savings/route.test.ts:105-120`.
   - `src/app/api/monthly-budgets/route.ts:9-13,89-108` aceita `month`/`year` não numéricos no `GET` (`500`), não valida `Number.isFinite(amount)` e retorna `500` em `P2003` no `POST`.
   - As rotas `accounts`, `cards`, `categories`, `purchases`, `installments`, `consortiums`, `budgets`, `savings`, `recurring`, `investments` precisam padronizar JSON malformado (`400`), `P2003`/`P2025` (`400`/`404`) e replicar as validações de domínio de `POST` no `PUT` (preservando contratos de campos nulos testados em `savings/route.test.ts` e `consortiums/assembly.test.ts`).

4. **Hardening de bordas (CSV, Advisor, `finance-ws`):**
   - `src/app/api/export/route.ts:199-206`: `escapeCsv` não neutraliza prefixos de fórmula (`=`, `+`, `-`, `@`, `\t`, `\r`) nem cita `\r` na checagem de aspas.
   - `src/app/api/advisor/route.ts:45,125,154`: consulta e envia `lastFourDigits` ao modelo externo e interpola `context` arbitrário direto no `systemPrompt` sem limite de tamanho ou delimitação de dado não confiável. Deve preservar `(superávit)` / `(déficit)` sem emojis exigidos por `src/app/api/advisor/route.test.ts`.
   - `mini-services/finance-ws/index.ts:8-11,175`: faz `listen(3004)` em todas as interfaces (`0.0.0.0`/`::`) e configura `cors: { origin: '*' }`. Deve fazer bind em `127.0.0.1` (`HOST` configurável) e restringir `cors.origin` a lista local configurável (`FINANCE_WS_CORS_ORIGIN`), mantendo compatibilidade com `Caddyfile` (`XTransformPort=3004`) e `src/hooks/use-realtime.ts`.

5. **Schema Prisma (`prisma/schema.prisma`):**
   - Faltam `@@index` em FKs e colunas de filtro/data em `Transaction`, `Purchase`, `Installment`, `ConsortiumInstallment`, `InvestmentTransaction` e `RecurringTransaction`.
   - `Purchase.accountId`, `InstallmentPlan.accountId` e `Consortium.accountId` são `String?` sem `@relation(onDelete: SetNull)`. Verificação read-only em `db/custom.db` (`COUNT(*)`) confirmou `0` registros órfãos nessas 3 colunas.

## Abordagens Consideradas e Sequenciamento em Onda 2

- **Abordagem escolhida:** Criar um módulo pequeno e coeso `src/lib/api-validation.ts` com funções puras (`parseJsonBody`, `mapPrismaError`, `parseCivilDateStart`/`End`, `toLocalCivilDateKey`, `parsePositiveFiniteNumber`, `normalizeRecurringToMonthly`, `resolveCardDueDate`) e aplicá-lo incrementalmente por domínio em tasks independentes sem colisão de `Write paths`.
- **Alternativa rejeitada:** Reescrever todas as rotas com um framework de schema pesado (ex. wrappers genéricos acoplados com `zod` em todos os handlers de uma vez), o que aumentaria churn e risco de quebrar contratos específicos já cobertos por testes (`savings/route.test.ts`, `purchases/route-integrity.test.ts`, `consortiums/assembly.test.ts`, `installments/route.test.ts`).
- **Sequenciamento entre Waves:** Esta change pertence integralmente à **Onda 2** (após a conclusão da Change 2 `corrigir-transacoes-calculos-criticos-api` da Onda 1), evitando conflitos em `src/app/api/**`. Não toca em `quick-stats/route.ts`, `networth/route.ts`, `transfer/route.ts`, `installments/pay/route.ts`, `consortiums/installments/route.ts`, `recurring/process/route.ts`, `investments/transactions/route.ts` nem em `db/custom.db`.
