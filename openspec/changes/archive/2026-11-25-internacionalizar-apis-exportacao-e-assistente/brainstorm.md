# Brainstorming — Internacionalização de APIs, Exportação CSV e Assistente IA

## Leituras Obrigatórias e Mapeamento de Skills

- Leituras canônicas realizadas antes da escrita:
  - `/home/marcelo-karval/.agents/AGENTS.md`
  - `/home/marcelo-karval/.local/share/openspec/schemas/superpowers-bridge/README.md`
  - `/home/marcelo-karval/.agents/skills/openspec-propose/SKILL.md`
  - `/home/marcelo-karval/.agents/skills/brainstorming/SKILL.md`
  - `/home/marcelo-karval/.agents/skills/writing-plans/SKILL.md`
- Mapeamento e invocação observada das skills:
  - `brainstorming` (`/home/marcelo-karval/.agents/skills/brainstorming/SKILL.md`): aplicada na inspeção read-only das rotas de API e testes existentes, avaliação de abordagens e convergência das decisões Q1–Q6.
  - `openspec-propose` (`/home/marcelo-karval/.agents/skills/openspec-propose/SKILL.md`): aplicada na criação coordenada dos artefatos de planejamento dentro do escopo exclusivo desta change, sem editar código de produção.
  - `writing-plans` (`/home/marcelo-karval/.agents/skills/writing-plans/SKILL.md`): aplicada na decomposição em tarefas com microcontratos `Bridge task contract: 1`, `Global Constraints`, `Review Focus` e passos TDD `RED -> GREEN`.

## Achados da Inspeção do Repositório

1. **Base Git e fronteira entre changes:**
   - Base Git explícita: `a99eef2716d84a9d09c91a81b19665c15d9c037b`.
   - Change 1 (`estruturar-fundacao-i18n-shell-e-formatacao`) é dona de `src/i18n/*` no cliente/SSR e shell; Change 2 (`internacionalizar-visoes-e-widgets-financeiros`) traduz `src/components/{finance,shared}/*`.
   - Change 3 (`internacionalizar-apis-exportacao-e-assistente`) é dona exclusiva de `src/lib/server-i18n.ts`, `src/lib/api-validation.ts`, `src/messages/{pt,es,en}/api.json` e das rotas API dependentes de idioma em `src/app/api/**`, sem criar colisão de escrita com `src/i18n/*`, `src/components/*` ou `src/lib/purchase-date.ts`.

