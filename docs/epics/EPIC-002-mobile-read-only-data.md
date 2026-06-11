# EPIC-002: Mobile Read-Only Data — Trips on the Phone

**Date:** 2026-05-30
**Status:** Approved
**Strategic ADR:** [058 — Mobile Phase 2: Read-Only Data over the Existing Foundation](../decisions/058-mobile-phase-2-read-only-data.md)
**Owner:** Matt Carr
**Approved by:** Matt Carr, 2026-05-31

> Operationalises ADR 058. Builds directly on EPIC-001 (the iOS shell, auth,
> and `/api/v1/*` foundation, now Complete) and on SPEC-008 / ADR 056 (the
> standardised response envelope + generated OpenAPI). This epic makes the
> app *useful*: it surfaces the user's actual travel data on the phone.

---

## 1. Vision

The author opens the Travel Planner app on their iPhone (already signed in
from EPIC-001), and lands on a **list of their trips**. Tapping a trip opens
a **detail screen** showing that trip's **timeline** and **spend**. The data
is the same data the web app shows, fetched from the same use cases over
`/api/v1/*`. It is **read-only** — editing stays on the web for now.

## 2. Why now

EPIC-001 delivered an app that can sign in but shows only the user's identity.
The next increment of value is making it *do* something: show trips. The
server already has a rich `trip` / `timeline` / `spending` domain and ~50 use
cases; the envelope + shared-schema + OpenAPI machinery (SPEC-008 / ADR 056)
is in place. Exposing read endpoints and rendering them is incremental and
independently valuable (the endpoints serve any future client). See ADR 058
for the strategic framing (read-only first, stay Expo-Go, trips as the entry
point).

## 3. Definition of done

The epic is **Complete** when:

- [ ] `GET /api/v1/trips` returns the authenticated user's trips (envelope-wrapped),
      with a shared zod schema in `@travel-planner/shared` and the OpenAPI spec regenerated.
- [ ] `GET /api/v1/trips/{id}` returns a trip's detail including its timeline and spend.
- [ ] The mobile app shows a **trips list** screen after sign-in.
- [ ] Tapping a trip opens a **trip detail** screen showing timeline + spend (the milestone).
- [ ] All data is fetched via `getAccessToken()` + the shared `apiClient`, unwrapping the envelope.
- [ ] The web app behaves identically (no regression); all pre-existing tests stay green.

Editing, offline, native OAuth, EAS/TestFlight, Sentry RN, AI chat, push, and
maps are **not** the bar for this epic (see §6).

## 4. Demo script

1. Sign in on the iPhone (EPIC-001 flow) → land on the **trips list**.
2. The list shows each trip's name, dates, status, and headline budget figure.
3. Tap a trip → **trip detail** opens: the timeline (legs/segments) and the
   spend summary (budget vs committed/spent).
4. Pull to refresh re-fetches. Sign out still works (EPIC-001).
5. The web app, hit in parallel, shows the same trips unchanged.

## 5. Outcome / success criteria

1. Mobile and web both read trips via the same `application` use cases through
   `getAppContainer()` — no use case forked or duplicated.
2. New read endpoints follow ADR 056 (envelope), with wire schemas in
   `@travel-planner/shared` and the generated `docs/openapi/v1.yaml` updated
   (CI `openapi:check` green).
3. Trip authorisation on the API matches the web's existing rule (a user sees
   the trips they own / are shared via their organisation — ADR 029 / ADR 021's
   successor).
4. No mobile write path is introduced.

## 6. Non-goals

- **Writes / edits on mobile.** Read-only this phase (ADR 058). Editing is a later epic.
- **Native on-device OAuth (TD-004), EAS Build / TestFlight, Sentry RN + source maps (EPIC-001 slice 9).** All gated on the Apple Developer Program — deferred per ADR 058. Stay Expo-Go.
- **AI itinerary chat on mobile.** SSE streaming (ADR 042) — its own later slice/epic.
- **Maps on mobile.** The web uses Leaflet (ADR 035); a React Native map library is a deferred decision.
- **Offline mode / caching / conflict resolution.** ADR 045 parks this.
- **Push notifications (APNs).** Deferred with the ADP decision.

