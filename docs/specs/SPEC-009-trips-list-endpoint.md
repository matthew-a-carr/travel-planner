# SPEC-009: `GET /api/v1/trips` — Trips List Endpoint

**Date:** 2026-05-31
**Status:** In Progress
**Author:** Claude (Opus 4.8) under Matt Carr direction
**Approved by:** —
**Parent epic:** [EPIC-002 — Mobile Read-Only Data](../epics/EPIC-002-mobile-read-only-data.md) (slice 1)

> Server-only slice. It exposes the authenticated user's trips as a list over
> the `/api/v1/*` surface so the mobile app can render a trips list (the mobile
> screen is **slice 3**, a separate SPEC). Inherits EPIC-002 §10 cross-cutting
> decisions and ADR 058 (read-only, reuse the ADR 056 envelope).

---

## 1. Summary

A new `GET /api/v1/trips` endpoint returns the trips visible to the
authenticated bearer caller — every trip in an organisation the user belongs
to — as an array of `TripSummary` objects, wrapped in the standard success
envelope (`{ data: TripSummary[], request, asof, version }`, ADR 056). Each
`TripSummary` carries the trip's own fields plus a **derived date range**
(earliest/latest destination dates) so the slice-3 list can show trip dates
per EPIC-002 §4. The wire shape is a new `tripSummary` schema in
`@travel-planner/shared`, and the endpoint is added to the generated OpenAPI
spec. Read-only; no pagination.

## 2. Motivation

EPIC-002 slice 1. Today the only `/api/v1/*` data endpoint is `/me` — the
mobile app can sign in but has no content. This endpoint is the server
foundation the mobile trips list (slice 3) consumes, and is independently
useful to any future client. It also establishes the pattern for reading a
domain aggregate over the bearer-authenticated v1 surface.

## 3. Acceptance criteria

1. **Given** a valid bearer token for a user who is a member of one or more
   organisations, **when** they `GET /api/v1/trips`, **then** the response is
   200 with body `{ data: TripSummary[], request, asof, version }`, where
   `data` contains exactly the trips in those organisations.
2. **Given** two users in different organisations each with trips, **when**
   each calls `GET /api/v1/trips`, **then** neither sees the other's trips
   (org-scoped visibility, reusing the existing membership rule).
3. **Given** a user who belongs to no organisation / has no trips, **when**
   they call the endpoint, **then** the response is 200 with `data: []`
   (empty list, not 404).
4. **Given** a trip whose destinations carry dates, **when** it is listed,
   **then** its `TripSummary.startDate` equals the earliest destination
   `startDate` and `endDate` the latest destination `endDate` (ISO 8601
   strings); **and** a trip with no destinations (or none carrying a given
   date) returns `null` for the corresponding field.
5. **Given** an invalid/absent bearer token, **when** they call the endpoint,
   **then** the response is 401 with the RFC 7807 + `code: "unauthenticated"`
   error envelope.
6. **Given** the `@travel-planner/shared` schemas changed, **when**
   `pnpm openapi:check` runs in CI, **then** it passes only if
   `docs/openapi/v1.yaml` includes the `/api/v1/trips` path + `TripSummary`
   component and was regenerated.
7. Integration tests assert criteria 1–5 against real Postgres.

## 4. Demo script

1. `pnpm dev`. Mint a dev token:
   `TOKEN=$(pnpm --filter @travel-planner/web auth:mint-token -- mattcarr@benifex.com 'Matt Carr' | tail -n1)`.
2. `curl -sH "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/trips | jq`.
   Expect 200 and:
   ```json
   {
     "data": [
       { "id": "…", "name": "Japan 2026", "status": "planning",
         "totalBudget": { "amountPence": 500000, "currency": "GBP" },
         "startDate": "2026-09-01", "endDate": "2026-09-21",
         "organizationId": "…", "updatedAt": "2026-05-30T…Z" }
     ],
     "request": { "method": "GET", "path": "/api/v1/trips", "path_params": {}, "query_params": {} },
     "asof": "…", "version": "1.1.0"
   }
   ```
3. `curl -sH "Authorization: Bearer bogus" …/api/v1/trips | jq` → 401 `unauthenticated` envelope.
4. Open `docs/openapi/v1.yaml` — `/api/v1/trips` GET present, responses ref `TripsListSuccessEnvelope` → `TripSummary`.

## 5. Out of scope

- **Trip detail** (`GET /api/v1/trips/{id}` with timeline + spend) — EPIC-002 slice 2.
- **Mobile trips list screen** — EPIC-002 slice 3.
- **Pagination / filtering / sorting** — unpaginated for v1 (EPIC-002 §10, Q3); `meta.pagination` reserved per ADR 056.
- **Writes / create / edit** — read-only per ADR 058.
- **Destination list, destination count, fixed costs, timeline, spend
  aggregates** on the summary. Only a **derived start/end date range** is
  included (the minimum required by the EPIC-002 §4 list demo — see §7).

## 6. Prerequisites

