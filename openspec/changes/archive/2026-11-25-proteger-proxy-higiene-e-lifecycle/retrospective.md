# Retrospective: proteger-proxy-higiene-e-lifecycle

Relatório baseado estritamente em evidências observadas na entrega da Onda 1 e na validação final integrada pós-Onda 2.

## Evidence

- Candidate and explicit base/HEAD: `0c3f0e80686aed64cc0bb076adf338e5a47123e5f784913b563893cf58b5e520` sobre base `418e6f0396f2fd0973a170dac8c5f2dd243c3f16` e HEAD `d7b634b5fcc7e3d13d2a8a8c4e8e330be1fccabf` (Commit 1).
- Commands and observed results: `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` (`48` aprovados, `0` reprovações, `334` asserções); `bun --no-env-file run check` (`exit 0`, `test:scripts` `66` aprovados); `bun --no-env-file run test:sqlite` (`54` aprovados em 6 execuções `bwrap`); `DATABASE_URL="file:/tmp/ci-build-inert.db" bun --no-env-file run build` (`41/41` páginas estáticas); `bridge_guard.py verify` (`{"status": "ok"}`).
- Reviewer and candidate: `verifier-apply-6` em `#260` (Fase 1 PASS) e `#277` (Fase 2 PASS) sobre o digest `0c3f0e80686aed64cc0bb076adf338e5a47123e5f784913b563893cf58b5e520`.
- Tasks completed and unresolved risks: `6/6` tarefas (`1.1`, `1.2`, `1.3`, `2.1`, `2.2`, `3.1`) concluídas sem desvios abertos; `caddy` não está instalado no host local, deixando `caddy validate` dependente do ambiente alvo de empacotamento.

## Wins, misses and plan deviations

- **Wins:** Eliminação completa de port-pivoting no `Caddyfile` (`XTransformPort=3004`), pré-validação de `caddy` e propagação correta de sinais/exit code em `.zscripts/start.sh` e `.zscripts/mini-services-start.sh`, remoção dos scripts legados e limpeza do índice Git de `.zscripts/dev.pid` e `skills/` preservando os arquivos locais no disco.
- **Misses / deviations:** `caddy` ausente no host local impediu execução direta de `caddy validate`; validação de `Caddyfile`, `start.sh` e `mini-services-start.sh` foi coberta com testes POSIX/stub dedicados em `.zscripts/tests/packaging.test.ts`.

## Capability and execution mode

| Capability | Actual native name | Mode | Status | Evidence / reason |
|---|---|---|---|---|
| Planning | `writing-plans` | subagent | used | Plano `plan.md` aprovado e validado por `bridge_guard.py planning` |
| TDD | `test-driven-development` | subagent | used | Ciclo RED/GREEN executado nas Tasks 1.1, 1.2 e 1.3 em `.zscripts/tests/packaging.test.ts` |
| Review | `verifier-apply-6` | independent | used | Revisão independente zero-write registrada em `#260` (Fase 1) e `#277` (Fase 2) |
| Workspace / finishing | `verification-before-completion` | existing workspace | used | Checks finais em `#256` e `#274` com `db/custom.db` intocado |

## Surprises and follow-up

- `db/custom.db` permaneceu intocado durante toda a execução para preservar a base local até uma futura rodada do wizard de instalação / sincronização explícita pelo operador.
- Operações de `git commit`, `git push`, `openspec sync`, `openspec archive` e criação de PR aguardam autorização humana explícita.
