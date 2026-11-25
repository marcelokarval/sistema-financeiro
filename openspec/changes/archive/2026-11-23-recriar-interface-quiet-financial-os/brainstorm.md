# Exploração aprovada — Quiet Financial OS

## Decisão registrada

O usuário escolheu a referência Quiet Financial OS e autorizou iniciar a recriação visual completa: “pode iniciar a recriação de toda a parte visual sem reverter o produto [...] os componentes que só existem no atual serão reescritos e os que são "os mesmo" só serão atualizados”. O resultado deve ser reconhecível como a interface do conceito antigo, não apenas uma variação do tema atual. A escolha estética e o escopo estão aceitos; o desenho detalhado e seu aceite são etapas distintas.

## Alternativas consideradas

- Só trocar paleta: preservaria a hierarquia, os gradientes locais e a composição rejeitada; descartado.
- Reverter ou copiar todo o projeto antigo: arriscaria perder ações, rotas e dados atuais ou importar contratos financeiros diferentes; descartado.
- Recriar a camada visual sobre o produto atual: opção escolhida. Usar o HTML como referência direta de composição e o contrato visual antigo como guia; manter dados, ações e regras do atual. Atualizar equivalentes e reescrever a apresentação dos componentes exclusivos.

## Fontes e limites

- Referência local somente leitura: `../sistema-financeiro-anterior/finance-dashboard-concept.html` (SHA-256 `98fbb4c262c05f5a432b6a3b5ca0629bf44b715e703fe5c6998118ea21baf62c`) e `../sistema-financeiro-anterior/DESIGN.md` (SHA-256 `1ad82ab04911416a6bd672321f0fe596d22f4842d04a29002606ae73b8a1eeef`), complementados por `docs/sdd/visual/` na mesma árvore. O HTML escuro tem dados ilustrativos, não fornece dados ou ações do produto.
- Workspace do produto: `/home/marcelo-karval/Backup/Projetos/nextjs/sistema-financeiro`, base observada `96de0e44e4d43e574f1b920d7047d95b37261ae5`. A mudança de empacotamento, arquivos privados e alterações preexistentes não fazem parte desta mudança.
- Manter Next, Bun, APIs, Prisma, domínio, dados, componentes shadcn gerados e a entrada CSS estabelecida para o tema. Não substituir o site pelo HTML do conceito nem criar workspace/runtime paralelo.
- Mapeamento efetivamente invocado: `brainstorming` (exploração e gate de desenho), `visual-redesign-workflow` (referência e migração por fatias), `openspec-new-change` (criação via CLI com `superpowers-bridge` v2).

## Próximo passo

Concluir o inventário de paridade com `a008-mapa-telas` (navegação/capacidades) e `a009-contratos-resumo` (fontes/semântica do resumo). O lead consolida o desenho, solicita a checagem independente de implementabilidade e apresenta os limites da primeira fatia antes de aplicar.
