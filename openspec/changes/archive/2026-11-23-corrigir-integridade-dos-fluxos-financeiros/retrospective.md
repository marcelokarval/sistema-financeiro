# Retrospectiva — Integridade dos fluxos financeiros

## Evidências

- Base/HEAD `96de0e44e4d43e574f1b920d7047d95b37261ae5`; candidato `a3766a4882fc6020dacf70bb1c16af68833b5b62dd20d1c8c75eed440798698a`.
- [Verificação](<verify.md>) e [evidências por tarefa](<evidence.json>); revisão independente integrada `a057-revisao-integrada` e reaceites focados registrados no [plano](<plan.md>).
- O guard passou antes desta retrospectiva. O conjunto de produto e testes não mudou depois da revisão integrada. As cinco tarefas do escopo aprovado foram verificadas em candidato local; não equivale à publicação.

## Aprendizados

- Identidade da abertura evita resposta atrasada de A em B, mas a releitura após gravação precisa usar a abertura atual do mesmo ID. A primeira revisão detectou a lacuna; o reaceite verificou A reaberto e B preservado.
- A prova mais forte de atomicidade foi abortar a operação depois de remover filhos e reler o estado antes/depois. Na base, o status de erro não impedia a perda dos itens.
- Data civil exigiu seguir leitores indiretos de Compras: Cartões, Resumo e Calendário. Corrigimos a apresentação/agrupamento sem mudar como a janela seleciona registros.
- No guard, a descrição da regressão de Parcelas passou a usar “ainda por pagar” para distinguir o estado de domínio dos marcadores reservados do relatório.

## Capacidades e execução

| Capacidade | Mecanismo | Estado |
|---|---|---|
| Planejamento | OpenSpec, `superpowers-bridge`, `writing-plans` | Usado no workspace existente |
| Implementação e teste | `subagent-driven-development`, `test-driven-development`, Bun | RED/GREEN por tarefa; SQLite isolado quando pertinente |
| Revisão | `requesting-code-review`, `receiving-code-review`, revisão independente nativa | Revisão integrada e reaceites nos mesmos bytes de produto/testes |
| Navegador | Playwright CLI | Cenários sintéticos com mutações interceptadas |

## Limites e próximos passos

- Continuar o [QA funcional do redesign](<../recriar-interface-quiet-financial-os/plan.md>), que segue 4/8. Sem archive, sync das specs principais, commit, deploy ou mudança na base da prévia.
- Pagamento de Consórcios no servidor não foi alterado; atomicidade e duplicidade entre clientes requerem investigação própria. A regra de inclusão na borda da janela do Calendário permanece dependente do fuso.
- TypeScript segue com 29 diagnósticos preexistentes, sem alteração no conjunto (comparação por arquivo, código e mensagem). Goal de empacotamento preservado; criação de Goal separado não foi admitida nesta sessão.
