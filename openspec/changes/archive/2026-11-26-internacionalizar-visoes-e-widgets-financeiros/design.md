# Design — Internacionalização das Visões e Widgets Financeiros

## Context

A aplicação utiliza Next.js `16.1.1`, React `19`, `next-intl` `^4.3.4`, `date-fns` `^4.1.0`, Tailwind CSS v4 e o sistema visual Quiet Financial OS governado pelo gate AST `.zscripts/check-frontend-architecture.ts` (baseline `25b44535c5068b99044afa03f7ecf318e7a9726f` com 6 entradas aprovadas em `.zscripts/frontend-architecture-baseline.json`).

Esta mudança (**Change 2**) pressupõe a **Change 1 (`estruturar-fundacao-i18n-shell-e-formatacao`) já integrada à `main`**, fornecendo:
- `src/i18n/{config,messages,types,request,provider}.ts(x)` — incluindo `AppIntlProvider`, `useSafeTranslations` e `useSafeLocale` em `@/i18n/provider`, que fornecem fallback seguro para `'pt'` quando componentes são renderizados via `renderToStaticMarkup` sem provider (ex.: `src/lib/purchase-date.test.ts:70,80` em `bun test` e `test:sqlite`);
- `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`;
- shell e busca global (`app-header.tsx`, `app-overlays.tsx`, `sidebar.tsx`, `mobile-nav.tsx`, `quick-actions.tsx`, `global-search.tsx`, `global-search-result.tsx`, `LocaleFlagIcon`, `LanguageSwitcher`);
- formatadores base em `src/lib/helpers.ts` (`currencyFmt(v, locale)`, `shortCurrency(v, locale)`, `dateFmt(d, locale)`, `dateShortFmt(d, locale)`, `percentFmt(v, locale)`) e `src/lib/purchase-date.ts` (`formatPurchaseDate`);
- utilitário de teste `src/test-utils/intl.tsx` (`IntlTestWrapper` e `renderWithIntl(node, locale)`) e catálogos base `src/messages/{pt,es,en}/{common,shell}.json` (onde `shell.advisorDialog.*` cobre apenas o diálogo em `app-overlays.tsx`).

As rotas backend (`src/app/api/**`) permanecem exclusivas da **Change 3 (`internacionalizar-apis-exportacao-e-assistente`)** e não são modificadas aqui.

## Goals / Non-Goals

**Goals:**
- Traduzir 100% dos textos de interface, rótulos acessíveis (`aria-label`, `title`, `placeholder`), toasts, estados `loading`/`error`/`empty` e mensagens de validação client-side nos 7 primitivos de `src/components/shared/` e nos 63 módulos de domínio de `src/components/finance/` via `useSafeTranslations` e `useSafeLocale` (`@/i18n/provider`).
- Organizar as traduções em **16 namespaces modulares** (`shared`, `dashboard`, `goals`, `analytics`, `accounts`, `cards`, `purchases`, `categories`, `receipts`, `investments`, `installments`, `consortiums`, `savings`, `recurring`, `notifications`, `advisor`) em `src/messages/{pt,es,en}/<namespace>.json` (48 JSONs) e registrá-los em `src/i18n/messages.ts`, `src/i18n/types.ts` e `src/i18n/request.ts`.
- Preservar a moeda **BRL** sem conversão cambial fictícia, usando `currencyFmt(v, locale)`, `shortCurrency(v, locale)` e `dateFmt(d, locale)` de `src/lib/helpers.ts`, datas localizadas e impressão de recibos no idioma ativo.
- Manter **0 erros** no gate AST `arch:check` (preservando exatamente as 6 entradas do baseline) e evitar ultrapassar 500 linhas nos arquivos atualmente abaixo desse limiar.
- Atualizar as 14 suítes de teste (`IntlTestWrapper` / `renderWithIntl`), adaptar os 14 runners `.qa.mjs` (`AppIntlProvider` no sandbox isolado) e adicionar `src/components/finance/quiet-i18n.qa.mjs`.

