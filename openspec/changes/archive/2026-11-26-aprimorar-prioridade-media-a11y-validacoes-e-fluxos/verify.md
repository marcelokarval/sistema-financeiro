## Candidate

543425150f5e5797761a3afe41f0327236bf08dbc3018553e7e42fc5c2e510fe

## Mandatory checks

- [x] structural
- [x] tests
- [x] review

## Overall Decision

- [x] PASS

## Summary

- **Commit 3 SHA:** `1cb61a4a946b66e9febc1207df5deb85569397ca` (branch `feat/refinamento-ux-22-pontos`, base `42304688df05d53d79ce2431606f18bcd23ed819`, 72 caminhos modificados/criados estritamente contidos nos 81 paths do `candidate-manifest.json`, zero alterações em `src/components/ui/**` e zero arquivos de `openspec/`).
- **Structural (`bun --no-env-file run check`):** `tsc --noEmit` com 0 erros, `eslint .` com 0 erros (18 avisos pré-existentes), `arch:check` limpo (`79 arquivos; 6 ocorrências em 6 identidades; 25 avisos; 0 erros`), `bun test` (`642` aprovados, `41` opt-in SQLite, `0` falhas em `65` arquivos, incluindo `src/lib/search-normalize.test.ts` e `quiet-investment-mutations.test.tsx` após `#464`/`#465`) e `test:scripts` (`72` aprovados, `0` falhas em `2` arquivos) (`#467`, `#475`, `#477`).
- **SQLite & Build (`bwrap`):** `bun --no-env-file run test:sqlite` aprovado nas 6 suítes isoladas (`14+14+4+6+12+10 = 60` aprovados, `0` falhas) e `next build` isolado em `bwrap` (`--tmpfs /workspace/.next`, `DATABASE_URL="file:/tmp/ci-build-p2.db"`) compilado com sucesso (`41` páginas, saída `0`) (`#467`, `#475`).
- **Playwright QA (`bwrap` + `CI=1`, `0` desvios/saltos):** todos os 15 runners `src/components/finance/*.qa.mjs` aprovados em sandbox isolado (`quiet-i18n` 18 combinações, `quiet-accounts-cards` 30, `quiet-cards-purchases-categories` 120, `quiet-analytics-calendar` 48, `quiet-consortiums-editor` 108, `quiet-componentization` 54, `quiet-account-transaction-focus` 96, `quiet-investments-editor` 45, `quiet-keyed-deletion-focus` 78, `quiet-recurring-focus` 42, `quiet-finance-dialog-shell` 55, `quiet-primary-operations` 42, `quiet-search-parity` 102, `quiet-installments-savings-dialogs` 54, `quiet-goals-widgets` 60) (`#467`–`#475`).
- **Playwright ao vivo (`http://127.0.0.1:3000/`, sessão somente-GET em `#477`):**
  - `#7`: header mobile em `390x844` (`pt`/`es`/`en`) com `headerHeight=71px`, `overflowX=false`, 7 botões alinhados em `top=28` e `aria-label` preservado;
  - `#8`: todos os diálogos afetados (inclusive `global-search.tsx` e os 3 de `accounts-view.tsx`) com `showCloseButton={false}` e botão fechar localizado (`Fechar formulário` / `Cerrar formulario` / `Close form`);
  - `#9`: `normalizeSearchText` NFD único em `src/lib/search-normalize.ts` consumido por `global-search.tsx` e `purchases-view.tsx`;
  - `#10`: clique externo fecha `NotificationPanel` (`true->false`), clique no backdrop fecha `<dialog>` de `AIAdvisor` (`true->false`) e erros de transporte exibem `errors.connectFailed`;
  - `#11`: calendário marca dias vazios com `aria-disabled="true"` e bloqueia seleção (`33` desabilitados, `2` habilitados ao vivo);
  - `#12`: `GET /api/dashboard?from=2000-01-01&to=2026-11-30` retornou `monthIncome=59330`, `monthExpense=25698.2` e `monthlyTrend` aparado para `13` meses (`2025-11`..`2026-11`), preservando séries `<= 12` meses;
  - `#13`: `MonthlyBudgetTracker` restaura foco via `onCloseAutoFocus` mantendo `defaultCloseAutoFocus` inerte em `MonthlyBudgetEditor`;
  - `#14`: `AccountsView` renderiza `TRANSFER` com tom neutro (`detail.transferType`), campo `notes` no editor e trava de `TRANSFER` durante edição;
  - `#15`: `SavingsGoalRow` oculta `Depositar` no menu quando `isComplete`;
  - `#16`: validações client-side e propagação de `data?.error` em Cartões, Compras, Categorias, Consórcios e Parcelas;
  - `#17`: alvos `min-h-11`/`size-11` com zero botões abaixo de `44px` em `390x844` (`below44: []` em Contas, Cartões, Parcelas e Consórcios);
  - `#18`: filtros Todas/Pendentes/Pagas e salto à próxima pendente (`hasJumpBtn: true` ao vivo) em `ConsortiumDetail` e `InstallmentEntries` preservando ordem `1..N` e guardas `A/B`.
- **Contagem de linhas e integridade:** `app-header.tsx` (`171`), `monthly-budget-tracker.tsx` (`364`), `global-search.tsx` (`490`), `cards-view.tsx` (`477`), `purchases-view.tsx` (`438`), `categories-view.tsx` (`460`) — todos `<= 500`; `19` namespaces JSON com paridade `pt`/`es`/`en`; `:3000` HTTP `200`; `db/custom.db` intacto (`sha256sum aa5ea1e9200992b3bd177bbfc6ae472d2f647ebb422443c317463e48ecf41ac8`).
- **Independent Review:** aprovado por `verifier-p2-13` (`#477` PASS) sobre o candidato pré-commit `96278df64c966ef312dab62cc8c718923810805b552011cc8d421c95b5d52744`, com os exatos 72 arquivos commitados intactos em `1cb61a4a946b66e9febc1207df5deb85569397ca`.
