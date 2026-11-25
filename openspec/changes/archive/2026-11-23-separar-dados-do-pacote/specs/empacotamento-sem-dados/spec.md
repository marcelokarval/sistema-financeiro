## ADDED Requirements

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
