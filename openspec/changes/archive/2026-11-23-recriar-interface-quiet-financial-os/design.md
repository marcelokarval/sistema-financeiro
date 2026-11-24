## Context

**Estado: desenho aceito pelo usuário**, ainda não implantado. O protótipo [Quiet Financial OS](<../../../../sistema-financeiro-anterior/finance-dashboard-concept.html>) é a referência para aparência e composição; o [contrato visual anterior](<../../../../sistema-financeiro-anterior/DESIGN.md>) e seu [SDD visual](<../../../../sistema-financeiro-anterior/docs/sdd/visual/README.md>) sustentam a expansão. As versões da referência estão registradas no [brainstorm](<brainstorm.md>); o produto atual é a fonte de comportamento.

## Goals / Non-Goals

**Goals:** Recriar toda a interface, com fidelidade perceptível ao conceito; atualizar equivalentes, reescrever apenas a apresentação do que for exclusivo e preservar todos os fluxos acessíveis. Entregar em fatias verificáveis.

**Non-Goals:** Não reverter produto, importar APIs ou fórmulas do antigo, trocar runtime, alterar pagamentos/gravações, permissões, modelos, dados, dependências, fluxo de empacotamento ou publicar. Não copiar valores fictícios nem tratar um fluxo já inoperante como corrigido por trocar sua aparência.

## Decisions

### D1 — Mesma linguagem visual em todo o produto

- Manter o ponto de importação CSS atual e reconfigurar os tokens nele referenciados; não criar uma segunda cascata concorrente. Escuro: grafite neutro e ciano de ação como o conceito, sem fundo verde, brilho ou gradiente ornamental. Claro: neutro de alto contraste, mesma hierarquia e semântica; usar a referência antiga de claro como insumo, não alegar que há um claro no HTML aprovado. Verde/amarelo/vermelho indicam estados reais e nunca substituem texto ou ícone.
- Geist Sans, valores tabulares em Geist Mono, bordas discretas e elevação só quando útil. Usar famílias de superfícies (faixa de dados, painéis, listas e diálogos), não cartões idênticos para tudo. Adaptar os componentes de negócio; sem editar manualmente `src/components/ui/` ou adicionar dependência para reproduzir a referência.

### D2 — Estrutura e resumo primeiro

- Preservar os nove destinos e o estado de navegação existente. Sidebar discreta no desktop; atalhos principais e menu `Mais` no celular. Conservar busca `Ctrl/⌘ K`, notificações, seletor de tema e operações disponíveis. Usar `Novo lançamento` para iniciar a escolha explícita da conta e então abrir o formulário atual de nova transação; sem conta disponível, indicar o cadastro de conta. Nunca selecionar uma conta silenciosamente, gravar ao abrir ou criar outro caminho de escrita. Assistente disponível mediante ação, fechado por padrão e fora da primeira dobra quando fechado.
- Primeira tela: cabeçalho com período; faixa de posição financeira; fluxo à esquerda e vencimentos à direita no desktop; atividade e orçamento abaixo. No celular, posição e itens que pedem atenção vêm antes da análise detalhada; manter a mesma navegação funcional. Os widgets restantes ficam em áreas secundárias com acesso explícito durante a migração, não removidos nem empilhados acima do núcleo.
- Usar valores atuais sem ambiguidade: `totalBalance` para **Saldo em contas**; entradas menos saídas já exibidas para **Saldo do período**, mantendo o filtro. Na terceira posição, **Despesas do período**, com a fonte existente; não chamar de caixa livre. Não promover um “Patrimônio líquido” canônico enquanto as definições diferirem; conservar o recurso no seu contexto, sem recalcular nem replicar o KPI decorativo no topo.
- Manter **Entradas e saídas** no gráfico (série atual, com escala e período reais); não renomear para “Realizado × plano”. Manter semântica da rota de vencimentos e rótulo **Próximos vencimentos**, não prometer sete dias. Mostrar atividade e orçamento existentes em listas/superfícies compactas. Identificar os recortes por bloco: totais e atividade usam o intervalo selecionado; saldo em contas é posição atual; a série tem agregação mensal da API, e orçamento e vencimentos têm recortes próprios. Diferenciar zero, sem dados, carregamento e erro com nova tentativa. Em troca de período, não atribuir dados antigos ao novo intervalo, inclusive em respostas fora de ordem. Nada de taxa, curva, meta ou registro fictício como fallback.

### D3 — Migrar por família sem perder ações

