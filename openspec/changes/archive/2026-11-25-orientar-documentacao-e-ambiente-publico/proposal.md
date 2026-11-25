## Why

O repositório está sendo preparado para publicação em `marcelokarval/sistema-financeiro`, mas ainda carece de `README.md` raiz em pt-BR, mantém instruções legadas em `AGENTS.md` (`Framer Motion`, `agent-ctx/`, `worklog.md`), preserva `.env.example` com caminho relativo incompatível com `prisma/schema.prisma` (`file:./db/custom.db`), deixa `.env.local` no workspace, não cobre `.env.*`/`!.env.example`/`.playwright-cli/` no `.gitignore`, referencia pastas excluídas (`examples`, `skills`) em `tsconfig.json` e `eslint.config.mjs`, e aponta em `docs/reference/design-system.contract.md` para 3 artefatos históricos removidos.

## What Changes

**Higiene de ambiente exemplo, ignore e configurações de toolchain**
- From: `.env.example` com `DATABASE_URL="file:./db/custom.db"`, `.env.local` presente, `.gitignore` sem `.env.*`/`!.env.example`/`.playwright-cli/`, `tsconfig.json` (`exclude`) e `eslint.config.mjs` (`ignores`) listando `"examples"`, `"examples/**"` e `"skills"`.
- To: `.env.example` com `DATABASE_URL="file:../db/custom.db"` sem `GITHUB_TOKEN`, `.env.local` removido (preservando `.env` local intacto), `.gitignore` contendo `.env.*`, `!.env.example` e `.playwright-cli/`, e `tsconfig.json`/`eslint.config.mjs` limpos de `"examples"`, `"examples/**"` e `"skills"`, cobertos por testes em `.zscripts/tests/packaging.test.ts`.
- Reason: alinhar o template de ambiente à resolução relativa do Prisma e preparar `.gitignore` e configurações estáticas para um repositório público limpo.
- Impact: non-breaking; `.env` e `db/custom.db` locais permanecem intactos no disco.

**Documentação pública, `AGENTS.md` enxuto e contrato visual sem links quebrados**
- From: ausência de `README.md` raiz, `AGENTS.md` com referências legadas (`Framer Motion`, `agent-ctx/`, `worklog.md`, `CR<n>`, `docs/{helm,prompts,research}`) e nota futura sobre o ruleset da `main`, e 3 links quebrados nas linhas 3 e 7 de `docs/reference/design-system.contract.md`.
- To: `README.md` raiz completo em pt-BR para `marcelokarval/sistema-financeiro`, `AGENTS.md` enxuto alinhado à árvore real, convenções Quiet Financial OS, OpenSpec (`superpowers-bridge`) e ruleset `main-ci-protection` (`id: 28102433`) já ativo, e linhas 3 e 7 de `docs/reference/design-system.contract.md` sem os 3 links quebrados, tudo validado por testes em `.zscripts/tests/packaging.test.ts` e `quiet-navigation.test.tsx`.
- Reason: oferecer onboarding preciso para contribuidores e agentes sem referências mortas ou pacotes banidos.
- Impact: non-breaking; preserva `docs/operacao-empacotamento.md`, `LICENSE` ausente e contratos testados do design system.

## Capabilities

### New Capabilities
Nenhuma nova capability é criada; os requisitos de orientação pública e higiene de ambiente atualizam e estendem a capability `empacotamento-sem-dados`.

### Modified Capabilities
- `empacotamento-sem-dados`: atualiza o requisito de higiene de ambiente/índice Git (`.env.example` com `DATABASE_URL="file:../db/custom.db"` e remoção de `db/custom.db` de `git ls-files db/` mantendo o arquivo local) e adiciona requisitos para `.gitignore`, `.env.local`, `tsconfig.json`, `eslint.config.mjs`, `README.md`, `AGENTS.md` e `docs/reference/design-system.contract.md`.

## Impact

- Configuração e testes: `.env.example`, `.env.local` (removido), `.gitignore`, `tsconfig.json`, `eslint.config.mjs`, `.zscripts/tests/packaging.test.ts`.
- Documentação: `README.md`, `AGENTS.md`, `docs/reference/design-system.contract.md`.
- Exclusões garantidas: `.env` local (intacto), `db/custom.db` local (intacto no disco), `docs/operacao-empacotamento.md`, criação de `LICENSE` e operações em `.git/index` (`git add`/`git rm`/`git commit`).
