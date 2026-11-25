# Exploração: separar dados e segredos do pacote

## Contexto e autorização

- O usuário pediu a ordem recomendada, escolheu a primeira subida local com base nova e determinou OpenSpec + superpowers-bridge + Superpowers para as mudanças permanentes.
- Em 2026-11-19, a resposta “autorizo” aprovou inicializar OpenSpec neste checkout sem integrações extras e registrar a primeira proposta. A aprovação do desenho detalhado e a aplicação não foram presumidas.
- A skill nativa `brainstorming` foi invocada e aplicada ao recorte. O empacotador atual exige e copia `db/`, executa `db:push` na cópia e arquiva a árvore inteira da área de montagem. O launcher presume um banco dentro do pacote e pode registrar a URL de conexão.
- O Git rastreia `.env` e `db/custom.db`; isso foi apurado por metadados, sem leitura do conteúdo. O isolamento atual do servidor de desenvolvimento não demonstra que o empacotamento esteja corrigido.

## Opções avaliadas

1. Excluir apenas a cópia de `db/`: ajuste pequeno, mas deixa atributos de ambiente, saída reaproveitada e dependência do fallback no launcher sem contrato seguro.
2. **Proposta recomendada:** montar e inspecionar um pacote novo que contenha apenas artefatos de execução; impedir build de release com configuração privada no contexto; validar `DATABASE_URL` externa antes de iniciar serviços. Preserva Next.js, Bun, Prisma, SQLite e o formato do pacote.
3. Trocar de stack ou recriar o pipeline de implantação: custo e mudança operacional maiores, sem necessidade para atender a primeira entrega.

## Limites para o aceite

- Não modificar ou abrir a base real, criar cópia de segurança, limpar histórico, publicar pacote, reiniciar a instância local ou expor a aplicação na rede. Não alterar autenticação, proxy, regras financeiras ou schema Prisma.
- A proposta não remove do índice os arquivos já rastreados. Retirá-los do Git sem apagá-los, avaliar distribuição e decidir sobre credenciais/histórico requerem uma etapa explícita. Até resolver a preparação de um contexto limpo, não gerar release a partir do checkout que contém segredos.
- Critério decisivo: produzir artefato inspecionado com apenas entradas permitidas e provar que o launcher falha sem uma base externa válida, sem seed nem sincronização implícita. Testar apenas com dados sintéticos.
