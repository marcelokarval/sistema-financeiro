## ADDED Requirements

### Requirement: Concorrência segura e descarte de estado obsoleto em widgets de análise e linha do tempo
Os widgets `NetworthEvolution`, `FinancialCalendar`, `TransactionAnalytics` e `SpendingTimeline` MUST associar cada consulta a um `AbortController` e a uma identidade única de requisição, descartando respostas ou falhas de requisições anteriores já abortadas ou substituídas, e MUST limpar dados antigos e exibir estado explícito de erro com opção de nova tentativa quando a requisição vigente falhar (`!res.ok` ou rejeição de transporte).

#### Scenario: Descarte de resposta ou erro atrasado em troca de período ou filtro nos widgets
- **WHEN** `NetworthEvolution`, `FinancialCalendar`, `TransactionAnalytics` ou `SpendingTimeline` inicia uma consulta `A`, o usuário altera o período ou filtro para `B` (ou aciona atualização/retry), `B` resolve primeiro e a requisição `A` resolve depois com `200 OK`, resposta HTTP não OK ou rejeição de transporte
- **THEN** o widget MUST abortar e descartar o resultado ou erro de `A`, mantendo exibidos apenas os dados e estado da requisição vigente `B` sem sobrescrever estado nem encerrar carregamento indevidamente.

#### Scenario: Limpeza de dados antigos e sinalização de erro em falha subsequente nos widgets
- **WHEN** um dos widgets (`NetworthEvolution`, `FinancialCalendar`, `TransactionAnalytics`, `SpendingTimeline`, `DebtOverview` ou `FinancialReportsWidget`) possui dados carregados anteriormente e uma nova consulta ou tentativa falha (`!res.ok` ou falha de rede)
- **THEN** o widget MUST limpar os dados anteriores exibidos e apresentar estado explícito de erro (`role="alert"`) com ação `Tentar novamente`, recuperando normalmente quando uma nova tentativa retornar `200 OK`.

---

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

---

### Requirement: Resiliência HTTP em exclusão de orçamento, transferência entre contas e falha de dividendos
Os fluxos de exclusão em `MonthlyBudgetTracker`, transferência em `AccountsView` e consulta de dividendos em `InvestmentsView` MUST tratar respostas HTTP não OK (incluindo corpo não-JSON) e falhas de rede sem mascarar o tipo de erro nem exibir valores financeiros zerados como se fossem dados reais.

#### Scenario: Resposta não-JSON em handleDelete de orçamento mensal e saveTransfer de contas
- **WHEN** `MonthlyBudgetTracker` executa `DELETE /api/monthly-budgets` ou `AccountsView` executa `POST /api/transfer` e recebe resposta HTTP não OK cujo corpo não é JSON válido
- **THEN** o parse de erro MUST usar fallback seguro sem lançar exceção de sintaxe, anunciando a mensagem de falha da operação (`Erro ao excluir` ou `Erro na transferência`) via `toast.error` e preservando o diálogo aberto sem releitura prematura.

#### Scenario: Falha na consulta de dividendos em Investimentos
- **WHEN** `InvestmentsView` conclui `/api/investments` com sucesso, mas `fetchDividends` (`/api/investments/transactions`) retorna HTTP não OK ou rejeita por falha de rede
- **THEN** `InvestmentsView` MUST sinalizar erro explícito de carregamento de dividendos (`role="alert"`) com opção `Tentar novamente` e MUST NOT exibir `R$ 0,00` como se representasse dividendos reais recebidos.
