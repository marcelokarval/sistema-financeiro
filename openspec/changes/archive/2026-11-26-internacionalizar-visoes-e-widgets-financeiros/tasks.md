## 1. Internacionalização dos primitivos e visões por família

- [x] 1.1 Internacionalizar os 7 primitivos em src/components/shared/, os módulos do Resumo (dashboard-query.ts, dashboard-view.tsx, quick-stats-overview.tsx, upcoming-bills.tsx), notificações (notification-panel.tsx) e assistente (ai-advisor.tsx, advisor-composer.tsx) nos namespaces shared, dashboard, notifications e advisor (pt, es, en)
- [x] 1.2 Internacionalizar os 24 módulos de metas, saúde financeira, desafios, insights, orçamento mensal, projeção de saldos, fluxo de caixa, dívidas, despesas, calendário, relatórios, patrimônio e linha do tempo nos namespaces goals e analytics (pt, es, en) com catálogo analytics-i18n.ts
- [x] 1.3 Internacionalizar os 15 módulos de Contas, Cartões, Compras, Categorias e Recibos nos namespaces accounts, cards, purchases, categories e receipts (pt, es, en) com catálogo operations-i18n.ts e impressão multilíngue
- [x] 1.4 Internacionalizar os 17 módulos de Investimentos, Parcelas, Consórcios, Caixinhas e Recorrências nos namespaces investments, installments, consortiums, savings e recurring (pt, es, en) com catálogo portfolio-i18n.ts

## 2. Integração de mensagens e verificação multi-idioma

- [x] 2.1 Conectar os 16 namespaces em src/i18n/messages.ts, src/i18n/types.ts e src/i18n/request.ts após integração da Change 1, atualizar as 14 suítes de teste em src/components/finance/ (IntlTestWrapper/renderWithIntl) e os 14 runners .qa.mjs (AppIntlProvider), criar src/components/finance/quiet-i18n.qa.mjs e validar check, test:sqlite, build e suítes Playwright em sandbox isolado para pt, es e en
