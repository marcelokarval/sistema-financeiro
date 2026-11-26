## Purpose

Definir o contrato de internacionalização da camada de APIs, exportação CSV, assistente IA e validação HTTP do sistema financeiro para português (`pt`), espanhol (`es`) e inglês (`en`), preservando `'pt'` como padrão retrocompatível, `BRL` como moeda contábil fixa e compatibilidade integral com as suítes SQLite isoladas.

## ADDED Requirements

### Requirement: Resolução determinística de idioma no servidor
O módulo `src/lib/server-i18n.ts` MUST resolver o idioma entre `pt`, `es` e `en` na ordem `?locale=`, cookie `NEXT_LOCALE`, header `Accept-Language` e fallback `pt`, expondo detecção de sinal explícito de idioma e catálogos `src/messages/{pt,es,en}/api.json`.

#### Scenario: Precedência entre query, cookie, header e fallback
- **WHEN** uma requisição traz `?locale=en` junto de cookie `NEXT_LOCALE=es` e header `Accept-Language: pt-BR`
- **THEN** `resolveRequestLocale(request)` retorna `'en'`, seguindo estritamente query, depois cookie, depois `Accept-Language` e, na ausência ou idioma não suportado, `'pt'`

#### Scenario: Requisição sem sinal de idioma preserva padrão e sinaliza ausência
- **WHEN** uma requisição chega sem `?locale=`, sem cookie `NEXT_LOCALE` e sem header `Accept-Language`
- **THEN** `resolveRequestLocale(request)` retorna `'pt'` e `hasExplicitLocaleSignal(request)` retorna `false`

### Requirement: Séries temporais, calendário e faturas localizados com chaves ISO e BRL
As rotas analíticas, de calendário, de metas, de próximos vencimentos e de recibos MUST formatar meses, dias da semana, datas e valores em `BRL` pelo locale resolvido via `Intl`, adicionando chaves ISO (`monthKey`, `dateKey`, `dayIndex`) sem quebrar chamadas `GET()` sem argumentos.

#### Scenario: Séries e calendário em inglês mantêm chaves ISO neutras
- **WHEN** `GET /api/dashboard?locale=en`, `GET /api/networth?locale=en`, `GET /api/reports?locale=en`, `GET /api/balance-projection?locale=en`, `GET /api/transaction-analytics?locale=en` ou `GET /api/financial-calendar?locale=en` é consultado
- **THEN** rótulos humanos (`month`, `dayOfWeek`, `day`) são emitidos em inglês via `Intl` e cada item preserva chave ISO neutra (`monthKey`, `dateKey` ou `dayIndex`)

#### Scenario: Recibo e próximos vencimentos preservam BRL e datas civis
- **WHEN** `GET /api/receipt?type=purchase&id=...&locale=es` ou `GET /api/upcoming-bills?locale=en` é consultado para compra civil `2026-11-19T00:00:00.000Z`
- **THEN** o valor mantém moeda `BRL` sem conversão cambial, os rótulos vêm traduzidos do catálogo e a data civil não sofre recuo de fuso horário

### Requirement: Rotas narrativas localizadas mantendo contratos padrão em português
`GET /api/insights`, `GET /api/forecast`, `GET /api/achievements` e `GET /api/savings-challenge` MUST emitir títulos, descrições, ações, alertas de risco e rótulos de meses em `pt`, `es` ou `en` com moeda `BRL`, preservando enum técnicos e retornos padrão em `pt`.

#### Scenario: Insights, conquistas e desafio em espanhol e inglês com BRL
- **WHEN** `GET /api/insights?locale=es`, `GET /api/achievements?locale=en` ou `GET /api/savings-challenge?locale=en` é chamado
- **THEN** textos narrativos saem no idioma solicitado, quantias monetárias permanecem em `BRL`, e identificadores técnicos (`id`, `icon`, `category`, `trendDirection`) permanecem inalterados

