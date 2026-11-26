## MODIFIED Requirements

### Requirement: OpenSpec Governance Default and Active Documentation Reconciliation
`openspec/config.yaml` SHALL configure `schema: superpowers-bridge`, and active documentation (`download/README.md`, `docs/reference/design-system.contract.md`, `docs/reference/frontend-componentization-coverage.md`, and `AGENTS.md`) SHALL resolve archived links, report accurate AST warning counts (`34 avisos`), remove banned `framer-motion` import guidance, and document the active `main-ci-protection` branch ruleset while keeping `db/custom.db` and `docs/operacao-empacotamento.md` untouched.

#### Scenario: Broken archive links and AST warning counts are reconciled
- **WHEN** checking links and counts in `download/README.md`, `docs/reference/design-system.contract.md`, and `docs/reference/frontend-componentization-coverage.md`
- **THEN** all 3 links resolve to `openspec/changes/archive/2026-11-23-recriar-interface-quiet-financial-os/...` and the AST section reports `34 avisos` reflecting `balance-projection.tsx` (`503` linhas)

#### Scenario: AGENTS.md reflects Quiet conventions and post-CI GitHub governance
- **WHEN** an agent reads `AGENTS.md` and `openspec/config.yaml`
- **THEN** `openspec/config.yaml` declares `schema: superpowers-bridge`, `AGENTS.md` omits `framer-motion` and references to `agent-ctx/`, `worklog.md`, `docs/helm`, `docs/prompts`, and `docs/research`, documents that the `main-ci-protection` ruleset on `main` is already active, and `docs/operacao-empacotamento.md` remains unmodified

## ADDED Requirements

### Requirement: Public Repository Tree Hygiene Without Legacy Scaffolding
The public repository MUST remove legacy scaffolding, superseded docs, historical `download/` artifacts, local scratch residues, and Git tracking of `db/custom.db`, while preserving `db/custom.db` intact on local disk, `download/README.md`, the 10 `download/qa-quiet-*.png` screenshots, the 4 active `docs/reference/` assets, and `docs/operacao-empacotamento.md`.

#### Scenario: Local SQLite database is untracked without deleting the local file
- **WHEN** checking Git index and local filesystem state for `db/custom.db`
- **THEN** `git ls-files db/` returns empty while `db/custom.db` remains intact on local disk (`204800` bytes)

#### Scenario: Legacy directories and artifacts are removed while active assets remain intact
- **WHEN** inspecting the repository tree after legacy cleanup
- **THEN** `examples/`, `agent-ctx/`, `worklog.md`, `docs/helm/`, `docs/prompts/`, `docs/research/`, legacy root docs (`docs/manual-agente-humano.md`, `docs/analise-360-accelerate.md`, `docs/plano-helm.md`, `docs/plano-accelerate-zai.md.bak`), superseded `docs/reference/` files (`design-system.html`, `design-system.theme.css`, `design-system.slop-audit.md`, `design-system.premium-direction.md`, `design-system.premium-direction.html`), non-Quiet files in `download/`, and local residues (`.tmp/`, `dev.log`, `.playwright-cli/`) are absent, while `download/README.md`, all 10 `download/qa-quiet-*.png` screenshots, `docs/operacao-empacotamento.md`, and the 4 active `docs/reference/` files (`design-system.premium-theme.css`, `design-system.contract.md`, `frontend-componentization-coverage.md`, `frontend-architecture-gate.md`) remain intact
