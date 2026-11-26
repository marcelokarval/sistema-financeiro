## 1. Fundação i18n, Formatação e Seletor de Idioma

- [x] 1.1 Configurar núcleo `next-intl@4.7.0` sem URL routing (`NEXT_LOCALE`, `src/i18n/messages.ts` compondo `src/messages/{pt,es,en}/{common,shell}.json`, `src/i18n/request.ts` delegando a `messages.ts`, `AppMessages`/`AppConfig` em `src/i18n/types.ts`, `next.config.ts`, `RootLayout`, `AppIntlProvider` com fallback seguro para `renderToStaticMarkup`, `src/test-utils/intl.tsx` e `src/i18n/invariants.test.ts`).
- [x] 1.2 Parametrizar formatadores financeiros (`src/lib/helpers.ts` e `src/lib/purchase-date.ts`) por locale (`INTL_LOCALE`) com moeda contábil `BRL` fixa sem câmbio fictício e datas civis `YYYY-MM-DD` em `timeZone: 'UTC'`, cobrindo `pt`/`es`/`en` em `src/lib/purchase-date.test.ts`.
- [x] 1.3 Adicionar bandeiras SVG decorativas (`public/locale-flags/{pt,es,en}.svg`), `LocaleFlagIcon` (`src/components/shared/locale-flag-icon.tsx`) e `LanguageSwitcher` acessível (`src/components/finance/language-switcher.tsx`) em conformidade com Quiet Financial OS e gate AST, com suíte unitária própria.

## 2. Internacionalização do Shell e Reconciliação de Testes/QA

- [x] 2.1 Internacionalizar o shell (`src/app/page.tsx`, `app-header.tsx`, `app-overlays.tsx`, `sidebar.tsx`, `mobile-nav.tsx`, `quick-actions.tsx`, `global-search.tsx`, `global-search-result.tsx`), integrar `LanguageSwitcher` em `AppHeader` e `MobileNav`, atualizar `src/lib/store.test.ts` e `quiet-navigation.test.tsx`, e atualizar os helpers `qa.mount` / `qa.mountShell` dos 4 harnesses `.qa.mjs` do shell.
