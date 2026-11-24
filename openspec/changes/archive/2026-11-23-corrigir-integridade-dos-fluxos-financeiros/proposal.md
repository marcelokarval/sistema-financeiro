## Why

As verificações do redesign expuseram defeitos preexistentes que afetam identidade e integridade das operações financeiras. Uma resposta tardia em Consórcios pode oferecer ação sobre o registro errado, o detalhe de Parcelas não carrega sua entidade, operações de Compras podem parar no meio e o dia escolhido no formulário pode mudar na apresentação. Corrigir esses contratos separadamente permite preservar a linguagem visual e verificar cada efeito com dados sintéticos.

## What Changes

- Vincular detalhe, confirmação e ação à seleção vigente em Consórcios.
- Restaurar leitura de detalhe das Parcelas, preservando o contrato da coleção e a regra atual de pagamento.
- Fazer edição e exclusão de Compra e itens gravarem por inteiro ou não gravarem; preservar os montantes atuais e tratar o dia informado como data civil.
- Revalidar os riscos restantes antes de classificar como regressão ou propor novas alterações.

## Capabilities

### New Capabilities

- `integridade-fluxos-financeiros`: identidade, consistência e preservação do dia nos fluxos identificados.

### Modified Capabilities

Nenhuma capacidade principal publicada é substituída.

## Impact

Interfaces Consórcios, Parcelas e Compras; rotas de leitura/mutação correspondentes e testes com fixture descartável. Sem migração, mudança de fórmula ou escrita na prévia.