2. **Inventário real das rotas em `src/app/api/**`:**
   - **Formatação de datas/meses/dias dependente de `pt-BR` ou `date-fns/locale/ptBR`:**
     - `dashboard/route.ts`: `trendMonth.toLocaleString("pt-BR", { month: "short", year: "2-digit" })` e erros de datas em pt-BR (com fallback `"Failed to fetch dashboard data"` em inglês).
     - `quick-stats/route.ts`: `GET()` sem parâmetro, `mStart.toLocaleString("pt-BR", { month: "short" })` e erro 500 em pt-BR.
     - `networth/route.ts`: `monthDate.toLocaleString('pt-BR', { month: 'short', year: '2-digit' })` e erro 500 em pt-BR.
     - `reports/route.ts`: `monthStart.toLocaleString('pt-BR', { month: 'short', year: '2-digit' })` e erro 500 em pt-BR.
     - `balance-projection/route.ts`: `d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })` e erro 500 em pt-BR.
     - `expense-breakdown/route.ts`: já emite `monthKey`, mas usa `monthStart.toLocaleString('pt-BR', ...)`, `'Sem Categoria'` e erro 500 em pt-BR.
     - `transaction-analytics/route.ts`: array fixo `['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']`, `mStart.toLocaleString('pt-BR', ...)`, `'Sem Categoria'` e erro 500 em pt-BR.
     - `financial-calendar/route.ts`: array fixo `["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]` e erro 500 em pt-BR.
     - `goals-dashboard/route.ts`: `GET()` sem parâmetro, importa `ptBR` de `date-fns/locale` para `estimatedCompletion` (`format(addMonths(...), 'MMM yyyy', { locale: ptBR })`) e erro 500 em pt-BR.
     - `upcoming-bills/route.ts`: `GET()` sem parâmetro, strings `'Parcelamento'`, `'Consórcio'`, ``Fatura ${card.name}``, `'Recorrente'` e erro 500 em pt-BR.
     - `receipt/route.ts`: `Intl.NumberFormat("pt-BR", { currency: "BRL" })`, `Intl.DateTimeFormat("pt-BR", ...)`, `translateType` (`Receita`/`Despesa`/`Transferência`), `formatPurchaseDate(purchase.date, "receipt")`, `"Sem categoria"`, `"N/A"` e erros em pt-BR.
     - `timeline/route.ts`: `'Sem categoria'` e erro 500 em pt-BR.
     - `debts/route.ts`: `GET()` sem parâmetro, erro 500 em pt-BR.
   - **Rotas narrativas:**
     - `insights/route.ts`: `GET()` sem parâmetro, 10 insights com títulos/descrições/ações/métricas em pt-BR e `BRL` (`currencyFmt`).
     - `forecast/route.ts`: `targetDate.toLocaleString("pt-BR", { month: "long", year: "numeric" })`, `"Outros"`, 5 mensagens de `riskAlerts` e erros 400/500 em pt-BR.
     - `achievements/route.ts`: `GET()` sem parâmetro, 12 conquistas com `title`/`description` em pt-BR e erro 500 em pt-BR.
     - `savings-challenge/route.ts`: `GET()` sem parâmetro, 3 desafios com `title`/`description` em pt-BR e `BRL` e erro 500 em pt-BR.
   - **Exportação CSV e Assistente IA:**
     - `export/route.ts`: cabeçalhos, tipos de transação/conta, `Sim`/`Não`, `À vista`, `toLocaleString("pt-BR")`, `dd/mm/yyyy` / `formatPurchaseDate`, nomes de arquivo (`transacoes.csv`, `compras.csv`, `contas.csv`) e erros em pt-BR, com BOM `\uFEFF`, separador `;` e neutralização de formula injection.
     - `advisor/route.ts`: contexto financeiro e `systemPrompt` inteiramente em pt-BR (`superávit`, `déficit`, `[Transferência]`, `DADOS NÃO CONFIÁVEIS`, `<user_context>`, moeda `R$ / BRL`), omitindo `lastFourDigits` e emojis de status.
   - **Helpers de validação e rotas CRUD:**
     - `src/lib/api-validation.ts`: `parseJsonBody` tem default `'Corpo da requisição JSON inválido.'`; `mapPrismaError` tem defaults `'Referência inválida.'` e `'Registro não encontrado.'`.
     - Rotas CRUD com mistura de mensagens em inglês (`accounts`, `cards`, `categories`, `transfer`, `transactions`, `purchases`) e em português (`budgets`, `monthly-budgets`, `installments`, `installments/pay`, `consortiums`, `consortiums/installments`, `savings`, `savings/deposit`, `recurring`, `recurring/process`, `investments`, `investments/transactions`), sem campo `code` padronizado.
     - `src/app/api/route.ts`: apenas healthcheck `Hello, world!`, fora da necessidade de tradução.

3. **Contratos rígidos de testes existentes (restrição crítica):**
   - `src/lib/api-validation.test.ts`: asserta `.toEqual({ error: 'Payload inválido.' })`, `.toEqual({ error: 'FK inválida.' })` e `.toEqual({ error: 'Não encontrado.' })` quando `parseJsonBody`/`mapPrismaError` são chamados diretamente com mensagens explícitas.
   - `src/app/api/installments/route.test.ts` (suíte `test:sqlite` via `bwrap`): asserta `expect(await response.json()).toEqual({ error: "Plano de parcelamento não encontrado" })` em `GET /api/installments?id=...` (sem params/cookies/headers de locale).
   - `src/app/api/purchases/route-integrity.test.ts` (suíte `test:sqlite` via `bwrap`): asserta `.toEqual({ error: "Purchase id is required" })`, `.toEqual({ error: "Purchase not found" })`, `.toEqual({ error: "Failed to update purchase" })`, `.toEqual({ error: "Failed to delete purchase" })` e `.toEqual({ success: true, message: "Purchase deleted" })` em chamadas `PUT`/`DELETE` sem locale explícito.
   - `src/app/api/consortiums/assembly.test.ts` e `src/app/api/savings/route.test.ts` (suítes `test:sqlite` via `bwrap`): validam status HTTP, persistência SQLite e `depositDescription: "Depósito"` por default em `savings/deposit`.
   - `src/app/api/insights/route.test.ts`: asserta `title` contendo `"70% completa"`, `metric` contendo `"533,33"`, `description` contendo `"533,33/mês"` e `emergency.metric` igual a `"9.0 meses"` no default `'pt'`.
   - `src/app/api/advisor/route.test.ts`: asserta `"(superávit)"`, `"(déficit)"`, `"[Transferência] Envio para poupança"`, `"DADOS NÃO CONFIÁVEIS"`, `"<user_context>"` e ausência de `lastFourDigits` e emojis no default `'pt'`.
   - `src/app/api/export/route.test.ts`: asserta `\uFEFF`, neutralização sem duplo escape (`';'=SUM(A1);` etc.) e filtro civil local.

