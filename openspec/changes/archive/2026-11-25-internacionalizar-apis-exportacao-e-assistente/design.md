## Context

O backend Next.js App Router (`src/app/api/**`) atualmente mistura strings em `pt-BR` e inglês, chama `toLocaleString('pt-BR')` / `date-fns/locale/ptBR` diretamente nos handlers, gera CSV apenas em português (`/api/export`), instrui o LLM a responder somente em português (`/api/advisor`) e retorna respostas de erro `{ error }` sem código de erro estável (`code`). Paralelamente, as Changes 1 e 2 atuam no cliente/shell (`src/i18n/*`) e nos componentes React (`src/components/{finance,shared}/*`), enquanto quatro suítes SQLite opt-in (`test:sqlite` em `bwrap`) e diversas suítes unitárias em `src/app/api/**/*.test.ts` dependem de comportamento determinístico em `'pt'` quando nenhum locale alternativo é solicitado.

## Goals / Non-Goals

**Goals:**
- Implementar resolução unificada de locale no servidor (`?locale=` → cookie `NEXT_LOCALE` → header `Accept-Language` → `'pt'`) em `src/lib/server-i18n.ts` com catálogos `src/messages/{pt,es,en}/api.json`.
- Localizar rótulos temporais via `Intl.DateTimeFormat`, textos de resposta, exportação CSV, prompt do `/api/advisor` e mensagens de erro/sucesso em todas as rotas dependentes de idioma, sempre mantendo `'pt'` como fallback e `BRL` como moeda contábil sem conversão cambial.
- Expor chaves ISO neutras aditivas (`monthKey`, `dateKey`, `estimatedCompletionKey`, `monthKeys`, `dayIndex`) em séries e calendários, e expor códigos de erro estáveis (`code`) em `api-validation.ts` e rotas CRUD.
- Garantir `0` regressões nos testes existentes, inclusive nas suítes `test:sqlite` (`installments/route.test.ts`, `purchases/route-integrity.test.ts`, `consortiums/assembly.test.ts`, `savings/route.test.ts`) e `api-validation.test.ts`.

**Non-Goals:**
- Converter valores monetários para USD/EUR ou introduzir taxas de câmbio (regra contábil fixa: `BRL` sempre).
- Modificar `src/i18n/*`, `src/components/{finance,shared}/*`, `src/lib/purchase-date.ts`, `prisma/schema.prisma` ou `db/custom.db`.
- Traduzir dados cadastrados pelo próprio usuário no banco (nomes de contas, categorias, descrições, estabelecimentos).
- Editar os 4 arquivos de teste `test:sqlite` para relaxar contratos existentes.

## Approaches

Três alternativas arquiteturais foram avaliadas para internacionalizar a camada de API:

1. **Abordagem A (Escolhida) — Módulo leve `src/lib/server-i18n.ts` + catálogos JSON estáticos `src/messages/{pt,es,en}/api.json` + `Intl` nativo:**
   - Importa os três arquivos `api.json` estaticamente (sem I/O de disco em runtime nem dependência de request-context React/Next), resolve o idioma de cada `Request`/`NextRequest` pela cadeia `?locale=` → cookie `NEXT_LOCALE` → `Accept-Language` → `'pt'`, e fornece helpers puros para interpolação, datas `Intl`, moeda `BRL` e respostas de erro `{ error, code }`.
   - **Vantagens:** zero colisão com `src/i18n/*` (Change 1) e `src/components/*` (Change 2); funciona identicamente em rotas App Router, `bun test` unitário com `NextRequest` sintético e `bwrap` (`test:sqlite`); não adiciona dependências nem altera `bun.lock`.

2. **Abordagem B (Rejeitada) — Reutilizar `getTranslations`/`getLocale` de `next-intl/server` dentro dos route handlers:**
   - Exigiria acoplar todas as rotas API ao arquivo `src/i18n/request.ts` criado pela Change 1 e tornaria testes que invocam `GET()` sem parâmetros ou `new Request(...)` fora do ciclo de `headers()`/`cookies()` do Next.js propensos a falhar por ausência de AsyncLocalStorage.

3. **Abordagem C (Rejeitada) — Retornar apenas chaves/códigos das APIs e traduzir tudo no frontend:**
   - Não atende `/api/export` (que gera arquivo CSV pronto para download), `/api/advisor` (que constrói o `systemPrompt` e o resumo financeiro enviados ao LLM), nem `/api/receipt`, `/api/insights` e `/api/forecast`, cujo contrato atual entrega texto formatado ao consumidor.

