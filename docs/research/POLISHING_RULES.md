# Polishing & Cross-Component Audit Rules
Project: FinanceApp — Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui
Date: 2026-04-19
Purpose: Permanent reference for UI polishing reviews, cross-component audits, and regression prevention
Scope: All visual components, layouts, views, and shared patterns

---

## How to Use This Document

Every polishing pass MUST follow this document as a checklist. Each section represents a category of issues that commonly arise during development. The patterns described are **real patterns found in the project** — not theoretical.

**Review flow:**
1. Run a visual pass (light + dark, all breakpoints)
2. Run the Component Deduplication Audit (§1)
3. Run the className Tokenization Audit (§2)
4. Run the Utility Centralization Audit (§3)
5. Run the Cross-View Consistency Audit (§4)
6. Run the Theme Harmony Audit (§5)
7. Run the Z-Index & Overlap Audit (§6)
8. Run the Responsive Expansion Audit (§7)
9. Run the Data Integrity Audit (§8)
10. Run the File Architecture Audit (§9)

---

## §1 — Componentization & Deduplication

### 1.1 Philosophy: Extreme Componentization

We prioritize componentization to the extreme. Every repeated visual pattern MUST become a shared component. This is non-negotiable.

**The Rule:** If the same visual pattern (card layout, list item, badge style, toggle button) appears in 2+ files, it MUST be extracted to `components/shared/`.

### 1.2 Summary Card Pattern — CRITICAL VIOLATION DETECTED

**Status:** Violation detected in `accounts-view.tsx` (lines 797–902) and `dashboard-view.tsx` (lines 359–464).

Both files contain 4 nearly identical summary cards with this structure:
```
gradient top bar → CardContent → label + icon + value + footer
```

**Current violation example (accounts-view.tsx):**
```tsx
// This pattern is repeated 4x with only color/icon/label changes
<motion.div variants={summaryItem}>
  <Card className="overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 card-glow">
    <div className="h-1 bg-gradient-to-r from-emerald-500 to-emerald-400" />
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Patrimônio Total</p>
          <p className="text-2xl font-bold mt-2 tracking-tight">{currencyFmt(...)}</p>
        </div>
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <PiggyBank className="w-5 h-5 text-white" />
        </div>
      </div>
      <div className="flex items-center gap-1 mt-3">
        <LayoutGrid className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">...</span>
      </div>
    </CardContent>
  </Card>
</motion.div>
```

**Required resolution:** Create a `SummaryCard` shared component:
```tsx
// components/shared/summary-card.tsx
interface SummaryCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  gradient: string;           // "from-emerald-500 to-emerald-400"
  iconGradient: string;       // "from-emerald-500 to-emerald-600"
  iconShadow: string;         // "shadow-emerald-500/20"
  valueColor?: string;        // "text-emerald-500" (optional)
  footer?: React.ReactNode;   // footer content
  className?: string;
}
```

### 1.3 Transaction List Item Pattern — CRITICAL VIOLATION DETECTED

**Status:** Violation detected in `dashboard-view.tsx` (lines 712–741) and `accounts-view.tsx` (lines 597–651).

Both files render an identical transaction list row with:
- Income/expense icon with colored background
- Description + date + category badge
- Amount with +/- prefix and color

**Required resolution:** Create a `TransactionRow` shared component.

### 1.4 Inline Sub-Components — EXTRACT WHEN REUSABLE

**Status:** Detected in `cash-flow-forecast.tsx` — `ConfidenceBadge` (lines 77–97) and `TrendIndicator` (lines 100–135) are defined locally.

These are reusable patterns. Any status/trend badge that encodes color + icon + label via a single value prop should live in `components/shared/`.

**Rule:** If a local component has ZERO dependency on parent component state, extract it.

### 1.5 Dialog/Form Duplication — CRITICAL VIOLATION DETECTED

**Status:** `accounts-view.tsx` contains 3 full dialog definitions inline:
- Account form dialog (create + edit)
- Transaction form dialog
- Transfer form dialog

**Required resolution:** Extract to:
- `components/shared/form-dialog.tsx` — generic wrapper
- `components/features/accounts/account-form.tsx` — account-specific form
- `components/features/accounts/transaction-form.tsx` — transaction-specific form

**Rule:** NEVER define Dialog + Form inline inside a view component. Always extract to a dedicated form component.

