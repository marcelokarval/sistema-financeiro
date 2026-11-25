## Context

Esta mudança consolida as melhorias P2 de backend, datas civis, cálculos secundários, segurança de bordas (CSV, LLM prompt, WebSocket) e modelagem Prisma identificadas na auditoria do sistema financeiro pessoal. Ela é planejada para execução na **Onda 2**, estritamente após a conclusão da change de Onda 1 `corrigir-transacoes-calculos-criticos-api` (Change 2), que detém a correção transacional (`db.$transaction`, `TRANSFER`, `quick-stats`, `networth`).

O banco local `db/custom.db` permanece intocado e fora de qualquer `Write paths` ou manifesto de candidato. Uma verificação read-only (`COUNT(*)`) confirmou `0` registros com `accountId` órfão em `Purchase`, `InstallmentPlan` e `Consortium`.

## Goals / Non-Goals

**Goals:**
- Centralizar parsing JSON seguro (`400`), mapeamento de erros Prisma (`P2003` -> `400`, `P2025` -> `404`), validação numérica (`Number.isFinite`), parser de data civil `YYYY-MM-DD`, normalização de recorrências e cálculo de vencimento sem overflow em `src/lib/api-validation.ts`.
- Corrigir truncamento do dia final em fusos negativos (`America/Bahia` UTC-3) e chave civil UTC em `dashboard`, `timeline`, `export` e `transactions GET`.
- Corrigir normalização mensal de recorrências (`forecast`, `insights`), janela de 3 meses completos anteriores ao mês atual (`insights`, `balance-projection`) e regras de vencimento/domingo/fatura zero (`upcoming-bills`).
- Tornar `savings/deposit` atômico via `db.$transaction` + `{ increment }`, validar parâmetros de `monthly-budgets` e replicar validação de domínio e JSON/FK no `PUT` das 10 rotas CRUD restantes.
- Neutralizar formula injection CSV em `/api/export`, remover `lastFourDigits` e limitar/delimitar `context` em `/api/advisor`, e restringir bind loopback (`127.0.0.1`) e CORS local configurável em `mini-services/finance-ws`.
- Adicionar `@@index` em FKs/datas e `@relation(onDelete: SetNull)` em `Purchase`, `InstallmentPlan` e `Consortium` em `prisma/schema.prisma`.

**Non-Goals:**
- Alterar `quick-stats/route.ts`, `networth/route.ts`, `transfer/route.ts`, `installments/pay/route.ts`, `consortiums/installments/route.ts`, `recurring/process/route.ts` ou `investments/transactions/route.ts` (escopo exclusivo da Change 2 na Onda 1).
- Alterar `src/lib/purchase-date.ts` ou o contrato de data civil de exibição de `Purchase` já especificado em `integridade-fluxos-financeiros`.
- Introduzir autenticação multiusuário, migrar `Float` para inteiros/Decimal ou alterar `db/custom.db` diretamente.

## Decisions

### D1: Helpers puros e pequenos em `src/lib/api-validation.ts` sem acoplamento com framework
- **Escolha:** Criar `src/lib/api-validation.ts` com funções pequenas e puras (`parseJsonBody`, `mapPrismaError`, `parseCivilDateStart`, `parseCivilDateEnd`, `toLocalCivilDateKey`, `parseFiniteNumber`, `parsePositiveFiniteNumber`, `normalizeRecurringToMonthly`, `resolveCardDueDate`, `computeEndOfWeek`).
- **Razão:** Permite testar isoladamente todas as bordas de fuso horário (`America/Bahia` vs `UTC`), erros Prisma e calendário bissexto/dias 29–31 sem depender de SQLite em toda execução, mantendo legibilidade e reaproveitamento entre rotas.
- **Alternativa rejeitada:** Criar um wrapper genérico de handler HTTP acoplado a schemas `zod` para todas as rotas; rejeitado por risco de alterar mensagens e status esperados por testes existentes.

