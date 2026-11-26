# Brainstorming — Fundação i18n, Shell e Formatação

**Skill mapping and observed invocation:** `brainstorming` (`/home/marcelo-karval/.agents/skills/brainstorming/SKILL.md`), `openspec-propose` (`/home/marcelo-karval/.agents/skills/openspec-propose/SKILL.md`) e `writing-plans` (`/home/marcelo-karval/.agents/skills/writing-plans/SKILL.md`) lidas integralmente antes da redação dos artefatos de planejamento.

## Contexto e Problema

O FinanceApp (`marcelokarval/sistema-financeiro`) está inteiramente acoplado ao português brasileiro (`pt-BR`) tanto na infraestrutura Next.js (`<html lang="pt-BR">` e `metadata` fixa em `src/app/layout.tsx`) quanto nos formatadores financeiros (`src/lib/helpers.ts` e `src/lib/purchase-date.ts` com `'pt-BR'` e `ptBR` fixos) e em todo o shell de navegação (`src/app/page.tsx`, `app-header.tsx`, `sidebar.tsx`, `mobile-nav.tsx`, `quick-actions.tsx`, `global-search.tsx`, `global-search-result.tsx` e `app-overlays.tsx`).

Ao mesmo tempo, o projeto já possui `next-intl` (`^4.3.4` no `package.json`, `4.7.0` instalada em `node_modules`) e segue restrições arquiteturais rígidas:
- Empacotamento `output: "standalone"` com Turbopack (`next@16.1.1`) e servidor auxiliar sem dependência de rotas dinâmicas por idioma.
- Contrato visual Quiet Financial OS com gate AST (`bun --no-env-file run arch:check`), proibição de `framer-motion` e `raw-conditional-class-name`, uso obrigatório de `cn()`.
- Suítes unitárias em `bun:test` que chamam `renderToStaticMarkup(<Component />)` diretamente sem wrapper de provider, além de 4 harnesses `.qa.mjs` (`quiet-componentization.qa.mjs`, `quiet-search-parity.qa.mjs`, `quiet-account-transaction-focus.qa.mjs`, `quiet-primary-operations.qa.mjs`) que montam `<Page />` diretamente em bundle browser isolado sem `RootLayout`.
- Regra financeira crítica: a aplicação é um livro-razão pessoal em Real brasileiro (`BRL`); alterar o idioma da interface **não** pode aplicar conversão cambial fictícia nem deslocar dias civis (`YYYY-MM-DD` / meia-noite UTC) entre fusos horários locais (`TZ=UTC`, `TZ=America/Bahia`).

## Cadeia de Decisões (Q1–Q7)

- **Q1 — Idiomas suportados e normalização:** Quais códigos canônicos suportar?
  - Decisão: `CANONICAL_LOCALES = ['pt', 'es', 'en'] as const` com `DEFAULT_LOCALE = 'pt'`. Códigos regionais ou headers (`pt-BR`, `es-419`, `es-ES`, `en-US`, `Accept-Language`) são normalizados por `normalizeLocale()` para `'pt' | 'es' | 'en'`.
- **Q2 — Estratégia de roteamento e persistência de idioma:** URL com prefixo `/[locale]` ou cookie sem alteração de URL?
  - Decisão: Sem roteamento na URL. Persistência no cookie `NEXT_LOCALE` lido no servidor por `getRequestConfig` em `src/i18n/request.ts` (com fallback em `Accept-Language` e depois `'pt'`) e atualizado no cliente via `document.cookie` + `router.refresh()`. Preserva `/` única da SPA, `Caddyfile`, APIs e harnesses `.qa.mjs`.
- **Q3 — Compatibilidade com `output: "standalone"`, Turbopack e `.zscripts/test-sqlite.sh`:** Como organizar e carregar os catálogos JSON?
  - Decisão: `createNextIntlPlugin('./src/i18n/request.ts')` no `next.config.ts` combinado com imports estáticos dos catálogos modulares `src/messages/{pt,es,en}/{common,shell}.json` centralizados em `src/i18n/messages.ts` (ao qual `src/i18n/request.ts` delega exclusivamente). Manter os JSONs dentro de `src/` garante montagem automática na allowlist do `bwrap` em `.zscripts/test-sqlite.sh:57-61` (`src`, `prisma/schema.prisma`, `package.json`, `tsconfig.json`, `node_modules`) e evita resolução dinâmica de filesystem em runtime standalone.
  - Separação entre Changes 1, 2 e 3: `common.json` + `shell.json` pertencem à Change 1 (com diálogo do assistente sob `shell.advisorDialog` para não colidir com `advisor.json` da Change 2); Change 2 adicionará os 16 catálogos de domínio e Change 3 adicionará `src/messages/{pt,es,en}/api.json`, ambos estendendo apenas `src/i18n/messages.ts` (e os harnesses `.qa.mjs` / `quiet-navigation.test.tsx` conforme o escopo).
