# Implementation plan

Bridge task contract: 1

**Goal:** Eliminar o port-pivoting no `Caddyfile`, assegurar pré-validação de `caddy` e teardown de processos com preservação de código de saída em `.zscripts/start.sh` e `.zscripts/mini-services-start.sh`, executar a higiene de scripts legados/ambiente/índice Git (preservando `skills/` no disco e sem tocar `db/custom.db`) e alinhar `docs/operacao-empacotamento.md`.
**Architecture:** Restringir `@transform_port_query` para `query XTransformPort=3004` e `reverse_proxy localhost:3004`; trocar `exec caddy` por execução em background + `wait "$CADDY_PID"` sob `trap` idempotente de `EXIT`, `INT` e `TERM` preservando exit code em `start.sh` e `mini-services-start.sh`; isolar higiene Git (`git rm -f .zscripts/dev.pid`, `git rm -r --cached skills/`, `*.pid` em `.gitignore`) da remoção de scripts legados; manter `db/custom.db` intocado como non-goal desta onda.
**Skill mapping and observed invocation:** `writing-plans` -> `/home/marcelo-karval/.agents/skills/writing-plans/SKILL.md` (lida e aplicada na decomposição por microcontratos); `brainstorming` -> `/home/marcelo-karval/.agents/skills/brainstorming/SKILL.md` (lida e registrada em `brainstorm.md`); `security-audit` -> `/home/marcelo-karval/.agents/skills/security-audit/SKILL.md` e `/home/marcelo-karval/.agents/SECURITY-REVIEW.md` (modo guidance); `project-documentation` -> `/home/marcelo-karval/.agents/skills/project-documentation/SKILL.md`.

## Task 1.1: Restringir `@transform_port_query` no `Caddyfile` para `XTransformPort=3004` com testes automatizados

- Depends on: none
- Needs: none
- Outcome: `Caddyfile` aceita somente `query XTransformPort=3004` encaminhando exclusivamente para `localhost:3004`, sem wildcard nem placeholder dinâmico, validado por teste automatizado em `.zscripts/tests/packaging.test.ts`.
- Owner/resolver: Executor designado da Onda 1 / Coordenador do swarm para eventual conflito de escopo.
- Inputs: `Caddyfile`, `src/hooks/use-realtime.ts` (linha 36, único consumidor `/?XTransformPort=3004`), `mini-services/finance-ws/index.ts` (porta `3004`).
- Produces: caddyfile-port-3004-restricted
- Write paths: Caddyfile, .zscripts/tests/packaging.test.ts
- Exclusions: db/custom.db, src/hooks/use-realtime.ts, .zscripts/build.sh
- Shared resources: test:packaging-suite
- Acceptance: `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` passa incluindo o teste de restrição do `Caddyfile` (e se `caddy` existir no ambiente de aceite, `caddy validate --config Caddyfile --adapter caddyfile` retorna exit 0).
- Stop: Descoberta de outro consumidor legítimo de `XTransformPort` diferente de `3004` no código-fonte.
- Resume: Confirmação do único consumidor na porta `3004` ou atualização explícita de escopo pelo coordenador.

Passos de execução (TDD):
1. RED: adicionar em `.zscripts/tests/packaging.test.ts` um teste que lê `Caddyfile` real do repositório e exige presença de `query XTransformPort=3004` e `reverse_proxy localhost:3004`, bem como ausência de `XTransformPort=*` e `{query.XTransformPort}`.
2. Executar `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` e confirmar falha esperada (RED) por `Caddyfile` ainda conter `XTransformPort=*` e `localhost:{query.XTransformPort}`.
3. GREEN: editar `Caddyfile` para:

```caddyfile
:81 {
	@transform_port_query {
		query XTransformPort=3004
	}

	handle @transform_port_query {
		reverse_proxy localhost:3004 {
			header_up Host {host}
			header_up X-Forwarded-For {remote_host}
			header_up X-Forwarded-Proto {scheme}
			header_up X-Real-IP {remote_host}
		}
	}

	handle {
		reverse_proxy localhost:3000 {
			header_up Host {host}
			header_up X-Forwarded-For {remote_host}
			header_up X-Forwarded-Proto {scheme}
			header_up X-Real-IP {remote_host}
		}
	}
}
```

