# DAG atual — 18 folhas executáveis e 5 pacotes (Planejamento ASDS concluído)

Legenda: ✅ Integrada · 🟨 parcial · 📝 contrato preparado · ▶️ pronta agora · ⬜ não executada · 🚫 bloqueada
Todas as 6 ondas (`25b4453..ea32229`, mais `980110c` pré-0023) foram executadas, verificadas e integradas localmente em `main`; as `23/23` checkboxes de `tasks.md` estão marcadas como concluídas.
Nota histórica: `reviews/planning-store-r8-receipt.json` registra os hashes pré-execução do pacote `r8` (baseline do planejamento no momento da admissão).

```text
0003 ✅ Integrada (87d8c5f) Consolidar o editor e a confirmação de Investimentos

0004 ✅ Integrada (eb55260) Consolidar edição e exclusão de Consórcios

0005 ✅ Integrada (a55192c) Unificar campos de transação de Contas
 └─ 0006 ✅ Integrada (558aac5) Centralizar a trava síncrona de Contas e Cartões

0020 ✅ Integrada (36c68b9) Compartilhar o modelo de campos de Recibos

0022 ✅ Integrada (25b4453) Calibrar o gate AST com baseline revisável

[0003 + 0004 + 0005]
 ├─ 0008 ✅ Integrada (5f3afe6) Adotar casca de formulário e confirmação em dois domínios
 │  └─ 0019 ✅ Integrada (9410840) Separar editor e confirmação de Recorrências
 └─ 0010 ✅ Integrada (7bbd1e6) Adotar progresso e estados de consulta nos painéis
    ├─ 0011 ✅ Integrada (528e83f) Adotar casca de tooltip sem unificar cálculos
    └─ [0005 + 0010] → 0016 ✅ Integrada (70ed596) Isolar a composição do shell e dos serviços de interface

[0003 + 0004 + 0005 + 0006]
 └─ 0009 ✅ Integrada (0e457d1) Adotar linha financeira e métrica com variantes reais

[0006 + 0008 + 0009]
 ├─ 0013 ✅ Integrada (e59cad8) Separar seletor, detalhes e movimentação nas operacionais prioritárias
 └─ 0014 ✅ Integrada (3014776) Separar Cartões, Compras e Categorias por responsabilidade

[0008 + 0010]
 └─ 0015 ✅ Integrada (55fa76d) Separar diálogos de Parcelas e Caixinhas

[0008 + 0009 + 0010]
 └─ 0017 ✅ Integrada (5ec4d99) Consolidar indicadores, metas e estados em widgets

[0009 + 0011]
 └─ 0018 ✅ Integrada (75fdd94) Decompor mapas densos de análise e calendário

[0011 + 0013 + 0014 + 0015 + 0016 + 0017 + 0018 + 0019 + 0020 + 0022]
 └─ 0023 ✅ Integrada (ea32229; pré-0023: 980110c) Fechar inventário e evidência integrada da migração
```

## Estado reconciliado das 18 folhas executáveis (`0003`..`0023`)

| Task | Onda | Estado atual | Commit local | Observação |
|---|---|---|---|---|
| 0003 | Wave 1 | ✅ Integrada | `87d8c5f` | Editor e confirmação de Investimentos consolidados |
| 0004 | Wave 1 | ✅ Integrada | `eb55260` | Edição e exclusão de Consórcios consolidadas |
| 0005 | Wave 1 | ✅ Integrada | `a55192c` | Campos de transação de Contas unificados |
| 0020 | Wave 1 | ✅ Integrada | `36c68b9` | Modelo de campos de Recibos compartilhado |
| 0022 | Wave 1 | ✅ Integrada | `25b4453` | Gate AST calibrado com baseline revisável |
| 0006 | Wave 2 | ✅ Integrada | `558aac5` | Trava síncrona de Contas e Cartões centralizada |
| 0008 | Wave 2 | ✅ Integrada | `5f3afe6` | Casca de formulário e confirmação em dois domínios |
| 0010 | Wave 2 | ✅ Integrada | `7bbd1e6` | Progresso e estados de consulta nos painéis |
| 0009 | Wave 3 | ✅ Integrada | `0e457d1` | Linha financeira e métrica com variantes reais |
| 0015 | Wave 3 | ✅ Integrada | `55fa76d` | Diálogos de Parcelas e Caixinhas separados |
| 0016 | Wave 3 | ✅ Integrada | `70ed596` | Composição do shell e serviços de interface isolados |
| 0019 | Wave 3 | ✅ Integrada | `9410840` | Editor e confirmação de Recorrências separados |
| 0011 | Wave 4 | ✅ Integrada | `528e83f` | Casca de tooltip adotada sem unificar cálculos |
| 0013 | Wave 4 | ✅ Integrada | `e59cad8` | Seletor, detalhes e movimentação nas operacionais prioritárias |
| 0017 | Wave 4 | ✅ Integrada | `5ec4d99` | Indicadores, metas e estados consolidados em widgets |
| 0014 | Wave 5 | ✅ Integrada | `3014776` | Cartões, Compras e Categorias separados por responsabilidade |
| 0018 | Wave 5 | ✅ Integrada | `75fdd94` | Mapas densos de análise e calendário decompostos |
| 0023 | Wave 6 | ✅ Integrada | `ea32229` | Inventário, cobertura e baseline fechados (após remediação pré-0023 `980110c`) |

## Estado reconciliado dos 5 pacotes estruturantes

| Pacote | Estado atual | Escopo coberto |
|---|---|---|
| 0001 | ✅ Integrada | Componentização verificável do frontend (`25b4453..ea32229`) |
| 0002 | ✅ Integrada | Fluxos prioritários de domínio (`0003`, `0004`, `0005`, `0006`) |
| 0007 | ✅ Integrada | Padrões transversais comprovados (`0008`, `0009`, `0010`, `0011`) |
| 0012 | ✅ Integrada | Famílias de produção remanescentes (`0013`..`0020`) |
| 0021 | ✅ Integrada | Proteção arquitetural e fechamento (`0022`, `0023`) |
