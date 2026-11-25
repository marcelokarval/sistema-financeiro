# Retrospective: endurecer-api-datas-calculos-e-schema

Relatório baseado estritamente em evidências observadas na execução da Onda 2 (Sub-ondas 2A, 2B, 2C), no QA integrado (`#274`) e na revisão independente (`#277`).

## Evidence

- Candidate and explicit base/HEAD: `ad3e21844706904a8a1c3e6839cd3f2840eb0215aa49b5e993edb0b88849d717` sobre base `418e6f0396f2fd0973a170dac8c5f2dd243c3f16` e HEAD `d7b634b5fcc7e3d13d2a8a8c4e8e330be1fccabf` (Commit 1).
- Commands and observed results: `api-validation.test.ts` (`28` aprovados em `America/Bahia` e `UTC`), `config.test.ts` (`3` aprovados), frente `2.1`/`2.2`/`2.3` (`19` aprovados em `America/Bahia` e `UTC`), frente `3.1`/`3.2` (`26` aprovados), Task `3.3` (`43` aprovados), Task `4.1` (`3` aprovados em `America/Bahia`), Task `4.2` (`6` aprovados), Task `5.1` (`prisma validate`, `db:generate`, DDL descartável em `/tmp` com `20` índices e `3` FKs `ON DELETE SET NULL`), `bun --no-env-file run check` (`exit 0`, `533` aprovados em 57 arquivos + `66` em `test:scripts`), `TZ=America/Bahia` nas 5 suítes de data civil (`42` aprovados, `0` reprovações), `bun --no-env-file run test:sqlite` (`54` aprovados, `0` reprovações em 6 execuções `bwrap`) e `DATABASE_URL="file:/tmp/ci-build-inert.db" bun --no-env-file run build` (`41/41` páginas estáticas); `bridge_guard.py verify` (`{"status": "ok"}`).
- Reviewer and candidate: `verifier-apply-6` em `#277` (Fase 2 PASS) sobre o digest `ad3e21844706904a8a1c3e6839cd3f2840eb0215aa49b5e993edb0b88849d717`.
- Tasks completed and unresolved risks: `11/11` tarefas concluídas preservando os contratos testados de `purchases/route-integrity`, `consortiums/assembly`, `installments/route`, `savings/route` e `advisor`.

## Wins, misses and plan deviations

- **Wins:** Centralização de parsing JSON/Prisma/datas civis em `src/lib/api-validation.ts`, execução sequenciada em Onda 2 sem colisão com a Onda 1 (`transactions`, `timeline`, `advisor`), atomicidade de `savings/deposit`, proteção CSV/`advisor`/`finance-ws` e indexação completa do `prisma/schema.prisma` validada em SQLite descartável em `/tmp` + `test:sqlite`.
- **Misses / deviations:** Nenhum desvio de escopo ou regressão; os testes combinados por frente na Sub-onda 2B foram registrados fielmente como executados em conjunto para as frentes `2.1`–`2.3` e `3.1`–`3.2`.

## Capability and execution mode

| Capability | Actual native name | Mode | Status | Evidence / reason |
|---|---|---|---|---|
| Planning | `writing-plans` | subagent | used | Plano `plan.md` validado por `bridge_guard.py planning` |
| TDD | `test-driven-development` | subagent | used | Ciclo RED/GREEN estrito nas Tasks 1.1 a 4.3 e RED/GREEN estrutural na Task 5.1 |
| Review | `verifier-apply-6` | independent | used | Revisão independente zero-write registrada em `#277` (Fase 2) |
| Workspace / finishing | `verification-before-completion` | existing workspace | used | Bateria final `#274` com `db/custom.db` e `bun.lock` intocados |

## Surprises and follow-up

- `db/custom.db` permaneceu intocado durante toda a execução para futura rodada do wizard de instalação / sincronização explícita (`bun run db:push`) pelo operador.
- Operações de `git commit`, `git push`, `openspec sync`, `openspec archive` e criação de PR aguardam autorização humana explícita.
