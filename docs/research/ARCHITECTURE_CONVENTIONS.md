Architecture & Componentization Convention
Project: Agrelli Notion Bot — Next.js 16 + TypeScript
Date: 2026-04-19
Purpose: Permanent reference document injected into development context
Scope: Frontend UI + Bot backend architecture

1. Componentization Philosophy
1.1 Hierarchy
All components follow a strict layered hierarchy. Each layer has clear responsibilities and constraints.

text

primitives/     <- Atomic, no dependencies, pure presentational
  Button.tsx
  Text.tsx
  Badge.tsx
  Input.tsx

enhanced/       <- Wraps primitives, adds logic/behavior
  ConfirmButton.tsx      (Button + confirmation state)
  SearchableInput.tsx    (Input + dropdown logic)
  CopyableText.tsx       (Text + copy-to-clipboard)

shared/         <- Domain-agnostic, reusable across features
  Card.tsx
  Modal.tsx
  Offcanvas.tsx
  DataTable.tsx
  Sidebar.tsx
  Toast.tsx

features/       <- Domain-specific, tied to business logic
  auth/
    LoginForm.tsx
    OtpVerification.tsx
  property/
    PropertyCard.tsx
    PropertyForm.tsx
    DraftProgress.tsx
  user/
    ProfileCard.tsx
    ProfileEditForm.tsx

layouts/        <- Page-level structure
  DashboardLayout.tsx
  BotLayout.tsx
1.2 Rules
NEVER duplicate component logic across routes. If two routes use an accordion, a card, a modal — it MUST be the same shared component.
Every repeated UI pattern becomes a shared component after the 2nd occurrence.
Primitives never import from enhanced/shared/features. Dependency flows downward only.
Enhanced components may import primitives only.
Shared components may import primitives and enhanced.
Feature components may import from any layer above.
2. className & Tokenization
2.1 NO raw generic classes in className
tsx

// BAD - div soap with raw generic classes
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-md border border-gray-200">
  <div className="flex items-center gap-2">
    <span className="text-sm font-medium text-gray-500">Label</span>
    <span className="text-lg font-bold text-gray-900">Value</span>
  </div>
  <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
    Action
  </button>
</div>

// GOOD - tokenized via cva or component variants
<Card variant="outlined" padding="md" className="gap-4">
  <CardHeader>
    <CardLabel>Label</CardLabel>
    <CardValue>Value</CardValue>
  </CardHeader>
  <Button variant="primary" size="md">Action</Button>
</Card>
2.2 Excessive className = New Variant
Signal: If you find yourself writing className="bg-red-500 hover:bg-red-600 ..." or className="text-sm font-medium ..." repeatedly in different contexts, extract it as a variant.

tsx

// BAD - repeating the same pattern
<Button className="bg-red-500 hover:bg-red-600 text-white">Delete</Button>
<Button className="bg-red-500 hover:bg-red-600 text-white">Remove</Button>

// GOOD - create a variant
const buttonVariants = cva('...', {
  variants: {
    variant: {
      primary: '...',
      destructive: 'bg-red-500 hover:bg-red-600 text-white',
    }
  }
})
2.3 Token Pattern
Use cva (class-variance-authority) for component variants
Use tailwind-merge (cn() utility) to merge classes
Use clsx for conditional classes
All tokens live in the component file, never inline in consumers
2.4 Shared className tokens via cn()
typescript

// lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
3. File Separation: .ts vs .tsx
3.1 Rule
File Type
Extension
Contains
Types, interfaces, enums, constants, pure functions, utilities, services, stores        .ts     Zero JSX
Components, pages, layouts      .tsx    Contains JSX

3.2 Examples
text

components/
  ui/
    Button.tsx                          # Has JSX -> .tsx
    button.types.ts                     # Types only -> .ts (if complex)
    button.variants.ts                  # Variant definitions -> .ts

  shared/
    Card.tsx                            # Has JSX -> .tsx
    card.types.ts                       # CardProps interface -> .ts

lib/
  utils.ts                              # Pure functions -> .ts
  constants.ts                          # Constants -> .ts
  validators.ts                         # Zod schemas -> .ts

types/
  auth.ts                               # AuthContext, OtpSession -> .ts
  property.ts                           # PropertyDraft -> .ts
  conversation.ts                       # ConversationState -> .ts

hooks/
  useAuth.ts                            # Custom hook (returns JS) -> .ts
  useMediaQuery.ts                      # Custom hook -> .ts

stores/
  auth-store.ts                         # Zustand store -> .ts
  property-store.ts                     # Zustand store -> .ts

services/
  identity-service.ts                   # Business logic -> .ts
  notion-client.ts                      # API client -> .ts
3.3 Anti-patterns
tsx

