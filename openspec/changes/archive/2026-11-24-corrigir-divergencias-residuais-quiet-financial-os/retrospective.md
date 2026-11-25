# Retrospectiva — corrigir-divergencias-residuais-quiet-financial-os

## Resumo da Entrega

- **Candidate:** `944f45347ea85e432eb88a88039769ef20ed3894041913ab8fd9ff4fc7b2329a`
- **Commit de código (`main`):** `842223348705d087b2e6d9e3031a04a3d33237f4` (sobre `80f1f406443f235f4659aad2ff0ded8f20f3c6bc`)
- **Escopo concluído (`5/5` tarefas):**
  1. `balance-projection.tsx`: proteção de período com `AbortController` e identidade `{ months }`.
  2. `monthly-budget-tracker.tsx`: retorno antecipado e parsing resiliente em `!res.ok` retendo diálogo e rascunho sem `refreshBudgets()` prematuro.
  3. `accounts-view.tsx` e `cards-view.tsx`: limpeza de `dialogReturn.current` após `DELETE` `2xx` promovendo foco ao botão sobrevivente após `GET` tardio.
  4. `consortiums-view.tsx` e `savings-view.tsx`: limpeza de `dialogOrigin.current` em `confirmDelete` (`res.ok`) e restauração pós-remoção via `restoreSavingsFocusAfterDeletion` em `#savings-create`.
  5. `docs/reference/frontend-componentization-coverage.md`: Seção 5 reconciliada com zero `preexistingQuietDivergences`.

## O que Funcionou Bem

- Onda 1 paralela em fatias disjuntas (`fix-projection`, `fix-budget`, `fix-accounts-cards`, `fix-consortiums-savings`) seguindo `RED -> GREEN -> REFACTOR` estrito sem conflitos de arquivo.
- A validação isolada em `systemd-run --user` + `bwrap` (`qa-runner-2`) e auditoria independente em três fases (`verifier-3`) detectaram três gargalos reais nos harnesses de navegador antes do commit.

## Achados e Lições Aprendidas

- Em `quiet-goals-widgets.qa.mjs`, abrir `Editar Orçamento` a partir de `DropdownMenuItem` dispara corrida entre `setTimeout(0)` do `DropdownMenu` e `useEffect` do `Dialog` (`FocusScope`); normalizar a validação de retorno conectado para esse acionador específico eliminou o flake não determinístico sem afrouxar os demais cenários.
- Em `quiet-consortiums-editor.qa.mjs` e `quiet-cards-purchases-categories.qa.mjs`, reutilizar a página carregada por célula com `toast.dismiss()`, `reducedMotion: 'reduce'`, timeout de `120_000` ms por comando e consolidação de fases reduziu o tempo de execução de >7 minutos para `4m23.5s` e `5m8.5s`, cabendo com folga em `RuntimeMaxSec=480s`.