- EPIC-002 **Approved** (flipped in this PR).
- SPEC-008 envelope + OpenAPI generator (on `main`).
- Bearer auth + `requireAuth` + `respondWithData` helpers (on `main`, SPEC-002/008).

## 7. Design

### Data & domain

- New wire schema `tripSummarySchema` in `packages/shared/src/` (e.g. `trip.ts`),
  exported via the package index. Fields (the LIST projection of the domain
  `Trip` + a derived date range):
  - `id: string`
  - `name: string`
  - `status: 'planning' | 'active' | 'completed'`
  - `totalBudget: { amountPence: number; currency: 'GBP'|'USD'|'EUR'|'AUD' }`
  - `startDate: string | null` — ISO 8601; the **earliest** non-null
    `startDate` across the trip's destinations, else `null`.
  - `endDate: string | null` — ISO 8601; the **latest** non-null `endDate`
    across the trip's destinations, else `null`.
  - `organizationId: string`
  - `updatedAt: string` — ISO 8601.

  `startDate`/`endDate` are independently nullable: a trip with no
  destinations (or destinations carrying only one of the two dates) yields
  `null` for the missing side. Destination *count*, fixed costs, timeline and
  spend stay out (§5).
- Map domain `Trip` → `TripSummary` in the application layer (Money →
  `{amountPence, currency}`; `Date` → ISO string; date range derived from the
  trip's destinations, see Behaviour).

### Behaviour

- `GET /api/v1/trips`: `requireAuth(request)` → `listTripsForUser(userId)` →
  `respondWithData(request, summaries)`.
- New application use case `listTripsForUser(userId)`:
  1. `organizationRepository.findOrganizationsForUser(userId)` → org IDs.
  2. `tripRepository.findAllByOrganization(orgId)` for each org → the trips.
  3. `destinationRepository.findByTrips(tripIds)` — a new **batch** method
     (single `WHERE trip_id IN (…)` query) — to avoid an N+1 over trips. Group
     destinations by `tripId` in the use case and derive each trip's min
     `startDate` / max `endDate`.
  4. Map each `Trip` (+ its derived range) → `TripSummary`. Returns the DTOs.
- The use case still composes domain repositories (no bespoke joined-summary
  query); the only new repository surface is the batch `findByTrips`. See §14
  for the rejected alternatives (per-trip `findByTrip` N+1; a single joined
  `findTripSummariesForUser`).

### Storage & migrations

- None. Read-only over existing tables.

### External integrations

- None.

### UI / UX

- N/A — server slice (mobile UI is slice 3).

## 8. Security & data considerations

- **Org-scoped visibility is the load-bearing control.** The caller sees only
  trips in organisations they're a member of, via
  `findOrganizationsForUser` — the same rule the web uses. No per-endpoint
  reimplementation (EPIC-002 §10). Criterion 2's integration test is the guard.
- Bearer auth via `requireAuth` (rejects unauthenticated with the 401 envelope).
- `totalBudget` is the only potentially-sensitive field; it's the user's own
  org data, so in-scope for a member. No PII beyond what `/me` already exposes.
- The destination read (`findByTrips`) is keyed on trip IDs already resolved
  through the org-membership filter — it introduces no new exposure surface,
  and only the derived date range (not the destination rows) reaches the wire.
- No query params are trusted/echoed beyond the envelope's `query_params` echo.

## 9. Test plan

### E2E (Playwright / Maestro / etc)

- None new. (Mobile e2e arrives with the slice-3 screen. A web Playwright pass
  is not warranted for a bearer-only JSON endpoint.)

### Integration (Vitest + Testcontainers)

- `apps/web/src/app/api/v1/trips/route.int-test.ts` (new): success envelope
  shape + `data` is `TripSummary[]`; org-scoped visibility isolation (two
  users/orgs); empty list for a user with no trips; 401 on bad bearer;
  **date-range derivation** — a trip with dated destinations exposes
  min `startDate` / max `endDate`, a trip with none exposes `null`/`null`.
- `apps/web/src/application/use-cases/list-trips-for-user.int-test.ts` (new):
  the use case composes orgs → trips → destinations and maps to `TripSummary`
  (visibility + date derivation), against real Postgres.
- `drizzle-destination-repository.int-test.ts` (existing — extend): the new
  `findByTrips(tripIds)` batch method returns destinations for the given trips
  and only those (empty array for unknown/empty IDs).

### Unit (Vitest, Jest)

- `packages/shared/src/trip.test.ts` (new): `tripSummarySchema` parses a valid
  summary (including `startDate`/`endDate` present and `null`), rejects
  malformed (bad status, missing budget, non-ISO date).
- `apps/web/scripts/generate-openapi.test.ts` (existing — extend): asserts the
  `/api/v1/trips` path + `TripSummary` component are present and refs resolve.

### Manual checks

- `pnpm openapi:check` green after regeneration.
- Demo §4 `curl` against the dev server.

## 10. Observability

- Reuse existing `/api/v1/*` error logging (`console.error` + Sentry on the web
  side). No new metrics for a read endpoint.

## 11. Rollback / safety

- Purely additive (new endpoint + new schema + generated YAML). No migration,
  no behaviour change to existing endpoints. Revert the PR to remove.

## 12. Implementation order

1. **Intent:** Add `tripSummarySchema` + `TripSummary` type to
   `@travel-planner/shared` (incl. nullable ISO `startDate`/`endDate`); bump
   package as needed.
   **Verify:** `packages/shared/src/trip.test.ts` green; `pnpm type-check`.
2. **Intent:** Add `findByTrips(tripIds: string[]): Promise<Destination[]>` to
   `DestinationRepository` (domain interface) + the Drizzle implementation
   (single `WHERE trip_id IN (…)` query). Update existing repository mocks.
   **Verify:** `drizzle-destination-repository.int-test.ts` (batch read) green.
3. **Intent:** Add `listTripsForUser(userId)` use case — composes
   `findOrganizationsForUser` + `findAllByOrganization` + `findByTrips`; groups
   destinations by trip; derives min `startDate`/max `endDate`; maps to
   `TripSummary`.
   **Verify:** `list-trips-for-user.int-test.ts` (visibility + date derivation
   + mapping) green.
4. **Intent:** Add `GET /api/v1/trips/route.ts` (`requireAuth` →
   `listTripsForUser` → `respondWithData`), wired via the composition root.
   **Verify:** `route.int-test.ts` (criteria 1–5) green.
5. **Intent:** Add the endpoint to the OpenAPI generator (path + `TripSummary`
   + `TripsListSuccessEnvelope` component); run `pnpm openapi:generate`.
   **Verify:** `pnpm openapi:check` green; generator test asserts the path/component.
6. **Intent:** Full verification suite + docs (api-conventions vocabulary if a
   new code is introduced — none expected; CHANGELOG `## [Unreleased]`).
   **Verify:** `pnpm lint && db:check:migrations && type-check && test:unit && test:integration && openapi:check` green.
7. **Intent:** Close-out — triage notes, set status Complete, update EPIC-002
   §7 slice 1 row + ledger.

## 13. ADR triggers and tech-debt review

### ADR?

- No new ADR. Reuses ADR 056 (envelope), ADR 058 (read-only direction), and the
  established `/api/v1` conventions. No new library, no schema-strategy change,
  no non-obvious trade-off.

### Tech debt

- No new tech debt anticipated. The batch `findByTrips` removes the N+1 over
  trips for the date derivation; trips are still fetched per org via
  `findAllByOrganization` (audience-of-one, few orgs). If that fan-out or the
  trips→destinations join ever bites, a single joined
  `findTripSummariesForUser` query is the follow-up — flagged in §14, not
  pre-committed.

## 14. Risks & open questions

**Risks:** low — additive read endpoint reusing existing repos + the proven
envelope, plus one small new batch repo method. The main risk is getting
org-scoped visibility wrong (criterion 2's isolation test is the guard); a
secondary risk is mishandling the nullable date derivation for trips with no /
partially-dated destinations (criterion 4's test is the guard).

### Open Questions

_All three review-focus questions were resolved on PR #132 (interactive
review). No open questions remain. Resolutions recorded below for rationale._

1. **`TripSummary` field set — RESOLVED: include a derived date range.**
   *Decision:* the domain `Trip`'s own fields (`id`, `name`, `status`,
   `totalBudget`, `organizationId`, `updatedAt`) **plus** a derived nullable
   `startDate`/`endDate` (min/max over the trip's destinations). *Why:*
   EPIC-002 §4's list demo shows trip dates, and the `Trip` aggregate has none
   — deriving them in this slice (which owns the list contract) avoids a
   guaranteed follow-up. *Still rejected:* destination **count** and the
   destination list (no demo need; additive later per ADR 056 SemVer if a
   future UI wants them).
2. **`listTripsForUser` composition — RESOLVED: compose + batch destinations.**
   *Decision:* compose `findOrganizationsForUser` + `findAllByOrganization` in
   the use case, and add a batch `DestinationRepository.findByTrips(tripIds)`
   (one `IN` query) for the date derivation. *Rejected:* per-trip `findByTrip`
   (N+1 over trips), and a single joined `findTripSummariesForUser` (bespoke
   projection query — premature for audience-of-one). *Cost of wrong:* if the
   per-org trip fan-out bites at scale, the joined query is the additive
   follow-up (§13).
3. **`totalBudget` wire shape — RESOLVED: structured `{ amountPence, currency }`.**
   *Decision:* structured money-as-pence; the client formats. *Rejected:* a
   pre-formatted string (e.g. `"£5,000"`) — would force re-formatting and
   create locale issues. Consistent with the domain `Money` type.

## Implementation Deviations

> Populated at close-out. Rolling notes:
> `docs/implementation-notes/SPEC-009-trips-list-endpoint.md`.

| # | Deviation | Reason | Impact | Resolved? |
|---|-----------|--------|--------|-----------|
| 1 | _to be filled_ | | | |

### Post-Implementation Notes

_To be filled at close-out._