## 7. Vertical slices

| # | Slice | Demo line(s) | Becomes SPEC | Depends on | Budget | Status |
|---|-------|--------------|--------------|------------|--------|--------|
| 1 | `GET /api/v1/trips` (list) — use-case read path + shared `tripSummary` schema + OpenAPI regen + integration tests | 1–2 | [SPEC-009 (Complete)](../specs/SPEC-009-trips-list-endpoint.md) | — | 2d | Complete |
| 2 | `GET /api/v1/trips/{id}` (detail: trip + timeline + spend) — shared schema + integration tests | 3 | _not yet planned_ | 1 | 2–3d | Not started |
| 3 | Mobile **trips list** screen — `src/trips/` data hook + list UI + states (loading/empty/error) + tests | 1–2 | _not yet planned_ | 1 | 2–3d | Not started |
| 4 | Mobile **trip detail** screen — timeline + spend rendering (**milestone slice**) | 3 | _not yet planned_ | 2, 3 | 3–4d | Not started |

SPECs are drafted lazily by `draft-spec` (from a `claude:plan` issue) when each
slice is ready. Slices 1–2 (server) can run ahead of / parallel to 3.

## 8. Sequencing rationale

Server endpoints (1, 2) come first because the mobile screens (3, 4) consume
them and the e2e demo needs real data. Slice 1 (list) unblocks the list screen
(3); slice 2 (detail) + slice 3 unblock the milestone detail screen (4). The
list endpoint + list screen alone deliver visible value early (you see your
trips) before the richer detail screen lands.

## 9. Kill / pivot criteria

