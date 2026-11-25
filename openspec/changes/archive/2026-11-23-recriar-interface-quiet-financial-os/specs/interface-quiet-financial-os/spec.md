## ADDED Requirements

### Requirement: Linguagem visual Quiet Financial OS
A interface MUST reproduzir a hierarquia do conceito de referência, com superfícies neutras, uma ação primária reconhecível, números de leitura rápida e cores semânticas, em temas claro e escuro. A cor MUST NOT ser o único meio de comunicar estado.

#### Scenario: Leitura no desktop e no celular
- **WHEN** o resumo é aberto em desktop ou celular, em claro ou escuro
- **THEN** a posição financeira precede módulos secundários, a navegação corresponde ao tamanho da tela e não há rolagem horizontal da página.

### Requirement: Resumo ligado aos dados atuais
O resumo MUST usar os contratos existentes e rótulos compatíveis com seus dados. O produto MUST NOT exibir números, nomes, curvas ou compromissos ilustrativos como se fossem reais, nem atribuir às métricas atuais a semântica de patrimônio, caixa projetado ou plano da referência sem contrato equivalente.

#### Scenario: Consulta com dados disponíveis
- **WHEN** o usuário seleciona um período válido
- **THEN** os indicadores e séries sensíveis ao período refletem os dados correspondentes, e saldos de posição atual são identificados como tal.

#### Scenario: Consulta sem dados ou com erro
- **WHEN** a consulta está pendente, retorna sem dados ou falha
- **THEN** a interface distingue esses estados entre si e de um valor financeiro real igual a zero; após falha, disponibiliza uma nova tentativa. Ao trocar o período, uma falha ou resposta atrasada não pode exibir dados do intervalo anterior como dados do novo.

### Requirement: Paridade de navegação e ações
O redesign MUST preservar os nove destinos e o acesso aos widgets e ações existentes. A revisão visual MUST NOT mudar fórmulas, regras de pagamento ou efeitos econômicos. Correções de API desta mudança MUST se limitar aos dois cenários de formulário abaixo. A [decisão D5](<../../design.md>) separa essas correções das alterações da mudança de Integridade.

#### Scenario: Ação de lançamento
- **WHEN** o usuário ativa a ação de novo lançamento na navegação
- **THEN** o aplicativo solicita escolha explícita de uma conta e abre o formulário existente; sem contas, orienta a cadastrar uma. Não escolhe uma conta silenciosamente, não grava ao abrir e não altera a validação de gravação.

#### Scenario: Assistente sob demanda
- **WHEN** a aplicação abre e a pessoa ainda não acionou o assistente
- **THEN** o assistente não ocupa a primeira tela e permanece disponível por um controle nomeado; acioná-lo abre a interface existente sem enviar uma consulta por conta própria.

#### Scenario: Uso por teclado
- **WHEN** o usuário alterna entre navegação, busca e diálogos via teclado
- **THEN** os controles têm nomes acessíveis, foco visível e retorno de foco apropriado ao encerrar o diálogo.

#### Scenario: Editar Caixinha com opcionais vazios
- **WHEN** a edição envia descrição, contribuição ou rendimento explicitamente vazios
- **THEN** esses campos usam os mesmos padrões do cadastro; omissão preserva o valor gravado, sem alterar o saldo acumulado ou a conta vinculada por essa normalização.

#### Scenario: Gravar dados da assembleia
- **WHEN** o formulário informa a próxima assembleia no cadastro ou a contagem na edição de um Consórcio
- **THEN** a releitura do Consórcio confirma os campos informados, a data é apresentada como dia civil e pagamentos e parcelas não mudam pelas correções destes campos.

### Requirement: Migração verificada por família
Cada fatia MUST verificar seu recorte em temas claro e escuro e em desktop e celular, usando dados sintéticos. O contrato visual vigente MUST distinguir capacidades migradas, validadas e ainda legadas.

#### Scenario: Revisão de uma fatia antes de retirar sua apresentação anterior
- **WHEN** uma fatia propõe substituir as superfícies de uma família
- **THEN** a revisão confronta a hierarquia com a referência visual e verifica, por ação, o acesso e o efeito pertinente, incluindo ocultação de valores e gestão de metas orçamentárias onde aplicável. Uma resposta simulada ou toast não prova persistência; evidência de uma família não prova o tema inteiro.
