## Why

O repositório público `sistema-financeiro` ainda mantém `db/custom.db` (`204.800` bytes) rastreado no Git (apesar do `.gitignore`) e acumula 486 arquivos legados de scaffolding Z.ai, worklogs de CRs antigas, capturas órfãs e documentos substituídos em `examples/`, `agent-ctx/`, `docs/`, `download/` e `worklog.md`, além de resíduos locais em `.tmp/`, `dev.log` e `.playwright-cli/`. Higienizar o índice e a árvore agora elimina ruído histórico e risco de exposição da base local mantendo o ambiente de desenvolvimento funcional.

## What Changes

**Destrackeamento de `db/custom.db` sem remoção do disco**
- From: `db/custom.db` rastreado em `.git/index` (`git ls-files db/` retorna `db/custom.db`), contrariando `.gitignore`.
- To: `db/custom.db` removido apenas do índice Git (`git rm --cached db/custom.db`), permanecendo intacto no disco local (`204.800` bytes).
- Reason: impedir versionamento e exposição pública da base local sem quebrar o ambiente local existente.
- Impact: non-breaking; CI, `test:sqlite` e empacotamento não dependem de `db/custom.db`.

**Remoção de 486 arquivos legados rastreados e resíduos locais**
- From: 486 arquivos legados rastreados em `examples/` (379), `agent-ctx/` (6), `docs/helm/` (8), `docs/prompts/` (2), `docs/research/` (4), documentos históricos na raiz de `docs/` (4), arquivos pré-Quiet em `docs/reference/` (5), `worklog.md` (1) e histórico de `download/` (77), além de `.tmp/`, `dev.log` e `.playwright-cli/`.
- To: todos os 486 arquivos removidos via `git rm -f`, diretórios vazios e resíduos locais removidos, preservando `download/README.md`, os 10 PNGs `download/qa-quiet-*.png`, os 4 ativos vigentes de `docs/reference/`, `docs/operacao-empacotamento.md`, `.env`, `bun.lock` e `node_modules/`.
- Reason: manter apenas ativos vigentes, código, testes, OpenSpec e capturas oficiais no repositório público.
- Impact: non-breaking; `candidate-manifest.json` lista 485 caminhos com `"state": "absent"` (excluindo apenas o binário `examples/skills/ppt/scripts/tectonic` de `10.747.904` bytes devido ao limite de `4 MiB` do `safe_read` no `preflight`, mas ainda removido em `git rm -f` e verificado à parte) e reconcilia a spec `automacao-ci-e-governanca`.

## Capabilities

### New Capabilities
- Nenhuma nova capability isolada; a higiene da árvore é incorporada como requisito na capability existente `automacao-ci-e-governanca`.

### Modified Capabilities
- `automacao-ci-e-governanca`: atualiza o cenário de `AGENTS.md` em `OpenSpec Governance Default and Active Documentation Reconciliation` (ruleset `main-ci-protection` já ativo e ausência de referências a `agent-ctx/`, `worklog.md`, `docs/helm`, `docs/prompts` e `docs/research`) e adiciona o requisito `Public Repository Tree Hygiene Without Legacy Scaffolding`.

## Impact

- Índice Git e árvore de trabalho: `db/custom.db` (somente `--cached`), 486 arquivos rastreados listados em `candidate-manifest.json`, diretórios vazios (`examples`, `agent-ctx`, `docs/helm`, `docs/prompts`, `docs/research`, `download/archive`) e resíduos locais (`.tmp`, `dev.log`, `.playwright-cli`).
- Exclusões preservadas intactas: `db/custom.db` no disco (`204.800` bytes), `.env`, `bun.lock`, `node_modules/`, `download/README.md`, os 10 `download/qa-quiet-*.png`, os 4 ativos vigentes de `docs/reference/`, `docs/operacao-empacotamento.md` e os arquivos sob responsabilidade da change paralela `orientar-documentacao-e-ambiente-publico`.