**Non-Goals:**
- Não editar `src/app/api/**` (Change 3), `src/components/ui/**` (shadcn), `db/custom.db`, nem arquivos de shell/layout/helpers da Change 1 (exceto o registro dos 16 namespaces de domínio em `src/i18n/messages.ts`, `src/i18n/types.ts` e `src/i18n/request.ts` na Task 2.1).
- Não traduzir dados gravados pelo usuário no banco (nomes de contas, cartões, categorias ou descrições de lançamentos).
- Não alterar fórmulas financeiras, contratos HTTP, travas `useKeyedMutationLock`, descarte via `AbortController`, retorno de foco pós-exclusão ou máscara de privacidade.

## Approaches

### Abordagem A — Arquivo monolítico por idioma (`messages/{pt,es,en}.json`) com mapas inline
- **Prós:** um único import por locale em `src/i18n/messages.ts`.
- **Contras:** gera conflitos de escrita entre tarefas paralelas (`1.1`–`1.4`), dificulta revisão por domínio e empurra arquivos já extensos (`recurring-transactions.tsx` 481 linhas, `debt-sections.tsx` 472, `transaction-analysis-tabs.tsx` 470) para além de 500 linhas ao expandir helpers de tradução inline.

### Abordagem B — Namespaces modulares por domínio + catálogos puros por família + wiring em `src/i18n/{messages,types,request}.ts` (Escolhida)
- **Descrição:** cada uma das 4 tarefas paralelas (`1.1`–`1.4`) escreve seus próprios componentes com `useSafeTranslations` / `useSafeLocale` (`@/i18n/provider`), seus JSONs modulares (`src/messages/{pt,es,en}/<namespace>.json`) e, quando aplicável, um catálogo puro próprio da família (`analytics-i18n.ts`, `operations-i18n.ts`, `portfolio-i18n.ts`). Na Task `2.1` (pós-`1.1..1.4` e pós-Change 1 na `main`), `src/i18n/messages.ts`, `src/i18n/types.ts` e `src/i18n/request.ts` passam a importar, mesclar e tipar em `AppConfig.Messages` os 16 namespaces de domínio junto de `common` e `shell`, sem alterar shell, header ou layout.
- **Prós:** zero colisão de escrita entre `1.1`, `1.2`, `1.3` e `1.4`; JSONs pequenos e coerentes; mantém tipagem estrita `tsc --noEmit` para todas as chaves de tradução; mantém execução standalone de `renderToStaticMarkup` (como `src/lib/purchase-date.test.ts:70,80`) sem erro `No intl context found`; mantém arquivos `<= 500` linhas abaixo do limite do `large-tsx-file`.
- **Contras:** requer consistência exata dos nomes dos 16 namespaces entre as 4 tarefas e `src/i18n/{messages,types,request}.ts` (mitigado por contrato explícito em `plan.md` e checagem automatizada de paridade de chaves).

### Abordagem C — Carregamento dinâmico via `fs` ou fetch em runtime no cliente
- **Contras:** incompatível com `output: "standalone"` sem tracing extra e quebra o bundling direto dos arquivos `.qa.mjs` via `Bun.build`. Descartada.

## Decisions

### 1. Estrutura dos 16 namespaces modulares e fronteira `shell.advisorDialog` vs `advisor`
Cada locale (`pt`, `es`, `en`) mantém 16 arquivos JSON em `src/messages/<locale>/<namespace>.json`:
- **Task 1.1:** `shared`, `dashboard`, `notifications`, `advisor`
- **Task 1.2:** `goals`, `analytics`
- **Task 1.3:** `accounts`, `cards`, `purchases`, `categories`, `receipts`
- **Task 1.4:** `investments`, `installments`, `consortiums`, `savings`, `recurring`

**Fronteira explícita do Assistente:** na Change 1, `src/messages/{pt,es,en}/shell.json` contém `shell.advisorDialog.*` (título e ação de fechar do `<dialog>` nativo em `app-overlays.tsx`). Na Change 2, o namespace dedicado `src/messages/{pt,es,en}/advisor.json` cobre exclusivamente `ai-advisor.tsx` e `advisor-composer.tsx` (cabeçalho do painel, mensagem de boas-vindas, sugestões rápidas, indicador de digitação, papéis das mensagens, placeholder/`aria-label` do compositor e fallbacks de erro de rede).

