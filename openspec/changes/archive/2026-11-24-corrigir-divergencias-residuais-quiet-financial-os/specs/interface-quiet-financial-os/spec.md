## MODIFIED Requirements

### Requirement: Resumo ligado aos dados atuais
O resumo MUST usar os contratos existentes e rótulos compatíveis com seus dados. O produto MUST NOT exibir números, nomes, curvas ou compromissos ilustrativos como se fossem reais, nem atribuir às métricas atuais a semântica de patrimônio, caixa projetado ou plano da referência sem contrato equivalente. Ao alternar o horizonte ou período de consulta, respostas e falhas de requisições anteriores MUST ser descartadas para que dados ou erros de intervalo anterior nunca sobrescrevam o período selecionado atual.

#### Scenario: Consulta com dados disponíveis
- **WHEN** o usuário seleciona um período válido
- **THEN** os indicadores e séries sensíveis ao período refletem os dados correspondentes, e saldos de posição atual são identificados como tal.

#### Scenario: Consulta sem dados ou com erro
- **WHEN** a consulta está pendente, retorna sem dados ou falha
- **THEN** a interface distingue esses estados entre si e de um valor financeiro real igual a zero; após falha, disponibiliza uma nova tentativa. Ao trocar o período, uma falha ou resposta atrasada não pode exibir dados do intervalo anterior como dados do novo.

#### Scenario: Descarte de resposta ou erro de período anterior na projeção de saldos
- **WHEN** `balance-projection` inicia consulta para um horizonte `A` (`selectedMonths = 6`), o usuário alterna para o horizonte `B` (`selectedMonths = 3`), `B` resolve primeiro e a requisição `A` resolve depois com `200 OK`, `503` ou rejeição de transporte
- **THEN** a interface MUST descartar a resposta ou erro de `A` por sinal abortado/identidade de requisição vencida, mantendo exibidos os dados, estado não carregando e seleção de `B` sem sobrescrever `data` ou `loading`.

---

### Requirement: Paridade de navegação e ações
O redesign MUST preservar os nove destinos e o acesso aos widgets e ações existentes. A revisão visual MUST NOT mudar fórmulas, regras de pagamento ou efeitos econômicos. Correções de API desta mudança MUST se limitar aos dois cenários de formulário abaixo. A decisão D5 separa essas correções das alterações da mudança de Integridade. Em formulários de orçamento mensal, falhas HTTP não OK MUST manter o diálogo de edição e o rascunho abertos sem disparar releitura automática; após exclusões confirmadas com releitura tardia em Contas, Cartões, Consórcios e Caixinhas, o foco MUST permanecer em um controle sobrevivente conectado ao DOM sem cair em `document.body`.

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

#### Scenario: Retenção de editor e rascunho em erro HTTP do orçamento mensal
- **WHEN** `MonthlyBudgetTracker` envia `POST` ou `PUT` para `/api/monthly-budgets` e recebe resposta HTTP não OK (com JSON de erro ou corpo não JSON) ou falha de transporte
- **THEN** o sistema MUST anunciar erro via `toast.error`, manter `MonthlyBudgetEditor` aberto (`open === true`) com todos os campos do rascunho intactos e MUST NOT disparar `refreshBudgets()` (`GET /api/monthly-budgets`) prematuro.

#### Scenario: Foco sobrevivente após exclusão com releitura tardia em Contas, Cartões, Consórcios e Caixinhas
- **WHEN** o usuário confirma `DELETE` na lista de Contas (`account/Excluir/late`), Cartões (`card/Excluir/late`), Consórcios (`list/Excluir/late`) ou Caixinhas (`caixinhas/exclusao/late`) e o `GET` de atualização resolve após o fechamento do diálogo removendo o registro excluído do DOM
- **THEN** o foco MUST estar em um controle sobrevivente conectado (por exemplo `Nova conta`, `Novo cartão`, `#consortium-create` ou `#savings-create`, ou outro controle sobrevivente já focado pelo usuário), MUST NOT cair em `document.body`, e nenhum desses cenários pode permanecer classificado em `preexistingQuietDivergences`.

---

### Requirement: Migração verificada por família
Cada fatia MUST verificar seu recorte em temas claro e escuro e em desktop e celular, usando dados sintéticos. O contrato visual vigente MUST distinguir capacidades migradas, validadas e ainda legadas, e a cobertura de componentização frontend MUST registrar com exatidão as divergências sanadas e as eventualmente pendentes após verificação integrada.

#### Scenario: Revisão de uma fatia antes de retirar sua apresentação anterior
- **WHEN** uma fatia propõe substituir as superfícies de uma família
- **THEN** a revisão confronta a hierarquia com a referência visual e verifica, por ação, o acesso e o efeito pertinente, incluindo ocultação de valores e gestão de metas orçamentárias onde aplicável. Uma resposta simulada ou toast não prova persistência; evidência de uma família não prova o tema inteiro.

#### Scenario: Reconciliação das divergências residuais e verificação nas seis células
- **WHEN** as correções em projeção de saldos, orçamento mensal e foco pós-exclusão de Contas, Cartões, Consórcios e Caixinhas forem implementadas
- **THEN** a Seção 5 de `docs/reference/frontend-componentization-coverage.md` MUST ser reconciliada refletindo conformidade Quiet nesses itens, e `check-frontend-architecture.ts`, `typecheck`, `lint`, `bun --no-env-file test` e os runners `.qa.mjs` afetados MUST passar nas 6 células (`360/390/1440 × light/dark`) com zero `preexistingQuietDivergences` para essas superfícies.
