# Brainstorm — Polimento de Plurais, Taxas Percentuais, Selects e WebSocket (Pacote 3)

**Skill mapping and observed invocation:** `brainstorming` (`/home/marcelo-karval/.agents/skills/brainstorming/SKILL.md`) e `writing-plans` (`/home/marcelo-karval/.agents/skills/writing-plans/SKILL.md`) lidas integralmente e aplicadas na inspeção de todos os catálogos `src/messages/pt/*.json`, `src/i18n/invariants.test.ts`, `src/lib/helpers.ts`, `src/components/finance/*.tsx`, `src/hooks/use-realtime.ts`, rotas `/api/investments` e `/api/installments`, suítes `.test.*` e runners `.qa.mjs`.

## Contexto e Sequenciamento

Esta mudança implementa o **Pacote 3 (Prioridade Baixa / Polimento — Itens #19 a #22)** levantados na auditoria ao vivo (`#405`) e executa **sequencialmente após os Pacotes 1 e 2** (`corrigir-prioridade-alta-resumo-i18n-e-cartoes` e `aprimorar-prioridade-media-a11y-validacoes-e-fluxos`):
- **#19:** Plural `=0` nos catálogos PT (`src/messages/pt/*.json`), evitando singular para zero (`"0 compra encontrada"`, `"0 transação"`, `"0 plano no total"`).
- **#20:** Localização decimal de taxas percentuais e percentuais decimais com `Intl.NumberFormat` no `locale` ativo (`12.5% a.a.` → `12,5% a.a.`, `1.5%` → `1,5%`).
- **#21:** Opção explícita `"Nenhum(a)"` nos selects opcionais de `InvestmentEditor` (`accountId`, `categoryId`) e `InstallmentPlanEditor` (`cardId`, `categoryId`), com limpeza efetiva para vazio/`null` no envio.
- **#22:** Tentativas finitas, backoff exponencial e fallback silencioso no hook `useRealtime` (`src/hooks/use-realtime.ts`) quando o servidor WebSocket `:3004` estiver indisponível no modo standalone `:3000`.

## Cadeia de Decisões (Q1–Q4)

### Q1 — Quais chaves ICU em `src/messages/pt/*.json` possuem `, plural,` sem ramo `=0`?
- **Inspeção completa:** dos 18 arquivos em `src/messages/pt/` (17 UI + `api.json`), `common.json`, `receipts.json`, `advisor.json` e `api.json` não têm cláusulas `, plural,`. Os outros 14 arquivos contêm **42 chaves** totalizando **43 cláusulas** `, plural,`:
  - `dashboard.json:100` (`details.recentPurchases.itemCount`) **já possui** `=0` (`{count, plural, =0 {# itens} one {# item} other {# itens}}`, testado em `src/lib/purchase-date.test.ts:91-92`).
  - As **41 chaves restantes** (**42 cláusulas** `, plural,`) em 14 arquivos (`accounts.json` 1, `analytics.json` 15, `cards.json` 1, `categories.json` 4, `consortiums.json` 1, `dashboard.json` 2, `goals.json` 7 chaves / 8 cláusulas pois `budgetGoals.summary` possui dois plurais `activeCount` e `completedCount`, `installments.json` 2, `investments.json` 1, `notifications.json` 1, `purchases.json` 3, `recurring.json` 1, `savings.json` 1, `shell.json` 1) omitem `=0`.
- **Por que falha em PT:** segundo o CLDR do português (`pt`), a categoria `one` inclui `0` e `1` (`i = 0..1`). Sem `=0`, o ICU renderiza a forma singular para zero. Em `es` e `en`, `one` vale apenas para `n = 1`, e `0` já usa `other`.
- **Decisão:** adicionar o ramo explícito `=0 {...}` com a forma plural natural em todas as 41 chaves (42 cláusulas) de `src/messages/pt/*.json` (incluindo ambos os plurais de `goals.json:47`), mantendo exatamente as mesmas variáveis `{count}` / `{activeCount}` / `{completedCount}` / `{days}` para preservar 100% de paridade em `src/i18n/invariants.test.ts` e `quiet-transversal.test.tsx`. Estender `src/i18n/invariants.test.ts` para garantir automaticamente que toda chave `, plural,` em `src/messages/pt/*.json` contenha `=0` e formate `count = 0` no plural.

### Q2 — Como padronizar taxas percentuais sem quebrar `percentFmt(v, locale)` nem duplicar lógica?
- **Inspeção:** `src/lib/helpers.ts` possui `percentFmt(v, locale)` que sempre prefixa `'+'` quando `v >= 0` (correto para variações e rentabilidade assinada, mas inadequado para taxas de juros/rendimento sem sinal ou taxas positivas fixas). Além de `installments-view.tsx:402` (`selectedPlan.interestRate`) e `savings-view.tsx:534` (`goal.yieldRate`), a busca em `src/components/finance/` revelou outras exibições cruas com `.toFixed(1)%` ou interpolação numérica direta sem `Intl.NumberFormat`:
  - `debt-overview.tsx:319,324` (`((entry.value / data.totalDebt) * 100).toFixed(1)` / `{pct}%`);
  - `debt-sections.tsx:180,201,202,406` (`ratio.toFixed(1)%` e `ip.interestRate`);
  - `balance-projection.tsx:313,321,402,411` (`projectionChangePct` e `data.savingsRate`);
  - `financial-report-tabs.tsx:66,150,170,271` (helper local `pctFmt` e `rate.toFixed(1)%`);
  - `quick-stats-overview.tsx:61,136,248` (`change`, `savingsRate`);
  - `dashboard-view.tsx:260` (helper local `pct(value, precision)`);
  - `networth-evolution.tsx:297,400,416` (`changePercent` e `milestoneProgress`);
  - `goals-dashboard.tsx:229` (`inv.returnRate.toFixed(1)%`);
  - `savings-challenge.tsx:82` (`v.toFixed(1)%`);
  - `expense-breakdown.tsx:219,246`, `expense-category-details.tsx:211,273` e `transaction-analysis-tabs.tsx:231,377` (`.toFixed(1)%`).
- **Decisão:** unificar em `src/lib/helpers.ts` com `numberFmt(v, locale, options)` e `rateFmt(v, locale, maximumFractionDigits = 2)` (para `{rate}` dentro de templates ICU que já trazem `%`, como `12,5% a.a.` e `1,5%`), além de parametrizar `percentFmt(v, locale, { precision = 1, signed = true })` mantendo retrocompatibilidade total das chamadas existentes (`percentFmt(v, locale)`). Atualizar todos os componentes listados preservando intactas as 6 expressões AST do baseline e mantendo todos os arquivos abaixo de 500 linhas dentro do limite.

### Q3 — Como implementar `"Nenhum(a)"` em `InvestmentEditor` e `InstallmentPlanEditor` sem colisão com `1.1` nem quebra de payloads?
- **Decisão de i18n sem colisão:** `src/messages/{pt,es,en}/shared.json` não possui chaves `, plural,` (logo não é tocado pela Task `1.1`). Adicionar `"noneOption": "Nenhum(a)"` (`pt`), `"Ninguno(a)"` (`es`) e `"None"` (`en`) em `shared.json` permite compartilhar o mesmo rótulo via `useSafeTranslations('shared')` em `InvestmentEditor` (`accountId`, `categoryId`) e `InstallmentPlanEditor` (`cardId`, `categoryId`) com zero duplicação e zero conflito de escrita com `1.1`.
- **Comportamento do sentinel e envio:** os campos `InvestmentDraft.{accountId,categoryId}` e `InstallmentPlanDraft.{cardId,categoryId}` mantêm `''` como estado interno vazio. Os componentes `Select` exibem `value={form.<field> || 'none'}` com primeiro item `<SelectItem value="none">{tShared('noneOption')}</SelectItem>` e `onValueChange={(v) => onFieldChange(field, v === 'none' ? '' : v)}`.
  - Em `installments-view.tsx:211-212`, `createPlan` já envia `cardId: form.cardId || null` e `categoryId: form.categoryId || null`.
  - Em `investments-view.tsx:337-338`, `PUT /api/investments` (`src/app/api/investments/route.ts:339-362,392-393`) só limpa `accountId`/`categoryId` no banco quando o payload envia `null` explícito (pois `JSON.stringify` omite `undefined`). Para limpar vínculos existentes na edição sem alterar o payload quando o campo já era ausente (preservando `quiet-investment-mutations.test.tsx`, `quiet-investments-editor.qa.mjs:367` e `quiet-finance-dialog-shell.qa.mjs:666`), `saveInvestment` envia `form.accountId || (editingInvestment?.accountId ? null : undefined)` (e equivalente para `categoryId`).

### Q4 — Como tornar a reconexão WebSocket finita e silenciosa no `useRealtime` sem regredir Pacote 1 (`#1`)?
- **Inspeção:** `src/hooks/use-realtime.ts:52-61` configura `reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000, reconnectionDelayMax: 5000, timeout: 10000` e não escuta `connect_error` nem `reconnect_failed`. No modo dev standalone `:3000` sem `:3004`, o Socket.IO acumula warnings contínuos indefinidamente.
- **Decisão:** preservar a correção do `SERVER_SNAPSHOT` cacheado introduzida no Pacote 1 (`#1`) e atualizar `createSocket()` com `MAX_RECONNECTION_ATTEMPTS = 3`, backoff exponencial (`reconnectionDelay: 2000`, `reconnectionDelayMax: 30000`, `randomizationFactor: 0.5`), tratamento silencioso de `connect_error` e `reconnect_failed` (desconectando o socket exaurido e mantendo `isConnected: false` sem logs de erro repetitivos nem exceções), limpeza completa de listeners no `cleanup()`, além de permitir que `reconnect()` manual crie nova instância com orçamento renovado. Extrair a configuração para `REALTIME_SOCKET_OPTIONS` testável em `src/hooks/use-realtime.test.ts`.
