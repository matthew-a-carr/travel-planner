# SPEC-010: `GET /api/v1/trips/{id}` — Trip Detail Endpoint

**Date:** 2026-06-11
**Status:** In Progress
**Author:** Claude (Fable 5) under Matt Carr direction (interactive session)
**Approved by:** — (drafted + implemented in the same interactive session; review on the EPIC-002 implementation PR)
**Parent epic:** [EPIC-002 — Mobile Read-Only Data](../epics/EPIC-002-mobile-read-only-data.md) (slice 2)

> Server-only slice. One **composite** detail endpoint (epic §13 Q1: one
> round-trip for the mobile milestone) returning the trip, its timeline
> (destinations as legs), and a spend **summary** (epic §13 Q4: budget vs
> committed/spent — the burndown chart stays web-only). Read-only; reuses
> the ADR 056 envelope and the SPEC-009 conventions.

---

## 1. Summary

`GET /api/v1/trips/{id}` returns a `TripDetail`: the SPEC-009 `TripSummary`
fields plus `destinations` (the timeline legs, with dates, estimated budget,
comfort level, and per-destination recorded spend), `fixedCosts` (the
committed line items), and `spend` (the budget summary the web header shows:
total / fixed / allocated / available / spent / over-allocated flag). Wrapped
in the standard success envelope. 404 `not_found` when the trip doesn't exist
**or** the caller isn't a member of its organisation (non-revealing, matching
the web's `notFound()` behaviour).

## 2. Motivation

EPIC-002 slice 2 — the data source for the mobile trip-detail screen
(slice 4, the epic milestone). Composes only existing domain reads.

## 3. Acceptance criteria

1. **Given** a valid bearer/cookie caller who is a member of the trip's
   organisation, **when** they `GET /api/v1/trips/{id}`, **then** 200 with
   `data: TripDetail` — trip fields per SPEC-009, `destinations` ordered as
   the web orders them (startDate, sortOrder, createdAt), `fixedCosts`, and a
   `spend` summary consistent with the web's `getTripBudgetSummary` +
   `calculateTotalSpend`.
2. **Given** a caller who is not a member of the trip's organisation,
   **when** they request it, **then** 404 `not_found` (no existence leak).
3. **Given** an unknown trip id, **then** 404 `not_found`.
4. **Given** no/invalid credentials, **then** 401 `unauthenticated`.
5. Per-destination `spent` equals the sum of that destination's spend
   entries; trip-level `spend.spent` equals the sum across the trip.
6. `docs/openapi/v1.yaml` regenerated with the new path + `TripDetail`
   components; `pnpm openapi:check` green.
7. Integration tests assert criteria 1–5 against real Postgres.

## 4. Demo script

`TOKEN=$(pnpm --filter @travel-planner/web auth:mint-token -- mattcarr@benifex.com 'Matt Carr' | tail -n1)`
then `curl -sH "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/trips/<id> | jq .data.spend`
→ `{ totalBudget, fixedCosts, allocated, available, spent, isOverAllocated }`.

## 5. Out of scope

- Burndown projection / alerts (web-only; epic §13 Q4) — a later slice if
  mobile wants charts.
- Spend entry line items, AI narrative, timeline findings, journey map.
- Sub-resource endpoints (`/trips/{id}/timeline`, `/trips/{id}/spend`) —
  split later only if payload size or independent refresh demands it.
- Writes; pagination.

## 6. Prerequisites

SPEC-009 (shared `tripSummary` schema, `findByTrips`, the `/api/v1/trips`
conventions) — on this branch.

## 7. Design

### Wire schemas (`packages/shared/src/trip.ts`)

- `tripDestinationSchema`: `id`, `name`, `country`, `city: string|null`,
  `startDate`/`endDate` (ISO date or null), `estimatedBudget: Money`,
  `comfortLevel: 'budget'|'mid'|'luxury'`, `sortOrder`, `spent: Money`.
- `tripFixedCostSchema`: `id`, `label`, `amount: Money`, `category`
  (the 13-value domain enum), `date` (ISO date), `sortOrder`.
