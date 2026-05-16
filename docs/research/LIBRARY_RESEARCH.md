# Library Research — Financial Dashboard (Next.js 16 + TypeScript)
Date: 2026-04-19
Scope: Sistema Financeiro Pessoal — Production SPA with real-time features
Target: Production-grade, type-safe, responsive, accessible

---

## 1. Core Framework

### 1.1 Next.js 16 (App Router) — NON-NEGOTIABLE

| Metric | Value |
|---|---|
| npm | `next@^16.1.1` |
| React | `^19.0.0` |
| React DOM | `^19.0.0` |
| TypeScript | `^5` |
| App Router | Yes (all routes under `src/app/`) |
| Server Actions | Available but NOT used (we use API routes instead) |

**Why Next.js 16 App Router:**
- Server Components + Client Components boundary ('use client' directive)
- File-based routing under `src/app/` — single route `/` with client-side view switching
- API Routes via `app/api/*/route.ts` — 28 endpoints in production
- Built-in optimizations: code splitting, image optimization, font loading
- `next.config.ts` allows custom Caddy gateway for multi-port proxying

**Architecture Pattern:**
```
app/
  page.tsx                         <- Single SPA entry — client-side view switching via Zustand
  layout.tsx                       <- Root layout — ThemeProvider, Sidebar, main wrapper
  api/
    accounts/route.ts              <- CRUD
    cards/route.ts                 <- CRUD
    transactions/route.ts          <- CRUD + filters
    purchases/route.ts             <- CRUD + items
    categories/route.ts            <- CRUD + usage counts
    budgets/route.ts               <- CRUD
    dashboard/route.ts             <- 10+ aggregated metrics
    transfer/route.ts              <- Atomic account-to-account transfer
    export/route.ts                <- CSV download (transactions, purchases, accounts)
    advisor/route.ts               <- LLM-powered financial advice
    reports/route.ts               <- Monthly comparison data
    insights/route.ts              <- Smart insights / AI analysis
    forecast/route.ts              <- Cash flow forecast
    ... (28 total endpoints)
```

**Key Decision — SPA with Single Route:**
- User can ONLY see the `/` route defined in `src/app/page.tsx`
- All views (Dashboard, Accounts, Cards, Purchases, Categories, etc.) are toggled client-side via `useAppStore.currentView`
- This avoids full page reloads and provides instant navigation between financial views
- No `next/link` usage — all navigation is programmatic via Zustand state changes

---

### 1.2 React 19 — NON-NEGOTIABLE

| Metric | Value |
|---|---|
| Version | `^19.0.0` |
| Server Components | Used for layout.tsx (no 'use client') |
| Client Components | All views and components marked with 'use client' |
| useSyncExternalStore | Used for React 19-compatible external state (replaced setState-in-effect pattern) |

**Notable React 19 behaviors encountered:**
- `useSyncExternalStore` required for Prisma dev-mode client recreation pattern (see `src/lib/db.ts`)
- Strict hooks ordering enforced — hooks MUST be called before any early returns
- No more `forwardRef` needed — components accept `ref` as a regular prop

---

## 2. Styling & UI Component System

### 2.1 Tailwind CSS 4 — NON-NEGOTIABLE

| Metric | Value |
|---|---|
| npm | `tailwindcss@^4` |
| PostCSS | `@tailwindcss/postcss@^4` |
| Animation | `tailwindcss-animate@^1.0.7` |
| Theme | Dark/Light via CSS variables |
| Custom CSS | Global utilities in `app/globals.css` |

**Tailwind CSS 4 differences from v3:**
- CSS-first configuration (no `tailwind.config.js` — config in `@theme` blocks)
- New color system with `oklch()` support
- `@import "tailwindcss"` replaces `@tailwind` directives
- Custom theme values defined via `@theme { --color-*: ... }` in globals.css
- Utility classes remain identical in usage

**Custom CSS Utilities (globals.css):**
```css
.glass        { backdrop-blur: 12px; background: rgba(255,255,255,0.8); border: 1px solid rgba(255,255,255,0.2); }
.card-glow    { transition: box-shadow 0.3s; } /* hover:shadow-xl trigger */
.main-gradient { background: linear-gradient(135deg, ...); }
.gradient-border { border-image: linear-gradient(...) 1; }
.animate-pulse-dot { /* ping animation for online indicators */ }
.animate-float  { /* subtle float animation for decorative elements */ }
```

---

### 2.2 shadcn/ui (New York Style) — NON-NEGOTIABLE

| Metric | Value |
|---|---|
| Style | New York (not Default) |
| Components | 50 Radix UI primitives wrapped |
| Customization | TypeScript + Tailwind + CVA |
| Location | `src/components/ui/` |

