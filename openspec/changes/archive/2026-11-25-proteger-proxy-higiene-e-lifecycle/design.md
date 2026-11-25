## Context

O empacotamento e a inicialização de produção já separam o SQLite do tarball (`.zscripts/build.sh` e `.zscripts/start.sh`), porém permanecem lacunas de segurança na borda do proxy, no ciclo de vida dos processos e na higiene do repositório:
1. `Caddyfile` expõe `:81` com `query XTransformPort=*` e `reverse_proxy localhost:{query.XTransformPort}`, permitindo acesso a qualquer porta local na máquina hospedeira, embora apenas a porta `3004` (`mini-services/finance-ws`) seja usada por `src/hooks/use-realtime.ts:36`.
2. `.zscripts/start.sh` não valida `command -v caddy` antes de subir Next.js e mini-services, não registra `trap`, define `exit 0` fixo dentro de `cleanup()` e substitui o shell via `exec caddy`. `.zscripts/mini-services-start.sh` também não registra `trap` para propagar sinais aos processos `bun`.
3. Restam artefatos legados e poluição de índice Git: `.zscripts/mini-services-build.sh` e `.zscripts/mini-services-install.sh` (com `/home/z/my-project/`), `GITHUB_TOKEN` e path `/home/z/my-project/` em `.env.example`, `.zscripts/dev.pid` rastreado sem regra `*.pid` no `.gitignore`, e 412 arquivos de `skills/` no índice Git mesmo com `/skills/` em `.gitignore:69`.
4. `docs/operacao-empacotamento.md` cita na linha 45 uma rota de saúde genérica inexistente (não há `/api/health` em `src/app/api/`) e não documenta a restrição do proxy `:3004`.

## Goals / Non-Goals

**Goals:**
- Restringir o proxy `:81` em `Caddyfile` exclusivamente para `XTransformPort=3004` com destino fixo `localhost:3004`.
- Garantir pré-checagem de `caddy` no `PATH` antes da inicialização de processos filhos e teardown confiável com preservação do código de saída real em `.zscripts/start.sh` e `.zscripts/mini-services-start.sh`.
- Cobrir restrição do `Caddyfile`, ausência de `caddy`, falha do `caddy` após subida de processos e propagação de sinal em `.zscripts/tests/packaging.test.ts` sem quebrar os 44 testes existentes.
- Remover scripts legados com `/home/z/my-project/`, limpar `.env.example`, remover `.zscripts/dev.pid`, ignorar `*.pid`, destrackear `skills/` preservando os arquivos no disco e alinhar `docs/operacao-empacotamento.md`.

**Non-Goals:**
- **Não tocar ou remover `db/custom.db`**: sua eventual remoção do repositório ou empacotamento como base de exemplo opcional depende do futuro wizard/tela de instalação (base de exemplo vs. base limpa), em change separada.
- Não alterar `src/hooks/use-realtime.ts`, `mini-services/finance-ws/index.ts`, `.zscripts/build.sh` ou `.zscripts/dev.sh`.
- Não executar `caddy` real nem testes E2E em rede caso o binário `caddy` não esteja instalado no ambiente local (ver `Risks / Trade-offs`).

## Decisions

### D1 — Proxy `:81` restrito a `XTransformPort=3004` e destino fixo
- **Escolha**: alterar `@transform_port_query` para `query XTransformPort=3004` e usar `reverse_proxy localhost:3004` em `Caddyfile`.
- **Motivo**: elimina interpolação de entrada controlada pelo cliente no alvo de `reverse_proxy`, neutralizando SSRF/port-pivoting em `localhost` enquanto preserva o único consumidor legítimo (`src/hooks/use-realtime.ts:36`).
- **Alternativa rejeitada**: usar regex de allowlist mantendo `{query.XTransformPort}` dinâmico — desnecessário para uma única porta autorizada (`3004`) e mantém acoplamento a placeholder de query.

### D2 — Pré-checagem de `caddy`, `wait "$CADDY_PID"` e `cleanup` idempotente preservando exit code
- **Escolha**:
  1. Em `.zscripts/start.sh`, validar `command -v caddy >/dev/null 2>&1` logo após a validação de `DATABASE_URL` e antes de iniciar Next.js ou `mini-services-start.sh`.
  2. Registrar handlers POSIX `sh` (`dash`-compatíveis) para `EXIT`, `INT` e `TERM`:
     - `cleanup` recebe opcionalmente o código de saída (`rc=${1:-$?}`), usa guarda `cleaned_up` e `trap - EXIT INT TERM` para executar uma única vez, pula a espera de 1s quando `pids` estiver vazio ou nenhum PID estiver vivo, envia `SIGTERM` e após até 5s `SIGKILL` aos processos vivos em `$pids`, e termina com `return "$rc"` (sem `exit 0` fixo!).
     - `trap 'rc=$?; cleanup "$rc"; exit "$rc"' EXIT`, `trap 'cleanup 130; exit 130' INT`, `trap 'cleanup 143; exit 143' TERM`.
  3. Iniciar Caddy com `caddy run --config Caddyfile --adapter caddyfile &`, capturar `CADDY_PID=$!`, adicioná-lo a `pids` e executar `wait "$CADDY_PID"`.
  4. Aplicar o mesmo padrão de `cleanup` idempotente + `trap ... EXIT INT TERM` em `.zscripts/mini-services-start.sh`.