- `tripSpendSummarySchema`: `totalBudget`, `fixedCosts`, `allocated`,
  `available`, `spent` (all `Money`), `isOverAllocated: boolean`.
- `tripDetailSchema`: the `tripSummary` shape extended with
  `destinations: tripDestination[]`, `fixedCosts: tripFixedCost[]`,
  `spend: tripSpendSummary`.

### Behaviour

- New use case `getTripDetailForUser(organizationRepository, tripRepository,
  destinationRepository, tripFixedCostRepository, spendEntryRepository,
  userId, tripId)` → `TripDetail | null`:
  1. `tripRepository.findById` → null when missing.
  2. `organizationRepository.findMembership(trip.organizationId, userId)` →
     null when not a member (the web's exact authorisation rule).
  3. Parallel `findByTrip` reads: destinations, fixed costs, spend entries.
  4. Reuse domain functions: `getTripBudgetSummary` (total/fixed/allocated/
     available/isOverAllocated) + `calculateTotalSpend` (trip and
     per-destination, grouping entries by `destinationId`).
  5. Map to the wire shape (dates → ISO strings, date range derived from
     destinations as in SPEC-009).
- Route `apps/web/src/app/api/v1/trips/[id]/route.ts`: `requireAuth` → use
  case via `getAppContainer()` → `respondWithData(request, detail,
  { pathParams: { id } })`, or `respondWithError(request, 'not_found')`.
- `calculateTotalSpend` returning `err` (mixed currencies — impossible under
  ADR 011's GBP-only data) is treated as an invariant breach: the use case
  throws, the route's catch-all answers 500 `internal`. Fail loud, not wrong.

### Storage / integrations / UI

None — read-only composition over existing tables; mobile UI is slice 4.

## 8. Security & data considerations

- Membership check is the load-bearing control, identical to the web page
  (`findMembership` → 404). Criterion 2's test is the guard.
- 404 (not 403) for non-members so trip-id existence isn't revealed.
- Payload exposes only the caller's own org data; no new PII.

## 9. Test plan

- **Integration** — `route.int-test.ts` (criteria 1–5: success shape,
  membership 404, unknown 404, 401, spend maths) and
  `get-trip-detail-for-user.int-test.ts` (visibility, composition, mapping,
  per-destination grouping) against real Postgres.
- **Unit** — `packages/shared/src/trip.test.ts` extended: `tripDetailSchema`
  valid/invalid parses. `generate-openapi.test.ts` extended: path +
  `TripDetail` component present, refs resolve.
- **Manual** — §4 curl.

## 10. Observability

Existing `/api/v1/*` error logging. Nothing new.

## 11. Rollback / safety

Purely additive; revert the PR to remove.

## 12. Implementation order

1. Shared schemas + unit tests → `pnpm --filter @travel-planner/shared test`.
2. `getTripDetailForUser` use case + int-test → `pnpm test:integration`.
3. Route + int-test → `pnpm test:integration`.
4. OpenAPI generator + regen + test → `pnpm openapi:check`.
5. Full verification + docs (CHANGELOG, indexes, epic ledger).

## 13. ADR triggers and tech-debt review

- No new ADR: reuses ADR 056/058 and SPEC-009 conventions; no new library or
  trade-off. Envelope stays `1.2.0` — both EPIC-002 endpoints ship in the
  same unreleased minor (ADR 056 §10 versions releases, not commits).
- Tech debt register reviewed: no outstanding item touches this surface.

## 14. Risks & open questions

**Risks:** payload growth for huge timelines (epic §15 — revisit composite
vs sub-resources if it bites); spend summary semantics drifting from the web
(mitigated by reusing `getTripBudgetSummary` rather than re-deriving).

### Open Questions

None — epic §13 Q1 (composite) and Q4 (summary) were resolved at epic
approval; field set mirrors what the web detail page already shows.

## Implementation Deviations

> Populated at close-out. Rolling notes:
> `docs/implementation-notes/SPEC-010-trip-detail-endpoint.md`.

| # | Deviation | Reason | Impact | Resolved? |
|---|-----------|--------|--------|-----------|
| 1 | _to be filled_ | | | |

### Post-Implementation Notes

_To be filled at close-out._
