## MODIFIED Requirements

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

## ADDED Requirements

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
