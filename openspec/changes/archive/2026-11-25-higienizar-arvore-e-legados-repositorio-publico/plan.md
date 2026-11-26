# Implementation plan

Bridge task contract: 1

**Goal:** Destrackear `db/custom.db` do índice Git preservando o arquivo de `204.800` bytes no disco, e remover os 486 arquivos legados rastreados (mais diretórios vazios e resíduos locais `.tmp`, `dev.log`, `.playwright-cli`) sem tocar em ativos preservados nem nos arquivos da Change 1.
**Architecture:** Execução sequencial em duas tarefas sobre `.git/index`: Task 1.1 executa `git rm --cached db/custom.db` validando a preservação física de `db/custom.db` e o esvaziamento de `git ls-files db/`; Task 1.2 consome essa base limpa para executar `git rm -f` dos 486 caminhos explícitos de `candidate-manifest.json`, remover diretórios vazios remanescentes e limpar `.tmp`, `dev.log` e `.playwright-cli`.
**Skill mapping and observed invocation:** `brainstorming` (`/home/marcelo-karval/.agents/skills/brainstorming/SKILL.md`), `writing-plans` (`/home/marcelo-karval/.agents/skills/writing-plans/SKILL.md`), `executing-plans` (`/home/marcelo-karval/.agents/skills/executing-plans/SKILL.md`) e `test-driven-development` (`/home/marcelo-karval/.agents/skills/test-driven-development/SKILL.md`) lidas integralmente e aplicadas nesta sessão na elaboração de `brainstorm.md`, `proposal.md`, `design.md`, `specs/automacao-ci-e-governanca/spec.md`, `tasks.md` e `plan.md`.

## Task 1.1: Destrackear `db/custom.db` do índice Git preservando o arquivo no disco

- Depends on: none
- Needs: none
- Outcome: `db/custom.db` removido exclusivamente de `.git/index` (`git ls-files db/` vazio), com o arquivo físico `db/custom.db` (`204.800` bytes) preservado intacto no disco local.
- Owner/resolver: `exec-tree-8`; decisões materiais escaladas ao `@coordinator`.
- Inputs: índice Git atual com `db/custom.db` rastreado na base `7c90a219399cad00569c1dca3064cea860c2ba3d` e `.gitignore` listando `db/custom.db`.
- Produces: db-custom-untracked
- Write paths: .git/index
- Exclusions: db/custom.db, README.md, AGENTS.md, docs/reference/design-system.contract.md, .env, .env.example, .gitignore, tsconfig.json, eslint.config.mjs, .zscripts/tests/packaging.test.ts, bun.lock, download/README.md, docs/operacao-empacotamento.md
- Shared resources: git-index
- Acceptance: `git ls-files db/` retorna saída vazia (`0` caminhos) e `stat -c '%s' db/custom.db` retorna `204800` com SHA-256 idêntico ao estado pré-operação.
- Stop: Parar se `db/custom.db` não existir no disco com `204.800` bytes antes ou depois do comando, ou se qualquer comando tentar remover ou alterar o arquivo no disco.
- Resume: Retomar somente após confirmar preservação integral de `db/custom.db` no disco e autorização explícita do `@coordinator`.

Passos detalhados da execução:
1. Pré-condição e RED: registrar SHA-256 e tamanho de `db/custom.db` (`204.800` bytes) e confirmar falha esperada na invariante de higiene (`test -z "$(git ls-files db/)"` falha porque `git ls-files db/` retorna `db/custom.db`).
2. Executar `git rm --cached db/custom.db` sem tocar no sistema de arquivos.
3. GREEN: confirmar `test -z "$(git ls-files db/)"` com exit 0, `stat -c '%s' db/custom.db` igual a `204800` e SHA-256 de `db/custom.db` inalterado.
- RED command and observed failure: `sha256sum db/custom.db && stat -c '%s %n' db/custom.db && git ls-files db/ && test -z "$(git ls-files db/)"` retornou `aa5ea1e9200992b3bd177bbfc6ae472d2f647ebb422443c317463e48ecf41ac8`, `204800 db/custom.db` e `db/custom.db` rastreado (`RED_1_1_EXPECTED_FAILURE: db/custom.db tracked`).
- GREEN command and observed result: `git rm --cached db/custom.db && test -z "$(git ls-files db/)" && stat -c '%s %n' db/custom.db && sha256sum db/custom.db` removeu apenas do índice (`rm 'db/custom.db'`), manteve `git ls-files db/` vazio (`exit 0`) e preservou `204800 db/custom.db` com SHA-256 `aa5ea1e9200992b3bd177bbfc6ae472d2f647ebb422443c317463e48ecf41ac8` (`GREEN_1_1_OK`).
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: aguardando revisão independente de `verifier-pub-8` (digest `candidate` após Task 1.2).
- Remaining gaps: nenhum na implementação (revisão independente e `verify.md`/`retrospective.md` pós-revisão).

## Task 1.2: Remover 486 legados rastreados, diretórios vazios e resíduos locais