4. Executar `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` e confirmar todos os testes passando (GREEN).

- RED command and observed failure: `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` (exit 1; 44 aprovados, 1 reprovação em `Caddyfile restringe XTransformPort exclusivamente para 3004 sem wildcard ou placeholder dinâmico`: `Expected to contain: "query XTransformPort=3004"` porque `Caddyfile` ainda continha `XTransformPort=*`)
- GREEN command and observed result: `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` (exit 0; 45 aprovados, 0 reprovações, 325 asserções após editar `Caddyfile`; suíte final após todas as alterações: 48 aprovados, 0 reprovações, 334 asserções)
- Typed evidence outcomes: `caddyfile-port-3004-restricted` produzido; SHA-256 `Caddyfile` = `0f8d79fc70a6343da9ce768d147c139136dc2de49b23a97f86c1db2fd50ecd13`
- Review candidate identity and reviewer: `verifier-apply-6` (Fase 1 PASS em `#260`; Fase 2 sobre o candidato final pós-`#274`; base `418e6f0396f2fd0973a170dac8c5f2dd243c3f16`; QA `#256` e `#274` com `test:scripts` `66` aprovados).
- Remaining gaps: `caddy` não instalado no ambiente local (`command -v caddy` ausente), portanto `caddy validate --config Caddyfile --adapter caddyfile` não pôde ser executado localmente

## Task 1.2: Validar `caddy` antes dos serviços e implementar teardown com preservação de exit code em `.zscripts/start.sh`

- Depends on: none
- Needs: none
- Outcome: `.zscripts/start.sh` rejeita ausência de `caddy` no `PATH` antes de iniciar Next.js e mini-services, registra `trap` para `EXIT`, `INT` e `TERM` sem sobrescrever códigos de erro com `0`, e executa `caddy run --config Caddyfile --adapter caddyfile &` seguido de `wait "$CADDY_PID"` para encerrar `NEXT_PID` e `MINI_PID` quando o Caddy falhar ou encerrar, preservando os 44 testes existentes de `.zscripts/tests/packaging.test.ts`.
- Owner/resolver: Executor designado da Onda 1 / Coordenador do swarm para decisões de contrato de launcher.
- Inputs: `.zscripts/start.sh`, `.zscripts/tests/packaging.test.ts`.
- Produces: start-sh-caddy-preflight-and-teardown
- Write paths: .zscripts/start.sh, .zscripts/tests/packaging.test.ts
- Exclusions: db/custom.db, .zscripts/build.sh, .zscripts/dev.sh
- Shared resources: test:packaging-suite
- Acceptance: `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` passa em todos os 44 casos existentes (incluindo todas as falhas de `DATABASE_URL` retornando exit diferente de zero) e nos novos testes de ausência de `caddy` (nenhum serviço iniciado, exit diferente de zero) e falha do `caddy` após subida de serviços (exit code do Caddy preservado e `NEXT_PID`/`MINI_PID` encerrados).
- Stop: Regressão em qualquer caso da suíte `launcher valida a fronteira do SQLite antes dos serviços` ou processos filhos órfãos após retorno do script.
- Resume: Ajuste do handler `cleanup` / `trap` em `.zscripts/start.sh` restaurando preservação de exit code e encerramento completo de `$pids`.

Passos de execução (TDD):
1. RED: adicionar testes em `.zscripts/tests/packaging.test.ts` usando `runShell("sh", ...)` com fixture isolada para: (a) `DATABASE_URL` válida sem `bin/caddy` no `PATH` -> espera exit diferente de `0`, ausência de `launcher.log` e diagnóstico mencionando `caddy`; (b) `DATABASE_URL` válida com `bin/bun` e `mini-services-start.sh` escrevendo seus PIDs e aguardando em `sleep`, e `bin/caddy` saindo com `exit 17` -> espera `result.status === 17` e que os PIDs gravados de `NEXT_PID` e `MINI_PID` não estejam mais vivos após o retorno de `start.sh`.
2. Executar `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` e confirmar falha esperada (RED).
3. GREEN: atualizar `.zscripts/start.sh`:
   - Logo após a validação de `DATABASE_URL` (linha 42), verificar `command -v caddy >/dev/null 2>&1 || { echo "Erro: caddy não encontrado no PATH." >&2; exit 1; }`.
   - Substituir `cleanup()` para receber `rc=${1:-$?}`, guardar idempotência com `cleaned_up=0`, desarmar traps (`trap - EXIT INT TERM`), pular `sleep 1` se nenhum PID em `$pids` estiver vivo, enviar `SIGTERM`, aguardar até 5s e enviar `SIGKILL` caso necessário, retornando `"$rc"` (removendo `exit 0` da linha 80).
   - Registrar `trap 'rc=$?; cleanup "$rc"; exit "$rc"' EXIT`, `trap 'cleanup 130; exit 130' INT`, `trap 'cleanup 143; exit 143' TERM`.
   - Substituir `exec caddy run --config Caddyfile --adapter caddyfile` por:

