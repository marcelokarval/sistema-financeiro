## 1. Polimento de plurais, taxas, selects e WebSocket

- [x] 1.1 Adicionar ramo `=0` em todas as 41 chaves (42 cláusulas `, plural,`) sem zero-branch nos 14 arquivos `src/messages/pt/*.json` preservando placeholders idênticos a `es` e `en`, e ampliar `src/i18n/invariants.test.ts` com verificação automática de `=0` e formatação ICU para `0`, `1` e `2`
- [x] 1.2 Unificar formatadores decimais localizados em `src/lib/helpers.ts` (`numberFmt`, `rateFmt`, `percentFmt`), aplicar `Intl.NumberFormat` em todas as taxas e percentuais decimais de `src/components/finance/` e adicionar opção `"Nenhum(a)"` via `src/messages/{pt,es,en}/shared.json` em `InvestmentEditor` (com limpeza para `null` na edição em `investments-view.tsx`) e `InstallmentPlanEditor`
- [x] 1.3 Configurar tentativas finitas (`MAX_RECONNECTION_ATTEMPTS = 3`), backoff exponencial (`2000ms`–`30000ms`) e fallback silencioso (`connect_error` / `reconnect_failed`) em `src/hooks/use-realtime.ts` preservando `SERVER_SNAPSHOT` e `reconnect()` manual, e criar `src/hooks/use-realtime.test.ts`

## 2. Verificação integrada de testes, build e QA

- [x] 2.1 Atualizar `src/lib/purchase-date.test.ts`, as suítes `src/components/finance/*.test.*` afetadas por separador decimal localizado e `"Nenhum(a)"`, e `src/components/finance/quiet-i18n.qa.mjs`, executando `check`, `test:sqlite`, `build` e suítes Playwright em sandbox isolado para `pt`, `es` e `en`
