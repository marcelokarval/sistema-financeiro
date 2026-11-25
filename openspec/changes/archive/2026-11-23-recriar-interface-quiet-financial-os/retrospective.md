# Retrospectiva — Quiet Financial OS

## Resultado

- Oito tarefas verificadas no workspace local. O candidato `8ddab4179976132beacefb303a348e7763146f92e4862d87f2752f74dbdf78b4` recebeu revisão integrada independente ainda com HEAD `96de0e44e4d43e574f1b920d7047d95b37261ae5`. O guard passou antes de registrar esta retrospectiva.
- Consulte a [verificação](<verify.md>), as [evidências por tarefa](<evidence.json>) e os [checkpoints do plano](<plan.md>). A [documentação vigente](<../../../docs/reference/design-system.contract.md>) descreve migração, comportamento e limites; as capturas mais antigas são amostras.

## Aprendizados

- Resposta HTTP bem-sucedida não autoriza fechar o formulário que está aberto agora. A ação precisa guardar a identidade da abertura antiga; o bloqueio de duplo envio na interface é uma guarda separada.
- Medir só a largura do documento não detecta um controle cortado por `overflow-hidden`. O teste do ponto de clique detectou o recorte a 360 px e a matriz final confirmou a correção nas três larguras e nos dois temas.
- Foco em um controle que deixa de existir durante a releitura precisa ser preservado sem liberar ações sobre dados desatualizados. Validar `activeElement` durante o GET interrompido mostrou o que a prova de layout ou do payload não detectava.
- Cenários vazios podem aparecer verdes. O reaceite independente de exclusão de Consórcios verificou contagem de asserções e confirmou que os casos efetivamente exercitam lista e detalhe.
- Navegador e SQLite descartável verificam camadas diferentes: o primeiro provou interação e requisição; o segundo, persistência após a ação. Não combinar os dois registros como se fossem uma execução ponta a ponta.

## Limites e continuidade

- A checagem TypeScript não está limpa (28 diagnósticos anteriores, nenhum novo na comparação). A prévia respondeu HTTP 200; não foi usada como prova integrada de gravação. A trava da interface não atesta idempotência em vários clientes.
- A restrição visual de API tem duas correções de paridade delimitadas pela D5; as cinco dependências da mudança de Integridade permanecem identificadas separadamente. Não houve migração de banco.
- Empacotamento permanece em mudança separada. Sem commit, sincronização das specs principais, arquivamento, publicação ou deploy nesta entrega.