**Installed shadcn/ui Components (50 total):**

| Category | Components |
|---|---|
| **Layout** | Card, Sheet, Sidebar, Separator, Resizable, AspectRatio |
| **Navigation** | Breadcrumb, NavigationMenu, Menubar, Pagination, Tabs, Command (cmdk) |
| **Overlays** | Dialog, AlertDialog, Popover, HoverCard, Tooltip, Drawer (vaul) |
| **Forms** | Input, Textarea, Select, Checkbox, RadioGroup, Switch, Slider, Label, Form (react-hook-form) |
| **Data Display** | Badge, Avatar, Table, Calendar (react-day-picker), ScrollArea, Skeleton, Progress, Accordion, Collapsible |
| **Feedback** | Toast/Sonner, Alert |
| **Buttons** | Button, Toggle, ToggleGroup, DropdownMenu, ContextMenu |
| **Input** | InputOTP |
| **Media** | Carousel (embla-carousel) |

**shadcn/ui Component Sizing Pattern (New York):**
- Button: `h-9 px-4 py-2` (default), `h-8 px-3` (sm), `h-10 px-6` (lg)
- Input: `h-9 px-3 py-2`
- Card: `rounded-xl border bg-card text-card-foreground shadow-sm` with `p-6`
- Badge: `rounded-full px-2.5 py-0.5 text-xs font-semibold`
- All components use `cn()` (tailwind-merge + clsx) for className composition

**When to bypass shadcn/ui (see ARCHITECTURE_CONVENTIONS §18):**
- shadcn Card has `py-6` baked in → use plain `<div>` with explicit `px-4 py-3` for compact cards (QuickStatCard)
- Always match visual style: `rounded-xl`, `border-border`, `bg-card`, `shadow-sm`
- Always use theme tokens via `cn()` for dark/light compatibility

---

### 2.3 Radix UI Primitives — INDIRECT (via shadcn/ui)

| Metric | Value |
|---|---|
| Packages | 32 `@radix-ui/*` packages installed |
| Usage | NEVER imported directly — always via shadcn/ui wrappers |
| Reason | shadcn/ui wraps Radix with consistent styling + CVA variants |

**Installed Radix packages:**
```
@radix-ui/react-accordion, alert-dialog, aspect-ratio, avatar, checkbox,
collapsible, context-menu, dialog, dropdown-menu, hover-card, label,
menubar, navigation-menu, popover, progress, radio-group, scroll-area,
select, separator, sheet, sidebar, slider, slot, switch, tabs, toast,
toggle, toggle-group, tooltip
```

**Important:** We never import `@radix-ui/react-dialog` directly. We import `import { Dialog } from '@/components/ui/dialog'` which is the shadcn/ui wrapper. This ensures consistent styling, animation, and theming.

---

### 2.4 Lucide React — NON-NEGOTIABLE (Icon System)

| Metric | Value |
|---|---|
| npm | `lucide-react@^0.525.0` |
| Files using it | 65+ files across the codebase |
| Icon style | Stroke-based, consistent 24×24 viewBox |
| No fill icons | Stroke only (outline style) |

**Icon Size Standards (from ARCHITECTURE_CONVENTIONS §24):**
| Context | Size (w/h) | Location |
|---|---|---|
| Widget card header | `w-5 h-5` | Inside gradient circle in WidgetCard |
| Mini metric card | `w-4 h-4` | MiniMetricCard icon |
| Quick stat card | `w-3.5 h-3.5` | QuickStatCard icon |
| Navigation sidebar | `w-5 h-5` | Sidebar menu items |
| Action buttons | `w-4 h-4` | Button labels, FAB actions |
| Empty states | `w-8 h-8` | Centered icon in muted circle |
| Badge indicators | `w-3.5 h-3.5` | TrendBadge arrows |

**Most-used icons in the financial dashboard:**
```
LayoutDashboard, Wallet, CreditCard, ShoppingBag, TrendingUp, TrendingDown,
ArrowUpRight, ArrowDownRight, Plus, Pencil, Trash2, Search, Bell,
Brain, Target, PiggyBank, Calendar, BarChart3, PieChart, Activity,
ChevronDown, ChevronUp, ChevronLeft, ChevronRight, X, Menu, Sun, Moon,
Download, Upload, Filter, RefreshCw, Eye, EyeOff, Check, AlertCircle,
Building2, Landmark, Receipt, PiggyBank, HeartPulse, Sparkles, Gem
```

---

### 2.5 class-variance-authority (CVA) + tailwind-merge + clsx — NON-NEGOTIABLE

