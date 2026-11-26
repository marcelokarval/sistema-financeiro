# Implementation plan

Bridge task contract: 1

**Goal:** Higienizar `.env.example`, `.env.local`, `.gitignore`, `tsconfig.json` e `eslint.config.mjs`, criar o `README.md` raiz em pt-BR para `marcelokarval/sistema-financeiro`, reescrever `AGENTS.md` enxuto alinhado ao repositório real e remover os 3 links quebrados de `docs/reference/design-system.contract.md`, com cobertura TDD em `.zscripts/tests/packaging.test.ts`.
**Architecture:** A execução ocorre em duas tarefas sequenciais (`1.1` -> `1.2`) porque ambas acrescentam suítes em `.zscripts/tests/packaging.test.ts`. A Task `1.1` trata ambiente e configurações de toolchain sem tocar em `.env` ou `db/custom.db` nem operar `.git/index`; a Task `1.2` trata `README.md`, `AGENTS.md` e `docs/reference/design-system.contract.md`, validando tanto `packaging.test.ts` quanto `quiet-navigation.test.tsx`.
**Skill mapping and observed invocation:** `brainstorming` (`/home/marcelo-karval/.agents/skills/brainstorming/SKILL.md`), `writing-plans` (`/home/marcelo-karval/.agents/skills/writing-plans/SKILL.md`), `project-documentation` (`/home/marcelo-karval/.agents/skills/project-documentation/SKILL.md`) e `test-driven-development` (`/home/marcelo-karval/.agents/skills/test-driven-development/SKILL.md`) lidas integralmente e aplicadas nesta sessão na preparação dos artefatos OpenSpec e na condução `RED -> GREEN`.

## Task 1.1: Higiene de `.env.example`, `.env.local`, `.gitignore`, `tsconfig.json` e `eslint.config.mjs`

- Depends on: none
- Needs: none
- Outcome: `.zscripts/tests/packaging.test.ts` valida e passa para `.env.example` igual a `DATABASE_URL="file:../db/custom.db"` sem `GITHUB_TOKEN`, `.env.local` ausente do repositório com `.env` preservado intacto no disco, `.gitignore` contendo `.env.*`, `!.env.example` e `.playwright-cli/`, e `tsconfig.json` (`exclude`) / `eslint.config.mjs` (`ignores`) livres de `"examples"`, `"examples/**"` e `"skills"`.
- Owner/resolver: `exec-docs-env-8`; decisões materiais fora do escopo escaladas ao `@coordinator`.
- Inputs: `.env.example`, `.gitignore`, `tsconfig.json`, `eslint.config.mjs`, `.zscripts/tests/packaging.test.ts`, `openspec/changes/orientar-documentacao-e-ambiente-publico/specs/empacotamento-sem-dados/spec.md`.
- Produces: env-and-config-hygiene-ready
- Write paths: .zscripts/tests/packaging.test.ts, .env.example, .env.local, .gitignore, tsconfig.json, eslint.config.mjs
- Exclusions: .env, db/custom.db, docs/operacao-empacotamento.md, LICENSE
- Shared resources: test:packaging-suite
- Acceptance: `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` passa após a implementação dos ajustes, `.env` permanece intacto no disco, `.env.local` não existe no disco e nenhum comando `git add`/`git rm`/`git commit` foi executado.
- Stop: Parar se qualquer alteração ameaçar `.env` ou `db/custom.db` no disco, ou se o contrato de `.zscripts/build.sh` entrar em conflito com os novos arquivos.
- Resume: Retomar após confirmar preservação de `.env` e `db/custom.db` no disco ou resolução explícita do `@coordinator`.

Passos detalhados da execução:
1. RED: adicionar testes em `.zscripts/tests/packaging.test.ts` verificando: (a) `.env.example` com `DATABASE_URL="file:../db/custom.db"` e sem `GITHUB_TOKEN`, e `.env.local` ausente; (b) `.gitignore` contendo as linhas `.env.*`, `!.env.example` e `.playwright-cli/`; (c) `tsconfig.json` (`exclude`) e `eslint.config.mjs` (`ignores`) sem `"examples"`, `"examples/**"` nem `"skills"`. Rodar `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` e registrar a falha esperada.
2. GREEN: atualizar `.env.example` para `DATABASE_URL="file:../db/custom.db"`, remover `.env.local` (`rm -f .env.local` preservando `.env`), atualizar `.gitignore` para incluir `.env.*`, `!.env.example` e `.playwright-cli/`, e remover `"examples"`/`"skills"` de `tsconfig.json` e `"examples/**"`/`"skills"` de `eslint.config.mjs`.
3. Reexecutar `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` e confirmar todos os testes verdes.
- RED command and observed failure: `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` falhou como esperado nos 3 novos testes (`48 pass, 3 fail`, exit 1): `.env.example` ainda retornava `DATABASE_URL="file:./db/custom.db"`, `.gitignore` não continha `.env.*` e `tsconfig.json#exclude` ainda continha `"examples"`.
- GREEN command and observed result: `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` passou integralmente (`51 pass, 0 fail, 347 expect() calls`, exit 0), com `.env.local` removido (`rm -f .env.local`) e `.env` preservado intacto no disco.
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: A preencher após revisão independente sobre o candidato desta change.
- Remaining gaps: Revisão independente pendente após geração do digest `candidate`.

## Task 1.2: `README.md` raiz, `AGENTS.md` enxuto e links de `docs/reference/design-system.contract.md`

