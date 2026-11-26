## Context

O FinanceApp utiliza Next.js `16.1.1` com App Router, `output: "standalone"`, Turbopack, React `19.0.0`, Tailwind CSS v4, shadcn/ui (Radix), Zustand `5.0.6` (`src/lib/store.ts`) e `next-intl` `4.7.0` já instalada em `node_modules` (`"next-intl": "^4.3.4"` em `package.json`). Atualmente `src/app/layout.tsx` fixa `<html lang="pt-BR">` e metadata estática em português, `src/lib/helpers.ts` e `src/lib/purchase-date.ts` fixam `'pt-BR'` e `ptBR`, e todos os componentes do shell (`src/app/page.tsx`, `app-header.tsx`, `sidebar.tsx`, `mobile-nav.tsx`, `quick-actions.tsx`, `global-search.tsx`, `global-search-result.tsx`, `app-overlays.tsx`) têm strings em português hardcoded.

As suítes unitárias em `bun:test` (como `src/components/finance/quiet-navigation.test.tsx`) invocam `renderToStaticMarkup(<Component />)` diretamente sem wrapper de provider, e 4 harnesses `.qa.mjs` (`quiet-componentization.qa.mjs`, `quiet-search-parity.qa.mjs`, `quiet-account-transaction-focus.qa.mjs`, `quiet-primary-operations.qa.mjs`) montam `<Page />` em bundle browser isolado sem `RootLayout`. Além disso, `.zscripts/check-frontend-architecture.ts` impõe o gate AST (`raw-conditional-class-name`, ausência de `framer-motion`) em `src/app/` e `src/components/{finance,shared}/`.

## Goals / Non-Goals

**Goals:**
- Estabelecer fundação única de i18n com `next-intl@4.7.0` para os 3 idiomas canônicos (`pt`, `es`, `en`) sem alterar a rota única `/` da SPA.
- Configurar `createNextIntlPlugin('./src/i18n/request.ts')` compatível com `output: "standalone"`, Turbopack e a allowlist `src/` do sandbox `bwrap` em `.zscripts/test-sqlite.sh:57-61`, compondo `src/messages/{pt,es,en}/{common,shell}.json` via imports estáticos em `src/i18n/messages.ts`.
- Garantir tipagem estrita de chaves via `AppMessages = typeof MESSAGES_BY_LOCALE.pt` e `AppConfig` em `src/i18n/types.ts`, com paridade estrutural/placeholders verificada em `src/i18n/invariants.test.ts`.
- Parametrizar `helpers.ts` e `purchase-date.ts` por locale mantendo `BRL` como moeda contábil fixa (sem câmbio fictício) e datas civis `YYYY-MM-DD` formatadas em `timeZone: 'UTC'`.
- Entregar bandeiras SVG decorativas (`public/locale-flags/{pt,es,en}.svg`), `LocaleFlagIcon`, `LanguageSwitcher` acessível em `AppHeader` e `MobileNav`, e internacionalização completa do shell transversal.
- Preservar execução sem falhas de `renderToStaticMarkup` standalone no `bun test`, criar `src/test-utils/intl.tsx` e atualizar `src/lib/store.test.ts`, `quiet-navigation.test.tsx` e os helpers `qa.mount` dos 4 harnesses do shell.

**Non-Goals:**
- Internacionalizar visões de domínio/widgets (`dashboard-view.tsx`, `accounts-view.tsx`, `cards-view.tsx`, `advisor` completo, etc.) e `NotificationPanel`, que pertencem à Change 2 (`internacionalizar-visoes-e-widgets-financeiros`).
- Internacionalizar rotas `/api/**`, CSV de exportação e `AIAdvisor`, que pertencem à Change 3 (`internacionalizar-apis-exportacao-e-assistente`).
- Alterar schema SQLite/Prisma, dependências em `package.json`/`bun.lock` ou `docs/operacao-empacotamento.md`.
- Introduzir conversão cambial ou seletor de moeda distinto de `BRL`.

## Approaches

