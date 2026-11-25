# integridade-fluxos-financeiros Specification

## Purpose

Especificar as garantias de identidade, consistência transacional e preservação de data civil nos fluxos de Consórcios, Parcelas e Compras sem alterar fórmulas financeiras ou contratos de coleção existentes.

## Requirements

### Requirement: Identidade vigente em Consórcios
O detalhe e as ações sobre parcelas MUST permanecer vinculados ao consórcio selecionado e à parcela correspondente.

#### Scenario: Resposta tardia de outra seleção
- **WHEN** a pessoa troca de A para B e a resposta de A chega por último
- **THEN** nenhuma parcela de A é exibida ou fica acionável no detalhe de B

#### Scenario: Confirmação com seleção obsoleta
- **WHEN** a seleção muda ou fecha antes de confirmar o pagamento
- **THEN** nenhuma gravação da parcela anterior é emitida por aquela confirmação

### Requirement: Consulta de detalhe em Parcelas
O GET com `id` MUST entregar o plano correspondente com suas parcelas, sem alterar o GET de coleção.

#### Scenario: Plano existente ou ausente
- **WHEN** o detalhe é consultado com um ID que existe ou não existe
- **THEN** o GET retorna respectivamente o plano identificado ou 404; a interface não habilita ações a partir de dados ausentes ou divergentes

### Requirement: Consistência entre compra e itens
Edição e exclusão de compra com itens MUST ser atômicas e preservar os demais registros.

#### Scenario: Uma etapa da mutação falha
- **WHEN** o armazenamento não consegue concluir a alteração da compra ou de seus itens
- **THEN** a operação inteira falha e os registros envolvidos conservam o estado anterior

### Requirement: Data civil da compra
A data informada no campo de compra MUST aparecer como o mesmo dia no formulário e nas visualizações que consomem esse valor, independentemente do fuso usado pelo navegador.

#### Scenario: Data à meia-noite UTC
- **WHEN** a data civil 19/11/2026 é salva e consultada em UTC e America/Bahia
- **THEN** a interface apresenta 19/11/2026 em ambos, sem migrar os registros existentes