| Package | npm | Purpose |
|---|---|---|
| `class-variance-authority` | `^0.7.1` | Component variant definitions (cva) |
| `tailwind-merge` | `^3.3.1` | Smart className merging (handles Tailwind conflicts) |
| `clsx` | `^2.1.1` | Conditional className composition |

**Combined via `cn()` utility (src/lib/utils.ts):**
```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Usage pattern across 100% of components:**
```tsx
<div className={cn(
  'rounded-xl border bg-card shadow-sm transition-all',
  isActive && 'ring-2 ring-primary',
  className, // allow parent overrides
)} />
```

**Why this combo:**
- `cva` — define variants with type safety (used in shadcn buttonVariants, etc.)
- `tailwind-merge` — resolves conflicts like `p-4 px-6` → keeps `px-6 py-4`
- `clsx` — handles conditional classes and array/object formats
- Together they form the foundation of our className tokenization strategy (ARCHITECTURE_CONVENTIONS §2)

---

## 3. State Management

### 3.1 Zustand — NON-NEGOTIABLE (Client State)

| Metric | Value |
|---|---|
| npm | `zustand@^5.0.6` |
| Store file | `src/lib/store.ts` |
| Stores | 1 (single flat store) |
| Views managed | 9 view types + 5 selection IDs + sidebar + AI assistant |

**App Store Shape:**
```typescript
interface AppState {
  // Navigation
  currentView: ViewType;              // 'dashboard' | 'accounts' | 'cards' | ...
  sidebarOpen: boolean;
  aiAssistantVisible: boolean;

  // Selection state (detail views)
  selectedAccountId: string | null;
  selectedCardId: string | null;
  selectedPurchaseId: string | null;
  selectedInvestmentId: string | null;
  selectedInstallmentPlanId: string | null;
  selectedConsortiumId: string | null;

  // Actions
  setCurrentView: (view: ViewType) => void;
  setSelectedAccountId: (id: string | null) => void;
  // ... etc.
}
```

**ViewType Union:**
```typescript
type ViewType =
  | 'dashboard' | 'accounts' | 'cards' | 'purchases'
  | 'categories' | 'investments' | 'installments'
  | 'consortiums' | 'savings';
```

**Why a single flat store instead of multiple stores:**
- Only 1 store file needed — simple dashboard, no complex state slices
- All 9 views share the same navigation + selection pattern
- No middleware, no devtools, no persistence needed
- Zero boilerplate — Zustand's `create()` is ~50 lines total

**Why NOT alternatives:**

| Avoided | Reason |
|---|---|
| Redux Toolkit | Overkill — 300+ lines boilerplate for simple navigation state |
| Jotai | Atomic model doesn't fit our "current view + selections" pattern |
| Context API | Triggers re-renders on all consumers; no selector optimization |

---

### 3.2 TanStack React Query — INSTALLED (Server State)

| Metric | Value |
|---|---|
| npm | `@tanstack/react-query@^5.82.0` |
| Files using it | 0 (available but not yet adopted) |
| Status | Reserved for future use |

**Why NOT used yet:**
- All widgets use the Self-Fetching Widget Pattern (ARCHITECTURE_CONVENTIONS §16)
- Self-fetching via `useState + useEffect + fetch` is simpler for our use case
- React Query would add complexity without benefit for our 28 API endpoints

**When to adopt React Query:**
- If we need caching + revalidation (e.g., auto-refresh dashboard every 30s)
- If we need optimistic updates (e.g., instant balance change on transfer)
- If multiple components need the same data (avoid duplicate fetches)
- If we need pagination/infinite scroll on transaction lists

---

## 4. Data Layer

### 4.1 Prisma ORM — NON-NEGOTIABLE

| Metric | Value |
|---|---|
| npm | `prisma@^6.11.1` + `@prisma/client@^6.11.1` |
| Database | SQLite (dev + production) |
| Schema file | `prisma/schema.prisma` |
| Seed file | `prisma/seed.ts` |
| DB client | `src/lib/db.ts` |

**Database Models (17 total):**

| Model | Purpose | Relations |
|---|---|---|
| Account | Bank accounts (Nubank, Itaú, etc.) | → Transaction, Card |
| Card | Credit cards with limits | → Purchase, Account |
| Category | Expense/income categories | → Transaction, Purchase, BudgetGoal |
| Transaction | Income/expense entries | → Account, Card, Category |
| Purchase | Credit card purchases | → Card, Category, PurchaseItem[] |
| PurchaseItem | Line items within purchases | → Purchase |
| RecurringTransaction | Auto-recurring entries | → Account, Category |
| BudgetGoal | Savings targets | → Category |
| Investment | Stock/crypto investments | → InvestmentTransaction[] |
| InvestmentTransaction | Buy/sell events | → Investment |
| InstallmentPlan | Purchase installments | → Card, Installment[] |
| Installment | Individual installments | → InstallmentPlan |
| Consortium | Brazilian consortium plans | → ConsortiumInstallment[] |
| ConsortiumInstallment | Individual consortium payments | → Consortium |
| MonthlyBudget | Category spending limits | → Category |
| SavingsGoal | General savings targets | — |

**Prisma Schema Features Used:**
- `@id` with deterministic string IDs (e.g., `cat-food`, `cur-acc-nubank`)
- `@relation` for one-to-many and many-to-many
- `@default(now())` for timestamps
- `@updatedAt` for automatic modification tracking
- SQLite provider with `DATABASE_URL` env var

**Seed Data Convention (ARCHITECTURE_CONVENTIONS §22):**
- All IDs use human-readable prefixes: `cat-*`, `cur-acc-*`, `cur-card-*`, `cur-txn-*`, `cur-pur-*`, `cur-bg-*`
- `upsert` for idempotent re-seeding
- Old prefix patterns cleaned up before re-seeding
- 12 categories, 4 accounts, 3 cards, 12+ transactions, 6+ purchases, 6 budget goals, historical data spanning 6 months

**Dev-mode fresh client (src/lib/db.ts):**
```typescript
// Avoids schema caching issues in development
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const db = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