- **Motivo**:
  - `exit 0` dentro de `cleanup()` sobrescreveria falhas de `DATABASE_URL`, `command -v caddy` ou inicialização do Next.js para `0`, quebrando o contrato já verificado em `.zscripts/tests/packaging.test.ts`.
  - Usar `wait "$CADDY_PID"` em vez de `wait` sem argumentos evita que o launcher fique pendurado esperando `NEXT_PID` quando o Caddy cai e preserva o exit code exato do Caddy (e quando `bin/caddy` stub sai com `0` nos testes existentes de `packaging.test.ts`, `wait "$CADDY_PID"` retorna `0`, dispara `cleanup 0` encerrando o `sleep 2` do stub `bun` e sai `0`).
- **Alternativa rejeitada**: manter `exec caddy` (impede qualquer teardown de `NEXT_PID` e `MINI_PID` após o arranque do Caddy) ou usar `wait` sem PID (mascara código de saída do Caddy e bloqueia indefinidamente se Next.js permanecer vivo).

### D3 — Higiene Git de `skills/` fora do `candidate-manifest.json`
- **Escolha**: executar `git rm -r --cached skills/` na task de higiene Git mantendo os arquivos locais de `skills/` intactos no disco (já cobertos por `/skills/` em `.gitignore:69`), e excluir explicitamente `skills` do working-tree write scope e de `candidate-manifest.json`.
- **Motivo**: há 412 arquivos rastreados em `skills/`; listá-los em `candidate-manifest.json` inflaria o manifesto perto do limite de 512 entradas do `bridge_guard.py` sem utilidade, pois `bridge_guard.py` valida existência/ausência no sistema de arquivos (e os arquivos devem continuar presentes no disco). A verificação objetiva dessa etapa é `git ls-files skills/` retornar saída vazia e o diretório local `skills/` permanecer preservado.
- **Exclusão associada**: `db/custom.db` também é excluído de `Write paths` e `candidate-manifest.json` e listado em `Exclusions: db/custom.db`.

### D4 — Sanitização de `.env.example`, remoção de scripts legados e reconciliação documental
- **Escolha**:
  - Remover `.zscripts/mini-services-build.sh` e `.zscripts/mini-services-install.sh`.
  - Substituir `.env.example` por `DATABASE_URL="file:./db/custom.db"`, removendo `GITHUB_TOKEN`.
  - Remover `.zscripts/dev.pid` via `git rm -f .zscripts/dev.pid` e acrescentar `*.pid` em `.gitignore`.
  - Atualizar `docs/operacao-empacotamento.md` para orientar smoke check em `GET /` (e `GET /api/accounts` com `200` e `[]`), além de documentar a restrição `XTransformPort=3004` no proxy `:81` e a dependência de `caddy` com teardown coordenado no launcher.

## Risks / Trade-offs

- `[Risk] caddy não está instalado no ambiente local de desenvolvimento/teste` → **Mitigation**: validar sintaxe e conteúdo do `Caddyfile` via asserções estruturais em `.zscripts/tests/packaging.test.ts`, testar lifecycle dos launchers com stubs POSIX determinísticos e executar `caddy validate --config Caddyfile --adapter caddyfile` apenas quando `caddy` existir no ambiente de aceite.
- `[Risk] trap em dash/sh com set -e alterar exit code em cenários de erro` → **Mitigation**: testar explicitamente em `.zscripts/tests/packaging.test.ts` falhas de `DATABASE_URL`, ausência de `caddy`, falha com código não zero do `caddy` (verificando preservação do exit code e término dos PIDs filhos) e sinal `SIGTERM` em `mini-services-start.sh`.
- `[Trade-off] Manter db/custom.db rastreado nesta onda` → **Justification**: decisão explícita do proprietário para coordenar a remoção/distribuição de exemplo com o futuro wizard de instalação sem perder fluxo atual de onboarding.

## Migration Plan

1. Aplicar primeiro as alterações de proxy e lifecycle (Tasks 1.1, 1.2, 1.3) seguindo TDD (RED -> GREEN) em `.zscripts/tests/packaging.test.ts`.
2. Executar a remoção de scripts legados e sanitização de `.env.example` (Task 2.1) e a higiene Git de `.zscripts/dev.pid`, `.gitignore` e `skills/` sem apagar arquivos locais de `skills/` nem tocar `db/custom.db` (Task 2.2).
3. Atualizar `docs/operacao-empacotamento.md` (Task 3.1) após validação das mudanças anteriores e rodar `bun --no-env-file test ./.zscripts/tests/packaging.test.ts`.
4. **Rollback**: caso haja regressão no proxy ou launcher durante a aplicação antes de commit, `git checkout -- <arquivo>` reverte as edições locais (observando que `git rm -r --cached skills/` requer `git reset HEAD -- skills/` se precisar restaurar o índice antes do commit).

## Open Questions

- Nenhuma decisão material aberta nesta Onda 1. A decisão sobre remoção definitiva de `db/custom.db` e oferta de base de exemplo versus base limpa pertence à futura change do wizard de instalação.
