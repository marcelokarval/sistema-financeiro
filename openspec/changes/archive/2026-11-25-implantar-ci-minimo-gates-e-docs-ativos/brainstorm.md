# Brainstorming — CI Mínimo, Gates Estáticos e Governança Documental Ativa

## Leituras Obrigatórias e Mapeamento de Skills

- Leituras canônicas realizadas antes da escrita:
  - `/home/marcelo-karval/.agents/AGENTS.md`
  - `/home/marcelo-karval/.local/share/openspec/schemas/superpowers-bridge/README.md`
  - `/home/marcelo-karval/.agents/skills/brainstorming/SKILL.md`
  - `/home/marcelo-karval/.agents/skills/writing-plans/SKILL.md`
  - `/home/marcelo-karval/.agents/skills/project-documentation/SKILL.md`
- Mapeamento e invocação observada das skills:
  - `brainstorming`: invocada nesta sessão a partir de `/home/marcelo-karval/.agents/skills/brainstorming/SKILL.md` para exploração técnica, análise de alternativas e convergência do desenho.
  - `writing-plans`: invocada nesta sessão a partir de `/home/marcelo-karval/.agents/skills/writing-plans/SKILL.md` para decomposição de tarefas e microcontratos em `plan.md`.
  - `project-documentation`: invocada nesta sessão a partir de `/home/marcelo-karval/.agents/skills/project-documentation/SKILL.md` para reconciliação de links, inventário AST e instruções operacionais em `AGENTS.md`, `download/README.md` e `docs/reference/`.

## Achados da Inspeção do Repositório

1. **Runtime e baseline atual:**
   - `bun --version`: `1.4.2`.
   - `HEAD` atual: `418e6f0396f2fd0973a170dac8c5f2dd243c3f16`.
   - `bun --no-env-file run typecheck`: passa com `exit 0` (`tsc --noEmit`).
   - `bun --no-env-file test`: `388 pass, 41 skip, 0 fail` (`2664` asserções em `32` arquivos). Os `41` testes pulados pertencem exatamente às 5 suítes opt-in de SQLite isolado.
   - `bun --no-env-file test ./.zscripts/tests/packaging.test.ts ./.zscripts/check-frontend-architecture.test.ts`: `62 pass, 0 fail` (`374` asserções em `2` arquivos — ficam fora do `bun test` padrão porque `.zscripts/` é diretório oculto).
   - `bun --no-env-file .zscripts/check-frontend-architecture.ts --baseline-ref 25b44535c5068b99044afa03f7ecf318e7a9726f`: passa com `exit 0` (`77 arquivos; 6 ocorrências em 6 identidades; 34 avisos; 0 erros`).
   - `.github/workflows/`: não existe atualmente.

2. **As 5 suítes opt-in de SQLite e seus pré-requisitos exatos:**
   - `src/lib/purchase-date.test.ts`: ativa com `CALENDAR_D3_SQLITE=1`, exige `DATABASE_URL=file:/tmp/calendar-d3.sqlite`, `existsSync('/tmp/calendar-d3.sqlite') === true`, ausência de `.env` e `prisma/.env` (`existsSync === false`), `PRAGMA foreign_keys = 1`, e `TZ=UTC` ou `TZ=America/Bahia`.
   - `src/app/api/installments/route.test.ts`: ativa com `INSTALLMENTS_D2_SQLITE=1`, exige `DATABASE_URL=file:/tmp/installments-d2.db`, `existsSync('/tmp/installments-d2.db') === true`, `PRAGMA foreign_keys = 1` e tabelas vazias.
   - `src/app/api/purchases/route-integrity.test.ts`: ativa com `DATABASE_URL=file:/scratch/purchases-integrity.db`, exige `realpathSync('/scratch') === '/scratch'`, ausência de `.env` e `prisma/.env`, e **exige que `/scratch/purchases-integrity.db` não exista antes da execução** (o teste cria o arquivo com `openSync(..., "wx", 0o600)` e aplica seu DDL próprio).
   - `src/app/api/consortiums/assembly.test.ts`: ativa com `DATABASE_URL=file:/scratch/consortium-assembly.sqlite`, exige `realpathSync('/scratch') === '/scratch'`, `statfsSync('/scratch').type === 0x01021994` (`TMPFS_MAGIC`), arquivo regular com `nlink === 1`, ausência de `.env` e `prisma/.env`, `PRAGMA foreign_keys = 1` e schema Prisma vazio.
   - `src/app/api/savings/route.test.ts`: ativa com `DATABASE_URL=file:/scratch/savings-route.sqlite`, exige `realpathSync('/scratch') === '/scratch'`, `statfsSync('/scratch').type === 0x01021994` (`TMPFS_MAGIC`), arquivo regular com `nlink === 1`, ausência de `.env` e `prisma/.env`, `PRAGMA foreign_keys = 1` e schema Prisma vazio.