// BAD - types + component mixed in one .tsx file
// Card.tsx
export interface CardProps { ... }
export const Card = ({ ... }) => <div>...</div>
export interface CardHeaderProps { ... }
export const CardHeader = ({ ... }) => <div>...</div>

// GOOD - types separated
// card.types.ts
export interface CardProps { ... }
export interface CardHeaderProps { ... }

// Card.tsx
import type { CardProps, CardHeaderProps } from './card.types'
export const Card = ...
export const CardHeader = ...
4. Dark/Light Theme
4.1 Rules
EVERY component must be tested in BOTH themes.
Background colors are the most common source of bugs — always use theme tokens, never hardcoded colors.
Use CSS variables via Tailwind (bg-background, text-foreground, bg-muted, etc.)
NO bg-white or bg-black — use bg-background, bg-card, bg-popover.
Border colors — use border-border, never border-gray-200.
Text colors — use text-foreground, text-muted-foreground, text-primary.
4.2 Token Mapping
Purpose
Token
Light
Dark
Page background bg-background   white   near-black
Card surface    bg-card white   dark gray
Muted background        bg-muted        light gray      darker gray
Primary text    text-foreground black   white
Secondary text  text-muted-foreground   gray-500        gray-400
Borders border-border   gray-200        gray-700
Primary action  bg-primary text-primary-foreground      brand + white   brand + white
Destructive     bg-destructive text-destructive-foreground      red + white     red + white

4.3 Testing Checklist
For every component, verify in Preview Panel:

 Light mode — all text readable
 Dark mode — all text readable
 Light mode — no invisible borders or missing contrast
 Dark mode — no invisible borders or missing contrast
 Light mode — no "glowing" backgrounds
 Dark mode — no harsh white spots
5. Z-Index Management
5.1 Layer System
Components that float above others MUST use a shared z-index layer system.

typescript

// lib/z-index.ts
export const Z_INDEX = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  overlay: 30,
  popover: 40,
  tooltip: 50,
  modal: 60,
  toast: 70,
  offcanvas: 80,
} as const
5.2 Rules
Tooltips — always above popovers (z-50+)
Popovers — always above dropdowns (z-40+)
Modals — above everything except toast/offcanvas (z-60+)
Toast — highest notification layer (z-70+)
Offcanvas — highest interactive layer (z-80+)
NEVER hardcode z-50 or z-[9999] — use the constant
shadcn/ui components — respect their default z-index; if overriding, use our constants
5.3 shadcn/ui Z-Index Defaults
Component
Default
Our Layer
DropdownMenu    z-50    Z_INDEX.dropdown (10) — override if needed
Popover z-50    Z_INDEX.popover (40) — override
Tooltip z-50    Z_INDEX.tooltip (50) — matches
Dialog (Modal)  z-50    Z_INDEX.modal (60) — override
Sheet (Offcanvas)       z-50    Z_INDEX.offcanvas (80) — override

Important: shadcn/ui defaults everything to z-50. For proper stacking, override using CSS variables or className overrides.
6. Responsive Design — Beyond Desktop/Mobile
6.1 Viewport Breakpoints
Breakpoint
Width
Target
xs      375px   iPhone SE, small phones
sm      640px   Standard phones
md      768px   Tablets portrait
lg      1024px  Tablets landscape, small laptops
xl      1280px  Desktops
2xl     1536px  Large desktops

6.2 Testing Requirements
Every page/component MUST be verified at:

375px (iPhone SE — smallest common phone)
640px (standard phone width)
768px (tablet portrait — sidebar collapse point)
1024px (tablet landscape / laptop)
1280px (standard desktop)
1536px (large desktop — max-width container check)
6.3 Rules
Mobile-first — write mobile styles first, add md:, lg:, xl: for enhancements
Touch targets — minimum 44px for all interactive elements
No horizontal scroll — ever, at any breakpoint
Sidebar — collapsed by default on md: and below, expanded on lg: and above
Tables — convert to cards on mobile, use responsive table on desktop
Modals — full-screen on mobile, centered dialog on desktop
7. i18n (Internationalization)
7.1 Language Support
Code
Language
Dictionary File
pt      Portuguese (all variants)       messages/pt.json
en      English (all variants)  messages/en.json
es      Spanish (all variants)  messages/es.json

7.2 Fallback Rules
pt-BR, pt-PT, pt-AO → all resolve to pt
en-US, en-GB, en-AU → all resolve to en
es-MX, es-ES, es-AR → all resolve to es
7.3 Implementation Pattern
typescript

// lib/i18n/resolve-locale.ts
function resolveLocale(locale: string): 'pt' | 'en' | 'es' {
  const base = locale.split('-')[0].toLowerCase()
  if (['pt'].includes(base)) return 'pt'
  if (['en'].includes(base)) return 'en'
  if (['es'].includes(base)) return 'es'
  return 'pt' // default
}
7.4 Dictionary Structure (Next.js standard)
text