- **Abordagem A — `next-intl@4.7.0` sem URL routing via cookie `NEXT_LOCALE` + `getRequestConfig` [RECOMENDADA / ESCOLHIDA]:**
  - *Mecanismo:* `src/i18n/request.ts` lê o cookie `NEXT_LOCALE` (via `cookies()` de `next/headers`) com fallback em `Accept-Language` (via `headers()`) e padrão `'pt'`, normaliza via `normalizeLocale()`, e delega exclusivamente a `getMessagesForLocale(locale)` / `MESSAGES_BY_LOCALE` de `src/i18n/messages.ts` retornando `{ locale, messages, timeZone: 'UTC' }`. `RootLayout` é assíncrono, lê `getLocale()`/`getMessages()`/`getTranslations('metadata')`, define `<html lang={getHtmlLang(locale)}>` e envolve a aplicação em `AppIntlProvider` (`NextIntlClientProvider` + ponte segura). A troca no cliente grava o cookie `NEXT_LOCALE` e dispara `router.refresh()`.
  - *Trade-offs:* Mantém URL única `/`, zero impacto em `Caddyfile`, APIs e rotas existentes, aproveita SSR nativo do Next.js e tipagem oficial do `next-intl`. Exige que componentes usados também em `bun:test` standalone ou `.qa.mjs` isolado usem `useSafeTranslations`/`useSafeLocale` ou wrapper explícito.
- **Abordagem B — `next-intl` com roteamento `/[locale]/...` e middleware:**
  - *Mecanismo:* Mover `src/app/page.tsx` para `src/app/[locale]/page.tsx` com `defineRouting` e `middleware.ts`.
  - *Trade-offs:* Quebra a premissa de SPA em `/`, obriga redirecionamentos na raiz, complica links/testes/Caddyfile e o empacotamento `output: "standalone"` sem necessidade de SEO multilíngue em um sistema financeiro pessoal. **Descartada.**
- **Abordagem C — Dicionário customizado apenas em Zustand (`src/lib/store.ts`) sem `next-intl`:**
  - *Mecanismo:* Guardar `locale` na store Zustand e criar função `t()` própria com JSONs locais.
  - *Trade-offs:* Ignora `next-intl@4.7.0` já instalada no projeto, perde interpolação/pluralização ICU padronizada, perde `<html lang>` e `generateMetadata()` corretos no SSR inicial (gerando mismatch de idioma no carregamento) e reinventa `AppConfig`. **Descartada.**

## Decisions

### D1: Códigos canônicos, normalização e mapeamento `INTL_LOCALE` (`src/i18n/config.ts`)
- **Escolha:**
  - `CANONICAL_LOCALES = ['pt', 'es', 'en'] as const`, `export type CanonicalLocale = (typeof CANONICAL_LOCALES)[number]`, `DEFAULT_LOCALE: CanonicalLocale = 'pt'`, `LOCALE_COOKIE = 'NEXT_LOCALE'`.
  - `normalizeLocale(input?: string | null): CanonicalLocale`: converte trim + lowercase; prefixo `'pt'` (`pt`, `pt-br`, `pt_PT`) → `'pt'`; prefixo `'es'` (`es`, `es-es`, `es-419`, `es-ar`) → `'es'`; prefixo `'en'` (`en`, `en-us`, `en-gb`) → `'en'`; qualquer outro valor/vazio → `DEFAULT_LOCALE` (`'pt'`).
  - `resolveAcceptLanguage(header?: string | null): CanonicalLocale`: analisa tokens separados por `,` ordenados por peso `;q=` (padrão `1.0`) e retorna o primeiro token cujo idioma base pertença a `CANONICAL_LOCALES`; caso contrário `'pt'`.
  - `INTL_LOCALE: Record<CanonicalLocale, string> = { pt: 'pt-BR', es: 'es-ES', en: 'en-US' }`.
  - `getHtmlLang(locale: CanonicalLocale): string` retorna `INTL_LOCALE[locale]` (`pt-BR`, `es-ES`, `en-US`) para `<html lang>`.
  - `LOCALE_METADATA`: metadados imutáveis por locale com `code` (`'pt' | 'es' | 'en'`), `shortCode` (`'PT' | 'ES' | 'EN'`), autônimo (`'Português'`, `'Español'`, `'English'`) e `flagPath` (`'/locale-flags/{pt,es,en}.svg'`).
  - `setLocaleCookie(locale: CanonicalLocale): void`: persiste `NEXT_LOCALE=<locale>; Path=/; Max-Age=31536000; SameSite=Lax` (e acrescenta `; Secure` quando `window.location.protocol === 'https:'`) quando `typeof document !== 'undefined'`.
- **Justificativa:** Separa claramente o identificador canônico curto (`pt`/`es`/`en`, alinhado às bandeiras e catálogos) da tag BCP-47 para `Intl` e `<html lang>`, evitando duplicação de aliases.

