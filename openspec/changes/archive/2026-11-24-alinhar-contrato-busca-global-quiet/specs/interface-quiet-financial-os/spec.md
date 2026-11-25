## MODIFIED Requirements

### Requirement: Paridade de navegação e ações
O redesign MUST preservar os nove destinos e o acesso aos widgets e ações existentes. A revisão visual MUST NOT mudar fórmulas, regras de pagamento ou efeitos econômicos. Correções de API desta mudança MUST se limitar aos dois cenários de formulário abaixo. A decisão D5 separa essas correções das alterações da mudança de Integridade.

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

#### Scenario: Seleção de resultado na busca global
- **WHEN** o usuário ativa um resultado na busca global (`GlobalSearch`) por clique ou `Enter`, ou fecha a busca por `Escape`
- **THEN** conforme a **Alternativa A** recomendada em [design.md](../../design.md) (sujeita à confirmação explícita do responsável de produto antes da aplicação; caso opte pela **Alternativa B**, este cenário deve ser revisado antes da sincronização para restringir a ação apenas à navegação ao destino), o aplicativo navega ao destino correspondente e abre o detalhe ou expande o registro quando o ID existir (`Contas`, `Transações` com `accountId` válido, `Cartões`, `Compras`, `Investimentos`, `Parcelas` e `Consórcios`), mantendo `Categorias` apenas como navegação ao destino; se o ID (ou `accountId`) não existir na coleção carregada, limpa a seleção na store sem abrir nem expandir outro registro; e ao fechar por `Escape`, devolve o foco ao controle de origem conectado e distinto de `document.body`, ou ao botão `Abrir busca global` como fallback.
