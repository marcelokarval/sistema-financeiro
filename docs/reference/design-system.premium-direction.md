# FinanceApp Premium Direction v2

This is the corrected premium direction after re-running the FinanceApp design-system test with the new Accelerate rule for dual-theme and broad component coverage.

It does not replace source truth:

- `docs/reference/design-system.html`
- `docs/reference/design-system.contract.md`

Companion visual proof:

- `docs/reference/design-system.premium-direction.html`

## Test Rerun Finding

The previous premium direction succeeded in light mode but failed as a complete design-system generator:

- the dark sample was an isolated vault block, not a coherent sibling theme
- the gallery was attractive but too narrow for the real local component catalog
- the artifact could guide a hero/dashboard refresh, but not generate many future finance screens

This v2 fixes that by treating FinanceApp as a themeable financial product system.

## Direction Name

**Private Ledger Theme System**

The product should feel like a private financial operating room: calm, trustworthy, data-rich and local-first. The premium identity must be able to generate many interfaces from tokens and component recipes, not just one beautiful dashboard.

## Core Shift

| Current / Previous | v2 Rule |
| --- | --- |
| Light looked premium, dark looked unrelated | Light and dark are sibling token sets over the same anatomy |
| Hero/cards/table proved atmosphere | Full app component showroom proves recomposition |
| Purple appeared as generic AI polish | Violet is only AI/automation trace |
| Gradients decorated sections | Accents encode finance semantics |
| Component gallery was thin | Gallery must cover shell, forms, overlays, feedback, data and states |
| Direction was a mockup | Direction is a future theme-generator seed |

## Immutable Product Semantics

These do not change between themes:

- cash / liquidity / healthy = money green
- forecast / analytics / projection = cyan
- upcoming obligations / due soon / budgets = amber
- debt / risk / destructive / overspend = rose
- AI / automation / suggestion trace = violet
- amounts, due dates, card limits and account balances use tabular/mono posture
- dense records belong in ledger rows or tables, not decorative cards
- confirmations must state financial consequence before action
- search, notifications and AI are first-class product primitives

## Theme Token Model

### Light Ledger Mode

Use for daily operation, reading, entry, budgeting and calm financial review.

| Token | Value | Role |
| --- | --- | --- |
| `--ledger-bg` | `#f6f1e7` | warm app canvas |
| `--ledger-surface` | `#fffaf0` | cards, forms, panels |
| `--ledger-muted` | `#e8decd` | subtle controls and skeletons |
| `--ledger-line` | `rgba(37, 45, 39, .13)` | borders and dividers |
| `--ledger-ink` | `#101815` | primary text |
| `--ledger-soft` | `#627067` | secondary text |

### Dark Vault Mode

Use for analysis, investments, sensitive data, risk review, search/AI overlays and high-density decision views.

| Token | Value | Role |
| --- | --- | --- |
| `--vault-bg` | `#10140f` | deep warm canvas, not pure black |
| `--vault-surface` | `#171d16` | cards, panels, overlays |
| `--vault-muted` | `#222a21` | control fills and skeletons |
| `--vault-line` | `rgba(224, 236, 216, .14)` | borders and separators |
| `--vault-ink` | `#eef4e8` | primary text |
| `--vault-soft` | `#a7b2a4` | secondary text |

### Shared Semantic Accents

| Token | Value | Meaning |
| --- | --- | --- |
| `--money-green` | `#12805c` | income, liquidity, healthy |
| `--forecast-cyan` | `#177f96` | forecasts, analytics |
| `--obligation-amber` | `#b7791f` | bills, budgets, due soon |
| `--debt-rose` | `#c2415b` | debt, risk, destructive |
| `--ai-violet` | `#7557f6` | AI advisor and automation only |

## Component Anatomy vs Theme Tokens

Keep anatomy fixed:

- shell structure, sidebar density, header affordances, footer status
- card hierarchy: label, amount, consequence, rail/status
- form anatomy: label, value, helper, validation, action row
- row anatomy: item, account/source, amount, status, next action
- overlay anatomy: title, consequence, dense content, final action
- state anatomy: default, hover, focus, active, disabled, loading, empty, error, success

Change through tokens:

- canvas and surface colors
- border contrast
- semantic accent intensity
- shadow/glow strength
- skeleton and disabled fills
- chart grid/axis contrast
- overlay backdrop materiality

## Surface System

### Ledger Summary Card

For balances, card invoices, savings boxes, budgets, goals and short health signals.

Rules:

- one semantic rail
- one dominant amount
- one consequence sentence
- optional trend chip
- same anatomy in light and dark

### Vault Analytics Panel

For charts, investments, net worth, forecasts, risk and AI/search surfaces.

Rules:

- high contrast but not neon
- subdued grid lines
- accents only for meaning
- dark mode must look like the same product, not another app

### Obligation Row

For bills, installments, subscriptions, recurring transactions and card purchases.

Rules:

- dense row
- due date visible
- account/card source visible
- amount aligned
- status chip small
- next action explicit

### Confirmation Surface

For transfers, payment, deletion, settlement, card actions and debt-risk changes.

Rules:

- consequence sentence first
- amount and source visible
- destructive actions rose
- never hide money consequence behind generic modal copy

## Premium Component Coverage Matrix

Legend:

- `source-observed`: present in current source, screenshots or finance modules
- `available-in-code`: primitive exists locally but needs FinanceApp skin
- `premium-proposed`: valuable product primitive not yet fully evidenced
- `not-approved-yet`: catalog exists but product need is unproven

| Family | Status | Required v2 treatment |
| --- | --- | --- |
| App shell / sidebar / header / footer | source-observed | light/dark shell parity, persistent financial status |
| Mobile nav / sheet | source-observed | compact ledger controls, no marketing bottom nav |
| Buttons / icon buttons / FAB | source-observed | green primary, ink/neutral secondary, rose destructive, violet AI |
| Cards / KPI / finance panels | source-observed | ledger summary and vault analytics variants |
| Badges / chips | source-observed | semantic finance chips, not decorative pills |
| Tables / rows / scroll areas | source-observed | dense ledger rows, aligned amounts, due/status/action |
| Search / command dialog | source-observed | transaction/account/card density, keyboard affordance |
| Notifications / toasts | source-observed | financial event feed, persistent vs ephemeral separated |
| AI advisor | source-observed | violet-only assistant lane with traceable suggestions |
| Progress / charts / skeletons | source-observed | budgets, goals, forecast, loading and health states |
| Forms / inputs / selects / textareas | source-observed | financial labels, helper text, validation and masked amount posture |
| Dialog / alert dialog | source-observed | consequence-first confirmations |
| Sheet / drawer | source-observed | mobile inspector and focused financial workflows |
| Tabs / filters / toggles | source-observed | time windows, account filters, visibility toggles |
| Checkbox / radio / switch / slider | available-in-code | recurring rules, budget thresholds, privacy and filters |
| Calendar / date picker | available-in-code | due dates, installments, forecasts, financial calendar |
| Accordion / collapsible | available-in-code | dense disclosure for purchases, categories and reports |
| Pagination | available-in-code | long ledger, reports and transaction history |
| Tooltip / hover-card / popover | available-in-code | explain finance terms and micro-context, never hide critical consequence |
| Breadcrumb / navigation-menu | available-in-code | only if route depth grows beyond current shell |
| Carousel / menubar / resizable / context menu | not-approved-yet | do not introduce as decoration or critical money action surface |

## Light vs Dark System Contract

The premium HTML must show the same component families in both modes:

- shell and nav
- action hierarchy
- KPI cards
- financial form controls
- ledger table rows
- overlays
- alerts/toasts
- progress/skeleton/empty states
- charts and dense analytics

Dark fails if it uses pure black, high-saturation neon, unrelated gradients, or a different geometric language.

## Theme Generator Readiness

A future agent must be able to create new themes by changing tokens while preserving recipes. Therefore every new premium component must answer:

1. Which semantic role does it serve?
2. Which anatomy is immutable?
3. Which token controls its light surface?
4. Which token controls its dark surface?
5. Which states are required?

## Canonical Premium Theme CSS Contract

Implementation source:

- `docs/reference/design-system.premium-theme.css`

The premium theme preserves the canonical `--ds-*` token API:

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
- `--ds-inset`
- `--ds-font-sans`, `--ds-font-mono`

Existing premium-direction aliases are compatibility-only and point back to
canonical tokens:

- `--ledger-bg`, `--ledger-surface`, `--ledger-muted`, `--ledger-line`, `--ledger-ink`, `--ledger-soft`
- `--vault-bg`, `--vault-surface`, `--vault-muted`, `--vault-line`, `--vault-ink`, `--vault-soft`
- `--money-green`, `--forecast-cyan`, `--obligation-amber`, `--debt-rose`, `--ai-violet`
- `--bg`, `--surface`, `--surface-2`, `--muted`, `--line`, `--ink`, `--soft`
- `--money`, `--forecast`, `--obligation`, `--debt`, `--ai`
- `--radius`, `--radius-sm`, `--shadow`, `--shadow-soft`, `--font`, `--mono`, `--inset`

New UI must consume `--ds-*` names. The aliases exist only to keep the current
reference HTML and markdown readable during the transition.
6. Which source component or primitive backs it?

## Motion Direction

Keep:

- page enter and sidebar active rail
- search/dialog entrance
- skeleton shimmer
- realtime status pulse
- small hover elevation on interactive financial cards

Reduce:

- floating decoration
- global gradient shifting
- glow on every card
- animation unrelated to money state

## Forbidden Patterns

- dark mode as a detached black/neon dashboard
- one-off premium HTML that cannot generate future screens
- raw shadcn defaults as final theme
- generic purple finance product identity
- decorative carousels for financial content
- fake financial values in implementation
- chart surfaces with no decision question
- hiding risky money actions behind generic dialogs

## Implementation Handoff

1. Rebuild premium direction as token layer first.
2. Prove shell, cards, forms, tables, overlays and feedback in both themes.
3. Refactor one primitive family at a time.
4. Compare implementation against source truth, contract, slop audit and premium HTML.
5. Do not close if dark parity or component-kit breadth is missing.
