## Why

A interface atual compete com os próprios dados: superfícies tingidas, cartões decorativos e o assistente expandido escondem o resumo financeiro. O usuário escolheu o Quiet Financial OS do projeto anterior como referência para refazer a experiência completa, mantendo o aplicativo atual e suas funcionalidades.

## What Changes

- Recriar a interface em React com a composição, as cores semânticas, a tipografia, o ritmo visual e a navegação do Quiet Financial OS. Aplicar a mesma linguagem em claro e escuro e em desktop e celular.
- Começar pela estrutura compartilhada e pelo resumo, depois atualizar as telas e componentes com correspondência no projeto anterior e reescrever a apresentação dos componentes exclusivos do produto atual.
- Preservar a navegação para todos os destinos, ações, contratos de dados e estados. O assistente continua acessível, fechado na abertura, sem competir com o resumo.
- Usar dados e operações do produto atual. Não importar números, fórmulas, APIs, fluxo de gravação, escopo de workspace ou estados simulados da referência.

## Capabilities

### New Capabilities

- `interface-quiet-financial-os`: fundamentos visuais, resumo, navegação, componentes de negócio e paridade funcional na migração visual.

### Modified Capabilities

Nenhuma especificação principal de domínio é alterada.

## Impact

- Frontend Next/React: tokens compartilhados, shell do aplicativo, dashboard, telas de negócio e componentes reutilizáveis. Preservar a entrada CSS estabelecida e os componentes gerados do shadcn/ui.
- Documentação: reconciliar contrato visual, direção anterior e exemplos efetivamente afetados; distinguir o novo contrato da referência histórica e da cobertura já validada.
- API: nenhuma mudança motivada pela apresentação. O QA do redesign corrige somente a persistência dos campos de assembleia de Consórcios e a edição de campos opcionais de Caixinhas, conforme a [decisão D5](<design.md>). O candidato integrado também contém as correções de handlers da [mudança separada de integridade](<../corrigir-integridade-dos-fluxos-financeiros/proposal.md>).
- Sem reversão de produto, migração de banco, mudança de regras de pagamento ou cálculo, novo runtime, checkout paralelo, publicação ou deploy. Verificações visuais em ambiente local isolado, com dados sintéticos.