### D2: Preservação rigorosa dos contratos testados em `purchases`, `consortiums`, `installments`, `savings` e `advisor`
- **Escolha:**
  - Em `src/app/api/purchases/route.ts`, validar `cardId`, `accountId` e `categoryId` explicitamente antes da escrita para retornar `400` em FK ausente, mantendo o `catch` de `PUT`/`DELETE` retornando `500` quando triggers SQLite (`RAISE(ABORT)`) disparam `P2003` conforme exigido por `src/app/api/purchases/route-integrity.test.ts:122-127`.
  - Em `src/app/api/savings/route.ts`, manter a semântica de campos opcionais nulos (`description: null` -> `""`, `monthlyContribution: null` -> `0`) verificada por `src/app/api/savings/route.test.ts`.
  - Em `src/app/api/consortiums/route.ts`, preservar o contrato de `assembliesAttended` (`0..2_147_483_647`) e `nextAssemblyDate: null` de `src/app/api/consortiums/assembly.test.ts`.
  - Em `src/app/api/advisor/route.ts`, preservar `(superávit)` / `(déficit)` sem emojis exigidos por `src/app/api/advisor/route.test.ts`.
- **Razão:** Evitar regressões nos invariantes já ratificados pelas suítes do projeto.
- **Alternativa rejeitada:** Aplicar um `mapPrismaError` cego no `catch` de `purchases` `PUT`/`DELETE`, o que quebraria `route-integrity.test.ts`.

### D3: Datas civis `YYYY-MM-DD` no fuso local e janela fechada de 3 meses
- **Escolha:** Strings estritamente no formato `YYYY-MM-DD` são interpretadas no calendário civil local (`new Date(year, month - 1, day, 0, 0, 0, 0)` para início e `23, 59, 59, 999` para fim), enquanto timestamps completos com componente de hora continuam aceitos via `new Date(value)` validado. Em `timeline`, todas as chaves diárias usam `toLocalCivilDateKey(date)` (`YYYY-MM-DD` local) e ignoram `type === 'TRANSFER'` nos totais de receita/despesa. Em `insights` e `balance-projection`, a média trimestral usa `[month - 3 .. month - 1]` fechado (`lte: new Date(year, month, 0, 23, 59, 59, 999)`).
- **Razão:** Corrige o truncamento às 21h BRT sem exigir migração dos dados armazenados.
- **Alternativa rejeitada:** Alterar persistência de todas as datas no banco para UTC string, o que quebraria compatibilidade com registros existentes.

### D4: Normalização mensal de recorrências via fator anual padrão
- **Escolha:** `WEEKLY` = `amount * (52 / 12)`, `BIWEEKLY` = `amount * (26 / 12)`, `MONTHLY` = `amount`, `QUARTERLY` = `amount / 3`, `YEARLY` = `amount / 12`.
- **Razão:** Alinha todas as frequências suportadas pelo schema Prisma a uma base mensal comparável em `forecast` e `insights`.
- **Alternativa rejeitada:** Multiplicadores fixos `4` e `2`, que subestimam meses de 30/31 dias em ~8%.

### D5: Hardening de `export`, `advisor` e `finance-ws`
- **Escolha:**
  - `export/route.ts`: `escapeCsv` prefixa apóstrofo (`'`) antes de células cujo início corresponda a `=`, `+`, `-`, `@`, `\t` ou `\r` e envolve em aspas duplas se houver `"`, `;`, `\n` ou `\r`.
  - `advisor/route.ts`: remove `lastFourDigits` da query Prisma e do prompt; restringe `message` (`<= 2000` chars) e `context` (string opcional `<= 1000` chars, sanitizada contra quebras/delimitadores de seção e delimitada como dados não confiáveis do usuário no prompt).
  - `mini-services/finance-ws/config.ts` + `index.ts`: extrai `resolveFinanceWsConfig(env)` com `host` padrão `127.0.0.1` (`process.env.HOST`) e `corsOrigin` local configurável via `FINANCE_WS_CORS_ORIGIN` (default `['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:81', 'http://127.0.0.1:81']`, nunca `'*'`), permitindo testar `config.ts` via `bun test` na raiz sem depender de `socket.io` instalado fora de `mini-services/finance-ws`.
