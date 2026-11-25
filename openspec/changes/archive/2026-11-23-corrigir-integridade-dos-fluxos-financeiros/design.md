## Context

**Desenho aprovado pelo usuário (“aprovado, prossiga”); execução autorizada.** A mudança visual mantém seu escopo. Este desenho trata os contratos de dados conhecidos; a verificação restante continua no [plano do redesign](<../recriar-interface-quiet-financial-os/plan.md>).

## Goals / Non-Goals

**Goals:** manter identidade do registro durante ações, carregar detalhe correto em Parcelas, impedir alterações parciais de Compra e preservar a data civil digitada.

**Non-Goals:** nova regra de cálculo, migração ou remediação automática dos dados históricos, mudança de pagamento real, nova API geral, reinício/deploy ou publicação.

## Decisions

### D1 — Consórcios: seleção, resposta e ação com identidade

- Ao trocar ou fechar a seleção, invalidar a requisição anterior, a confirmação e seus dados. Publicar só a resposta vigente, com parcelas do consórcio ativo; ausência, erro ou dado incompatível não habilitam a ação.
- No envio, conferir novamente a identidade da seleção e da parcela associada à confirmação; não reusar um formulário válido para outro consórcio. Não mudar cálculos nem o contrato da API nesta correção do vínculo visual.
- Testar a chegada A → B → resposta A tardia, erro e troca durante confirmação, primeiro sem qualquer gravação. Depois, somente em fixture isolada, reler A e B e confirmar efeito exclusivo no alvo.

### D2 — Parcelas: detalhe sem alterar a lista

- GET atual sem `id` mantém coleção e filtros. GET com `id` devolve exatamente um plano com suas parcelas ordenadas; inexistente responde 404. UI só aceita a identidade pedida, não permite ação com carregamento, erro ou resposta de outra seleção; usar o mesmo contrato após atualização.
- Provar coleção, detalhe válido e ausente, troca de seleção, e manutenção dos dados no refresco. Não inventar definição de “Atrasados” sem confirmar a origem do estado de atraso.

### D3 — Compras: atomicidade e data civil

- Reutilizar operações relacionais atômicas do Prisma ou transação explícita, protegendo a substituição de itens e a remoção da compra. Usar uma só transação por mutação; preservar erros e payloads já esperados, sem retry automático.
- Validar rollback com falha controlada após a operação dependente em SQLite descartável: dados pré-existentes, itens e registro não alvo continuam intactos. Testar também o caminho feliz por releitura.
- Preservar o dia escolhido no campo de data ao armazenar e renderizar em pt-BR. Não aplicar fuso local sobre uma data civil armazenada como meia-noite UTC. Validar `2026-11-19` em America/Bahia e UTC; distinguir datas civis de instantes históricos para não reescrever registros.

## Risks / Trade-offs

- Corrigir apenas CSS ou ocultar o diálogo não resolve identidade. Uma reescrita geral de toda persistência aumenta o risco sem ser necessária para estes casos. As correções locais preservam os contratos não afetados.
- Evidência de sucesso de UI ou de um HTTP 200 não basta para atomicidade. Provar por releitura, em base isolada confirmada antes do teste; sem dados reais, egress ou execução de pagamento na prévia.
- O fluxo de pagamento de Consórcios também atualiza parcela e agregado em operações distintas. É risco adicional identificado em leitura, não prova de perda; se a prova mostrar efeito parcial ou duplicado, separar a decisão e fechar o risco antes de aceitar os efeitos como íntegros.

## Migration Plan

Sem migração de esquema ou regravação de históricos. A revisão deve confrontar contratos, documentação pertinente e o mesmo candidato testado antes de fechar.

## Open Questions

- Confirmar como o produto materializa atraso antes de mudar o filtro. Em Cartões, Investimentos e Metas, só corrigir riscos ainda não reproduzidos após prova controlada.
