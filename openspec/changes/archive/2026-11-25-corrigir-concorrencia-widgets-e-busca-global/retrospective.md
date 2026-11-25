# Retrospective: corrigir-concorrencia-widgets-e-busca-global

Relatório baseado estritamente em evidências observadas na entrega da Onda 1 Frontend, nos runners `.qa.mjs` (`#256`) e na bateria final integrada (`#274`).

## Evidence

- Candidate and explicit base/HEAD: `dc81af57ae33b61bf565bfbbf8420ee5cbf3aa8d3c46d4718e499183514ce293` sobre base `418e6f0396f2fd0973a170dac8c5f2dd243c3f16` e HEAD `d7b634b5fcc7e3d13d2a8a8c4e8e330be1fccabf` (Commit 1).
- Commands and observed results: todas as suítes das Tasks `1.1` a `1.5` aprovadas; `bun --no-env-file run arch:check` (`77 arquivos; 6 ocorrências em 6 identidades; 34 avisos; 0 erros`); `bun --no-env-file run check` (`exit 0`, `533` aprovados em 57 arquivos em `#274`); `build` isolado (`41/41` páginas estáticas); 4 runners `.qa.mjs` em `systemd-run --user` + `bwrap` (`54`, `102`, `48` e `60` cenários com `0` omissões em `#256`, sem alterações em `src/components/finance/**` desde `#256`); `bridge_guard.py verify` (`{"status": "ok"}`).
- Reviewer and candidate: `verifier-apply-6` em `#260` (Fase 1 PASS) e `#277` (Fase 2 PASS) sobre o digest `dc81af57ae33b61bf565bfbbf8420ee5cbf3aa8d3c46d4718e499183514ce293`.
- Tasks completed and unresolved risks: `6/6` tarefas concluídas preservando `.zscripts/frontend-architecture-baseline.json` e `src/components/ui/**` intocados.

## Wins, misses and plan deviations

- **Wins:** Concorrência assíncrona com `AbortController` + identidade de requisição nos 6 widgets analíticos/dívidas/relatórios, Busca Global completa para os 8 domínios da Alternativa A com exibição neutra de `TRANSFER`, parse seguro de erros HTTP em `monthly-budget-tracker` e `accounts-view` e eliminação de zero enganoso nos dividendos de `investments-view`.
- **Misses / deviations:** Nenhum desvio de escopo; paridade visual e de DOM confirmada pelas 6 células (`360`/`390`/`1440` × `light`/`dark`) dos runners `.qa.mjs`.

## Capability and execution mode

| Capability | Actual native name | Mode | Status | Evidence / reason |
|---|---|---|---|---|
| Planning | `writing-plans` | subagent | used | Plano `plan.md` aprovado e validado por `bridge_guard.py planning` |
| TDD | `test-driven-development` | subagent | used | Ciclo RED/GREEN aplicado nas Tasks 1.1 a 1.5 |
| Review | `verifier-apply-6` | independent | used | Revisão independente zero-write registrada em `#260` (Fase 1) e `#277` (Fase 2) |
| Workspace / finishing | `verification-before-completion` | existing workspace | used | Checks finais em `#256` e `#274` com baseline AST e `db/custom.db` intocados |

## Surprises and follow-up

- `db/custom.db` permaneceu intocado durante toda a execução para futura rodada do wizard de instalação / sincronização explícita pelo operador.
- Operações de `git commit`, `git push`, `openspec sync`, `openspec archive` e criação de PR aguardam autorização humana explícita.
