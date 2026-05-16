# FinanceApp Design System Contract

Generated from source and historical QA screenshots in:

- `src/app/page.tsx`
- `src/app/globals.css`
- `src/components/finance/*`
- `src/components/ui/*`
- `download/qa-final-dashboard.png`
- `download/qa-dashboard-dark.png`
- `download/qa-final-search.png`
- `download/qa-final-notifications.png`

Runtime note: `localhost:3000` was occupied by another app and this project had
no `node_modules`; no live browser runtime was started. Evidence comes from
source code plus existing QA screenshots. Those screenshots are historical
auxiliary evidence, not proof that the current runtime still matches them.

## Immutable Design Laws

1. FinanceApp is an app-shell financial dashboard, not a marketing page.
2. Preserve persistent sidebar, top header, scrollable main area, footer status
   and mobile bottom navigation/sheet model.
3. Financial numbers are first-class. Use tabular/mono treatment where values,
   dates, counters, IDs or shortcuts are shown.
4. The baseline identity uses semantic gradients by domain:
   dashboard/investments emerald-cyan, accounts violet-purple, cards
   orange-rose, purchases sky-cyan, categories amber-orange, savings rose-pink.
5. Both light and dark themes are source truth.
6. Glass, card glow, gradient border and shimmer exist, but must be tied to app
   surfaces or loading states.
7. Search and AI assistant are product primitives, not decorative widgets.
8. When premium direction is used, dark mode must be a token-derived sibling of
   light mode, not a visually unrelated black/neon dashboard.
9. The component catalog is broad enough that future theme work must prove
   recomposition across forms, overlays, feedback, navigation, data surfaces,
   loading and empty states, not only dashboard cards.

## Token Contract

| Token | Evidence | Rule |
| --- | --- | --- |
| `--background`, `--foreground` | `src/app/globals.css` | Base theme authority |
| `--card`, `--border`, `--muted` | `src/app/globals.css` | Panel/card vocabulary |
| `--primary` | `src/app/globals.css` | Active state and brand accent |
| `emerald/cyan` | `viewColors.dashboard`, charts | Healthy finance and dashboard |
| `violet/purple/fuchsia` | accounts/installments/AI | Existing AI/account accent, not universal default |
| `orange/rose/amber` | cards/categories/savings | Spend, card, budget and savings lanes |

Observed helpers:

- `.glass`
- `.glass-card`
- `.glass-enhanced`
- `.main-gradient`
- `.card-glow`
- `.card-premium`
- `.card-elevated`
- `.skeleton-shimmer`
- `.card-shimmer`
- `.hover-lift`
- `.focus-gradient`
- `.text-gradient-*`
- `.divider-gradient`
- `.status-glow-success`

## Component Recipes

### App Shell

Use:

- `Sidebar`
- header with current view icon/label/subtitle
- connection status
- `GlobalSearch`
- `NotificationPanel`
- theme toggle
- user avatar
- footer financial quick stats
- `QuickActions`
- `MobileNav`

### Sidebar Navigation

Recipe:

- grouped labels: `Principal`, `Financeiro`
- active item uses `bg-primary/10 text-primary`
- active rail uses `layoutId="sidebar-active"`
- icon tile uses per-view gradient only when active
- collapsed mode uses tooltips

### KPI Cards

Recipe:

- card shell with border/radius/shadow
- semantic left/top rail
- label in muted text
- strong financial amount
- optional helper/delta text

### Search / Command

Recipe:

- `⌘K` hint in header
- overlay list with transactions, accounts, cards, purchases, categories and
  investments
- keyboard-like density, not a marketing modal

### AI Advisor

Recipe:

- persistent assistant bar
- violet/purple trace is allowed here because source uses AI lane
- suggestions as pill buttons
- chat-like message bubble and input

### Tables / Charts

Recipe:

- Recharts for analytical surfaces
- tables for transactions, cards, billing and reports
- status badges, mono dates and financial values

### Feedback

Recipe:

