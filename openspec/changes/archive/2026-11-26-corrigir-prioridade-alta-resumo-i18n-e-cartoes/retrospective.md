# Retrospective — `corrigir-prioridade-alta-resumo-i18n-e-cartoes`

## O que funcionou bem
- O particionamento da Wave 1 em três frentes disjuntas (`1.1` infraestrutura/navegação/i18n/vencimentos/recibos, `1.2` 22 módulos de Metas e Análises, `1.3` recorrências e cartões `DEBIT`) evitou conflitos de escrita antes da integração única na Task `2.1` (`page.tsx`, `dashboard-view.tsx`, suítes unitárias e `.qa.mjs`).
- Propagar `showValues = true` opcional via prop e conectar `useAppStore` apenas nos pontos de entrada (`DashboardWithWidgets` e `DashboardView`/`DashboardContent`) preservou os harnesses `renderToStaticMarkup` (`withPtIntlDispatcher` / `runWithReactHarness`) sem `useSyncExternalStore` interno nem desmontar `.recharts-wrapper`.
- A atualização otimista imediata via `AppLocaleSwitchContext` + `useTransition()` em `AppIntlProvider` e `LanguageSwitcher`, combinada à inclusão de `locale` nos `useEffect` sem alterar as URLs literais `/api/...`, manteve o contrato de cookies `NEXT_LOCALE` e todos os testes `.qa.mjs`.

## Pontos de atenção e lições aprendidas
- A auditoria independente ao vivo (`#444`) identificou vazamento de valores reais em `ChallengeRow` (`savings-challenge.tsx`) e `AchievementRow` (`achievement-badges.tsx`) que testes unitários com strings sintéticas sem `R$`/`%` não haviam capturado; incluir strings realistas interpoladas em `quiet-goals-health.test.tsx` (`#451`) fechou a lacuna antes da aprovação final em R2 (`#453`).
- A extração e compactação de helpers manteve todos os 7 arquivos monitorados abaixo do teto de `500` linhas (`cards-view.tsx` `476`, `recurring-transactions.tsx` `478`, `transaction-analysis-tabs.tsx` `472`, `balance-projection.tsx` `469`, `debt-sections.tsx` `452`, `networth-evolution.tsx` `436`, `receipt-generator.tsx` `392`) e preservou as 6 identidades aprovadas do baseline AST (`arch:check`).
