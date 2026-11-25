## ADDED Requirements

### Requirement: Restrição do proxy de gateway para porta realtime autorizada
O arquivo `Caddyfile` na porta `:81` MUST restringir `@transform_port_query` exclusivamente para `query XTransformPort=3004` e MUST encaminhar essas requisições apenas para `localhost:3004`, sem wildcard nem interpolação dinâmica de query parameters.

#### Scenario: Requisição realtime autorizada para a porta 3004
- **WHEN** uma requisição chega ao gateway `:81` com `XTransformPort=3004`
- **THEN** o matcher `@transform_port_query` seleciona o bloco e encaminha o tráfego para `localhost:3004` mantendo compatibilidade com `src/hooks/use-realtime.ts`

#### Scenario: Bloqueio de port-pivoting por parâmetro arbitrário
- **WHEN** a configuração do `Caddyfile` é inspecionada quanto a parâmetros `XTransformPort` distintos de `3004`
- **THEN** não há wildcard `XTransformPort=*` nem placeholder `{query.XTransformPort}` em `reverse_proxy`, impedindo redirecionamento para portas arbitrárias de `localhost`

### Requirement: Pré-checagem de dependências e teardown coordenado em start.sh
O launcher `.zscripts/start.sh` MUST validar `caddy` no `PATH` após `DATABASE_URL` e antes de iniciar Next.js ou mini-serviços; MUST registrar `trap` para `EXIT`, `INT` e `TERM` preservando o código de saída real; e MUST iniciar o Caddy em background seguido de `wait` sobre seu PID para encerrar `NEXT_PID` e `MINI_PID`.

#### Scenario: Binário caddy ausente antes da subida dos serviços
- **WHEN** `.zscripts/start.sh` é executado com `DATABASE_URL` válida porém sem `caddy` disponível no `PATH`
- **THEN** o launcher falha com código de saída diferente de zero antes de iniciar o Next.js e os mini-serviços

#### Scenario: Falha ou saída do Caddy após subida dos serviços auxiliares
- **WHEN** o processo `caddy` iniciado por `.zscripts/start.sh` termina com erro após o início do Next.js e dos mini-serviços
- **THEN** o launcher preserva o código de saída não zero do Caddy e encerra os processos filhos (`NEXT_PID` e `MINI_PID`) antes de retornar

#### Scenario: Preservação de falha na validação prévia de SQLite
- **WHEN** `DATABASE_URL` é ausente ou inválida em `.zscripts/start.sh`
- **THEN** o handler de `trap` não converte o código de erro em `0` e o launcher mantém falha diferente de zero sem iniciar serviços

### Requirement: Propagação de sinais e encerramento em mini-services-start.sh
O script `.zscripts/mini-services-start.sh` MUST registrar `trap` para `EXIT`, `INT` e `TERM` preservando o código de saída ou sinal recebido e encerrando todos os processos filhos `bun` iniciados.

#### Scenario: Propagação de sinal em mini-services-start.sh
- **WHEN** `.zscripts/mini-services-start.sh` inicia serviços em background e recebe `SIGTERM`
- **THEN** o script executa sua rotina de limpeza encerrando os processos filhos iniciados e retorna código de saída não zero correspondente ao término

### Requirement: Higiene de scripts legados, exemplo de ambiente, índice Git e documentação
O repositório MUST remover `.zscripts/mini-services-build.sh` e `.zscripts/mini-services-install.sh`, sanitizar `.env.example` para `DATABASE_URL="file:./db/custom.db"` sem `GITHUB_TOKEN`, remover `.zscripts/dev.pid` com `*.pid` em `.gitignore`, destrackear `skills/` preservando os arquivos no disco e alinhar `docs/operacao-empacotamento.md` ao `GET /` e ao proxy `:3004`.

#### Scenario: Ambiente de exemplo e ausência de scripts legados
- **WHEN** o repositório é inspecionado após a higiene de ambiente e scripts
- **THEN** `.zscripts/mini-services-build.sh` e `.zscripts/mini-services-install.sh` não existem e `.env.example` contém `DATABASE_URL="file:./db/custom.db"` sem `GITHUB_TOKEN` nem `/home/z/my-project/`

#### Scenario: Índice Git livre de PID e duplicatas de skills com preservação local
- **WHEN** o índice Git e o `.gitignore` são verificados após a limpeza
- **THEN** `.zscripts/dev.pid` está ausente, `.gitignore` contém `*.pid`, `git ls-files skills/` não lista arquivos rastreados, a pasta local `skills/` permanece intacta no disco e `db/custom.db` permanece intocado nesta onda

#### Scenario: Documentação operacional alinhada às rotas e ao proxy vigentes
- **WHEN** o operador consulta `docs/operacao-empacotamento.md` para validar a inicialização isolada
- **THEN** encontra a verificação em `GET /` e `GET /api/accounts` (`200` e `[]`), além da documentação explícita da restrição `XTransformPort=3004` no proxy `:81`