```sh
caddy run --config Caddyfile --adapter caddyfile &
CADDY_PID=$!
pids="$pids $CADDY_PID"
wait "$CADDY_PID"
```

4. Executar `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` e confirmar todos os testes passando (GREEN).

- RED command and observed failure: `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` (exit 1; 45 aprovados, 2 reprovações: `launcher falha antes dos serviços quando caddy não está no PATH` falhou em `existsSync(launcher.log)` igual a `true`, e `launcher preserva código de saída do caddy e encerra NEXT_PID e MINI_PID` falhou em `isPidAlive(nextPid)` igual a `true`)
- GREEN command and observed result: `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` (exit 0; 47 aprovados, 0 reprovações, 331 asserções após editar `.zscripts/start.sh`; suíte final: 48 aprovados, 0 reprovações, 334 asserções)
- Typed evidence outcomes: `start-sh-caddy-preflight-and-teardown` produzido; SHA-256 `.zscripts/start.sh` = `04773325540b63bb43fe17c30e5f8096e74de140fa65137a0876ebe67406563f`
- Review candidate identity and reviewer: `verifier-apply-6` (Fase 1 PASS em `#260`; Fase 2 sobre o candidato final pós-`#274`; base `418e6f0396f2fd0973a170dac8c5f2dd243c3f16`; QA `#256` e `#274` com `test:scripts` `66` aprovados).
- Remaining gaps: execução real de `caddy` no launcher permanece dependente da presença do binário `caddy` no ambiente alvo

## Task 1.3: Registrar `trap cleanup EXIT INT TERM` com preservação de exit code em `.zscripts/mini-services-start.sh`

- Depends on: none
- Needs: none
- Outcome: `.zscripts/mini-services-start.sh` registra `trap` para `EXIT`, `INT` e `TERM` usando `cleanup` idempotente que encerra os processos `bun` iniciados e preserva o código de saída ou sinal recebido (`130`/`143`), validado por teste automatizado em `.zscripts/tests/packaging.test.ts`.
- Owner/resolver: Executor designado da Onda 1 / Coordenador do swarm para decisões de lifecycle.
- Inputs: `.zscripts/mini-services-start.sh`, `.zscripts/tests/packaging.test.ts`.
- Produces: mini-services-start-trap-lifecycle
- Write paths: .zscripts/mini-services-start.sh, .zscripts/tests/packaging.test.ts
- Exclusions: db/custom.db, .zscripts/build.sh, .zscripts/dev.sh
- Shared resources: test:packaging-suite
- Acceptance: `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` passa no novo teste que inicia `.zscripts/mini-services-start.sh` com um stub `bin/bun` de longa duração, envia `SIGTERM` ao processo principal e comprova encerramento do processo filho `bun` e código de saída não zero.
- Stop: Processo filho `bun` permanecer vivo após `SIGTERM` em `mini-services-start.sh` ou código de saída alterado para `0` em término por sinal.
- Resume: Correção da captura de código/sinal e ciclo `SIGTERM`/`SIGKILL` sobre `$pids` em `.zscripts/mini-services-start.sh`.