messages/
  pt.json          # Portuguese (all variants)
  en.json          # English (all variants)
  es.json          # Spanish (all variants)
json

// messages/pt.json
{
  "auth": {
    "email_placeholder": "Digite seu email",
    "otp_placeholder": "Codigo de verificacao",
    "verify_button": "Verificar",
    "otp_expired": "Codigo expirado. Solicite um novo.",
    "otp_blocked": "Muitas tentativas. Contate o suporte."
  },
  "property": {
    "new_capture": "Nova Captacao",
    "update": "Atualizar Propriedade",
    "street": "Endereco",
    "city": "Cidade",
    "state": "Estado",
    "zipcode": "CEP",
    "acquisition_channel": "Canal de Aquisicao",
    "specifications": "Especificacoes",
    "attempts": "Tentativas ate o SIM",
    "estimated_profit": "Lucro Estimado"
  },
  "common": {
    "cancel": "Cancelar",
    "confirm": "Confirmar",
    "save": "Salvar",
    "loading": "Carregando...",
    "error": "Erro",
    "success": "Sucesso",
    "back": "Voltar",
    "next": "Proximo"
  }
}
7.5 Bot i18n
For Telegram bot messages, use @grammyjs/i18n with the same dictionary structure, adapted for bot responses:

text

bot/
  locales/
    pt.json
    en.json
    es.json
8. Unified Component Patterns
8.1 Modal/Dialog — ONE component
tsx

// BAD - creating a new Dialog for every use case
// PropertyConfirmDialog.tsx
<Dialog>
  <DialogContent>
    <DialogTitle>Confirmar Propriedade</DialogTitle>
    <DialogDescription>...</DialogDescription>
    <Button onClick={onConfirm}>Confirmar</Button>
  </DialogContent>
</Dialog>

// ProfileConfirmDialog.tsx
<Dialog>
  <DialogContent>
    <DialogTitle>Confirmar Perfil</DialogTitle>
    <DialogDescription>...</DialogDescription>
    <Button onClick={onConfirm}>Confirmar</Button>
  </DialogContent>
</Dialog>

// GOOD - one UnifiedConfirmDialog with props
<UnifiedConfirmDialog
  title={title}
  description={description}
  confirmLabel={confirmLabel}
  variant={variant}
  onConfirm={onConfirm}
  onCancel={onCancel}
  loading={isSubmitting}
/>
8.2 Card — ONE component, many variants
tsx

// BAD - hardcoded card per route
// PropertyCard.tsx
<div className="flex items-center gap-4 p-4 rounded-lg border">
  <div className="font-medium">...</div>
  <Badge>...</Badge>
</div>

// UserCard.tsx
<div className="flex items-center gap-4 p-4 rounded-lg border">
  <div className="font-medium">...</div>
  <Badge>...</Badge>
</div>

// GOOD - unified card
<Card variant="interactive" padding="md">
  <CardHeader>
    <CardTitle>{title}</CardTitle>
    <CardBadge variant={status}>{statusLabel}</CardBadge>
  </CardHeader>
  <CardContent>
    {children}
  </CardContent>
  <CardFooter>
    <Button variant="ghost" size="sm">{actionLabel}</Button>
  </CardFooter>
</Card>
8.3 Accordion — ONE component
tsx

// BAD - accordion per section
// FaqAccordion.tsx, PropertyAccordion.tsx, ProfileAccordion.tsx

// GOOD - one UnifiedAccordion
<UnifiedAccordion
  items={[
    { id: '1', title: '...', content: <ComponentA /> },
    { id: '2', title: '...', content: <ComponentB /> },
  ]}
  allowMultiple
  defaultOpen={['1']}
/>
8.4 Offcanvas/Sheet — ONE component
tsx

<UnifiedSheet
  side="right"
  title={title}
  open={open}
  onOpenChange={onOpenChange}
>
  {children}
</UnifiedSheet>
9. Sidebar
9.1 Requirements
Icons must be consistent — use Lucide icons throughout, same size and style
Icons must NOT be hidden when sidebar is collapsed — show icons only in collapsed state
Smooth expand/collapse animation — use Framer Motion or CSS transitions
Responsive behavior:
lg+: Sidebar visible, can toggle
md-: Sidebar is offcanvas/overlay, triggered by hamburger menu
9.2 Pattern
tsx

<Sidebar collapsible="icon" defaultCollapsed={false}>
  <SidebarHeader>
    <Logo />
  </SidebarHeader>
  <SidebarContent>
    <SidebarGroup>
      <SidebarGroupLabel>Menu</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton tooltip="Dashboard">
            <LayoutDashboard />
            <span>Dashboard</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton tooltip="Propriedades">
            <Building2 />
            <span>Propriedades</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  </SidebarContent>
  <SidebarFooter>
    <UserNav />
  </SidebarFooter>
