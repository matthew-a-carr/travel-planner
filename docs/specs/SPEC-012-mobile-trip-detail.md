# SPEC-012: Mobile Trip Detail Screen — Timeline + Spend

**Date:** 2026-06-11
**Status:** Complete
**Author:** Claude (Fable 5) under Matt Carr direction (interactive session)
**Approved by:** — (drafted + implemented in the same interactive session; review on the EPIC-002 implementation PR)
**Parent epic:** [EPIC-002 — Mobile Read-Only Data](../epics/EPIC-002-mobile-read-only-data.md) (slice 4, **milestone**)

> Mobile-only slice and the epic's milestone: tapping a trip on the list
> opens a detail screen rendering the **timeline** (destination legs) and
> the **spend summary** (budget vs committed/spent), served by SPEC-010's
> composite `GET /api/v1/trips/{id}`. Read-only.

---

## 1. Summary

New route `app/(app)/trips/[id].tsx` + data hook
`src/trips/use-trip-detail.ts`. The screen shows: a header (back control +
trip name + status), the derived date range, a **Spend** card (total budget,
fixed costs, allocated, available — negative flagged — and recorded spend),
the **Timeline** (destinations in web order: dates, location, estimated
budget, per-destination spent, comfort level), and **Fixed costs** line
items. Pull-to-refresh; loading / error-with-retry / not-found states.

## 2. Motivation

EPIC-002 §4 line 3 — the milestone. With this slice the epic's definition
of done is fully implemented (server + both screens).

## 3. Acceptance criteria

1. **Given** a trip visible to the user, **when** they open
   `/trips/{id}` from the list, **then** the screen renders the trip name,
   status, date range, the spend summary (all five money figures +
   over-allocation flag), every destination leg (name/country, dates,
   estimated budget, spent), and every fixed cost (label, amount, date) —
   data from `GET /api/v1/trips/{id}` via `getAccessToken()` + `apiGet`.
2. **Given** the fetch is in flight, **then** a loading state renders.
3. **Given** the endpoint returns `not_found` (deleted trip / revoked
   access), **then** a dedicated not-found state renders with a control
   back to the list.
4. **Given** any other error, **then** an error state with Retry renders.
5. **Given** the detail is shown, pull-to-refresh re-fetches.
6. **Given** a trip with no destinations / no fixed costs, **then** the
   sections render explicit empty placeholders (no crash, no blank).
7. Jest + RNTL tests cover 1–6; `pnpm lint`, `pnpm type-check`, and the
   mobile Jest suite stay green.

## 4. Demo script

The epic §4 demo end-to-end: sign in → trips list → tap a trip → timeline +
spend → pull to refresh → back → profile → sign out. (Manual on Matt's
iPhone; CI's `mobile-e2e` keeps the sign-in smoke flow.)

## 5. Out of scope

Burndown chart / projections (web-only, epic §13 Q4); maps; editing; spend
entry line items; AI narrative.

## 6. Prerequisites

SPEC-010 endpoint + SPEC-011 list screen (this branch).

## 7. Design

- `src/trips/use-trip-detail.ts` — `useTripDetail(tripId)`:
  `{ status: 'loading' | 'not_found' } | { status: 'error'; message } |
  { status: 'loaded'; trip: TripDetail }` + `reload()` + `refresh()`.
  Same generation-counter + token-failure handling as `useTrips`;
  `error.code === 'not_found'` maps to the dedicated state.
- `app/(app)/trips/[id].tsx` — reads `id` via `useLocalSearchParams()`;
  ScrollView + RefreshControl. TestIDs: `trip-detail-root`,
  `trip-detail-{loading,error,retry,not-found,back}`,
  `trip-detail-spend`, `trip-detail-destination-<id>`,
  `trip-detail-fixed-cost-<id>`, empty placeholders
  `trip-detail-{timeline,fixed-costs}-empty`.
- Reuses `formatPence` / `formatDateRange` / `formatIsoDate` (SPEC-011).
- Comfort level renders as a label (`Budget`/`Mid-range`/`Luxury`).

## 8. Security & data considerations

Bearer via `getAccessToken()` only; no new storage. The server's 404
collapse (SPEC-010) means the screen can't distinguish deleted vs
no-longer-shared — the not-found copy stays neutral.

## 9. Test plan

Component/unit (Jest + RNTL): hook (loaded / not_found / error / token
failure / refresh) + screen states 1–6. Manual: §4 on-device.

## 10. Observability

None new.

## 11. Rollback / safety

Additive route; revert the PR to remove.

## 12. Implementation order

1. `use-trip-detail.ts` + hook tests → `pnpm test:mobile`.
2. `app/(app)/trips/[id].tsx` + screen tests → `pnpm test:mobile`.
3. `pnpm lint && pnpm type-check && pnpm test:unit`; docs (mobile
   AGENTS.md, CHANGELOG, indexes, epic ledger + milestone flag).

## 13. ADR triggers and tech-debt review

No new ADR (no new library; charting deferred — an RN charting ADR fires
only when a chart actually lands, per epic §16). Tech debt register: no
outstanding item touches this surface.

## 14. Risks & open questions

**Risks:** long timelines make a tall scroll (accepted; epic §15 flags
payload size on the server side first). Comfort/status copy is mobile-only
labelling — kept in `format.ts` so it's tested.

### Open Questions

None.

## Implementation Deviations

> Populated at close-out. Rolling notes:
> `docs/implementation-notes/SPEC-012-mobile-trip-detail.md`.

| # | Deviation | Reason | Impact | Resolved? |
|---|-----------|--------|--------|-----------|
| 1 | None — implemented as specified. | — | — | — |

### Post-Implementation Notes

- Jest passed while `tsc` failed on six missing StyleSheet keys — Babel
  strips types, so component tests alone don't prove type-safety; the
  repo's verification chain (type-check before commit) caught it.
- 119 mobile Jest tests green across 14 suites. The epic §3 definition of
  done is now fully implemented; physical-iPhone Expo Go validation
  (epic §4 demo) remains the manual pre-merge step.
