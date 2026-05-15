# ADR 044: AI-Assisted Trip Creation

**Date:** 2026-05-15
**Status:** Accepted

## Context

The existing `CreateTripForm` asks for a name and a total budget — two fields
that are essentially placeholders the user invents before they know what the
trip actually looks like. Most users *think* of a trip as a sentence:
"three weeks in Vietnam from August, then Cambodia for ten days, then Laos and
Thailand till mid-October". That same sentence is exactly the input shape the
Timeline tab's `parseItineraryText` use case has been processing successfully
since ADR 040.

Today that capability is only reachable *after* the user has invented a name,
created the trip, and navigated to the Timeline tab. The cost of that detour is
high relative to its value:

- The user must guess a total budget before any per-country information is
  available. Country reference data could supply a sensible default — but only
  if it sees the destinations first.
- The first interaction with the product is a blank form. The "magic moment"
  the parser provides is gated behind the slowest, least informative step.
- An empty trip with a placeholder name and zero destinations sits in the
  database after every aborted attempt to plan something.

This is roadmap slice 5 of `/root/.claude/plans/how-can-we-make-proud-toast.md`,
which calls for an optional paste-to-create flow on the dashboard.

## Decision

Add a "Plan with AI" mode to the create-trip modal alongside the existing
manual form. The mode is a two-phase flow inside the same modal:

1. **Paste.** A single textarea takes the user's rough itinerary. On submit
   the server runs the existing `parseItineraryText` use case (now with
   `tripId` made optional so it can be called before any trip exists). The
   action enriches the parsed rows with country-reference budget suggestions
   and derives two further suggestions deterministically:
   - **Trip name** — a short label built from up to three unique countries
     joined with `→`, plus a month/year segment when dates are present.
     Four or more countries collapse to `A → B +N more`.
   - **Total budget** — sum of the per-row suggested budgets plus a 10%
     contingency, rounded up to the nearest £100. Suggested only when at
     least one row has a country-reference match; otherwise the user fills
     it in.
2. **Preview & submit.** The modal renders an editable row list (country,
   city, dates, comfort, budget) plus the suggested name and total budget
   in editable inputs. On submit the new `createTripWithDestinations` use
   case composes the existing `createTrip` and `bulkAddDestinations` use
   cases and redirects to `/trips/[id]`.

The pure-domain helpers (`suggestTripName`, `suggestTripBudgetPence`) live in
`src/domain/trip/trip-suggestion.ts` so they're unit-testable, reusable, and
add no AI port (no new model call, no new cache key — both heuristics derive
from data the parser already returns).

### Composed use case and compensating delete

`createTripWithDestinations` is intentionally a composer, not a third
implementation: it calls `createTrip` and `bulkAddDestinations` in order and,
on bulk-add failure, calls `tripRepo.delete(id)` to compensate. Drizzle
doesn't expose a cross-call transaction at this layer, so the compensating
delete is the closest thing to atomicity available without a domain-level
unit-of-work abstraction. The use case is the first to take this pattern;
future composers should follow it.

### Why the parser refactor is a parameter rather than a new use case

`parseItineraryText` originally required a `tripId`, used only for a
defensive trip-existence check. The create-flow has no trip yet. Two
options:

1. Fork into a second use case `parseItineraryForCreate` that omits the
   check. **Rejected** — duplicates the cache key, the enrichment logic,
   and the prompt boundary for the sake of a one-line guard.
2. Make `tripId` optional. **Chosen** — the use case keeps a single
   responsibility (parse + enrich + cache); the server action layer is
   the only place that needs to know which flow it's in, and it already
   does because it owns trip-access authorisation.

### Why no new AI port

The slice reuses `ItineraryParser` end-to-end. The deterministic
`suggestTripName` / `suggestTripBudgetPence` helpers earn their keep
without a model call — names of the form "Vietnam → Cambodia · Aug–Sep 2026"
are good enough that pulling another LLM in would be a net negative on
both cost and latency.

## Consequences

- One new use case, one new domain helper module, two new server actions,
  two new UI components, no migrations, no AI port. The new use case has a
  co-located `.int-test.ts` (per application-layer rule) covering the
  happy path, empty candidates, the compensating-delete rollback when
  bulk-add breaches the budget invariant, and trip-budget validation
  failure.
- `parseItineraryText`'s signature widens (`tripId` now optional). The
  existing timeline-tab call site is unchanged.
- The create-trip modal grows: a tab toggle and a second form. The modal
  is now `max-w-2xl` (was `max-w-lg`) to accommodate the row list.
- AI quota cost is bounded by the existing 7-day parser cache (ADR 040)
  and is consistent with the cost we already pay on the Timeline tab.
- The "Plan with AI" tab fails open: if the gateway is offline, the
  no-op parser returns an error and the user sees a friendly message
  thanks to ADR 040's runtime-aware router. The manual flow is always
  available next to it.

## Alternatives considered

- **Replace the manual form entirely with the AI flow.** Too aggressive
  — manual creation is still the right path when the user has zero idea
  and just wants a workspace.
- **Drive the auto-name and budget via a second AI call.** Higher cost,
  more failure modes, no meaningful quality lift over the deterministic
  heuristics.
- **Run the parse + create in one server action.** Simpler request shape,
  but loses the human review step on the parsed rows — and review is
  exactly the loop that catches the parser's confidence==low rows.
- **Use a separate dashboard route for the AI flow.** A second top-level
  route to learn for no gain; the modal already centralises trip creation.