- **Razão:** Mitiga formula injection, exposição desnecessária de identificadores de cartão, prompt injection trivial e exposição de WebSocket em LAN mantendo o build standalone do `.zscripts/build.sh` íntegro.
- **Alternativa rejeitada:** Remover totalmente o campo `context` do `advisor`, que poderia quebrar clientes que enviam contexto de tela.

### D6: Sequenciamento Wave 2 para `transactions/route.ts` e validação do `prisma/schema.prisma`
- **Escolha:** Executar toda esta change na **Onda 2** após a Change 2. Em `src/app/api/transactions/route.ts` (modificado pela Change 2 no `POST`), a Task 2.1 ajusta apenas o filtro `from`/`to` do `GET` para usar `parseCivilDateStart`/`parseCivilDateEnd` e garante tratamento `400`/`404` consistente sem reverter a atomicidade do `POST` da Change 2. Em `prisma/schema.prisma`, adicionar os `@@index` solicitados e `@relation(fields: [accountId], references: [id], onDelete: SetNull)` em `Purchase`, `InstallmentPlan` e `Consortium`, validando via `prisma validate`, `bun run db:generate` e aplicação em SQLite descartável em `/tmp` (sem tocar `db/custom.db`).
- **Razão:** Elimina conflitos de merge/escrita entre Onda 1 e Onda 2 e garante integridade do schema antes de qualquer `db:push` manual do operador.
- **Alternativa rejeitada:** Editar `transactions/route.ts` em paralelo à Change 2 ou rodar `db:push` sobre `db/custom.db`.

## Risks / Trade-offs

- [Risk] `escapeCsv` prefixando `'` em strings iniciadas por `-` pode prefixar saldos negativos na exportação de contas (`a.balance < 0`). → Mitigation: Documentar que a neutralização estrita protege planilhas contra payloads `-cmd|...` / `-1+1`, atendendo integralmente ao requisito de segurança CSV; caso um consumidor precise de números não prefixados no futuro, exigirá decisão explícita.
- [Risk] Clientes externos acessando o app via IP/hostname customizado podem ser bloqueados pelo CORS default local do `finance-ws`. → Mitigation: Suportar `FINANCE_WS_CORS_ORIGIN` (lista separada por vírgulas) e `HOST` via variáveis de ambiente, mantendo o proxy Caddy local na porta `:81` funcionando por padrão.
- [Risk] `transactions/route.ts` alterado pela Change 2 antes da Onda 2 exige leitura prévia do arquivo atualizado ao executar a Task 2.1. → Mitigation: Definir explicitamente no `plan.md` a verificação do estado pós-Change 2 como pré-condição (`Inputs` e `Stop`/`Resume`) da Task 2.1.

## Migration Plan

1. Aguardar conclusão, verificação e integração da Change 2 (`corrigir-transacoes-calculos-criticos-api`) da Onda 1.
2. Executar a Task 1.1 (`src/lib/api-validation.ts` + testes) e validar RED/GREEN.
3. Executar as Tasks 2.1–4.3 (datas civis, fórmulas secundárias, validação CRUD + `savings/deposit` + `monthly-budgets`, hardening CSV/`advisor`/`finance-ws`) em frentes isoladas por arquivo.
4. Executar a Task 5.1 (`prisma/schema.prisma`), rodar `bun run db:generate`, `prisma validate`, validação DDL em `/tmp`, `bun --no-env-file run typecheck`, `bun --no-env-file run lint` e `bun --no-env-file test`.
5. Operador aplica `bun run db:push` explicitamente no ambiente local quando desejar sincronizar `db/custom.db` (fora do escopo automatizado).
