# empacotamento-sem-dados Specification

## Purpose

Garantir que o empacotamento de release produza um artefato inspecionável sem banco de dados nem configuração privada, e que a inicialização exija um SQLite externo preexistente via `DATABASE_URL` explícita com documentação operacional verificável.

## Requirements

### Requirement: Build de release sem configuração de runtime
O build de release MUST rejeitar configuração privada carregável no contexto antes de instalar dependências ou invocar o Next; MUST NOT passar segredos de runtime ao compilador; e MUST NOT ler, copiar ou sincronizar o estado financeiro local como insumo do build. Apenas `.env.example` inerte é aceito como arquivo dotenv do projeto.

#### Scenario: Contexto com dotenv privado
- **WHEN** o contexto contém um dotenv privado sintético
- **THEN** o build falha antes da compilação e não entrega um tarball nem imprime o valor do marcador.

#### Scenario: Build sem banco no contexto
- **WHEN** os pré-requisitos de release são satisfeitos, as saídas obrigatórias de build são válidas e não existe SQLite no contexto
- **THEN** a montagem é concluída sem consultar, criar ou sincronizar qualquer banco.

### Requirement: Artefato final inspecionável sem estado local
O empacotador MUST montar cada execução em árvore privativa nova e verificar o pacote entregue; MUST NOT incluir `db/`, arquivos SQLite locais, seus sidecars, dotenv de runtime nem links para fora do pacote ou para entradas proibidas.

#### Scenario: Material local em uma saída coletada
- **WHEN** a saída simulada de um produtor contém um arquivo proibido ou vínculo não permitido
- **THEN** a verificação falha e o arquivo reprovado não fica disponível como resultado da execução; apenas os resíduos próprios da invocação são removidos.

#### Scenario: Tarball válido
- **WHEN** todas as saídas esperadas e suas entradas são aceitas
- **THEN** o tarball conserva o layout de execução esperado e seu inventário não contém entradas proibidas nem dados da fixture.

### Requirement: SQLite externo explícito ao iniciar
O launcher MUST exigir um `DATABASE_URL` do tipo `file:` com caminho absoluto, sem parâmetros ou escapes, que resolva para arquivo regular, preexistente, não vazio e acessível fora da árvore do pacote. MUST validar antes de iniciar os serviços, não exibir a URL nem o caminho privado completo, e não criar, alterar permissões, popular ou migrar o banco nessa etapa.

#### Scenario: Destino ausente, inválido ou interno ao pacote
- **WHEN** a configuração não existe, não segue o contrato ou aponta para um caminho inexistente ou interno ao pacote após resolução
- **THEN** o launcher retorna falha antes de iniciar Next, Caddy ou mini-serviços e não altera a persistência.

#### Scenario: Fixture SQLite externa provisionada
- **WHEN** o operador fornece a configuração de uma fixture SQLite externa compatível e as dependências de execução estão prontas
- **THEN** a inicialização usa exclusivamente a base configurada, sem seed, migração automática ou fallback; o smoke de consulta consegue ler a base de teste.

### Requirement: Procedimento de operação verificável
O repositório MUST documentar contexto limpo, inspeção do tarball, provisionamento externo, erro de inicialização e diferença entre preparação de base e execução. MUST distinguir os limites históricos e a instância de desenvolvimento, que não é comprovante de release.

#### Scenario: Operador prepara uma release sem base local
- **WHEN** o operador consulta as instruções vigentes para build e start
- **THEN** encontra os pré-requisitos, como verificar o pacote, como iniciar com configuração explícita e quais passos ficam fora da inicialização automática.

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
O repositório MUST remover `.zscripts/mini-services-build.sh` e `.zscripts/mini-services-install.sh`, sanitizar `.env.example` para `DATABASE_URL="file:../db/custom.db"` sem `GITHUB_TOKEN`, remover `.zscripts/dev.pid` com `*.pid` em `.gitignore`, destrackear `skills/` e `db/custom.db` preservando os arquivos no disco e alinhar `docs/operacao-empacotamento.md` ao `GET /` e ao proxy `:3004`.

