# Verificação — Separar dados do pacote

## Candidate

- Base HEAD: `96de0e44e4d43e574f1b920d7047d95b37261ae5`
- Digest histórico sintético (`plan.md`): `daaceab9766e5f825b7f57786f2296584ab9d4f6a57311c846a68922747875a0`
- Validação real autorizada em contexto limpo (`/tmp/sistema-financeiro-release-qa`) com correção de `prisma generate` em `package.json` (`scripts.build`)

## Mandatory checks

- [x] structural
- [x] tests
- [x] review

## Overall Decision

- [x] PASS

## Cobertura e limites (Tarefa 2.2)

- **Higiene `.env` / `.env.local` no repositório**:
  - `.env.local` (`chmod 600`, 34 B) criado com a linha `DATABASE_URL` local e ignorado pelo `.gitignore`.
  - `git rm --cached .env` executado (`git status -s -- .env .env.local` reporta `D  .env` no índice, preservando `.env` em disco com 34 B e `db/custom.db` intacto com 204.800 B).
- **Fix real descoberto no build em contexto limpo**:
  - Na primeira tentativa em `/tmp/sistema-financeiro-release-qa` sem `node_modules/.prisma/client` prévio, `next build` falhou com `Cannot find module '.prisma/client/default'`.
  - `package.json` (`scripts.build`) atualizado para `"prisma generate && next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/"`.
- **Build real e inspeção do tarball**:
  - Contexto limpo `/tmp/sistema-financeiro-release-qa` (sem `.git`, `db`, `node_modules`, `.next`, `.env*` ou symlinks): `bash .zscripts/build.sh` concluiu com **exit 0** (`Pacote verificado: /tmp/build_fullstack_local.u1x7wumh0P.tar.gz`).
  - Inventário `tar -tvzf` / `tar -tzf`: confirmados `./start.sh`, `./Caddyfile`, `./next-service-dist/server.js`, `./next-service-dist/.next/static`, `./next-service-dist/public`, `./mini-services-dist/mini-service-finance-ws.js`, `./mini-services-start.sh`, com **0 entradas proibidas** (`db/`, `.env*`, `.db`, `.sqlite*`).
- **Execução negativa e positiva do launcher em `/tmp/sistema-financeiro-release-extract`**:
  - Sem `DATABASE_URL`: `env -u DATABASE_URL sh ./start.sh` → **`rc=1`** (`Erro: DATABASE_URL deve apontar para um SQLite externo preexistente e acessível (file:/caminho/absoluto).`).
  - Banco dentro do pacote (`inside.sqlite`): `DATABASE_URL=file:/tmp/sistema-financeiro-release-extract/inside.sqlite sh ./start.sh` → **`rc=1`** (`Erro: DATABASE_URL deve apontar para um SQLite externo preexistente e acessível (file:/caminho/absoluto).`).
  - Startup positivo com SQLite sintético vazio externo (`/tmp/sistema-financeiro-release-db.sqlite`, 155.648 B via `prisma db push --skip-generate`): `sh ./start.sh` validou `DATABASE_URL`, subiu Next.js (`Port: 3098`, `Ready in 262ms`) e `mini-services` (`finance-ws` na porta `3004`). HTTP real validado: `GET http://127.0.0.1:3098/` → **`200`** e `GET http://127.0.0.1:3098/api/accounts` → **`200`** com corpo exato `[]`.
- **Suíte automatizada de empacotamento**: `~/.bun/bin/bun test ./.zscripts/tests/packaging.test.ts` após edição de `package.json`: **44 pass, 0 fail** (`321` asserções).
- **Cleanup confirmado**: processos de teste encerrados (portas `3098` e `3004` livres); `/tmp/sistema-financeiro-release-qa`, `/tmp/sistema-financeiro-release-extract`, `/tmp/build_fullstack_*.tar.gz` e `/tmp/sistema-financeiro-release-db.sqlite*` removidos e confirmados ausentes.
- **Nota transparente do ambiente dev**: `caddy` não está instalado nesta máquina (`./start.sh: 151: exec: caddy: not found`, `rc=127` após iniciar Next.js e `mini-services`); a execução do proxy reverso Caddy permanece condicionada à validação no host alvo com `caddy` instalado.