- `sonner` toast for realtime update feedback
- notification panel for persistent messages
- skeleton cards for loading
- progress bars for budgets, goals and health score

## Component State Coverage Matrix

| Family | Default | Hover | Focus | Loading | Empty | Overlay | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Sidebar nav | source-code observed | source-code observed | not observed | n/a | n/a | tooltip observed | `sidebar.tsx` |
| Header actions | source-code observed | source-code observed | source-code observed | n/a | n/a | search/notifications | `page.tsx` |
| KPI cards | screenshot observed | source-code observed | n/a | skeleton observed | n/a | n/a | `dashboard-view.tsx`, screenshots |
| Charts | screenshot observed | not observed | n/a | skeleton observed | empty not proven | n/a | Recharts imports |
| Search | screenshot observed | source-code observed | source-code observed | n/a | not proven | runtime screenshot | `qa-final-search.png` |
| Notifications | screenshot observed | source-code observed | n/a | skeleton observed | not proven | runtime screenshot | `qa-final-notifications.png` |
| Forms | source-code observed | source-code observed | source-code observed | n/a | validation not fully proven | dialogs/sheets | component imports |
| Tables | source-code observed | source-code observed | n/a | skeleton observed | not proven | n/a | finance views |

## Premium Theme-Generator Contract

The current source proves a broad product and primitive catalog. Premium
direction must therefore work as a theme-generator seed:

- keep component anatomy stable across themes
- change canvas, surface, border, shadow, accent intensity and overlay
  material through tokens
- preserve semantic accents across themes: green cash, cyan forecast, amber
  obligation, rose risk, violet AI
- show equivalent component families in light and dark before implementation
- keep source-observed, available-in-code, premium-proposed and
  not-approved-yet components clearly separated

Do not treat a single attractive light layout as sufficient design-system proof.

## Layout Recipes

- `Desktop shell`: sidebar width around 250px, header height 64px, scrollable
  main content, footer status.
- `Dashboard`: quick stats, dashboard view, insights, forecasts, timeline,
  calendar, net worth and debt widgets stacked vertically.
- `Mobile`: sheet menu, compact header, bottom nav and safe footer padding.
- `Overlay`: search and notifications dim the surrounding dashboard.

## Motion / Interaction Contract

Use:

- Framer Motion for page transitions, sidebar hover, active rail and icon spring.
- CSS shimmer for skeleton/loading.
- CSS pulse/breathe for status indicators.
- Hover lift/glow only on interactive cards and buttons.

Do not:

- animate financial numbers in a way that reduces readability.
- use floating particles as primary product identity.
- make all cards glow simultaneously.

## Composition Rules For New Screens

1. Start with the app shell and current view metadata.
2. Use a financial primary object: account, card, transaction, bill, investment,
   goal, savings box, consortium or forecast.
3. Use one dominant semantic lane per screen.
4. Put dense records in tables/lists; put summaries in KPI cards.
5. Use charts only for trend, distribution, forecast, health or breakdown.
6. Keep search, notifications, AI and quick actions available unless the screen
   is an auth/public view.

## Forbidden Patterns

- Generic marketing hero inside the authenticated app shell.
- New purple/fuchsia gradient as global brand default.
- Fake financial metrics not backed by data.
- Decorative chart surfaces with no financial decision value.
- Raw shadcn card soup without FinanceApp semantic roles.
- Source-truth redesign inside `design-system.html`.

## Not Observed / Do Not Invent

Until runtime evidence or product need proves them:

- carousel for finance content
- menubar as primary app navigation
- context menu for critical money actions
- resizable panels
- OTP financial flow
- hover card as required decision surface

## Rebuild Checklist

- Preserves app shell, sidebar, header and footer.
- Uses financial semantic lane colors intentionally.
- Uses cards/tables/charts according to data density.
- Shows loading and empty states when data can be absent.
- Keeps search/notifications/AI/quick actions aligned with source behavior.
- Does not make premium direction overwrite source truth.

## Source Evidence Map

