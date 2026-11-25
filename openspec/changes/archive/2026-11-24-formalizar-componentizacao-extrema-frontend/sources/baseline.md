# Inventário e referências de paridade

Base Git: `eb76f7d0f3ced99248ed3c8e5334fcc8792a348f`. Método: `git ls-tree -r --name-only eb76f7d`, selecionar TSX e classificar primeiro `.test.tsx`, depois `src/components/ui/`, depois App Router e `finance/shared`; o único restante é a demo. A lista é inventário estático, não QA. As medidas heurísticas estão na [auditoria histórica](auditoria-componentizacao-tsx.md), preservada sem edição.

## Fontes vigentes no snapshot

- [AGENTS.md](../../../../AGENTS.md) e [guia de acabamento](../../../../docs/research/POLISHING_RULES.md): entrada por widget; extrair responsabilidades e padrões comprovados; `fetch` no domínio permitido; não editar shadcn manualmente.
- [Spec Quiet](../../../specs/interface-quiet-financial-os/spec.md), [integridade](../../../specs/integridade-fluxos-financeiros/spec.md) e [empacotamento](../../../specs/empacotamento-sem-dados/spec.md): a change é adicional e não os altera. Resolva referências fora do pacote contra a base Git acima; não use o conteúdo de runtime como fonte.
- [Contrato visual](../../../../docs/reference/design-system.contract.md#L24) diz navegar sem autoabrir o registro. [`page.tsx`](../../../../src/app/page.tsx#L336-L351) envia IDs pelo store: Conta e transação (só quando tem `accountId`), Cartão e Compra. [Conta](../../../../src/components/finance/accounts-view.tsx#L318-L326) e [Cartão](../../../../src/components/finance/cards-view.tsx#L195-L200) abrem o detalhe quando acham o alvo; [Compra](../../../../src/components/finance/purchases-view.tsx#L159-L165) expande a linha quando acha o alvo. [Categorias](../../../../src/components/finance/global-search.tsx#L30-L44) navega sem setter correspondente no shell. São fatos de código, não um resultado de navegador; 0016 caracteriza em fixture sem decidir a regra de produto.
- [Foco da Busca no shell](../../../../src/app/page.tsx#L115-L122) registra o elemento ativo; [fechamento](../../../../src/app/page.tsx#L159-L165) exclui `document.body` da origem válida, mesmo se conectado, e usa o botão como fallback (também para origem ausente ou desconectada).
- [Consórcios](../../../../src/components/finance/consortiums-view.tsx#L472-L507): a exclusão usa o ID do diálogo e protege o fechamento após retorno; a baixa revalida seleção, parcela e confirmação antes de enviar. A [integridade vigente](../../../specs/integridade-fluxos-financeiros/spec.md#L9-L18) proíbe a gravação pela confirmação de pagamento obsoleta, não introduz uma guarda pré-envio na exclusão. Na lista, o [fechamento do alerta](../../../../src/components/finance/consortiums-view.tsx#L468-L498) não aguarda o GET; [o retorno de foco](../../../../src/components/finance/consortiums-view.tsx#L545-L569) pode escolher a origem ainda conectada, e [a releitura](../../../../src/components/finance/consortiums-view.tsx#L181-L209) pode removê-la sem um segundo retorno explícito. A [regra de foco sobrevivente](../../../../docs/reference/design-system.contract.md#L20-L24) segue vigente; registrar o que de fato ocorrer nos dois momentos de lista e detalhe, sem afirmar que a análise estática observou o `activeElement`.
- [Projeção](../../../../src/components/finance/balance-projection.tsx#L141-L174) publica `data/loading` sem comparar os resultados ao período ativo; [Despesas](../../../../src/components/finance/expense-breakdown.tsx#L59-L96) preserva identidade por requisição. A [regra Quiet](../../../specs/interface-quiet-financial-os/spec.md#L20-L25) segue vigente. Caracterizar a divergência da Projeção (0010), sem corrigi-la nem ratificá-la por esta extração.
- [`quiet-navigation.test.tsx`](../../../../src/components/finance/quiet-navigation.test.tsx) contém render estático e asserts de fonte: só isso não comprova destino da seleção ou foco real. [`quiet-accounts-cards.qa.mjs`](../../../../src/components/finance/quiet-accounts-cards.qa.mjs) é o precedente de fixture em memória que bloqueia tráfego externo. Seu HTML não injeta o CSS do app: serve de precedente de isolamento e montagem, não de pipeline visual ou prova de outros fluxos.
- [ESLint](../../../../eslint.config.mjs) não é o gate de duplicação pretendido. Há exemplos reais de interpolação ternária em [`accounts-view.tsx`](../../../../src/components/finance/accounts-view.tsx#L801), [`global-search.tsx`](../../../../src/components/finance/global-search.tsx#L409) e [`cards-view.tsx`](../../../../src/components/finance/cards-view.tsx#L63); cada ocorrência deve ser classificada antes de promover uma regra a erro.

## Módulos próprios de produção (38)

- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/components/finance/accounts-view.tsx`
- `src/components/finance/achievement-badges.tsx`
- `src/components/finance/ai-advisor.tsx`
- `src/components/finance/balance-projection.tsx`
- `src/components/finance/budget-goals.tsx`
- `src/components/finance/cards-view.tsx`
- `src/components/finance/cash-flow-forecast.tsx`
- `src/components/finance/categories-view.tsx`
- `src/components/finance/consortiums-view.tsx`
- `src/components/finance/dashboard-view.tsx`
- `src/components/finance/debt-overview.tsx`
- `src/components/finance/expense-breakdown.tsx`
- `src/components/finance/financial-calendar.tsx`
- `src/components/finance/financial-health-score.tsx`
- `src/components/finance/financial-reports.tsx`
- `src/components/finance/global-search.tsx`
- `src/components/finance/goals-dashboard.tsx`
- `src/components/finance/installments-view.tsx`
- `src/components/finance/investments-view.tsx`
- `src/components/finance/mobile-nav.tsx`
- `src/components/finance/monthly-budget-tracker.tsx`
- `src/components/finance/networth-evolution.tsx`
- `src/components/finance/notification-panel.tsx`
- `src/components/finance/purchases-view.tsx`
- `src/components/finance/quick-actions.tsx`
- `src/components/finance/quick-stats-overview.tsx`
- `src/components/finance/receipt-generator.tsx`
- `src/components/finance/recurring-transactions.tsx`
- `src/components/finance/savings-challenge.tsx`
- `src/components/finance/savings-view.tsx`
- `src/components/finance/sidebar.tsx`
- `src/components/finance/smart-insights.tsx`
- `src/components/finance/spending-timeline.tsx`
- `src/components/finance/transaction-analytics.tsx`
- `src/components/finance/upcoming-bills.tsx`
- `src/components/shared/ui-helpers.tsx`

## Biblioteca shadcn (48)

- `src/components/ui/accordion.tsx`
- `src/components/ui/alert-dialog.tsx`
- `src/components/ui/alert.tsx`
- `src/components/ui/aspect-ratio.tsx`
- `src/components/ui/avatar.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/breadcrumb.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/calendar.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/carousel.tsx`
- `src/components/ui/chart.tsx`
- `src/components/ui/checkbox.tsx`
- `src/components/ui/collapsible.tsx`
- `src/components/ui/command.tsx`
- `src/components/ui/context-menu.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/drawer.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/form.tsx`
- `src/components/ui/hover-card.tsx`
- `src/components/ui/input-otp.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/label.tsx`
- `src/components/ui/menubar.tsx`
- `src/components/ui/navigation-menu.tsx`
- `src/components/ui/pagination.tsx`
- `src/components/ui/popover.tsx`
- `src/components/ui/progress.tsx`
- `src/components/ui/radio-group.tsx`
- `src/components/ui/resizable.tsx`
- `src/components/ui/scroll-area.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/separator.tsx`
- `src/components/ui/sheet.tsx`
- `src/components/ui/sidebar.tsx`
- `src/components/ui/skeleton.tsx`
- `src/components/ui/slider.tsx`
- `src/components/ui/sonner.tsx`
- `src/components/ui/switch.tsx`
- `src/components/ui/table.tsx`
- `src/components/ui/tabs.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/toast.tsx`
- `src/components/ui/toaster.tsx`
- `src/components/ui/toggle-group.tsx`
- `src/components/ui/toggle.tsx`
- `src/components/ui/tooltip.tsx`

## Fixtures de teste (14)

- `src/components/finance/dashboard-view.test.tsx`
- `src/components/finance/quiet-accounts-cards.test.tsx`
- `src/components/finance/quiet-analysis-calendar.test.tsx`
- `src/components/finance/quiet-consortiums-savings.test.tsx`
- `src/components/finance/quiet-core-residuals.test.tsx`
- `src/components/finance/quiet-goals-health.test.tsx`
- `src/components/finance/quiet-insights-flow.test.tsx`
- `src/components/finance/quiet-investment-mutations.test.tsx`
- `src/components/finance/quiet-investments-installments.test.tsx`
- `src/components/finance/quiet-navigation.test.tsx`
- `src/components/finance/quiet-purchases-categories.test.tsx`
- `src/components/finance/quiet-recurring-receipts.test.tsx`
- `src/components/finance/quiet-transversal.test.tsx`
- `src/components/shared/ui-helpers.test.tsx`

## Exemplo (1)

- `examples/websocket/frontend.tsx`
