## Context

O build Z monta a saída standalone do Next, estáticos, `public`, mini-serviços e launchers. Atualmente exige `db/custom.db`, copia `db/` e usa `db:push` na cópia. A inicialização usa fallback para `/app/db/custom.db`. A implementação instalada do Next 16.1.3 inclui `.env` e `.env.production` quando estão no conjunto carregado pelo build; ignorar no Git ou excluir apenas `db/` não oferece a garantia proposta.

## Goals / Non-Goals

**Goals:** pacote funcional sem estado financeiro nem configuração privada; startup explícito e seguro; prova com dados sintéticos; instruções coerentes para operador.

**Non-Goals:** mudar schema Prisma, publicar ou implantar, abrir o banco real, configurar rede, corrigir Caddy/Socket.IO, retirar arquivos do índice, reescrever histórico ou criar backup.

## Decisions

### D1 — Contexto de release sem dados ou configuração privada

Bloquear a entrada de release se houver `.env*` de runtime no contexto de build (permitir apenas o template inerte `.env.example`). Não usar a configuração privada do operador no build. Usar lista positiva de variáveis de build, sem encaminhar `DATABASE_URL` ou credenciais de runtime. Não mover, renomear ou mascarar arquivos sensíveis no checkout para aprovar o gate. A forma de disponibilizar um contexto limpo deve respeitar os grants existentes; não criar clone/worktree ou instalar um runtime alternativo.

### D2 — Montagem isolada e verificação antes de disponibilizar

Manter `tar.gz` e o layout dos executáveis existentes. Montar em diretório novo e privativo de nome único por invocação, sem reutilizar saída; copiar só as saídas esperadas e preservar os artefatos necessários para Next e mini-serviços. Não executar Prisma de dados no build. Validar a árvore e as entradas do tar antes de disponibilizá-lo: proibir dotenv, `db/`, arquivos SQLite de dados (.db/.sqlite/.sqlite3 e sidecars) e impedir links que escapem da árvore ou alcancem arquivos proibidos. Se falhar, não disponibilizar o pacote e remover apenas resíduos conhecidos da própria invocação.

### D3 — Runtime explícito e sem efeitos sobre a persistência no startup

Antes de iniciar Next, mini-serviços ou proxy, exigir `DATABASE_URL=file:/caminho/absoluto` (sem parâmetros nem escapes no contrato inicial), resolver o caminho real e confirmar arquivo regular, preexistente, não vazio, acessível e fora da árvore resolvida do pacote. Não criar arquivo, alterar permissões, ler registros financeiros ou executar migração/seed na validação. Diagnósticos não imprimem a URL nem o caminho privado completo. Arquivo existente não implica schema compatível; o smoke autorizado comprova isso para a fixture.

### D4 — Documentação alinhada ao fluxo em uso

Acrescentar `docs/operacao-empacotamento.md` com o fluxo oficial (contexto limpo, build, banco externo, pré-requisitos e verificação) e apontar para ele em `AGENTS.md`; distinguir `db:push` de desenvolvimento da inicialização de release. Revisar referências ativas para não perpetuar instruções sobre o fallback empacotado; preservar worklogs e relatos históricos, sinalizando-os quando necessário.

## Risks / Trade-offs

- Pré-condições rejeitam o checkout atual como origem direta de release enquanto contiver configuração privada. Isso evita dar falsa garantia a uma verificação só por nome de arquivos.
- A saída Next pode incluir links legítimos de dependências; manter somente links resolvidos dentro da árvore e demonstrar integridade após extração. A prova de smoke não é aceite de implantação.
- A validação não retroage sobre artefatos ou commits antigos e não corrige credenciais que possam já ter sido distribuídas.

## Migration Plan

1. Em ambiente de teste autorizado, construir de um contexto limpo; inspecionar a lista final do tar e extrair em destino descartável.
2. Provisionar uma fixture SQLite vazia com schema por comando separado, fora do pacote; confirmar que a base ausente é rejeitada e que a base preparada atende os checks HTTP.
3. Numa implantação futura autorizada, preparar a configuração externa antes de trocar a versão. Na falha, parar a promoção; não voltar automaticamente para um artefato antigo com dados embutidos.

## Open Questions

Qual ambiente fornecerá o contexto limpo e quais controles de retenção se aplicam aos artefatos antigos? Não é necessário decidir para escrever os testes com fixtures. Uma verificação de build real depende desse ambiente; se indisponível, registrar como não verificada.