## Decisions

### D1: Resolução de locale e formatadores em `src/lib/server-i18n.ts`
- **Escolha:**
  - `export type SupportedLocale = 'pt' | 'es' | 'en';`
  - `INTL_LOCALE_MAP = { pt: 'pt-BR', es: 'es-ES', en: 'en-US' } as const;`
  - `resolveRequestLocale(request?: Request | NextRequest): SupportedLocale` avalia em ordem estrita:
    1. Query param `?locale=` da URL (normalizado pela subtag primária `pt|es|en`);
    2. Cookie `NEXT_LOCALE` (via `request.cookies` se disponível ou parsing do header `Cookie`);
    3. Header `Accept-Language` (ordenando tags por qualidade `q=` decrescente e aceitando o primeiro idioma suportado);
    4. Fallback `'pt'`.
  - `hasExplicitLocaleSignal(request?: Request | NextRequest): boolean` retorna `true` somente quando pelo menos uma das fontes 1–3 fornece um tag de idioma suportado (ou qualquer `?locale=` válido), permitindo identificar chamadas legadas sem cabeçalhos/parâmetros.
  - Formatadores puros:
    - `formatServerCurrencyBRL(value, locale)`: `new Intl.NumberFormat(INTL_LOCALE_MAP[locale], { style: 'currency', currency: 'BRL' }).format(value)`.
    - `formatServerNumber(value, locale, options)`: `new Intl.NumberFormat(INTL_LOCALE_MAP[locale], options)`.
    - `formatServerMonthLabel(date, locale, options)`: `Intl.DateTimeFormat(INTL_LOCALE_MAP[locale], options ?? { month: 'short', year: '2-digit' }).format(date)`.
    - `formatServerDate(date, locale, style)`: formata `'date'` (`day: '2-digit', month: '2-digit', year: 'numeric'`) ou `'datetime'` (com hora/minuto) via `Intl.DateTimeFormat`.
    - `formatServerPurchaseDate(value, locale, style)`: reutiliza `civilPurchaseDate(value)` de `@/lib/purchase-date` para manter datas civis (meia-noite UTC) sem deslocamento de fuso, formatando via `Intl.DateTimeFormat(INTL_LOCALE_MAP[locale], ...)` em UTC para data civil ou no fuso local para instantes históricos — preservando exatamente `dd/mm/yyyy` e `dd/mm/yyyy, hh:mm` em `'pt'` sem modificar `src/lib/purchase-date.ts`.
    - `formatServerWeekdayShort(dayIndex, locale)`: formata o dia da semana (`0=Dom .. 6=Sáb`) via `Intl.DateTimeFormat`, preservando em `'pt'` exatamente `['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']` e capitalizando/normalizando abreviações em `'es'` e `'en'`.

### D2: Rotas analíticas, séries, calendário, faturas e recibos
- **Escolha:**
  - Todas as rotas `GET` que hoje não recebem `request` (`quick-stats`, `goals-dashboard`, `upcoming-bills`, `debts`) passam a aceitar `request?: NextRequest` opcional para preservar chamadas `GET()` sem argumentos.
  - `dashboard`, `networth`, `reports`, `balance-projection`, `expense-breakdown`, `transaction-analytics`, `goals-dashboard`: substituem `toLocaleString('pt-BR')` e `date-fns/locale/ptBR` por `formatServerMonthLabel`/`formatServerWeekdayShort`, mantendo os campos atuais e adicionando chaves ISO neutras (`monthKey: "YYYY-MM"` nos itens de série, `monthKeys: string[]` em `balance-projection`, `estimatedCompletionKey: "YYYY-MM"` em `goals-dashboard`, `dayIndex: 0..6` em `transaction-analytics`).
  - `financial-calendar` e `timeline`: substituem rótulos fixos de semana e `"Sem categoria"` via catálogo e adicionam `dateKey` (`YYYY-MM-DD`) sem alterar o formato de `date` e `time` já testados por `purchase-date.test.ts` (`CALENDAR_D3_SQLITE=1`) e `timeline/route.test.ts`.
  - `upcoming-bills` e `receipt`: localizam rótulos (`Parcelamento`, `Consórcio`, `Fatura {card}`, `Recorrente`, tipos `INCOME`/`EXPENSE`/`TRANSFER`, `"Sem categoria"`, `"N/A"`) mantendo `rawType`, `amountRaw`, `totalAmountRaw`, `totalPriceRaw` e `BRL` contábil.

