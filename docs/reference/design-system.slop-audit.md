# FinanceApp AI-Slop Audit v2

## Inputs

- `docs/reference/design-system.html`
- `docs/reference/design-system.contract.md`
- `src/app/page.tsx`
- `src/app/globals.css`
- `src/components/finance/*`
- `src/components/ui/*`
- existing QA screenshots under `download/`

## Runtime Evidence Limitation

This rerun still treats historical screenshots as auxiliary evidence only. The current environment did not have a verified live FinanceApp browser session in this run. Any implementation closure must recapture current runtime light and dark screens before claiming source-accurate visual parity.

## Overall AI / Genericity Score

`51 / 100`

The product itself is richer than the first premium artifact showed. FinanceApp has enough domain depth and component surface to support a real premium theme system. The remaining AI smell is not lack of components; it is visual convergence risk: gradients, violet AI cues and card-heavy composition can still collapse into generic finance SaaS if not tokenized and governed.

## First Premium Artifact Regression

The previous `design-system.premium-direction.html` was visually strong in light mode, but failed as a complete generator reference:

1. Dark mode appeared as an isolated vault block instead of an equivalent sibling theme.
2. Component coverage was too narrow for the local shadcn/Radix catalog.
3. The artifact proved atmosphere, not enough implementation breadth.
4. It did not clearly separate immutable component anatomy from theme tokens.

## Detection Matrix

| Signal | Score | Evidence | Required Correction |
| --- | ---: | --- | --- |
| Purple/violet default bias | 58 | AI bar, avatar, accounts/installments gradients | Violet reserved for AI/automation trace |
| Generic gradient language | 64 | many `from-* to-*`, gradient orbs, hero-shift | Semantic finance tokens, restrained accents |
| Raw shadcn leakage | 50 | broad primitive set available | Use shadcn/Radix as coverage checklist, not identity |
| Card soup risk | 60 | many dashboard widgets | Distinguish summary cards, ledger rows and analytics panels |
| Typography personality | 48 | Geist/system, safe weights | Use hierarchy and mono amounts to create financial character |
| Brand specificity | 43 | FinanceApp generic name and sparkles | Private ledger / local-data trust posture |
| Motion intentionality | 58 | many CSS animation helpers | Keep motion tied to state, search, loading and active navigation |
| Premium materiality | 47 | glass/card effects present but broad | Ledger/vault material system |
| Dark-mode parity | 72 | previous premium dark block discrepant | Token-derived sibling theme required |
| Component-kit breadth | 76 | local catalog broad, first gallery thin | Theme showroom expected, not moodboard |

## Concrete Findings

1. FinanceApp should be treated as a themeable product system, not just a dashboard redesign.
2. Light mode can carry the daily ledger metaphor: warm, calm, readable and operational.
3. Dark mode should carry analysis and sensitive data, but keep the same anatomy and semantic colors.
4. The component catalog is broad enough that premium direction must prove forms, overlays, feedback, tables, loading, empty states and controls.
5. Historical screenshots are useful for baseline, but current runtime recapture is required before final implementation decisions.

## Priority Corrections

1. Replace isolated dark samples with `Light vs Dark System` proof.
2. Make `design-system.premium-direction.html` a component/theme showroom.
3. Add explicit token-vs-anatomy separation.
4. Treat source-observed and available-in-code primitives differently.
5. Reserve violet for AI and automation, not broad finance trust.
6. Use semantic accents consistently in both modes.

## Benchmark References

Use as principles, not identities:

- Bootstrap / mature theme kits: breadth, state coverage and themeability.
- shadcn/Radix kits: primitive inventory and composability.
- Wise / Revolut: money semantics and trust-first finance density.
- Linear / Raycast: command density and disciplined state language.
- Apple / BMW: material restraint and confidence through spacing.

## Judgment

- Source-truth extraction: pass with runtime limitation.
- First premium artifact: visually promising but not closable because dark and component breadth were insufficient.
- Premium v2 requirement: mandatory dual-theme parity plus broad component-kit coverage before implementation handoff.
