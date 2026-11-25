# Implementation plan

**Goal:** Produzir pacote sem banco ou configuração privada e iniciar apenas com um SQLite externo explícito.
**Architecture:** Implementar decisões D1–D4 do [design](design.md), preservando tecnologia, formato e a instância de desenvolvimento.
**Skill mapping and observed invocation:** `brainstorming` e `writing-plans` foram invocadas pelo mecanismo nativo da sessão. `test-driven-development`, o modo de execução autorizado e `requesting-code-review` serão carregados na aplicação.

## Pré-condições da aplicação

- A autorização de aplicação foi dada por “<-- pode”, sem publicação, deploy ou remoção de arquivos do histórico. Reler `openspec status` e `openspec instructions apply` a cada retomada relevante.
- Workspace: raiz deste repositório; base observada: `96de0e44e4d43e574f1b920d7047d95b37261ae5`. Confirmar novamente no início. Preservar os arquivos locais preexistentes e a instância local; não incluir `.env` nem `db/custom.db` no manifesto ou ler seus bytes.
- Nada de stage, commit, backup, deploy, reescrita de histórico ou workspace paralelo. Não chamar build sobre o checkout com configuração privada.
- Antes de preflight, criar `candidate-manifest.json` com caminhos de implementação e estados finais explícitos. Incluir testes e docs afetados; se o escopo mudar, atualizar o manifesto e repetir preflight. Usar `python3 <bundle>/scripts/bridge_guard.py preflight --repo <repo> --base <sha> --change separar-dados-do-pacote` conforme bundle efetivo.

## Task 1.1: Empacotamento sem dados

- Criar `.zscripts/tests/packaging.test.ts` com `bun:test`. Cada caso usa contexto temporário privativo de teste, dados sintéticos e comandos stub; nenhum Next real, rede, release ou acesso à base original nessa suíte. Testar build sem SQLite, recusa de dotenv antes do stub compilador, pacote válido, resíduo preexistente de outra invocação, saída incompleta e material proibido na montagem.
- RED planejado: `bun test .zscripts/tests/packaging.test.ts -t "build|pacote"`. Confirmar falha da regra esperada, não aceitar caminho fixo do Z.ai ou falta de stub como RED. Se o script legado exigir o caminho fixo, reproduzi-lo apenas por mount sintético isolado no teste, ou caracterizar a incompatibilidade separadamente; nunca executar sobre uma instalação real em `/home/z/my-project`.
- Implementar em `.zscripts/build.sh` sobre a raiz de trabalho identificada, preservando as etapas de build; validar contexto/ambiente antes de compilar, eliminar a etapa SQLite, listar entradas finais com mecanismo que preserve nomes e tipos, aceitar links somente dentro da montagem e abortar antes da entrega. Confirmar que resultados de stages obrigatórios não são aproveitados após falha.
- GREEN planejado: repetir o comando RED sem alterar os cenários; `bash -n .zscripts/build.sh`. Registrar saídas reais no apply.

## Task 1.2: Inicialização com SQLite externo

- Na mesma suíte, adicionar casos com stubs de Next, Caddy e auxiliares, em árvore descartável: configuração ausente, malformada, inexistente, interna, caminho que resolve para dentro da árvore, fixture externa válida. Nas recusas, afirmar que nenhum stub iniciou, que não existe fallback e que diagnóstico não revela o marcador. No sucesso, confirmar URL efetiva e ausência de passos Prisma na inicialização.
- RED/GREEN planejados: `bun test .zscripts/tests/packaging.test.ts -t "launcher"`. Alterar `.zscripts/start.sh` somente após RED pertinente, mantendo `sh` e layout do pacote; validar caminhos pelo arquivo real, não apenas pelo texto da URL.
- Validar `sh -n .zscripts/start.sh` e executar a suíte completa antes da revisão.

## Task 2.1: Instruções de operação

- Criar `docs/operacao-empacotamento.md` para orientar o operador sobre ambiente limpo, saída, inspeção, SQLite externo com permissões e schema, smoke e parada. No `AGENTS.md`, descrever a diferença entre `db:push` de desenvolvimento e startup de release, e apontar para o guia vigente.
- Revisar referências ativas com `DATABASE_URL`, `/app/db/custom.db` e empacotamento; corrigir as normativas afetadas e preservar história. Validar alvos dos links e conferir exemplos contra a suíte; não declarar que os arquivos rastreados foram removidos.

## Task 2.2: Provar o candidato e obter revisão independente

- Reexecutar sintaxe, suíte completa e `openspec validate separar-dados-do-pacote --strict`. Fazer build real com o Bun fixado pelo lockfile a partir de contexto autorizado e sem segredos. Inspecionar tar, executar a extração em destino de teste e o launcher em isolamento com base descartável externa; não usar Caddy ou portas reais fora do namespace de teste. Verificar startup com e sem configuração, rota de saúde simples e `GET /api/accounts = 200 []`, sem tocar outros serviços.
- Se não houver contexto limpo autorizado ou alguma prova de runtime não for possível, marcar `NOT VERIFIED` e deixar a tarefa obrigatória aberta. A suíte sintética não substitui o smoke.
- Registrar SHA do candidato segundo o guard, resultados tipados `expected_failure`/`passed` somente quando observados e revisão independente sobre o mesmo escopo. Preencher `verify.md` e `evidence.json`, executar guard `verify`; escrever retrospectiva e repetir `verify` conforme v2. Pendências não viram aprovação ou entrega de release.

## Continuidade

