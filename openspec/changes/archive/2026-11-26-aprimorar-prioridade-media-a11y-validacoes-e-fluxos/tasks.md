## 1. Implementação das melhorias médias por frentes paralelas

- [x] 1.1 Corrigir cabeçalho mobile e overlays (#7, #10), localizar botão fechar em FinanceFormDialogShell e editores de orçamento/metas (#8), restringir dias clicáveis no calendário (#11), otimizar série Tudo preservando totais desde 2000 (#12) e restaurar foco ao cancelar MonthlyBudgetEditor (#13)
- [x] 1.2 Implementar busca NFD compartilhada (#9), localizar botão fechar em Busca Global/Contas/Transferência/Cartão (#8), suportar TRANSFER neutro e campo notes em Contas (#14), endurecer validações client-side com propagação de data.error em Cartões/Compras/Categorias (#16) e padronizar alvos táteis >= 44px em Contas e Cartões (#17)
- [x] 1.3 Localizar botão fechar em Consórcios e Caixinhas (#8), ocultar Depositar no menu de meta concluída (#15), validar criação de Consórcios e Parcelas (#16), padronizar alvos táteis >= 44px em Investimentos e Parcelas (#17) e adicionar filtro Todas/Pendentes/Pagas e salto à próxima parcela pendente (#18)

## 2. Testes unitários, QA Playwright e verificação integrada

- [x] 2.1 Atualizar testes unitários, paridade JSON pt/es/en e runners .qa.mjs (incluindo quiet-investment-mutations.test.tsx e quiet-cards-purchases-categories.qa.mjs) afetados pelas Tasks 1.1–1.3, adicionar cobertura para os itens #7 a #18 (incluindo src/lib/search-normalize.test.ts) e validar check, test:sqlite, build e inspeção Playwright
