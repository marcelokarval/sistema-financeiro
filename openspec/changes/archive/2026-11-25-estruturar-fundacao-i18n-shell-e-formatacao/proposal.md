## Why

O FinanceApp está acoplado a textos estáticos em `pt-BR`, `<html lang="pt-BR">` fixo e formatadores rígidos de data e moeda. Estruturar agora a fundação com `next-intl@4.7.0`, o seletor de idioma no shell e a formatação consciente de locale permite alternar entre Português, Español e English sem alterar URLs da SPA, sem inventar conversão cambial de `BRL` e sem regressões nos testes ou no empacotamento standalone.

## What Changes

**Infraestrutura i18n e SSR**
- From: `next.config.ts` sem plugin de localização, `src/app/layout.tsx` com `lang="pt-BR"` e metadata estática em português, e ausência de `src/i18n/` ou catálogos `src/messages/`.
- To: Plugin `createNextIntlPlugin('./src/i18n/request.ts')`, configuração canônica (`CANONICAL_LOCALES = ['pt', 'es', 'en']`, normalização via cookie `NEXT_LOCALE` e `Accept-Language`), catálogos modulares `src/messages/{pt,es,en}/{common,shell}.json` compostos estaticamente em `src/i18n/messages.ts`, tipagem `AppMessages`/`AppConfig` em `src/i18n/types.ts`, `RootLayout` server-side dinâmico e `AppIntlProvider` com fallback seguro para `renderToStaticMarkup` no `bun test`.
- Reason: Garantir SSR consistente, compatibilidade com `output: "standalone"` + Turbopack, inclusão automática no sandbox `bwrap` de `.zscripts/test-sqlite.sh` (que monta `src/` e não a raiz) e execução isolada de testes sem `NextIntlClientProvider`.
- Impact: Non-breaking para rotas existentes e para visões ainda não migradas (que permanecem em `pt-BR` até as Changes 2 e 3).

**Formatação monetária e datas civis**
- From: `currencyFmt`, `shortCurrency`, `dateFmt`, `dateShortFmt`, `percentFmt` em `src/lib/helpers.ts` e `formatPurchaseDate` em `src/lib/purchase-date.ts` fixos em `pt-BR`.
- To: Formatadores aceitando `locale?: string` opcional (padrão `'pt'`), mapeado via `INTL_LOCALE` (`pt-BR`, `es-ES`, `en-US`), mantendo moeda contábil fixa em `BRL` sem câmbio fictício e datas civis `YYYY-MM-DD` formatadas em `timeZone: 'UTC'`.
- Reason: Preservar invariantes financeiros e evitar deslocamento de dias civis entre fusos horários.
- Impact: Retrocompatível com todas as chamadas existentes de 1 ou 2 argumentos.

**Seletor de idioma e shell transversal**
- From: Shell sem seletor de idioma e com textos em `pt-BR` hardcoded em `page.tsx`, `app-header.tsx`, `sidebar.tsx`, `mobile-nav.tsx`, `quick-actions.tsx`, `global-search.tsx`, `global-search-result.tsx` e `app-overlays.tsx`.
- To: Ativos SVG em `public/locale-flags/{pt,es,en}.svg`, `LocaleFlagIcon`, `LanguageSwitcher` acessível em `AppHeader` e `MobileNav`, internacionalização completa do shell, helper `src/test-utils/intl.tsx`, suíte `src/i18n/invariants.test.ts` e atualização de testes e helpers `qa.mount`.
- Reason: Entregar troca real de idioma no shell principal conforme Quiet Financial OS e o gate AST.
- Impact: Atualiza asserções literais acopladas a strings fixas em `src/lib/store.test.ts`, `src/components/finance/quiet-navigation.test.tsx` e 4 harnesses `.qa.mjs` do shell.

## Capabilities

### New Capabilities
- `fundacao-i18n-e-shell`: Configuração de `next-intl` sem URL routing (`NEXT_LOCALE`), catálogos `pt`/`es`/`en`, tipagem `AppConfig`, formatação consciente de locale com `BRL` fixa e datas civis em `UTC`, fallback seguro de renderização em testes e internacionalização do shell da SPA.

### Modified Capabilities
- `interface-quiet-financial-os`: Adição do seletor de idioma `LanguageSwitcher` com bandeiras SVG decorativas, autônimos e conformidade acessível/Quiet em `AppHeader` e `MobileNav`.

## Impact

- Configuração e layout: `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`.
- Novos módulos i18n e mensagens: `src/i18n/{config,messages,types,request,provider,invariants.test}.ts(x)`, `src/messages/{pt,es,en}/{common,shell}.json`, `src/test-utils/intl.tsx`.
- Formatadores: `src/lib/helpers.ts`, `src/lib/purchase-date.ts`, `src/lib/purchase-date.test.ts`.
- UI do shell e bandeiras: `public/locale-flags/{pt,es,en}.svg`, `src/components/shared/locale-flag-icon.tsx`, `src/components/finance/language-switcher{,.test}.tsx`, `src/components/finance/{app-header,app-overlays,sidebar,mobile-nav,quick-actions,global-search,global-search-result}.tsx`.
- Testes e QA afetados: `src/lib/store.test.ts`, `src/components/finance/quiet-navigation.test.tsx`, `src/components/finance/quiet-{componentization,search-parity,account-transaction-focus,primary-operations}.qa.mjs`.
