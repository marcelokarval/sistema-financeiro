---
Task ID: CR9-achievements
Agent: Main Developer
Task: Build Achievement Badges / Gamification Widget for FinanceApp v3.1.0

Work Log:
- Read project worklog and understood the full FinanceApp architecture (Prisma schema, API patterns, component patterns)
- Analyzed existing page.tsx DashboardWithWidgets structure to find correct insertion point
- Studied debt-overview.tsx as reference for component patterns (loading skeleton, motion variants, Card structure)
- Created `/src/app/api/achievements/route.ts` — GET endpoint computing 12 achievements from real data
- Created `/src/components/finance/achievement-badges.tsx` — full gamification widget UI component
- Integrated `AchievementBadges` into `src/app/page.tsx` DashboardWithWidgets after ReceiptGenerator
- Ran `bun run lint` — zero errors

Stage Summary:
- **API Endpoint** (`/api/achievements`):
  - Fetches accounts, cards, transactions (current month), purchases (current month), savings goals, investments, categories, installment plans
  - Computes 12 achievements with real progress calculations
  - Returns array with id, title, description, icon, category, unlocked, progress, currentValue, targetValue, unlockedAt

- **12 Achievements Defined**:
  1. "Primeira Economia" (poupanca) — income > expense in current month
  2. "Poupador Dedicado" (poupanca) — savings rate ≥ 20%
  3. "Mestre da Poupança" (poupanca) — savings rate ≥ 40%
  4. "Investidor Iniciante" (investimento) — 1+ active investment
  5. "Carteira Diversificada" (investimento) — 3+ investments
  6. "Meta Conquistada" (poupanca) — complete any savings goal
  7. "Sem Dívidas" (controle) — all card balances = 0
  8. "Organizado" (controle) — 3+ categories in use
  9. "Colecionador de Contas" (exploracao) — 4+ bank accounts
  10. "Registros Consistentes" (controle) — 20+ transactions this month
  11. "Patrimônio Crescendo" (investimento) — net worth > R$ 1.000
  12. "Financeiro Completo" (exploracao) — uses investments + savings + installments

- **UI Component** (`AchievementBadges`):
  - Self-fetching from `/api/achievements`
  - Card with amber→yellow→orange gradient top border
  - Header: Trophy icon, "Conquistas" title, "X/Y desbloqueadas" badge
  - Stats row: unlocked count, completion percentage with progress bar, streak indicator
  - 5 category filter tabs: "Todas", "Poupança", "Controle", "Investimento", "Exploração"
  - Badge grid: 3 cols desktop, 2 tablet, 1 mobile
  - Unlocked badges: colored icon with glow, title, description, checkmark, unlocked date
  - Locked badges: muted icon with lock overlay, blurred description, progress bar
  - Hover effects: scale 1.03 + shadow increase
  - Framer Motion stagger animations on mount
  - AnimatePresence for filter transitions
  - Loading skeleton matching layout
  - Empty state with retry button
  - Motivational footer message (varies by completion %)
  - All text in Portuguese Brazilian

- **Integration**: Added `AchievementBadges` as last widget in DashboardWithWidgets

- **Lint**: Zero errors with `bun run lint`
