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
