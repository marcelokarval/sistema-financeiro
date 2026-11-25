## ADDED Requirements

### Requirement: Helpers compartilhados de validação, Prisma e datas civis
O sistema MUST fornecer em `src/lib/api-validation.ts` helpers compartilhados para parse JSON seguro (HTTP 400 em corpo inválido), mapeamento Prisma (`P2003` -> 400, `P2025` -> 404), validação numérica finita, datas civis `YYYY-MM-DD` no fuso local, normalização mensal de recorrências e cálculo de vencimento sem overflow.

#### Scenario: Corpo JSON malformado ou não-objeto
- **WHEN** um handler de API chama `parseJsonBody` com corpo sintaticamente inválido, vazio ou primitivo não-objeto
- **THEN** o helper retorna falha estruturada com resposta HTTP 400 sem lançar exceção 500

#### Scenario: Erro Prisma de FK ou registro inexistente
- **WHEN** uma operação Prisma falha com código `P2003` ou `P2025`
- **THEN** `mapPrismaError` retorna HTTP 400 para `P2003` e HTTP 404 para `P2025`

#### Scenario: Data civil YYYY-MM-DD em fuso negativo
- **WHEN** `parseCivilDateStart("2026-11-25")` e `parseCivilDateEnd("2026-11-25")` são executados em `America/Bahia` (UTC-3) ou `UTC`
- **THEN** o início corresponde a `2026-11-25` às `00:00:00.000` local e o fim a `2026-11-25` às `23:59:59.999` local, sem retroceder ao dia 24

### Requirement: Datas civis consistentes em dashboard, timeline, exportação e transações
`GET /api/dashboard`, `GET /api/timeline`, `GET /api/export` e `GET /api/transactions` MUST interpretar filtros `YYYY-MM-DD` como limites do dia civil local, rejeitar datas inválidas com HTTP 400 e, em `/api/timeline`, agrupar pelo dia civil local sem tratar `TRANSFER` como despesa.

#### Scenario: Consulta no fuso America/Bahia no último dia do filtro
- **WHEN** uma transação ocorre às `22:30` BRT (`01:30Z` do dia seguinte) em `2026-11-25` e `GET /api/dashboard?from=2026-11-01&to=2026-11-25` ou `GET /api/timeline?days=7` é consultado
- **THEN** o filtro inclui o dia `2026-11-25` completo e `timeline` agrupa a transação na chave civil `2026-11-25`

#### Scenario: Filtro de data inválido em dashboard, export ou transactions
- **WHEN** `from`/`to` ou `startDate`/`endDate` recebe string inválida como `2026-02-30` ou `abc`
- **THEN** a rota responde HTTP 400 com mensagem de erro clara

### Requirement: Normalização mensal de recorrências e janela fechada de 3 meses
`GET /api/forecast` e `GET /api/insights` MUST normalizar recorrências ativas (`WEEKLY`, `BIWEEKLY`, `MONTHLY`, `QUARTERLY`, `YEARLY`) para equivalente mensal, e `GET /api/insights` e `GET /api/balance-projection` MUST restringir a média trimestral exatamente aos 3 meses fechados anteriores ao mês atual.

#### Scenario: Recorrências semanais e anuais normalizadas para base mensal
- **WHEN** existem recorrências ativas `WEEKLY` de `100` e `YEARLY` de `1200`
- **THEN** a contribuição mensal equivalente calculada é `100 * (52 / 12)` + `1200 / 12` tanto em `/api/forecast` quanto em `/api/insights`

#### Scenario: Janela fechada de 3 meses em insights e balance-projection
- **WHEN** a consulta ocorre no meio do mês corrente (ex.: `2026-11-15`) com dados em novembro e nos 3 meses anteriores (`ago`, `set`, `out`)
- **THEN** a média trimestral divide por 3 exclusivamente os lançamentos de `2026-08-01` a `2026-10-31 23:59:59.999`, excluindo lançamentos parciais de novembro

### Requirement: Cálculo seguro de vencimentos e faturas em upcoming-bills
`GET /api/upcoming-bills` MUST limitar `dueDay` ao último dia real do mês, manter `endOfWeek` no próprio dia quando executado no domingo e omitir cartões com `currentBalance <= 0`.

#### Scenario: Vencimento dia 31 em fevereiro, execução no domingo e fatura zerada
- **WHEN** um cartão ativo possui `dueDay = 31` em fevereiro de 2026, outro possui `currentBalance = 0` e a consulta ocorre em um domingo
- **THEN** o vencimento calculado para fevereiro é `2026-02-28`, o cartão com fatura zero não é listado em `bills` e `endOfWeek` encerra às `23:59:59.999` do próprio domingo

