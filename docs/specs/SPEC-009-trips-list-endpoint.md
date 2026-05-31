# SPEC-009: `GET /api/v1/trips` — Trips List Endpoint

**Date:** 2026-05-31
**Status:** Draft
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
envelope (`{ data: TripSummary[], request, asof, version }`, ADR 056). The
wire shape is a new `tripSummary` schema in `@travel-planner/shared`, and the
endpoint is added to the generated OpenAPI spec. Read-only; no pagination.

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
4. **Given** an invalid/absent bearer token, **when** they call the endpoint,
   **then** the response is 401 with the RFC 7807 + `code: "unauthenticated"`
   error envelope.
5. **Given** the `@travel-planner/shared` schemas changed, **when**
   `pnpm openapi:check` runs in CI, **then** it passes only if
   `docs/openapi/v1.yaml` includes the `/api/v1/trips` path + `TripSummary`
   component and was regenerated.
6. Integration tests assert criteria 1–4 against real Postgres.

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
- **Destinations, fixed costs, timeline, spend aggregates** on the summary (see §Open Questions).

## 6. Prerequisites

- EPIC-002 **Approved** (flipped in this PR).
- SPEC-008 envelope + OpenAPI generator (on `main`).
- Bearer auth + `requireAuth` + `respondWithData` helpers (on `main`, SPEC-002/008).

## 7. Design

### Data & domain

- New wire schema `tripSummarySchema` in `packages/shared/src/` (e.g. `trip.ts`),
  exported via the package index. Proposed fields (the LIST projection of the
  domain `Trip`): `id`, `name`, `status` (`planning|active|completed`),
  `totalBudget` (`{ amountPence: number, currency: 'GBP'|'USD'|'EUR'|'AUD' }`),
  `organizationId`, `updatedAt` (ISO string). See §Open Questions for the exact
  set (the domain `Trip` carries no date range or destination count — those
  live on `Destination`).
- Map domain `Trip` → `TripSummary` in the application layer (Money → `{amountPence, currency}`; `Date` → ISO string).

### Behaviour

- `GET /api/v1/trips`: `requireAuth(request)` → resolve the user's organisations
  via `organizationRepository.findOrganizationsForUser(userId)` → collect trips
  via `tripRepository.findAllByOrganization(orgId)` for each → map to
  `TripSummary[]` → `respondWithData(request, summaries)`.
- New application use case `listTripsForUser(userId)` composing the existing
  `findOrganizationsForUser` + `findAllByOrganization` repository methods (no
  new repository method — see §Open Questions). Returns the mapped DTOs.

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
- No query params are trusted/echoed beyond the envelope's `query_params` echo.

## 9. Test plan

### E2E (Playwright / Maestro / etc)

- None new. (Mobile e2e arrives with the slice-3 screen. A web Playwright pass
  is not warranted for a bearer-only JSON endpoint.)

### Integration (Vitest + Testcontainers)

- `apps/web/src/app/api/v1/trips/route.int-test.ts` (new): success envelope
  shape + `data` is `TripSummary[]`; org-scoped visibility isolation (two
  users/orgs); empty list for a user with no trips; 401 on bad bearer.

### Unit (Vitest, Jest)

- `packages/shared/src/trip.test.ts` (new): `tripSummarySchema` parses a valid
  summary, rejects malformed (bad status, missing budget).
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
   `@travel-planner/shared`; bump package as needed.
   **Verify:** `packages/shared/src/trip.test.ts` green; `pnpm type-check`.
2. **Intent:** Add `listTripsForUser(userId)` use case (composes
   `findOrganizationsForUser` + `findAllByOrganization`; maps to `TripSummary`).
   **Verify:** use-case integration test (visibility + mapping) green.
3. **Intent:** Add `GET /api/v1/trips/route.ts` (`requireAuth` →
   `listTripsForUser` → `respondWithData`).
   **Verify:** `route.int-test.ts` (criteria 1–4) green.
4. **Intent:** Add the endpoint to the OpenAPI generator (path + `TripSummary`
   + `TripsListSuccessEnvelope` component); run `pnpm openapi:generate`.
   **Verify:** `pnpm openapi:check` green; generator test asserts the path/component.
5. **Intent:** Full verification suite + docs (api-conventions vocabulary if a
   new code is introduced — none expected; CHANGELOG `## [Unreleased]`).
   **Verify:** `pnpm lint && db:check:migrations && type-check && test:unit && test:integration && openapi:check` green.
6. **Intent:** Close-out — triage notes, set status Complete, update EPIC-002
   §7 slice 1 row + ledger.

## 13. ADR triggers and tech-debt review

### ADR?

- No new ADR. Reuses ADR 056 (envelope), ADR 058 (read-only direction), and the
  established `/api/v1` conventions. No new library, no schema-strategy change,
  no non-obvious trade-off.

### Tech debt

- No new tech debt anticipated. (If `findAllByOrganization`-per-org proves a
  perf concern at scale, a `findAllForUser` repository method is the follow-up —
  noted in §Open Questions, not pre-committed.)

## 14. Risks & open questions

**Risks:** low — additive read endpoint reusing existing repos + the proven
envelope. The only real risk is getting org-scoped visibility wrong; criterion 2's
isolation test is the guard.

### Open Questions

1. **`TripSummary` field set.** *Chosen:* `id`, `name`, `status`, `totalBudget`
   (`{amountPence, currency}`), `organizationId`, `updatedAt` — the domain
   `Trip`'s own fields. *Rejected:* including a **date range** and
   **destination count**, which live on `Destination` and need an aggregate
   join. *Cost of wrong:* if the slice-3 mobile list design wants dates/counts,
   a follow-up adds them (backwards-compatible per ADR 056 SemVer — additive).
   *Recommend:* ship the Trip-only projection now; add aggregates if the list UI needs them.
2. **`listTripsForUser` composition.** *Chosen:* compose existing
   `findOrganizationsForUser` + `findAllByOrganization` in the use case.
   *Rejected:* a new `TripRepository.findAllForUser(userId)` (one joined query).
   *Cost of wrong:* N+1-ish reads if a user is in many orgs (unlikely — audience
   of one, few orgs). *Recommend:* compose now; add the repo method only if perf bites.
3. **`totalBudget` wire shape.** *Chosen:* structured `{ amountPence, currency }`
   (money-as-pence convention; client formats). *Rejected:* a pre-formatted
   string (e.g. `"£5,000"`). *Cost of wrong:* clients re-format / locale issues.
   *Recommend:* structured — consistent with the domain and with future
   currency/locale handling on the client.

## Implementation Deviations

> Populated at close-out. Rolling notes:
> `docs/implementation-notes/SPEC-009-trips-list-endpoint.md`.

| # | Deviation | Reason | Impact | Resolved? |
|---|-----------|--------|--------|-----------|
| 1 | _to be filled_ | | | |

### Post-Implementation Notes

_To be filled at close-out._
