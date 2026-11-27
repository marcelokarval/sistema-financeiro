# Retrospective — `aprimorar-prioridade-media-a11y-validacoes-e-fluxos`

## O que funcionou bem
- O particionamento em três frentes disjuntas na Wave 1 (`1.1` shell/overlays/calendário/orçamento/série `Tudo`, `1.2` busca NFD/contas/cartões/compras/categorias, `1.3` consórcios/caixinhas/investimentos/parcelas) manteve zero conflito de escrita até a integração na Task `2.1` (`#460`, `#461`, `#462`).
- Extrair `normalizeSearchText` para um helper único em `src/lib/search-normalize.ts` eliminou duplicação entre `global-search.tsx` e `purchases-view.tsx`, com cobertura unitária direta em `src/lib/search-normalize.test.ts` (`#9`).
- A localização do botão de fechar diálogos via `FinanceFormDialogShell` (`closeLabel` com fallback `shared.dialogCloseLabel`) e `<DialogClose asChild>` com `showCloseButton={false}` evitou qualquer modificação em `src/components/ui/**` (`#8`).
- A apara de `monthlyTrend` em `src/app/api/dashboard/route.ts` restrita a faixas `trendMonths > 12` preservou a retrocompatibilidade das consultas de `<= 12` meses e manteve todos os totais agregados desde `2000-01-01` (`#12`).

## Pontos de atenção e lições aprendidas
- A introdução de `useState`/`useRef`/`useEffect` em `InstallmentEntries` (`#18`) revelou acoplamento implícito no stub `withPtIntlDispatcher` de `src/components/finance/quiet-investment-mutations.test.tsx` (`#464`), fora do manifesto inicial da Task `2.1`; registrar e autorizar explicitamente a inclusão do arquivo (`#465`, `81` paths) restaurou o contrato sem improvisos.
- Os runners `.qa.mjs` herdavam asserções legadas ligadas ao texto `'Close'` (`quiet-primary-operations.qa.mjs`, `quiet-goals-widgets.qa.mjs`) e submissões sintéticas sem `card-digits` (`quiet-accounts-cards.qa.mjs`, `quiet-cards-purchases-categories.qa.mjs`), exigindo atualização explícita e revalidação de todos os 15 runners em `bwrap` (`#468`–`#475`).
- O monitoramento de linhas e o gate AST mantiveram todos os arquivos monitorados abaixo do teto de `500` linhas (`global-search.tsx` `490`, `cards-view.tsx` `477`, `categories-view.tsx` `460`, `purchases-view.tsx` `438`, `monthly-budget-tracker.tsx` `364`, `app-header.tsx` `171`) e preservaram intactas as 6 identidades do baseline em `.zscripts/frontend-architecture-baseline.json` (`#477`).
