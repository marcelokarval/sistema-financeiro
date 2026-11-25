# Retrospective: corrigir-transacoes-calculos-criticos-api

Relatório baseado estritamente em evidências observadas na entrega da Onda 1 e na validação final integrada pós-Onda 2.

## Evidence

- Candidate and explicit base/HEAD: `da0eb7bbf0763ecbb37fa5b83b4d7e201672c945b0816cd38e096132aa0c4f29` sobre base `418e6f0396f2fd0973a170dac8c5f2dd243c3f16` e HEAD `d7b634b5fcc7e3d13d2a8a8c4e8e330be1fccabf` (Commit 1).
- Commands and observed results: todas as suítes das Tasks `1.1` a `2.2` aprovadas em SQLite isolado (`mkdtempSync`); `bun --no-env-file run check` (`exit 0`, `533` aprovados em 57 arquivos após Onda 2); `bun --no-env-file run test:sqlite` (`54` aprovados em 6 execuções `bwrap`); `DATABASE_URL="file:/tmp/ci-build-inert.db" bun --no-env-file run build` (`41/41` páginas estáticas); `bridge_guard.py verify` (`{"status": "ok"}`).
- Reviewer and candidate: `verifier-apply-6` em `#260` (Fase 1 PASS) e `#277` (Fase 2 PASS) sobre o digest `da0eb7bbf0763ecbb37fa5b83b4d7e201672c945b0816cd38e096132aa0c4f29`.
- Tasks completed and unresolved risks: `8/8` tarefas concluídas sem desvios abertos; `timeline`, `advisor` e `transactions` receberam endurecimentos complementares na Onda 2 (`endurecer-api-datas-calculos-e-schema`) mantendo intactas as garantias transacionais e o isolamento de `TRANSFER`.

## Wins, misses and plan deviations

- **Wins:** Atomicidade com `db.$transaction` e guardas TOCTOU (`updateMany` condicional) nas rotas de mutação financeira (`transfer`, `transactions`, `consortiums/installments`, `recurring/process`, `installments/pay`, `investments/transactions`), além da correção matemática de `quick-stats` e `networth` com testes de concorrência (`Promise.all`).
- **Misses / deviations:** Nenhum desvio de contrato; na Onda 2, `transactions`, `timeline` e `advisor` foram estendidos de forma compatível com os testes desta change.

## Capability and execution mode

| Capability | Actual native name | Mode | Status | Evidence / reason |
|---|---|---|---|---|
| Planning | `writing-plans` | subagent | used | Plano `plan.md` aprovado e validado por `bridge_guard.py planning` |
| TDD | `test-driven-development` | subagent | used | Ciclo RED/GREEN em SQLite isolado para todas as 8 tarefas |
| Review | `verifier-apply-6` | independent | used | Revisão independente zero-write registrada em `#260` (Fase 1) e `#277` (Fase 2) |
| Workspace / finishing | `verification-before-completion` | existing workspace | used | Checks finais em `#256` e `#274` com `db/custom.db` intocado |

## Surprises and follow-up

- `db/custom.db` permaneceu intocado durante toda a execução para futura rodada do wizard de instalação / sincronização explícita pelo operador.
- Operações de `git commit`, `git push`, `openspec sync`, `openspec archive` e criação de PR aguardam autorização humana explícita.