</Sidebar>
9.3 Sidebar Rules
Icon size: 20px (Lucide size={20})
Collapsed width: 48px (enough for icon + 8px padding each side)
Expanded width: 256px
Tooltip: Show tooltip on hover when collapsed, using shadcn Tooltip
Active state: Use bg-accent text-accent-foreground for active item
Hover state: Use hover:bg-accent/50 hover:text-accent-foreground
Transition: transition-all duration-200 ease-in-out
10. Real Data, No Mocks
10.1 Rules
NEVER use hardcoded mock data in production code.
All data must come from the actual database (Notion + Redis/SQLite).
If a feature needs data that doesn't exist yet, create seed data in the database.
Placeholder patterns are acceptable for loading states (skeletons), never for "content".
10.2 Loading States
tsx

// GOOD - skeleton while loading
{isLoading ? (
  <CardSkeleton rows={3} />
) : (
  <PropertyCard property={realProperty} />
)}

// BAD - fake data
{isLoading ? (
  <PropertyCard property={{ street: '123 Main St', city: 'New York' }} />
) : (
  <PropertyCard property={realProperty} />
)}
10.3 Empty States
tsx

// GOOD - descriptive empty state with action
<EmptyState
  icon={Building2}
  title="Nenhuma propriedade"
  description="Voce ainda nao cadastrou nenhuma propriedade."
  action={
    <Button onClick={onNewProperty}>
      <Plus /> Nova Captacao
    </Button}
  />
/>
11. Component File Structure
11.1 Per-Component Organization
text

components/
  shared/
    Card/
      Card.tsx              # Main component
      Card.types.ts         # TypeScript interfaces
      Card.test.tsx         # Tests (if applicable)
      Card.stories.tsx      # Storybook (if applicable)
      index.ts              # Barrel export
11.2 Barrel Exports
typescript

