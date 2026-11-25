## Why

O gateway `Caddyfile` em `:81` aceita qualquer porta em `XTransformPort=*`, expondo SSRF e port-pivoting local, enquanto `.zscripts/start.sh` usa `exec caddy` sem `trap` nem pré-checagem de `caddy` e `.zscripts/mini-services-start.sh` não propaga sinais aos filhos. Além disso, restam scripts legados com `/home/z/my-project/`, `GITHUB_TOKEN` em `.env.example`, `.zscripts/dev.pid` e `skills/` rastreados no Git, e `docs/operacao-empacotamento.md` cita rota de saúde inexistente. Corrigir essa superfície de ataque e higiene operacional antes da próxima distribuição garante inicialização segura, teardown limpo e repositório coerente.

## What Changes

**Hardening do gateway `:81` (`Caddyfile`)**
- From: `@transform_port_query` aceita `query XTransformPort=*` e encaminha para `localhost:{query.XTransformPort}`.
- To: `@transform_port_query` aceita exclusivamente `query XTransformPort=3004` e encaminha para `localhost:3004` (único consumidor em `src/hooks/use-realtime.ts:36`).
- Reason: eliminar risco de SSRF/port-pivoting local através da query string do proxy reverso.
- Impact: não quebra o realtime (`finance-ws` na porta `3004`); bloqueia redirecionamento arbitrário em `:81`.

**Lifecycle e pré-validação nos launchers (`.zscripts/start.sh`, `.zscripts/mini-services-start.sh`)**
- From: `.zscripts/start.sh` executa `exec caddy` sem verificar `command -v caddy` antes de subir Next.js/mini-services e sem registrar `trap` (além de `cleanup()` conter `exit 0` fixo); `.zscripts/mini-services-start.sh` não registra `trap` para repassar sinais aos filhos `bun`.
- To: `.zscripts/start.sh` valida `command -v caddy` antes de iniciar processos filhos, registra `trap cleanup EXIT INT TERM` preservando o código de saída real e inicia Caddy em background seguido de `wait "$CADDY_PID"` para garantir teardown de `NEXT_PID` e `MINI_PID`; `.zscripts/mini-services-start.sh` registra `trap cleanup EXIT INT TERM` preservando o código de saída.
- Reason: evitar processos órfãos em falhas ou sinais e preservar o contrato de exit code não zero exigido em `.zscripts/tests/packaging.test.ts`.
- Impact: melhora previsibilidade operacional e cobertura de testes automatizados em `.zscripts/tests/packaging.test.ts`.

**Higiene de scripts legados, `.env.example`, índice Git e documentação**
- Remover `.zscripts/mini-services-build.sh` e `.zscripts/mini-services-install.sh` (caminhos `/home/z/my-project/`).
- Atualizar `.env.example` para `DATABASE_URL="file:./db/custom.db"` e remover `GITHUB_TOKEN`.
- Remover `.zscripts/dev.pid` do repositório e do disco (`git rm -f`), adicionar `*.pid` ao `.gitignore` e remover `skills/` apenas do índice Git (`git rm -r --cached skills/`), preservando os arquivos locais no disco.
- Alinhar `docs/operacao-empacotamento.md` para smoke check em `GET /` (inexiste `/api/health`) e documentar a restrição do proxy `:3004`.
- **Non-goal explícito:** `db/custom.db` permanece intocado nesta onda, pois sua remoção ou distribuição opcional depende do futuro wizard de instalação (base de exemplo vs. base limpa).

## Capabilities

### New Capabilities

### Modified Capabilities

- `empacotamento-sem-dados`: adicionar requisitos de restrição do proxy `:81` para `XTransformPort=3004`, pré-checagem de `caddy` e teardown com preservação de exit code nos launchers, e higiene de `.env.example`, scripts legados e índice Git.

## Impact

- Arquivos modificados ou removidos: `Caddyfile`, `.zscripts/start.sh`, `.zscripts/mini-services-start.sh`, `.zscripts/tests/packaging.test.ts`, `.zscripts/mini-services-build.sh`, `.zscripts/mini-services-install.sh`, `.zscripts/dev.pid`, `.gitignore`, `.env.example`, `docs/operacao-empacotamento.md`, além da remoção apenas no índice Git de `skills/` (`git rm -r --cached skills/`).
- Fora de escopo / protegido: `db/custom.db` (tratado em rodada futura com o wizard de instalação), código de aplicação Next.js (`src/**`), schema Prisma e `.zscripts/build.sh`.
