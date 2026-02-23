# ADR 007: Mobile-First Responsive Design and WCAG 2.1 AA Accessibility

**Date:** 2026-02-23
**Status:** Accepted

## Context

The travel planning application is used on the move — users are checking budgets, recording spend, and adding destinations while travelling. This means the primary interaction surface is a phone, not a desktop browser.

Additionally, the application must be accessible to users with disabilities. Accessible design is both the right approach and a product quality requirement.

No responsive or accessibility standard was explicitly stated in earlier ADRs. This ADR establishes that standard and documents the enforcement mechanism.

## Decision

### Responsive design

Adopt a **mobile-first** approach using Tailwind CSS responsive prefixes:

- Base styles target the smallest supported viewport (375px — iPhone SE).
- Larger-viewport overrides use `sm:` (≥640px), `md:` (≥768px), `lg:` (≥1024px).
- The three canonical viewports to test against are:
  - **375px** — mobile (iPhone SE, small Android)
  - **768px** — tablet (iPad Mini / iPad Air)
  - **1280px** — desktop (laptop / monitor)
- Two-column form grids must stack on mobile: `grid grid-cols-1 gap-4 sm:grid-cols-2`.
- All interactive elements must meet a minimum 44×44px touch target on mobile.

### Accessibility standard

**WCAG 2.1 Level AA** is the minimum bar.

Key requirements:
- All form inputs associated to a visible `<label>` via `htmlFor`/`id`.
- All interactive elements have an accessible name.
- Progress bars use `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`.
- No information conveyed by colour alone.
- Colour contrast: ≥4.5:1 for body text, ≥3:1 for large text and UI components.

### Automated enforcement

Install `@axe-core/playwright` (dev dependency) and create `tests/e2e/accessibility.spec.ts`:

- Runs axe audits on all key pages at all three canonical viewports.
- Public pages (landing, login) run unconditionally.
- Authenticated pages (dashboard, trip detail) are gated on `PLAYWRIGHT_AUTH_TOKEN` (same pattern as existing e2e tests).
- Violations cause the test to fail — treated identically to a unit test failure.
- The spec is part of the standard `pnpm test:e2e` run; no separate command needed.

## Consequences

**Easier:**
- Regressions in responsive layout or accessibility are caught automatically before they reach production.
- Future agents and engineers have a clear, testable standard to design against.
- Screen readers and keyboard-only users get a usable experience without extra effort at code review time.

**Harder:**
- Every new UI component must be reviewed for keyboard accessibility and colour contrast.
- Two-column layouts require explicit stacking rules for mobile — a small authoring overhead.
- axe audits add a few seconds to e2e test runtime (negligible).

**Files changed by this ADR:**
- `CONSTITUTION.md` — new section 8 (Mobile-First & Accessibility)
- `docs/decisions/007-mobile-first-accessibility.md` — this file
- `package.json` — `@axe-core/playwright` added to devDependencies
- `tests/e2e/accessibility.spec.ts` — new axe + viewport test file
- `src/ui/components/AddDestinationForm.tsx` — `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`
- `src/ui/components/RecordSpendForm.tsx` — `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`
- `src/app/trips/[id]/page.tsx` — progress bar `role="progressbar"` + aria attributes
- `src/ui/components/DestinationSection.tsx` — progress bar `role="progressbar"` + aria attributes
