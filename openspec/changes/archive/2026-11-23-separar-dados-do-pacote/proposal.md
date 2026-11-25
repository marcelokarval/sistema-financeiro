## Why

O empacotamento atual exige e inclui o SQLite local, misturando estado financeiro e os arquivos executáveis. O build standalone do Next também pode copiar arquivos de ambiente. Separar build e dados persistentes é pré-requisito para distribuir um pacote sem dados reais e iniciar com a base de destino por configuração explícita.

## What Changes

- O build de release deixa de copiar o diretório do banco ou executar sincronização Prisma; verifica o contexto de build e inspeciona a montagem e o arquivo entregue antes de declarar sucesso.
- O launcher exige `DATABASE_URL` para um SQLite preexistente fora do pacote. Não há fallback para um banco empacotado e nenhuma rotina de seed, criação ou migração automática.
- Documentar a preparação do build, a injeção de configuração, a verificação e a transição do operador. Remover o rastreamento dos arquivos sensíveis e avaliar o histórico são frentes separadas, não resultados desta proposta.

## Capabilities

### New Capabilities

- `empacotamento-sem-dados`: composição de pacote sem banco/segredos e configuração SQLite explícita de runtime.

### Modified Capabilities

## Impact

- Afeta `.zscripts/build.sh`, `.zscripts/start.sh`, seus testes e o guia de operação em `docs/`.
- Exige ação do operador antes da próxima implantação: provisionar, fora do pacote, um SQLite compatível e informar `DATABASE_URL`. Não altera schema, HTTP, a instância em desenvolvimento, Caddy, autenticação ou dados existentes.
