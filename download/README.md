# Arquivos gerados

## Quiet Financial OS — matriz final de QA visual

Capturas geradas com dados sintéticos em base SQLite temporária isolada (`/tmp/quiet-visual-qa.db`, removida após o ensaio), sem uso da base local de desenvolvimento (`db/custom.db`). Cobrem todos os **9 destinos** após as entregas finais de Wave 1 (`#34` e `#36`), validados também em `1440×900` (dark/light), `390×844` (dark/light) e `360×800` (dark/light) com `0` overflow horizontal, `0` erros de console, `0` page errors e `0` respostas HTTP 5xx.

| Destino | Viewport | Tema | Captura |
| --- | --- | --- | --- |
| `dashboard` (Resumo) | `1440×900` | `dark` | [Resumo, desktop escuro](<qa-quiet-resumo-1440-dark.png>) |
| `dashboard` (Resumo) | `1440×900` | `light` | [Resumo, desktop claro](<qa-quiet-resumo-1440-light.png>) |
| `accounts` (Contas) | `1440×900` | `dark` | [Contas, desktop escuro](<qa-quiet-contas-1440-dark.png>) |
| `cards` (Cartões) | `1440×900` | `light` | [Cartões, desktop claro](<qa-quiet-cartoes-1440-light.png>) |
| `purchases` (Compras) | `390×844` | `dark` | [Compras, celular escuro](<qa-quiet-compras-390-dark.png>) |
| `categories` (Categorias) | `1440×900` | `dark` | [Categorias, desktop escuro](<qa-quiet-categorias-1440-dark.png>) |
| `investments` (Investimentos) | `1440×900` | `light` | [Investimentos, desktop claro](<qa-quiet-investimentos-1440-light.png>) |
| `installments` (Parcelas) | `390×844` | `light` | [Parcelas, celular claro](<qa-quiet-parcelas-390-light.png>) |
| `consortiums` (Consórcios) | `390×844` | `light` | [Consórcios, celular claro](<qa-quiet-consorcios-390-light.png>) |
| `savings` (Caixinhas) | `390×844` | `dark` | [Caixinhas, celular escuro](<qa-quiet-caixinhas-390-dark.png>) |

A cobertura e os limites do ensaio estão no [plano da mudança](<../openspec/changes/recriar-interface-quiet-financial-os/plan.md>). Os PNGs não integram o manifesto nem o digest do candidato de empacotamento final.