### D2: Catálogos estáticos em `src/messages/`, tipagem `AppMessages`/`AppConfig` e composição incremental (`src/i18n/{messages,types,request}.ts`, `next.config.ts`)
- **Escolha:**
  - Organizar os catálogos dentro de `src/messages/{pt,es,en}/`:
    - `common.json`: namespaces `metadata`, `loading`, `common`, `languageSwitcher`.
    - `shell.json`: namespace `shell` agrupando `navigation`, `header`, `quickActions`, `globalSearch` e `advisorDialog` (evitando qualquer colisão com o futuro catálogo/namespace `advisor.json` da Change 2).
  - `src/i18n/messages.ts` importa estaticamente `../messages/{pt,es,en}/{common,shell}.json`, compõe `MESSAGES_BY_LOCALE` (`{ pt: { ...ptCommon, shell: ptShell }, es: ..., en: ... }`) e exporta `getMessagesForLocale(locale?: string | null)`.
  - `src/i18n/types.ts` deriva `export type AppMessages = typeof MESSAGES_BY_LOCALE.pt;` e faz module augmentation `declare module 'next-intl' { interface AppConfig { Locale: CanonicalLocale; Messages: AppMessages; } }`.
  - `src/i18n/request.ts` usa `getRequestConfig` lendo `cookies()` (`LOCALE_COOKIE`) e fallback `headers()` (`accept-language`) sem segment routing, e **delega exclusivamente** a `getMessagesForLocale(locale)` / `MESSAGES_BY_LOCALE` de `src/i18n/messages.ts` retornando `{ locale, messages: getMessagesForLocale(locale), timeZone: 'UTC' }`.
  - `next.config.ts` envolve `nextConfig` (`output: "standalone"`, `reactStrictMode: false`) com `createNextIntlPlugin('./src/i18n/request.ts')`.
  - **Contrato de extensão para Changes 2 e 3:** A Change 2 (`internacionalizar-visoes-e-widgets-financeiros`, 16 catálogos de domínio incluindo `advisor.json`) e a Change 3 (`internacionalizar-apis-exportacao-e-assistente`, `src/messages/{pt,es,en}/api.json`) estenderão exclusivamente `src/i18n/messages.ts` (e `src/i18n/types.ts` automaticamente via `typeof MESSAGES_BY_LOCALE.pt` ou ajustes explícitos quando necessário), sem alterar `src/i18n/request.ts`, bem como atualizarão os 4 harnesses `.qa.mjs` e `quiet-navigation.test.tsx` conforme novos domínios/textos forem migrados.
- **Justificativa:** `.zscripts/test-sqlite.sh:57-61` monta no sandbox `bwrap` apenas `src`, `prisma/schema.prisma`, `package.json`, `tsconfig.json` e `node_modules` — diretórios na raiz como `messages/` ficariam ausentes durante `test:sqlite`. Além disso, imports estáticos sob `src/messages/` garantem que Turbopack e o tracer do `output: "standalone"` embutam todos os JSONs no bundle do servidor sem depender de paths dinâmicos de filesystem, e a delegação exclusiva de `request.ts` para `messages.ts` torna aditiva a entrada das Changes 2 e 3.

### D3: Provedor, fallback seguro em `renderToStaticMarkup` e `src/test-utils/intl.tsx`
- **Escolha:**
  - `src/i18n/provider.tsx` (`'use client'`) define `AppIntlBridgeContext` (`{ locale: CanonicalLocale; messages: AppMessages } | null`), um componente interno `<AppIntlBridge>` (montado apenas dentro de `<NextIntlClientProvider>`), e `AppIntlProvider({ locale = 'pt', messages = getMessagesForLocale(locale), children })`.
  - Exporta `useSafeLocale(): CanonicalLocale` e `useSafeTranslations<NestedKey>(namespace)`: ambos chamam `useContext(AppIntlBridgeContext)` incondicionalmente (sem violar `react-hooks/rules-of-hooks` no ESLint!). Quando `ctx` existe, usam `ctx.locale` e `createTranslator({ locale: ctx.locale, messages: ctx.messages, namespace })`; quando `ctx` é `null` (renderização standalone via `renderToStaticMarkup` no `bun test`), usam `DEFAULT_LOCALE` (`'pt'`) e `MESSAGES_BY_LOCALE.pt`.
  - `src/test-utils/intl.tsx` exporta `renderWithIntl(node: ReactElement, locale: CanonicalLocale = 'pt'): string` usando `renderToStaticMarkup(<AppIntlProvider locale={locale}>{node}</AppIntlProvider>)` e `IntlTestWrapper`.
  - Em `src/app/page.tsx`, `<Page />` verifica `useContext(AppIntlBridgeContext)`: se ausente (caso de harnesses `.qa.mjs` que montam `<Page />` direto), fornece automaticamente fallback `<AppIntlProvider locale="pt">` ao redor da árvore, além da atualização explícita de `qa.mount` / `qa.mountShell` nos 4 `.qa.mjs` do shell para suportar montagem parametrizada por locale.
