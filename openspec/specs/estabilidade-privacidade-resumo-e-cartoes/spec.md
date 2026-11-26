# estabilidade-privacidade-resumo-e-cartoes Specification

## Purpose
Especificar as correções de alta prioridade identificadas na auditoria ao vivo: estabilidade de `getServerSnapshot` e acesso aos controles da `Sidebar` recolhida, contenção de largura na aba `Padrões`, mascaramento integral de `Ocultar valores`, filtro mensal em `UpcomingBills`, troca imediata de idioma com refetch de widgets e exibição correta de cartões de débito.

## Requirements

### Requirement: Estabilidade de snapshot realtime e acesso aos controles da Sidebar recolhida
O hook `useRealtime` MUST retornar referência cacheada e estável em `getServerSnapshot`, e a `Sidebar` SHALL posicionar `Recarregar` e `Expandir/Recolher navegação` fora da borda inferior esquerda obstruída pelo portal de desenvolvimento quando recolhida.

#### Scenario: Hidratação sem erro getServerSnapshot e clique livre na Sidebar recolhida
- **WHEN** a aplicação hidrata no cliente e a `Sidebar` está no modo recolhido (`collapsed={true}`)
- **THEN** `getServerSnapshot` devolve sempre a mesma referência sem erro React no console e os botões de recarregar e expandir permanecem acessíveis no topo da barra lateral com `aria-label` preservado

### Requirement: Contenção responsiva da aba Padrões em TransactionAnalytics
O container de widgets do Resumo (`DashboardWithWidgets`), o componente `<Tabs>` de `TransactionAnalytics` e os `<TabsContent>` de `transaction-analysis-tabs.tsx` MUST aplicar `min-w-0` para impedir que tabelas largas expandam a página em viewports estreitos.

#### Scenario: Abertura da aba Padrões em viewport de 390px sem overflow da página
- **WHEN** o usuário abre a aba `Padrões` em `TransactionAnalytics` com largura `390px`
- **THEN** o `scrollWidth` de `main` e da página permanece menor ou igual a `390px`, mantendo a rolagem horizontal restrita ao wrapper `overflow-x-auto` da tabela mensal

### Requirement: Propagação integral de Ocultar valores nos sub-widgets do Resumo
O estado `showValues` SHALL ser compartilhado via `useAppStore` entre `DashboardView` e `DashboardWithWidgets` e repassado a todos os 18 sub-widgets de `Mais detalhes financeiros`, ocultando montantes, percentuais, eixos `YAxis` e tooltips sem desmontar gráficos.

#### Scenario: Ativação de Ocultar valores com Mais detalhes financeiros expandido
- **WHEN** o usuário aciona `Ocultar valores` e expande `Mais detalhes financeiros`
- **THEN** nenhum sub-widget exibe valores monetários reais, percentuais ou dígitos sensíveis em texto, `aria-label`, `aria-valuetext`, `title`, eixos `YAxis` ou tooltips, mantendo `.recharts-wrapper` montado nos gráficos

### Requirement: Filtro mensal sem duplicação no grupo Este mês de UpcomingBills
O componente `UpcomingBillsPanel` MUST filtrar o grupo `Este mês` pelos vencimentos do mês calendário corrente excluindo itens com `status === 'overdue'` já exibidos no grupo `Atrasados`.

#### Scenario: Contas atrasadas e futuras do mês corrente em UpcomingBills
- **WHEN** `UpcomingBillsPanel` recebe contas `overdue` e contas futuras dentro e fora do mês calendário de referência
- **THEN** apenas contas não atrasadas do mês corrente integram o grupo `Este mês`, sem duplicar os itens nem o subtotal de `Atrasados`

### Requirement: Troca de idioma imediata com feedback pendente e refetch de widgets
A seleção no `LanguageSwitcher` MUST atualizar `AppIntlProvider` imediatamente em `useTransition`, disparar nova leitura nos widgets dependentes de API via `locale` sem alterar URLs `fetch('/api/...')` e remover comparações literais em português de `insightActionDestination`.

#### Scenario: Alternância dinâmica de idioma entre pt, es e en sem recarregar a página
- **WHEN** o usuário seleciona outro idioma no `LanguageSwitcher`
- **THEN** o cookie `NEXT_LOCALE` é gravado, o `AppIntlProvider` atualiza textos e sinaliza transição pendente, e todos os widgets com `fetch('/api/...')` refazem a consulta mantendo URLs sem `?locale=` obrigatório e roteando insights por `insight.id`

### Requirement: Exibição semântica de cartões de débito em CardsView
A visão `CardsView` (lista `CardRow` e detalhe do cartão) MUST omitir fatura atual, limite de crédito, valor disponível, barra de uso e datas de fechamento/vencimento quando `card.type === 'DEBIT'`, apresentando resumo próprio de débito em `pt`, `es` e `en`.

#### Scenario: Listagem e abertura de detalhes de cartão DEBIT em CardsView
- **WHEN** `CardsView` renderiza um cartão com `type === 'DEBIT'` na lista ou na tela de detalhes
- **THEN** métricas e datas exclusivas de crédito não são exibidas, enquanto o resumo de modalidade débito, o número mascarado e as compras vinculadas são mostrados com conformidade AST e arquivos `<= 500` linhas
