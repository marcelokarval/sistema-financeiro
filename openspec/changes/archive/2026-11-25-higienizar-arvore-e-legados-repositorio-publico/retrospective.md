# Retrospective: higienizar-arvore-e-legados-repositorio-publico

Relatório baseado estritamente nas evidências observadas durante a execução da Change 2 (`#298`) e nas revisões independentes (`#301` e `#305`).

## Evidence

- Candidate and explicit base/HEAD: `0090d945f6e11911b765dba6cd69a60360aba8645a8d72fab50320846342f371` sobre base `7c90a219399cad00569c1dca3064cea860c2ba3d` e HEAD / Commit 1 `09006f49806ac3c1a4268feced17a08d5070723d` (branch `chore/higiene-documentacao-e-repositorio-publico`, reconciliado a partir de `e9ad8fd5c0c127190ce34417ba32bed82c5b918fce88bcdf221b3e99c300856f`).
- Commands and observed results:
  - `bridge_guard.py planning`: `{"status": "ok"}`
  - `bridge_guard.py preflight`: `{"status": "ok", "candidate": "bada3b1e0a7b997f326c138a668dcab87e94f139815931ed3017eeb5a162ef6b"}`
  - `bridge_guard.py candidate`: `{"status": "ok", "candidate": "0090d945f6e11911b765dba6cd69a60360aba8645a8d72fab50320846342f371"}`
  - `openspec validate --all --strict --no-interactive`: `8 passed, 0 failed` (`#305`)
  - `bun --no-env-file run check`: PASS (`tsc --noEmit` 0 erros, `eslint .` 0 erros / 18 warnings pré-existentes, `arch:check` PASS, `bun --no-env-file test` 533 aprovados / 41 skip opt-in em 57 arquivos, `test:scripts` 72 aprovados em 2 arquivos, em `#301`)
  - `bun --no-env-file run test:sqlite`: PASS (`54` aprovados em 6 execuções `bwrap`, em `#301`)
  - `DATABASE_URL="file:/tmp/ci-build-inert.db" bun --no-env-file run build && rm -rf .next /tmp/ci-build-inert.db*`: PASS (`exit 0`, em `#301`)
  - Integridade e índice: `git diff --cached --name-only | wc -l` = `487` pré-commit consolidados no Commit 1 `09006f49806ac3c1a4268feced17a08d5070723d`; `git ls-files db/` e `git ls-files examples/` vazios; `db/custom.db` intacto (`204800` B, SHA-256 `aa5ea1e9200992b3bd177bbfc6ae472d2f647ebb422443c317463e48ecf41ac8`); `download/` com `11` arquivos (`README.md` + `10` PNGs `qa-quiet-*.png`); `docs/reference/` com `4` ativos vigentes.
- Reviewer and candidate: `verifier-pub-8` (`#301`) e `verifier-pub-8-r2` (`#305`), ambos com veredito `PASS` sobre `e9ad8fd5c0c127190ce34417ba32bed82c5b918fce88bcdf221b3e99c300856f`, reconciliado após Commit 1 `09006f49806ac3c1a4268feced17a08d5070723d` para `0090d945f6e11911b765dba6cd69a60360aba8645a8d72fab50320846342f371`.
- Tasks completed and unresolved risks: `2/2` tarefas concluídas (`1.1` e `1.2`) sem desvios bloqueantes.

## Wins, misses and plan deviations

- **Wins:** Diagnóstico precoce do limite de `4 MiB` em `bridge_guard.py:51,212` durante `preflight` sobre `examples/skills/ppt/scripts/tectonic` (`10.747.904` B), resolvido com aprovação do coordenador (`#297`) sem contornar o guard; destrackeamento não destrutivo de `db/custom.db` (`204.800` B intacto); remoção limpa de `486` arquivos legados e resíduos locais sem colidir com a Change 1 paralela.
- **Misses / deviations:** `examples/skills/ppt/scripts/tectonic` foi omitido de `candidate-manifest.json` (`485` entradas) para viabilizar `preflight`, sendo explicitamente removido em `git rm -f` e validado via `test ! -e examples/skills/ppt/scripts/tectonic` e `git ls-files examples/` vazio.

## Capability and execution mode

| Capability | Actual native name | Mode | Status | Evidence / reason |
|---|---|---|---|---|
| Brainstorming | `brainstorming` | subagent | used | Desenho de `brainstorm.md` e `design.md` |
| Planning | `writing-plans` | subagent | used | `plan.md` validado por `bridge_guard.py planning` |
| Execution | `executing-plans` + `test-driven-development` | subagent | used | Execução sequencial RED → GREEN das Tasks `1.1` e `1.2` |
| Review | `verifier-pub-8` / `verifier-pub-8-r2` | independent | used | Revisão independente zero-write em `#301` e `#305` |

## Surprises and follow-up

- `bridge_guard.py` lê arquivos com `state: "absent"` via `safe_read` durante `preflight` quando ainda estão presentes no disco, aplicando o teto de `4 MiB` por arquivo.
- Operações de `git commit`, `git push`, `openspec sync` e `openspec archive` permanecem aguardando autorização explícita.
