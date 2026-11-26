# interface-quiet-financial-os Specification

## Purpose

Especificar a linguagem visual Quiet Financial OS aplicada à interface do FinanceApp em temas claro e escuro, desktop e celular, preservando os nove destinos, os contratos de dados, as ações existentes e a paridade verificada por família.

## Requirements

### Requirement: Linguagem visual Quiet Financial OS
A interface MUST reproduzir a hierarquia do conceito de referência, com superfícies neutras, uma ação primária reconhecível, números de leitura rápida e cores semânticas, em temas claro e escuro. A cor MUST NOT ser o único meio de comunicar estado.

#### Scenario: Leitura no desktop e no celular
- **WHEN** o resumo é aberto em desktop ou celular, em claro ou escuro
- **THEN** a posição financeira precede módulos secundários, a navegação corresponde ao tamanho da tela e não há rolagem horizontal da página.

### Requirement: Resumo ligado aos dados atuais
O resumo MUST usar os contratos existentes e rótulos compatíveis, sem números, nomes, curvas ou compromissos ilustrativos nem atribuição de patrimônio, caixa projetado ou plano da referência sem contrato equivalente. Ao alternar o período de consulta, respostas e falhas de requisições anteriores MUST ser descartadas para não sobrescreverem o período atual.

#### Scenario: Consulta com dados disponíveis
- **WHEN** o usuário seleciona um período válido
- **THEN** os indicadores e séries sensíveis ao período refletem os dados correspondentes, e saldos de posição atual são identificados como tal.

#### Scenario: Consulta sem dados ou com erro
- **WHEN** a consulta está pendente, retorna sem dados ou falha
- **THEN** a interface distingue esses estados entre si e de um valor financeiro real igual a zero; após falha, disponibiliza uma nova tentativa. Ao trocar o período, uma falha ou resposta atrasada não pode exibir dados do intervalo anterior como dados do novo.

#### Scenario: Descarte de resposta ou erro de período anterior na projeção de saldos
- **WHEN** `balance-projection` inicia consulta para um horizonte `A` (`selectedMonths = 6`), o usuário alterna para o horizonte `B` (`selectedMonths = 3`), `B` resolve primeiro e a requisição `A` resolve depois com `200 OK`, `503` ou rejeição de transporte
- **THEN** a interface MUST descartar a resposta ou erro de `A` por sinal abortado/identidade de requisição vencida, mantendo exibidos os dados, estado não carregando e seleção de `B` sem sobrescrever `data` ou `loading`.

### Requirement: Paridade de navegação e ações
O redesign MUST preservar os nove destinos, widgets e ações existentes, sem alterar fórmulas, regras de pagamento ou efeitos econômicos, limitando correções de API aos dois cenários de formulário abaixo (D5). Em orçamento mensal, falhas HTTP não OK MUST manter diálogo e rascunho abertos sem releitura automática; após exclusões com releitura tardia em Contas, Cartões, Consórcios e Caixinhas, o foco MUST ficar em controle sobrevivente conectado ao DOM.

#### Scenario: Ação de lançamento
- **WHEN** o usuário ativa a ação de novo lançamento na navegação
- **THEN** o aplicativo solicita escolha explícita de uma conta e abre o formulário existente; sem contas, orienta a cadastrar uma. Não escolhe uma conta silenciosamente, não grava ao abrir e não altera a validação de gravação.

#### Scenario: Assistente sob demanda
- **WHEN** a aplicação abre e a pessoa ainda não acionou o assistente
- **THEN** o assistente não ocupa a primeira tela e permanece disponível por um controle nomeado; acioná-lo abre a interface existente sem enviar uma consulta por conta própria.

#### Scenario: Uso por teclado
- **WHEN** o usuário alterna entre navegação, busca e diálogos via teclado
- **THEN** os controles têm nomes acessíveis, foco visível e retorno de foco apropriado ao encerrar o diálogo.

#### Scenario: Seleção de resultado na busca global
- **WHEN** o usuário ativa um resultado na busca global (`GlobalSearch`) por clique ou `Enter`, ou fecha a busca por `Escape`
- **THEN** conforme a **Alternativa A** confirmada pelo responsável de produto, o aplicativo navega ao destino correspondente e abre o detalhe ou expande o registro quando o ID existir (`Contas`, `Transações` com `accountId` válido, `Cartões`, `Compras`, `Investimentos`, `Parcelas` e `Consórcios`), mantendo `Categorias` apenas como navegação ao destino; se o ID (ou `accountId`) não existir na coleção carregada, limpa a seleção na store sem abrir nem expandir outro registro; e ao fechar por `Escape`, devolve o foco ao controle de origem conectado e distinto de `document.body`, ou ao botão `Abrir busca global` como fallback.

#### Scenario: Editar Caixinha com opcionais vazios
- **WHEN** a edição envia descrição, contribuição ou rendimento explicitamente vazios
- **THEN** esses campos usam os mesmos padrões do cadastro; omissão preserva o valor gravado, sem alterar o saldo acumulado ou a conta vinculada por essa normalização.