| Rule / Component | Source |
| --- | --- |
| App shell | `src/app/page.tsx` |
| Sidebar | `src/components/finance/sidebar.tsx` |
| Dashboard metrics/charts | `src/components/finance/dashboard-view.tsx`, `download/qa-dashboard-dark.png` |
| AI advisor | `src/app/page.tsx`, `download/qa-final-dashboard.png` |
| Search | `src/app/page.tsx`, `download/qa-final-search.png` |
| Notifications | `src/app/page.tsx`, `download/qa-final-notifications.png` |
| CSS helpers | `src/app/globals.css` |
| shadcn/Radix primitives | `src/components/ui/*`, `package.json` |

## Canonical Theme CSS Contract

Implementation source:

- `docs/reference/design-system.theme.css`

Canonical `--ds-*` tokens:

- `--ds-bg`, `--ds-fg`, `--ds-surface`, `--ds-surface-fg`, `--ds-surface-muted`
- `--ds-muted-fg`, `--ds-border`, `--ds-input`, `--ds-ring`
- `--ds-primary`, `--ds-primary-fg`, `--ds-secondary`, `--ds-secondary-fg`
- `--ds-accent`, `--ds-accent-fg`, `--ds-destructive`, `--ds-destructive-fg`
- `--ds-accent-positive`, `--ds-accent-info`, `--ds-accent-warning`, `--ds-accent-danger`, `--ds-accent-ai`
- `--ds-chart-1`, `--ds-chart-2`, `--ds-chart-3`, `--ds-chart-4`, `--ds-chart-5`
- `--ds-sidebar`, `--ds-sidebar-fg`, `--ds-sidebar-primary`, `--ds-sidebar-primary-fg`
- `--ds-sidebar-accent`, `--ds-sidebar-accent-fg`, `--ds-sidebar-border`, `--ds-sidebar-ring`
- `--ds-radius-sm`, `--ds-radius-md`, `--ds-radius-lg`, `--ds-radius-xl`
- `--ds-shadow-sm`, `--ds-shadow-md`, `--ds-shadow-lg`
- `--ds-font-sans`, `--ds-font-mono`

Compatibility aliases retained only for the existing showcase HTML:

- `--bg` -> `--ds-bg`
- `--fg` -> `--ds-fg`
- `--muted` -> `--ds-muted-fg`
- `--card` -> `--ds-surface`
- `--border` -> `--ds-border`
- `--primary` -> `--ds-primary`
- `--cyan` -> `--ds-accent-info`
- `--violet` -> `--ds-accent-ai`
- `--rose` -> `--ds-accent-danger`
- `--amber` -> `--ds-accent-warning`
- `--radius` -> `--ds-radius-lg`

Project shadcn/Tailwind aliases connected in `src/app/globals.css`:

- `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`
- `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`
- `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`
- `--destructive`, `--destructive-foreground`, `--border`, `--input`, `--ring`

The implementation API is the `--ds-*` layer. Compatibility aliases must not be
used for new component work.

## Showcase Class Evidence

The current source-truth HTML uses these showcase classes:

- `.active`, `.amber`, `.avatar`, `.bar`, `.blue`, `.body-preview`, `.brand`, `.brand-mark`
- `.btn`, `.chart`, `.chip`, `.component-card`, `.component-grid`, `.content`, `.dark-reference`
- `.donut`, `.emerald`, `.evidence`, `.h1-preview`, `.h2-preview`, `.h3-preview`
- `.header`, `.header-actions`, `.hero`, `.hero-main`, `.image-grid`, `.input`, `.metric`
- `.metric-grid`, `.name`, `.nav-icon`, `.nav-item`, `.nav-label`, `.page-title`, `.panel`
- `.panel-grid`, `.primary`, `.rose`, `.search`, `.shell`, `.shot`, `.sidebar`, `.size`
- `.spec`, `.spec-row`, `.surface-grid`, `.tile`, `.topnav`

Future regenerated showcase markup should migrate documentation-only wrappers to
`ds-doc-*` classes and reserve product classes for source-observed component
anatomy.
