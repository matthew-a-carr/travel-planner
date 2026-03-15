# ADR 037: Burndown Budget Pace Tracker

**Date:** 2026-03-15
**Status:** Accepted

## Context

ADR 006 introduced Recharts for trip budget visualisation and explicitly deferred a
"spend-over-time" line chart, noting it "requires destinations to have dates set and the data
becomes meaningful only mid-trip."

Travellers mid-trip repeatedly ask: "Am I spending too fast? Will my money last?" The existing
estimated-vs-actual bar chart answers what happened, not whether current pace is sustainable.
A burndown projection answers this directly.

## Decision

### Burndown as pure domain logic

All burndown calculations live in `src/domain/spending/burndown.ts` as pure functions with
zero external dependencies — no I/O, no async, no new database tables. Functions operate on
the existing `SpendEntry`, `Destination`, and `Trip` domain types.

Core functions:
- `calculateDailyPace` — average daily spend in pence
- `calculateTargetPace` — budget divided by total days
- `calculateBurndownProjection` — builds ideal, actual, and projected lines with pace ratio
  and projected exhaustion date
- `detectAlerts` — identifies over-pace, projected exhaustion, and single-day spike conditions
- `calculateTripBurndown` — aggregates across all dated destinations

### Alert thresholds (v1, hardcoded)

- Over-pace: daily spend exceeds target pace by 20%+ → warning
- Projected exhaustion: budget projected to run out before end date → danger
- Single-day spike: any day's total exceeds 2× target pace → warning

These thresholds are not user-configurable in v1. A future `trip_alert_preferences` table
could support customisation if needed.

### UI components

Three new components, following existing Recharts and Tailwind patterns:

| Component | Location | Purpose |
|-----------|----------|---------|
| `BurndownChart` | `src/ui/components/charts/BurndownChart.tsx` | Recharts `LineChart` with ideal/actual/projected lines |
| `BurnRateIndicator` | `src/ui/components/BurnRateIndicator.tsx` | Compact pace display per destination card |
| `BudgetAlertBanner` | `src/ui/components/BudgetAlertBanner.tsx` | Dismissable alert banner (session state) |

### Server-side computation

Burndown data is computed in the trip detail page server component and passed as serialised
props to client components — the same pattern used by all existing charts (ADR 006).

## Consequences

- Destinations without date ranges show no burndown UI. This is intentional — pace tracking
  requires a time dimension.
- Trip-wide burndown requires at least one destination with dates. Returns `null` otherwise.
- No new database tables, migrations, or external integrations. The feature layers entirely
  on existing data.
- Alert dismissal is per-session (React state). Alerts reappear on page reload. This avoids
  needing a new database table for a v1 feature — can be upgraded to persisted preferences later.