Passos de execução (TDD):
1. RED: adicionar teste em `.zscripts/tests/packaging.test.ts` que copia `.zscripts/mini-services-start.sh` para uma fixture com `mini-services-dist/mini-service-demo.js` e stub `bin/bun` que grava seu PID em arquivo e executa `exec /bin/sleep 10`; após o PID ser gravado, envia `SIGTERM` ao processo `sh mini-services-start.sh`, aguarda o término e verifica saída diferente de `0` e término do PID filho.
2. Executar `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` e confirmar falha esperada (RED), pois atualmente `mini-services-start.sh` não tem `trap`.
3. GREEN: atualizar `.zscripts/mini-services-start.sh` adicionando guarda `cleaned_up=0`, `rc=${1:-$?}` e `return "$rc"` em `cleanup()` (sem `sleep 1` quando nenhum PID está vivo) e registrando:

```sh
trap 'rc=$?; cleanup "$rc"; exit "$rc"' EXIT
trap 'cleanup 130; exit 130' INT
trap 'cleanup 143; exit 143' TERM
```

4. Executar `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` e confirmar todos os testes passando (GREEN).

- RED command and observed failure: `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` (exit 1; 47 aprovados, 1 reprovação em `mini-services-start.sh propaga SIGTERM aos filhos bun e preserva saída não zero`: `expect(isPidAlive(childPid)).toBe(false)` recebeu `true`)
- GREEN command and observed result: `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` (exit 0; 48 aprovados, 0 reprovações, 334 asserções após editar `.zscripts/mini-services-start.sh`)
- Typed evidence outcomes: `mini-services-start-trap-lifecycle` produzido; SHA-256 `.zscripts/mini-services-start.sh` = `ca66b0ab691687ed1050bf673f922fd85ab8ad3199ae25848826b53001d95350`, SHA-256 `.zscripts/tests/packaging.test.ts` = `08273b751506a522d5def776e518aa6f6dd2cd93af27f1bdc105dd27aaec5074`
- Review candidate identity and reviewer: `verifier-apply-6` (Fase 1 PASS em `#260`; Fase 2 sobre o candidato final pós-`#274`; base `418e6f0396f2fd0973a170dac8c5f2dd243c3f16`; QA `#256` e `#274` com `test:scripts` `66` aprovados).
- Remaining gaps: nenhum na cobertura automatizada de sinalização com stub POSIX

## Task 2.1: Remover scripts legados de mini-serviços e sanitizar `.env.example`

- Depends on: none
- Needs: none
- Outcome: `.zscripts/mini-services-build.sh` e `.zscripts/mini-services-install.sh` (com path `/home/z/my-project/`) deixam de existir e `.env.example` passa a conter exclusivamente `DATABASE_URL="file:./db/custom.db"` sem `GITHUB_TOKEN`.
- Owner/resolver: Executor designado da Onda 1 / Coordenador do swarm caso haja dependência não mapeada nos scripts.
- Inputs: `.zscripts/mini-services-build.sh`, `.zscripts/mini-services-install.sh`, `.env.example`.
- Produces: legacy-scripts-removed-and-env-sanitized
- Write paths: .zscripts/mini-services-build.sh, .zscripts/mini-services-install.sh, .env.example
- Exclusions: db/custom.db, .zscripts/build.sh, .zscripts/dev.sh
- Shared resources: none
- Acceptance: Ausência no disco de `.zscripts/mini-services-build.sh` e `.zscripts/mini-services-install.sh`; `.env.example` igual a `DATABASE_URL="file:./db/custom.db"` sem `GITHUB_TOKEN` nem `/home/z/my-project/`; `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` passa sem regressão.
- Stop: Descoberta de referência funcional ativa a `.zscripts/mini-services-build.sh`, `.zscripts/mini-services-install.sh` ou `GITHUB_TOKEN`.
- Resume: Remoção ou confirmação de inexistência de chamadores ativos pelo coordenador.

Passos de execução:
1. Confirmar com `rg` que nenhum script ou código ativo referencia `mini-services-build.sh`, `mini-services-install.sh` ou `GITHUB_TOKEN` em `.env.example`.
2. Remover `.zscripts/mini-services-build.sh` e `.zscripts/mini-services-install.sh`.
3. Reescrever `.env.example` com conteúdo único:

```dotenv
DATABASE_URL="file:./db/custom.db"
```

4. Verificar que `db/custom.db` permanece intacto e rodar `bun --no-env-file test ./.zscripts/tests/packaging.test.ts`.