Estado: revisão `a007-revisao-pacote` aceitou os dois ajustes D2 e apontou D1 residual (seleção do diretório por `CDPATH`). `a006-empacotamento` entregou ancoragem absoluta à raiz validada e reconciliou o guia. RED focado em namespace com fixture sintética: `bun --no-env-file test ./.zscripts/tests/packaging.test.ts -t CDPATH`, exit 1, 1 falha de diretório efetivo; GREEN no mesmo comando: exit 0, 1 passou. A re-revisão de `a007-revisao-pacote` aceitou D1 e não encontrou regressão material na fronteira D2 alterada. O parecer confirma o digest `daaceab9766e5f825b7f57786f2296584ab9d4f6a57311c846a68922747875a0` antes deste checkpoint e os cinco arquivos de produto; os bytes desses arquivos não foram alterados no aceite. O lead reexecutou a suíte sem autoload de dotenv: 44 passaram, 0 falhas; sintaxe, links, `git diff --check` no escopo e validação estrita voltaram com exit 0. 1.1, 1.2 e 2.1 aceitas no recorte sintético e documental. Próximo passo do lead (2.2): obter contexto limpo autorizado com os pré-requisitos do guia, fazer build real, inspecionar e extrair o pacote, rodar smoke isolado com `finance-ws` e SQLite externo sintético, e concluir a verificação do bridge. Até lá, build/tar/smoke real e verificação final do bridge permanecem não verificados. Sem publicação, deploy, acesso a dados reais ou alteração do histórico. Goal `goal-2c92362b-5144-4750-a99d-c6dbd646f7fe` (8 rodadas máximas).

Correções com RED/GREEN observados pelo executor em fixture isolada: D1 (7 falhas → 7 sucessos), D2 obrigatório (6 falhas → 6 sucessos), D2 extensão (1 falha → 1 sucesso); suíte final do executor 43/43. Guia reconciliado com pré-requisitos, `finance-ws` obrigatório e limites do gate.

### Provas observadas

- **1.1 — RED do executor:** `bun test ./.zscripts/tests/packaging.test.ts -t "build|pacote"`, exit 1, 10 falhas e 2 sucessos. Implementação anterior exigia banco, não recusava dotenv antes dos produtores e aceitava saídas indevidas. Alias legado limitado ao namespace de RED, ausente da suíte final. **GREEN do executor:** mesmo filtro, exit 0, 12 passaram.
- **1.2 — RED do executor:** `bun test ./.zscripts/tests/packaging.test.ts -t launcher`, exit 1, 17 falhas pertinentes (um cenário de build também selecionado, depois renomeado). **GREEN do executor:** mesmo filtro, exit 0, 17 passaram.
- **2.1:** guia e AGENTS reconciliados; alvos locais dos links conferidos e referências de arquitetura/pesquisa examinadas sem reescrever história.
- **2.2 — verificação parcial do lead:** suíte completa 29/29, `bash -n`, `sh -n`, `git diff --check` no escopo e `openspec validate ... --strict` todos exit 0. Esses resultados não são build de produção nem smoke. Build e smoke reais: NOT VERIFIED, sem contexto limpo autorizado. Candidato originalmente enviado à revisão: `4b8d5c092e23b5e56d4e726e3fe6f712e75ee67f89c10781c1de3f1585e4805b`; conferir bytes por arquivo antes de reaproveitar qualquer prova.
- **2.2 — pré-condições para retomada:** o único checkout registrado é o workspace canônico e contém `.env` e `db/custom.db` (presença e rastreamento verificados, sem abrir os arquivos). Caddy não foi encontrado no `PATH` nem nos caminhos padrão consultados; Bun 1.4.2 e Node 24.20.0 estão disponíveis. Nenhum build ou lançamento real foi tentado. A evidência de runtime fica **NOT VERIFIED**. Retomar quando houver origem de release limpa, identificada e autorizada para os mesmos bytes de produto revisados, com Caddy disponível no ambiente isolado. Não mascarar arquivos do checkout, criar ambiente paralelo, instalar software ou reaproveitar base real sem autorização.

### Evidência exigida na retomada de 2.2

- Vincular a prova ao candidato: comparar os cinco arquivos de produto com os hashes revisados e registrar versão efetiva dos executáveis, origem do contexto limpo, exit do build e hash do tar final. Inspecionar o tar antes de extrair: layout obrigatório, ausência de banco/dotenv/sidecars e links internos válidos; conferir integridade após a extração.
- Usar um namespace de rede e supervisor dedicados. O Caddy de release escuta na porta 81, encaminha a aplicação para a porta 3000, e o `finance-ws` escuta na 3004. Essas portas são internas ao teste; não usar nem expor as portas correspondentes do host.
- No pacote extraído, provar que sem `DATABASE_URL` o launcher sai com falha e sem filhos ativos. Na execução válida, usar apenas uma base SQLite descartável, já provisionada com o schema e fora da extração. Verificar `GET /` e `GET /api/accounts` pelo proxy (200 e lista vazia no segundo caso) e confirmar separadamente que o `finance-ws` do pacote iniciou. Não usar somente a mensagem de sucesso do launcher como prova de prontidão.
- Encerrar os processos pelo supervisor do teste, confirmar ausência de listeners e descartar apenas os artefatos descartáveis identificados. Guardar no OpenSpec os recibos sanitizados, não a base de teste nem o pacote sem autorização de retenção.

**Checkpoint — rodada 8/8.** O lead reexecutou `bun --no-env-file test ./.zscripts/tests/packaging.test.ts` (exit 0; 44 passaram, 0 falhas), a validação estrita do OpenSpec e a sintaxe dos dois scripts (exit 0). O candidato de produto não mudou. A tarefa 2.2 permanece aberta e nenhum aceite de release foi emitido. O limite de rodadas não substitui a prova real; retomar somente após indicação de ambiente limpo autorizado com Caddy.
