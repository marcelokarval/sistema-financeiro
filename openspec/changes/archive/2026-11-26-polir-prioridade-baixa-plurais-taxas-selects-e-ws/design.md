## Context

Esta mudança constitui o **Pacote 3 (Prioridade Baixa / Polimento — Itens #19 a #22)** e executa após a integração dos Pacotes 1 e 2 (`corrigir-prioridade-alta-resumo-i18n-e-cartoes` e `aprimorar-prioridade-media-a11y-validacoes-e-fluxos`).

A base atual possui:
- Fundação `next-intl` em `src/i18n/{config,messages,types,request,provider}.ts(x)` com fallback seguro para `'pt'` e 18 namespaces UI em `src/messages/{pt,es,en}/`.
- Formatadores localizados em `src/lib/helpers.ts` (`currencyFmt`, `shortCurrency`, `dateFmt`, `dateShortFmt`, `percentFmt`).
- Gate AST `.zscripts/check-frontend-architecture.ts` com 6 entradas em `.zscripts/frontend-architecture-baseline.json` e aviso `large-tsx-file` acima de 500 linhas.
- Hook `src/hooks/use-realtime.ts` usando `socket.io-client` (`SOCKET_URL = '/?XTransformPort=3004'`) e `useSyncExternalStore` (com `SERVER_SNAPSHOT` cacheado pelo Pacote 1 `#1`).

## Goals / Non-Goals

**Goals:**
- Garantir ramo `=0` em todas as chaves `, plural,` dos catálogos `src/messages/pt/*.json` mantendo 100% da paridade estrutural e de placeholders com `es` e `en` (`#19`).
- Formatar todas as taxas percentuais e percentuais decimais em `src/components/finance/` via `Intl.NumberFormat` no `locale` ativo (`#20`), sem duplicar formatadores em `src/lib/helpers.ts`.
- Disponibilizar opção explícita `"Nenhum(a)"` (`none` → `''` → `null` quando aplicável) nos selects opcionais de `InvestmentEditor` e `InstallmentPlanEditor` (`#21`).
- Tornar a reconexão automática de `useRealtime` finita (`reconnectionAttempts = 3`), com backoff exponencial e fallback silencioso quando `:3004` estiver ausente (`#22`), preservando `reconnect()` manual e `SERVER_SNAPSHOT`.
- Preservar `0` erros no `arch:check` (6/6 identidades do baseline) e manter todos os arquivos atualmente `<= 500` linhas abaixo de 500 linhas.

**Non-Goals:**
- Não editar `src/components/ui/**` (componentes shadcn/ui), `src/app/api/**`, `mini-services/finance-ws/**` ou `db/custom.db`.
- Não alterar conversão monetária (`BRL` fixo), fórmulas financeiras ou contratos HTTP de listagem/criação existentes.
- Não editar chaves de `es` ou `en` para `#19`, pois nesses idiomas CLDR `one` aplica-se apenas a `1` e `0` já resolve para `other`.

## Decisions

### D1: Ramo `=0` em todas as 41 chaves (42 cláusulas `, plural,`) sem `=0` de `src/messages/pt/*.json` (`#19`)
- **Escolha:** Atualizar as 41 chaves (42 cláusulas `, plural,`, pois `goals.json:47` contém dois plurais) sem `=0` distribuídas pelos 14 arquivos `src/messages/pt/{accounts,analytics,cards,categories,consortiums,dashboard,goals,installments,investments,notifications,purchases,recurring,savings,shell}.json` (alinhando-se a `dashboard.json:100` que já usa `=0 {# itens}`), preservando todos os placeholders `{count}` / `{activeCount}` / `{completedCount}` / `{days}` intactos, e adicionar testes de presença de `=0` + renderização ICU de `count = 0, 1, 2` em `src/i18n/invariants.test.ts`.
- **Razão:** No CLDR de `pt`, `0` pertence à categoria `one`; apenas `=0` explícito garante concordância plural para zero em todas as telas e nos três idiomas.
- **Alternativa considerada:** Corrigir apenas os 4 exemplos citados na auditoria (`purchases.json:37`, `categories.json:45-47`). Rejeitada porque deixaria outras 37 chaves em `pt` (`installments.json`, `investments.json`, `notifications.json`, `shell.json`, `accounts.json`, `cards.json`, `consortiums.json`, `savings.json`, `recurring.json`, `goals.json`, `analytics.json`, `dashboard.json`) com o mesmo defeito latente.

### D2: Helpers numéricos unificados em `src/lib/helpers.ts` e migração dos percentuais decimais (`#20`)
- **Escolha:** Adicionar `numberFmt(v, locale, options)` e `rateFmt(v, locale, maximumFractionDigits = 2)` em `src/lib/helpers.ts` e estender `percentFmt(v, locale, options?: { precision?: number; signed?: boolean })` mantendo `precision = 1, signed = true` como default para total retrocompatibilidade. Atualizar os 14 componentes de `src/components/finance/` que interpolavam números crus ou `.toFixed(1)%`: `installments-view.tsx`, `savings-view.tsx`, `debt-overview.tsx` (L319,324), `debt-sections.tsx`, `balance-projection.tsx`, `financial-report-tabs.tsx` (removendo o helper local `pctFmt`), `quick-stats-overview.tsx`, `dashboard-view.tsx` (substituindo `.toFixed(precision)` no helper local `pct`), `networth-evolution.tsx`, `goals-dashboard.tsx`, `savings-challenge.tsx`, `expense-breakdown.tsx`, `expense-category-details.tsx` e `transaction-analysis-tabs.tsx`.
- **Razão:** Centralizar `Intl.NumberFormat(resolveIntlLocale(locale), ...)` evita duplicação entre componentes e garante vírgula em `pt`/`es` e ponto em `en`, preservando o sinal `+` apenas onde semanticamente esperado.
- **Alternativa considerada:** Formatar manualmente com `.replace('.', ',')` dentro de cada componente. Rejeitada por violar internacionalização baseada em `Intl` e duplicar lógica.

### D3: Opção `"Nenhum(a)"` via `shared.noneOption` e limpeza seletiva para `null` (`#21`)
- **Escolha:** Registrar `"noneOption": "Nenhum(a)"` (`pt`), `"Ninguno(a)"` (`es`) e `"None"` (`en`) em `src/messages/{pt,es,en}/shared.json`. Nos selects opcionais de `InvestmentEditor` (`accountId`, `categoryId`) e `InstallmentPlanEditor` (`cardId`, `categoryId`), usar `value={form.<campo> || 'none'}`, incluir `<SelectItem value="none">{tShared('noneOption')}</SelectItem>` como primeira opção e mapear `v === 'none' ? '' : v` em `onValueChange`. Em `investments-view.tsx`, `saveInvestment` envia `accountId: form.accountId || (editingInvestment?.accountId ? null : undefined)` (e equivalente para `categoryId`).
- **Razão:** Usar `shared.json` elimina escrita concorrente nos JSONs de `investments`/`installments` (editados em `1.1`), mantém o padrão visual de `ConsortiumsView` e `SavingsGoalEditor`, e enviar `null` apenas ao desvincular um registro que possuía vínculo garante compatibilidade tanto com `PUT /api/investments` quanto com as suítes existentes que verificam omissão de opcionais vazios na criação/edição sem vínculo prévio.
- **Alternativa considerada:** Alterar `InvestmentDraft` para inicializar `accountId: 'none'` ou enviar `null` incondicionalmente no `PUT`. Rejeitada porque quebraria contratos de payload em `quiet-investments-editor.qa.mjs:367` e `quiet-finance-dialog-shell.qa.mjs:666`.

### D4: Política finita e silenciosa de reconexão WebSocket em `src/hooks/use-realtime.ts` (`#22`)
- **Escolha:** Definir `MAX_RECONNECTION_ATTEMPTS = 3` e `REALTIME_SOCKET_OPTIONS` (`reconnection: true`, `reconnectionAttempts: 3`, `reconnectionDelay: 2000`, `reconnectionDelayMax: 30000`, `randomizationFactor: 0.5`, `timeout: 10000`), registrar listeners em `connect_error` (sem `console.error`) e `reconnect_failed` (desconectando o socket e mantendo `isConnected: false` em estado silencioso), remover todos os listeners no `cleanup()` e permitir nova tentativa via `reconnect()` manual.
- **Razão:** Encerra tentativas após 3 falhas com backoff crescente em modo standalone `:3000` sem `:3004`, preserva a conexão em tempo real quando o serviço auxiliar está ativo e mantém a recuperação manual pelo botão da barra lateral.
- **Alternativa considerada:** Desabilitar `reconnection` (`false`) completamente. Rejeitada porque impediria recuperação automática de quedas breves quando o serviço `:3004` estiver em execução.

## Risks / Trade-offs

- **[Risk]** Atualização de `src/lib/helpers.ts` ou dos componentes alterar asserções de testes unitários que esperavam `.toFixed(1)` literal com ponto em `'pt'`. → **Mitigation:** Task `2.1` atualiza explicitamente `dashboard-view.test.tsx`, `quiet-core-residuals.test.tsx` e `quiet-analysis-calendar.test.tsx` para validar formato localizado em `pt`, `es` e `en` mantendo fixtures intactas.
- **[Risk]** Edição de `dashboard-view.tsx`, `balance-projection.tsx`, `installments-view.tsx` ou `networth-evolution.tsx` alterar uma das 6 expressões `className` do baseline AST. → **Mitigation:** Não alterar nenhuma prop `className` nesses arquivos e rodar `bun --no-env-file run arch:check` ao final de `1.2` e `2.1`.
- **[Risk]** Colisão de escrita entre Task `1.1` e Task `1.2` caso ambas editem `src/messages/pt/{investments,installments}.json`. → **Mitigation:** Isolar `noneOption` em `src/messages/{pt,es,en}/shared.json` (sem chaves `, plural,`), mantendo `Write paths` 100% disjuntos (`Declared conflicts: none`).
- **[Risk]** Conflito na mesclagem com a correção de `SERVER_SNAPSHOT` em `src/hooks/use-realtime.ts` do Pacote 1 (`#1`). → **Mitigation:** O Pacote 3 executa após o Pacote 1 e a Task `1.3` preserva explicitamente a constante cacheada de `getServerSnapshot` e adiciona asserção em `use-realtime.test.ts`.

## Migration Plan

1. **Pré-condição:** Pacotes 1 (`#1`–`#6`) e 2 (`#7`–`#18`) integrados na árvore antes da execução de aplicação desta change.
2. **Onda 1 (paralela, sem conflitos):** executar Tasks `1.1` (plurais `=0` PT + `invariants.test.ts`), `1.2` (`helpers.ts`, `shared.json`, taxas localizadas e selects `"Nenhum(a)"`) e `1.3` (`use-realtime.ts` + `use-realtime.test.ts`).
3. **Onda 2 (integração e validação):** executar Task `2.1` atualizando os testes afetados e `quiet-i18n.qa.mjs`, rodando `check`, `test:sqlite`, `build` e os runners `.qa.mjs` no sandbox isolado.
4. **Rollback:** cada frente (`1.1`, `1.2`, `1.3`) opera sobre arquivos disjuntos e pode ser revertida isoladamente.

## Open Questions

Nenhuma decisão em aberto; todos os contratos de arquivos, formatos e validações foram verificados no código e testes vigentes.
