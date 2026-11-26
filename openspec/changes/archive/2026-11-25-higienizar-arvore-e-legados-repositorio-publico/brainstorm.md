# Brainstorm — Higienizar árvore e legados para repositório público

**Skill mapping and observed invocation:**
- `brainstorming` (`/home/marcelo-karval/.agents/skills/brainstorming/SKILL.md`): lida integralmente e aplicada ao desenho da higienização da árvore rastreada, preservação da base local `db/custom.db` e limpeza de resíduos locais.
- `writing-plans` (`/home/marcelo-karval/.agents/skills/writing-plans/SKILL.md`): lida integralmente para estruturar o plano em microcontratos (`Bridge task contract: 1`).

## Contexto e Problema

A auditoria read-only do repositório público `marcelokarval/sistema-financeiro` (base `7c90a219399cad00569c1dca3064cea860c2ba3d`, branch `chore/higiene-documentacao-e-repositorio-publico`) identificou dois problemas estruturais na árvore e no índice Git:

1. **`db/custom.db` rastreado apesar de `.gitignore`:** embora `.gitignore` liste `db/custom.db`, o arquivo binário de `204.800` bytes permanece indexado no Git (`git ls-files db/` retorna `db/custom.db`), expondo a base local de desenvolvimento e contrariando a política do projeto. Entretanto, o arquivo precisa permanecer intacto no disco local para uso do desenvolvedor.
2. **Acúmulo de 486 arquivos legados no Git e resíduos locais ignorados:** a árvore rastreada carrega 486 arquivos de scaffolding antigo do template Z.ai/CRs históricas (`examples/` com 379 arquivos, `agent-ctx/` com 6, `docs/helm/` com 8, `docs/prompts/` com 2, `docs/research/` com 4, 4 documentos/backups históricos na raiz de `docs/`, 5 arquivos pré-Quiet em `docs/reference/`, `worklog.md` e 77 arquivos históricos em `download/`), além de resíduos locais ignorados no disco (`.tmp/`, `dev.log`, `.playwright-cli/`).

## Decisões e Abordagem Acordada

1. **Destrackeamento não destrutivo de `db/custom.db` (Task 1.1):**
   - Executar exclusivamente `git rm --cached db/custom.db`, removendo-o de `.git/index` sem removê-lo do sistema de arquivos.
   - `db/custom.db` NÃO entra em `candidate-manifest.json`, pois permanece presente no disco (`204.800` bytes) enquanto o manifesto de `bridge_guard.py` verifica ausência/presença no filesystem.
2. **Remoção explícita dos 486 legados rastreados + limpeza de diretórios vazios e resíduos locais (Task 1.2):**
   - Gerar `candidate-manifest.json` programaticamente via `git ls-files` contendo exatamente os 486 caminhos com `"state": "absent"`.
   - Executar `git rm -f` sobre os 486 caminhos e remover diretórios vazios remanescentes (`examples`, `agent-ctx`, `docs/helm`, `docs/prompts`, `docs/research`, `download/archive`) e resíduos locais (`.tmp`, `dev.log`, `.playwright-cli`).
   - Preservar integralmente `db/custom.db`, `.env`, `bun.lock`, `node_modules/`, `download/README.md`, os 10 PNGs `download/qa-quiet-*.png`, os 4 ativos vigentes de `docs/reference/` e `docs/operacao-empacotamento.md`.
   - Não editar arquivos pertencentes à frente paralela (`orientar-documentacao-e-ambiente-publico`).
3. **Reconciliação normativa em `specs/automacao-ci-e-governanca/spec.md`:**
   - Atualizar o segundo cenário de `OpenSpec Governance Default and Active Documentation Reconciliation` para refletir `AGENTS.md` com o ruleset `main-ci-protection` já ativo e sem referências a `agent-ctx/`, `worklog.md`, `docs/helm`, `docs/prompts` ou `docs/research`.
   - Adicionar `Public Repository Tree Hygiene Without Legacy Scaffolding` formalizando a remoção dos legados e a preservação dos ativos vigentes.
