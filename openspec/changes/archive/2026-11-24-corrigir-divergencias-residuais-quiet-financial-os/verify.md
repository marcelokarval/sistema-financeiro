# Relatório de Verificação — corrigir-divergencias-residuais-quiet-financial-os

## Candidate

944f45347ea85e432eb88a88039769ef20ed3894041913ab8fd9ff4fc7b2329a

## Mandatory checks

- [x] structural
- [x] tests
- [x] review

## Overall Decision

- [x] PASS

## Resumo de Evidências

- **Commit 1 (`main`):** `842223348705d087b2e6d9e3031a04a3d33237f4` (base `80f1f406443f235f4659aad2ff0ded8f20f3c6bc`).
- **Estrutural (AST / TypeScript / Lint):**
  - `bun --no-env-file .zscripts/check-frontend-architecture.ts --baseline-ref 25b44535c5068b99044afa03f7ecf318e7a9726f` → saída `0` (`77 arquivos; 6 ocorrências em 6 identidades; 34 avisos; 0 erros`).
  - `./node_modules/.bin/tsc --noEmit` → saída `0` (`0` erros).
  - `./node_modules/.bin/eslint .` → saída `0` (`0` erros).
- **Testes unitários e de contrato (`bun --no-env-file test`):**
  - Suíte completa (`task-237.log` em `systemd-run --user` + `bwrap`): saída `0` (`388` aprovados, `41` suítes SQLite opt-in não ativadas neste comando, `0` reprovações, `2664` asserções em `32` arquivos).
  - Focados por tarefa: `quiet-analysis-calendar.test.tsx` (`19` aprovados, `0` reprovações), `quiet-goals-health.test.tsx` (`26` aprovados, `0` reprovações), `quiet-accounts-cards.test.tsx` (`29` aprovados, `0` reprovações), `quiet-consortiums-savings.test.tsx` (`55` aprovados, `0` reprovações), `quiet-navigation.test.tsx` (`12` aprovados, `0` reprovações).
- **Runners `.qa.mjs` nas 6 células (`360/390/1440 × light/dark`, `systemd-run --user` + `bwrap`, `0` ignorados e `0` divergências Quiet abertas):**
  - `quiet-goals-widgets.qa.mjs` (`task-237.log`): saída `0` (`60` cenários pareados; `0` ignorados).
  - `quiet-keyed-deletion-focus.qa.mjs` (`task-158.log`): saída `0` (`78` cenários verificados; `0` ignorados; `0` divergências Quiet abertas).
  - `quiet-cards-purchases-categories.qa.mjs` (`task-237.log`): saída `0` (`120` cenários verificados; `0` ignorados; `0` divergências Quiet abertas).
  - `quiet-consortiums-editor.qa.mjs` (`task-237.log`): saída `0` (`108` cenários pareados; `0` ignorados).
  - `quiet-installments-savings-dialogs.qa.mjs` (`task-158.log`): saída `0` (`54` cenários pareados; `0` ignorados).
  - `quiet-search-parity.qa.mjs` (`task-158.log`): saída `0` (`102` cenários pareados; `0` ignorados).
  - `quiet-componentization.qa.mjs` (`task-59.log`): saída `0` (`54` cenários nas 6 células; `0` ignorados).
- **Revisão independente:** `verifier-3` emitiu `PASS` na Fase 1 (`#203`) e na Fase 2 (`#205`).
- **Higiene:** `systemctl --user list-units 'finance-qa-*' --all` vazio (`0` unidades carregadas).