### 1.6 Unified Pattern Checklist

Before considering any view "polished", verify:

| Pattern | Shared Component | Violation Files |
|---------|-----------------|-----------------|
| Widget card shell | `WidgetCard` | dashboard-view.tsx (summary cards don't use it) |
| Metric card | `QuickStatCard` / `MiniMetricCard` | accounts-view.tsx (inline metric cards) |
| Summary stat card | `SummaryCard` (TODO) | accounts-view.tsx, dashboard-view.tsx |
| Transaction row | `TransactionRow` (TODO) | dashboard-view.tsx, accounts-view.tsx |
| Trend badge | `TrendBadge` | dashboard-view.tsx (inline trend arrow divs) |
| Filter pills | `FilterPills` | ✅ Used correctly |
| Animated counter | `AnimatedCounter` | ✅ Centralized |
| Chart tooltip | `ChartTooltip*` | ✅ Centralized |
| Empty state | No unified component | accounts-view.tsx (inline empty), dashboard-view.tsx |
| Confirm dialog | No unified component | accounts-view.tsx (inline AlertDialog) |

---

## §2 — className Tokenization

### 2.1 Zero-Tolerance for "Div Soup"

**Definition:** A div soup is any block of JSX where generic Tailwind classes are written inline without being wrapped in a component or tokenized via `cva`.

**The rule:** If a className string exceeds 3-4 class names and the pattern could appear elsewhere, it MUST be tokenized.

### 2.2 Excessive className = New Variant Signal

**Detection heuristic:** If you're writing the same className prefix in 2+ places, extract a variant.

**Real example from project:**
```tsx
// BAD — repeated in accounts-view.tsx (4x with different colors):
className="overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 card-glow"

// GOOD — this should be a shared base class or part of SummaryCard
```

### 2.3 No Template Literals in className Without cn()

**Status:** Violation detected in multiple files.

```tsx
// BAD — template literal concatenation
className={`flex items-center justify-center ${isActive ? 'bg-primary' : 'bg-muted'}`}

// GOOD — use cn()
className={cn(
  'flex items-center justify-center',
  isActive ? 'bg-primary' : 'bg-muted',
)}
```

**Rule:** ALWAYS use `cn()` from `@/lib/utils` for conditional classes. Never use template literals for className concatenation.

### 2.4 Tokenization Audit Checklist

For each file, grep for these anti-patterns:

| Anti-Pattern | grep Pattern | Action |
|-------------|-------------|--------|
| Template literal className | `\$\{.*className` | Convert to cn() |
| Inline style with color | `style=\{\{.*color` | Use Tailwind classes or CSS vars |
| Repeated className prefix (3+ chars) | Manual review | Extract variant |
| Hardcoded dimensions in className | `w-\[.*px\]` | OK if truly one-off |
| `dark:` prefix in className | `dark:` | OK only when no theme token exists |

---

## §3 — Utility Centralization

### 3.1 Zero-Tolerance for Duplicate Utility Functions

**Status:** CRITICAL VIOLATION. Multiple files define their own versions of shared utilities.

**Detected violations:**

| Utility | Canonical Location | Violation Files |
|---------|-------------------|-----------------|
| `currencyFmt` | `lib/helpers.ts` | accounts-view.tsx (line 56-57) — local definition |
| `dateFmt` | `lib/helpers.ts` | dashboard-view.tsx (line 62-65) — local definition, accounts-view.tsx (line 59-64) — local definition |
| `shortCurrency` | `lib/helpers.ts` | ✅ Used correctly in most files |
| `containerVariants` | `lib/helpers.ts` | accounts-view.tsx (line 84-87) — local definition as `container` |
| `itemVariants` | `lib/helpers.ts` | accounts-view.tsx (line 89-92) — local definition as `item` |
| `summaryContainerVariants` | `lib/helpers.ts` | accounts-view.tsx (line 94-97) — local definition |
| `summaryItemVariants` | `lib/helpers.ts` | accounts-view.tsx (line 99-102) — local definition |
| `listContainerVariants` | `lib/helpers.ts` | accounts-view.tsx (line 104-107) — local definition as `txItem` |
| `detailEntryVariants` | `lib/helpers.ts` | accounts-view.tsx (line 109-112) — local definition |

**accounts-view.tsx defines ALL 6 animation variants locally** (lines 84–112) instead of importing from `@/lib/helpers`. This is a 28-line violation.

### 3.2 Chart Color Arrays — MUST BE CENTRALIZED

**Status:** Violation detected.

- `dashboard-view.tsx` (line 80): `const COLORS = ['#22c55e', '#f97316', ...]` — 12 colors
- `expense-breakdown.tsx` (line 80): `const CHART_COLORS = ['#f43f5e', '#f97316', ...]` — 10 colors

Both arrays serve the same purpose but with different orderings. This causes visual inconsistency.

**Required resolution:** Create `lib/chart-colors.ts`:
```ts
export const CHART_COLORS = [
  '#22c55e', '#f97316', '#3b82f6', '#ef4444',
  '#a855f7', '#ec4899', '#f59e0b', '#64748b',
  '#06b6d4', '#84cc16', '#8b5cf6', '#94a3b8',
] as const;
```

### 3.3 Utility Audit Process

For every new or modified file:
1. Search for function definitions that match helpers.ts exports
2. Search for color/variant arrays that could be shared
3. Search for animation variant objects
4. If found locally, replace with import from canonical location

### 3.4 Hardcoded Number Formatting — CRITICAL VIOLATION

**Status:** Detected in `page.tsx` (line 489):
```tsx
{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(footerData.netWorth)}
```

This should use the shared `currencyFmt` from `@/lib/helpers`.

---

## §4 — Cross-View Consistency

### 4.1 Card System Consistency

The project has a clear card hierarchy that MUST be respected:

| Card Type | Component | When to Use |
|-----------|-----------|-------------|
| Widget card with header | `WidgetCard` | All dashboard widgets (chart containers, stats panels) |
| Compact metric card | `QuickStatCard` | Quick stats row, inline metric displays |
| Sub-metric inside widget | `MiniMetricCard` | Forecast months, budget items, savings stats |
| Summary overview card | `SummaryCard` (TODO) | View-level summary statistics |
| Interactive data card | shadcn `Card` | Account cards, transaction cards (with hover actions) |

**Violation:** `accounts-view.tsx` uses raw shadcn `Card` with inline gradient bars for summary cards (lines 797–902). These should use `SummaryCard`.

**Violation:** `dashboard-view.tsx` uses raw shadcn `Card` for the 4 summary cards (lines 359–464) instead of `SummaryCard`.

### 4.2 Accordion/Expandable Pattern — MUST BE UNIFIED

**Status:** Violation detected.

Three different expandable patterns exist:
1. `expense-breakdown.tsx` — category rows with manual `expandedCategory` state + `AnimatePresence`
2. `dashboard-view.tsx` — purchase items with manual `expandedPurchase` state + `AnimatePresence`
3. `accounts-view.tsx` — no expandable content (list only)

All use the same visual pattern (border + content reveal + AnimatePresence height animation) but are implemented independently.

**Required resolution:** Create `ExpandableRow` shared component:
```tsx
interface ExpandableRowProps {
  isExpanded: boolean;
  onToggle: () => void;
  header: React.ReactNode;
  expandedContent: React.ReactNode;
  className?: string;
}
```

### 4.3 Modal/Dialog Pattern — MUST BE UNIFIED

**Status:** Violation detected.

`accounts-view.tsx` contains:
- Account form dialog (create + edit combined)
- Transaction form dialog
- Transfer form dialog
- Delete confirmation (AlertDialog)

Each is defined inline with full dialog markup.

**Required pattern:**
```tsx
// ONE FormDialog wrapper, MANY form contents
<FormDialog
  open={open}
  onOpenChange={setOpen}
  title={editingAccount ? 'Editar Conta' : 'Nova Conta'}
  description="..."
  onSubmit={saveAccount}
  loading={isSubmitting}
  submitLabel={editingAccount ? 'Salvar' : 'Criar'}
>
  <AccountForm form={form} onChange={setForm} />
</FormDialog>
```

### 4.4 Badge Color Convention

The project has a consistent color scheme that MUST be followed:

| Context | Badge Style |
|---------|------------|
| Income / positive | `bg-emerald-500/10 text-emerald-600 border-emerald-500/20` |
| Expense / negative | `bg-rose-500/10 text-rose-600 border-rose-500/20` |
| Info / neutral | `bg-sky-500/10 text-sky-600 border-sky-500/20` |
| Warning / attention | `bg-amber-500/10 text-amber-600 border-amber-500/20` |
| Count / secondary | shadcn `variant="secondary"` with `text-[10px]` |

**Rule:** NEVER use raw `bg-green-500 text-white` for badges. Always use the `/10` opacity pattern.

---

## §5 — Theme Harmony (Dark/Light)

### 5.1 Zero Hardcoded Colors

**Status:** Violations detected.

| File | Line | Violation |
|------|------|-----------|
| cash-flow-forecast.tsx | 421 | `text-amber-700 dark:text-amber-400` — explicit dark variant |
| cash-flow-forecast.tsx | 424 | `bg-amber-500/10 text-amber-600 border-amber-500/20` |
| cash-flow-forecast.tsx | 441 | `text-amber-700 dark:text-amber-300/90` — explicit dark variant |
| cash-flow-forecast.tsx | 456 | `text-emerald-700 dark:text-emerald-400` — explicit dark variant |
| dashboard-view.tsx | 237-288 | Greeting banner with forced light mode (`text-white`) — acceptable (fixed gradient bg) |

**Rule:** When a component has a fixed background color (gradient), it's acceptable to force light text inside it. For ALL other contexts, use theme tokens.

### 5.2 Theme Token Reference

| Purpose | Token | NEVER Use |
|---------|-------|-----------|
| Page background | `bg-background` | `bg-white`, `bg-gray-50` |
| Card surface | `bg-card` | `bg-white` |
| Text primary | `text-foreground` | `text-gray-900`, `text-black` |
| Text secondary | `text-muted-foreground` | `text-gray-500`, `text-gray-400` |
| Borders | `border-border` | `border-gray-200`, `border-gray-700` |
| Hover surface | `hover:bg-accent/50` | `hover:bg-gray-100` |
| Muted surface | `bg-muted` | `bg-gray-100`, `bg-gray-800` |
| Popover surface | `bg-popover` | `bg-white` |
| Input background | `bg-background` | `bg-white` |

### 5.3 Gradient Banner Exception

Components with fixed gradient backgrounds (like the greeting banner in dashboard-view.tsx) may use forced `text-white` because the gradient is intentionally opaque. However:

- The gradient MUST use CSS variables or known hex values (not theme tokens)
- The forced-light section MUST be wrapped in a container with explicit text color overrides
- The gradient MUST be verified in BOTH themes

### 5.4 Testing Checklist

Every component MUST be visually verified in:

- [ ] Light mode — all text readable
- [ ] Dark mode — all text readable
- [ ] Light mode — no invisible borders
- [ ] Dark mode — no invisible borders
- [ ] Light mode — no "glowing" or harsh backgrounds
- [ ] Dark mode — no harsh white spots
- [ ] Light mode — gradient banners readable
- [ ] Dark mode — gradient banners readable

---

## §6 — Z-Index & Overlap Management

### 6.1 Layer System

```ts
// lib/z-index.ts (MUST be created — currently missing)
export const Z_INDEX = {
  base: 0,
  sticky: 20,
  overlay: 30,
  dropdown: 40,
  popover: 50,
  tooltip: 60,
  modal: 70,
  toast: 80,
  offcanvas: 90,
} as const;
```

### 6.2 Detected Violations

| File | Component | Current | Required |
|------|-----------|---------|----------|
| chart-tooltip.tsx | ChartTooltip wrapper | `z-[9999]` | `z-[60]` (Z_INDEX.tooltip) |
| expense-breakdown.tsx | Donut center text | `z-10` | `z-10` ✅ (below tooltip at z-50+ ✅) |
| expense-breakdown.tsx | PieChart wrapper | `z-0` | `z-0` ✅ |
| page.tsx | Header | `z-30` | `z-30` (Z_INDEX.sticky + 10) ✅ |
| page.tsx | Footer | `z-20` | `z-20` ✅ |

**Known issue:** The ChartTooltip uses `z-[9999]` which is a shotgun approach. This must be replaced with the proper layer constant. The tooltip needs to be above popovers and cards but doesn't need to be 9999.

### 6.3 Rules

- **NEVER** use `z-[9999]`, `z-50`, or any hardcoded z-index — always use `Z_INDEX` constants
- **NEVER** guess z-index values — check the layer system
- shadcn/ui components default to `z-50` — this is our "popover" level, which is fine for Dropdown/Select/Tooltip
- Recharts tooltips render as foreign elements — they need explicit `wrapperStyle={{ zIndex: 60 }}` when used inside WidgetCard
- Overlapping siblings in a grid MUST NOT require z-index — if they overlap, fix the layout

### 6.4 Tooltip/Popover Interaction Audit

When a tooltip appears near the edge of a card or another floating element:
1. Verify the tooltip is fully visible (not clipped by `overflow-hidden`)
2. Verify the tooltip renders above the card's gradient bar
3. Verify the tooltip renders above sibling cards
4. Test in both themes (shadow colors differ)

---

## §7 — Responsive Expansion (Beyond Desktop/Mobile)

### 7.1 Breakpoint Testing Matrix

| Breakpoint | Width | Target | Must Test |
|-----------|-------|--------|-----------|
| `xs` | 375px | iPhone SE | Cards stack, sidebar hidden, FAB visible |
| `sm` | 640px | Standard phone | 2-column stat grid, horizontal scroll for filters |
| `md` | 768px | Tablet portrait | Sidebar offcanvas, 3-column summaries |
| `lg` | 1024px | Tablet/laptop | Sidebar visible, 2-column widget grid |
| `xl` | 1280px | Desktop | 4-column summaries, full widget grid |
| `2xl` | 1536px | Large desktop | Max-width container centered, no excess whitespace |

### 7.2 Critical Responsive Rules

- **Minimum touch target:** 44px × 44px for all interactive elements on mobile
- **No horizontal scroll:** EVER, at ANY breakpoint (except intentional overflow-x on filter pills)
- **Sidebar:** Collapsed icon-only at `lg-`, offcanvas at `md-`, full at `xl+`
- **Cards:** Stack to single column at `sm-`, 2 columns at `md+`, grid-specific at `lg+`
- **Modals:** Full-screen on mobile (use `Sheet` component), centered dialog on desktop
- **Tables:** Convert to cards on mobile, responsive table on desktop
- **FAB:** Always visible and accessible on mobile, positioned bottom-right

### 7.3 Grid Responsive Pattern

```tsx
// Standard responsive grid — use this everywhere
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

// Widget pair grid
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

// Full-width widget in grid
<WidgetCard className="lg:col-span-2">
```

### 7.4 Common Responsive Mistakes

| Mistake | Example | Fix |
|---------|---------|-----|
| Fixed width on mobile | `w-[320px]` on chart | Use `max-w-[320px] w-full` |
| Overflow hidden clipping content | `overflow-hidden` on card with tooltip | Use `overflow-visible` on tooltip container |
| Text too small on mobile | `text-[10px]` for primary info | Minimum `text-xs` for readable content |
| Button too small on mobile | `h-6 w-6` for action button | Minimum `h-8 w-8` or `h-9 w-9` |
| No scroll container | Long list without max-height | Add `max-h-80 overflow-y-auto` |

---

## §8 — Data Integrity (No Mocks)

### 8.1 Real Data Only

**Rule:** NEVER use hardcoded mock data in production code. All data must come from the actual database via API routes.

### 8.2 Loading States — Use Skeletons, NEVER Fake Data

```tsx
// BAD — fake data as loading state
{isLoading ? (
  <PropertyCard property={{ name: 'Loading...', amount: 0 }} />
) : (
  <PropertyCard property={realProperty} />
)}

// GOOD — skeleton
{isLoading ? (
  <WidgetCardSkeleton gradient="from-teal-500 to-cyan-500" contentLines={3} />
) : (
  <WidgetCard>...</WidgetCard>
)}
```

### 8.3 Empty States — Descriptive with Action

Every list/grid that can be empty MUST implement the empty state pattern:

```tsx
<div className="flex flex-col items-center justify-center py-12 text-center">
  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
    <Icon className="w-8 h-8 text-muted-foreground" />
  </div>
  <h3 className="text-lg font-semibold text-foreground">Nenhum item encontrado</h3>
  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
    Descrição do porquê está vazio e o que fazer.
  </p>
  <Button onClick={action} className="mt-4">
    <Plus className="w-4 h-4" /> Ação Principal
  </Button>
</div>
```

### 8.4 Seed Data Convention

When creating seed data for development:
- Use deterministic prefixed IDs (`cat-food`, `cur-acc-nubank`, `cur-txn-salary-apr`)
- Use `upsert` to prevent duplicates on re-seed
- All seed data must represent realistic Brazilian financial data
- Currency values in BRL, dates in pt-BR format

### 8.5 Type Safety — No `any`

**Status:** Violation detected.

`dashboard-view.tsx` (lines 73–77) defines the data interface with `any[]`:
```tsx
interface DashboardData {
  recentTransactions: any[];
  recentPurchases: any[];
  expenseByCategory: any[];
  monthlyTrend: any[];
  accountBalances: any[];
}
```

**Rule:** Every API response MUST have a proper TypeScript interface. Use `any` ONLY as a temporary placeholder with a TODO comment. The correct types should be defined in `types/` and imported.

---

## §9 — File Architecture (.ts / .tsx Separation)

### 9.1 Rule

| File Type | Extension | Contains |
|-----------|-----------|----------|
| Components, pages, layouts | `.tsx` | JSX |
| Types, interfaces, enums, constants, utilities, services, stores, hooks | `.ts` | Zero JSX |

### 9.2 Current Structure Compliance

| Layer | Location | Status |
|-------|----------|--------|
| Primitives | `components/ui/` | ✅ All .tsx |
| Enhanced | (none yet) | — |
| Shared | `components/shared/` | ✅ All .tsx |
| Features | `components/finance/` | ✅ All .tsx |
| Layouts | `app/layout.tsx` | ✅ .tsx |
| Hooks | `hooks/` | ✅ All .ts |
| Utilities | `lib/` | ✅ All .ts |
| API Routes | `app/api/*/route.ts` | ✅ All .ts |
| Types | (scattered) | ⚠️ Types defined inside .tsx files |

### 9.3 Type Extraction — REQUIRED

**Status:** Violation detected. Types are defined inline in component files instead of being separated.

**Violations:**
- `dashboard-view.tsx` lines 67–77: `DashboardData` interface defined in .tsx file
- `accounts-view.tsx` lines 115–140: `Account`, `Transaction`, `Category` interfaces defined in .tsx file
- `expense-breakdown.tsx` lines 44–66: `CategoryItem`, `MonthlyItem`, `BreakdownData` defined in .tsx file
- `cash-flow-forecast.tsx` lines 45–64: `ForecastMonth`, `TopCategory`, `ForecastData` defined in .tsx file

**Required resolution:** Extract to `types/` directory:
```
types/
  dashboard.ts      # DashboardData, MonthlyTrendItem, etc.
  account.ts        # Account, Transaction, Category
  forecast.ts       # ForecastMonth, TopCategory, ForecastData
  expense.ts        # CategoryItem, MonthlyItem, BreakdownData
```

### 9.4 Named Exports Only

**Status:** Violation detected in `page.tsx`:
```tsx
export default function Page() { ... }
```

**Rule:** ALL components MUST use named exports. NEVER use default exports.

```tsx
// BAD
export default function Page() { ... }

// GOOD
export function Page() { ... }
```

---

## §10 — Internationalization (i18n)

### 10.1 Language Support

| Code | Language | Dictionary |
|------|----------|-----------|
| `pt` | Portuguese (all variants) | `messages/pt.json` |
| `en` | English (all variants) | `messages/en.json` |
| `es` | Spanish (all variants) | `messages/es.json` |

### 10.2 Fallback Rules

| Requested Locale | Resolved To |
|-----------------|-------------|
| `pt-BR`, `pt-PT`, `pt-AO` | `pt` |
| `en-US`, `en-GB`, `en-AU` | `en` |
| `es-MX`, `es-ES`, `es-AR` | `es` |

### 10.3 Implementation

Use `next-intl` (already in package.json) with standard Next.js dictionary files.

```ts
// lib/i18n/resolve-locale.ts
function resolveLocale(locale: string): 'pt' | 'en' | 'es' {
  const base = locale.split('-')[0].toLowerCase();
  if (['pt'].includes(base)) return 'pt';
  if (['en'].includes(base)) return 'en';
  if (['es'].includes(base)) return 'es';
  return 'pt'; // default
}
```

### 10.4 Current Status

**Status:** NOT IMPLEMENTED. All UI strings are hardcoded in Portuguese.

**Impact:** High — the entire codebase has hardcoded Portuguese strings that need to be extracted to dictionaries.

**Priority:** This is a future task. For now, all new code MUST continue using Portuguese strings directly, but structured so they can be easily extracted later (use descriptive variable names, avoid string concatenation).

---

## §11 — Sidebar & Navigation Consistency

### 11.1 Icon Rules

- Use Lucide icons exclusively — no custom SVGs unless unavoidable
- Icon size: `w-5 h-5` in sidebar, `w-4 h-4` in compact contexts
- Icons MUST NOT be hidden when sidebar is collapsed — show icon-only in collapsed state
- Consistent icon style: `strokeWidth={2}` (default), `fill="none"` (default)

### 11.2 Collapsed Sidebar Behavior

| State | Width | Labels | Icons | Tooltips |
|-------|-------|--------|-------|----------|
| Expanded | 256px | Visible | Visible | Hidden |
| Collapsed | 64px | Hidden | Visible | Show on hover |
| Mobile | 280px (Sheet) | Visible | Visible | Hidden |

### 11.3 Active State

```
Active:   bg-primary text-primary-foreground shadow-md shadow-primary/20
Hover:    hover:bg-accent/50 hover:text-foreground
Inactive: text-muted-foreground
```

---

## §12 — Animation & Motion Consistency

### 12.1 Shared Variants — MUST IMPORT, NEVER REDEFINE

**Status:** VIOLATION in `accounts-view.tsx` — all 6 variants defined locally.

All animation variants MUST be imported from `@/lib/helpers`:

| Variant | Stagger | Use Case |
|---------|---------|----------|
| `containerVariants` | 0.06 | Widget grids |
| `itemVariants` | 0.06 (duration 0.35) | Grid items |
| `summaryContainerVariants` | 0.08 | Summary rows |
| `summaryItemVariants` | 0.08 (duration 0.4, scale) | Summary cards |
| `listContainerVariants` | 0.04 | List containers |
| `listItemVariants` | 0.04 (duration 0.25, x-axis) | List items |
| `detailEntryVariants` | 0.35 (y-axis) | Detail view entry |

### 12.2 Variant Naming Convention

When creating a NEW variant (not in the shared list), follow the pattern:
```
{context}{Element}Variants
```

Examples:
- `alertItemVariants` — for alert list items
- `expandedContentVariants` — for expand/collapse content
- `forecastMonthVariants` — for forecast month cards

### 12.3 Animation Duration Limits

| Animation Type | Max Duration | Recommended |
|---------------|-------------|-------------|
| Entry (fade in) | 500ms | 200–400ms |
| Stagger delay per item | 100ms | 40–80ms |
| Hover lift | 200ms | spring(300, 20–25) |
| Expand/collapse | 300ms | 200–300ms |
| Page transition | 300ms | 200–250ms |
| Number counter | 1500ms | 800–1200ms |

### 12.4 Framer Motion Best Practices

- ALWAYS use `AnimatePresence` for conditional rendering
- ALWAYS specify `mode="wait"` for view transitions
- NEVER use `whileHover` without a `transition` prop
- Use `spring` physics for interactive elements (hover, tap)
- Use `tween` for entry/exit animations
- `whileTap: { scale: 0.97 }` for buttons
- `whileTap: { scale: 0.92 }` for action items (FAB menu items)

---

## §13 — Quick Reference Audit Checklist

Use this checklist for every polishing pass:

### Componentization
- [ ] No duplicate card patterns across views — all use shared components
- [ ] No inline Dialog/Form definitions — all extracted to form components
- [ ] No inline sub-components that could be shared
- [ ] All list patterns use shared row components
- [ ] No repeated badge/color patterns without shared component

### className & Tokens
- [ ] No template literal className — all use `cn()`
- [ ] No excessive inline className (3+ repeated patterns extracted)
- [ ] No hardcoded colors (bg-white, text-gray-500) — use theme tokens
- [ ] No `z-[9999]` — use Z_INDEX constants

### Utilities
- [ ] No local `currencyFmt` — import from helpers
- [ ] No local `dateFmt` — import from helpers
- [ ] No local animation variants — import from helpers
- [ ] No local chart color arrays — import from chart-colors
- [ ] No inline `Intl.NumberFormat` — use shared utility

### Cross-View Consistency
- [ ] Same card type uses same component across all views
- [ ] Same list pattern uses same row component across all views
- [ ] Badge colors follow the convention table
- [ ] Button sizes are consistent (sm for compact, default for primary)

### Theme
- [ ] All text readable in light mode
- [ ] All text readable in dark mode
- [ ] No invisible borders in either theme
- [ ] No harsh white spots in dark mode
- [ ] Gradient banners tested in both themes

### Z-Index
- [ ] Tooltips visible above all other content
- [ ] No `z-[9999]` anywhere
- [ ] Modal/Sheet renders above sidebar
- [ ] FAB renders above footer

### Responsive
- [ ] Tested at 375px (iPhone SE)
- [ ] Tested at 768px (tablet)
- [ ] Tested at 1280px (desktop)
- [ ] Tested at 1536px (large desktop)
- [ ] No horizontal scroll at any breakpoint
- [ ] Touch targets ≥ 44px on mobile

### Data
- [ ] No mock/hardcoded data
- [ ] Loading states use skeletons
- [ ] Empty states have descriptive text + action
- [ ] No `any` types in data interfaces

### Architecture
- [ ] Types extracted to `types/` directory
- [ ] Named exports only (no default exports)
- [ ] .ts for non-JSX, .tsx for JSX
- [ ] Animation variants imported from helpers

---

## §14 — Priority Action Items (Current Violations)

The following violations were detected during the audit and MUST be resolved in priority order:

| Priority | Violation | Files | Resolution |
|----------|-----------|-------|------------|
| 🔴 P0 | Duplicate utility functions | accounts-view.tsx, dashboard-view.tsx | Import from @/lib/helpers |
| 🔴 P0 | Duplicate animation variants | accounts-view.tsx | Import from @/lib/helpers |
| 🔴 P0 | Hardcoded summary cards | accounts-view.tsx, dashboard-view.tsx | Create SummaryCard component |
| 🔴 P0 | Inline transaction list pattern | dashboard-view.tsx, accounts-view.tsx | Create TransactionRow component |
| 🟡 P1 | z-[9999] in ChartTooltip | chart-tooltip.tsx | Replace with Z_INDEX constant |
| 🟡 P1 | Duplicate chart color arrays | dashboard-view.tsx, expense-breakdown.tsx | Create lib/chart-colors.ts |
| 🟡 P1 | `any` types in interfaces | dashboard-view.tsx | Create proper types in types/ |
| 🟡 P1 | Types defined in .tsx files | 4+ files | Extract to types/ directory |
| 🟡 P1 | Default export in page.tsx | page.tsx | Change to named export |
| 🟡 P1 | Inline Intl.NumberFormat | page.tsx | Use currencyFmt from helpers |
| 🟢 P2 | Inline sub-components | cash-flow-forecast.tsx | Extract ConfidenceBadge, TrendIndicator |
| 🟢 P2 | No unified empty state | multiple files | Create EmptyState shared component |
| 🟢 P2 | No unified confirm dialog | accounts-view.tsx | Create ConfirmDialog shared component |
| 🟢 P2 | Inline form dialogs | accounts-view.tsx | Extract to form components |
| 🟢 P2 | ExpandableRow not unified | expense-breakdown.tsx, dashboard-view.tsx | Create ExpandableRow component |
| 🟢 P2 | `dark:` prefixes in cash-flow-forecast.tsx | cash-flow-forecast.tsx | Replace with theme tokens where possible |
| 🔵 P3 | i18n not implemented | entire codebase | Extract strings to dictionaries (future) |

---

## §15 — Pattern Decision Matrix

When you encounter a repeated UI pattern, use this decision matrix:

```
Is the pattern used in 2+ files?
  ├─ NO → Keep inline, but consider if it should be extracted for clarity
  └─ YES → Does it have ZERO dependency on parent state?
       ├─ YES → Extract to components/shared/ as a shared component
       └─ NO → Does it need access to store/hooks?
            ├─ YES → Extract to components/features/{domain}/
            └─ NO → Extract to components/shared/ with props for state
```

```
Is a className string repeated 3+ times?
  ├─ NO → Keep inline
  └─ YES → Is it conditional (different in different states)?
       ├─ YES → Add a variant to the component using cva
       └─ NO → Extract as a constant or shared class
```

```
Is a utility function defined locally?
  ├─ YES → Does it already exist in lib/helpers.ts?
       ├─ YES → DELETE local definition, import from helpers
       └─ NO → Is it used in 2+ files?
            ├─ YES → Move to lib/helpers.ts
            └─ NO → Keep local for now, annotate with // TODO: shared?
```
