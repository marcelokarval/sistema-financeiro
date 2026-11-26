# acessibilidade-validacoes-e-fluxos Specification

## Purpose

Especificar as melhorias de prioridade média (#7 a #18) em acessibilidade, validações client-side, comportamento de overlays, calendário, série histórica, contabilidade visual de transferências e navegação de listas longas no FinanceApp.

## ADDED Requirements

### Requirement: Cabeçalho móvel compacto sem quebra adicional nos três idiomas (#7)
Em larguras móveis (`390px`), o componente `AppHeader` MUST manter o botão primário de lançamento e os controles globais sem empurrar o CTA para uma linha extra em `pt`, `es` e `en`, preservando `aria-label` completo e ausência de rolagem horizontal.

#### Scenario: Altura e alinhamento do cabeçalho móvel em pt, es e en
- **WHEN** `AppHeader` é renderizado em viewport `390x844` nos locales `pt`, `es` e `en`
- **THEN** todos os controles do cabeçalho permanecem alinhados sem linha extra exclusiva do botão de lançamento (`headerHeight <= 76px`) e com nome acessível completo preservado.

### Requirement: Rótulo de fechamento localizado em todos os diálogos sem editar shadcn/ui (#8)
Os diálogos em accounts-view, account-transfer-dialog, card-editor, global-search, consortiums-view, consortium-editor, consortium-installment-payment, savings-goal-editor, savings-contribution-dialog, monthly-budget-editor, budget-goal-editor e `FinanceFormDialogShell` MUST expor botão fechar localizado em `pt`, `es` e `en` sem editar `src/components/ui/**`.

#### Scenario: Ausência de texto "Close" em inglês nos diálogos em pt e es
- **WHEN** qualquer um dos onze diálogos afetados (incluindo `global-search`) é aberto em `pt` ou `es`
- **THEN** o botão de fechamento possui `aria-label` localizado no idioma ativo, `showCloseButton={false}` no `DialogContent` subjacente e nenhum texto `"Close"` visível para leitores de tela.

### Requirement: Busca insensível a acentos por helper compartilhado (#9)
As buscas em `GlobalSearch` e `PurchasesView` MUST utilizar um helper puro compartilhado (`normalizeSearchText` em `src/lib/search-normalize.ts`) que aplica normalização Unicode NFD e remoção de diacríticos antes de filtrar resultados.

#### Scenario: Consulta sem acento encontra registros acentuados
- **WHEN** o usuário digita `"saude"` na busca global ou `"farmacia"` no filtro de `PurchasesView`
- **THEN** registros contendo `"Saúde"` ou `"Farmácia Raia"` são encontrados em igualdade com a grafia acentuada.

### Requirement: Fechamento externo e erro localizado em Notificações e Assistente IA (#10)
`NotificationPanel` MUST fechar ao clicar fora de seu contêiner e de seu gatilho, `<dialog>` de `AIAdvisor` MUST fechar ao clicar no backdrop, e falhas de transporte em `AIAdvisor` MUST exibir mensagem traduzida no idioma ativo sem texto cru de rede do navegador.

#### Scenario: Clique fora, clique no backdrop e falha de fetch nos overlays
- **WHEN** o usuário clica em `<main>` com `NotificationPanel` aberto, clica no backdrop de `AIAdvisor` ou sofre erro de rede em `POST /api/advisor`
- **THEN** ambos os overlays encerram no respectivo evento externo e o chat exibe erro localizado sem expor `"Failed to fetch"`.

### Requirement: Dias vazios não interativos no Calendário Financeiro (#11)
`FinancialCalendar` e `FinancialCalendarGrid` MUST popular `activityMap` apenas para dias que possuam receitas, despesas ou eventos previstos, marcando dias vazios como não interativos (`aria-disabled="true"`).

#### Scenario: Seleção bloqueada em dia sem atividade financeira
- **WHEN** o usuário inspeciona ou clica em um dia sem receitas, despesas nem eventos no `FinancialCalendarGrid`
- **THEN** a célula expõe `aria-disabled="true"`, não exibe indicador de atividade e clicar nela não altera `selectedDate`.

### Requirement: Série mensal enxuta no preset Tudo preservando totais desde 2000 (#12)
Para consultas longas (`trendMonths > 12`, como o preset `Tudo` desde `2000-01-01`), `GET /api/dashboard` MUST iniciar `monthlyTrend` no primeiro mês com movimento real no intervalo mantendo todos os agregados desde 2000 e preservando comportamento inalterado em faixas de até 12 meses.

#### Scenario: Preset Tudo sem centenas de meses zerados anteriores ao histórico
- **WHEN** `GET /api/dashboard` recebe `from=2000-01-01&to=2026-11-30` com lançamentos apenas em `2026`
- **THEN** `monthIncome`, `monthExpense` e totais refletem todo o período desde 2000 enquanto `monthlyTrend` inicia no primeiro mês com movimento real, preservando consultas `<= 12` meses em banco vazio.

### Requirement: Retorno de foco ao cancelar ou fechar MonthlyBudgetEditor (#13)
`MonthlyBudgetTracker` MUST capturar o elemento disparador ao abrir criação ou edição e restaurar o foco a esse controle (ou ao botão `Novo limite`) via `onCloseAutoFocus` ao fechar `MonthlyBudgetEditor`, preservando comportamento standalone do editor.

#### Scenario: Cancelamento via Escape ou Cancelar devolve foco em MonthlyBudgetTracker
- **WHEN** o usuário abre `MonthlyBudgetEditor` a partir de `Novo limite` ou do menu da linha e fecha com `Escape` ou `Cancelar`
- **THEN** o foco retorna ao controle disparador conectado ao DOM e não recai sobre `document.body`.

### Requirement: Exibição neutra de TRANSFER e edição de notes em Contas (#14)
`AccountsView` MUST renderizar transações `type === 'TRANSFER'` com `tone="neutral"` e rótulo localizado de transferência sem sinal de despesa, e `AccountTransactionFields` MUST expor o campo `notes` preservando edições de transferências sem corromper o tipo.

#### Scenario: Listagem e edição de transação TRANSFER e notas em Contas
- **WHEN** uma conta possui transação `TRANSFER` e o usuário visualiza a lista ou abre criação/edição em `AccountTransactionFields`
- **THEN** a linha exibe tom neutro e rótulo de transferência, o campo `notes` é editável e transferências em edição não são convertidas em `EXPENSE`.

### Requirement: Ocultação de depósito no menu de caixinha concluída (#15)
`SavingsGoalRow` em `savings-view.tsx` MUST ocultar a opção `Depositar` também no menu `Mais ações` (`DropdownMenu`) quando `isComplete` for verdadeiro.

#### Scenario: Menu Mais ações de meta concluída sem opção Depositar
- **WHEN** uma meta em `Caixinhas` possui `isCompleted === true` ou `currentAmount >= targetAmount` e o usuário abre `Mais ações`
- **THEN** apenas `Editar` e `Excluir` são exibidos, evitando envio de `POST /api/savings/deposit` com erro `GOAL_COMPLETED`.

### Requirement: Validação client-side prévia e mensagens específicas da API (#16)
Os formulários de Cartões (`cards-view.tsx`), Compras (`purchases-view.tsx`), Categorias (`categories-view.tsx`), Consórcios (`consortiums-view.tsx`) e Parcelas (`installments-view.tsx`) MUST validar campos obrigatórios, `.trim()` e faixas numéricas válidas no cliente antes do envio e propagar `data.error` da API quando presente.

#### Scenario: Bloqueio de envio inválido e exibição de erro detalhado da API
- **WHEN** o usuário tenta salvar nome/estabelecimento só com espaços, dígitos finais inválidos ou dia fora de `1..31` em Cartões, total zerado em Compras ou valores não positivos em Consórcios/Parcelas, ou a API retorna `4xx` com `{ error }`
- **THEN** o cliente bloqueia a requisição inválida exibindo toast localizado e propaga `data.error` em falhas JSON da API sem perder o rascunho.

### Requirement: Alvos táteis mínimos de 44×44px no mobile em quatro visões (#17)
Os controles interativos de ação, retorno, filtro e linha em `accounts-view.tsx`, `cards-view.tsx`, `investments-view.tsx` e `installments-view.tsx` MUST adotar alvos mínimos `>= 44×44px` (`min-h-11` / `size-11`) no mobile, preservando as identidades AST do baseline.

#### Scenario: Dimensão tátil mínima em viewport 390x844
- **WHEN** `Contas`, `Cartões`, `Investimentos` e `Parcelas` são inspecionados em `390x844`
- **THEN** botões de voltar, criar, filtrar, editar, excluir, copiar e pagar possuem altura e largura mínimas de `44px` mantendo `0` erros no `arch:check`.

### Requirement: Filtro rápido e salto para próxima parcela pendente em Consórcios e Parcelas (#18)
`ConsortiumDetail` (`consortiums-view.tsx`) e `InstallmentEntries` (`installments-view.tsx`) MUST oferecer filtro de parcelas (`Todas`, `Pendentes`, `Pagas`) e atalho para navegar até a próxima parcela aberta, mantendo ordem numérica `1..N` e todas as guardas `A/B`.

#### Scenario: Filtragem e salto para próxima parcela aberta preservando ordem e guardas
- **WHEN** um consórcio ou plano possui parcelas pagas e pendentes e o usuário alterna o filtro ou aciona o atalho de próxima pendente
- **THEN** as parcelas exibidas preservam ordem crescente `1..N`, o atalho destaca/foca a primeira parcela aberta e nenhuma guarda de seleção `A/B` ou `confirmedPlanId` é relaxada.
