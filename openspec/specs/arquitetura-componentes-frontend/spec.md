# arquitetura-componentes-frontend Specification

## Purpose

Estabelecer um contrato verificável de composição para o frontend financeiro, reduzindo a montagem repetida de interface sem substituir os contratos de experiência e integridade vigentes.

## Requirements

### Requirement: R01 Composição por responsabilidade

Os módulos próprios de produção SHALL manter um ponto de entrada por widget e delegar blocos complexos repetidos ou com responsabilidade própria a componentes coesos. JSX semântico e wrappers necessários SHALL permanecer quando tornarem relações, estrutura ou acessibilidade mais claras.

#### Scenario: Semântica preservada sem extração cosmética
- **WHEN** uma tela compõe regiões, listas, termos e valores ou delega uma linha com ações
- **THEN** a revisão aceita marcação semântica e wrappers justificados, mas rejeita reproduzir o mesmo bloco de implementação ou apenas escondê-lo em um componente sem responsabilidade própria

### Requirement: R02 Reuso comprovado

Cada padrão novo em `shared` MUST ter pelo menos dois consumidores reais de produção na mesma entrega do padrão, variantes com significado e estilos integrados aos tokens vigentes. Regras financeiras, consultas e formatação específica SHALL continuar sob controle dos respectivos domínios.

#### Scenario: Padrão comum em produção sem homogeneizar fluxos
- **WHEN** uma linha, métrica, progresso, estado de consulta, invólucro de diálogo ou tooltip é proposto como compartilhado
- **THEN** a revisão identifica dois pontos de consumo e uma fonte de apresentação comum, preservando textos, ações, sinal, unidades, privacidade e diferenças legítimas de interação

#### Scenario: Estados distintos da consulta e do progresso
- **WHEN** consumidores exibem carga, erro recuperável, vazio, zero ou progresso determinado
- **THEN** a composição não confunde esses estados, mantém retry quando existente e expõe a descrição textual e o valor acessível do progresso determinado coberto, sem edição manual de primitivas; guardas vigentes de período são preservadas. A divergência preexistente da Projeção é caracterizada separadamente, sem tratá-la como atendimento ao contrato Quiet nem mudar o seu controlador nesta extração

### Requirement: R03 Fluxos duplicados convergem primeiro

Investimentos, Consórcios e Contas MUST consolidar seus editores duplicados no domínio antes da migração transversal de apresentação. As variantes SHALL manter campos, validação, rascunho, confirmação, identidade do registro e descarte conforme cada caminho.

#### Scenario: Investimento por carteira e detalhe
- **WHEN** a edição ou exclusão é iniciada na carteira ou no detalhe de investimento
- **THEN** os caminhos usam o editor ou a confirmação de domínio em comum, sem alterar o destino da mutação, a releitura do mesmo investimento nem o comportamento de falha e foco

#### Scenario: Consórcio por lista e detalhe
- **WHEN** o usuário edita ou confirma a exclusão a partir da lista ou detalhe, inclusive se a seleção muda enquanto a requisição está em voo
- **THEN** os caminhos usam a composição comum, com edição vinculada à abertura e exclusão vinculada ao ID capturado pelo confirmador. Resposta de outro consórcio não fecha nem modifica o detalhe da seleção vigente; esse cenário não muda quando uma exclusão pode ser confirmada

#### Scenario: Transação por criação e edição
- **WHEN** o usuário cria ou edita uma transação de conta por cada caminho existente, inclusive a ação global de lançamento
- **THEN** os campos de domínio têm uma fonte comum e cada caminho conserva seus padrões, validação, payload, alvo, foco e tratamento de erro

### Requirement: R04 Paridade de interação e resultado financeiro

Cada fatia MUST demonstrar por comportamento que a extração preserva, nos caminhos em que se aplicam, identidade por registro, consulta e abertura, bloqueio síncrono por chave, semântica e foco, privacidade, contratos de API e resultados financeiros. A troca de localização do JSX SHALL NOT ser usada como prova de regressão ou de paridade.

#### Scenario: Envios concorrentes e respostas tardias
- **WHEN** um envio de Conta ou Cartão é repetido antes de renderizar, a seleção ou abertura muda ou respostas chegam fora de ordem
- **THEN** há no máximo uma operação em voo por chave, chaves distintas conservam sua independência e respostas antigas não afetam a abertura vigente nem transformam erro em sucesso

#### Scenario: Teclado privacidade e janela visual
- **WHEN** cancelamento, confirmação, exclusão, navegação e máscara são verificados em 360, 390 e 1440 px nos temas claro e escuro
- **THEN** papel, nome, teclas e destino de foco são preservados. Em exclusões com releitura, observar o foco logo após fechar e após a remoção do registro; a revisão distingue o destino sobrevivente exigido pelo contrato visual de diferenças preexistentes observadas em fixtures comparativas. As diferenças SHALL ser registradas sem reescrever o requisito vigente nem corrigir silenciosamente o fluxo. Nos caminhos protegidos pela máscara vigente, valores ocultos não reaparecem em texto, nomes acessíveis ou tooltips, ações não dependem de hover e não há rolagem horizontal da página

#### Scenario: Integridade dos consumidores financeiros
- **WHEN** fixtures sintéticas percorrem compras e itens, parcelas, consórcios, recorrências, caixinhas, consultas e recibos
- **THEN** métodos, payloads, resultados, saldos, períodos, datas civis, formatos e regras de atualização conservam os contratos existentes, inclusive erro, retry e distinção entre omissão, vazio e zero. Distinguir HTTP não OK, rejeição do transporte e falha de releitura depois de gravação aceita; fechamento, rascunho e releitura SHALL ser comparados por domínio e caminho de erro, sem uniformizar políticas existentes. No pagamento de parcela de Consórcio, se mudar ou fechar a seleção antes da confirmação, a confirmação antiga não grava; uma parcela de outra seleção não é exibida nem fica acionável no detalhe vigente

### Requirement: R05 Fechamento do inventário por família

Cada módulo próprio da auditoria MUST ter disposição verificável por família: migrado, mantido por composição legítima ou exceção justificada. Biblioteca shadcn, JSX de fixtures e demo WebSocket SHALL ser contabilizados à parte; os testes poderão mudar apenas para provar os contratos da produção.

#### Scenario: Família de produção e exclusões rastreadas
- **WHEN** a cobertura da auditoria é conferida por arquivo
- **THEN** os 38 módulos próprios têm disposição e evidência individual, e os 48 shadcn, 14 testes e 1 demo não contam como dívida JSX de produção nem autorizam edição manual da biblioteca

### Requirement: R06 Gate incremental com baseline

A verificação de arquitetura MUST isolar a dívida existente numa baseline reproduzível, impedir novas violações confirmadas e remover entradas sanadas. Profundidade, número de elementos e tamanho de arquivo SHALL ser sinais de revisão, não proibições absolutas.

#### Scenario: Gate distingue dívida herdada de regressão
- **WHEN** o gate compara a árvore com o baseline e recebe amostras de JSX legítimo, violações conhecidas e uma nova ocorrência confirmada
- **THEN** aceita o legado declarado e as exceções justificadas, informa sinais heurísticos e reprova nova violação confirmada, entrada órfã ou ampliação não aprovada do baseline; incluir a ocorrência nova apenas no baseline candidato não a torna aceita sem comparação com a referência independente