// components/shared/Card/index.ts
export { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from './Card'
export type { CardProps, CardHeaderProps, CardContentProps } from './Card.types'
12. State Management Separation
12.1 .ts files for state logic
typescript

// stores/property-store.ts (.ts - no JSX)
import { create } from 'zustand'
import type { PropertyDraft } from '@/types/property'

interface PropertyState {
  drafts: PropertyDraft[]
  activeDraft: PropertyDraft | null
  // actions
  setDrafts: (drafts: PropertyDraft[]) => void
  startDraft: (draft: PropertyDraft) => void
  cancelDraft: () => void
}

export const usePropertyStore = create<PropertyState>((set) => ({
  drafts: [],
  activeDraft: null,
  setDrafts: (drafts) => set({ drafts }),
  startDraft: (draft) => set({ activeDraft: draft }),
  cancelDraft: () => set({ activeDraft: null }),
}))
12.2 .tsx files for components that consume state
tsx

// features/property/DraftProgress.tsx (.tsx - has JSX)
'use client'

import { usePropertyStore } from '@/stores/property-store'

export function DraftProgress() {
  const { activeDraft, cancelDraft } = usePropertyStore()
  if (!activeDraft) return null

  return (
    <Card variant="outlined">
      <CardContent>
        {/* ... render draft progress */}
      </CardContent>
    </Card>
  )
}
13. Conversation State Machine (FSM)
13.1 States — Pure TypeScript Enum
typescript

// types/conversation.ts (.ts - no JSX)
export enum ConversationState {
  UNVERIFIED = 'UNVERIFIED',
  AWAITING_EMAIL = 'AWAITING_EMAIL',
  OTP_PENDING = 'OTP_PENDING',
  AUTH_BLOCKED = 'AUTH_BLOCKED',
  VALIDATED_IDLE = 'VALIDATED_IDLE',
  PROFILE_UPDATE_PENDING_CONFIRMATION = 'PROFILE_UPDATE_PENDING_CONFIRMATION',
  PROPERTY_DRAFT_OPEN = 'PROPERTY_DRAFT_OPEN',
  PROPERTY_DRAFT_AWAITING_MISSING_FIELDS = 'PROPERTY_DRAFT_AWAITING_MISSING_FIELDS',
  PROPERTY_DRAFT_AWAITING_CONFIRMATION = 'PROPERTY_DRAFT_AWAITING_CONFIRMATION',
  PROPERTY_UPDATE_SELECTING_TARGET = 'PROPERTY_UPDATE_SELECTING_TARGET',
  PROPERTY_UPDATE_TARGET_LOCKED = 'PROPERTY_UPDATE_TARGET_LOCKED',
  PROPERTY_UPDATE_CONFIRMING_PATCH = 'PROPERTY_UPDATE_CONFIRMING_PATCH',
  SUPPORT_ONLY = 'SUPPORT_ONLY',
}
13.2 Transition Table — Pure TypeScript
typescript

// lib/bot/fsm/transitions.ts (.ts - no JSX)
export const TRANSITIONS: Record<ConversationState, ConversationState[]> = {
  [ConversationState.UNVERIFIED]: [ConversationState.AWAITING_EMAIL],
  [ConversationState.AWAITING_EMAIL]: [
    ConversationState.OTP_PENDING,
    ConversationState.SUPPORT_ONLY,
  ],
  // ...
}
13.3 FSM Visualization Component
tsx

// features/bot/FsmVisualizer.tsx (.tsx - has JSX)
export function FsmVisualizer({ currentState }: { currentState: ConversationState }) {
  return (
    <div className="flex items-center gap-2">
      {Object.values(ConversationState).map((state) => (
        <StateBadge
          key={state}
          state={state}
          active={state === currentState}
        />
      ))}
    </div>
  )
}
14. Quick Reference — What Goes Where
Concern
File Type
Location
Component       .tsx    components/{layer}/{name}/{Name}.tsx
Component Props .ts     components/{layer}/{name}/{Name}.types.ts
Utility Functions       .ts     lib/utils.ts or lib/{domain}/
Constants       .ts     lib/constants.ts or lib/{domain}/constants.ts
Zod Schemas     .ts     lib/validators/{domain}.ts
TypeScript Types/Enums  .ts     types/{domain}.ts
Zustand Stores  .ts     stores/{domain}-store.ts
Custom Hooks    .ts     hooks/use-{name}.ts
API Functions   .ts     lib/api/{domain}.ts
Service Classes .ts     lib/services/{domain}-service.ts
Next.js Pages   .tsx    app/{route}/page.tsx
Next.js Layouts .tsx    app/{route}/layout.tsx
Next.js API Routes      .ts     app/api/{route}/route.ts
i18n Dictionaries       .json   messages/{locale}.json
Bot Locales     .json   bot/locales/{locale}.json
15. Anti-Pattern Checklist
Before merging any code, verify:

 No "div soup" — excessive generic className without componentization
 No hardcoded colors (bg-white, text-gray-500 instead of tokens)
 No z-[9999] — use z-index constants
 No duplicate component patterns across routes
 No mock data in production code
 No types mixed into .tsx files (should be separate .ts)
 No business logic in .tsx files (should be in .ts services/stores)
 No inconsistent icon sizes in sidebar
 No components only tested in desktop viewport
 No dark mode regressions
 No hardcoded strings (use i18n keys)

---

## NEW CONVENTIONS — Derived from Project History (2026-04)

The following sections capture rules and patterns that emerged organically during development of the financial dashboard. These are not theoretical — they are battle-tested solutions to real problems encountered across 40+ development tasks.

---

16. Self-Fetching Widget Pattern
16.1 Definition
A "self-fetching widget" is a 'use client' component that fetches its own data from API routes on mount. It requires ZERO props from the parent — no data drilling, no prop plumbing.

16.2 When to Use
Use self-fetching widgets when ALL of these are true:
  The component is a standalone "island" of functionality
  Its data comes from a single (or predictable set of) API endpoint(s)
  The parent does NOT need to control, filter, or transform the data
  The component manages its own loading/error/empty states

16.3 Examples from the Project
Component | Fetches From | Props Required
BudgetGoalsWidget | /api/budgets | None
FinancialHealthScore | /api/dashboard | None
NotificationPanel | /api/transactions + /api/purchases | isOpen, onClose
FinancialReportsWidget | /api/reports?months=6 | None
SmartInsights | /api/dashboard | None

16.4 Implementation Pattern
tsx

'use client'

export function BudgetGoalsWidget() {
  const [data, setData] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/budgets')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <WidgetCardSkeleton />
  if (data.length === 0) return <EmptyState ... />

  return <WidgetCard>...</WidgetCard>
}

16.5 Rules
  NEVER fetch inside a parent and pass data as props when self-fetching applies
  Self-fetching components MUST handle their own loading skeleton
  Self-fetching components MUST handle their own empty state
  Use useCallback for fetch functions when dependencies change
  Parallel fetches with Promise.all when multiple endpoints are needed
  Avoid re-fetching on every render — use proper dependency arrays

---

17. WidgetCard Shared Shell System
17.1 Component Family
All shared card components live in components/shared/widget-card.tsx. This file contains a family of related components:

Component | Purpose | Replaces
WidgetCard | Unified card shell with gradient bar + icon header | 17+ duplicated Card patterns
WidgetCardSkeleton | Matching loading skeleton | Inline skeleton patterns
MiniMetricCard | Compact metric sub-card inside widgets | 12+ inline patterns
QuickStatCard | Ultra-compact stat card (plain div, NOT shadcn Card) | Inline quick stat patterns
FilterPills | Reusable filter toggle buttons | 4+ inline filter patterns
AnimatedCounter | Shared RAF-based counter | 2 local duplicates
TrendBadge | Shared percent change badge with arrow | ~60 lines of ternary logic

17.2 WidgetCard Props Contract
tsx

<WidgetCard
  gradient="from-teal-500 via-cyan-500 to-sky-500"   // top bar gradient
  icon={BarChart3}                                    // Lucide icon
  iconGradient="from-teal-500 to-cyan-600"            // icon bg gradient
  iconShadow="shadow-teal-500/20"                     // icon glow
  title="Fluxo de Caixa"                              // title text
  subtitle="Previsão dos próximos 6 meses"             // subtitle
  action={<Badge>Pro</Badge>}                         // top-right content
  padding="default"                                   // 'default' (p-5) or 'compact' (p-4)
  glow={true}                                        // hover shadow + card-glow effect
  className="lg:col-span-2"                           // extra classes
>
  {children}
</WidgetCard>

17.3 Rules
  ALWAYS use WidgetCard for dashboard widgets — never create a new <Card> wrapper
  ALL dashboard widgets MUST use the same card shell for visual consistency
  WidgetCardSkeleton MUST match WidgetCard's visual structure (gradient bar + icon area)
  MiniMetricCard is for sub-metrics INSIDE a WidgetCard — not a standalone widget
  QuickStatCard uses PLAIN div, not shadcn Card (see Section 18)

---

18. Bypassing shadcn Base Components
18.1 The Problem
shadcn/ui components sometimes have baked-in styles that conflict with design requirements. The most impactful example:

  shadcn Card has py-6 (24px vertical padding) hardcoded in its className
  Even wrapping children in CardContent with p-4 cannot override the outer Card padding
  This causes excessive vertical height in compact card scenarios

18.2 The Solution — QuickStatCard Pattern
When a shadcn component's built-in spacing doesn't fit, create a purpose-built component using plain HTML elements with explicit Tailwind classes:

tsx

// QuickStatCard — uses plain div, NOT shadcn Card
<div className="rounded-xl border bg-card shadow-sm px-4 py-3">
  <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
  <div className="flex items-center gap-3 mt-1.5">
    <div className="w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center">
      <Icon className="w-3.5 h-3.5 text-white" />
    </div>
    <div>
      <p className="text-[15px] font-bold tabular-nums">{value}</p>
    </div>
  </div>
</div>

18.3 When to Bypass
  The shadcn component has baked-in padding/margin that can't be overridden via className
  The design requires tighter control over spacing than the component allows
  The component's internal structure adds unnecessary DOM depth

18.4 When NOT to Bypass
  When shadcn's defaults work fine for the use case
  When bypassing would mean reimplementing accessibility features (ARIA, keyboard nav)
  When the component provides behavior you need (e.g., Dialog's focus trap, Portal)

18.5 Rules
  ALWAYS document WHY a shadcn component was bypassed in the component comment
  Use cn() to maintain theme-aware colors even with plain elements (bg-card, border-border)
  Match the visual style of shadcn components (border-radius, transitions, shadows)

---

19. Framer Motion Conventions
19.1 Variant Naming Standard
All motion variants follow a consistent naming pattern:

Pattern | Name | Purpose
containerVariants | { hidden: {}, visible: { transition: { staggerChildren } } } | Wrapper for staggered children
itemVariants | { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } } | Individual staggered items
detailEntry | { hidden: { opacity: 0, x: -20 }, visible: { ... } } | Detail view entry
summaryContainer | Same as containerVariants but for summary cards row | Summary sections
txItem | { hidden: { opacity: 0, x: -8 }, visible: { ... } } | List item entries

19.2 Stagger Values Reference
Context | staggerChildren Value | Use Case
Card grid entries | 0.06 | Dashboard widget grid
Summary cards row | 0.08 | Top summary row
List items (transactions, etc.) | 0.04 | Notification list, search results
Menu items (FAB) | 0.05 | Quick actions vertical menu
Mini metric bars | 0.15 | Health score criteria bars

19.3 Standard Animation Patterns
tsx

// Staggered grid — the most common pattern
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
}

