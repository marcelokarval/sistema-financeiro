# Retrospective: implantar-ci-minimo-gates-e-docs-ativos

Relatório baseado estritamente em evidências observadas na entrega da Onda 1 e na validação final integrada pós-Onda 2.

## Evidence

- Candidate and explicit base/HEAD: `64e8e5c70f5e454705d9fd080a2cc9a9da9e5a8337bda525ec3503766c4b29a7` sobre base `418e6f0396f2fd0973a170dac8c5f2dd243c3f16` e HEAD `d7b634b5fcc7e3d13d2a8a8c4e8e330be1fccabf` (Commit 1).
- Commands and observed results: `bun --no-env-file run test:sqlite` (`54` aprovados, `0` reprovações em 6 execuções `bwrap`, em `#256` e `#274`); `bun --no-env-file run check` (`exit 0`, `typecheck` `0`, `eslint` `0` erros, `arch:check` `34` avisos / `0` erros, `test` `533` aprovados, `test:scripts` `66` aprovados); `DATABASE_URL="file:/tmp/ci-build-inert.db" bun --no-env-file run build` (`41/41` páginas estáticas); validação YAML de `.github/workflows/ci.yml`; `bridge_guard.py verify` (`{"status": "ok"}`).
- Reviewer and candidate: `verifier-apply-6` em `#260` (Fase 1 PASS) e `#277` (Fase 2 PASS) sobre o digest `64e8e5c70f5e454705d9fd080a2cc9a9da9e5a8337bda525ec3503766c4b29a7`.
- Tasks completed and unresolved risks: `4/4` tarefas concluídas sem desvios bloqueantes; nota menor observada em `#260` sobre tabela histórica em `docs/reference/frontend-componentization-coverage.md:60` versus Seção 6.2 (`:188`); execução real no GitHub Actions e ruleset da `main` dependem de push/PR autorizado.

## Wins, misses and plan deviations

- **Wins:** Isolamento real das 5 suítes opt-in SQLite via `bwrap` + `tmpfs` sem ler `.env*` nem tocar `db/custom.db`, remoção de `ignoreBuildErrors`, ativação de regras ESLint críticas, scripts canônicos em `package.json`, workflow mínimo de CI e reconciliação documental completa.
- **Misses / deviations:** Nenhum desvio estrutural; execução em GitHub Actions e configuração do ruleset permanecem como etapas externas pós-push.

## Capability and execution mode

| Capability | Actual native name | Mode | Status | Evidence / reason |
|---|---|---|---|---|
| Planning | `writing-plans` | subagent | used | Plano `plan.md` aprovado e validado por `bridge_guard.py planning` |
| Documentation | `project-documentation` | subagent | used | Reconciliação de `openspec/config.yaml`, `AGENTS.md`, `download/README.md` e `docs/reference/` |
| Review | `verifier-apply-6` | independent | used | Revisão independente zero-write registrada em `#260` (Fase 1) e `#277` (Fase 2) |
| Workspace / finishing | `verification-before-completion` | existing workspace | used | Checks finais em `#256` e `#274` com `bun.lock` e `db/custom.db` intocados |

## Surprises and follow-up

- `db/custom.db` permaneceu intocado durante toda a execução para futura rodada do wizard de instalação / sincronização explícita pelo operador.
- Operações de `git commit`, `git push`, `openspec sync`, `openspec archive`, execução do CI remoto e criação de PR/ruleset aguardam autorização humana explícita.