- **Q4 — Formatação monetária e datas civis:** Mudar idioma muda a moeda ou o dia civil?
  - Decisão: Não. `INTL_LOCALE` mapeia `'pt' -> 'pt-BR'`, `'es' -> 'es-ES'`, `'en' -> 'en-US'` apenas para convenção tipográfica/regional de `Intl.NumberFormat` e `Intl.DateTimeFormat`. A moeda contábil permanece fixa em `'BRL'` sem taxa de câmbio inventada. Datas civis (`YYYY-MM-DD` ou meia-noite UTC do Prisma) são formatadas com `timeZone: 'UTC'` no `Intl.DateTimeFormat` para que `2026-11-19` nunca vire `18/11` em `America/Bahia`.
- **Q5 — Seletor de idioma e identidade visual:** Onde posicionar e qual padrão visual adotar?
  - Decisão: Reaproveitar os vetores SVG de bandeiras (`/locale-flags/{pt,es,en}.svg`) do projeto de referência `prop4you` como decoração pura (`alt="" aria-hidden="true"`) via `LocaleFlagIcon` compartilhado, e criar `LanguageSwitcher` acessível (shadcn `DropdownMenu` com `modal={false}`, autônimos `Português`/`Español`/`English`, siglas `PT`/`ES`/`EN`, ícone `Check`, `cn()`, zero `framer-motion`) no `AppHeader` (desktop/compacto) e no `Sheet` de `MobileNav` (móvel/completo).
- **Q6 — Isolamento para `bun:test` (`renderToStaticMarkup`) e `.qa.mjs`:** Como evitar quebra de testes que renderizam componentes sem `RootLayout`?
  - Decisão: Criar `AppIntlProvider` + hooks seguros (`useSafeTranslations`, `useSafeLocale`) baseados em `createTranslator` da própria `next-intl` com fallback automático para o catálogo `'pt'` quando não houver provider montado, além do helper `src/test-utils/intl.tsx` (`renderWithIntl`) para testar `pt`/`es`/`en` explicitamente e da atualização dos helpers `qa.mount` / `qa.mountShell` nos 4 `.qa.mjs` que montam `Page`.
- **Q7 — Escopo da Change 1 frente às Changes 2 e 3:** O que fica nesta change?
  - Decisão: Change 1 entrega toda a fundação (`next-intl`, catálogos completos do shell e estrutura base, `AppConfig`, `RootLayout`, formatadores `helpers.ts`/`purchase-date.ts`), o `LanguageSwitcher` + bandeiras SVG, a internacionalização do shell transversal (`page.tsx`, `app-header.tsx`, `sidebar.tsx`, `mobile-nav.tsx`, `quick-actions.tsx`, `global-search.tsx`, `global-search-result.tsx`, `app-overlays.tsx`) e os testes/harnesses correspondentes. Telas de domínio/widgets (`views` e `NotificationPanel` se fora do shell) e rotas `/api` + `AIAdvisor` permanecem para as Changes 2 e 3.

## Abordagens Avaliadas

- **Abordagem A (Escolhida):** `next-intl@4.7.0` sem roteamento por URL, usando cookie `NEXT_LOCALE`, `getRequestConfig`, `NextIntlClientProvider` no `RootLayout`, `router.refresh()` na troca de idioma e ponte segura para testes standalone.
- **Abordagem B (Descartada):** `next-intl` com segmento `/[locale]` e middleware de redirecionamento. Quebra rotas esperadas da SPA, harnesses `.qa.mjs` e aumenta superfície de regressão de proxy/standalone sem benefício para um app pessoal de rota única.
- **Abordagem C (Descartada):** Dicionário ad-hoc apenas em Zustand (`src/lib/store.ts`) sem `next-intl`. Desperdiça `next-intl@4.7.0` já presente em `package.json`, perde tipagem de `AppConfig`, SSR de `<html lang>` e metadata do servidor.