- **Kill** if exposing trip reads over `/api/v1/*` requires forking a use case
  (i.e. the `application` layer can't serve a non-RSC caller cleanly) — that
  would invalidate ADR 045's core premise and warrants a strategic rethink.
- **Pivot to detail-first** if the trips list proves too thin to be a useful
  standalone milestone (unlikely — list is the natural entry).
- **Pause** if read authorisation can't be expressed safely for a bearer
  caller without duplicating the web's session-scoped checks.

## 10. Cross-cutting decisions

| Decision | Choice | Rationale |
|---|---|---|
| Transport / envelope | Reuse ADR 056 envelope; new endpoints return `{ data, request, asof, version }`. | One contract; OpenAPI regen covers them. |
| Wire schemas | New `tripSummary` (list) + `tripDetail` (incl. timeline + spend) schemas in `@travel-planner/shared`. | Same source-of-truth pattern as SPEC-005. |
| Authorisation | Bearer caller sees the same trips as the web session (owner + org-shared). Reuse the existing authz checks in the use-case layer; do not reimplement per-endpoint. | No divergence between clients. |
| Data fetching (mobile) | New `src/trips/` modules using `getAccessToken()` + `apiClient`; React state/hooks, no new data library yet. | Smallest surface; matches EPIC-001 conventions. |
| Pagination | List returns all of the user's trips unpaginated in v1 (audience-of-one, low N); `meta.pagination` reserved (ADR 056) for when N grows. | Avoid speculative pagination; revisit at the first large list. |
| Money / dates on the wire | Money as integer pence + currency (existing domain); dates/timestamps as ISO strings (envelope convention). | Consistent with the domain + envelope. |

## 11. External dependencies & constraints

- Expo-Go-only (ADR 053 / TD-003) — no native modules beyond what EPIC-001 uses.
- No new vendor or paid service. No Apple Developer Program (ADR 058).

## 12. Cost & budget

~9–12 focused days across 4 slices. No incremental infra/vendor cost.

| Item | Cost | When | Status |
|---|---|---|---|
| Apple Developer Program / EAS | $99/yr + setup | Deferred (ADR 058) | **Not in this epic** |
| Sentry RN seat | Existing plan | Deferred with EPIC-001 slice 9 | **Not in this epic** |

## 13. Open questions

> Resolved on the EPIC PR / at slice grilling. Each leads with a recommendation.

1. **Trip-detail endpoint composition — one `GET /trips/{id}` returning trip + timeline + spend, vs separate sub-resource endpoints (`/trips/{id}/timeline`, `/trips/{id}/spend`)?** *Recommend one composite detail endpoint for the mobile milestone (one round-trip, simpler screen); split into sub-resources later if payload size or independent refresh demands it.* Cost of wrong: a second endpoint and a mobile re-fetch later.
2. **Exact trip-authorisation rule for a bearer caller.** **RESOLVED (2026-05-31, slice 1 / SPEC-009):** reuse the web's existing org-scoped visibility — the caller sees trips in the organisations they're a member of (`organizationRepository.findOrganizationsForUser`), no per-endpoint reimplementation. (Note: visibility is org-membership-based; the original "owner + org-shared" wording is subsumed by org membership.)
3. **Pagination now vs deferred.** **RESOLVED (2026-05-31, slice 1 / SPEC-009):** deferred — unpaginated list for v1; `meta.pagination` reserved per ADR 056 (additive when needed).
4. **Spend representation on the detail screen — full burndown vs a summary?** *Recommend a summary (budget vs spent/committed) for the milestone; the burndown chart is a richer later slice (charting on RN is its own decision).* Cost of wrong: a follow-up slice.

## 14. Parking lot

Editing/writes on mobile · AI chat (SSE) on mobile · maps (RN map lib) · charts (RN charting) · offline/caching · the deferred EPIC-001 slice 9 (Sentry RN) and TD-004 (native OAuth) — all revisited when ADP funding / a second consumer makes them concrete.

## 15. Risks

- **Authz drift** between bearer and session callers (mitigated by reusing use-case checks, slice-1 integration tests asserting visibility).
- **Detail payload size** if a trip has a large timeline (mitigated by the summary-first spend choice; composite endpoint revisited if large).
- **Rendering richness** — timeline/spend on a small screen may need design iteration (milestone slice budgets for it).

## 16. ADR triggers

Likely ADRs this epic surfaces: a React Native data-fetching/caching approach (if hooks prove insufficient), an RN charting library (spend visualisation), and trip read-authorisation for bearer callers (if it diverges from the web rule). Numbers claimed at write time.

## 17. References

- [ADR 058 — Mobile Phase 2: Read-Only Data](../decisions/058-mobile-phase-2-read-only-data.md) (strategic ADR)
- [ADR 045 — iOS App Strategy](../decisions/045-ios-app-strategy.md) (now Accepted)
- [ADR 056 — REST API Response Envelope and OpenAPI](../decisions/056-api-response-envelope-and-openapi.md)
- [EPIC-001 — iOS App](./EPIC-001-ios-app.md) (Complete; foundation)
- Domain: `apps/web/src/domain/{trip,timeline,spending}/`; use cases in `apps/web/src/application/use-cases/`

## Slice ledger (append-only)

| Date | Slice | SPEC | Status | Notes |
|------|-------|------|--------|-------|
| 2026-05-30 | — | — | Drafted | EPIC-002 drafted (interactive, under ADR 058). Awaiting human review of §13 Open Questions + slice table. |
| 2026-05-31 | — | — | Approved | Approved by Matt. §13 Q2 (bearer trip-authz → reuse org-scoped visibility) + Q3 (pagination → deferred) resolved for slice 1; Q1/Q4 left open for slices 2/4. |
| 2026-05-31 | 1 | SPEC-009 | Draft | Slice 1 (`GET /api/v1/trips`) drafted as SPEC-009. |
| 2026-06-11 | 1 | SPEC-009 | Complete | Implemented on the single EPIC-002 impl branch (PR number recorded at epic close-out). |

## Epic-level deviations

_None yet._

## Post-epic notes

_To be written when the epic closes._
