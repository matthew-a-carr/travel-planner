# ADR 045: Pre-departure Planning Helper

**Date:** 2026-05-15
**Status:** Accepted

## Context

The roadmap as originally drafted assumed users would have a back
catalogue of completed trips. The first real user of this product is
planning one big multi-country year-long trip ending on an Australia
working-holiday visa. They have ~zero completed trips, and the pain
sits entirely in the *pre-departure* phase that the product currently
does little to help with:

1. **Visas** — Australia WHV (~£455, age-gated, must be applied for
   before entry), e-visas for India / Vietnam / China etc.
2. **Vaccinations and health admin** — yellow-fever certs, malaria
   prophylaxis where relevant.
3. **Travel and health insurance** that covers a WHV.
4. **Banking** — fee-free debit / multi-currency cards.
5. **Inter-country flights** — long-haul legs (Bangkok → Sydney etc.)
   are usually the biggest single line items in a year-long itinerary.

Today the user has to research each one manually and add it as a
fixed cost. The model knows the typical shapes, costs, and lead times
for all five categories; the missing piece is a surface that asks the
model for the list, lays it out next to the trip, and lets the user
one-click materialise each suggestion into a real fixed-cost row.

This is **slice 6′** in `/root/.claude/plans/how-can-we-make-proud-toast.md`,
replacing the original slice 6 (cross-trip patterns) which no longer
fits the user's actual situation.

## Decision

Adopt a single **Pre-departure Planning Helper** — one AI port, one
panel — that produces a structured payload of two related kinds of
suggestion in one call, and surface them as a server-rendered panel
on the trip detail page. Each suggestion is one-click addable as a
fixed cost via the existing `addFixedCostAction`; the helper is a
*generator* layered on top of the existing fixed-cost surface, not a
parallel write path.

### Architecture

Mirrors the established AI port pattern from ADRs 040 / 043:

- **Port** `PreDeparturePlannerService.plan({ trip, destinations,
  fixedCosts, currentDate })` returns
  `{ items: ChecklistItem[]; transportLegs: TransportLeg[] }` or an
  error.
- **Real adapter** uses `generateObject` against the Vercel AI
  Gateway with a Zod schema enforcing field constraints and a
  conservatism-first system prompt (see below).
- **No-op adapter** returns an empty payload so the panel hides
  cleanly when `AI_GATEWAY_API_KEY` is unset.
- **Runtime-aware router** re-checks `hasAiCredentials()` per call.
- **Use case** `generatePreDeparturePlan` fetches the trip state,
  caches in `ai_cache` (`pre-departure-plan-v1`, 24 h TTL, key
  includes the same stable destination + fixed-cost fingerprint used
  by `analyse-trip-timeline.ts` plus a day-precision currentDate).
- **UI panel** renders both lists with per-row "Add as fixed cost"
  forms that post to the existing `addFixedCostAction(tripId, ...)`.
  Items already represented in `fixedCosts` (matched on label) render
  with a disabled "Already added" state; informational items
  without a cost render with a small "Dismiss" affordance only.

### Prompt rules — conservatism first

Visa, vaccination, and insurance suggestions are high-stakes. The
system prompt requires:

- **Verify-at-source phrasing.** Each visa/health/insurance item must
  carry a `verifyAt` value (`embassy` / `doctor` / `insurer`); the
  rendered suggestion must include "verify with the …" — mirroring
  the rule introduced by ADR 041 for the timeline `visa-required`
  finding kind.
- **Skip if unsure.** The model is instructed to omit rather than
  fabricate — same posture as the timeline insights.
- **No invented numbers.** When a cost is genuinely model-known
  (e.g. AWHV £455 at time of writing), include it; otherwise leave
  `costPence` null and let the user fill it in.
- **Suppress visa items** when a fixed-cost row of category `visas`
  already exists for the destination's country (best-effort match on
  the country name appearing in any existing visa-row label).

### Why one port over two

Earlier discussion considered shipping pre-departure checklist and
transport legs as two separate slices (A and B in the discussion).
Both consume the same trip-state snapshot and both produce
addable-as-fixed-cost suggestions. Combining them collapses the
architecture to one port, one adapter, one prompt, one cache key,
one panel. The UX cost is zero — both lists render in the same
panel as separate groups, which is what the user would see anyway.

### Reuse over new write-side use case

Each row's "Add as fixed cost" button is a `<form action={addFixedCostAction}>`
with hidden fields. No new use case, no new server action, no new
write surface to reason about. The category mapping
(`ChecklistCategory → FixedCostCategory`) lives in a small pure-domain
helper so it's testable.

## Consequences

- One new AI port, one use case, one panel. No migrations, no schema
  changes. The new port follows the same shape as
  `TripNarrativeService` (ADR 043), so the container wiring is a copy
  of the existing pattern.
- AI cost is one `generateObject` call per uncached trip-state per
  day. Cached for 24 h. Within the gateway quota envelope.
- The panel fails open: AI failure or no-credentials path returns an
  empty payload and the panel hides. Same behaviour as ADR 043.
- The reuse of `addFixedCostAction` means each added row participates
  in the existing budget-invariant check on the trip — if the
  proposed cost would push fixed-cost totals over headroom, the
  existing validation surfaces the failure exactly as it does for a
  manually-added cost.

## Alternatives considered

- **Ship A and B as separate slices.** Doubles the architecture for
  no UX gain. Rejected.
- **New bulk-add server action for fixed costs.** Would let an "Add
  all" button materialise the whole panel at once. Useful but adds a
  new validation surface (one big breach of the budget cap is
  different from N small ones); defer until we know one-by-one is
  too slow in practice.
- **Wrap the suggestions as a chat tool first instead of a panel.**
  Less discoverable. The chat tool wrapper is a follow-up once the
  panel proves the AI quality.
- **Cross-trip patterns (original slice 6).** Dropped — doesn't fire
  for users with ~zero completed trips.
- **Trip blueprint generator from goals.** Bigger slice; revisit once
  the planner panel proves the AI quality on the user's real data.