// Hover lift on cards
<motion.div
  variants={itemVariants}
  whileHover={{ y: -2, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
>

// Expand/collapse with AnimatePresence
<AnimatePresence mode="wait">
  {isExpanded && (
    <motion.div
      key="expanded"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {content}
    </motion.div>
  )}
</AnimatePresence>

19.4 Rules
  NEVER use whileHover without specifying transition type — always use spring for interactive elements
  ALWAYS use AnimatePresence for conditional rendering (mount/unmount animations)
  Shared variants MUST be imported from @/lib/helpers — never defined locally per component
  Animation duration should NEVER exceed 1.5s for entry animations
  whileTap: { scale: 0.97 } for buttons, whileTap: { scale: 0.92 } for action items

---

20. Utility Function Centralization
20.1 Required Shared Utilities
All utility functions used across 2+ components MUST be centralized in lib/helpers.ts or lib/utils.ts:

Utility | Signature | Used In
currencyFmt | (value: number) => string | All views, all widgets
dateFmt | (date: string | Date) => string | Dashboard, accounts, purchases
containerVariants / itemVariants | Framer Motion variants | All widget grids

20.2 Implementation Pattern
typescript

// lib/helpers.ts
export const currencyFmt = (value: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

export const dateFmt = (date: string | Date): string =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date))

// Framer Motion — shared variants
export const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

export const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
}

