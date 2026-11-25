# Operação do pacote de produção

## Preparar o contexto de build

- Use exclusivamente um contexto de release limpo e autorizado, com os fontes de confiança e o `bun.lock`, sem banco, credenciais, configuração privada ou saída `.next` anterior. Não use o checkout de desenvolvimento com dados ou segredos, nem mova, renomeie ou masque esses arquivos para passar na validação.
- São necessários Linux, Bash, Bun compatível com os lockfiles, Node.js compatível no `PATH` (`>=20.9.0` para Next 16.1.3), utilitários GNU (`find`, coreutils e `tar` com gzip) e Python 3 (biblioteca padrão, para inspeção). O executável `next` chamado por `bun run build` usa `#!/usr/bin/env node`. Use uma execução por contexto de trabalho: o Next gera `.next` nele, embora a montagem do pacote seja exclusiva de cada execução.
- Antes de chamar Bun, o script verifica se os insumos obrigatórios existem e recusa links simbólicos no caminho do launcher de build ou na árvore varrida, além de nomes `.env*` (exceto arquivo regular `.env.example`, que deve ser inerte). A varredura não segue links nem entra nos diretórios `.git` e `db` na raiz. Ela só inspeciona entradas: não confina processos, não valida conteúdo ou procedência e não substitui manter o contexto limpo, confiável e sem modificações concorrentes. Não reutilize uma árvore com links de dependências preexistentes, como `node_modules/.bin`.
- Inclua as fontes de `mini-services/finance-ws`, com manifesto, `bun.lock` e ponto de entrada, e o launcher dos mini-serviços. Sem esses insumos não é produzido pacote. Outros mini-serviços regulares com manifesto, lockfile e ponto de entrada também são empacotados.
- Use um `PATH` confiável. O script entra na raiz validada do projeto e nos diretórios dos mini-serviços por caminhos absolutos, sem consultar `CDPATH`. Os comandos Bun recebem apenas `PATH`, `HOME` e `TMPDIR` privativos da execução, `LC_ALL=C` e `NEXT_TELEMETRY_DISABLED=1`. `DATABASE_URL` e demais configurações de execução não devem ser usadas no build.

No contexto autorizado, rode a partir da raiz:

```sh
bash .zscripts/build.sh
```

## Conferir a saída

O resultado é o caminho impresso em `Pacote verificado:` (`/tmp/build_fullstack_<id>.<sufixo>.tar.gz`). `BUILD_ID` é opcional, com letras ASCII, dígitos, ponto, hífen ou sublinhado. A publicação é apenas a entrega desse arquivo local: o script não envia o pacote, não apaga saídas de outras execuções e não sincroniza nem copia o banco. Falhas antes da entrega não deixam um novo pacote; a montagem privada é removida. O contexto de build pode permanecer com a saída `.next` e dependências geradas: não interprete a limpeza da montagem como limpeza do contexto.

Confira o inventário do arquivo exato informado pelo script, sem misturá-lo com resultados anteriores:

```sh
pacote=/tmp/build_fullstack_local.SUFIXO.tar.gz  # substitua pelo caminho informado
tar -tvzf "$pacote"
```

Confirme `start.sh`, `Caddyfile`, `next-service-dist/server.js`, seus estáticos e `public`, além de `mini-services-dist/mini-service-finance-ws.js` e `mini-services-start.sh`. Não aceite `db/`, dotenv (nem o template no pacote), arquivos `.db`, `.sqlite`, `.sqlite3` ou sidecars `-wal`, `-shm` e `-journal`, links absolutos, links que saiam da árvore, links para entradas proibidas ou hard links. A listagem manual complementa, não substitui, o confronto estruturado do tar com a montagem verificada. O filtro de estrutura não detecta segredos arbitrários embutidos em arquivos permitidos: é indispensável usar uma origem limpa e confiável.

## Preparar a base e iniciar

1. **Antes** de iniciar, provisione um SQLite compatível com o [schema Prisma](<../prisma/schema.prisma>), fora da árvore de extração. A conta de serviço deve conseguir ler e, para operação normal de escrita, gravar no banco e criar os sidecars no diretório. Proteja esse diretório e o pacote contra modificações por usuários não confiáveis.
2. Injete `DATABASE_URL` pelo ambiente de execução, no formato `file:/caminho/absoluto`. Não use autoridade (`file://`), parâmetros, fragmentos, escapes ou caracteres de controle. O caminho real após resolver links deve continuar fora do pacote e apontar para um arquivo existente, regular, não vazio e legível.
3. Com Bun, Caddy e `realpath` GNU disponíveis no ambiente aprovado, execute o launcher a partir do pacote extraído. Exemplo com **caminho fictício**:

   ```sh
   DATABASE_URL=file:/srv/dados-financeiro/base.sqlite sh ./start.sh
   ```

Se a configuração não passar na validação, o launcher termina antes de iniciar os serviços e não imprime a URL ou o caminho privado. Corrija a configuração ou o provisionamento e não contorne a rejeição com um banco no pacote. Validar o arquivo não verifica seu conteúdo nem o schema; o launcher não cria banco, roda seed, `db:push` ou migração. `bun run db:push` é uma operação explícita de desenvolvimento; a preparação do destino de produção é uma operação separada, previamente autorizada.

O launcher `start.sh` verifica a disponibilidade de `caddy` no `PATH` logo após validar `DATABASE_URL` e antes de iniciar o Next.js ou os mini-serviços. Ao receber `EXIT`, `INT` ou `TERM` (ou quando o processo Caddy termina), o teardown coordenado em `start.sh` e `mini-services-start.sh` encerra os processos filhos iniciados preservando o código de saída real. O gateway `Caddyfile` na porta `:81` encaminha o tráfego padrão para `localhost:3000` e aceita exclusivamente `XTransformPort=3004` (encaminhando somente para `localhost:3004`, destinado ao serviço `finance-ws`), bloqueando redirecionamento por query string para portas arbitrárias.

## Aceite em ambiente isolado e parada

- A regressão `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` usa stubs e fixtures desprovidas de dados reais; não comprova um build ou uma subida reais.
- Quando o contexto limpo e o ambiente de teste forem autorizados, faça o build real, inspecione o tar e extraia em destino isolado autorizado. Provisione uma base SQLite sintética compatível, vazia de registros e externa ao pacote. Prove a recusa sem configuração, depois a inicialização com a fixture; confira `GET /` e `GET /api/accounts` com `200` e `[]`. Mantenha serviços e portas restritos ao isolamento de teste. Ao final pare os processos de teste pelo mesmo supervisor ou mecanismo que os iniciou e descarte apenas os resíduos de teste previamente identificados. Se qualquer prova falhar, não promova nem recorra a pacote antigo com banco embutido.
- A instância em desenvolvimento e os testes sintéticos não comprovam a release. Esta mudança não publica, não implanta nem altera artefatos antigos, índice ou histórico Git. Arquivos sensíveis já rastreados e eventuais distribuições anteriores exigem tratamento separado.