- RED command and observed failure: não aplicável (remoção de scripts legados sem referência ativa e sanitização de `.env.example`, confirmada via `rg` sem chamadores ativos)
- GREEN command and observed result: `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` (exit 0; 48 aprovados, 0 reprovações, 334 asserções) e remoção verificada de `.zscripts/mini-services-build.sh` e `.zscripts/mini-services-install.sh`
- Typed evidence outcomes: `legacy-scripts-removed-and-env-sanitized` produzido; SHA-256 `.env.example` = `9f443383a886887ddde847e4fe3966303ae7d77fa2890480033b960e6964cbe7`
- Review candidate identity and reviewer: `verifier-apply-6` (Fase 1 PASS em `#260`; Fase 2 sobre o candidato final pós-`#274`; base `418e6f0396f2fd0973a170dac8c5f2dd243c3f16`; QA `#256` e `#274` com `test:scripts` `66` aprovados).
- Remaining gaps: nenhum

## Task 2.2: Remover `.zscripts/dev.pid` e `skills/` do índice Git mantendo `skills/` no disco e adicionar `*.pid` ao `.gitignore`

- Depends on: none
- Needs: none
- Outcome: `.zscripts/dev.pid` removido via `git rm -f`, regra `*.pid` adicionada ao `.gitignore`, e `skills/` (412 arquivos duplicados cobertos por `/skills/` no `.gitignore:69`) removido apenas do índice via `git rm -r --cached skills/` mantendo todos os arquivos locais de `skills/` intactos no disco e excluídos de `candidate-manifest.json` para não inflar o manifesto.
- Owner/resolver: Executor designado da Onda 1 / Coordenador do swarm para autorização explícita do comando `git rm` sobre o índice.
- Inputs: `.zscripts/dev.pid`, `.gitignore`, índice Git de `skills/`.
- Produces: git-index-pid-and-skills-hygiene
- Write paths: .zscripts/dev.pid, .gitignore
- Exclusions: db/custom.db, skills, examples/skills
- Shared resources: git:index
- Acceptance: `.zscripts/dev.pid` ausente no disco e em `git ls-files .zscripts/dev.pid`; `.gitignore` contém `*.pid`; `git ls-files skills/` retorna vazio; `test -d skills/ASR` confirma arquivos locais preservados no disco; `git ls-files db/custom.db` permanece inalterado (`db/custom.db` não foi tocado).
- Stop: Qualquer tentativa de apagar arquivos locais de `skills/` no disco, alterar `db/custom.db` ou executar `git commit`.
- Resume: Autorização do coordenador para manipulação do índice Git restrita a `.zscripts/dev.pid` e `--cached skills/`.

Passos de execução:
1. Verificar estado inicial com `git ls-files .zscripts/dev.pid`, `git ls-files skills/ | wc -l` e `git ls-files db/custom.db`.
2. Executar `git rm -f .zscripts/dev.pid` (remove do índice e do disco) e adicionar `*.pid` em seção apropriada de `.gitignore`.
3. Executar `git rm -r --cached skills/` (remove os 412 caminhos apenas do índice Git, preservando `skills/` localmente no disco; deliberadamente omitido de `candidate-manifest.json` por permanecer `present` no disco e respeitar o limite de 512 entradas de `bridge_guard.py`).
4. Confirmar `test ! -e .zscripts/dev.pid`, `git ls-files skills/` vazio, `test -d skills` preservado no disco e `git status --short db/custom.db` sem alterações.

- RED command and observed failure: não aplicável (higiene de índice Git e `.gitignore`; estado inicial verificado: `.zscripts/dev.pid` rastreado e 412 arquivos em `skills/` rastreados)
- GREEN command and observed result: `git rm -f .zscripts/dev.pid` e `git rm -r --cached skills/` concluídos com exit 0; `git ls-files .zscripts/dev.pid` e `git ls-files skills/` vazios, `skills/ASR` preservado no disco, `db/custom.db` intocado, e `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` (48 aprovados, 0 reprovações)
- Typed evidence outcomes: `git-index-pid-and-skills-hygiene` produzido; SHA-256 `.gitignore` = `5c68447c76f2f08e7d5fa7d5fd56ffddca5027079421d378fa17e3606021b96b`
- Review candidate identity and reviewer: `verifier-apply-6` (Fase 1 PASS em `#260`; Fase 2 sobre o candidato final pós-`#274`; base `418e6f0396f2fd0973a170dac8c5f2dd243c3f16`; QA `#256` e `#274` com `test:scripts` `66` aprovados).
- Remaining gaps: efetivação definitiva da remoção no histórico depende de commit futuro autorizado

