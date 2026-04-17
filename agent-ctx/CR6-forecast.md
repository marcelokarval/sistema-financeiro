# Task ID: CR6-forecast
# Agent: Full-Stack Developer
# Task: Build Cash Flow Forecast API and Widget

## Work Log:
- Read worklog.md, /api/dashboard/route.ts, financial-reports.tsx, /api/recurring/route.ts, schema.prisma to understand project patterns
- Created /src/app/api/forecast/route.ts (GET endpoint):
  - Accepts `months` query param (default 3, range 1-6) with validation
  - Parallel fetch of last 6 months of transactions, purchases, categories, and active recurring transactions
  - Builds monthly buckets for historical analysis (income, expense, per-category expense)
  - Calculates average monthly income and expense from active months
  - Blends historical averages (60%) with recurring transaction projections (40%)
  - Computes confidence score based on historical data availability, distance into future, and recurring bonus
  - Generates risk alerts: deficit risk, negative balance, category spending trends, low savings rate
  - Determines trend direction (improving/stable/declining) from last 3 months net trend
  - Returns: forecastMonths, topExpenseCategories (top 5), riskAlerts, trendDirection
- Created /src/components/finance/cash-flow-forecast.tsx as named export CashFlowForecast:
  - Self-fetching from /api/forecast?months=3
  - Header with LineChartIcon in teal gradient box, "Previsão de Fluxo de Caixa" title, subtitle, refresh button
  - TrendIndicator component: TrendingUp/TrendingDown/Minus icon with color-coded pill (emerald/rose/amber)
  - Recharts AreaChart with 3 series:
    - Receita: green dashed stroke with gradient fill
    - Despesa: orange dashed stroke with gradient fill
    - Saldo: cyan solid stroke (2.5px) with gradient fill
    - Custom ChartTooltip with Portuguese labels and BRL formatting
    - Angled x-axis labels for long month names, Legend
  - Forecast month cards (3-col grid on sm+, 1-col mobile):
    - Month label (capitalized), ConfidenceBadge (green ≥80%, amber ≥50%, rose <50%)
    - Income (emerald), Expense (orange), Separator, Net (cyan/rose colored)
    - whileHover scale:1.015 spring animation
  - Top expense categories section:
    - Color dot + name + animated progress bar + average monthly amount
    - Width proportional to highest category
  - Risk alerts section:
    - Amber/rose styled card with AlertTriangle icon
    - Count badge, staggered alert list with dot indicators
  - Positive state when no alerts: emerald card with TrendingUp icon
  - Loading skeleton matching layout (header, chart area, cards, alerts)
  - Error state with retry button
  - Framer Motion: container/item stagger variants, cardHover, alertItem, animated progress bars
  - All text in Portuguese Brazilian, currency in BRL
  - Uses shadcn/ui: Card, CardContent, CardHeader, CardTitle, Badge, Button, Skeleton, Separator
- Verified API returns correct data via curl (3 forecast months, 5 top categories, 2 risk alerts, declining trend)
- Ran `bun run lint`: zero errors

## Stage Summary:
- /api/forecast endpoint returning projected cash flow data with confidence scores and risk alerts
- CashFlowForecast component ready for integration into dashboard or any view
- Self-contained with no props required (fetches data from /api/forecast)
- Teal/cyan gradient styling consistent with existing codebase
- Recharts AreaChart with gradient fills and custom tooltip
- Responsive: 1-col mobile, 3-col desktop for forecast cards
- Zero lint errors

## Files Created:
1. `/home/z/my-project/src/app/api/forecast/route.ts` — GET API endpoint
2. `/home/z/my-project/src/components/finance/cash-flow-forecast.tsx` — Widget component (named export `CashFlowForecast`)
