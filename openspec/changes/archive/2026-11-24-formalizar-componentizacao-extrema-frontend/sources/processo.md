# Proveniência e decisões de planejamento

Escopo recebido: corrigir a change existente no Sistema Financeiro, usando a pilha canônica diretamente de `~/.agents`; preservar a paridade e o inventário do planejamento. O pedido não delega implementação, alteração do projeto ou troca de instalação. O candidato não registra aprovação humana ou resultado de revisão independente.

## Skills e adaptadores efetivamente consultados

| Etapa | Fonte lida diretamente | Aplicação no candidato |
|---|---|---|
| Seleção de fluxo | [using-superpowers/SKILL.md](file:///home/marcelo-karval/.agents/skills/using-superpowers/SKILL.md) e [mapeamento Antigravity](file:///home/marcelo-karval/.agents/skills/using-superpowers/references/antigravity-tools.md) | Leitura explícita da pilha solicitada; harness não autoriza operação de implementação. |
| Revisão da change existente | [openspec-update-change/SKILL.md](file:///home/marcelo-karval/.agents/skills/openspec-update-change/SKILL.md) | Descobrir raiz/status e reconciliar proposta, design e delta sem mexer nas specs vigentes. |
| Dono do planejamento | [spec-driven-superpowers/SKILL.md](file:///home/marcelo-karval/.agents/skills/spec-driven-superpowers/SKILL.md), [intake](file:///home/marcelo-karval/.agents/skills/spec-driven-superpowers/references/intake.md), [activation](file:///home/marcelo-karval/.agents/skills/spec-driven-superpowers/references/activation.md), [planning](file:///home/marcelo-karval/.agents/skills/spec-driven-superpowers/references/planning.md) e [contracts](file:///home/marcelo-karval/.agents/skills/spec-driven-superpowers/references/contracts.md) | Um pacote na change, com verificações estruturais, contratos, precedência, inventário e congelamento para revisão. |
| Decisões de desenho | [brainstorming/SKILL.md](file:///home/marcelo-karval/.agents/skills/brainstorming/SKILL.md) | Reusar o objetivo de refatoração; comparar extração de domínio, abstração universal e conversão mecânica no design. Não inferir decisão de produto para a Busca nem aprovação humana do candidato. |
| Plano verificável | [writing-plans/SKILL.md](file:///home/marcelo-karval/.agents/skills/writing-plans/SKILL.md), [test-driven-development/SKILL.md](file:///home/marcelo-karval/.agents/skills/test-driven-development/SKILL.md) | Microcontratos por ID com escopo, inputs e evidência futura. Caracterização preexistente e ciclo RED/GREEN/REFACTOR não são resultados do planejamento. Sem um segundo plano. |
| Revisão passiva | [Antigravity](file:///home/marcelo-karval/.agents/skills/spec-driven-superpowers/references/adapters/antigravity.md), [contrato de revisão](file:///home/marcelo-karval/.agents/skills/spec-driven-superpowers/references/harness-planning-review.md), [procedimento atual](file:///home/marcelo-karval/.agents/skills/spec-driven-superpowers/skills/spec-driven-superpowers/references/adapters/opencode.md) e [CLI planning-review](file:///home/marcelo-karval/.agents/skills/spec-driven-superpowers/scripts/planning-review.mjs) | Inspeção do vínculo sem declarar review. Registro de fidelidade, depois qualidade distinta, e publicação/readback apenas com evidência e autoridade adequadas. |

## Limite do adaptador OpenSpec

O [schema-fonte bridge v1](file:///home/marcelo-karval/.agents/skills/spec-driven-superpowers/schemas/superpowers-bridge/schema.yaml) é planning-only e usa microcontratos, índice e manifesto. OpenSpec 2.0.0 resolve o nome `superpowers-bridge` para um [schema usuário v2 homônimo](file:///home/marcelo-karval/.local/share/openspec/schemas/superpowers-bridge/schema.yaml), diferente em bytes, artefatos e lifecycle. A CLI não oferece migração nem seletor de arquivo para esta change; `--schema` escolhe por nome nas localizações registradas. Conforme o limite recebido, a metadata permanece `spec-driven` e o CLI é usado para status e validação estrita do delta. Nenhuma instalação, redirecionamento ou arquivo de outro workflow foi criado para simular ativação.

## Refinamento após a leitura de fidelidade de r2

O retorno independente de r2 (mensagem #63 do swarm) apontou três desvios materiais: mistura das regras de exclusão e baixa de Consórcios, tratamento de uma divergência da Projeção como se já fosse uma garantia de paridade e fallback de foco da Busca incompleto. R3 corrige os contratos de planejamento, não o produto. A nova revisão deve vincular r3; a leitura anterior não constitui resultado registrado para este candidato.

A persistência autorizada pelo pedido de corrigir as specs, delimitada na coordenação (#57 e #64), corresponde à gravação/readback local do pacote de planejamento somente nesta change. Nenhum destino externo, merge, deploy, handoff ou implementação está autorizado. A publicação canônica local é operação posterior com precondições de revisão, prontidão, observador, CAS e readback; nenhum destes resultados foi presumido no congelamento.

## Refinamento após qualidade de r3

A qualidade independente de r3 (resultado #71) apontou Q01–Q04; o FAIL foi registrado pela API canônica antes das mudanças, ligado à fidelidade de r3. Os envelopes e bytes que a ferramenta mantém em `reviews/` são históricos, não uma revisão de r4. R4 exige prova separada das quatro suites SQLite sem skips, prova de DOM real antes do aceite local das folhas afetadas, CSS real e testemunhas computadas da matriz e árvore Git inicial precisa para 0022. A separação serial de 0022 é obrigatória se não houver isolamento já autorizado; a sequência de integração vale em ambos os casos. Nenhum teste de produto foi executado neste refinamento.

## Refinamento após fidelidade de r4

O FAIL de fidelidade de r4 (#76) foi registrado antes da revisão e fica como histórico, fora da vinculação de r5. F04 apontou uma lacuna no oráculo de foco de 0004/0008: a restauração pode mirar uma origem ainda conectada que a releitura remove em seguida. R5 exige medir fechamento e remoção da linha em lista/detalhe e nas duas ordens de GET, sem confundir paridade com conformidade Quiet. Os demais oráculos foram conferidos contra os controladores/provedores: preservam ordem e alvo observado, distinguem intenção do contrato e não inventam resultado de execução nem outra lacuna confirmada.

## Refinamento após fidelidade de r5

O FAIL de fidelidade de r5 (#81) foi registrado antes do refinamento; seus bytes são históricos, não vinculam r6. F05 pediu o alerta de exclusão de Caixinhas e a separação de DELETE, fechamento Radix e releitura que remove a origem. A varredura de ações irmãs de exclusão, fechamento, releitura, troca A/B, foco e suas folhas está na [matriz temporal](verificacao-futura.md#matriz-de-fechamento-exclusão-e-releitura). As possibilidades permitidas pela fonte são insumos para a caracterização, não resultados de execução. Em divergências observadas, a expectativa Quiet fica explícita e a correção de produto fica fora desta change.

## Refinamento após qualidade de r6

O FAIL de qualidade de r6 (#91) ficou registrado antes da revisão e é histórico na r7. Q05 foi resolvido como contrato de paridade por ramo de gravação de Metas e Orçamento mensal. A [varredura irmã](verificacao-futura.md#matriz-de-gravação-e-falhas) verificou controladores, distinguindo também reconciliação de Consórcios em falha e a ausência de guarda de fechamento tardio no editor de Investimentos, sem alegar execução nem pedir novas políticas nesta change.

## Refinamento após qualidade de r7

O FAIL de qualidade r7 (#101) foi registrado antes do refinamento; é histórico em r8. Q06 separa o isolamento obrigatório do processo (bundle, launcher, daemon e Chrome) da interceptação da página. O launcher instalado foi examinado por fonte; nenhum browser, sandbox, daemon, serviço ou ambiente foi executado/reconfigurado nesta autoria. O [preflight único](verificacao-futura.md#preflight-único-para-todo-qa-de-navegador) incide em todas as invocações planejadas, inclusive no runner imutável de 0006 e na matriz de 0023. [Security audit em guidance](file:///home/marcelo-karval/.agents/skills/security-audit/SKILL.md) e [política de revisão](file:///home/marcelo-karval/.agents/SECURITY-REVIEW.md) orientam a fronteira sintética, sem auditoria de produto ou consulta externa.