- **Justificativa:** Evita falhas de `No intl context found` em testes existentes sem precisar reescrever todos os testes legados de uma vez, preservando 100% da checagem de tipos via `AppMessages`/`AppConfig` e conformidade com ESLint.

### D4: Formatação monetária (`BRL` fixa) e datas civis (`UTC`) em `helpers.ts` e `purchase-date.ts`
- **Escolha:**
  - `src/lib/helpers.ts`:
    - `currencyFmt(v: number, locale?: string)`: `new Intl.NumberFormat(INTL_LOCALE[normalizeLocale(locale)], { style: 'currency', currency: 'BRL' }).format(v)` — **moeda `BRL` fixa sem conversão cambial**.
    - `shortCurrency(v: number, locale?: string)`: compactação consistente com separador decimal do locale (`Intl.NumberFormat(intlLocale, { maximumFractionDigits: 1, minimumFractionDigits: 1 })` para `>= 1000` com sufixos `'M'` / `'k'`, ou `0` casas abaixo de `1000`).
    - `percentFmt(v: number, locale?: string)`: mantém sinal `+` explícito para `v >= 0` e formata o número com 1 casa decimal no locale (`Intl.NumberFormat(intlLocale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })` + `'%'`).
    - `dateFmt(d: string, locale?: string)` e `dateShortFmt(d: string, locale?: string)`: strings `YYYY-MM-DD` ou meia-noite UTC (`date.getTime() % 86_400_000 === 0`) usam `Intl.DateTimeFormat(INTL_LOCALE[normalizeLocale(locale)], { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' | '2-digit' })`; instantes completos válidos preservam formatação local correspondente, e strings inválidas retornam `d` sem lançar exceção (substituindo `date-fns` + `ptBR` hardcoded).
  - `src/lib/purchase-date.ts`:
    - Preserva `civilPurchaseDate`, `purchaseDateForInput`, `purchaseDateForSave` intactos.
    - `formatPurchaseDate(value: string | Date, style: 'date' | 'receipt' = 'date', locale?: string): string`:
      - Se `civilPurchaseDate(value, date)` retornar `YYYY-MM-DD`, formata a data civil a partir de `new Date(\`\${civil}T00:00:00.000Z\`)` usando `Intl.DateTimeFormat(INTL_LOCALE[normalizeLocale(locale)], { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' })` (em `pt-BR` e `es-ES` resulta `19/11/2026`, em `en-US` `11/19/2026`, imune a fuso local).
      - Se não for data civil (instante histórico), usa `Intl.DateTimeFormat(INTL_LOCALE[normalizeLocale(locale)], ...)` no fuso local para `'date'` ou `'receipt'` (`day`, `month`, `year`, `hour`, `minute`).
- **Justificativa:** Elimina divergência entre fusos (`TZ=UTC` vs `TZ=America/Bahia`) mantendo a regra de negócio de `purchase-date.test.ts` verde em todos os 3 idiomas.

