## Context

Na base `7c90a219399cad00569c1dca3064cea860c2ba3d` da branch `chore/higiene-documentacao-e-repositorio-publico`, o repositório opera em paralelo duas frentes independentes: a Change 1 (`orientar-documentacao-e-ambiente-publico`), responsável por `README.md`, `AGENTS.md`, `docs/reference/design-system.contract.md`, `.env*`, `.gitignore`, `tsconfig.json`, `eslint.config.mjs` e `.zscripts/tests/packaging.test.ts`; e esta Change 2 (`higienizar-arvore-e-legados-repositorio-publico`), detentora exclusiva das alterações em `.git/index` e da remoção dos arquivos legados e resíduos locais.

## Goals / Non-Goals

**Goals:**
- Remover `db/custom.db` do índice Git (`git rm --cached db/custom.db`) mantendo o arquivo de `204.800` bytes intacto no disco.
- Remover do Git e do disco os exatamente 486 arquivos legados listados em `candidate-manifest.json` (`"state": "absent"`), bem como diretórios vazios resultantes e os resíduos locais ignorados (`.tmp`, `dev.log`, `.playwright-cli`).
- Preservar `download/README.md`, os 10 PNGs `download/qa-quiet-*.png`, os 4 ativos vigentes de `docs/reference/`, `docs/operacao-empacotamento.md`, `.env`, `bun.lock` e `node_modules/`.
- Reconciliar `openspec/specs/automacao-ci-e-governanca/spec.md` por meio do delta em `specs/automacao-ci-e-governanca/spec.md`.

**Non-Goals:**
- Reescrever histórico Git (`git filter-repo` / `BFG`) ou executar `git commit` / `git push` nesta etapa.
- Modificar qualquer arquivo atribuído à Change 1 (`README.md`, `AGENTS.md`, `docs/reference/design-system.contract.md`, `.env*`, `.gitignore`, `tsconfig.json`, `eslint.config.mjs`, `.zscripts/tests/packaging.test.ts`).
- Listar `db/custom.db` em `candidate-manifest.json`, visto que o arquivo permanece presente no disco local.

## Decisions

### D1: Separação entre índice Git (`db/custom.db`) e manifesto de ausência (`candidate-manifest.json`)
- **Escolha:** executar `git rm --cached db/custom.db` na Task 1.1 e verificar `git ls-files db/` vazio junto da preservação física (`204.800` bytes) no disco, sem incluir `db/custom.db` em `candidate-manifest.json`.
- **Razão:** `bridge_guard.py candidate` valida que cada entrada `"state": "absent"` de `candidate-manifest.json` não exista no disco; listar `db/custom.db` como `"absent"` violaria a regra de preservação no disco, e listá-lo como `"present"` vincularia dados locais ao digest do candidato.
- **Alternativa rejeitada:** remover `db/custom.db` do disco ou incluí-lo no manifesto — causaria perda da base de desenvolvimento ou erro estrutural no guard.

### D2: Geração programática do manifesto dos legados a partir de `git ls-files` e limite de `4 MiB` do `bridge_guard.py`
- **Escolha:** construir `candidate-manifest.json` em Python diretamente sobre `git ls-files`, filtrando os 9 grupos (`examples/**` 379, `agent-ctx/**` 6, `docs/helm/**` 8, `docs/prompts/**` 2, `docs/research/**` 4, 4 arquivos legados na raiz de `docs/`, 5 arquivos pré-Quiet em `docs/reference/`, `worklog.md` 1, e 77 arquivos legados em `download/`, totalizando 486 alvos de remoção), e excluir apenas `examples/skills/ppt/scripts/tectonic` (`10.747.904` bytes) do `candidate-manifest.json` (`485` entradas) mantendo sua remoção via `git rm -f` e validação explícita (`test ! -e examples/skills/ppt/scripts/tectonic` e `git ls-files examples/` vazio).
- **Razão:** `bridge_guard.py:51,212` chama `safe_read` durante `preflight` para qualquer entrada existente no disco com limite estrito de `4 MiB` (`4.194.304` bytes), rejeitando `tectonic` antes da remoção; excluí-lo do manifesto preserva o fluxo `preflight -> candidate -> verify` sem contornar o guard, enquanto a remoção integral dos 486 arquivos continua obrigatória na Task 1.2.
- **Alternativa rejeitada:** seleção manual por globs no shell ou bypass do `preflight` — quebraria a rastreabilidade do manifesto ou o fluxo do guard.

### D3: Limpeza de diretórios vazios e resíduos locais ignorados após `git rm -f`
- **Escolha:** após `git rm -f` dos 486 caminhos, remover diretórios vazios remanescentes (`examples`, `agent-ctx`, `docs/helm`, `docs/prompts`, `docs/research`, `download/archive`) e executar `rm -rf .tmp dev.log .playwright-cli`.
- **Razão:** `git rm -f` remove arquivos rastreados, mas pode deixar subdiretórios vazios ou arquivos/pastas não rastreados que poluem a árvore local.
- **Alternativa rejeitada:** `git clean -fdx`, que apagaria `db/custom.db`, `.env`, `node_modules/` e artefatos da change paralela.

## Risks / Trade-offs

- [Risk] `git rm` concorrente ou alteração em arquivo da Change 1 causar colisão de trabalho paralelo → Mitigation: esta change é a única autorizada a operar `.git/index` e restringe todas as remoções aos 486 caminhos explícitos do manifesto + `db/custom.db` (`--cached`) + `.tmp`/`dev.log`/`.playwright-cli`.
- [Risk] Remoção de arquivos em `docs/reference/` deixar referências em `docs/reference/design-system.contract.md` → Mitigation: a reconciliação das linhas 3 e 7 de `design-system.contract.md` é executada na Change 1 (`exec-docs-env-8`), enquanto os 4 ativos consumidos por código e testes (`design-system.premium-theme.css`, `design-system.contract.md`, `frontend-componentization-coverage.md`, `frontend-architecture-gate.md`) e `docs/operacao-empacotamento.md` permanecem intactos.

## Migration Plan

1. Task 1.1: validar pré-condição RED (`git ls-files db/` retorna `db/custom.db`), rodar `git rm --cached db/custom.db` e confirmar GREEN (`git ls-files db/` vazio e `db/custom.db` intacto no disco com `204.800` bytes).
2. Task 1.2: validar pré-condição RED (486 arquivos presentes no índice/disco e resíduos `.tmp`/`dev.log`/`.playwright-cli` presentes), executar `git rm -f` sobre os 486 caminhos, limpar diretórios vazios e remover `.tmp`, `dev.log` e `.playwright-cli`, e confirmar GREEN (0 arquivos restantes dos 486, diretórios vazios e resíduos ausentes, e todos os arquivos preservados intactos).

## Open Questions

Nenhuma decisão em aberto; todos os conjuntos de arquivos e contagens foram verificados diretamente via `git ls-files` sobre a base `7c90a219399cad00569c1dca3064cea860c2ba3d`.
