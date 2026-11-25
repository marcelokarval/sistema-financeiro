# Retrospectiva — alinhar-contrato-busca-global-quiet

## Resumo da Entrega

- **Candidate:** `e2698a7ffdd63115845ca87fdcb3b97e9bdd415527724f5a898b642c68c611c5`
- **Commit de código (`main`):** `842223348705d087b2e6d9e3031a04a3d33237f4` (sobre `80f1f406443f235f4659aad2ff0ded8f20f3c6bc`)
- **Decisão aprovada (Q1):** **Alternativa A** confirmada pelo responsável de produto em `design.md`.
- **Escopo concluído (`2/2` tarefas):**
  1. `src/app/page.tsx` (`applySearchSelection`), `docs/reference/design-system.contract.md#L24`, `src/components/finance/quiet-navigation.test.tsx` e `src/components/finance/quiet-search-parity.qa.mjs` (sem `historicalAutoOpenDeviation`) alinhados.
  2. Seção 5.1 de `docs/reference/frontend-componentization-coverage.md` reconciliada e validada por teste de consistência, suíte global, `typecheck`, `lint` e `quiet-search-parity.qa.mjs` (`102` cenários pareados nas 6 células, `0` ignorados).

## O que Funcionou Bem

- Extração de `applySearchSelection` em `src/app/page.tsx` permitiu testar unitariamente todos os tipos suportados, `transactions` com e sem `accountId`, `categories` sem seleção e tipo desconhecido sem alterar o comportamento em produção.
- O teste de consistência documental em `quiet-navigation.test.tsx` garantiu TDD real (`RED -> GREEN`) tanto para `design-system.contract.md#L24` quanto para a Seção 5.1 de `frontend-componentization-coverage.md`.

## Achados e Lições Aprendidas

- Manter a decisão de produto explícita como gate antes do `apply` evitou retrabalho de código e alinhou simultaneamente documentação de contrato, especificação OpenSpec, testes unitários e runner de navegador.