## Cadeia de Decisões (Q1–Q6)

- **Q1 — Precedência de resolução de idioma no servidor (`resolveRequestLocale`):**
  - Ordem canônica em `src/lib/server-i18n.ts`: query `?locale=` → cookie `NEXT_LOCALE` → header `Accept-Language` (parseado por preferência/peso `q=`) → fallback `'pt'`.
  - Normalização por subtag base (`pt`, `pt-BR` -> `'pt'`; `es`, `es-ES`, `es-419` -> `'es'`; `en`, `en-US`, `en-GB` -> `'en'`).
  - Função complementar `hasExplicitLocaleSignal(request)` detecta se o chamador enviou `?locale=`, cookie `NEXT_LOCALE` ou header `Accept-Language` suportado.

- **Q2 — Moeda contábil e formatação temporal:**
  - Todas as quantias armazenadas em SQLite continuam em **BRL** sem conversão cambial (`currency: 'BRL'`), formatadas com o locale BCP-47 mapeado (`pt-BR`, `es-ES`, `en-US`) em `formatServerCurrencyBRL`.
  - Meses e dias da semana são formatados via `Intl.DateTimeFormat(INTL_LOCALE_MAP[locale], ...)` e complementados com chaves ISO aditivas (`monthKey: "YYYY-MM"`, `dateKey: "YYYY-MM-DD"`, `estimatedCompletionKey`, `monthKeys`, `dayIndex`) para que gráficos e filtros no cliente nunca dependam de texto traduzido.
  - Para datas civis de compras em `/api/receipt` e `/api/export`, `formatServerPurchaseDate` em `src/lib/server-i18n.ts` reutiliza `civilPurchaseDate` de `@/lib/purchase-date` (preservando zero day-shift) sem modificar `src/lib/purchase-date.ts`.

- **Q3 — Assinaturas retrocompatíveis de handlers `GET()`:**
  - Rotas que antes declaravam `export async function GET()` sem parâmetros (`quick-stats`, `goals-dashboard`, `upcoming-bills`, `insights`, `achievements`, `savings-challenge`, `debts`) passam a aceitar `request?: NextRequest` opcional, mantendo `GET()` sem argumentos válido para testes existentes (default `'pt'`).

- **Q4 — Exportação CSV em `/api/export`:**
  - `GET /api/export` aceita `?locale=pt|es|en` (e fallback cookie/header -> `'pt'`), traduz cabeçalhos, enums (`INCOME`/`EXPENSE`/`TRANSFER`, `CASH`/`BANK`/`DIGITAL_WALLET`, ativo/inativo, à vista), datas e números decimais por locale, além do nome do arquivo no `Content-Disposition`, preservando BOM `\uFEFF`, separador `;` e neutralização anti-formula-injection.

- **Q5 — Prompt e contexto do `/api/advisor`:**
  - `POST /api/advisor` localiza o contexto financeiro e a instrução de idioma de resposta do LLM para `pt`, `es` ou `en` conforme `resolveRequestLocale(request)`, mantendo obrigatoriamente a regra de moeda `BRL`, a delimitação `<user_context>` de dados não confiáveis (com aviso localizado de dados não confiáveis), a omissão de `lastFourDigits` e ausência de emojis de status.

- **Q6 — Padronização de erros com `code` e retrocompatibilidade das suítes SQLite:**
  - `apiErrorResponse(code, message, status, options?)` define o header `X-Error-Code: <code>` e retorna `{ error, code }` em JSON por padrão nas rotas CRUD e analíticas.
  - Para preservar 100% intactos os 4 arquivos de `test:sqlite` e `src/lib/api-validation.test.ts` sem alterar contratos rígidos de asserção `.toEqual({ error: ... })`:
    1. `parseJsonBody` e `mapPrismaError` em `src/lib/api-validation.ts` preservam assinatura retrocompatível (emitindo `{ error }` sem `code` no corpo quando `includeCode` não é pedido, mas incluindo `X-Error-Code` e aceitando `locale`/`includeCode` via opções ou helpers dedicados `parseJsonBodyLocalized` / `mapPrismaErrorLocalized`).
    2. `GET /api/installments?id=...` (404) e `PUT`/`DELETE`/`POST` de `/api/purchases` verificam `hasExplicitLocaleSignal(request)`: quando `false` (chamadas nuas de `installments/route.test.ts` e `purchases/route-integrity.test.ts`), preservam exatamente os payloads e mensagens legadas esperadas (com `code` no header `X-Error-Code`); quando `true` (`?locale=`, `NEXT_LOCALE` ou `Accept-Language`), retornam `{ error, code }` localizado no corpo JSON.