**Why NOT alternatives:**

| Avoided | Reason |
|---|---|
| Drizzle | Less mature ecosystem, no SQLite studio tooling |
| Raw SQL (better-sqlite3) | No type safety, no migrations, no relations |
| MongoDB (Mongoose) | Financial data is inherently relational |
| Supabase | External dependency, overkill for local SQLite |

---

## 5. Animations

### 5.1 Framer Motion — NON-NEGOTIABLE

| Metric | Value |
|---|---|
| npm | `framer-motion@^12.23.2` |
| Files using it | 37 files (every view + 34 components) |
| Animation types | Stagger, hover lift, expand/collapse, entry/exit, spring physics |

**Standard Animation Patterns (ARCHITECTURE_CONVENTIONS §19):**

| Pattern | staggerChildren | Use Case |
|---|---|---|
| containerVariants + itemVariants | 0.06 | Card grid entries, widget list |
| summaryContainerVariants + summaryItemVariants | 0.08 | Summary card rows |
| listContainerVariants + listItemVariants | 0.04 | Transaction lists, notifications |
| detailEntryVariants | — | Detail view entry animation |

**Key Animation APIs Used:**
- `motion.div` with `variants` — declarative stagger animations
- `AnimatePresence mode="wait"` — mount/unmount transitions
- `whileHover={{ y: -2 }}` — card lift on hover (spring transition)
- `whileTap={{ scale: 0.97 }}` — button press feedback
- `initial="hidden" animate="show"` — entry animations
- `AnimatePresence` for expand/collapse patterns (purchase items, transaction details)

**Framer Motion + Recharts coexistence:**
- Recharts renders `<ResponsiveContainer>` which doesn't need Framer Motion
- Chart tooltip animations handled by Recharts built-in transition prop
- No conflicts between the two libraries

**Why NOT alternatives:**

| Avoided | Reason |
|---|---|
| React Spring | More complex API, heavier bundle |
| GSAP | Overkill for dashboard animations, paid license for some features |
| CSS-only animations | Insufficient for stagger, spring physics, layout animations |
| Tailwind animate | Only supports keyframe definitions, no spring physics |

---

## 6. Charts & Data Visualization

### 6.1 Recharts — NON-NEGOTIABLE

| Metric | Value |
|---|---|
| npm | `recharts@^2.15.4` |
| Files using it | 10 files (9 components + 1 chart wrapper) |
| Chart types | Area, Bar, Pie, Line, Composed |

**Chart Wrapper (src/components/ui/chart.tsx):**
- shadcn/ui provides a Recharts wrapper that standardizes colors, tooltips, and legends
- Uses CSS variable-based theming for dark/light mode compatibility
- Exports `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`

**Charts Used in the Dashboard:**

| Component | Chart Type | Data Source |
|---|---|---|
| dashboard-view.tsx | AreaChart (monthly trends) | /api/dashboard |
| expense-breakdown.tsx | PieChart (category breakdown) | /api/expense-breakdown |
| cash-flow-forecast.tsx | BarChart (forecast months) | /api/forecast |
| balance-projection.tsx | ComposedChart (line + area) | /api/balance-projection |
| networth-evolution.tsx | AreaChart (net worth over time) | /api/networth |
| debt-overview.tsx | BarChart (debt by card) | /api/debts |
| transaction-analytics.tsx | BarChart (daily/weekly stats) | /api/transaction-analytics |
| financial-reports.tsx | BarChart (income vs expense) | /api/reports |
| quick-stats-overview.tsx | Progress bar (mini charts) | /api/quick-stats |