### Requirement: Atomicidade em savings/deposit e validação em monthly-budgets
`POST /api/savings/deposit` MUST validar `Number.isFinite(amount) > 0` e atualizar `currentAmount` com `{ increment: amount }` dentro de `db.$transaction`, e `/api/monthly-budgets` MUST validar `month`/`year` numéricos no `GET` e `Number.isFinite(amount)` e `P2003` (`400`) no `POST`/`PUT`.

#### Scenario: Depósito concorrente em caixinha sem lost update
- **WHEN** dois depósitos simultâneos de `50` são enviados via `POST /api/savings/deposit` para uma meta com `currentAmount = 10` e `targetAmount = 200`
- **THEN** ambos são aplicados atomicamente com `{ increment: 50 }` resultando em `currentAmount = 110`

#### Scenario: Parâmetros ou FK inválidos em monthly-budgets
- **WHEN** `GET /api/monthly-budgets?month=abc` ou `POST /api/monthly-budgets` com `categoryId` inexistente (`P2003`) é chamado
- **THEN** a rota responde HTTP 400 em vez de HTTP 500

### Requirement: Validação uniforme JSON, FK e PUT nas rotas CRUD
As rotas CRUD `accounts`, `cards`, `categories`, `purchases`, `installments`, `consortiums`, `budgets`, `savings`, `recurring` e `investments` MUST retornar HTTP 400 para JSON malformado ou FK inválida e replicar no `PUT` as validações de domínio do `POST`, preservando os contratos testados existentes.

#### Scenario: PUT rejeita dados inválidos com HTTP 400
- **WHEN** `PUT /api/accounts` recebe `name: "   "`, `PUT /api/savings` recebe `targetAmount: -10` ou `PUT /api/recurring` recebe `amount: "NaN"`
- **THEN** a rota rejeita a atualização com HTTP 400 sem alterar o registro persistido

#### Scenario: FK inexistente em POST ou PUT retorna HTTP 400
- **WHEN** `POST` ou `PUT` de uma rota CRUD referencia um `categoryId`, `accountId` ou `cardId` inexistente
- **THEN** a rota responde HTTP 400 em vez de HTTP 500, preservando o retorno HTTP 500 apenas para triggers SQLite de integridade interna em `purchases`

### Requirement: Hardening de exportação CSV, prompt do advisor e servidor finance-ws
`GET /api/export` MUST neutralizar formula injection CSV (`=`, `+`, `-`, `@`, `\t`, `\r`), `POST /api/advisor` MUST omitir `lastFourDigits` e limitar e delimitar `context` como dado não confiável, e `mini-services/finance-ws` MUST usar bind padrão `127.0.0.1` e `cors.origin` local configurável sem `'*'`.

#### Scenario: Célula CSV com prefixo de fórmula é neutralizada
- **WHEN** uma transação ou compra possui descrição iniciada por `=SUM(A1)`, `+1+1`, `-cmd`, `@SUM`, `\t` ou `\r`
- **THEN** o CSV exportado neutraliza a célula com prefixo `'` antes do caractere inicial e cita células contendo `\r`

#### Scenario: Prompt do advisor omite lastFourDigits e delimita context
- **WHEN** `POST /api/advisor` é chamado com cartões cadastrados e um `context` enviado pelo cliente
- **THEN** o `systemPrompt` não contém os dígitos `lastFourDigits` de nenhum cartão, trunca `context` em no máximo 1000 caracteres e o encapsula em delimitadores explícitos de dado não confiável

#### Scenario: Configuração padrão do finance-ws restringe interface e CORS
- **WHEN** `resolveFinanceWsConfig({})` é avaliado sem variáveis de ambiente externas
- **THEN** `host` é `"127.0.0.1"` e `corsOrigin` é uma lista explícita de origens locais sem wildcard `"*"`

### Requirement: Índices de consulta e integridade referencial no Prisma Schema
`prisma/schema.prisma` MUST definir `@@index` em FKs e colunas de filtro/data em `Transaction`, `Purchase`, `Installment`, `ConsortiumInstallment`, `InvestmentTransaction` e `RecurringTransaction`, além de `@relation(onDelete: SetNull)` nos `accountId` opcionais de `Purchase`, `InstallmentPlan` e `Consortium`, sem alterar `db/custom.db`.

#### Scenario: Schema Prisma válido com índices e relações SetNull
- **WHEN** `prisma validate`, `bun run db:generate` e a geração de DDL em banco SQLite descartável são executados
- **THEN** todas as validações concluem sem erro, os índices esperados e as FKs `ON DELETE SET NULL` constam no DDL gerado e `db/custom.db` permanece inalterado
