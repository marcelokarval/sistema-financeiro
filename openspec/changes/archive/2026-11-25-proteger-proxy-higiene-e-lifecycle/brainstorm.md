# Brainstorming — Proteger proxy, higiene operacional e lifecycle dos launchers

## Mapeamento e invocação de skills observados

- `brainstorming` -> `/home/marcelo-karval/.agents/skills/brainstorming/SKILL.md`: lida integralmente antes da redação e aplicada na inspeção do repositório real, comparação de abordagens, definição de escopo e non-goals desta change.
- `security-audit` (modo guidance) e política compartilhada -> `/home/marcelo-karval/.agents/skills/security-audit/SKILL.md` e `/home/marcelo-karval/.agents/SECURITY-REVIEW.md`: lidas integralmente e aplicadas na análise das fronteiras de confiança (SSRF/port-pivoting no proxy `:81`, exposição de credencial/path legado em `.env.example` e previsibilidade do teardown de processos).
- `project-documentation` -> `/home/marcelo-karval/.agents/skills/project-documentation/SKILL.md`: lida integralmente para identificar e reconciliar o impacto documental em `docs/operacao-empacotamento.md`.
- `writing-plans` -> `/home/marcelo-karval/.agents/skills/writing-plans/SKILL.md`: lida integralmente para estruturar os microcontratos de `plan.md`.

## Contexto e descobertas no código atual

1. **`Caddyfile` (`:81`)**: linhas 2-13 definem `@transform_port_query { query XTransformPort=* }` e `reverse_proxy localhost:{query.XTransformPort}`. A busca em todo o repositório mostra um único consumidor legítimo em `src/hooks/use-realtime.ts:36` (`const SOCKET_URL = '/?XTransformPort=3004';`), compatível com `mini-services/finance-ws/index.ts:174` (`const PORT = 3004`). Qualquer chamador que alcance `:81` pode hoje redirecionar tráfego para qualquer porta local em `localhost`.
2. **`.zscripts/start.sh`**:
   - Valida `DATABASE_URL` nas linhas 17-42 e inicia Next.js (`NEXT_PID`, linha 100) e `mini-services-start.sh` (`MINI_PID`, linha 123), acumulando PIDs em `pids`.
   - Define `cleanup()` nas linhas 48-81 com `exit 0` na linha 80, mas **não registra `trap`** e termina com `exec caddy run --config Caddyfile --adapter caddyfile` na linha 151.
   - Consequências observadas: (a) se `caddy` estiver ausente no `PATH`, Next.js e mini-services já terão sido iniciados e ficam órfãos após falha no `exec`; (b) se `caddy` falhar em runtime ou receber `INT`/`TERM`, `cleanup()` nunca é executado; (c) se `trap cleanup EXIT INT TERM` for adicionado mantendo `exit 0` incondicional em `cleanup()`, qualquer falha prévia (`DATABASE_URL` inválida, falha do Next.js ou falha do Caddy) teria seu código de saída sobrescrito para `0`, quebrando o contrato já testado em `.zscripts/tests/packaging.test.ts` (linhas 237-291).
3. **`.zscripts/mini-services-start.sh`**:
   - Inicia cada `mini-service-*.js` em background, acumula em `pids`, define `cleanup()` nas linhas 10-42 (sem `exit 0`), mas não registra `trap` antes de `wait` (linha 119). Quando `.zscripts/start.sh` envia `SIGTERM` para `MINI_PID`, os processos filhos `bun` não recebem teardown coordenado.
4. **Higiene de scripts, `.env.example`, `.gitignore` e índice Git**:
   - `.zscripts/mini-services-build.sh` e `.zscripts/mini-services-install.sh` contêm `ROOT_DIR="/home/z/my-project/mini-services"` e não possuem nenhum chamador ativo no projeto (`.zscripts/build.sh` e `.zscripts/dev.sh` operam diretamente sobre `./mini-services`).
   - `.env.example` contém `DATABASE_URL=file:/home/z/my-project/db/custom.db` e `GITHUB_TOKEN=ghp_your_token_here`.
   - `.zscripts/dev.pid` está rastreado no Git (`655`), enquanto `.gitignore` não ignora `*.pid`.
   - `skills/` tem 412 arquivos rastreados no índice Git apesar de `/skills/` constar em `.gitignore:69` e de `examples/skills/` já versionar a árvore de referência.
   - `db/custom.db` também está rastreado no Git, mas foi explicitamente separado desta Onda 1 porque sua remoção ou distribuição opcional depende do futuro wizard/tela de instalação (base de exemplo vs. base limpa).
5. **Documentação (`docs/operacao-empacotamento.md`)**:
   - A linha 45 orienta conferir "uma rota simples de saúde e `GET /api/accounts` com `200` e `[]`", mas não existe rota `/api/health` em `src/app/api/` (existe `GET /` na aplicação Next.js e `GET /api` em `src/app/api/route.ts`). Também falta registrar a restrição do proxy em `:81` para `XTransformPort=3004`.

## Decisões e alternativas consideradas

1. **Restrição do `Caddyfile`**:
   - *Alternativa A*: validar lista de portas via regex em `@transform_port_query` mantendo `{query.XTransformPort}` no `reverse_proxy`.
   - *Alternativa B (escolhida)*: restringir `@transform_port_query` a `query XTransformPort=3004` e fixar `reverse_proxy localhost:3004`. Elimina qualquer interpolação de entrada do cliente no upstream e reflete exatamente o único consumidor real (`src/hooks/use-realtime.ts:36`).
2. **Lifecycle e preservação de exit code em `.zscripts/start.sh` e `.zscripts/mini-services-start.sh`**:
   - *Alternativa A*: manter `exec caddy` e delegar teardown a um supervisor externo. Rejeitada porque o launcher é executado diretamente pelo operador e pelos testes de `.zscripts/tests/packaging.test.ts`.
   - *Alternativa B (escolhida)*: validar `command -v caddy` antes de iniciar Next.js e mini-services; registrar `trap` para `EXIT`, `INT` e `TERM` com guarda idempotente (`cleaned_up`) que captura e retorna/sai com o código real (`$?` em `EXIT`, `130` em `INT`, `143` em `TERM`); e em `start.sh` executar `caddy run --config Caddyfile --adapter caddyfile &`, salvar `CADDY_PID=$!`, incluir em `pids` e aguardar com `wait "$CADDY_PID"` para preservar o código de saída do Caddy e disparar o teardown de `NEXT_PID` e `MINI_PID` imediatamente se o Caddy falhar.
3. **Higiene Git de `skills/` sem inflar `candidate-manifest.json`**:
   - Executar `git rm -r --cached skills/` mantém os 412 arquivos locais intactos no disco (já cobertos por `/skills/` no `.gitignore:69`) e evita declarar 412 entradas artificiais em `candidate-manifest.json` (cujo teto do `bridge_guard.py` é 512 entradas e cuja verificação lê apenas presença/ausência no filesystem). A prova dessa higiene é a saída vazia de `git ls-files skills/` combinada com preservação no disco.
4. **Fronteira explícita com `db/custom.db`**:
   - `db/custom.db` permanece intocado nesta onda e é declarado em `Exclusions` das tasks afetadas.
