## Context

A mudança integra a preparação do repositório público `marcelokarval/sistema-financeiro` na branch `chore/higiene-documentacao-e-repositorio-publico` (base `7c90a219399cad00569c1dca3064cea860c2ba3d`). Enquanto uma frente paralela (`exec-tree-8`) realiza limpeza de árvore e operações no índice Git (`.git/index`, incluindo destrackeamento de `db/custom.db` mantendo o arquivo local e remoção de arquivos históricos como `design-system.premium-direction.md`, `design-system.theme.css` e `design-system.html`), esta change assume exclusivamente a higiene de ambiente/configuração, a criação do `README.md` raiz, a reescrita de `AGENTS.md` e o ajuste pontual de links em `docs/reference/design-system.contract.md`.

## Goals / Non-Goals

**Goals:**
- Atualizar `.env.example` para `DATABASE_URL="file:../db/custom.db"` sem `GITHUB_TOKEN`, remover `.env.local` preservando `.env` intacto, e atualizar `.gitignore` com `.env.*`, `!.env.example` e `.playwright-cli/`.
- Remover `"examples"`, `"examples/**"` e `"skills"` de `tsconfig.json` (`exclude`) e `eslint.config.mjs` (`ignores`).
- Criar `README.md` raiz em pt-BR para `marcelokarval/sistema-financeiro` documentando produto, 9 visões, stack real (incluindo Socket.io em `mini-services/finance-ws/` e nota sobre `z-ai-web-dev-sdk` no `/api/advisor`), pré-requisitos, setup completo, scripts de `package.json`, CI e links internos.
- Reescrever `AGENTS.md` de forma enxuta, aderente à árvore real, convenções Quiet Financial OS (`cn()`, veto a `framer-motion`), fluxo OpenSpec (`superpowers-bridge`), comandos atualizados (`db:generate` pré-typecheck) e status ativo do ruleset `main-ci-protection` (`id: 28102433`).
- Remover os 3 links Markdown quebrados nas linhas 3 e 7 de `docs/reference/design-system.contract.md` sem alterar as demais linhas ou frases cobertas por testes.
- Cobrir as invariantes acima com testes TDD (`RED -> GREEN`) em `.zscripts/tests/packaging.test.ts` e validar `quiet-navigation.test.tsx`.

**Non-Goals:**
- Executar `git add`, `git rm` ou `git commit` (proibido nesta frente por concorrência em `.git/index`).
- Modificar ou remover `.env` ou `db/custom.db` no disco, ou alterar `docs/operacao-empacotamento.md`.
- Criar arquivo `LICENSE` ou editar código em `src/`.

## Decisions

### D1: Caminho relativo `file:../db/custom.db` em `.env.example` e cobertura em `.gitignore`
- **Escolha:** Ajustar `.env.example` para `DATABASE_URL="file:../db/custom.db"` sem outras variáveis; substituir a lista explícita de arquivos `.env.*` no `.gitignore` por `.env`, `.env.*` e `!.env.example` (mantendo `.env.example` versionável e protegendo qualquer `.env.*` local), além de adicionar `.playwright-cli/`; remover `.env.local` do workspace sem tocar em `.env`.
- **Razão:** O Prisma resolve `url = env("DATABASE_URL")` para SQLite relativamente ao diretório do `prisma/schema.prisma` (`prisma/`), logo `../db/custom.db` aponta corretamente para `<raiz>/db/custom.db` no ambiente local. Usar `.env.*` + `!.env.example` evita vazamento acidental de variantes `.env.*.local`.
- **Alternativa rejeitada:** Manter `file:./db/custom.db`, que faz o Prisma criar/procurar `prisma/db/custom.db` em vez de `db/custom.db`.