### D3: Rotas narrativas (`insights`, `forecast`, `achievements`, `savings-challenge`)
- **Escolha:**
  - `insights`, `achievements` e `savings-challenge` passam a aceitar `request?: NextRequest` opcional.
  - `insights/route.ts`: move os 10 templates (`title`, `description`, `action`, unidades de `metric`) para `api.json`, usando `formatServerCurrencyBRL` e preservando no `'pt'` exatamente as strings/métricas verificadas por `insights/route.test.ts` (`"70% completa"`, `"533,33/mês"`, `"9.0 meses"`).
  - `forecast/route.ts`: localiza nomes longos dos meses em `forecastMonths[]` (com `monthKey: "YYYY-MM"` aditivo), `"Outros"`, os 5 `riskAlerts` e erros 400/500.
  - `achievements/route.ts`: localiza `title` e `description` das 12 conquistas preservando `id`, `icon` e o enum `category` (`'poupanca' | 'controle' | 'investimento' | 'exploracao'`).
  - `savings-challenge/route.ts`: localiza os 3 `challengeTargets` (`title`, `description`) mantendo valores numéricos e `BRL` contábil (ex.: meta mensal de R$ 500 formatada em `BRL` para o locale).

### D4: Exportação CSV em `/api/export`
- **Escolha:**
  - `GET /api/export` resolve o idioma via `resolveRequestLocale(request)` (incluindo `?locale=pt|es|en`).
  - Localiza cabeçalhos das colunas, tipos de transação (`INCOME`/`EXPENSE`/`TRANSFER`), tipos de conta (`CASH`/`BANK`/`DIGITAL_WALLET`), booleanos (`Sim`/`Sí`/`Yes`, `Não`/`No`/`No`), `"À vista"`/`"Al contado"`/`"In full"`, formatação numérica (`formatServerNumber(..., { minimumFractionDigits: 2, maximumFractionDigits: 2 })`), datas (`formatServerDate` e `formatServerPurchaseDate`), e nomes dos arquivos (`transacoes.csv`/`transacciones.csv`/`transactions.csv`, `compras.csv`/`purchases.csv`, `contas.csv`/`cuentas.csv`/`accounts.csv`).
  - Mantém estritamente `\uFEFF` (UTF-8 BOM), separador `;` e `escapeCsv` com neutralização anti-formula-injection (`'${value}` sem duplo escape) validados por `export/route.test.ts`.

### D5: Assistente IA em `/api/advisor`
- **Escolha:**
  - `POST /api/advisor` resolve o idioma via `resolveRequestLocale(request)` (com fallback `'pt'`).
  - Localiza seção de resumo financeiro e `systemPrompt` para `pt`, `es` e `en`:
    - Instrução explícita do idioma de resposta (`português brasileiro` / `español` / `English`);
    - Preservação explícita da moeda `BRL` (`R$ / BRL`);
    - Tags de transação localizadas (`[Receita]`/`[Despesa]`/`[Transferência]` em `pt`, `[Ingreso]`/`[Gasto]`/`[Transferencia]` em `es`, `[Income]`/`[Expense]`/`[Transfer]` em `en`);
    - Status de saldo sem emojis (`(superávit)`/`(déficit)` em `pt`/`es`, `(surplus)`/`(deficit)` em `en`);
    - Preservação integral da sanitização e delimitação `<user_context>...</user_context>` com aviso de dados não confiáveis no respectivo idioma (`DADOS NÃO CONFIÁVEIS` em `pt`, `DATOS NO CONFIABLES` em `es`, `UNTRUSTED DATA` em `en`), e omissão de `lastFourDigits` de cartões.

