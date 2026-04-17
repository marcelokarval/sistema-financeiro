---
Task ID: CR7-balance-projection
Agent: Full-Stack Developer
Task: Build Account Balance Projection Widget

Work Log:
- Read worklog.md, page.tsx, prisma schema, db.ts, cash-flow-forecast.tsx for codebase patterns
- Created /src/app/api/balance-projection/route.ts (GET endpoint):
  - Accepts months query param (default 6, range 1-12)
  - Fetches all active accounts, transactions (INCOME/EXPENSE) and purchases from last 3 months
  - Calculates average monthly income and expense per account (transactions + purchases)
  - Projects future balances: currentBalance + (avgIncome - avgExpense) * monthOffset
  - Computes trend (up/down/stable), totalProjected, averageMonthlySavings, savingsRate, riskLevel
- Created /src/components/finance/balance-projection.tsx as named export BalanceProjection:
  - Self-fetching from /api/balance-projection?months=6
  - Card with gradient top border (cyan to blue to indigo)
  - Multi-line Recharts AreaChart showing projected balances per account with accountColor
  - Summary cards row (4 cards), risk assessment section, account detail list
  - Month selector (3, 6, 9, 12 months), Framer Motion animations, loading skeleton
  - All text in Portuguese Brazilian, currency in BRL, responsive design
- Integrated BalanceProjection into DashboardWithWidgets in page.tsx (after SavingsChallenge)
- Verified /api/balance-projection?months=6 returns 200 in dev log
- Ran bun run lint: zero errors

Stage Summary:
- /api/balance-projection endpoint returning per-account balance projections with risk assessment
- BalanceProjection widget with multi-account area chart, summary cards, risk assessment, account details
- Integrated into dashboard page
- Zero lint errors
