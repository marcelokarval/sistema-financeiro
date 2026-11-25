## Why

Diversas rotas da API retornam erro 500 para JSON malformado, chaves estrangeiras inexistentes ou parâmetros inválidos, truncam consultas de datas civis em fusos negativos como America/Bahia e distorcem projeções de recorrências, vencimentos e janelas trimestrais. Além disso, a exportação CSV não neutraliza fórmulas, o prompt do advisor expõe os últimos dígitos dos cartões com contexto livre e o schema Prisma carece de índices e integridade referencial. Esta mudança endurece validação, cálculos secundários, bordas e schema na Onda 2 após a change crítica de transações.

## What Changes

**Helpers compartilhados de validação, datas civis e recorrências**
- From: Parse inline de `request.json()`, `new Date("YYYY-MM-DD")` + `setHours(23,59,59,999)` e tratamento inconsistente de códigos Prisma por rota.
- To: Helpers compartilhados em `src/lib/api-validation.ts` (`parseJsonBody`, `mapPrismaError`, `parseCivilDateStart`/`parseCivilDateEnd`, `toLocalCivilDateKey`, `parsePositiveFiniteNumber`, `normalizeRecurringToMonthly`, `resolveCardDueDate`) com suíte unitária dedicada.
- Reason: Eliminar HTTP 500 em payloads inválidos, corte do último dia em UTC-3 e duplicação de regras entre rotas.
- Impact: Non-breaking para consumidores válidos; entradas inválidas passam a receber 400/404 previsíveis.

**Datas civis e fórmulas secundárias**
- From: `dashboard`, `timeline` e `transactions GET` sofrem deslocamento UTC; `forecast` e `insights` somam recorrências sem normalização mensal; `insights` e `balance-projection` dividem até 4 meses por 3; `upcoming-bills` sofre overflow nos dias 29–31, avança semana no domingo e lista cartões zerados.
- To: Chaves e filtros civis consistentes no fuso local, normalização mensal (`WEEKLY`, `BIWEEKLY`, `QUARTERLY`, `YEARLY`), janela exata de 3 meses fechados anteriores ao mês corrente e cálculo seguro de vencimentos e faturas não nulas.
- Reason: Garantir precisão nas projeções, gráficos e alertas financeiros.
- Impact: Non-breaking no contrato JSON; corrige valores calculados sem alterar `quick-stats` ou `networth` (Change 2).

**Atomicidade e validação uniforme em rotas CRUD, `savings/deposit` e `monthly-budgets`**
- From: `savings/deposit` atualiza saldo sem `$transaction` nem `{ increment }`; `monthly-budgets` falha com 500 em parâmetros não numéricos ou FK inválida; rotas CRUD não replicam validações de domínio no `PUT`.
- To: Depósito atômico em `db.$transaction` com `{ increment }`, validação numérica estrita em `monthly-budgets` e validação JSON/FK/`PUT` uniforme em `accounts`, `cards`, `categories`, `purchases`, `installments`, `consortiums`, `budgets`, `savings`, `recurring` e `investments`.
- Reason: Prevenir lost updates e corrupção silenciosa de estado via `PUT`.
- Impact: Non-breaking para clientes válidos; preserva contratos testados em `savings`, `purchases`, `consortiums` e `installments`.

**Hardening CSV, `advisor` e `finance-ws`**
- From: `export` permite formula injection CSV (`=`, `+`, `-`, `@`, `\t`, `\r`); `advisor` inclui `lastFourDigits` e interpola `context` sem limite/delimitação; `finance-ws` escuta em todas as interfaces com `cors.origin: '*'`.
- To: Prefixação defensiva no CSV e filtro de data civil em `export`, remoção de `lastFourDigits` e delimitação/limite de `context` em `advisor`, e bind em `127.0.0.1` com CORS local configurável em `mini-services/finance-ws`.
- Reason: Reduzir exposição local de dados, risco de prompt injection e execução de fórmulas em planilhas.
- Impact: Non-breaking para operação local padrão via Caddy/Next.js.

**Índices e integridade referencial no Prisma Schema**
- From: `prisma/schema.prisma` sem `@@index` em FKs/datas e sem `@relation(onDelete: SetNull)` em `Purchase.accountId`, `InstallmentPlan.accountId` e `Consortium.accountId`.
- To: Adição de índices de consulta e relações `SetNull` com validação via `prisma validate` e `db:generate` (sem alterar `db/custom.db`).
- Reason: Melhorar escalabilidade de consultas e integridade referencial ao excluir contas.
- Impact: Non-breaking no cliente Prisma gerado; sincronização do banco local continua explícita fora desta entrega.

## Capabilities

### New Capabilities
- `robustez-api-datas-e-schema`: Padroniza parsing JSON, mapeamento Prisma (`P2003`/`P2025`), datas civis sem truncamento em fusos negativos, fórmulas secundárias de projeção/vencimentos, endurecimento de rotas CRUD, CSV, `advisor`, `finance-ws` e índices/relações do schema Prisma.

### Modified Capabilities

## Impact

- **Código afetado:** `src/lib/api-validation.ts`, `src/app/api/{dashboard,timeline,transactions,forecast,insights,balance-projection,upcoming-bills,savings/deposit,monthly-budgets,accounts,cards,categories,purchases,installments,consortiums,budgets,savings,recurring,investments,export,advisor}/route.ts`, `mini-services/finance-ws/{index,config}.ts`, `prisma/schema.prisma` e respectivas suítes `*.test.ts`.
- **Dependência entre waves:** Execução estritamente em **Onda 2**, após conclusão da Change 2 (`corrigir-transacoes-calculos-criticos-api`), evitando conflito de escrita em `src/app/api/**`.
- **Exclusões preservadas:** `db/custom.db`, `src/app/api/quick-stats/route.ts`, `src/app/api/networth/route.ts`, `src/app/api/transfer/route.ts`, `src/app/api/installments/pay/route.ts`, `src/app/api/consortiums/installments/route.ts`, `src/app/api/recurring/process/route.ts` e `src/app/api/investments/transactions/route.ts`.
