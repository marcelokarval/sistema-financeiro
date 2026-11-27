## 1. Correções independentes de infraestrutura, widgets e cartões

- [x] 1.1 Corrigir getServerSnapshot cacheado em use-realtime.ts e mover controles da Sidebar para o topo (#1), adicionar showValues em store.ts e atualizar AppIntlProvider e LanguageSwitcher com atualização imediata e useTransition (#5-core), corrigir filtro mensal de UpcomingBills (#4) e propagar showValues e refetch por locale em QuickStatsOverview e ReceiptGenerator (#3, #5)
- [x] 1.2 Propagar showValues opcional (mascarando montantes, percentuais, eixos e tooltips sem desmontar gráficos) e refetch por locale nos 22 módulos de Metas e Análises (#3, #5), aplicar min-w-0 em TransactionAnalytics e TransactionAnalysisTabs (#2) e limpar comparações PT legadas em insightActionDestination (#5)
- [x] 1.3 Propagar showValues opcional e refetch por locale em RecurringTransactionsWidget (#3, #5) e condicionar métricas e datas de crédito em CardsView para type !== 'DEBIT' com chaves localizadas em cards.json para pt, es e en (#6)

## 2. Integração no Resumo e verificação completa

- [x] 2.1 Conectar showValues de useAppStore e min-w-0 em page.tsx e dashboard-view.tsx para os 18 sub-widgets (#2, #3, #5), atualizar e expandir as suítes unitárias afetadas, quiet-i18n.qa.mjs e shellHash em quiet-account-transaction-focus.qa.mjs, e validar check, test:sqlite, build e runners .qa.mjs em sandbox isolado
