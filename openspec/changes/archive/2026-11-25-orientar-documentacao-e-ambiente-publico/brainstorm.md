# Brainstorming — Orientação Documental e Ambiente Público

## Leituras Obrigatórias e Mapeamento de Skills

- Leituras canônicas realizadas antes da escrita:
  - `/home/marcelo-karval/.agents/AGENTS.md`
  - `/home/marcelo-karval/.local/share/openspec/schemas/superpowers-bridge/README.md`
  - `/home/marcelo-karval/.agents/skills/brainstorming/SKILL.md`
  - `/home/marcelo-karval/.agents/skills/writing-plans/SKILL.md`
  - `/home/marcelo-karval/.agents/skills/project-documentation/SKILL.md`
  - `/home/marcelo-karval/.agents/skills/test-driven-development/SKILL.md`
- Mapeamento e invocação observada das skills:
  - `brainstorming`: lida integralmente e aplicada nesta sessão para levantar o estado atual dos arquivos de ambiente, configuração, documentação pública e links do contrato visual.
  - `writing-plans`: lida integralmente e aplicada nesta sessão na decomposição das Tasks `1.1` e `1.2` com microcontratos em `plan.md`.
  - `project-documentation`: lida integralmente e aplicada para alinhar `README.md`, `AGENTS.md`, `docs/reference/design-system.contract.md` e a spec `empacotamento-sem-dados` ao código e governança vigentes.
  - `test-driven-development`: lida integralmente para conduzir os testes `RED -> GREEN` em `.zscripts/tests/packaging.test.ts` antes das edições em configuração e documentação.

## Achados da Inspeção do Repositório

1. **Ambiente e arquivos de configuração (Task 1.1):**
   - `.env.example` atualmente contém `DATABASE_URL="file:./db/custom.db"`. Como `prisma/schema.prisma` fica em `prisma/schema.prisma`, o Prisma resolve caminhos relativos `file:` a partir da pasta `prisma/`, portanto `file:../db/custom.db` é o caminho relativo correto para `<raiz>/db/custom.db`.
   - `.env.local` existe atualmente no workspace (não rastreado, precisa ser removido com `rm -f .env.local` mantendo `.env` intacto no disco).
   - `.gitignore` atualmente lista `.env`, `.env.local`, `.env.production`, `.env.development`, mas não usa o padrão `.env.*` + `!.env.example` nem ignora `.playwright-cli/`.
   - `tsconfig.json` ainda lista `"examples"` e `"skills"` em `exclude`.
   - `eslint.config.mjs` ainda lista `"examples/**"` e `"skills"` em `ignores`.
   - `git ls-files db/` ainda lista `db/custom.db` rastreado no índice (a remoção do índice Git ocorre em frente paralela de higiene de árvore sem remover o arquivo local; esta change não executa `git add`/`git rm`/`git commit`).

2. **Documentação pública, `AGENTS.md` e contrato visual (Task 1.2):**
   - Não existe `README.md` na raiz do repositório.
   - `AGENTS.md` atual ainda mantém seções legadas (`1. Sobre o Projeto`, `agent-ctx/`, `worklog.md`, `CR<n>`, `docs/{helm,prompts,research}`), cita `Framer Motion` na stack da linha 12, não inclui `bun --no-env-file run db:generate` antes de `typecheck`, e ainda trata o ruleset `main` como operação futura pós-primeiro CI verde, embora o ruleset leve `main-ci-protection` (`id: 28102433`) já esteja ativo na `main` de `marcelokarval/sistema-financeiro`.
   - `docs/reference/design-system.contract.md` possui 3 links Markdown em suas linhas 3 e 7 (`design-system.premium-direction.md`, `design-system.theme.css` e `design-system.html`) que apontam para arquivos históricos removidos na higiene paralela da árvore, enquanto os links para `design.md`, `design-system.premium-theme.css`, `globals.css`, `tasks.md` e `download/README.md` permanecem válidos, e `src/components/finance/quiet-navigation.test.tsx:304-311` testa asserções específicas sobre a busca global nesse contrato.

3. **Fatos do produto verificados no código para `README.md` e `AGENTS.md`:**
   - As 9 visões da SPA (`ViewType` em `src/lib/store.ts` e `navigationGroups` em `src/components/finance/sidebar.tsx`): `Resumo` (`dashboard`), `Contas` (`accounts`), `Cartões` (`cards`), `Compras` (`purchases`), `Categorias` (`categories`), `Investimentos` (`investments`), `Parcelas` (`installments`), `Consórcios` (`consortiums`) e `Caixinhas` (`savings`).
   - Stack real: Next.js 16 (`16.1.1`), React 19, TypeScript, Prisma (`6.11.1`, SQLite), Tailwind CSS v4 + shadcn/ui + helper `cn()`, Zustand, Recharts, Socket.io (cliente `socket.io-client` e servidor auxiliar em `mini-services/finance-ws/` na porta `3004`, com proxy em `Caddyfile` `:81` -> `:3000` / `XTransformPort=3004`), e `z-ai-web-dev-sdk` no endpoint `/api/advisor` (assistente financeiro opcional que depende de configuração externa do SDK `z-ai-web-dev-sdk` para responder). `framer-motion` é vetado pela especificação Quiet Financial OS e não é importado em `src/`.
   - Pré-requisitos reais: Bun `1.4.2`, Node `>= 20.9.0` (exigido pelo Next 16.1.x), e `bubblewrap` (`bwrap`) opcional no Linux para executar `bun --no-env-file run test:sqlite`.

## Abordagem Acordada

Executar em duas tarefas sequenciais com TDD estrito (`RED -> GREEN`) ancorado em `.zscripts/tests/packaging.test.ts`:
1. **Task 1.1:** Escrever testes em `.zscripts/tests/packaging.test.ts` validando `.env.example`, ausência de `.env.local`, regras `.env.*` / `!.env.example` / `.playwright-cli/` em `.gitignore`, e ausência de `"examples"`, `"examples/**"` e `"skills"` em `tsconfig.json` e `eslint.config.mjs`; observar RED e implementar os ajustes mantendo `.env` e `db/custom.db` intactos no disco.
2. **Task 1.2:** Escrever testes em `.zscripts/tests/packaging.test.ts` validando a existência e os marcos mínimos de `README.md` e a limpeza de `AGENTS.md`; observar RED e criar `README.md`, reescrever `AGENTS.md` enxuto/atualizado e remover os 3 links quebrados das linhas 3 e 7 de `docs/reference/design-system.contract.md` sem afetar as frases testadas em `quiet-navigation.test.tsx`.