### D2: Limpeza de `tsconfig.json` e `eslint.config.mjs`
- **Escolha:** Remover `"examples"` e `"skills"` de `tsconfig.json#exclude`, e remover `"examples/**"` e `"skills"` de `eslint.config.mjs#ignores`, preservando todas as demais regras e caminhos ignorados (`openspec/**`, `download/**`, `.tmp/**`, etc.).
- **Razão:** Os diretórios `examples` e `skills` não pertencem ao código do repositório público; mantê-los nas configurações perpetua referências mortas.

### D3: Documentação pública (`README.md`) e guia de agentes (`AGENTS.md`) fiel ao estado real
- **Escolha:** Criar `README.md` em pt-BR refletindo exclusivamente o repositório `marcelokarval/sistema-financeiro`, suas 9 visões, dependências reais em uso (omitindo pacotes ociosos), Socket.io em `mini-services/finance-ws/` e dependência externa de `z-ai-web-dev-sdk` no `/api/advisor`. Reescrever `AGENTS.md` removendo duplicidade com o `README.md` e artefatos legados (`Framer Motion`, `agent-ctx/`, `worklog.md`, `CR<n>`, `docs/{helm,prompts,research}`), incorporando `openspec/`, `.github/workflows/ci.yml`, `Caddyfile`, `.zscripts/`, `mini-services/finance-ws/`, `cn()`, veto a `framer-motion`, `bun --no-env-file run db:generate` pré-typecheck e o ruleset ativo `main-ci-protection` (`id: 28102433`).
- **Razão:** Eliminar contradições entre documentação operacional e gates vigentes (ESLint, `arch:check`, OpenSpec `superpowers-bridge`).

### D4: Ajuste cirúrgico em `docs/reference/design-system.contract.md`
- **Escolha:** Editar apenas as linhas 3 e 7 de `docs/reference/design-system.contract.md`, convertendo as referências textuais aos artefatos históricos removidos (`design-system.premium-direction.md`, `design-system.theme.css` e `design-system.html`) em menções sem link quebrado e preservando intactos os links ativos (`design.md`, `design-system.premium-theme.css`, `globals.css`, `tasks.md`, `download/README.md`) e todas as frases verificadas por `src/components/finance/quiet-navigation.test.tsx:304-311`.
- **Razão:** Evitar links quebrados no contrato visual sem invalidar o contrato de navegação/busca testado.

## Risks / Trade-offs

- [Risk] Outra frente (`exec-tree-8`) remove `examples/` e os arquivos históricos de `docs/reference/` em paralelo, podendo causar momento transitório em que `examples/` ainda exista no disco antes da integração final → Mitigation: nesta change verificamos os arquivos escopados com `packaging.test.ts` e `quiet-navigation.test.tsx`; o gate completo de `eslint .` / `tsc --noEmit` é reconciliado na integração final após a remoção física de `examples/` por `exec-tree-8`.
- [Risk] Testes em `.zscripts/tests/packaging.test.ts` rodam no mesmo arquivo nas Tasks 1.1 e 1.2 → Mitigation: manter Task 1.2 explicitamente dependente de Task 1.1 para serializar as edições.

## Migration Plan

1. Executar Task 1.1 com TDD (`RED -> GREEN`): adicionar asserções de ambiente/config em `.zscripts/tests/packaging.test.ts`, verificar RED, atualizar `.env.example`, remover `.env.local`, atualizar `.gitignore`, `tsconfig.json` e `eslint.config.mjs`, e verificar GREEN.
2. Executar Task 1.2 com TDD (`RED -> GREEN`): adicionar asserções de `README.md` e `AGENTS.md` em `.zscripts/tests/packaging.test.ts`, verificar RED, criar `README.md`, reescrever `AGENTS.md` e ajustar linhas 3 e 7 de `docs/reference/design-system.contract.md`, e verificar GREEN junto com `quiet-navigation.test.tsx`.
3. Gerar `candidate` via `bridge_guard.py` e submeter para revisão independente.

## Open Questions

Nenhuma decisão em aberto; todos os alvos, textos obrigatórios, regras de isolamento e arquivos permitidos estão definidos.