Todos os arquivos mantêm exatamente o mesmo conjunto de chaves nas três árvores (`pt`, `es`, `en`), validado por teste automatizado na `Task 2.1`. Textos com contagens variáveis utilizam pluralização ICU (`{count, plural, one {...} other {...}}`), evitando concatenações manuais como `plano${count !== 1 ? 's' : ''}`.

### 2. Integração estática e tipagem `AppConfig` em `src/i18n/{messages,types,request}.ts`
Change 2 **só inicia após a Change 1 estar integrada na `main`**. Na Task `2.1`, após a conclusão de `1.1`–`1.4`:
- **`src/i18n/messages.ts`:** atualiza o mapa estático de imports de `pt`, `es` e `en` para compor os 16 namespaces de domínio (`shared`, `dashboard`, `goals`, `analytics`, `accounts`, `cards`, `purchases`, `categories`, `receipts`, `investments`, `installments`, `consortiums`, `savings`, `recurring`, `notifications`, `advisor`) junto dos namespaces `common` e `shell` criados pela Change 1.
- **`src/i18n/types.ts`:** atualiza a derivação de `Messages` / `AppConfig.Messages` a partir da estrutura completa de `messages.ts` para que `useSafeTranslations('<namespace>')` e `tsc --noEmit` reconheçam os 16 novos namespaces sem erros de tipo.
- **`src/i18n/request.ts`:** garante que `getRequestConfig` retorne o objeto completo montado por `getMessagesForLocale(locale)` (mesclando os 16 domínios com `common` e `shell`), sem alterar negociação de cookie `NEXT_LOCALE`, fallback `Accept-Language`, `timeZone`, layout, header ou shell.

### 3. Hooks seguros (`@/i18n/provider`), moeda `BRL` e datas localizadas
- **Hooks obrigatórios nos componentes:** todos os componentes em `src/components/shared/` e `src/components/finance/` importam **`useSafeTranslations`** e **`useSafeLocale`** de **`@/i18n/provider`** (em vez de `useTranslations`/`useLocale` crus de `next-intl`). Isso assegura fallback determinístico para `'pt'` quando renderizados via `renderToStaticMarkup` sem provider — preservando especialmente **`src/lib/purchase-date.test.ts:70,80`** (`CardsView` e `DashboardContent`) em `bun test` e `test:sqlite` (`bwrap`) sem lançar `No intl context found`.
- **Moeda `BRL` preservada:** não há conversão cambial; todas as formatações monetárias chamam `currencyFmt(v, locale)` e `shortCurrency(v, locale)` de `src/lib/helpers.ts` passando o `locale` retornado por `useSafeLocale()` (ou `useFormatter()` quando aplicável), formatando em reais brasileiros (`currency: 'BRL'`) conforme `pt-BR`, `es-ES` ou `en-US`.
- **Máscara de privacidade:** `FinanceMetric`, `FinanceRow`, `FinanceChartTooltip` e `DashboardContent` aplicam `t('maskedValue')` (do namespace `shared`) como padrão quando `showValues === false`, garantindo que nenhum dígito real reapareça no texto visível ou em `aria-label` (`sanitizeMaskedLabel`).
- **Datas e `date-fns`:** todas as chamadas de data simples reutilizam `dateFmt(d, locale)` e `dateShortFmt(d, locale)` de `src/lib/helpers.ts` ou `formatPurchaseDate(value, style, locale)` de `src/lib/purchase-date.ts` passando `locale` de `useSafeLocale()`. Chamadas específicas ao `date-fns` (`format`, `formatDistanceToNow` no calendário, orçamento mensal, desafio de poupança, detalhes do dia e notificações) recebem o objeto `Locale` correspondente (`pt` → `ptBR`, `es` → `es`, `en` → `enUS`). Chamadas diretas remanescentes a `toLocaleDateString('pt-BR')`, `toLocaleTimeString('pt-BR')`, `toLocaleString('pt-BR')` e `Intl.NumberFormat('pt-BR')` / `Intl.DateTimeFormat('pt-BR')` passam a usar `INTL_LOCALE[locale]`.
- **Datas civis:** datas no formato `YYYY-MM-DD` (como `nextAssemblyDate` em `consortiums-view.tsx` e dias do `financial-calendar-grid.tsx`) continuam sendo interpretadas como dia civil sem deslocamento por fuso horário (`UTC` vs `America/Bahia`).

