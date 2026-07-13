# SPEC-023: Mobile Destination and Fixed-Cost CRUD

**Date:** 2026-07-11
**Status:** Complete
**Author:** Codex
**Approved by:** Matt Carr, 2026-07-11 (full mobile parity instruction)
**Parent epic:** [EPIC-006 — Mobile-Web Capability Parity](../epics/EPIC-006-mobile-web-capability-parity.md)

## 1. Summary

Complete the remaining trip-planning core on native mobile: stage-aware next
steps plus create, edit, and delete journeys for destinations and fixed costs,
using the atomic command boundary established by SPEC-022 and the existing
canonical application use cases.

## 2. Acceptance criteria

1. Shared schemas and generated OpenAPI publish country references and
   bearer-authenticated, idempotent destination/fixed-cost commands.
2. Child-resource commands collapse missing, mismatched-parent, and
   inaccessible resources to neutral not-found before mutation.
3. Destination create/edit supports country, optional city and coordinates,
   optional paired dates, comfort level, integer-pence allocation, and the
   existing budget/date invariants. Fixed-cost create/edit supports label,
   category, date, and positive integer pence.
4. Mobile detail shows the web-equivalent empty-stage next steps, destination
   and fixed-cost actions, inline budget/date feedback, destructive
   confirmation, and refreshed read-back after every mutation.
5. Country reference data drives the same deterministic comfort/date budget
   suggestion as web; users may override it.
6. Route and executor integration tests cover authorization, parent-child
   isolation, validation, exact replay, and rollback. Native component/service
   tests cover form and error states.
7. A real-backend Maestro journey creates, edits, verifies, and deletes one
   destination and one fixed cost; the seven slice-3 ledger capabilities become
   complete only after the macOS gate passes.

## 3. Design

- Add `GET /api/v1/countries` over `getCountryReferences`.
- Add nested command resources below `/api/v1/trips/{tripId}/destinations` and
  `/api/v1/trips/{tripId}/fixed-costs`; delivery adapters call existing use
  cases through `IdempotentCommandExecutor`.
- Extend the executor repository bundle only with the country-reference port
  needed for canonical validation. No route imports Drizzle.
- Use one native editor route per resource type; path value `new` selects create
  mode and a UUID selects edit/delete mode. Existing trip detail is the read
  model and source for edit defaults.

## 4. Security and data

All commands require `requireAuth`, membership in the parent trip's
organization, and opaque idempotency keys. Path child IDs must resolve to that
same parent. Responses and stored replay bodies contain no credentials. Money
remains integer GBP pence; date-only values remain `YYYY-MM-DD`.

## 5. Test plan

- Shared schema tests for closed enums, dates, coordinates, and pence.
- Real-Postgres route tests for each command and isolation/replay cases.
- RNTL tests for stage guidance, editors, validation, confirmation, and API
  failures.
- One Maestro create/edit/delete/read-back journey for both resource types.
- Full lint, type-check, unit, integration, OpenAPI, migration, build, and
  macOS mobile E2E gates.

## 6. Out of scope

Spend entry CRUD and financial charts (slice 4), itinerary/AI flows (slice 5),
and map-specific presentation. City geocoding remains a web enhancement; mobile
accepts optional coordinates but does not introduce a new geocoding provider.

## 7. Rollback

Native actions and nested routes can be removed without changing existing web
behavior. The shared idempotency table remains forward-compatible and unused by
removed operations.

## 8. Implementation order

1. [x] Shared schemas/OpenAPI and route integration tests.
2. [x] Minimal nested route adapters and executor repository extension.
3. [x] Native command services and editor component tests.
4. [x] Detail-stage guidance and native screens.
5. [x] Maestro journey and parity-ledger evidence.
6. [x] Full verification, architecture review, docs, and CI.

## 9. ADR and tech debt

ADR 064 already owns the atomic retry boundary; this slice introduces no new
architectural decision. No registered tech-debt item is deferred into it.

---

## Implementation Deviations

| # | Deviation | Reason | Impact | Resolved? |
|---|-----------|--------|--------|-----------|

### Post-Implementation Notes

- CI run 29269377480 passed the planning-core journey on its first attempt,
  proving destination and fixed-cost create/edit/delete plus stage guidance
  against exact fixtures and the real database.
- Country-reference suggestions remain server-calculated; mobile performs only
  presentation and deterministic day multiplication, so no pricing invariant
  was forked into the client.