#### Scenario: Gravar dados da assembleia
- **WHEN** o formulário informa a próxima assembleia no cadastro ou a contagem na edição de um Consórcio
- **THEN** a releitura do Consórcio confirma os campos informados, a data é apresentada como dia civil e pagamentos e parcelas não mudam pelas correções destes campos.

#### Scenario: Retenção de editor e rascunho em erro HTTP do orçamento mensal
- **WHEN** `MonthlyBudgetTracker` envia `POST` ou `PUT` para `/api/monthly-budgets` e recebe resposta HTTP não OK (com JSON de erro ou corpo não JSON) ou falha de transporte
- **THEN** o sistema MUST anunciar erro via `toast.error`, manter `MonthlyBudgetEditor` aberto (`open === true`) com todos os campos do rascunho intactos e MUST NOT disparar `refreshBudgets()` (`GET /api/monthly-budgets`) prematuro.

#### Scenario: Foco sobrevivente após exclusão com releitura tardia em Contas, Cartões, Consórcios e Caixinhas
- **WHEN** o usuário confirma `DELETE` na lista de Contas (`account/Excluir/late`), Cartões (`card/Excluir/late`), Consórcios (`list/Excluir/late`) ou Caixinhas (`caixinhas/exclusao/late`) e o `GET` de atualização resolve após o fechamento do diálogo removendo o registro excluído do DOM
- **THEN** o foco MUST estar em um controle sobrevivente conectado (por exemplo `Nova conta`, `Novo cartão`, `#consortium-create` ou `#savings-create`, ou outro controle sobrevivente já focado pelo usuário), MUST NOT cair em `document.body`, e nenhum desses cenários pode permanecer classificado em `preexistingQuietDivergences`.

### Requirement: Migração verificada por família
Cada fatia MUST verificar seu recorte em temas claro e escuro e em desktop e celular, usando dados sintéticos. O contrato visual vigente MUST distinguir capacidades migradas, validadas e ainda legadas, e a cobertura de componentização frontend MUST registrar com exatidão as divergências sanadas e as eventualmente pendentes após verificação integrada.

#### Scenario: Revisão de uma fatia antes de retirar sua apresentação anterior
- **WHEN** uma fatia propõe substituir as superfícies de uma família
- **THEN** a revisão confronta a hierarquia com a referência visual e verifica, por ação, o acesso e o efeito pertinente, incluindo ocultação de valores e gestão de metas orçamentárias onde aplicável. Uma resposta simulada ou toast não prova persistência; evidência de uma família não prova o tema inteiro.

#### Scenario: Reconciliação das divergências residuais e verificação nas seis células
- **WHEN** as correções em projeção de saldos, orçamento mensal e foco pós-exclusão de Contas, Cartões, Consórcios e Caixinhas forem implementadas
- **THEN** a Seção 5 de `docs/reference/frontend-componentization-coverage.md` MUST ser reconciliada refletindo conformidade Quiet nesses itens, e `check-frontend-architecture.ts`, `typecheck`, `lint`, `bun --no-env-file test` e os runners `.qa.mjs` afetados MUST passar nas 6 células (`360/390/1440 × light/dark`) com zero `preexistingQuietDivergences` para essas superfícies.

### Requirement: Concorrência segura e descarte de estado obsoleto em widgets de análise e linha do tempo
Os widgets `NetworthEvolution`, `FinancialCalendar`, `TransactionAnalytics` e `SpendingTimeline` MUST associar cada consulta a um `AbortController` e a uma identidade única de requisição, descartando respostas ou falhas de requisições anteriores já abortadas ou substituídas, e MUST limpar dados antigos e exibir estado explícito de erro com opção de nova tentativa quando a requisição vigente falhar (`!res.ok` ou rejeição de transporte).

#### Scenario: Descarte de resposta ou erro atrasado em troca de período ou filtro nos widgets
- **WHEN** `NetworthEvolution`, `FinancialCalendar`, `TransactionAnalytics` ou `SpendingTimeline` inicia uma consulta `A`, o usuário altera o período ou filtro para `B` (ou aciona atualização/retry), `B` resolve primeiro e a requisição `A` resolve depois com `200 OK`, resposta HTTP não OK ou rejeição de transporte
- **THEN** o widget MUST abortar e descartar o resultado ou erro de `A`, mantendo exibidos apenas os dados e estado da requisição vigente `B` sem sobrescrever estado nem encerrar carregamento indevidamente.

#### Scenario: Limpeza de dados antigos e sinalização de erro em falha subsequente nos widgets
- **WHEN** um dos widgets (`NetworthEvolution`, `FinancialCalendar`, `TransactionAnalytics`, `SpendingTimeline`, `DebtOverview` ou `FinancialReportsWidget`) possui dados carregados anteriormente e uma nova consulta ou tentativa falha (`!res.ok` ou falha de rede)
- **THEN** o widget MUST limpar os dados anteriores exibidos e apresentar estado explícito de erro (`role="alert"`) com ação `Tentar novamente`, recuperando normalmente quando uma nova tentativa retornar `200 OK`.