**Recharts Customizations:**
- Custom dots: `activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}`
- Gradient fills via `<linearGradient>` in chart defs
- Portuguese labels on axes and tooltips
- BRL currency formatting in tooltips
- Responsive container with `width="100%" height={250}`

**Why NOT alternatives:**

| Avoided | Reason |
|---|---|
| Chart.js (react-chartjs-2) | Less React-native, more imperative API |
| Nivo | Heavier bundle, less customization |
| Victory | Less maintained, larger API surface |
| D3.js | Too low-level, massive bundle for our needs |
| Tremor | opinionated styling conflicts with our design system |

---

## 7. Real-Time Communication

### 7.1 Socket.io (Client + Server) — ACTIVE

| Metric | Value |
|---|---|
| Client | `socket.io-client@^4.8.3` |
| Server | `socket.io@^4.8.1` (mini-service) |
| Server port | 3004 |
| Server file | `mini-services/finance-ws/index.ts` |
| Client hook | `src/hooks/use-realtime.ts` |

**Architecture:**
```
mini-services/
  finance-ws/
    package.json          <- Independent bun project, port 3004
    index.ts              <- Socket.io server with room-based broadcasting

src/
  hooks/
    use-realtime.ts       <- Client hook: io("/?XTransformPort=3004")
```

**Gateway Proxy Pattern (CRITICAL):**
- All API requests must use relative paths ONLY
- For cross-port requests, use `XTransformPort` query param: `fetch('/api/data?XTransformPort=3004')`
- WebSocket connection: `io("/?XTransformPort=3004")` — NEVER `io("http://localhost:3004")`
- Caddy gateway routes based on `XTransformPort` to the correct backend

**Events Emitted:**
```
transaction:created, transaction:updated, transaction:deleted
purchase:created, purchase:updated, purchase:deleted
account:updated, card:updated
dashboard:refresh
notification:new
```

**Room-based Broadcasting:**
- Users join rooms by session/context
- Updates broadcast to relevant room members
- Graceful shutdown handling on server

**Why NOT alternatives:**

| Avoided | Reason |
|---|---|
| Native WebSocket | No reconnection, no rooms, no fallback transport |
| Server-Sent Events | Unidirectional only — can't send from client to server |
| Pusher/Ably | External SaaS dependency, costs money, unnecessary for local deployment |

---

## 8. Date & Time

### 8.1 date-fns — NON-NEGOTIABLE

| Metric | Value |
|---|---|
| npm | `date-fns@^4.1.0` |
| Locale | `ptBR` (Brazilian Portuguese) |
| Files using it | 11 files |
| Helper functions | 6 in `src/lib/helpers.ts` |

**Helper Functions (src/lib/helpers.ts):**
```typescript
currencyFmt(v: number): string        // R$ 1.234,56
shortCurrency(v: number): string      // 1.2k, 3.4M
dateFmt(d: string): string            // 01/04/2026
dateShortFmt(d: string): string       // 01/04/26
percentFmt(v: number): string         // +12.5%, -3.2%
pct(part: number, total: number)      // 42 (percentage)
```

**date-fns functions used directly:**
- `format()` — date formatting with ptBR locale
- `parseISO()` — ISO string to Date conversion
- `formatDistanceToNow()` — relative time ("há 3 minutos")
- `startOfMonth()`, `endOfMonth()` — date range calculations
- `subMonths()`, `addMonths()` — month arithmetic
- `isAfter()`, `isBefore()` — date comparisons
- `eachMonthOfInterval()` — month iteration

**Why NOT alternatives:**

| Avoided | Reason |
|---|---|
| dayjs | Smaller but less tree-shakeable, fewer functions |
| luxon | Heavier bundle, class-based API (vs functional) |
| moment | Deprecated, huge bundle, mutable API |

---

## 9. Forms & Validation

### 9.1 React Hook Form + Zod — NON-NEGOTIABLE

| Metric | Value |
|---|---|
| React Hook Form | `react-hook-form@^7.60.0` |
| Resolver | `@hookform/resolvers@^5.1.1` |
| Zod | `zod@^4.0.2` |
| Integration | Via shadcn/ui Form component |

**Pattern (via shadcn/ui Form):**
```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

const schema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  amount: z.coerce.number().positive('Valor deve ser positivo'),
})

function MyForm() {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', amount: 0 },
  })
  // ...
}
```

