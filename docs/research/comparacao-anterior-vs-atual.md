# Análise Comparativa: Anterior vs Atual

> **Data:** 2026-05-16
> **Anterior:** commit `de330fb` (remoto original do GitHub)
> **Atual:** commit `547f1b9` (local após reorganização)
> **Conclusão:** A versão "atual" é uma **regressão estrutural** com melhorias visuais pontuais.

---

## Screenshots

Os prints estão em `/tmp/sistema-financeiro-comparison/` (temporário — recriar se necessário):

| Arquivo | Descrição |
|---|---|
| `anterior-desktop-light.png` | Anterior, light mode, dashboard |
| `anterior-desktop-dark.png` | Anterior, dark mode, dashboard |
| `atual-desktop-light.png` | Atual, light mode, dashboard |
| `atual-desktop-dark.png` | Atual, dark mode, dashboard |

Para recriar os prints, subir ambas as versões nas portas 33210 (atual) e 33211 (anterior).

---

## Diferenças Críticas

### 1. 🔴 Layout Grid destruído (regressão crítica)

| Aspecto | ANTERIOR | ATUAL |
|---|---|---|
| Container | `grid grid-cols-1 lg:grid-cols-2 gap-6` | `space-y-6` (stack vertical) |
| DashboardView | `lg:col-span-2` (full-width) | Sem largura especial |
| SmartInsights | `lg:col-span-2` (full-width) | Sem largura especial |
| SavingsChallenge | `lg:col-span-2` (full-width) | Sem largura especial |
| Widgets pareados | CashFlow+SpendingTimeline, Debt+Analytics lado a lado | Todos empilhados verticalmente |

**Impacto:** O dashboard da anterior é um grid 2 colunas responsivo com widgets intencionalmente pareados. A atual é uma lista vertical — mais scrolling, desperdício de espaço em telas wide.

### 2. 🔴 Shared Components removidos (regressão arquitetural)

A anterior tinha **577 linhas** de componentes compartilhados que a atual não tem:

- `src/components/shared/widget-card.tsx` (442 linhas)
  - `WidgetCard` — shell unificado para todos os widgets
  - `WidgetCardSkeleton` — loading states consistentes
  - `MiniMetricCard` — sub-métricas compactas
  - `QuickStatCard` — cards de stat do dashboard
  - `FilterPills` — botões de filtro reutilizáveis
  - `AnimatedCounter` — contador animado compartilhado
  - `TrendBadge` — badge de tendência com seta

- `src/components/shared/chart-tooltip.tsx` (135 linhas)
  - `ChartTooltipMulti` — tooltips para gráficos de barras/área/linha
  - `ChartTooltipSingle` — tooltips para gráficos de pizza/donut
  - `ChartTooltipSimple` — tooltips numéricos simples

A atual duplica tudo inline no `dashboard-view.tsx` (923 vs 836 linhas).

### 3. 🟡 QuickStatsOverview (novo, discutível)

A atual adicionou `src/components/finance/quick-stats-overview.tsx` (510 linhas):
- Widget separado com sparklines, badges e métricas animadas
- **Duplica funcionalidade** que o dashboard-view já tinha nos quick stats internos
- Renderizado acima do DashboardView como elemento separado

### 4. 🟡 Design System Premium (added, mas subutilizado)

A atual importa `docs/reference/design-system.premium-theme.css` com variáveis `--ds-*`:
- Classes: `glass-card`, `glass-enhanced`, `card-elevated`, `hover-lift`, `hover-shimmer`
- Header com `glass-card` extra
- Porém, componentes continuam usando cores Tailwind hardcoded (`from-emerald-500/10`) em vez das variáveis `--ds-*`

---

## O que cada versão faz melhor

### ANTERIOR (acertos)
- Grid layout 2 colunas responsivo
- Componentes `WidgetCard` / `ChartTooltip` fatorados e reutilizáveis
- `WidgetCardSkeleton` para loading states consistentes
- `MiniMetricCard` para sub-métricas dentro de widgets
- `AnimatedCounter` e `TrendBadge` compartilhados
- `FilterPills` reutilizável para filtros de data
- `col-span-2` estratégico em widgets que precisam de mais largura
- Sidebar com labels de seção no código (já era bom)

### ATUAL (melhorias)
- `QuickStatsOverview` com métricas de saúde financeira e sparklines
- Cards com gradientes mais expressivos
- Import do premium theme (`--ds-*`)
- Efeitos glass no header e footer
- Sidebar com labels `PRINCIPAL` / `FINANCEIRO` visíveis no render

---

## Recomendação: Merge Seletivo

1. **Base:** Começar pela ANTERIOR (arquitetura melhor)
2. **Portar da atual:**
   - `QuickStatsOverview` (se as métricas extras forem desejadas)
   - Efeitos glass (`glass-card`, `glass-enhanced`)
   - Import do `design-system.premium-theme.css`
   - Labels de seção do sidebar
3. **Restaurar da anterior:**
   - Grid layout 2-colunas com `col-span-2`
   - Shared components (`widget-card.tsx` + `chart-tooltip.tsx`)
   - `QuickStatCard` e `FilterPills` fatorados
4. **Limpar:**
   - Remover duplicação inline do dashboard-view
   - Aplicar variáveis `--ds-*` ao invés de cores hardcoded

---

## Estado dos Repositórios

| | Anterior | Atual |
|---|---|---|
| **Diretório** | `sistema-financeiro-anterior/` | `sistema-financeiro/` |
| **Commit** | `de330fb` | `547f1b9` |
| **Branch** | detached HEAD | `main` |
| **Remote** | removido | `origin/main` |
| **Porta dev** | 33211 | 33210 |

Para recriar a versão anterior a partir do git:
```bash
git clone https://github.com/marcelokarval/sistema-financeiro /tmp/sistema-financeiro-remote
cd /tmp/sistema-financeiro-remote && git checkout de330fb
# Ou restaurar do preservado:
cp -r sistema-financeiro-anterior/ /tmp/restore-anterior/
```