20.3 Rules
  NEVER define currencyFmt or dateFmt locally inside a component — always import from helpers
  NEVER define animation variants locally if they match the shared patterns
  Format locale is ALWAYS pt-BR — never hardcode 'en-US' or other locales
  Currency is ALWAYS BRL — never hardcode '$' or 'USD'
  If a utility is used in 2+ files, it MUST be extracted to lib/helpers.ts

---

21. Responsive Grid & Widget Pairing Strategy
21.1 Grid Template
All widget grids use the same responsive template:

tsx

<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* Full-width widgets */}
  <DashboardView className="lg:col-span-2" />
  <SmartInsights className="lg:col-span-2" />

  {/* Paired widgets — complementary content */}
  <CashFlowForecast />    {/* paired with */}
  <SpendingTimeline />    {/* time-based forecasts */}

  <ExpenseBreakdown />    {/* paired with */}
  <BalanceProjection />   {/* balance/spend analysis */}
</div>

21.2 Pairing Logic
Widgets are paired based on complementary content:
  Time-based widgets pair together (CashFlow + Timeline)
  Analysis widgets pair together (Expense + Balance)
  Calendar/event widgets pair together (Calendar + Bills)
  Category widgets pair together (Budget + Goals)

21.3 col-span Rules
  Use lg:col-span-2 ONLY when:
  The widget needs more horizontal space (charts, tables)
  The widget is the "hero" or primary content area (DashboardView)
  Paired content would be confusing (SmartInsights standalone)

21.4 Widget className Contract
Every widget that participates in the grid MUST accept an optional className prop:

tsx

export function MyWidget({ className }: { className?: string }) {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className={className}>
      <WidgetCard ...>{children}</WidgetCard>
    </motion.div>
  )
}

---

22. Seed Data ID Convention
22.1 Prefix Pattern
All seed data uses deterministic prefixed IDs for idempotent re-seeding:

Entity | Prefix Pattern | Example
Categories | cat-* | cat-food, cat-transport, cat-salary
Accounts | cur-acc-* | cur-acc-nubank, cur-acc-itau
Cards | cur-card-* | cur-card-nubank, cur-card-inter
Transactions | cur-txn-* | cur-txn-salary-apr
Purchases | cur-pur-* | cur-pur-amazon-apr
Budget Goals | cur-bg-* | cur-bg-carro, cur-bg-emergencia

22.2 Rules
  IDs MUST be human-readable and indicate the entity type
  IDs MUST be deterministic — same seed run produces same IDs
  Seed scripts MUST use upsert to prevent duplicates on re-seed
  Old prefix patterns MUST be cleaned up before re-seeding (delete where id starts with old prefix)
  NEVER use UUID or random IDs for seed data

---

23. API Route Standards
23.1 Response Shape Convention
Every API route follows a consistent pattern:

typescript

// GET — returns array or object
export async function GET(request: NextRequest) {
  try {
    const data = await db.entity.findMany({ ... })
    return NextResponse.json(data)
  } catch (error) {
    console.error('[API /entity]', error)
    return NextResponse.json(
      { error: 'Erro ao buscar dados' },  // Portuguese error messages
      { status: 500 }
    )
  }
}

// POST — creates entity, returns created
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // validation...
    const created = await db.entity.create({ data: body })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    // ...
  }
}

23.2 Rules
  ALL error messages MUST be in Portuguese
  ALL error responses use { error: string } shape
  ALWAYS use NextRequest/NextResponse (not plain Request/Response)
  ALWAYS wrap in try/catch with console.error including the route path
  POST returns 201, GET returns 200, PUT returns 200, DELETE returns 200
  Validation errors return 400 with descriptive Portuguese message
  Not found errors return 404
  Side effects (balance updates) MUST use Prisma.$transaction for atomicity

---

24. Color Accent & Gradient System
24.1 Standard Color Assignments
Context | Color | Gradient Classes
Income / Positive | Emerald | from-emerald-500 to-emerald-600, bg-emerald-500/10
Expense / Negative | Rose | from-rose-500 to-rose-600, bg-rose-500/10
Info / Neutral | Sky / Cyan | from-sky-500 to-cyan-500
Warning / Attention | Amber | from-amber-500 to-orange-500
Primary / Brand | Violet | from-violet-500 to-purple-600
Success / Complete | Green | from-green-500 to-emerald-500