**Forms in the application:**
- Account creation/edit dialogs
- Card creation/edit dialogs
- Transaction creation/edit dialogs
- Category creation/edit (with visual color/icon pickers)
- Budget goal creation/edit
- Transfer dialog (account-to-account)
- Recurring transaction setup
- Investment registration

**Why NOT alternatives:**

| Avoided | Reason |
|---|---|
| Formik | Larger bundle, less performant, no built-in resolver system |
| VeeValidate | Vue-oriented, less TypeScript integration |
| No validation | Security risk, poor UX, data integrity issues |

---

### 9.2 Zod — NON-NEGOTIABLE (Schema Validation)

| Metric | Value |
|---|---|
| npm | `zod@^4.0.2` |
| Uses | Form validation, API input validation, runtime type checking |

**Zod 4 (latest) vs Zod 3:**
- `zod@^4.0.2` is the latest major version
- Better tree-shaking and smaller bundle
- New `z.coerce` for automatic type coercion in forms
- Compatible with `@hookform/resolvers`

---

## 10. Theming

### 10.1 next-themes — NON-NEGOTIABLE

| Metric | Value |
|---|---|
| npm | `next-themes@^0.4.6` |
| Provider | `ThemeProvider` in `src/app/layout.tsx` |
| Default | System preference |
| Storage | localStorage persistence |
| Attribute | `class` strategy (adds/removes `dark` class on `<html>`) |

**Implementation:**
```tsx
// layout.tsx
import { ThemeProvider } from 'next-themes'

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

**Theme Toggle:**
- Located in sidebar header (Sun/Moon icon)
- Uses `useTheme()` hook from next-themes
- Cycles: system → light → dark → system

**Theme Token Mapping (ARCHITECTURE_CONVENTIONS §4):**

| Purpose | Light Mode | Dark Mode | Tailwind Token |
|---|---|---|---|
| Page background | white | near-black | `bg-background` |
| Card surface | white | dark gray | `bg-card` |
| Muted bg | light gray | darker gray | `bg-muted` |
| Primary text | black | white | `text-foreground` |
| Secondary text | gray-500 | gray-400 | `text-muted-foreground` |
| Borders | gray-200 | gray-700 | `border-border` |

**Why NOT alternatives:**

| Avoided | Reason |
|---|---|
| Custom CSS vars only | No React integration, no system preference detection |
| styled-components theme | Incompatible with Tailwind, larger bundle |
| Tailwind dark: prefix | No persistence, no system detection, no toggle |

---

## 11. Notifications

### 11.1 Sonner — NON-NEGOTIABLE

| Metric | Value |
|---|---|
| npm | `sonner@^2.0.6` |
| Component | `<Toaster />` in layout.tsx |
| Hook | `toast()` from sonner |

**Usage pattern:**
```typescript
import { toast } from 'sonner'

// Success
toast.success('Conta criada com sucesso!')

// Error
toast.error('Erro ao criar conta')

