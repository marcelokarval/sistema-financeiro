## Why

A auditoria viva em `localhost:3000` (`#405`) confirmou seis defeitos de alta prioridade: erro de hidratação `getServerSnapshot` que expande o portal dev sobre a `Sidebar` recolhida, estouro horizontal de `539px` em `390x844` na aba `Padrões` de `TransactionAnalytics`, vazamento de valores reais nos 17 sub-widgets ao ativar `Ocultar valores`, duplicação dos 38 itens atrasados no grupo `Este mês` de `UpcomingBills`, troca silenciosa de idioma com widgets exibindo dados da API no idioma anterior, e cartões de débito exibindo fatura, limite e datas de crédito. Corrigi-los agora fecha lacunas críticas de privacidade, layout móvel, i18n e consistência financeira antes das melhorias médias.

## What Changes

**Hidratação realtime e desbloqueio da `Sidebar` recolhida (#1)**
- From: `getServerSnapshot()` retorna novo objeto a cada chamada e os botões de controle ficam na borda inferior esquerda sob `<nextjs-portal>` quando recolhida.
- To: snapshot de servidor cacheado em constante de módulo e controles `Recarregar` / `Expandir navegação` posicionados no topo da `Sidebar`.
- Reason: zera erro React na hidratação e evita interceptação de cliques em desenvolvimento.
- Impact: non-breaking; preserva `aria-label`, tooltips e indicador de conexão.

**Contenção de largura na aba `Padrões` e propagação global de `Ocultar valores` (#2, #3)**
- From: `DashboardWithWidgets` e `TransactionAnalytics` carecem de `min-w-0` causando overflow de `539px`, e `showValues` não alcança os 17 sub-widgets de `Mais detalhes financeiros`.
- To: `min-w-0` aplicado em `page.tsx`, `transaction-analytics.tsx` e `transaction-analysis-tabs.tsx`; `showValues` gerenciado em `useAppStore` e repassado por prop opcional aos 18 sub-widgets, mascarando montantes, percentuais, eixos `YAxis` e tooltips sem desmontar `.recharts-wrapper`.
- Reason: garante reflow sem overflow em `390px` e privacidade integral no Resumo.
- Impact: non-breaking; mantém assinaturas standalone com `showValues = true` padrão.

**Agrupamento `Este mês` em `UpcomingBills`, troca dinâmica de idioma e Cartão de Débito (#4, #5, #6)**
- From: `Este mês` usa `status !== 'later'` duplicando `Atrasados`; `LanguageSwitcher` aguarda `router.refresh()` sem feedback nem refetch por `locale` nos widgets; `CardsView` exibe fatura/limite/ciclo para `DEBIT`.
- To: `Este mês` filtra pelo mês calendário corrente excluindo `overdue`; `AppIntlProvider` atualiza `locale`/`messages` de imediato com `useTransition` enquanto widgets refazem `fetch('/api/...')` sem alterar URLs; `insightActionDestination` limpa comparações PT mortas; `CardsView` omite métricas de crédito para `DEBIT`.
- Reason: corrige fidelidade dos vencimentos, elimina UI bilíngue pós-troca e alinha lista/detalhe de cartões ao `CardEditor`.
- Impact: non-breaking para rotas API e contratos Quiet.

## Capabilities

### New Capabilities
- `estabilidade-privacidade-resumo-e-cartoes`: estabilidade de hidratação e controles da `Sidebar`, contenção responsiva em `TransactionAnalytics`, mascaramento integral de `Ocultar valores` nos widgets secundários, filtragem mensal em `UpcomingBills`, atualização imediata e refetch de widgets na troca de idioma, e exibição coerente de cartões de débito.

### Modified Capabilities
<!-- Nenhuma capability canônica em openspec/specs/ tem seus requisitos alterados; os invariantes existentes permanecem preservados. -->

## Impact

- Código de produção: `src/hooks/use-realtime.ts`, `src/components/finance/sidebar.tsx`, `src/lib/store.ts`, `src/i18n/provider.tsx`, `src/app/page.tsx`, 24 módulos em `src/components/finance/` e catálogos `src/messages/{pt,es,en}/cards.json`.
- Testes e QA: 8 suítes `src/components/finance/*.test.*` e `src/components/finance/quiet-i18n.qa.mjs`.
- Exclusões garantidas: `src/app/api/**`, `src/components/ui/**`, `db/custom.db`, `.env`, `bun.lock` e as 6 identidades AST de `.zscripts/frontend-architecture-baseline.json`.