## Task 3.1: Atualizar `docs/operacao-empacotamento.md` para smoke check em `GET /` e restrição do proxy `:3004`

- Depends on: 1.1, 1.2, 1.3
- Needs: 1.1 => caddyfile-port-3004-restricted
- Needs: 1.2 => start-sh-caddy-preflight-and-teardown
- Needs: 1.3 => mini-services-start-trap-lifecycle
- Outcome: `docs/operacao-empacotamento.md` alinhado ao comportamento entregue: linha 45 orienta conferir `GET /` (em vez de rota de saúde inexistente) e `GET /api/accounts` com `200` e `[]`, além de documentar a restrição do proxy `:81` para `XTransformPort=3004` e o pré-requisito/teardown de `caddy` no launcher.
- Owner/resolver: Executor designado da Onda 1 / Coordenador do swarm para revisão documental.
- Inputs: `docs/operacao-empacotamento.md`, `src/app/api/` (confirmação de ausência de `/api/health`).
- Produces: packaging-docs-reconciled
- Write paths: docs/operacao-empacotamento.md
- Exclusions: db/custom.db, AGENTS.md, Caddyfile, .zscripts/start.sh, .zscripts/mini-services-start.sh
- Shared resources: none
- Acceptance: Inspeção semântica de `docs/operacao-empacotamento.md` confirma menção explícita a `GET /` e `GET /api/accounts` na seção `Aceite em ambiente isolado e parada`, registro da restrição `XTransformPort=3004` no proxy `:81`, ausência de menção a `/api/health` e integridade dos links Markdown locais.
- Stop: Divergência entre o contrato implementado nas Tasks 1.1-1.3 e a documentação proposta.
- Resume: Reconciliação das tasks 1.1-1.3 aprovada antes da atualização documental.

Passos de execução:
1. Conferir as saídas das Tasks 1.1, 1.2 e 1.3 para refletir exatamente o contrato entregue em `Caddyfile`, `.zscripts/start.sh` e `.zscripts/mini-services-start.sh`.
2. Editar `docs/operacao-empacotamento.md`:
   - Na seção `Preparar a base e iniciar` (ou nota operacional adjacente), registrar que o gateway `:81` aceita apenas `XTransformPort=3004` (`localhost:3004` para `finance-ws`) e que `start.sh` valida `caddy` antes de subir os serviços e propaga teardown em `EXIT`/`INT`/`TERM`.
   - Na linha 45 (`Aceite em ambiente isolado e parada`), substituir `uma rota simples de saúde` por `GET /` (mantendo `GET /api/accounts` com `200` e `[]`).
3. Validar links e consistência do documento com o estado entregue sem alterar arquivos fora de `docs/operacao-empacotamento.md`.

- RED command and observed failure: não aplicável (reconciliação documental após conclusão das Tasks 1.1-1.3; `src/app/api/` inspecionado sem `/api/health`)
- GREEN command and observed result: `docs/operacao-empacotamento.md` atualizado com `GET /`, `GET /api/accounts` (`200` e `[]`), restrição `XTransformPort=3004` em `:81` e pré-checagem/teardown de `caddy` em `start.sh`; link `../prisma/schema.prisma` verificado no disco; suíte final `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` com 48 aprovados, 0 reprovações
- Typed evidence outcomes: `packaging-docs-reconciled` produzido; SHA-256 `docs/operacao-empacotamento.md` = `847e691189a5c1950a8a16747c5f5bdeb10439ab028c6a119cb1d7e5dbdd0368`
- Review candidate identity and reviewer: `verifier-apply-6` (Fase 1 PASS em `#260`; Fase 2 sobre o candidato final pós-`#274`; base `418e6f0396f2fd0973a170dac8c5f2dd243c3f16`; QA `#256` e `#274` com `test:scripts` `66` aprovados).
- Remaining gaps: nenhum
