## Why

Com a fundação de internacionalização e o shell concluídos na Change 1 (`estruturar-fundacao-i18n-shell-e-formatacao`), todos os 7 primitivos compartilhados e os 63 módulos financeiros de visões, widgets, editores, diálogos, notificações, recibos e assistente ainda contêm textos fixos em `pt-BR` e chamadas diretas a `ptBR`/`toLocaleString('pt-BR')`. Internacionalizar essa camada agora entrega a experiência completa em `pt`, `es` e `en` mantendo a moeda `BRL`, os contratos Quiet e o gate AST intactos.

## What Changes

**Catálogos modulares por domínio e registro em `src/i18n/{messages,types,request}.ts`**
- From: apenas os namespaces `common` e `shell` carregados e tipados pela Change 1.
- To: 16 namespaces de domínio (`shared`, `dashboard`, `goals`, `analytics`, `accounts`, `cards`, `purchases`, `categories`, `receipts`, `investments`, `installments`, `consortiums`, `savings`, `recurring`, `notifications`, `advisor`) em `src/messages/{pt,es,en}/<namespace>.json` (48 arquivos) com paridade estrita de chaves e registro estático em `src/i18n/messages.ts`, `src/i18n/types.ts` e `src/i18n/request.ts` após integração da Change 1.
- Reason: manter catálogos pequenos, tipagem estrita em `AppConfig.Messages` (`tsc --noEmit`) e zero colisão entre tarefas paralelas.
- Impact: non-breaking; requer Change 1 integrada na `main` antes da execução.

**Primitivos compartilhados (`src/components/shared/*`) e 63 módulos de `src/components/finance/*`**
- From: strings literais em português, mapas estáticos de enums acoplados aos `.tsx`, `date-fns/locale` fixo em `ptBR`, `Intl.NumberFormat('pt-BR')`, `toLocaleDateString('pt-BR')` e `<html lang="pt-BR">` no recibo imprimível.
- To: consumo de `useSafeTranslations` / `useSafeLocale` (`@/i18n/provider`), formatadores `currencyFmt(v, locale)` / `shortCurrency(v, locale)` / `dateFmt(d, locale)` de `src/lib/helpers.ts`, catálogos puros de chaves (`analytics-i18n.ts`, `operations-i18n.ts`, `portfolio-i18n.ts`) para conter crescimento de arquivos próximos a 500 linhas, preservação da moeda `BRL`, datas localizadas e recibo imprimível multilíngue preservando as 6 identidades do baseline AST.
- Reason: eliminar texto hardcoded na camada de interface sem regredir no gate AST, em acessibilidade, privacidade ou concorrência.
- Impact: non-breaking para contratos de API e armazenamento; `src/app/api/**` permanece fora de escopo (Change 3).

**Testes unitários e verificação Playwright multi-idioma**
- From: 14 suítes `src/components/finance/*.test.*` e 14 runners `.qa.mjs` montando componentes sem provider de tradução e validando apenas cópia fixa em `pt-BR`.
- To: testes e runners `.qa.mjs` atualizados com `src/test-utils/intl.tsx` validando renderização em `pt`, `es` e `en`, mais o novo runner `src/components/finance/quiet-i18n.qa.mjs` cobrindo os 3 idiomas nas 6 células (`360/390/1440 × light/dark`).
- Reason: garantir paridade visual, semântica e funcional em todos os idiomas suportados.
- Impact: non-breaking; preserva todos os contratos Quiet existentes.

## Capabilities

### New Capabilities
- `internacionalizacao-frontend`: suporte integral a `pt`, `es` e `en` nos 7 primitivos compartilhados e nos 63 módulos de visões, widgets, editores, diálogos, notificações, recibos e assistente, com 16 namespaces modulares, preservação da moeda `BRL`, datas localizadas e cobertura unitária/Playwright.

### Modified Capabilities
Nenhuma capability existente em `openspec/specs/` tem seus requisitos alterados; os contratos de `interface-quiet-financial-os`, `arquitetura-componentes-frontend` e `integridade-fluxos-financeiros` permanecem preservados.

## Impact

- Código de produção: `src/components/shared/*.tsx` (7), `src/components/finance/*.tsx` e `dashboard-query.ts`/`receipt-fields.ts` (63), catálogos `src/components/finance/{analytics,operations,portfolio}-i18n.ts` (3), 48 arquivos `src/messages/{pt,es,en}/*.json` e registro dos namespaces em `src/i18n/{messages,types,request}.ts`.
- Testes e QA: `src/components/finance/*.test.*` (14), `src/components/finance/*.qa.mjs` (14) e novo `src/components/finance/quiet-i18n.qa.mjs`.
- Exclusões garantidas: `src/app/api/**` (Change 3), shell/header/layout/`page.tsx`/`helpers.ts`/`purchase-date.ts`/`test-utils/intl.tsx`/`common.json`/`shell.json` (Change 1), `src/components/ui/**` e `db/custom.db`.