- Depends on: 1.1
- Needs: 1.1 => db-custom-untracked
- Outcome: Todos os 486 arquivos legados rastreados (os 485 listados em `candidate-manifest.json` mais `examples/skills/ppt/scripts/tectonic`, omitido do manifesto devido ao limite explícito de `4 MiB` do `safe_read` em `bridge_guard.py` durante o `preflight`) removidos via `git rm -f`, diretórios vazios remanescentes (`examples`, `agent-ctx`, `docs/helm`, `docs/prompts`, `docs/research`, `download/archive`) e resíduos locais (`.tmp`, `dev.log`, `.playwright-cli`) eliminados, preservando `download/README.md`, os 10 PNGs `download/qa-quiet-*.png`, os 4 ativos vigentes de `docs/reference/`, `docs/operacao-empacotamento.md`, `db/custom.db`, `.env`, `bun.lock` e `node_modules/`.
- Owner/resolver: `exec-tree-8`; decisões materiais escaladas ao `@coordinator`.
- Inputs: `openspec/changes/higienizar-arvore-e-legados-repositorio-publico/candidate-manifest.json` (`485` entradas `"absent"`), `examples/skills/ppt/scripts/tectonic` (`10.747.904` bytes > `4 MiB`), árvore local contendo `.tmp`, `dev.log` e `.playwright-cli`.
- Produces: legacy-tree-hygiene-ready
- Write paths: .git/index, examples, agent-ctx, docs/helm, docs/prompts, docs/research, docs/manual-agente-humano.md, docs/analise-360-accelerate.md, docs/plano-helm.md, docs/plano-accelerate-zai.md.bak, docs/reference/design-system.html, docs/reference/design-system.theme.css, docs/reference/design-system.slop-audit.md, docs/reference/design-system.premium-direction.md, docs/reference/design-system.premium-direction.html, worklog.md, download/archive, .tmp, dev.log, .playwright-cli
- Exclusions: db/custom.db, README.md, AGENTS.md, docs/reference/design-system.contract.md, docs/reference/design-system.premium-theme.css, docs/reference/frontend-componentization-coverage.md, docs/reference/frontend-architecture-gate.md, docs/operacao-empacotamento.md, download/README.md, .env, .env.example, .gitignore, tsconfig.json, eslint.config.mjs, .zscripts/tests/packaging.test.ts, bun.lock, node_modules
- Shared resources: git-index
- Acceptance: Todos os 485 caminhos de `candidate-manifest.json` estão ausentes (`bridge_guard.py candidate` retorna `status: ok`), `test ! -e examples/skills/ppt/scripts/tectonic` e `test -z "$(git ls-files examples/)"` passam, os diretórios vazios e `.tmp`, `dev.log`, `.playwright-cli` não existem mais, e `download/README.md`, os 10 PNGs `download/qa-quiet-*.png`, os 4 ativos de `docs/reference/`, `docs/operacao-empacotamento.md`, `db/custom.db` (`204800` bytes) e `.env` permanecem intactos.
- Stop: Parar se a contagem de alvos de remoção diferir de `486` (`485` no manifesto + `1` binário `tectonic`), se qualquer caminho preservado aparecer na lista de remoção ou se algum comando tocar nos arquivos da Change 1.
- Resume: Retomar somente após reconciliar a lista exata de remoção com `candidate-manifest.json` + `tectonic` e confirmar preservação dos ativos obrigatórios.

Passos detalhados da execução:
1. Pré-condição e RED: verificar via script Python que os 486 caminhos (`485` de `candidate-manifest.json` + `examples/skills/ppt/scripts/tectonic`) e os resíduos (`.tmp`, `dev.log`, `.playwright-cli`) ainda existem no repositório (`bridge_guard.py candidate` falha como esperado antes da limpeza).
2. Executar `git rm -f` passando exatamente os 486 caminhos (`485` lidos de `candidate-manifest.json` + `examples/skills/ppt/scripts/tectonic`).
3. Remover os diretórios vazios remanescentes (`examples`, `agent-ctx`, `docs/helm`, `docs/prompts`, `docs/research`, `download/archive`) e executar `rm -rf .tmp dev.log .playwright-cli`.
4. GREEN: confirmar ausência dos 486 caminhos (`test ! -e examples/skills/ppt/scripts/tectonic`, `test -z "$(git ls-files examples/)"`), ausência dos diretórios e resíduos locais, preservação de `download/README.md`, dos 10 PNGs `download/qa-quiet-*.png`, dos 4 ativos de `docs/reference/`, de `docs/operacao-empacotamento.md`, de `db/custom.db` (`204800` bytes) e de `.env`, e executar `bridge_guard.py candidate` (`status: ok`).
- RED command and observed failure: `bridge_guard.py candidate` retornou `{"status": "error", "message": "invalid, missing, incomplete or stale input"}` (`RED_1_2_EXPECTED_FAILURE: candidate_guard_failed_while_legacy_present`) e `ls -ld examples agent-ctx docs/helm docs/prompts docs/research download/archive .tmp dev.log .playwright-cli examples/skills/ppt/scripts/tectonic` confirmou todos presentes no disco (com `examples/skills/ppt/scripts/tectonic` = `10747904` B).
- GREEN command and observed result: `git rm -f` dos `486` caminhos (`485` do manifesto + `examples/skills/ppt/scripts/tectonic`), remoção dos diretórios vazios e `rm -rf .tmp dev.log .playwright-cli` seguidos de `test ! -e examples/skills/ppt/scripts/tectonic && test -z "$(git ls-files examples/)"` (`GREEN_1_2_OK`), `download/` preservado com `README.md` + `10` PNGs `qa-quiet-*.png`, `docs/reference/` preservado com os `4` ativos vigentes, `docs/operacao-empacotamento.md`, `.env`, `bun.lock` e `db/custom.db` (`204800` bytes, SHA-256 `aa5ea1e9200992b3bd177bbfc6ae472d2f647ebb422443c317463e48ecf41ac8`) intactos, e `bridge_guard.py candidate` com `{"status": "ok"}`.
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: aguardando revisão independente de `verifier-pub-8` (digest `candidate` após Task 1.2).
- Remaining gaps: nenhum na implementação (revisão independente e `verify.md`/`retrospective.md` pós-revisão).
