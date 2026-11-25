# Plano — Integridade dos fluxos financeiros

Desenho e delta aprovados. Base e HEAD inicial `96de0e44e4d43e574f1b920d7047d95b37261ae5`; árvore original, preservar alterações sujas. Usados `writing-plans`, `openspec-apply-change`, `subagent-driven-development`, `test-driven-development`. Sem schema, migração, instalação, serviço novo, pagamentos na prévia, ou acesso a dados reais. Provas Bun `--no-env-file`, fixture SQLite descartável com restrições reais e identidade do banco confirmada; QA de navegador sem encaminhar mutações.

## Task 1.1: Seleção e confirmação de Consórcios
- Depends on: none
- Entrada: D1, DTO de parcelas e fluxo atual. Entrega: tela que invalida GET antigo (inclusive A→B→A) e só permite confirmar parcela pendente pertencente à seleção desta abertura. Não editar API de pagamento.
- Autor: executor desta fatia; principal verifica interação sem efeitos na prévia. RED/GREEN focado em seleção, resposta adversa/erro, troca/fechamento e confirmação; revisar integridade da lista e guards no limite de envio. Depois, readback sintético via handler para alvo coerente e sentinela inalterada.

## Task 1.2: Detalhe de Parcelas
- Depends on: none
- Entrada: D2 e consumidores GET de coleção/detalhe. Entrega: `id` retorna entidade com parcelas ordenadas, 404 se ausente, coleção preservada. UI não usa dados antigos/incompatíveis no pagamento ou refresh. Não mudar filtro Atrasados nem lógica de gravação.
- Executor desta fatia; provas de GET coleção, detalhe, 404, erro e troca de identidade, sem gravação contra a prévia. TDD e revisão de compatibilidade.

## Task 1.3: Compra atômica
- Depends on: none
- Entrada: D3, relação Purchase/PurchaseItem do schema atual. Entrega: PUT e DELETE indivisíveis preservando status/campos. Separada de 1.4 por arquivo: 1.4 não escreve na rota de compras.
- RED/GREEN em SQLite sintético com falha controlada durante PUT/DELETE, assert de rollback e registros sentinela e caminho feliz. Confirmar base vazia e caminho real com PRAGMA; remover snapshot de teste próprio ao fim.

## Task 1.4: Data civil da compra
- Depends on: none
- Entrada: D3 e representação ISO já usada pela rota atual. Entrega: manter dia selecionado no formulário, lista, compras no cartão, compras recentes do resumo, dia exibido no calendário, busca, recibo e CSV sem mudar transações ou timestamps históricos. Não editar endpoint de Compras nem regra de filtragem de períodos.
- Executor desta fatia; RED/GREEN em America/Bahia e UTC para 2026-11-19, caso histórico não meia-noite e checagem dos consumidores. Sem inferir origem histórica que não existe nos dados.

## Task 2.1: Integração e aceite
- Depends on: 1.1, 1.2, 1.3, 1.4
- Consome os quatro candidatos revisados, provas funcionais e readback isolado. A principal integra manifesto, testes Bun, baseline TypeScript comparável, contrato vigente e checkpoint visual; revisão independente verifica os mesmos bytes. Não marcar por resultado parcial.
- Gerar candidato após consolidar tarefas justificadas, evidências reais e readback. Guard verify → retrospectiva → verify; sem PASS se faltar prova.

## Checkpoint