### 4. Funções puras fora do ciclo React (`dashboard-query.ts` e `receipt-fields.ts`)
- `dashboard-query.ts`: `QUICK_FILTERS` preserva os identificadores `{ key: 'month' | 'quarter' | 'halfyear' | 'year' | 'all' }` e `dashboard-view.tsx` resolve o rótulo visível via `t(`filters.${filter.key}`)`. `fetchDashboard` lança código/mensagem HTTP preservando o contrato testado em `dashboard-query.test.ts`.
- `receipt-fields.ts` e `buildReceiptPrintHtml` (`receipt-generator.tsx`): mantêm assinatura compatível com chamadas puras de 1 argumento (`buildReceiptFields(receipt)`) usando defaults seguros em `pt-BR` e `currencyFmt(v, locale)` de `src/lib/helpers.ts`, e recebem um segundo parâmetro opcional (`options?: { locale?: string; labels?: Partial<Record<ReceiptFieldKey, string>>; unavailableAmount?: string }` e equivalente de impressão com `lang`), preenchido pelo componente `ReceiptGenerator` a partir de `useSafeTranslations('receipts')` e `useSafeLocale()`.

### 5. Blindagem do gate AST e orçamento de linhas
- **Preservação das 6 identidades do baseline:** em `balance-projection.tsx` (`MonthSelector`), `dashboard-view.tsx` (`Metric`), `installments-view.tsx` (`InstallmentMetrics`), `investments-view.tsx` (`InvestmentMetrics`) e `networth-evolution.tsx` (`NetworthEvolutionContent`), as expressões `className` cobertas por `.zscripts/frontend-architecture-baseline.json` permanecem sintaticamente intactas para não gerar erros `orphan` ou `unbaselined`.
- **Uso estrito de `cn()`:** nenhuma nova interpolação condicional crua em `className` é introduzida.
- **Extração de catálogos estáticos de enums:** para manter abaixo de 500 linhas arquivos no limite (`recurring-transactions.tsx` 481, `debt-sections.tsx` 472, `transaction-analysis-tabs.tsx` 470, `categories-view.tsx` 454, `networth-evolution.tsx` 451, `cards-view.tsx` 431, `receipt-generator.tsx` 429, `cash-flow-forecast.tsx` 417, `purchases-view.tsx` 406) e reduzir inflação em arquivos > 500 linhas (`accounts-view.tsx`, `consortiums-view.tsx`, `investments-view.tsx`, `installments-view.tsx`, `savings-view.tsx`, `balance-projection.tsx`), mapas estáticos de tipos/status/frequências/cores são extraídos para:
  - `src/components/finance/analytics-i18n.ts` (Task `1.2`)
  - `src/components/finance/operations-i18n.ts` (Task `1.3`)
  - `src/components/finance/portfolio-i18n.ts` (Task `1.4`)

