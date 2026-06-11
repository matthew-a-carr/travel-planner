# SPEC-011: Mobile Trips List Screen

**Date:** 2026-06-11
**Status:** In Progress
**Author:** Claude (Fable 5) under Matt Carr direction (interactive session)
**Approved by:** — (drafted + implemented in the same interactive session; review on the EPIC-002 implementation PR)
**Parent epic:** [EPIC-002 — Mobile Read-Only Data](../epics/EPIC-002-mobile-read-only-data.md) (slice 3)

> Mobile-only slice. After sign-in the app lands on a **trips list**
> (EPIC-002 §4 line 1) showing each trip's name, dates, status, and headline
> budget figure (§4 line 2), fetched from SPEC-009's `GET /api/v1/trips` via
> `getAccessToken()` + the shared `apiClient`. Read-only.

---

## 1. Summary

The `(app)` landing route (`/`) becomes the trips list; the EPIC-001 Me
screen moves to `/me`, reachable from a profile button on the list header
(sign-out stays on the Me screen, unchanged). A new `src/trips/` module owns
the data hook (`useTrips`: loading / error / loaded states + refresh) and the
display formatting (money, date range). The list supports pull-to-refresh,
and renders explicit loading, error (with retry), and empty states. Items
navigate to `/trips/{id}` — the detail route lands in slice 4 (same PR).

## 2. Motivation

EPIC-002 slice 3 — the first data-bearing mobile screen; the epic's demo
lines 1–2.

## 3. Acceptance criteria

1. **Given** a signed-in user with trips, **when** the app lands on `/`,
   **then** each trip renders name, derived date range, status, and
   formatted total budget (data from `GET /api/v1/trips`, bearer obtained
   via `getAccessToken()`, envelope unwrapped by `apiGet`).
2. **Given** the fetch is in flight, **then** a loading state renders
   (no flash of "no trips").
3. **Given** the endpoint errors (or the bearer can't be obtained),
   **then** an error state with a Retry control renders; tapping Retry
   re-fetches.
4. **Given** the user has no trips, **then** an explicit empty state
   renders.
5. **Given** the list is shown, **when** the user pulls to refresh,
   **then** the list re-fetches (epic §4 line 4).
6. The Me screen (greeting, email, approval banner, sign-out) is unchanged
   in behaviour at its new `/me` route, reachable via the list's profile
   button; a back control returns to the list.
7. Jest + RNTL component tests cover 1–6; `pnpm type-check` and `pnpm lint`
   stay green. (Maestro: the existing `sign-in.yaml` smoke flow is
   unaffected; no new flow — CI runs no backend, so a signed-in list flow
   can't execute there, same constraint that scoped `me-screen` flows out
   of EPIC-001's CI.)

## 4. Demo script

Sign in on the iPhone → trips list with real data → pull to refresh →
profile button → Me screen → sign out (manual, Matt's device — routines
can't reach a physical phone).

## 5. Out of scope

Trip detail screen (slice 4); offline/caching; a data-fetching library
(plain hooks per epic §10); writes.

## 6. Prerequisites

SPEC-009 endpoint (this branch). EPIC-001 auth machinery (`main`).

## 7. Design

- `src/trips/use-trips.ts` — `useTrips()` hook:
  `{ status: 'loading' } | { status: 'error'; message } |
  { status: 'loaded'; trips: TripSummary[] }` plus `reload()` (full-screen
  spinner) and `refresh()` (pull-to-refresh, keeps stale list visible).
  Flow: `getAccessToken()` → failure maps to the error state —
  `apiGet('/api/v1/trips', z.array(tripSummarySchema), token)` → error
  state carries the RFC 7807 `detail` (or a generic fallback).
- `src/trips/format.ts` — `formatPence(money)` (symbol + thousands
  separators, pence shown only when non-zero) and
  `formatDateRange(startDate, endDate)` (`'1 Sep 2026 – 21 Sep 2026'`,
  one-sided `'From …'` / `'Until …'`, both-null `'Dates TBC'`).
  Deterministic, locale-independent (no Intl variance across Hermes/Node).
- `app/(app)/index.tsx` — trips list screen: FlatList + RefreshControl;
  testIDs `trips-screen-root`, `trips-screen-loading`, `trips-screen-error`,
  `trips-screen-retry`, `trips-screen-empty`, `trips-screen-profile`,
  `trips-screen-item-<tripId>`. Items are Pressable →
  `router.push('/trips/{id}')` (route lands in slice 4).
- `app/(app)/me.tsx` — the existing Me screen moved verbatim, plus a back
  control (`me-screen-back`).
- Tests under `__tests__/` mirroring the tree (never inside `app/`,
  ADR 053): hook tests (mock `get-access-token`, spy `fetch`), screen tests
  (mock `use-trips` + `expo-router`), moved Me tests, format tests.

## 8. Security & data considerations

Bearer only via `getAccessToken()` (refresh + single-flight preserved). No
new storage; trip data lives in component state only (no offline cache,
epic §6).

## 9. Test plan

Component/unit (Jest + RNTL): hook state machine incl. token failure and
API error; screen states 1–5; Me screen relocation (6); formatters. Manual:
§4 on-device. CI `mobile-e2e` keeps running `sign-in.yaml`.

## 10. Observability

None new (Sentry RN is deferred per ADR 058).

## 11. Rollback / safety

Additive UI; revert the PR to remove. The Me screen move is inside the same
PR — no intermediate broken state ships.

## 12. Implementation order

1. `src/trips/format.ts` + tests → `pnpm test:mobile`.
2. `src/trips/use-trips.ts` + hook tests → `pnpm test:mobile`.
3. Move Me screen to `/me` + back control; update its tests.
4. Trips list screen at `/` + screen tests.
5. `pnpm lint && pnpm type-check && pnpm test:unit`; docs (mobile
   AGENTS.md quick-reference + architecture, CHANGELOG, indexes, epic).

## 13. ADR triggers and tech-debt review

No new ADR (no new library — plain hooks per epic §10; no structural
change). Tech debt register: nothing touches this surface (TD-003 SDK pin
respected — no new native modules).

## 14. Risks & open questions

**Risks:** hook-level auth failure UX (an expired session shows the error
state rather than auto-signing-out; the next cold start lands on sign-in —
acceptable for read-only v1, noted for the editing epic).

### Open Questions

None — layout/states follow the epic demo script; conventions follow the
mobile AGENTS.md.

## Implementation Deviations

> Populated at close-out. Rolling notes:
> `docs/implementation-notes/SPEC-011-mobile-trips-list.md`.

| # | Deviation | Reason | Impact | Resolved? |
|---|-----------|--------|--------|-----------|
| 1 | _to be filled_ | | | |

### Post-Implementation Notes

_To be filled at close-out._
