# CR9-bills — Bill Reminders & Upcoming Payments Widget

## Task ID
CR9-bills

## Agent
Main Developer

## Date
2025-01-XX

## Summary
Built a complete Bill Reminders & Upcoming Payments widget for the FinanceApp v3.1.0 dashboard, including a GET API endpoint and a rich UI component with Framer Motion animations.

## Files Created
- `/src/app/api/upcoming-bills/route.ts` — GET API endpoint
- `/src/components/finance/upcoming-bills.tsx` — UI component

## Files Modified
- `/src/app/page.tsx` — Added import and `<UpcomingBills />` after `<DebtOverview />`

## Work Log

### API Endpoint (`/src/app/api/upcoming-bills/route.ts`)
- Created GET endpoint that aggregates upcoming bills from 4 data sources:
  1. **Installment payments** — `Installment` model where status in (PENDING, OVERDUE) and dueDate within 30 days, with related `InstallmentPlan` data
  2. **Consortium payments** — `ConsortiumInstallment` model where status in (PENDING, OVERDUE) and dueDate within 30 days, with related `Consortium` data
  3. **Credit card payments** — Active `Card` entries with calculated payment due dates based on `dueDay` field
  4. **Recurring transactions** — `RecurringTransaction` where `isActive=true` and `nextDate` within 30 days
- All queries run in parallel with `Promise.all` for performance
- Normalized all bills into a unified array with type, title, amount, dueDate, daysUntilDue, status, and source
- Status logic: overdue (<0 days), urgent (≤3 days), upcoming (≤7 days), later (≤30 days)
- Summary includes: thisWeek count/amount, thisMonth count/amount, totalAmount, and per-status counts
- Bills sorted by daysUntilDue (most urgent first)

### UI Component (`/src/components/finance/upcoming-bills.tsx`)
- Named export `UpcomingBills` as a self-fetching component
- Card with gradient top border (sky→blue→cyan)
- Header: CalendarClock icon, "Próximos Pagamentos" title, count badge, monthly total badge, refresh button
- **Summary Row**: 3 mini cards with hover animations:
  - "Esta Semana" (amber accent) — count + amount for bills due this week
  - "Este Mês" (sky accent) — count + amount for bills due this month
  - "Próximos 30 dias" (cyan accent) — count + amount for all upcoming bills
- **Bills list grouped by time period** (collapsible sections):
  - "Atrasados" section (red accent) — overdue bills with AlertTriangle icon
  - "Próximos 7 dias" section (amber accent) — urgent bills with Clock icon
  - "Este Mês" section (blue accent) — upcoming bills with CalendarDays icon
- Each bill item shows:
  - Type icon (CreditCard, Building2, CalendarClock, RefreshCw)
  - Title/source name
  - Due date formatted in pt-BR
  - Amount in BRL currency format
  - Days until due badge (color-coded: red/amber/sky/gray)
  - Small progress bar showing day of month progression
- Loading skeleton matching the component layout
- Empty state for when no bills are pending
- Framer Motion stagger animations (container → item → listItem)
- Responsive layout (mobile-first, grid cols adjust at sm breakpoint)
- All text in Portuguese Brazilian

### Integration (`/src/app/page.tsx`)
- Imported `UpcomingBills` from the new component file
- Added `<UpcomingBills />` inside `DashboardWithWidgets` after `<DebtOverview />`

## Validation
- `bun run lint` — Zero errors
- Dev server running successfully on port 3000
- All existing API routes returning 200