// Promise-based
toast.promise(fetch('/api/accounts', { method: 'POST', body }), {
  loading: 'Criando conta...',
  success: 'Conta criada!',
  error: 'Erro ao criar conta',
})
```

**Why Sonner over alternatives:**

| Avoided | Reason |
|---|---|
| react-hot-toast | Less maintained, fewer features |
| shadcn/ui Toast (Radix) | More boilerplate, no promise-based toasts |
| notistack | Material Design biased, heavier |

---

## 12. AI Integration

### 12.1 z-ai-web-dev-sdk — NON-NEGOTIABLE (Backend Only)

| Metric | Value |
|---|---|
| npm | `z-ai-web-dev-sdk@^0.0.17` |
| Location | Backend ONLY (`app/api/advisor/route.ts`) |
| Features used | LLM (text generation) |

**Current Usage:**
- AI Financial Advisor (`/api/advisor`): Fetches real financial data from Prisma, builds context string, calls LLM with Brazilian financial advisor system prompt (14 instructions), returns personalized advice in pt-BR

**Available Skills (not yet fully utilized):**

| Skill | Purpose | Status |
|---|---|---|
| LLM | Chat completions, text generation | ✅ Active (AI Advisor) |
| VLM | Image understanding, document analysis | ⬜ Available |
| TTS | Text-to-speech synthesis | ⬜ Available |
| ASR | Speech-to-text transcription | ⬜ Available |
| Image Generation | AI image creation | ⬜ Available |
| Video Generation | AI video creation | ⬜ Available |
| Web Search | Real-time web search | ⬜ Available |
| Web Reader | Page content extraction | ⬜ Available |

**CRITICAL RULE:** z-ai-web-dev-sdk MUST be used in the backend (API routes) ONLY. NEVER import it in client-side code.

**Why NOT alternatives:**

| Avoided | Reason |
|---|---|
| OpenAI SDK | External API key required, costs money |
| Google Gemini SDK | Same issues as OpenAI |
| @ai-sdk/openai (Vercel AI SDK) | Overkill for our single LLM endpoint |

---

## 13. Supporting Libraries

### 13.1 cmdk (Command Menu) — USED

| Metric | Value |
|---|---|
| npm | `cmdk@^1.1.1` |
| Usage | `GlobalSearch` component — command palette style search |
| shadcn/ui wrapper | `src/components/ui/command.tsx` |

**Why cmdk:**
- Accessible command palette with keyboard navigation
- Built-in fuzzy search
- Used by shadcn/ui's Command component
- Perfect for global search across all entities (transactions, purchases, accounts, cards, categories)

---

### 13.2 vaul (Drawer) — USED

| Metric | Value |
|---|---|
| npm | `vaul@^1.1.2` |
| Usage | Mobile bottom sheet via `src/components/ui/drawer.tsx` |
| Use case | Mobile navigation, detail panels |

**Why vaul:**
- Mobile-native feeling drawer with swipe-to-dismiss
- Better UX than Dialog for mobile bottom sheets
- Used by shadcn/ui's Drawer component

---

### 13.3 react-day-picker — USED (via shadcn/ui Calendar)

| Metric | Value |
|---|---|
| npm | `react-day-picker@^9.8.0` |
| Usage | `src/components/ui/calendar.tsx` |
| Use case | Date selection in forms, date range filters |

---

### 13.4 embla-carousel-react — USED (via shadcn/ui Carousel)

| Metric | Value |
|---|---|
| npm | `embla-carousel-react@^8.6.0` |
| Usage | `src/components/ui/carousel.tsx` |
| Use case | Swipeable card carousels on mobile |

---

### 13.5 react-resizable-panels — USED (via shadcn/ui Resizable)

| Metric | Value |
|---|---|
| npm | `react-resizable-panels@^3.0.3` |
| Usage | `src/components/ui/resizable.tsx` |
| Use case | Resizable panel layouts |

---

### 13.6 uuid — USED

| Metric | Value |
|---|---|
| npm | `uuid@^11.1.0` |
| Usage | Generating unique IDs for new entities |

---

### 13.7 sharp — USED

| Metric | Value |
|---|---|
| npm | `sharp@^0.34.3` |
| Usage | Next.js image optimization backend |

---

### 13.8 @reactuses/core — USED

| Metric | Value |
|---|---|
| npm | `@reactuses/core@^6.0.5` |
| Usage | Utility React hooks |

---

### 13.9 @dnd-kit — INSTALLED (Available)

| Metric | Value |
|---|---|
| Packages | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` |
| Status | Available for drag-and-drop features |
| Potential use | Category reordering, budget item sorting |

---

### 13.10 @mdxeditor/editor — INSTALLED (Available)

| Metric | Value |
|---|---|
| npm | `@mdxeditor/editor@^3.39.1` |
| Status | Available for rich text editing |
| Potential use | Transaction notes, budget descriptions |

---

### 13.11 react-markdown + react-syntax-highlighter — INSTALLED (Available)

| Metric | Value |
|---|---|
| npm | `react-markdown@^10.1.0`, `react-syntax-highlighter@^15.6.1` |
| Status | Available for rendering markdown content |
| Potential use | AI advisor responses, help documentation |

---

### 13.12 next-intl — INSTALLED (Reserved for Future i18n)

| Metric | Value |
|---|---|
| npm | `next-intl@^4.3.4` |
| Status | Reserved for multi-language support (pt-BR primary, en, es) |
| Current | All strings hardcoded in Portuguese Brazilian |

---

### 13.13 next-auth — INSTALLED (Available)

| Metric | Value |
|---|---|
| npm | `next-auth@^4.24.11` |
| Status | Available for authentication |
| Current | No auth implemented — app is single-user |

---

### 13.14 input-otp — USED (via shadcn/ui)

| Metric | Value |
|---|---|
| npm | `input-otp@^1.4.2` |
| Usage | OTP input component for verification flows |

---

## 14. Final Package Summary

### 14.1 Core Stack (NON-NEGOTIABLE)

