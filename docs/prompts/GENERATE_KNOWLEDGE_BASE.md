# Knowledge Base — Document Generation Prompt

Purpose: Agnostic prompt for creating or updating the three permanent reference documents (ARCHITECTURE_CONVENTIONS.md, LIBRARY_RESEARCH.md, POLISHING_RULES.md) for any project. Works by scanning the actual codebase and deriving rules from real patterns found.

## Required Output Files

All documents go in: `/home/z/my-project/docs/research/`

- `ARCHITECTURE_CONVENTIONS.md`
- `LIBRARY_RESEARCH.md`
- `POLISHING_RULES.md`

## Prompt

```
=== PROJECT KNOWLEDGE BASE — DOCUMENT GENERATION ===

You are about to create or update three permanent reference documents for this project. These documents serve as the single source of truth for architecture decisions, technology choices, and polishing rules. They will be consumed by automated QA agents and future development sessions.

IMPORTANT: These documents must reflect the ACTUAL state of THIS project — not theoretical best practices, not patterns from other projects. Every rule, every violation, every convention must be backed by real code found in this codebase.

=== STEP 1 — SCAN THE PROJECT FIRST ===

Before writing anything, you MUST:

1. Read package.json to identify the full technology stack (framework, UI library, styling, state management, database, etc.)
2. Read the directory structure to understand the project architecture (ls -R or glob patterns)
3. Read the main layout, page files, and key components to identify current patterns
4. Read lib/, utils/, helpers/, types/ directories for shared code
5. Read components/ directory to identify component layers and naming conventions
6. Identify repeated patterns, duplicated code, and inconsistencies across views/routes
7. Identify hardcoded values, inline styles, mock data, and any anti-patterns
8. Check for existing docs in docs/research/ to update rather than overwrite

Target scan locations:
- package.json
- tsconfig.json
- tailwind.config.* or app/globals.css
- src/app/ or app/ (pages and layouts)
- src/components/ or components/ (all layers)
- src/lib/ or lib/ (utilities, helpers)
- src/types/ or types/ (type definitions)
- src/hooks/ or hooks/
- src/stores/ or stores/
- prisma/schema.prisma or any database config
- docs/research/*.md (existing docs to update)

=== STEP 2 — CREATE / UPDATE THE THREE DOCUMENTS ===

All documents go in: /home/z/my-project/docs/research/

---

DOCUMENT 1: ARCHITECTURE_CONVENTIONS.md

Purpose: The complete reference for how this project is built. Every architectural decision, component pattern, file organization rule, and coding convention.

Structure (adapt sections to what actually exists in the project — remove irrelevant sections, add new ones as needed):

# Architecture & Componentization Convention
- Project name, framework, stack, date
- Purpose and scope

§1 — Componentization Philosophy
- Layer hierarchy (primitives → enhanced → shared → features → layouts)
- Directory structure with real examples from THIS project
- Rules: no duplication, dependency flow direction, extraction threshold

§2 — className & Tokenization
- No raw generic classes
- Excessive className = new variant signal
- Token pattern (cva, cn(), clsx)
- Real examples from THIS project (good vs bad)

§3 — File Separation (.ts vs .tsx)
- Rule table: what goes in .ts vs .tsx
- Real file examples from THIS project
- Anti-patterns found

§4 — Dark/Light Theme
- Rules for theme tokens vs hardcoded colors
- Token mapping table
- Testing checklist
- Real violations found in THIS project

§5 — Z-Index Management
- Layer system with constants
- Rules for tooltips, popovers, modals, etc.
- shadcn/ui z-index overrides
- Real violations found in THIS project

§6 — Responsive Design
- Breakpoint table with target devices
- Testing requirements per breakpoint
- Mobile-first rules, touch targets, sidebar behavior

§7 — Internationalization (i18n)
- Supported languages and dictionary structure
- Fallback rules
- Implementation pattern
- Current status (implemented or not)

§8 — Unified Component Patterns
- One component per pattern: Modal/Dialog, Card, Accordion, Offcanvas/Sheet
- Good vs bad examples from THIS project
- Props contracts

§9 — Sidebar & Navigation
- Icon rules, collapsed behavior, responsive behavior
- Active/hover states

§10 — Data & State Management
- Real data only, no mocks
- Loading state patterns (skeletons)
- Empty state patterns
- State management approach (Zustand, Context, etc.)

§11 — Component File Structure
- Per-component organization (index.ts, barrel exports)
- Naming conventions

§12 — API Route Standards
- Response shape convention
- Error handling pattern
- HTTP status codes

§13 — Utility Centralization
- Which utilities MUST be shared and where they live
- Real violations found (local duplicates)

§14 — Color & Gradient System
- Standard color assignments for this project
- Gradient patterns
- Badge color conventions

§15 — Animation & Motion
- Variant naming standards
- Stagger values
- Duration limits
- Framer Motion or other animation library conventions

§16 — Quick Reference Table
- What goes where (concern → file type → location)

§17 — Anti-Pattern Checklist
- Complete list of things to verify before merging

Additional sections as needed:
- Self-fetching widget pattern (if applicable)
- Bypassing base UI components (if applicable)
- Seed data conventions (if applicable)
- Card height equalization (if applicable)
- Named exports rule (if applicable)
- Any project-specific patterns discovered during scan

---

DOCUMENT 2: LIBRARY_RESEARCH.md

Purpose: The technology stack analysis — what libraries are used, why they were chosen, what alternatives exist, and what the project conventions are for each.

Structure:

# Library Research & Stack Analysis
- Project name, date, purpose

For each library/package in the project:

## [Library Name]
- **What it does**: 1-2 sentence description
- **Version**: current version from package.json
- **Why it's here**: why this library was chosen over alternatives
- **How we use it**: actual usage patterns in THIS project (with file references)
- **Alternatives considered**: other options and why they weren't chosen
- **Known gotchas**: version-specific issues, breaking changes, configuration quirks
- **Convention**: the standard way to use this library in THIS project (code pattern)

Categories to cover:
- Core framework (Next.js, React, etc.)
- Styling (Tailwind, CSS-in-JS, etc.)
- UI Components (shadcn/ui, Radix, etc.)
- State Management (Zustand, TanStack Query, etc.)
- Database/ORM (Prisma, Drizzle, etc.)
- Animation (Framer Motion, etc.)
- Utilities (clsx, tailwind-merge, date-fns, etc.)
- Authentication (NextAuth, etc.)
- Forms (react-hook-form, zod, etc.)
- Charts/Visualization (Recharts, etc.)
- Icons (Lucide, etc.)
- Internationalization (next-intl, etc.)
- Any other library found in package.json

---

DOCUMENT 3: POLISHING_RULES.md

Purpose: The audit checklist for polishing UI and fixing cross-component inconsistencies. This is used by automated QA agents during review cycles.

Structure:

# Polishing & Cross-Component Audit Rules
- Project name, stack, date, purpose

## How to Use This Document
- Review flow (10-step checklist)

§1 — Componentization & Deduplication
- Extreme componentization philosophy
- For EACH duplicated pattern found: show the violation (file + line), show the required resolution (shared component with props)
- Checklist table: Pattern → Shared Component → Violation Files

§2 — className Tokenization
- Zero-tolerance for div soup
- Excessive className = new variant
- No template literals without cn()
- Audit checklist table with grep patterns

§3 — Utility Centralization
- For EACH local duplicate found: show the utility, canonical location, violation files
- Chart color arrays, animation variants, formatters — anything duplicated

§4 — Cross-View Consistency
- Card system consistency table (card type → component → when to use)
- Accordion/expandable pattern — unified or not
- Modal/Dialog pattern — unified or not
- Badge color convention table

§5 — Theme Harmony (Dark/Light)
- Zero hardcoded colors
- Theme token reference table
- Gradient banner exception
- Testing checklist (light + dark)

§6 — Z-Index & Overlap Management
- Layer system constants
- Detected violations table (file → component → current → required)

§7 — Responsive Expansion
- Breakpoint testing matrix
- Critical responsive rules
- Grid responsive patterns
- Common responsive mistakes table

§8 — Data Integrity (No Mocks)
- Real data only rule
- Skeleton patterns vs fake data
- Empty state patterns
- Seed data convention
- Type safety (no `any`)

§9 — File Architecture (.ts / .tsx Separation)
- Rule table
- Current compliance status per layer
- Type extraction violations
- Named exports rule

§10 — Internationalization (i18n)
- Language support, fallback rules, implementation
- Current status

§11 — Sidebar & Navigation Consistency
- Icon rules, collapsed behavior, active state

§12 — Animation & Motion Consistency
- Shared variants (import, never redefine)
- Variant naming convention
- Duration limits
- Best practices

§13 — Quick Reference Audit Checklist
- Checkbox list covering ALL previous sections
- Grouped by category

§14 — Priority Action Items
- Table of ALL detected violations sorted by priority (P0 → P3)
- Include: Priority, Violation, Files, Resolution

§15 — Pattern Decision Matrix
- Decision tree: when to extract a pattern vs keep inline
- Decision tree: when to create a variant vs keep className
- Decision tree: when to centralize a utility vs keep local

---

=== STEP 3 — VALIDATION ===

After generating all three documents:
1. Verify every file reference, component name, and path actually exists in the project
2. Verify every "violation" cited has a real corresponding code location
3. Verify the documents don't contradict each other
4. Verify all sections are grounded in REAL project code — delete any generic/theoretical content
5. If docs already exist, UPDATE them (preserve existing content, add new sections, fix outdated info) rather than overwrite
```
