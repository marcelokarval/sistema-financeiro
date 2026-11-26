## Why

As rotas em `src/app/api/**` e `src/lib/api-validation.ts` ainda hardcoded strings em `pt-BR`, datas via `toLocaleString("pt-BR")` e erros mistos em português e inglês sem código estável (`code`). Para suportar `pt`, `es` e `en` em toda a aplicação sem quebrar a retrocompatibilidade dos testes existentes nem colidir com as changes de shell e frontend, é necessário internacionalizar a camada de servidor preservando `'pt'` e `BRL` contábil como padrão.

## What Changes

**Resolução de idioma e catálogos de API (`server-i18n.ts` e `src/messages/*/api.json`)**
- From: ausência de resolução de locale nas rotas de API e mensagens dispersas em `pt-BR` e inglês.
- To: módulo `src/lib/server-i18n.ts` com `resolveRequestLocale(request)` (`?locale=` → cookie `NEXT_LOCALE` → header `Accept-Language` → `'pt'`), `hasExplicitLocaleSignal(request)`, formatadores `Intl` mantendo `BRL` contábil e catálogos `src/messages/{pt,es,en}/api.json`.
- Reason: centralizar traduções, formatação regional e fallback `'pt'` no backend sem colidir com `src/i18n/*` (Change 1) ou `src/components/*` (Change 2).
- Impact: non-breaking; requisições sem sinal de idioma continuam recebendo `'pt'`.

**Rotas analíticas, séries temporais, calendário, faturas e recibos**
- From: labels de mês e dia da semana hardcoded em `pt-BR` (`dashboard`, `quick-stats`, `networth`, `reports`, `balance-projection`, `expense-breakdown`, `transaction-analytics`, `financial-calendar`, `goals-dashboard`) e rótulos/erros fixos em `upcoming-bills`, `receipt`, `timeline` e `debts`.
- To: labels localizados via `Intl.DateTimeFormat` acompanhados de chaves ISO aditivas (`monthKey`, `dateKey`, `estimatedCompletionKey`, `monthKeys`, `dayIndex`), além de textos e erros localizados via catálogo.
- Reason: permitir gráficos e listas multilíngues no frontend mantendo chaves neutras para ordenação e agregação.
- Impact: non-breaking; campos existentes mantêm formato padrão em `'pt'` e novos campos são apenas aditivos.

**Rotas narrativas (`insights`, `forecast`, `achievements`, `savings-challenge`)**
- From: títulos, descrições, ações, alertas de risco e métricas gerados exclusivamente em `pt-BR`.
- To: geração dinâmica de textos em `pt`/`es`/`en` usando `src/messages/{pt,es,en}/api.json` e `BRL` formatado conforme locale, preservando enums técnicos (`id`, `icon`, `category`, `trendDirection`) e contratos de `'pt'` testados.
- Reason: tornar recomendações, previsões, conquistas e desafios compreensíveis no idioma ativo do usuário.
- Impact: non-breaking; `GET()` continua aceitando invocação sem argumento com default `'pt'`.

**Exportação CSV, `/api/advisor` e padronização de erros CRUD (`api-validation.ts`)**
- From: `/api/export` fixo em `pt-BR`, `/api/advisor` instruindo apenas português no prompt e rotas CRUD retornando `{ error }` sem `code` padronizado.
- To: CSV localizado em `/api/export` (aceitando `?locale=`), contexto/instrução de idioma em `pt`/`es`/`en` no `/api/advisor` preservando `BRL` e anti-injection `<user_context>`, e erros `{ error, code }` + `X-Error-Code` em `api-validation.ts` e CRUDs com guarda de retrocompatibilidade para contratos legados das suítes `test:sqlite`.
- Reason: fechar suporte multilíngue fim-a-fim e permitir tratamento tipado de erros no frontend sem quebrar testes rígidos.
- Impact: non-breaking para todas as suítes existentes (`default 'pt'`), incluindo as 5 suítes opt-in SQLite (`bwrap`).

## Capabilities

### New Capabilities
- `internacionalizacao-apis-e-exportacao`: resolução de locale no servidor (`pt`/`es`/`en` com default `'pt'`), catálogos `src/messages/{pt,es,en}/api.json`, formatação `Intl` com `BRL` contábil e chaves ISO aditivas em séries/calendário, narrativas localizadas, CSV multilíngue em `/api/export`, prompt multilíngue com proteção anti-injection em `/api/advisor` e erros padronizados com `code` retrocompatíveis com as suítes `test:sqlite`.

### Modified Capabilities
Nenhuma capability existente em `openspec/specs/` tem seus requisitos alterados.

## Impact

- Arquivos criados/alterados (escopo exclusivo Change 3): `src/lib/server-i18n.ts`, `src/lib/api-validation.ts`, `src/messages/{pt,es,en}/api.json`, rotas e testes em `src/app/api/**`.
- Exclusões explícitas: `src/i18n/*` (Change 1), `src/components/{finance,shared}/*` (Change 2), `src/lib/purchase-date.ts`, `db/custom.db`, e os 4 arquivos de teste `test:sqlite` (`installments/route.test.ts`, `purchases/route-integrity.test.ts`, `consortiums/assembly.test.ts`, `savings/route.test.ts`).