### D5: Bandeiras SVG, `LocaleFlagIcon` e `LanguageSwitcher` acessível Quiet Financial OS
- **Escolha:**
  - Copiar fielmente os SVGs `/locale-flags/{pt,es,en}.svg` de `/home/marcelo-karval/Backup/Projetos/prop4you/prop4you-inertia/frontends/front-react/public/locale-flags/` para `public/locale-flags/{pt,es,en}.svg` (com `role="presentation"` nos SVGs e dimensões `viewBox="0 0 30 20"`).
  - Criar `src/components/shared/locale-flag-icon.tsx` exportando `LocaleFlagIcon({ locale, className, ...props })`: renderiza `<img {...props} src={FLAG_PATHS[locale]} alt="" aria-hidden="true" width={24} height={16} className={cn('h-3.5 w-5 shrink-0 rounded-[2px] object-cover', className)} />`. Sem `alt` informativo pois o texto adjacente já identifica o idioma.
  - Criar `src/components/finance/language-switcher.tsx` usando shadcn `DropdownMenu` (`modal={false}`, consistente com `QuickActions`) com `DropdownMenuTrigger`, `DropdownMenuContent` e `DropdownMenuItem`:
    - Modo `variant?: 'compact' | 'full'` (padrão `'compact'`):
      - Em `'compact'` (`AppHeader`): botão `variant="ghost"` com `<LocaleFlagIcon locale={currentLocale} />` + sigla `PT`/`ES`/`EN` em `font-mono text-xs font-medium`, `aria-label` traduzido (`t('label')`, ex.: `"Selecionar idioma"`).
      - Em `'full'` (`MobileNav` dentro do `Sheet`): botão `variant="outline"` largura total com `<LocaleFlagIcon />`, autônimo atual (`Português`/`Español`/`English`) e sigla `PT`/`ES`/`EN`.
    - Menu de opções: lista os 3 itens na ordem canônica `pt`, `es`, `en`, exibindo `<LocaleFlagIcon />`, autônimo (`Português`, `Español`, `English`), sigla (`PT`, `ES`, `EN`) e `<Check aria-hidden="true" />` apenas no idioma ativo (`aria-current="true"` ou `data-active="true"`).
    - Usa exclusivamente `cn()`, tokens semânticos (`border-border`, `bg-card`, `text-foreground`, `text-muted-foreground`), zero cores hardcoded e zero `framer-motion`.
    - Ao selecionar idioma distinto: grava cookie via `setLocaleCookie(nextLocale)` e aciona `router.refresh()` (ou `onLocaleChange?.(nextLocale)` injetável em testes unitários, onde `useRouter` de `next/navigation` pode não estar montado — usando wrapper seguro ou prop opcional `onLocaleSelect`).

### D6: Internacionalização do shell e reconciliação de testes
- **Escolha:**
  - `src/app/layout.tsx`: `generateMetadata()` assíncrona via `getTranslations('metadata')`; `RootLayout` assíncrono obtém `locale` e `messages` via `next-intl/server` (`getLocale()`, `getMessages()`), renderiza `<html lang={getHtmlLang(locale as CanonicalLocale)} suppressHydrationWarning>` e envolve `{children}` + `<Toaster>` em `<AppIntlProvider locale={normalizeLocale(locale)} messages={messages as AppMessages}>`.
  - `src/app/page.tsx`: traduz `"Carregando FinanceApp…"` (`loading.app`), toast `"Dados atualizados"` (`common.dataUpdated`) e mantém todas as assinaturas/propriedades de `applySearchSelection` e `DashboardWithWidgets`.
  - `src/components/finance/sidebar.tsx`: mantém `navigationGroups` e `navigationItems` exportados para retrocompatibilidade, adiciona `labelKey` e traduz grupos, itens, subtítulo `"Patrimônio pessoal"`, `"Espaço pessoal"`, status SSE, `"Recarregar"` e expandir/recolher via `useSafeTranslations('shell.navigation')`.
  - `src/components/finance/app-header.tsx`: traduz `viewContext`, `"Resumo financeiro"`, status offline, botões de busca, tema claro/escuro, assistente, notificações, `"Novo lançamento"` via `useSafeTranslations('shell.header')`, e insere `<LanguageSwitcher variant="compact" />` na barra de ações.
  - `src/components/finance/mobile-nav.tsx`: traduz atalhos, `"Mais"`, `"Mais destinos"`, `"Escolha uma área do FinanceApp."`, `aria-label`s via `useSafeTranslations('shell.navigation')` e inclui `<LanguageSwitcher variant="full" />` no `SheetContent` abaixo dos grupos de navegação.
  - `src/components/finance/quick-actions.tsx`: traduz o trigger (`"Ações rápidas"`) e os 4 itens via `useSafeTranslations('shell.quickActions')` preservando exatamente `view: 'accounts'`, `view: 'purchases'`, `action: 'goal'` e `action: 'export'`.
  - `src/components/finance/app-overlays.tsx`: traduz `advisor-title` e botão fechar do diálogo do assistente via `useSafeTranslations('shell.advisorDialog')`.
  - `src/components/finance/global-search.tsx` e `global-search-result.tsx`: traduz títulos/descrições/placeholders/erros/empty states/rodapé via `useSafeTranslations('shell.globalSearch')`, mantendo `searchGroupMeta` e `buildSearchResults(rawData, query, options?)` retrocompatíveis com chamadas de 2 argumentos.
  - Atualizar `src/lib/store.test.ts` (onde inspeciona `quick-actions.tsx` por regex de string literal) e `src/components/finance/quiet-navigation.test.tsx` (onde inspeciona `global-search.tsx` por substring literal + adicionar cobertura em `pt`, `es` e `en` com `renderWithIntl`).
  - Atualizar `qa.mount` / `qa.mountShell` nos 4 arquivos `.qa.mjs` do shell (`quiet-componentization.qa.mjs`, `quiet-search-parity.qa.mjs`, `quiet-account-transaction-focus.qa.mjs`, `quiet-primary-operations.qa.mjs`) para prover `AppIntlProvider` explícito (e documentar que Change 2/3 podem estender esses harnesses e `quiet-navigation.test.tsx` quando migrarem as visões/APIs).

