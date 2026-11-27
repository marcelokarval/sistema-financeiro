## Why

Após as correções de prioridade alta e média, quatro arestas de polimento permanecem na interface: em português, contagens iguais a zero usam singular porque as chaves ICU omitiram `=0`; taxas percentuais exibem separador decimal com ponto (`.` em vez de `,`); selects opcionais de investimentos e parcelas impedem desvincular uma opção selecionada; e o cliente WebSocket tenta reconectar infinitamente em execução standalone na porta `3000`. Resolver esses pontos após os Pacotes 1 e 2 consolida consistência linguística, numérica, de formulário e de console em `pt`, `es` e `en`.

## What Changes

**Plurais `=0` nos catálogos em português e paridade ICU (`#19`)**
- From: 41 chaves (42 cláusulas `, plural,`) em 14 arquivos `src/messages/pt/*.json` sem ramo `=0`, fazendo o CLDR português selecionar `one` para `0` (ex.: `"0 compra encontrada"`, `"0 transação"`).
- To: todas as 41 chaves (42 cláusulas `, plural,`) sem `=0` em `src/messages/pt/*.json` passam a declarar `=0 {...}` com forma plural correta preservando placeholders `{...}`, com guarda automatizada de `=0` e paridade em `src/i18n/invariants.test.ts`.
- Reason: eliminar discordância gramatical em contagens zeradas sem quebrar paridade com `es` e `en`.
- Impact: non-breaking; restrito a mensagens PT e testes de invariantes.

**Formatação decimal localizada de taxas e percentuais (`#20`)**
- From: `installments-view.tsx`, `savings-view.tsx`, `debt-overview.tsx`, `debt-sections.tsx`, `balance-projection.tsx`, `financial-report-tabs.tsx`, `quick-stats-overview.tsx`, `dashboard-view.tsx`, `networth-evolution.tsx`, `goals-dashboard.tsx`, `savings-challenge.tsx`, `expense-breakdown.tsx`, `expense-category-details.tsx` e `transaction-analysis-tabs.tsx` formatando taxas ou `.toFixed(1)%` sem `Intl.NumberFormat` no `locale`.
- To: helpers unificados `numberFmt`, `rateFmt` e `percentFmt(v, locale, { precision, signed })` em `src/lib/helpers.ts` consumidos pelos componentes para respeitar vírgula em `pt`/`es` e ponto em `en`.
- Reason: padronizar separadores decimais em todos os idiomas suportados.
- Impact: non-breaking; requer ajuste nas asserções `.toFixed(1)%` fixas em `'pt'` de três suítes unitárias.

**Opção explícita `"Nenhum(a)"` nos selects opcionais (`#21`)**
- From: `InvestmentEditor` (`accountId`, `categoryId`) e `InstallmentPlanEditor` (`cardId`, `categoryId`) sem item de desseleção explícita, e `saveInvestment` enviando `undefined` ao limpar campo existente.
- To: chave `shared.noneOption` (`"Nenhum(a)"` / `"Ninguno(a)"` / `"None"`), `<SelectItem value="none">` mapeado para `''` nos dois editores e envio de `null` em `saveInvestment` quando um vínculo previamente salvo é limpo.
- Reason: permitir limpar vínculos opcionais de forma consistente com `ConsortiumsView` e `SavingsGoalEditor`.
- Impact: non-breaking; preserva payloads existentes quando o vínculo já era vazio.

**Reconexão WebSocket finita com backoff exponencial (`#22`)**
- From: `useRealtime` em `src/hooks/use-realtime.ts` com `reconnectionAttempts: Infinity` gerando warnings periódicos contínuos sem `:3004`.
- To: `MAX_RECONNECTION_ATTEMPTS = 3`, backoff exponencial (`2000ms` a `30000ms`), fallback silencioso em `connect_error`/`reconnect_failed` preservando `SERVER_SNAPSHOT` e `reconnect()` manual funcional, com testes em `src/hooks/use-realtime.test.ts`.
- Reason: cessar tentativas e ruído de rede em ambiente standalone `:3000`.
- Impact: non-breaking; mantém suporte integral a reconexão manual e eventos em tempo real quando `:3004` está ativo.

## Capabilities

### New Capabilities

### Modified Capabilities
- `internacionalizacao-frontend`: adiciona exigência de ramo `=0` em todas as chaves ICU `, plural,` em `pt` e formatação decimal localizada de taxas e percentuais no `locale` ativo.
- `integridade-fluxos-financeiros`: adiciona opção explícita `"Nenhum(a)"` com limpeza para `null` nos selects opcionais de investimentos e parcelas, e política finita de reconexão WebSocket com backoff exponencial no hook `useRealtime`.

## Impact

- Código de produção: 14 catálogos `src/messages/pt/*.json`, `src/messages/{pt,es,en}/shared.json`, `src/lib/helpers.ts`, 17 módulos em `src/components/finance/` e `src/hooks/use-realtime.ts`.
- Testes e QA: `src/i18n/invariants.test.ts`, `src/hooks/use-realtime.test.ts`, `src/lib/purchase-date.test.ts`, 7 suítes `src/components/finance/*.test.*` e `src/components/finance/quiet-i18n.qa.mjs`.
- Exclusões garantidas: `src/components/ui/**` (shadcn), `src/app/api/**`, `mini-services/finance-ws/**`, `db/custom.db` e os arquivos exclusivos dos Pacotes 1 e 2 fora de `use-realtime.ts` (cuja correção de `SERVER_SNAPSHOT` no Pacote 1 é pré-requisito preservado).
