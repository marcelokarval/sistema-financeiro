## Context

O projeto utiliza Bun `1.4.2`, Next.js `16.1.1`, Prisma `6.11.1` (SQLite sem diretório `prisma/migrations/`) e OpenSpec com schema `superpowers-bridge` v2. Atualmente não existe workflow em `.github/workflows/`, `next.config.ts` suprime erros TypeScript durante o `next build` (`ignoreBuildErrors: true`), `eslint.config.mjs` desabilita regras básicas de segurança estática, `package.json` ainda expõe `db:migrate`/`db:reset` inaplicáveis, e os `41` testes de banco das 5 suítes opt-in SQLite ficam pulados na suíte padrão. Em paralelo, mudanças das Ondas 1 e 2 atuam sobre proxy/empacotamento (`docs/operacao-empacotamento.md`) e rotas de API (`src/app/api/**`), exigindo isolamento estrito de escrita.

## Goals / Non-Goals

**Goals:**
- Disponibilizar workflow mínimo de CI (`.github/workflows/ci.yml`) com 1 job `ubuntu-latest` executando todos os checks unitários, estáticos, de scripts, SQLite isolados e `build`.
- Criar `.zscripts/test-sqlite.sh` executável para rodar as 5 suítes opt-in SQLite (`41` testes pulados no `bun test` padrão) com 0 skips e sem tocar em `db/custom.db` nem expor `.env`.
- Ativar validação estrita de tipos no `next build` (`next.config.ts`), regras críticas de ESLint sem falsos bloqueios (`eslint.config.mjs`) e scripts canônicos em `package.json` (`test:scripts`, `arch:check`, `test:sqlite`, `check`).
- Alinhar `openspec/config.yaml` (`superpowers-bridge`) e corrigir os 3 links quebrados pós-archive, a contagem de avisos AST (`34 avisos`) e as orientações de `AGENTS.md`.

**Non-Goals:**
- Executar as 14 suítes `.qa.mjs` de Playwright no CI padrão.
- Alterar `dependencies`, `devDependencies`, `bun.lock`, `db/custom.db` ou `docs/operacao-empacotamento.md`.
- Editar as 5 suítes `*.test.ts` ou rotas em `src/app/api/**` (reservadas às frentes de API/schema).
- Configurar o ruleset do GitHub diretamente por API durante esta change (a aplicação do ruleset leve na `main` ocorre como operação GitHub após o primeiro CI verde).

## Decisions

### D1: Isolamento das 5 suítes opt-in SQLite via `bwrap` + `mktemp -d` em `.zscripts/test-sqlite.sh`
- **Escolha:** `.zscripts/test-sqlite.sh` cria diretório temporário com `mktemp -d` em `${RUNNER_TEMP:-${TMPDIR:-/tmp}}`, prepara `HOME` e `TMPDIR` descartáveis, e executa cada suíte dentro de `bwrap` (`--tmpfs /`, `--dir /tmp --tmpfs /tmp`, `--dir /scratch --tmpfs /scratch`, `--unshare-net`, `env -i`, allowlist `--ro-bind` sem `.env*` e sem `db/`). Para as 4 suítes que exigem banco pré-provisionado (`purchase-date.test.ts` em `TZ=UTC` e `TZ=America/Bahia` com `CALENDAR_D3_SQLITE=1` e `DATABASE_URL=file:/tmp/calendar-d3.sqlite`; `installments/route.test.ts` com `INSTALLMENTS_D2_SQLITE=1` e `DATABASE_URL=file:/tmp/installments-d2.db`; `consortiums/assembly.test.ts` com `DATABASE_URL=file:/scratch/consortium-assembly.sqlite`; `savings/route.test.ts` com `DATABASE_URL=file:/scratch/savings-route.sqlite`), executa `bun --no-env-file ./node_modules/.bin/prisma db push --force-reset --skip-generate --schema=prisma/schema.prisma`. Para `purchases/route-integrity.test.ts` (`DATABASE_URL=file:/scratch/purchases-integrity.db`), garante ausência do arquivo antes da chamada porque o teste cria o SQLite via `openSync(..., "wx")`.
- **Razão:** As 3 suítes em `/scratch` verificam `realpathSync`, `existsSync('.env') === false` e `statfsSync('/scratch').type === 0x01021994` (`TMPFS_MAGIC`). Executar em `bwrap` satisfaz integralmente os contratos existentes sem editar os 5 testes.
- **Alternativa rejeitada:** Alterar os 5 `*.test.ts` para ler diretórios arbitrários ou pular a checagem de `TMPFS_MAGIC` — enfraqueceria a garantia de isolamento e geraria colisão com mudanças de API/schema.

### D2: Job único de CI em `.github/workflows/ci.yml`
- **Escolha:** Workflow em `push` (`main`) e `pull_request` com 1 job (`ubuntu-latest`), `oven-sh/setup-bun@v2` fixado em `1.4.2` (compatível com o runtime local `1.4.2`), instalação de `bubblewrap` e ajuste condicional de `kernel.apparmor_restrict_unprivileged_userns=0` no Ubuntu 24.04 apenas para o sandbox `bwrap`, seguido de: `bun install --frozen-lockfile`, `bun --no-env-file run typecheck`, `bun --no-env-file run lint`, `bun --no-env-file run arch:check`, `bun --no-env-file test`, `bun --no-env-file run test:scripts`, `bun --no-env-file run test:sqlite`, e `DATABASE_URL="file:${{ runner.temp }}/ci-build-inert.db" bun --no-env-file run build` (sem rodar `.qa.mjs`).
- **Razão:** `prisma generate` (chamado em `package.json#build`) e rotas de API analisadas no build apenas precisam que `DATABASE_URL` exista sintaticamente se consultada, sem banco real.
- **Alternativa rejeitada:** Múltiplos jobs paralelos repetindo `bun install` e instalação de runtime para um repositório pequeno (~10s de suíte).

