## Why

O repositório não possui pipeline de CI, o build ignora erros TypeScript (`ignoreBuildErrors: true`), o ESLint silencia regras críticas, as 5 suítes SQLite permanecem puladas no `bun test` padrão e há links/contagens defasados na documentação e no `openspec/config.yaml`. Implantar CI mínimo e gates reais agora fecha essas lacunas sem colidir com `db/custom.db` ou empacotamento.

## What Changes

**Workflow mínimo de CI e runner SQLite opt-in**
- From: ausência de `.github/workflows/ci.yml` e 5 suítes SQLite (`41` testes) puladas sem runner automatizado.
- To: 1 job em `.github/workflows/ci.yml` (`ubuntu-latest`, Bun `1.4.2`) rodando `install`, `typecheck`, `lint`, `arch:check`, `test`, `test:scripts`, `test:sqlite` e `build` (sem `.qa.mjs`), apoiado por `.zscripts/test-sqlite.sh` com `mktemp -d`, `bwrap` (`tmpfs` em `/tmp` e `/scratch`) e `prisma db push --force-reset --skip-generate`.
- Reason: garantir validação automatizada contínua sem expor `.env` nem tocar em `db/custom.db`.
- Impact: non-breaking; Playwright `.qa.mjs` permanece fora do CI padrão.

**Gates estáticos e scripts canônicos em `package.json`**
- From: `ignoreBuildErrors: true` em `next.config.ts`, regras críticas desligadas em `eslint.config.mjs`, scripts obsoletos `db:migrate`/`db:reset` e ausência de `test:scripts`, `arch:check`, `test:sqlite` e `check`.
- To: remoção de `ignoreBuildErrors`, ativação de `no-debugger`/`no-unreachable`/`no-redeclare` (`error`) e `react-hooks/exhaustive-deps`/`@typescript-eslint/no-unused-vars` (`warn`, com `argsIgnorePattern: "^_"`), ignore de `openspec/**` e `download/**`, e scripts canônicos preservando `dependencies` e `bun.lock`.
- Reason: impedir regressões silenciosas de tipagem, lint e arquitetura com zero erros no código atual.
- Impact: non-breaking; `src/` já passa com 0 erros nas novas regras.

**Governança OpenSpec e reconciliação documental**
- From: `openspec/config.yaml` em `spec-driven`, 3 links quebrados pós-archive, contagem de `33 avisos` em `docs/reference/frontend-componentization-coverage.md` e exemplo com `framer-motion` em `AGENTS.md`.
- To: `schema: superpowers-bridge`, links apontando para `archive/2026-11-23-recriar-interface-quiet-financial-os/...`, contagem reconciliada para `34 avisos` (`balance-projection.tsx` com 503 linhas) e `AGENTS.md` sem `framer-motion` e com nota de ruleset na `main` pós-primeiro CI verde.
- Reason: manter documentação ativa e governança alinhadas ao estado real do repositório.
- Impact: non-breaking; `docs/operacao-empacotamento.md` e `db/custom.db` permanecem inalterados.

## Capabilities

### New Capabilities
- `automacao-ci-e-governanca`: pipeline mínimo de CI, runner isolado para suítes SQLite opt-in, gates estáticos de TypeScript/ESLint/arquitetura, scripts canônicos em `package.json`, schema default do OpenSpec e reconciliação documental ativa.

### Modified Capabilities
Nenhuma capability existente em `openspec/specs/` tem seus requisitos alterados.

## Impact

- Automação e configuração: `.github/workflows/ci.yml`, `.zscripts/test-sqlite.sh`, `next.config.ts`, `eslint.config.mjs`, `package.json`, `openspec/config.yaml`.
- Documentação ativa: `download/README.md`, `docs/reference/design-system.contract.md`, `docs/reference/frontend-componentization-coverage.md`, `AGENTS.md`.
- Exclusões garantidas: `db/custom.db`, `docs/operacao-empacotamento.md`, `bun.lock`, dependências de runtime e suítes `.qa.mjs` de Playwright no CI padrão.
