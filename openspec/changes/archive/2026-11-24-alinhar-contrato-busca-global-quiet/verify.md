# Relatório de Verificação — alinhar-contrato-busca-global-quiet

## Candidate

e2698a7ffdd63115845ca87fdcb3b97e9bdd415527724f5a898b642c68c611c5

## Mandatory checks

- [x] structural
- [x] tests
- [x] review

## Overall Decision

- [x] PASS

## Resumo de Evidências

- **Decisão de produto (Q1):** **Alternativa A** confirmada pelo responsável de produto em `design.md`, ratificando abertura/expansão direta quando o ID existir (`Contas`, `Transações` com `accountId` válido, `Cartões`, `Compras`, `Investimentos`, `Parcelas`, `Consórcios`), `Categorias` apenas navegando ao destino, limpeza segura para ID inexistente e retorno de foco no `Escape` ao controle de origem conectado ou `Abrir busca global`.
- **Commit 1 (`main`):** `842223348705d087b2e6d9e3031a04a3d33237f4` (base `80f1f406443f235f4659aad2ff0ded8f20f3c6bc`).
- **Estrutural (AST / TypeScript / Lint):**
  - `bun --no-env-file .zscripts/check-frontend-architecture.ts --baseline-ref 25b44535c5068b99044afa03f7ecf318e7a9726f` → saída `0` (`77 arquivos; 6 ocorrências em 6 identidades; 34 avisos; 0 erros`).
  - `./node_modules/.bin/tsc --noEmit` → saída `0` (`0` erros).
  - `./node_modules/.bin/eslint .` → saída `0` (`0` erros).
- **Testes unitários e navegador:**
  - `bun --no-env-file test src/components/finance/quiet-navigation.test.tsx` → saída `0` (`12` aprovados, `0` reprovações, `75` asserções).
  - `bun --no-env-file test` (`task-237.log`) → saída `0` (`388` aprovados, `41` suítes SQLite opt-in não ativadas neste comando, `0` reprovações, `2664` asserções em `32` arquivos).
  - `quiet-search-parity.qa.mjs` (`task-158.log` em `systemd-run --user` + `bwrap`): saída `0` (`102` cenários pareados nas 6 células `360/390/1440 × light/dark`; `cellParity: true` em todas; `0` ignorados).
- **Revisão independente:** `verifier-3` emitiu `PASS` na Fase 1 (`#203`) e na Fase 2 (`#205`).
- **Higiene:** `systemctl --user list-units 'finance-qa-*' --all` vazio (`0` unidades carregadas).