```
next@^16.1.1                    # Framework (App Router)
react@^19.0.0                   # UI library
react-dom@^19.0.0               # DOM rendering
typescript@^5                   # Language
tailwindcss@^4                  # Styling
@tailwindcss/postcss@^4          # PostCSS integration
framer-motion@^12.23.2           # Animations
lucide-react@^0.525.0            # Icons
class-variance-authority@^0.7.1  # Component variants
clsx@^2.1.1                      # Conditional classes
tailwind-merge@^3.3.1            # className merging
tailwindcss-animate@^1.0.7        # Animation utilities
```

### 14.2 UI Component System

```
# shadcn/ui is installed as 50 individual component files, not as a package
# All under src/components/ui/ — based on 32 @radix-ui/* primitives
# Plus: cmdk, vaul, react-day-picker, embla-carousel-react, react-resizable-panels
```

### 14.3 Data & State

```
prisma@^6.11.1                   # ORM (SQLite)
@prisma/client@^6.11.1           # Prisma client
zustand@^5.0.6                   # Client state management
@tanstack/react-query@^5.82.0     # Server state (reserved)
```

### 14.4 Visualization

```
recharts@^2.15.4                 # Charts
```

### 14.5 Real-Time

```
socket.io-client@^4.8.3          # WebSocket client
# socket.io@^4.8.1               # WebSocket server (mini-service/finance-ws)
```

### 14.6 Forms & Validation

```
react-hook-form@^7.60.0          # Form management
@hookform/resolvers@^5.1.1       # Zod resolver integration
zod@^4.0.2                       # Schema validation
```

### 14.7 UX Utilities

```
sonner@^2.0.6                    # Toast notifications
next-themes@^0.4.6               # Dark/light theme
date-fns@^4.1.0                  # Date/time formatting
uuid@^11.1.0                     # UUID generation
```

### 14.8 AI

```
z-ai-web-dev-sdk@^0.0.17         # LLM integration (backend only)
```

### 14.9 Reserved / Available

```
next-intl@^4.3.4                 # i18n (reserved)
next-auth@^4.24.11                # Authentication (available)
@dnd-kit/core@^6.3.1             # Drag-and-drop (available)
@mdxeditor/editor@^3.39.1        # Rich text editor (available)
react-markdown@^10.1.0           # Markdown rendering (available)
@tanstack/react-table@^8.21.3     # Data tables (available)
```

---

## 15. Architecture Notes

### 15.1 Component Count by Category

| Category | Files | Location |
|---|---|---|
| UI primitives (shadcn/ui) | 50 | `src/components/ui/` |
| Finance views | 33 | `src/components/finance/` |
| Shared components | 2 | `src/components/shared/` |
| API routes | 28 | `src/app/api/*/route.ts` |
| Layout/entry | 2 | `src/app/page.tsx`, `src/app/layout.tsx` |
| Stores | 1 | `src/lib/store.ts` |
| Helpers | 1 | `src/lib/helpers.ts` |
| Mini-services | 1 | `mini-services/finance-ws/` |
| **Total** | **118** | |

### 15.2 Data Flow Architecture

```
┌─────────────┐    fetch()    ┌──────────────┐    Prisma    ┌──────────┐
│  Component   │ ──────────→  │  API Route    │ ──────────→ │  SQLite   │
│  (client)    │ ←──────────  │  (server)     │ ←──────────  │  (db)    │
└─────────────┘    JSON       └──────────────┘   ORM        └──────────┘
      │
      │ useState/useEffect
      ▼
┌─────────────┐
│  Zustand     │  ← Navigation, selection state (NO data)
│  Store       │
└─────────────┘
      │
      │ Socket.io (real-time)
      ▼
┌─────────────┐
│  finance-ws │  ← Port 3004, room-based broadcasting
│  (mini-svc) │
└─────────────┘
```

### 15.3 Self-Fetching Widget Pattern (Primary Data Pattern)

```
Parent (page.tsx)
  └─ WidgetView (useAppStore.currentView switch)
       └─ WidgetComponent (self-fetching via useEffect)
            ├─ Loading → WidgetCardSkeleton
            ├─ Empty → EmptyState
            └─ Data → WidgetCard → children
```

This is the dominant pattern — 33 finance components, 28 API endpoints, all following Self-Fetching Widget (ARCHITECTURE_CONVENTIONS §16).

### 15.4 Single-Route SPA Decision

**Why NOT multi-page routing:**
- All views share the same layout (sidebar + main content)
- Navigation between financial views should be instant (no page reload)
- Shared state (selectedAccountId, sidebarOpen, etc.) persists across views
- SPA feels more like a native financial app than separate pages

**Trade-offs accepted:**
- No SEO benefits (financial app, not a public website — acceptable)
- Initial bundle larger (mitigated by code splitting)
- No browser back/forward per view (mitigated by sidebar navigation)
