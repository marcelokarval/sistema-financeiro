# internacionalizacao-frontend Specification

## Purpose

Especificar a internacionalização completa dos 7 primitivos financeiros compartilhados e dos 63 módulos de visões, widgets, editores, diálogos, recibos, notificações e assistente em português (`pt`), espanhol (`es`) e inglês (`en`), preservando moeda `BRL`, datas localizadas, contratos Quiet e conformidade com o gate AST.

## Requirements

### Requirement: Catálogos modulares por domínio em três idiomas
Os 16 namespaces de domínio (`shared`, `dashboard`, `goals`, `analytics`, `accounts`, `cards`, `purchases`, `categories`, `receipts`, `investments`, `installments`, `consortiums`, `savings`, `recurring`, `notifications`, `advisor`) SHALL existir em `src/messages/{pt,es,en}/` com paridade de chaves e registro estático em `src/i18n/{messages,types,request}.ts`.

#### Scenario: Carregamento, tipagem e paridade dos 16 namespaces por idioma
- **WHEN** `src/i18n/messages.ts`, `src/i18n/types.ts` e `src/i18n/request.ts` carregam e tipam mensagens para `pt`, `es` ou `en`
- **THEN** todos os 16 namespaces de domínio são carregados e tipados em `AppConfig.Messages` sem chaves ausentes nem divergência estrutural entre os três idiomas

### Requirement: Internacionalização dos primitivos compartilhados e do painel de resumo
Os 7 componentes em `src/components/shared/` e os módulos do Resumo, Notificações e Assistente (`dashboard-query.ts`, `dashboard-view.tsx`, `quick-stats-overview.tsx`, `upcoming-bills.tsx`, `notification-panel.tsx`, `ai-advisor.tsx`, `advisor-composer.tsx`) MUST renderizar todos os textos e rótulos acessíveis pelo idioma ativo.

#### Scenario: Alternância de idioma em primitivos e Resumo
- **WHEN** o idioma ativo alterna entre `pt`, `es` e `en` no Resumo, Notificações ou Assistente
- **THEN** títulos, filtros, estados de carregamento/erro/vazio, sugestões e nomes acessíveis são exibidos no idioma selecionado sem chaves cruas

### Requirement: Internacionalização dos widgets de metas, saúde e análises
Todos os 24 módulos de metas, saúde financeira, desafios, insights, orçamento mensal, projeção de saldos, fluxo de caixa, dívidas, despesas, calendário, relatórios, patrimônio e linha do tempo MUST utilizar traduções dos namespaces `goals` e `analytics` e datas localizadas para `pt`, `es` e `en`.

#### Scenario: Calendário, relatórios e projeções no idioma selecionado
- **WHEN** os widgets de metas ou análises são montados em `pt`, `es` ou `en`
- **THEN** cabeçalhos de semana, nomes de meses, legendas de gráficos, tooltips e datas relativas usam o locale ativo preservando dias civis e aborto de requisições antigas

### Requirement: Internacionalização das visões operacionais e recibos
Todas as visões, editores, campos e confirmações de Contas, Cartões, Compras, Categorias, Recibos, Investimentos, Parcelas, Consórcios, Caixinhas e Recorrências MUST consumir os respectivos namespaces em `pt`, `es` e `en` mantendo bloqueio concorrente, foco sobrevivente e retenção de rascunho em erro.

#### Scenario: Operações CRUD e diálogos em idioma não padrão
- **WHEN** o usuário abre editores, realiza exclusões ou dispara erros HTTP em Contas, Cartões, Consórcios, Caixinhas ou Recorrências em `es` ou `en`
- **THEN** rótulos, validações, botões e toasts aparecem no idioma ativo mantendo intactos os payloads de API, rascunhos e retorno de foco

### Requirement: Preservação de moeda BRL, datas localizadas e recibo imprimível
A interface internacionalizada MUST manter todos os valores monetários em `BRL` sem conversão cambial, adaptar formatadores `Intl` e `date-fns` ao locale ativo, preservar ocultação na máscara de privacidade e gerar HTML de recibo com atributo `lang` e textos no idioma ativo.

#### Scenario: Recibo imprimível e máscara de privacidade em múltiplos idiomas
- **WHEN** um recibo é pré-visualizado ou impresso e valores são ocultados com `showValues={false}` em `pt`, `es` ou `en`
- **THEN** os montantes mantêm moeda `BRL` formatada no locale ativo, o HTML impresso reflete o `lang` correspondente e nenhum dígito real vaza em texto ou `aria-label`

### Requirement: Conformidade com o gate AST e limite de linhas
A internacionalização MUST preservar intactas as 6 entradas aprovadas em `.zscripts/frontend-architecture-baseline.json`, utilizar `cn()` em novas composições condicionais e extrair mapas estáticos de enums para catálogos auxiliares evitando ultrapassar 500 linhas nos arquivos atualmente dentro do limite.

#### Scenario: Execução do gate AST após internacionalização
- **WHEN** `bun --no-env-file run arch:check` avalia os arquivos em `src/components/shared/` e `src/components/finance/`
- **THEN** o gate retorna código 0 com `0` erros, mantendo exatamente as 6 identidades do baseline sem novos avisos `large-tsx-file`

### Requirement: Cobertura de testes unitários e validação Playwright multi-idioma
As 14 suítes unitárias de `src/components/finance/`, os 14 runners `.qa.mjs` e o novo runner `src/components/finance/quiet-i18n.qa.mjs` MUST validar componentes internacionalizados em `pt`, `es` e `en` nas seis células (`360/390/1440 × light/dark`) com zero overflow horizontal.

#### Scenario: Verificação completa unitária, build e Playwright multi-idioma
- **WHEN** são executados `bun --no-env-file run check`, `bun --no-env-file run build`, os 14 runners `.qa.mjs` e `quiet-i18n.qa.mjs`
- **THEN** todos concluem com sucesso validando traduções, moeda `BRL`, acessibilidade e ausência de rolagem horizontal em `pt`, `es` e `en`

### Requirement: Pluralização explícita para zero em português nos catálogos UI
Todas as chaves com cláusula ICU `, plural,` nos catálogos `src/messages/pt/*.json` MUST declarar o ramo `=0 {...}` com concordância plural adequada mantendo os mesmos placeholders `{...}` de `es` e `en`.

#### Scenario: Contagens iguais a zero em português usam forma plural
- **WHEN** componentes de compras, categorias, parcelas, investimentos, notificações, busca ou análises renderizam `count = 0` no locale `pt`
- **THEN** a mensagem usa o ramo `=0` no plural (como `"0 compras encontradas"`, `"0 transações"`, `"0 planos no total"`) preservando paridade de chaves e placeholders com `es` e `en`

### Requirement: Formatação decimal localizada de taxas e percentuais
Todas as exibições de taxas de juros, rendimento, variação e participação percentual decimal em `src/components/finance/` MUST utilizar `Intl.NumberFormat` no `locale` ativo via helpers de `src/lib/helpers.ts`, respeitando vírgula em `pt`/`es` e ponto em `en`.

#### Scenario: Taxas e percentuais decimais alternam separador conforme o locale
- **WHEN** planos com taxa de juros (`1.5`), caixinhas com rendimento (`12.5`), projeções, relatórios ou estatísticas exibem percentuais decimais em `pt`, `es` e `en`
- **THEN** os números renderizam com vírgula em `pt` e `es` (`1,5%`, `12,5% a.a.`) e com ponto em `en` (`1.5%`, `12.5% p.a.`), preservando as 6 identidades do baseline AST