#### Scenario: Chamada padrão sem locale mantém contrato de testes em português
- **WHEN** `GET /api/insights` ou `GET /api/forecast` é chamado sem parâmetros ou headers de idioma
- **THEN** as mensagens e métricas retornam em `'pt'`, preservando `"70% completa"`, `"533,33/mês"` e `"9.0 meses"` em `/api/insights`

### Requirement: Exportação CSV localizada com proteção contra formula injection
`GET /api/export` MUST aceitar `?locale=pt|es|en` (ou cookie/header, default `pt`) e localizar cabeçalhos, tipos, booleanos, números, datas e nome de arquivo no `Content-Disposition`, preservando BOM UTF-8, separador `;` e neutralização de fórmulas.

#### Scenario: Exportação CSV em inglês e espanhol preserva segurança e delimitador
- **WHEN** `GET /api/export?type=transactions&format=csv&locale=en` é executado com descrição iniciada por `=SUM(A1)`
- **THEN** o CSV inicia com `\uFEFF`, usa `;` como separador, apresenta cabeçalhos e tipos em inglês, formata números no locale `en-US` e neutraliza a fórmula como `'=SUM(A1)` sem duplo escape

#### Scenario: Exportação de compras preserva data civil no locale solicitado
- **WHEN** `GET /api/export?type=purchases&format=csv&locale=en` exporta uma compra com data civil `2026-11-25T00:00:00.000Z`
- **THEN** a coluna de data exibe `11/25/2026` no formato `en-US` sem deslocar para o dia anterior em fusos negativos

### Requirement: Assistente IA multilíngue com moeda BRL e defesa contra prompt injection
`POST /api/advisor` MUST construir o contexto financeiro e instruir o modelo a responder no idioma resolvido (`pt`, `es` ou `en`), mantendo obrigatoriamente moeda contábil `BRL`, omissão de últimos 4 dígitos de cartão, ausência de emojis de status e delimitação `<user_context>`.

#### Scenario: Prompt do assistente em inglês e espanhol mantém salvaguardas
- **WHEN** `POST /api/advisor?locale=en` recebe mensagem válida e `context` contendo `</user_context>` e `===`
- **THEN** o `systemPrompt` instrui resposta em inglês com moeda `BRL`, traduz cabeçalhos e tags de transação (`[Transfer]`), omite `lastFourDigits` e emojis, e encapsula o contexto sanitizado em `<user_context>` truncado em 1000 caracteres

#### Scenario: Chamada padrão de advisor preserva termos testados em português
- **WHEN** `POST /api/advisor` é chamado sem sinal de idioma
- **THEN** o `systemPrompt` mantém `(superávit)`, `(déficit)`, `[Transferência]` e `DADOS NÃO CONFIÁVEIS` em `'pt'`

### Requirement: Erros padronizados com code e retrocompatibilidade das suítes SQLite
`src/lib/api-validation.ts` e as rotas CRUD MUST localizar mensagens de validação, Prisma e domínio para `pt`, `es` e `en` (default `pt`) e incluir `code` estável e header `X-Error-Code`, preservando payloads literais legados exigidos pelas suítes `test:sqlite`.

#### Scenario: Rotas CRUD retornam erro localizado e código estável
- **WHEN** uma rota CRUD (ex.: `POST /api/accounts?locale=es` ou `POST /api/transfer?locale=en`) recebe entrada inválida ou registro inexistente
- **THEN** responde com status HTTP 400 ou 404, header `X-Error-Code` e JSON `{ error, code }` no idioma resolvido

#### Scenario: Suítes rígidas test:sqlite preservam contratos sem sinal de idioma
- **WHEN** `GET /api/installments?id=inexistente` ou `PUT`/`DELETE /api/purchases` é chamado sem `?locale=`, cookie `NEXT_LOCALE` ou header `Accept-Language`
- **THEN** a resposta preserva o corpo JSON exato esperado por `installments/route.test.ts` e `purchases/route-integrity.test.ts`, expondo `code` no header `X-Error-Code`