## Risks / Trade-offs

- **[Risk] `next/navigation` `useRouter()` lançar erro fora do App Router Next.js (ex.: `bun:test` ou bundle `.qa.mjs`)** → Mitigation: Em `LanguageSwitcher`, isolar o refresh de router ou usar `window.location.reload()` / wrapper seguro quando `onLocaleSelect` não for fornecido e o contexto App Router não estiver presente (ou injetar `onLocaleChange` opcional e usar `try/catch` ao resolver `useRouter` apenas em componente cliente montado dentro do App Router; alternativamente, um pequeno `NextRouterContext` ou `useRouter` protegido por wrapper). Como `AppRouterContext` do Next é interno, a solução mais robusta e sem hacks é: se `router` do Next estiver disponível via `useRouter` (em `Page` ou `AppHeader` sempre dentro do Next App Router em produção), funciona normalmente; em `bun:test` (`renderToStaticMarkup`), `useRouter` de `next/navigation` retorna `null` ou lança `invariant expected app router to be mounted`! Portanto, em `LanguageSwitcher`, evitar chamar `useRouter()` diretamente no corpo se puder rodar fora do Next App Router — usar prop opcional `onRefresh?: () => void` passada por `Page` / `AppHeader` (ou um `AppRefreshContext` fornecido por `AppIntlProvider` / `Page` em runtime Next.js usando um micro-componente cliente `NextAppIntlRefreshBridge` montado apenas no `RootLayout`!), mantendo `LanguageSwitcher` 100% livre de erro `expected app router to be mounted` no `bun:test` e `.qa.mjs`!
- **[Risk] Aviso `large-tsx-file` (> 500 linhas) no `arch:check` em `global-search.tsx` (atualmente 443 linhas)** → Mitigation: Manter `global-search.tsx` abaixo de 500 linhas delegando dicionários/labels e subcomponentes já existentes em `global-search-result.tsx`.
- **[Risk] `raw-conditional-class-name` ou import de `framer-motion` reprovarem `bun --no-env-file run arch:check`** → Mitigation: Compor todas as classes dinâmicas exclusivamente com `cn(...)` e não importar `framer-motion` em nenhum arquivo novo ou editado.
- **[Trade-off] `NotificationPanel` permanece em `pt-BR` nesta change** → Aceito: `NotificationPanel` contém rótulos e datas relativas de domínio financeiro cobertas pela Change 2 (`internacionalizar-visoes-e-widgets-financeiros`), enquanto `AppHeader` apenas controla a abertura e acessibilidade do botão de notificações.

## Migration Plan

1. Implementar núcleo i18n, catálogos `src/messages/{pt,es,en}/{common,shell}.json`, `next.config.ts`, `RootLayout` e testes invariantes (Task 1.1).
2. Atualizar `helpers.ts`, `purchase-date.ts` e `purchase-date.test.ts` (Task 1.2) e ativos SVG + `LocaleFlagIcon` + `LanguageSwitcher` (Task 1.3) em paralelo sem colisão de arquivos.
3. Migrar shell (`page.tsx` e 7 componentes em `src/components/finance/`), atualizar `store.test.ts`, `quiet-navigation.test.tsx` e os 4 `.qa.mjs` do shell (Task 2.1).
4. Validar com `bun --no-env-file run check`, `bun --no-env-file run test:sqlite` e `DATABASE_URL="file:/tmp/ci-build-inert.db" bun --no-env-file run build`. Rollback possível integralmente via reversão da branch/working tree pois não há mudança de schema ou dados persistidos.

## Open Questions

- Nenhuma pendência material em aberto; todas as assinaturas e limites de escopo frente às Changes 2 e 3 foram resolvidos na inspeção do repositório.