24.2 Gradient Top Bar Pattern
Every WidgetCard has an optional 1px gradient top bar:

tsx

<div className="h-1 bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500" />

24.3 Icon Gradient + Shadow Pattern
tsx

<div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
  <Icon className="w-5 h-5 text-white" />
</div>

24.4 Rules
  Gradient colors MUST use the same family (e.g., teal→cyan→sky, NOT teal→red→blue)
  Icon gradient MUST always have a matching shadow color (shadow-{color}-500/20)
  Icon size inside gradient circle: w-5 h-5 for widget headers, w-4 h-4 for mini metrics, w-3.5 h-3.5 for quick stats
  Hover effects: hover:shadow-xl + card-glow class on the card wrapper

---

25. Skeleton & Loading State Convention
25.1 Widget Skeleton
Every widget MUST have a loading skeleton that matches its visual structure:

tsx

{loading ? (
  <WidgetCardSkeleton
    gradient="from-teal-500 to-cyan-500"
    contentLines={3}
  />
) : (
  <WidgetCard ...>{content}</WidgetCard>
)}

25.2 Quick Stat Skeleton
For quick stat cards, use a row of Skeleton blocks matching the compact layout:

tsx

<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
  {quickStats.map((_, i) => (
    <div key={i} className="rounded-xl border bg-card p-4 space-y-2 animate-pulse">
      <Skeleton className="h-3 w-24" />      {/* title */}
      <div className="flex items-center gap-3">
        <Skeleton className="w-8 h-8 rounded-lg" />  {/* icon */}
        <div className="space-y-1 flex-1">
          <Skeleton className="h-4 w-20" />  {/* value */}
          <Skeleton className="h-3 w-12" />  {/* trend */}
        </div>
      </div>
    </div>
  ))}
</div>

25.3 Rules
  Skeleton dimensions MUST roughly match the final content dimensions
  ALWAYS use animate-pulse on manual skeletons
  WidgetCardSkeleton is preferred over manual skeleton divs
  NEVER show fake data as loading state — always use skeletons

---

26. Empty State Convention
26.1 Standard Pattern
Every list/grid that can be empty MUST implement the empty state pattern:

tsx

<div className="flex flex-col items-center justify-center py-12 text-center">
  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
    <Icon className="w-8 h-8 text-muted-foreground" />
  </div>
  <h3 className="text-lg font-semibold text-foreground">Nenhuma transação registrada</h3>
  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
    Você ainda não registrou nenhuma transação nesta conta.
  </p>
  {action && (
    <Button onClick={action.handler} className="mt-4">
      <Plus className="w-4 h-4" />
      {action.label}
    </Button>
  )}
</div>

26.2 Rules
  Icon MUST be in a rounded-full muted background circle
  Title MUST be descriptive (not just "Vazio")
  Subtitle MUST explain WHY it's empty and what to do
  Action button is OPTIONAL but RECOMMENDED when there's a clear next step
  Empty state text MUST be in Portuguese
  Context-aware messages when filters are active (e.g., "Nenhuma despesa encontrada para este período")

---

27. Named Exports Only
27.1 Rule
ALL components MUST use named exports. NEVER use default exports.

27.2 Rationale
  Named exports enable tree-shaking
  Named exports force intentional imports
  Named exports avoid naming collisions
  Named exports make refactoring safer (IDE can track references)

27.3 Examples
tsx

// GOOD — named export
export function AIAdvisor() { ... }
export function FinancialHealthScore() { ... }
export function QuickStatCard() { ... }

// BAD — default export
export default function AIAdvisor() { ... }

// GOOD — import
import { AIAdvisor } from '@/components/finance/ai-advisor'

// BAD — import
import AIAdvisor from '@/components/finance/ai-advisor'

---

28. Card Height Equalization in CSS Grid
28.1 The Problem
When cards in a CSS grid have different content lengths, they default to different heights within the same row, creating visual asymmetry.

28.2 The Solution
Use flexbox column + margin-top auto to push footers to the bottom:

tsx

// Each card in the grid:
<Card className="h-full flex flex-col">
  <CardHeader>...</CardHeader>
  <CardContent className="flex-1">
    {/* Main content — grows to fill space */}
  </CardContent>
  <CardFooter className="mt-auto pt-4">
    {/* Footer — always pushed to bottom */}
  </CardFooter>
</Card>

28.3 Rules
  ALL grid children that need equal height MUST use h-full flex flex-col
  The growing content area MUST have flex-1
  The footer/bottom section MUST use mt-auto
  NEVER use min-h-[Npx] to force equal heights — this causes excess whitespace
  NEVER use JavaScript to measure and sync heights — CSS handles this natively