### D6: Erros estruturados (`code`) em `api-validation.ts` e CRUDs sem quebrar `test:sqlite`
- **Escolha:**
  - Definir `apiErrorResponse(code, message, status, options?)` e `apiSuccessMessage(...)` em `src/lib/server-i18n.ts`: sempre define header HTTP `X-Error-Code: <code>` e inclui `code` no JSON (`{ error: message, code }`) por padrão.
  - Em `src/lib/api-validation.ts`: manter `parseJsonBody(request, errorMessage?, options?)` e `mapPrismaError(error, messages?, options?)` retrocompatíveis com chamadas diretas de `api-validation.test.ts` (`includeCode?: boolean`, default `false` quando chamada legada recebe `errorMessage`/`messages` explícitos), e expor `parseJsonBodyLocalized(request, options?)` / `mapPrismaErrorLocalized(error, locale, messages?)` que sempre retornam `{ error, code }` + `X-Error-Code` e default localizado pelo `request`.
  - Nas rotas CRUD (`accounts`, `budgets`, `monthly-budgets`, `cards`, `categories`, `transfer`, `transactions`, `installments`, `installments/pay`, `consortiums`, `consortiums/installments`, `savings`, `savings/deposit`, `recurring`, `recurring/process`, `investments`, `investments/transactions`, `purchases`):
    - Todas passam a usar `resolveRequestLocale(request)` (default `'pt'`) e códigos de erro estáveis (`INVALID_JSON`, `VALIDATION_ERROR`, `NOT_FOUND`, `FOREIGN_KEY_ERROR`, `CONFLICT`, `INSUFFICIENT_BALANCE`, `ALREADY_PAID`, `GOAL_COMPLETED`, `INTERNAL_ERROR`, etc.).
    - **Guarda de retrocompatibilidade para `test:sqlite`:**
      - `GET /api/installments?id=...` (404) e `PUT`/`DELETE`/`POST` de `/api/purchases` checam `hasExplicitLocaleSignal(request)`. Quando `false` (requisições sem `?locale=`, sem `NEXT_LOCALE` e sem `Accept-Language`), preservam exatamente os payloads e mensagens literais exigidos por `installments/route.test.ts` (`{ error: "Plano de parcelamento não encontrado" }`) e `purchases/route-integrity.test.ts` (`{ error: "Purchase id is required" }`, `{ error: "Purchase not found" }`, `{ error: "Failed to update purchase" }`, `{ error: "Failed to delete purchase" }`, `{ success: true, message: "Purchase deleted" }`), enviando o `code` no header `X-Error-Code`; quando `true`, retornam `{ error, code }` localizado no corpo JSON.

## Risks / Trade-offs

- **[Risk]** Diferenças regionais de `Intl.DateTimeFormat` entre versões de ICU no Bun/Node podem alterar pontuação (ex.: `"nov. 26"` vs `"nov/26"` ou `"dom."` vs `"Dom"`). → **Mitigation:** normalizar abreviações em `formatServerWeekdayShort` (para `'pt'` preservar `['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']`) e testar saída de `formatServerMonthLabel` sem fragilidade de pontuação, oferecendo sempre chaves ISO (`monthKey`, `dateKey`) para lógica no cliente.
- **[Risk]** Alterar formato de erro JSON em `purchases/route.ts` ou `installments/route.ts` quebraria asserções `.toEqual({ error: ... })` das suítes `test:sqlite` (`bwrap`). → **Mitigation:** usar `hasExplicitLocaleSignal(request)` nesses dois pontos específicos e executar `bun --no-env-file run test:sqlite` como gate obrigatório da Task 1.4.
- **[Risk]** Conflito com Change 1/2 caso arquivos de UI ou `src/lib/purchase-date.ts` fossem editados. → **Mitigation:** `Write paths` estritamente limitados a `src/lib/server-i18n.ts`, `src/lib/api-validation.ts`, `src/messages/{pt,es,en}/api.json` e `src/app/api/**`, listando arquivos compartilhados em `Exclusions`.

## Migration Plan

1. **Task 1.1:** Criar `src/lib/server-i18n.ts` e `src/messages/{pt,es,en}/api.json` e evoluir `src/lib/api-validation.ts` com testes unitários (`server-i18n.test.ts` e `api-validation.test.ts`).
2. **Task 1.2:** Atualizar as rotas analíticas, séries, calendário, faturas, recibo, timeline e dívidas para consumir `server-i18n.ts`, mantendo default `'pt'` e chaves ISO aditivas.
3. **Task 1.3:** Atualizar as rotas narrativas (`insights`, `forecast`, `achievements`, `savings-challenge`) preservando `insights/route.test.ts` e `forecast/route.test.ts`.
4. **Task 1.4:** Atualizar `/api/export`, `/api/advisor` e todas as rotas CRUD com `code` + mensagens localizadas e guarda `test:sqlite`, validando com `bun --no-env-file run check` e `bun --no-env-file run test:sqlite`.

## Open Questions

Nenhuma decisão material pendente; todas as fronteiras de arquivo e compatibilidade com `test:sqlite` foram verificadas contra o código-fonte e os testes vigentes.