### Requirement: Indexação completa da Alternativa A, cancelamento e neutralidade de transferências na Busca Global
`GlobalSearch` e `GlobalSearchResult` MUST indexar os oito domínios navegáveis previstos na Alternativa A (`transactions`, `purchases`, `accounts`, `cards`, `categories`, `investments`, `installments` e `consortiums`), cancelar consultas obsoletas via `AbortController` em `fetchAll()` e apresentar transações do tipo `TRANSFER` com sinal e estilo visuais neutros, sem ícone ou cor semântica de despesa.

#### Scenario: Indexação e mapeamento dos oito domínios na Busca Global
- **WHEN** `GlobalSearch` abre e consulta os endpoints `/api/transactions`, `/api/purchases`, `/api/accounts`, `/api/cards`, `/api/categories`, `/api/investments`, `/api/installments` e `/api/consortiums`
- **THEN** `searchGroupMeta`, `searchDestination` e os resultados agrupados MUST cobrir todos os oito domínios, permitindo filtrar investimentos, planos de parcelamento e consórcios e encaminhá-los aos respectivos destinos e seletores em `src/app/page.tsx`.

#### Scenario: Cancelamento de consultas anteriores na Busca Global
- **WHEN** `GlobalSearch` fecha ou dispara uma nova execução de `fetchAll()` enquanto uma coleta anterior ainda está pendente
- **THEN** o `AbortController` da coleta anterior MUST ser abortado e suas respostas ou falhas tardias MUST NOT sobrescrever `rawData`, `error` ou `loading` da busca vigente.

#### Scenario: Exibição neutra para transações do tipo TRANSFER
- **WHEN** `GlobalSearch` exibe uma transação com `type === 'TRANSFER'`
- **THEN** o item MUST ser renderizado com ícone e tom neutros (`ArrowLeftRight` e `text-muted-foreground`), sem prefixo negativo `'-'` nem classe semântica de despesa (`text-(--ds-accent-danger)`).

### Requirement: Resiliência HTTP em exclusão de orçamento, transferência entre contas e falha de dividendos
Os fluxos de exclusão em `MonthlyBudgetTracker`, transferência em `AccountsView` e consulta de dividendos em `InvestmentsView` MUST tratar respostas HTTP não OK (incluindo corpo não-JSON) e falhas de rede sem mascarar o tipo de erro nem exibir valores financeiros zerados como se fossem dados reais.

#### Scenario: Resposta não-JSON em handleDelete de orçamento mensal e saveTransfer de contas
- **WHEN** `MonthlyBudgetTracker` executa `DELETE /api/monthly-budgets` ou `AccountsView` executa `POST /api/transfer` e recebe resposta HTTP não OK cujo corpo não é JSON válido
- **THEN** o parse de erro MUST usar fallback seguro sem lançar exceção de sintaxe, anunciando a mensagem de falha da operação (`Erro ao excluir` ou `Erro na transferência`) via `toast.error` e preservando o diálogo aberto sem releitura prematura.

#### Scenario: Falha na consulta de dividendos em Investimentos
- **WHEN** `InvestmentsView` conclui `/api/investments` com sucesso, mas `fetchDividends` (`/api/investments/transactions`) retorna HTTP não OK ou rejeita por falha de rede
- **THEN** `InvestmentsView` MUST sinalizar erro explícito de carregamento de dividendos (`role="alert"`) com opção `Tentar novamente` e MUST NOT exibir `R$ 0,00` como se representasse dividendos reais recebidos.

### Requirement: Seletor de idioma Quiet Financial OS com bandeiras SVG decorativas
O sistema MUST disponibilizar o componente `LanguageSwitcher` no `AppHeader` (modo compacto) e no menu `Mais` da `MobileNav` (modo completo), exibindo `LocaleFlagIcon` puramente decorativo, autônimos (`Português`, `Español`, `English`), siglas (`PT`, `ES`, `EN`) e indicador visual ativo, em conformidade com o gate AST.

#### Scenario: Seleção e persistência de idioma pelo usuário
- **WHEN** o usuário abre o `LanguageSwitcher` no cabeçalho ou no painel móvel e seleciona `Español` ou `English`
- **THEN** o cookie `NEXT_LOCALE` é atualizado para `'es'` ou `'en'`, o item ativo exibe o ícone `Check` e o shell passa a exibir os textos no novo idioma após atualização.

#### Scenario: Acessibilidade, bandeiras decorativas e conformidade visual
- **WHEN** o `LanguageSwitcher` é inspecionado por leitor de tela, teclado e gate `arch:check` em tema claro ou escuro
- **THEN** o gatilho possui nome acessível, as opções são navegáveis por teclado com `Enter`/`Space`/setas/`Escape`, cada `<img />` de `/locale-flags/{pt,es,en}.svg` usa `alt=""` e `aria-hidden="true"`, e o código usa `cn()` sem `framer-motion` nem `raw-conditional-class-name`.