| Família | Equivalentes a atualizar e comportamentos a conservar | Exclusivos ou parciais a reescrever na apresentação |
|---|---|---|
| Estrutura e resumo | Sidebar, menu móvel, busca, notificações, tema, filtro e ações do dashboard | Assistente, ações rápidas e widgets sem equivalente direto na composição antiga |
| Movimentação | Contas (transações, transferências), cartões (compras e detalhes), compras (itens), categorias (tipo, ícone e cor) | Recorrências (criar, editar, pausar/ativar, processar, excluir), recibos (gerar, baixar, copiar, imprimir), exportação CSV |
| Patrimônio e compromissos | Investimentos (transações e detalhe), parcelas (pagar e filtros), consórcios (assembleia e pagamentos), caixinhas (depósito com conta e progresso) | Projeções, dívidas, metas, desafios, conquistas e demais widgets de leitura e ação sem encaixe direto |

O inventário parte das nove views em `src/app/page.tsx`, seus 17 blocos de dashboard e dos blocos aninhados em `dashboard-view.tsx`, além de componentes transversais. Cada fatia deve registrar ação → entrada atual → entrada proposta → prova antes de retirar a apresentação anterior. Incluir Ocultar/Mostrar valores no escopo já coberto pela função e os fluxos de criar, editar e excluir metas orçamentárias no widget próprio. Não confundir esses fluxos com o rótulo “Nova Meta” sem callback na página.

### D4 — Provas e contrato vigente

- Teste guiado por comportamento para seleção de destino, assistente fechado e abertura explícita, estado do resumo e alcance das ações afetadas; cenários com fixtures sintéticas completas, vazias e de erro. Provar que navegação e abertura de formulários não mudam contratos/payloads; para ações necessárias, medir efeitos apenas em fixtures autorizadas. Resposta simulada comprova interface e payload, não persistência; quando o aceite exigir efeito de gravação, verificar o estado resultante. Toast não é evidência de sucesso.
- Inspeção em navegador da versão React com dados sintéticos e sem tráfego externo: 1440 × 900 e 390 × 844 em claro/escuro, 360 px para reflow, teclado/foco, diálogos, rótulos de ícones, contraste dos pares usados e movimento reduzido. Comparar geometria e hierarquia com a captura do conceito, não números ilustrativos ou igualdade de pixels. Não confundir testes unitários, captura e verificação funcional.
- Reconciliar `docs/reference/design-system.contract.md`, `docs/reference/design-system.premium-direction.md`, os exemplos ativos e instruções locais pertinentes no momento da migração. O contrato e os exemplos não devem rotular telas ainda legadas como migradas. A revisão independente confronta a UI e a matriz de paridade por fatia.

### D5 — Correções de paridade encontradas no QA

Os controles e contratos econômicos não mudam por causa do redesign. Depois do pedido de fechar as pendências de QA, foram tratadas correções de paridade pontuais: a edição de Caixinha aceita os mesmos campos opcionais vazios do cadastro; o cadastro de Consórcio conserva a data opcional próxima e a edição conserva a contagem informada. São correções de gravação dos valores que o formulário existente já envia, não novas regras de negócio. Não alteram schema, pagamentos, cálculo de parcelas, transações, rendimento efetivo nem vínculo com a conta. Resultados da API, leitura do SQLite descartável e interações de navegador continuam documentados separadamente no [plano](<plan.md>).

## Risks / Trade-offs

- **Métricas antigas divergem:** copiar rótulo e desenho não dá equivalência de API. Adotar os rótulos D2, preservando fórmulas e valores atuais.
- **Migração em fases:** uma fatia não prova tema completo. Não ocultar recursos; manter links de acesso e registrar cobertura pendente.
- **Runtime local:** a instância anteriormente observada caiu; o ambiente visual precisa de preflight isolado com fixture e supervisão. Não usar dados reais, configuração privada, instalação ou porta de outro projeto como atalho.

## Migration Plan

Fundamentos → estrutura e resumo → movimentação → patrimônio e compromissos + widgets exclusivos → verificação de cobertura. Escopo de cada escritor e de cada teste será fechado no plano OpenSpec. A primeira entrega não substitui árvore antiga nem altera backend. Não há operação de deploy ou migração de banco.

## Open Questions

Aceite direto registrado: “aceite confirmado. Execução autorizada, com autorização ampla e irrestrita.” A execução tem o escopo descrito neste documento. A ordem e a composição são propostas técnicas alinhadas à referência já escolhida; os rótulos seguros do painel evitam uma decisão financeira implícita. Checagem estática de implementabilidade por `a010-checagem-desenho`: pontos sobre escolha de conta, recortes do resumo e paridade por ação incorporados acima. Sem QA vivo. A linha de base TypeScript pré-mudança tem 49 diagnósticos; exigir ausência de regressões de tipagem no candidato, sem atribuir ao redesign correções dos erros preexistentes restantes.