- Depends on: 1.1
- Needs: 1.1 => env-and-config-hygiene-ready
- Outcome: `.zscripts/tests/packaging.test.ts` exige e valida `README.md` raiz (citando `bun --no-env-file run db:generate` e `docs/operacao-empacotamento.md`) e `AGENTS.md` livre de `Framer Motion`, `agent-ctx/` e `worklog.md`; `README.md` raiz em pt-BR para `marcelokarval/sistema-financeiro` criado (sem `LICENSE`); `AGENTS.md` reescrito de forma enxuta e fiel ao repositório atual (incluindo ruleset ativo `main-ci-protection` `id: 28102433`); e linhas 3 e 7 de `docs/reference/design-system.contract.md` sem os 3 links quebrados, mantendo `quiet-navigation.test.tsx` verde.
- Owner/resolver: `exec-docs-env-8`; decisões materiais fora do escopo escaladas ao `@coordinator`.
- Inputs: `package.json`, `prisma/schema.prisma`, `prisma/seed.ts`, `src/lib/store.ts`, `src/components/finance/sidebar.tsx`, `src/app/api/advisor/route.ts`, `mini-services/finance-ws/package.json`, `.github/workflows/ci.yml`, `Caddyfile`, `docs/operacao-empacotamento.md`, `docs/reference/design-system.contract.md`, `src/components/finance/quiet-navigation.test.tsx`, `AGENTS.md`, `.zscripts/tests/packaging.test.ts`.
- Produces: public-docs-and-agents-ready
- Write paths: .zscripts/tests/packaging.test.ts, README.md, AGENTS.md, docs/reference/design-system.contract.md
- Exclusions: .env, db/custom.db, docs/operacao-empacotamento.md, LICENSE
- Shared resources: test:packaging-suite
- Acceptance: `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` e `bun --no-env-file test ./src/components/finance/quiet-navigation.test.tsx` passam integralmente, todos os links relativos adicionados/mantidos apontam para destinos válidos no repositório (exceto os removidos das linhas 3 e 7 de `design-system.contract.md`), `README.md` não cita `marcelo-karval`, `LICENSE` não é criado e nenhum comando Git mutante é executado.
- Stop: Parar se qualquer frase testada por `quiet-navigation.test.tsx:304-311` ou link ativo em `docs/reference/design-system.contract.md` for quebrado, ou se houver divergência factual não resolvida sobre scripts/dependências.
- Resume: Retomar após reconciliar o texto com os contratos testados e evidências reais do repositório.

Passos detalhados da execução:
1. RED: adicionar teste em `.zscripts/tests/packaging.test.ts` exigindo existência de `README.md` raiz (contendo `marcelokarval/sistema-financeiro`, `bun --no-env-file run db:generate` e `docs/operacao-empacotamento.md`) e ausência de `Framer Motion`, `agent-ctx/` e `worklog.md` em `AGENTS.md`. Rodar `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` e registrar a falha esperada.
2. GREEN:
   - Criar `README.md` raiz em pt-BR para `marcelokarval/sistema-financeiro` com visão geral do FinanceApp, 9 visões da SPA, stack real (citando Socket.io em `mini-services/finance-ws/` e nota transparente de `z-ai-web-dev-sdk` no `/api/advisor`), pré-requisitos (Bun `1.4.2`, Node `>= 20.9.0`, `bubblewrap` opcional no Linux), setup passo a passo (`cp .env.example .env`, `bun install`, `bun --no-env-file run db:generate`, `bun run db:push`, execução opcional de `prisma/seed.ts`, `bun run dev` e `mini-services/finance-ws`), tabela de scripts de `package.json`, CI no GitHub Actions, e links relativos para `docs/operacao-empacotamento.md`, `docs/reference/design-system.contract.md`, `AGENTS.md` e `openspec/specs/`.
   - Reescrever `AGENTS.md` enxuto refletindo a árvore real (`src/`, `prisma/`, `mini-services/finance-ws/`, `.zscripts/`, `docs/`, `download/`, `openspec/`, `.github/workflows/ci.yml`, `Caddyfile`), convenções Quiet Financial OS (`cn()`, veto a `framer-motion`), fluxo OpenSpec (`superpowers-bridge`), comandos com `bun --no-env-file run db:generate` pré-typecheck, e status do ruleset leve `main-ci-protection` (`id: 28102433`) ativo na `main` em `marcelokarval/sistema-financeiro`.
   - Atualizar apenas as linhas 3 e 7 de `docs/reference/design-system.contract.md` removendo os 3 links Markdown quebrados para `design-system.premium-direction.md`, `design-system.theme.css` e `design-system.html`, preservando intactos os demais links e todas as frases testadas em `quiet-navigation.test.tsx`.
3. Validar executando `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` e `bun --no-env-file test ./src/components/finance/quiet-navigation.test.tsx`.
- RED command and observed failure: `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` falhou como esperado nos 3 novos testes (`51 pass, 3 fail`, exit 1): `README.md` ausente na raiz, `AGENTS.md` ainda continha referências legadas e `docs/reference/design-system.contract.md` ainda apontava para `design-system.premium-direction.md`, `design-system.theme.css` e `design-system.html`.
- GREEN command and observed result: `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` (`54 pass, 0 fail, 365 expect() calls`, exit 0), `bun --no-env-file test ./src/components/finance/quiet-navigation.test.tsx` (`14 pass, 0 fail, 115 expect() calls`, exit 0) e validação de links relativos em `README.md`, `AGENTS.md` e `docs/reference/design-system.contract.md` (`ALL_RELATIVE_LINKS_OK`, exit 0).
- Typed evidence outcomes: RED expected_failure; GREEN passed.
- Review candidate identity and reviewer: A preencher após revisão independente sobre o candidato desta change.
- Remaining gaps: Revisão independente pendente após geração do digest `candidate`.
