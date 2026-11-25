# Proposal

> **Candidato ASDS (`r8`) — autoria apenas; revisão independente e entrega pendentes. Não autoriza implementação.**

## Why

A [auditoria de `eb76f7d`](sources/auditoria-componentizacao-tsx.md) encontrou composições e formulários duplicados em 38 módulos próprios de produção. As specs Quiet e de integridade protegem a experiência e os fluxos, mas não impedem que as telas voltem a duplicar estruturas e responsabilidades.

## What Changes

- Formalizar quando a tela pode usar JSX semântico diretamente, quando deve delegar uma responsabilidade ao domínio e quando um padrão deve ir para `shared` com pelo menos dois consumidores reais.
- Priorizar os editores duplicados de Investimentos, Consórcios e Contas. Em seguida, convergir padrões comprovados e fechar o inventário restante por família, sem reescrita geral.
- Exigir evidência por comportamento e um gate incremental de arquitetura com baseline, sem usar contagem de tags ou linhas como critério de reprovação.
- Manter APIs, regras financeiras, máscara de valores, foco e identidade assíncrona. Registrar, sem corrigi-las nem ratificá-las nesta refatoração, a autoabertura da Busca Global, a resposta de período antigo na Projeção e as divergências ou riscos de foco pós-exclusão confirmados na leitura dos controladores, sem presumir resultado do navegador; as regras vigentes permanecem inalteradas.

## Capabilities

### New Capabilities

- `arquitetura-componentes-frontend`: contrato verificável de composição, reaproveitamento, classificação de escopo e prevenção de regressões nos módulos React próprios de produção.

### Modified Capabilities

Nenhuma. As specs Quiet, de integridade financeira e de empacotamento permanecem vigentes e inalteradas.

## Impact

A eventual execução afeta App Router, módulos `finance`/`shared`, hooks de apresentação e testes de regressão. Não prevê novo pacote, alteração de API, banco, cálculos, formatos, regras de privacidade, reconfiguração do OpenSpec ou edição manual do catálogo shadcn. Demo e JSX de fixture não compõem a dívida da aplicação. Este pedido produz somente os artefatos de planejamento desta change.
