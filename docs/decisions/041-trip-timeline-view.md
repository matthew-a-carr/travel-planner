# ADR 041: Trip Timeline View

**Date:** 2026-05-09
**Status:** Accepted

## Context

The trip detail page renders destinations as a vertical card list
(`src/ui/components/DestinationSection.tsx`). For a year-long round-the-world
trip with 15–25 stops the list scales poorly:

- Setting up the trip is one-card-at-a-time. There's no bulk import.
- Date relationships between stops (gaps, overlaps, transit days) are
  invisible unless the user manually scans the cards.
- `TripFixedCost` rows have a `date` field but never appear temporally — they
  show up only as a category list.

We needed a date-aware view that scales to 25+ stops, surfaces relationship
issues, and reduces setup friction.

## Decision

### Add a Timeline tab on the trip detail page

A second route segment `src/app/trips/[id]/timeline/page.tsx` mounted under
`/trips/{id}/timeline` and reached via a tab strip on the existing trip page
(`src/ui/components/TripTabs.tsx`). The Overview tab keeps the existing
budget cards, charts, and destination list unchanged.

### Three components on the timeline page

1. **Paste itinerary panel** — textarea + AI-driven extraction (see ADR 040)
   + editable preview + bulk-apply via the new `bulkAddDestinations` use case.
2. **Gantt** — horizontal date axis spanning min-start to max-end of all
   dated destinations. Each destination is a coloured bar (colour by comfort
   level). Fixed costs render as diamond pins above the bars at their `date`
   field. Undated destinations are listed in a separate rail beneath.
3. **Insights panel** — combined deterministic + AI findings (see ADR 040),
   grouped by severity.

### Deterministic findings live in the domain

`src/domain/timeline/timeline.ts` exports pure functions:

- `detectGaps` — flags > 1 day gaps between consecutive dated destinations.
- `detectOverlaps` — flags overlapping date ranges as `danger`.
- `flagBudgetVsReference` — flags estimated budget < 70% or > 200% of the
  country-reference suggestion (`src/domain/country-reference/`).
- `mergeFindings` — dedupes by `(stopId, kind)` so AI never duplicates a
  deterministic finding.

The use case `analyseTripTimeline` orchestrates: deterministic detectors run
first, then the AI insights service is called only for `seasonality` and
`transport-missing` (kinds the LLM can reason about and we cannot). Results
merge with deterministic priority.

### Bulk add reuses existing validation

`bulkAddDestinations` validates every candidate row through the existing
`validateNewDestination` (`src/domain/destination/destination.ts`), with the
running batch added to the cumulative budget calculation. Behaviour is
all-or-nothing: any single row failing validation rejects the whole batch and
saves nothing. This keeps the trip's budget invariant intact and gives the
user clear feedback to fix the offending row.

## Consequences

- New tab navigation primitive (`TripTabs`) usable for future per-trip views.
- New domain subpackage `src/domain/timeline/` with pure helpers and tests.
- New use case `bulkAddDestinations` co-located with its integration test.
- One new schema table (`ai_cache`) — see ADR 040.
- The Overview tab is untouched, preserving existing UX for users who don't
  need the timeline.

## Alternatives considered

- **Replace the destination list with the timeline** — too disruptive, and
  the list view is still better for spend-recording flows where you tap into
  a destination and add an entry.
- **Always-visible timeline at the top of the trip page** — visual noise on
  small screens; awkward when the trip has only 2–3 destinations.
- **Render fixed costs as their own bars** — they have a single date, not a
  range, and pinning them as diamonds above the bars conveys "instantaneous
  event" much better.