Mandato atual: “aprovado, prossiga”. O Goal ativo da sessão é de outra mudança (empacotamento, bloqueado e desarmado); não o reutilizar. O runtime recusou criar Goal separado (proposta: 8 rodadas) enquanto o antigo existe. Continuar pelos retornos nativos dos executores, sem modificar o Goal antigo.
- Onda 1: 1.1 `a048-consorcio-identidade` (Team 16), 1.2 `a049-parcelas-detalhe` (Team 17), 1.3 `a050-compra-atomica` (Team 18), 1.4 `a051-data-civil` (Team 19). Superfícies de escrita disjuntas, sem banco compartilhado. Preflight confirmado; depois dos retornos, revisar e integrar os mesmos bytes.
- 1.1: `.tmp/quiet-qa/consortium-db-30/check.ts`, sandbox sem rede, PRAGMA, base inicial vazia e releitura via Prisma: ao confirmar B, A completo permaneceu idêntico e B recebeu apenas a baixa e seu agregado. DB descartado. Confirmação de destino na interface foi demonstrada separadamente, não equivale a E2E.
- Reconciliação documental: `docs/reference/design-system.contract.md` §Telas de negócio e widgets registra vínculo e erros de detalhe, gravação de compras, data civil e o limite da janela. O plano visual referencia a mudança de integridade sem fechar o aceite visual. Pesquisa histórica de tabelas não é fonte normativa.
- 1.1: Playwright `consortium-30.js` passou (A tardio não acionável em B, um POST interceptado com parcela B). Reaceite independente levantou GET do mesmo consórcio reaberto enquanto a mutação estava pendente; correção e nova revisão em andamento.
- 1.2: `installment-db-30/check.ts`: coleção/filtro/ordem por parcela/404 em Prisma SQLite isolado; DB descartado. Playwright `installments-30.js`: GET tardio de A não substituiu B, sem POST. A049 corrigiu também reabertura de A com POST pendente (dois RED esperados, GREEN 36).
- 1.3: A050 (RED 2 perdas de itens sob falha controlada, GREEN 6 com rollback, sentinelas e casos nominais). Revisor A054 repete prova isolada.
- 1.4: A051 corrigiu data dos consumidores diretos e Cartões; Dashboard e Calendário entraram no mesmo aceite após identificar conversões restantes. Não alterar filtros, instantes históricos ou janela de consulta.
- Reaceites 1.1/1.2/1.3: A055 — 15 testes nos bytes finais e handlers com respostas invertidas, reabertura de A e B preservado; A053 — 36 testes em sandbox, fingerprint `30f387f08391bc6e7dbf178fd2b784c59ad9c4d4cac59055ee67838acc8a43c2`; A054 — RED reconstruído 4/2, GREEN 6/0 e estados SQLite completos; principal repetiu GREEN 6/0. A repetição posterior de Parcelas no navegador teve timeout na navegação; prova anterior e reaceite focal independentes sustentam o escopo, não implantação.
- 1.4: já implementada, A056 revisa os bytes finais do resumo e calendário. Limites confirmados: inclusão no início da janela do calendário continua dependente de fuso; meia-noite UTC antiga é indistinguível de data civil. Suite geral: 176/0 e 15 opt-in/skips em cada fuso; TypeScript global: 29 diagnósticos, mesmos contadores do baseline, ainda não verde.
- Resumo e Calendário: RED reproduziu 18/11 em Bahia e horário indevido em UTC; GREEN informado 20/0 por fuso em SQLite isolado. Reaceite independente `a056-reaceite-data-civil` em andamento. A mudança visual continua 4/8; fechamento da presente mudança segue condicionado à revisão de integração.
- Integração com rollback habilitado: 182 testes passaram, 7 skips, 898 asserções em bwrap. Comparação TypeScript por caminho, código e mensagem (ignorando linhas/colunas) sem diagnósticos adicionados/removidos: 29 antes e 29 agora. `a057-revisao-integrada` confronta código, manifesto e documentos.
- 1.4 concluída: `a056-reaceite-data-civil` confirmou 31/31 em UTC e Bahia, com Prisma real no Calendário e renderização do componente com resposta real; limites da consulta e data das transações intactos. A056 conferiu os SHA-256 da A051. 2.1 aguarda integração independente, sem ação humana pendente.
- 2.1: suíte integrada no mesmo sandbox com rollback ativado; sobreposição somente leitura da rota de Compra da base produziu RED 180/2 (só as duas asserções de persistência), e o candidato GREEN 182/0; 7 casos condicionais cobertos pelas respectivas execuções isoladas. Nenhuma alteração em fontes para a comparação.
- Revisão integrada `a057-revisao-integrada`: 176/0, 861 asserções por fuso e validação estrutural. SHA-256 agregado produto+testes `58ea8ecd729f23d2226c0f7593bc321f83ea455b8d79957dd76250487f45526f`; após o parecer, só mudou a nota histórica do redesign e os registros de fechamento, sem mudar produto, testes ou contrato. Nenhuma alteração em schema, rotas de pagamento, deploy ou dados reais.
