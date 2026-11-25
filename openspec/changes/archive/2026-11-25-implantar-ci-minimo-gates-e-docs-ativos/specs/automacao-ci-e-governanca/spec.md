## ADDED Requirements

### Requirement: Minimal GitHub Actions CI Workflow
The repository SHALL provide a single-job GitHub Actions CI workflow in `.github/workflows/ci.yml` targeting `ubuntu-latest` with Bun `1.4.2` that executes `bun install --frozen-lockfile`, `bun --no-env-file run typecheck`, `bun --no-env-file run lint`, `bun --no-env-file run arch:check`, `bun --no-env-file test`, `bun --no-env-file run test:scripts`, `bun --no-env-file run test:sqlite`, and `bun --no-env-file run build` without invoking Playwright `.qa.mjs` suites or relying on `db/custom.db`.

#### Scenario: CI workflow validates code, scripts, isolated SQLite suites, and production build
- **WHEN** a push to `main` or a pull request triggers `.github/workflows/ci.yml`
- **THEN** the single `ubuntu-latest` job installs dependencies with `--frozen-lockfile`, runs typecheck, lint, AST architecture gate, unit tests, `.zscripts` script tests, isolated SQLite opt-in tests under `$RUNNER_TEMP`, and Next.js production build with an inert `DATABASE_URL`, failing on any non-zero exit code without running `.qa.mjs` browser suites

### Requirement: Isolated Opt-In SQLite Test Runner
The project SHALL provide an executable `.zscripts/test-sqlite.sh` runner that provisions disposable temporary SQLite fixtures inside a `mktemp -d` staging environment and `bwrap` `tmpfs` isolation (without `.env`, `prisma/.env`, or `db/custom.db`), initializes the Prisma schema via `prisma db push --force-reset --skip-generate` where pre-provisioning is required, and runs all 5 opt-in SQLite test suites with zero skipped cases.

#### Scenario: Running all 5 opt-in SQLite suites without touching development state
- **WHEN** a developer or CI executes `bun --no-env-file run test:sqlite`
- **THEN** `.zscripts/test-sqlite.sh` runs `src/lib/purchase-date.test.ts` (`CALENDAR_D3_SQLITE=1` in both `TZ=UTC` and `TZ=America/Bahia`), `src/app/api/installments/route.test.ts` (`INSTALLMENTS_D2_SQLITE=1`), `src/app/api/purchases/route-integrity.test.ts` (absent target file on tmpfs `/scratch`), `src/app/api/consortiums/assembly.test.ts`, and `src/app/api/savings/route.test.ts` inside isolated `tmpfs` mounts with `0` skips and leaves `db/custom.db` and `.env*` untouched

#### Scenario: Missing sandbox prerequisite fails fast
- **WHEN** `.zscripts/test-sqlite.sh` is invoked in an environment where `bwrap` is unavailable or unprivileged user namespaces are blocked
- **THEN** the script MUST exit non-zero with a clear diagnostic instead of falling back to `db/custom.db` or skipping suites

### Requirement: Strict Static TypeScript and ESLint Gates
`next.config.ts` MUST NOT ignore TypeScript errors during build, and `eslint.config.mjs` MUST enforce critical rules while ignoring OpenSpec and QA archive directories.

#### Scenario: Build fails on TypeScript errors and lint enforces critical rules
- **WHEN** `bun --no-env-file run build` or `bun --no-env-file run lint` runs after removing `ignoreBuildErrors: true` from `next.config.ts` and configuring `eslint.config.mjs` (`no-debugger`, `no-unreachable`, `no-redeclare` as `"error"`, `react-hooks/exhaustive-deps` and `@typescript-eslint/no-unused-vars` with `argsIgnorePattern: "^_"` as `"warn"`, ignoring `openspec/**` and `download/**`)
- **THEN** Next.js build runs full TypeScript type checking and ESLint reports `0` errors across `src/`, `.zscripts/`, and `mini-services/`

### Requirement: Canonical Package Scripts Without Broken Migration Aliases
`package.json` MUST expose canonical verification scripts while removing inapplicable migration aliases and keeping `dependencies`, `devDependencies`, and `bun.lock` unchanged.

#### Scenario: Canonical scripts execute project gates without broken migration aliases
- **WHEN** inspecting or invoking `package.json` scripts (`test:scripts`, `arch:check`, `test:sqlite`, `check`)
- **THEN** `db:migrate` and `db:reset` are absent, `dependencies` and `bun.lock` remain unchanged, and `bun --no-env-file run check` chains `typecheck`, `lint`, `arch:check`, `test`, and `test:scripts`

### Requirement: OpenSpec Governance Default and Active Documentation Reconciliation
`openspec/config.yaml` SHALL configure `schema: superpowers-bridge`, and active documentation (`download/README.md`, `docs/reference/design-system.contract.md`, `docs/reference/frontend-componentization-coverage.md`, and `AGENTS.md`) SHALL resolve archived links, report accurate AST warning counts (`34 avisos`), remove banned `framer-motion` import guidance, and document the post-green-CI `main` branch ruleset while keeping `db/custom.db` and `docs/operacao-empacotamento.md` untouched.

#### Scenario: Broken archive links and AST warning counts are reconciled
- **WHEN** checking links and counts in `download/README.md`, `docs/reference/design-system.contract.md`, and `docs/reference/frontend-componentization-coverage.md`
- **THEN** all 3 links resolve to `openspec/changes/archive/2026-11-23-recriar-interface-quiet-financial-os/...` and the AST section reports `34 avisos` reflecting `balance-projection.tsx` (`503` linhas)

#### Scenario: AGENTS.md reflects Quiet conventions and post-CI GitHub governance
- **WHEN** an agent reads `AGENTS.md` and `openspec/config.yaml`
- **THEN** `openspec/config.yaml` declares `schema: superpowers-bridge`, `AGENTS.md` line 93 omits `framer-motion` and documents that the lightweight ruleset on `main` is applied after the first green CI run, and `docs/operacao-empacotamento.md` remains unmodified