### 6. Testes unitários e runners Playwright `.qa.mjs`
- Os 14 arquivos de teste em `src/components/finance/*.test.*` passam a utilizar **`IntlTestWrapper`** e **`renderWithIntl(node, locale)`** de **`src/test-utils/intl.tsx`** (Change 1) para renderizações SSR (`renderToStaticMarkup`) em `pt`, `es` e `en`, trocando asserções frágeis de leitura de arquivo por validações de renderização multi-idioma (preservando verificações estruturais como `AbortController`, `useKeyedMutationLock`, `QueryPanel` e tokens `--ds-*`). Testes em `src/lib/purchase-date.test.ts:70,80` continuam rodando sem alteração graças a `useSafeTranslations`/`useSafeLocale`.
- Os 14 runners `src/components/finance/*.qa.mjs` atualizam seus scripts de montagem (`window.qa.mount`) para envolver a árvore montada com **`AppIntlProvider`** de `@/i18n/provider` (padrão `locale="pt"` nos cenários existentes para manter paridade das asserções nas 6 células `360/390/1440 × light/dark`), sendo validados no sandbox isolado equivalente ao das Ondas 1–2 (`systemd-run --user` + `bwrap` com `CI=1`, `QUIET_QA_SCRATCH`, ausência de `.git`/`.env`/`db` e hashes `QUIET_QA_BASELINE_*`).
- Um novo runner **`src/components/finance/quiet-i18n.qa.mjs`** valida diretamente em headless Chromium (`playwright-cli`) a alternância entre `pt`, `es` e `en` nos principais domínios (Resumo, Contas, Cartões, Recibos, Investimentos, Metas, Análises, Notificações, Assistente), conferindo tradução efetiva, ausência de chaves cruas, moeda `BRL` e ausência de rolagem horizontal nas 6 células.

## Risks / Trade-offs

- **Risco:** alteração acidental do AST de uma das 6 expressões `className` do baseline em `.zscripts/frontend-architecture-baseline.json`.
  - **Mitigação:** cada task executa `bun --no-env-file run arch:check` após editar os arquivos do seu lote, garantindo `6 ocorrências em 6 identidades; 0 erros`.
- **Risco:** `tsc --noEmit` falhar em componentes que chamam `useSafeTranslations('<namespace>')` antes da atualização de `src/i18n/types.ts` na Task `2.1`.
  - **Mitigação:** cada tarefa `1.1`–`1.4` garante chaves válidas nos seus JSONs e a Task `2.1` registra e tipa todos os 16 namespaces em `src/i18n/messages.ts`, `src/i18n/types.ts` e `src/i18n/request.ts`, validando o `typecheck` global integrado.
- **Risco:** `Bun.build` nos 14 runners `.qa.mjs` falhar ao resolver imports de `@/i18n/provider` ou JSONs em bundle browser isolado, ou rodar fora do sandbox exigido (`QUIET_QA_SCRATCH`/`CI=1`/`QUIET_QA_BASELINE_*`).
  - **Mitigação:** na Task `2.1`, validar os 14 `.qa.mjs` dentro do sandbox `bwrap`/`systemd-run --user` com as variáveis `QUIET_QA_*` exigidas e executar `quiet-i18n.qa.mjs` conforme seu contrato de runner headless.
- **Risco:** alguma chave adicionada em `pt` faltar em `es` ou `en`.
  - **Mitigação:** incluir verificação automatizada de paridade recursiva de chaves entre `pt`, `es` e `en` para todos os 16 namespaces dentro da suíte de testes da Task `2.1`.

## Migration Plan

1. **Pré-condição:** confirmar `estruturar-fundacao-i18n-shell-e-formatacao` integrada na `main` (presença de `src/i18n/{config,messages,types,request,provider}.ts(x)`, `src/lib/helpers.ts` locale-aware e `src/test-utils/intl.tsx`).
2. **Onda 1 (paralela):** executar Tasks `1.1`, `1.2`, `1.3` e `1.4` em frentes isoladas sem sobreposição de `Write paths`.
3. **Onda 2 (integração e validação):** executar Task `2.1` conectando e tipando os 16 namespaces em `src/i18n/{messages,types,request}.ts`, atualizando os testes (`IntlTestWrapper`/`renderWithIntl`) e `.qa.mjs` (`AppIntlProvider`), criando `quiet-i18n.qa.mjs` e rodando a bateria completa (`check`, `test:sqlite`, `build` e suítes Playwright no sandbox isolado).
4. **Rollback:** caso ocorra regressão em um namespace específico, é possível reverter a fatia por tarefa mantendo as fronteiras entre `1.1`–`1.4` isoladas.