#### Scenario: Ambiente de exemplo e ausência de scripts legados
- **WHEN** o repositório é inspecionado após a higiene de ambiente e scripts
- **THEN** `.zscripts/mini-services-build.sh` e `.zscripts/mini-services-install.sh` não existem e `.env.example` contém `DATABASE_URL="file:../db/custom.db"` sem `GITHUB_TOKEN` nem `/home/z/my-project/`

#### Scenario: Índice Git livre de PID e duplicatas de skills com preservação local
- **WHEN** o índice Git e o `.gitignore` são verificados após a limpeza
- **THEN** `.zscripts/dev.pid` está ausente, `.gitignore` contém `*.pid`, `git ls-files skills/` não lista arquivos rastreados e a pasta local `skills/` permanece preservada no disco quando presente

#### Scenario: Base local fora do índice Git e higiene de ignore
- **WHEN** o índice Git, o `.gitignore` e a raiz do repositório são inspecionados
- **THEN** `git ls-files db/` não lista `db/custom.db` rastreado mantendo o arquivo local `db/custom.db` intacto no disco, `.gitignore` contém `.env.*`, `!.env.example` e `.playwright-cli/`, e `.env.local` não existe

#### Scenario: Documentação operacional alinhada às rotas e ao proxy vigentes
- **WHEN** o operador consulta `docs/operacao-empacotamento.md` para validar a inicialização isolada
- **THEN** encontra a verificação em `GET /` e `GET /api/accounts` (`200` e `[]`), além da documentação explícita da restrição `XTransformPort=3004` no proxy `:81`

### Requirement: Configurações TypeScript e ESLint livres de diretórios removidos
`tsconfig.json` (`exclude`) e `eslint.config.mjs` (`ignores`) MUST NOT referenciar `"examples"`, `"examples/**"` nem `"skills"`.

#### Scenario: Exclusões limpas em tsconfig.json e eslint.config.mjs
- **WHEN** `tsconfig.json` e `eslint.config.mjs` são inspecionados
- **THEN** `tsconfig.json#exclude` não contém `"examples"` nem `"skills"`, e `eslint.config.mjs#ignores` não contém `"examples/**"` nem `"skills"`

### Requirement: Documentação pública raiz e guia enxuto de agentes
O repositório MUST fornecer `README.md` na raiz em pt-BR para `marcelokarval/sistema-financeiro`, manter `AGENTS.md` enxuto e atualizado ao estado real do repositório, e manter `docs/reference/design-system.contract.md` sem links quebrados para artefatos históricos removidos.

#### Scenario: README.md raiz orienta produto, stack real, setup e links canônicos
- **WHEN** o arquivo `README.md` na raiz é lido e verificado por testes
- **THEN** documenta em pt-BR as 9 visões da SPA, a stack real (incluindo Socket.io em `mini-services/finance-ws/` e nota sobre `z-ai-web-dev-sdk` em `/api/advisor`), pré-requisitos, setup incluindo `bun --no-env-file run db:generate`, tabela de scripts de `package.json`, CI e links relativos incluindo `docs/operacao-empacotamento.md`, `docs/reference/design-system.contract.md`, `AGENTS.md` e `openspec/specs/`

#### Scenario: AGENTS.md enxuto e contrato visual sem links históricos quebrados
- **WHEN** `AGENTS.md` e `docs/reference/design-system.contract.md` são validados
- **THEN** `AGENTS.md` não contém `Framer Motion`, `agent-ctx/` nem `worklog.md` e registra o ruleset ativo `main-ci-protection` (`id: 28102433`), e `docs/reference/design-system.contract.md` remove os links quebrados para `design-system.premium-direction.md`, `design-system.theme.css` e `design-system.html` preservando os links ativos e o contrato de `quiet-navigation.test.tsx`