### D3: Endurecimento de `next.config.ts` e `eslint.config.mjs`
- **Escolha:** Remover o bloco `typescript: { ignoreBuildErrors: true }` de `next.config.ts`. Em `eslint.config.mjs`, habilitar `no-debugger: "error"`, `no-unreachable: "error"`, `no-redeclare: "error"`, `react-hooks/exhaustive-deps: "warn"` e `@typescript-eslint/no-unused-vars: ["warn", { argsIgnorePattern: "^_" }]`, e acrescentar `openspec/**` e `download/**` em `ignores`.
- **Razão:** Verificação read-only executada com `bunx eslint` confirmou `0` erros e `17` avisos em `src/`, e `0` erros e `0` avisos em `.zscripts/` e `mini-services/`. Portanto, nenhuma correção invasiva em `src/` é necessária.
- **Alternativa rejeitada:** Promover `@typescript-eslint/no-unused-vars` e `react-hooks/exhaustive-deps` a `"error"` agora, o que quebraria o gate em 17 ocorrências fora do escopo desta change.

### D4: Scripts canônicos em `package.json`
- **Escolha:** Adicionar `test:scripts` (`bun --no-env-file test ./.zscripts/tests/packaging.test.ts ./.zscripts/check-frontend-architecture.test.ts`), `arch:check` (`bun --no-env-file .zscripts/check-frontend-architecture.ts --baseline-ref 25b44535c5068b99044afa03f7ecf318e7a9726f`), `test:sqlite` (`bash .zscripts/test-sqlite.sh`), e `check` (`bun --no-env-file run typecheck && bun --no-env-file run lint && bun --no-env-file run arch:check && bun --no-env-file test && bun --no-env-file run test:scripts`); remover `db:migrate` e `db:reset`. Preservar `dependencies`, `devDependencies` e `bun.lock`.
- **Razão:** Expor os mesmos portões usados pelo CI com comandos curtos e remover scripts quebrados pela ausência de `prisma/migrations/`.

### D5: Governança OpenSpec e reconciliação documental ativa
- **Escolha:** Atualizar `openspec/config.yaml` (`schema: superpowers-bridge`); corrigir os 3 links quebrados em `download/README.md` (linha 20) e `docs/reference/design-system.contract.md` (linhas 3 e 36) para `openspec/changes/archive/2026-11-23-recriar-interface-quiet-financial-os/...`; atualizar `docs/reference/frontend-componentization-coverage.md` (linhas 178, 180, 182 e 188) para `34 avisos` e inclusão de `balance-projection.tsx` (`503` linhas) nos `6` avisos `large-tsx-file`; e ajustar `AGENTS.md` removendo `import { motion } from 'framer-motion';` (linha 93) e registrando a aplicação do ruleset leve na branch `main` pós-primeiro CI verde como operação GitHub (além de listar `test:scripts`, `arch:check`, `test:sqlite` e `check` na seção de comandos).
- **Razão:** Manter as instruções operacionais, links e métricas consistentes com o código e os artefatos arquivados, sem invadir `docs/operacao-empacotamento.md`.

## Risks / Trade-offs

- [Risk] Runner `ubuntu-24.04` do GitHub Actions bloqueia user namespaces não privilegiados no AppArmor, impedindo `bwrap` por padrão → Mitigation: passo explícito no job ajusta `kernel.apparmor_restrict_unprivileged_userns=0` apenas no runner efêmero quando o sysctl existir, além de instalar `bubblewrap`.
- [Risk] `test:sqlite` falhar localmente se `bwrap` não estiver instalado na máquina do desenvolvedor → Mitigation: `.zscripts/test-sqlite.sh` valida a presença de `bwrap` no início e falha com diagnóstico claro em vez de contornar o isolamento.
- [Trade-off] Manter `react-hooks/exhaustive-deps` e `@typescript-eslint/no-unused-vars` em `"warn"` → aceito para evitar edição de `src/` nesta Onda 1 e não gerar conflitos com as frentes de runtime/API.

## Migration Plan

1. Implementar `.zscripts/test-sqlite.sh` (Task 1.1) e validar as 5 suítes opt-in com `0` skips e `db/custom.db` intacto.
2. Atualizar `next.config.ts`, `eslint.config.mjs` e `package.json` (Task 1.2) e validar `bun --no-env-file run check`, `bun --no-env-file run test:sqlite` e `bun --no-env-file run build` com `DATABASE_URL` fictícia inerte.
3. Criar `.github/workflows/ci.yml` (Task 1.3) e validar sintaxe/comandos alinhados a `package.json`.
4. Atualizar `openspec/config.yaml`, `download/README.md`, `docs/reference/design-system.contract.md`, `docs/reference/frontend-componentization-coverage.md` e `AGENTS.md` (Task 2.1) e validar links e checks OpenSpec.
5. Pós-merge na `main` e primeiro CI verde no GitHub: aplicar ruleset leve exigindo o status check do workflow na branch `main` (operação externa GitHub documentada em `AGENTS.md`).

## Open Questions

Nenhuma decisão em aberto; todas as premissas foram verificadas diretamente nos arquivos e ensaios locais do repositório.