3. **Gates estáticos (`next.config.ts`, `eslint.config.mjs`, `package.json`):**
   - `next.config.ts` ainda tem `typescript: { ignoreBuildErrors: true }`, mas `tsc --noEmit` já passa com `0` erros.
   - `eslint.config.mjs` desabilita hoje `no-debugger`, `no-unreachable`, `no-redeclare`, `react-hooks/exhaustive-deps` e `@typescript-eslint/no-unused-vars`, e não ignora `openspec/**` nem `download/**`.
   - Ensaio read-only executado com `bunx eslint` habilitando `no-debugger: "error"`, `no-unreachable: "error"`, `no-redeclare: "error"`, `react-hooks/exhaustive-deps: "warn"` e `@typescript-eslint/no-unused-vars: ["warn", { argsIgnorePattern: "^_" }]`:
     - Em `src/`: **`0` erros e `17` avisos** (todos em `no-unused-vars` ou `react-hooks/exhaustive-deps`).
     - Em `.zscripts/` e `mini-services/`: **`0` erros e `0` avisos**.
   - `package.json` mantém `db:migrate` (`prisma migrate dev`) e `db:reset` (`prisma migrate reset`), apesar de não existir `prisma/migrations/` (o projeto usa `prisma db push`), e não possui scripts canônicos `test:scripts`, `arch:check`, `test:sqlite` e `check`.

4. **Governança OpenSpec e documentação ativa:**
   - `openspec/config.yaml` define `schema: spec-driven`, enquanto o projeto adota `superpowers-bridge` v2 nas changes ativas.
   - `download/README.md` (linha 20) aponta para `../openspec/changes/recriar-interface-quiet-financial-os/plan.md`, que foi arquivada em `../openspec/changes/archive/2026-11-23-recriar-interface-quiet-financial-os/plan.md`.
   - `docs/reference/design-system.contract.md` (linhas 3 e 36) aponta para `../../openspec/changes/recriar-interface-quiet-financial-os/design.md` e `tasks.md`, agora sob `../../openspec/changes/archive/2026-11-23-recriar-interface-quiet-financial-os/...`.
   - `docs/reference/frontend-componentization-coverage.md` (linhas 178, 180, 182 e 188) registra `33 avisos` e 5 entradas `large-tsx-file`, mas o gate AST atual emite `34 avisos` porque `src/components/finance/balance-projection.tsx` passou a ter `503` linhas (`large-tsx-file`, somando `6` avisos `large-tsx-file`).
   - `AGENTS.md` (linha 93) exemplifica `import { motion } from 'framer-motion';`, dependência banida pela spec Quiet, e não documenta que a proteção da branch `main` via ruleset leve será aplicada pós-primeiro CI verde como operação GitHub.

## Alternativas Consideradas para o Runner SQLite Isolado (`.zscripts/test-sqlite.sh`)

- **Alternativa A (escolhida): Runner isolado em `bwrap` + `mktemp -d` preservando as 5 suítes intactas.**
  - O script cria diretório temporário com `mktemp -d` em `${RUNNER_TEMP:-${TMPDIR:-/tmp}}`, executa cada uma das 5 suítes em sandbox `bwrap` com raiz `--tmpfs /`, diretórios `--dir /tmp --tmpfs /tmp` e `--dir /scratch --tmpfs /scratch`, `--unshare-net`, `env -i` e `--ro-bind` apenas das pastas/arquivos necessários (`src`, `prisma/schema.prisma`, `package.json`, `tsconfig.json`, `node_modules`, binários `bun`/`node`), excluindo `.env`, `.env.local`, `prisma/.env` e `db/custom.db`.
  - Para as 4 suítes que exigem banco pré-provisionado, aplica `./node_modules/.bin/prisma db push --force-reset --skip-generate --schema=prisma/schema.prisma` dentro do sandbox antes de rodar `bun --no-env-file test`; para `purchases/route-integrity.test.ts`, garante ausência do arquivo antes da chamada.
  - Em `.github/workflows/ci.yml` (`ubuntu-latest`), instala `bubblewrap` e libera `kernel.apparmor_restrict_unprivileged_userns=0` se presente para que `bwrap` execute sem privilégios extras.
  - **Por que vence:** zero edição em `src/app/api/**` ou `src/lib/*.test.ts` (evita qualquer colisão com as Changes 2 e 3), preserva 100% das asserções de isolamento (`TMPFS_MAGIC`, ausência de `.env`, `PRAGMA foreign_keys`), e funciona tanto localmente (onde `.env` e `db/custom.db` existem) quanto em CI.

- **Alternativa B (rejeitada): Parametrizar os 5 arquivos `*.test.ts` para aceitar diretório qualquer sem `/scratch` ou `TMPFS_MAGIC`.**
  - Exigiria editar 5 arquivos de teste em `src/lib/` e `src/app/api/`, enfraquecendo a prova de `tmpfs` e criando risco de conflito com changes concorrentes de API.

## Abordagem Acordada

Executar a Onda 1 em duas frentes paralelas sem conflito de escrita:
1. Automação e gates técnicos: `.zscripts/test-sqlite.sh` → endurecimento de `next.config.ts`, `eslint.config.mjs` e `package.json` → workflow mínimo `.github/workflows/ci.yml` (1 job `ubuntu-latest`, sem Playwright `.qa.mjs`).
2. Governança e documentação ativa: `openspec/config.yaml`, `download/README.md`, `docs/reference/design-system.contract.md`, `docs/reference/frontend-componentization-coverage.md` e `AGENTS.md`, mantendo `db/custom.db` e `docs/operacao-empacotamento.md` estritamente intactos.
