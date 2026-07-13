# SPEC-022: Mobile Trip CRUD over Atomic v1 Commands

**Date:** 2026-07-11
**Status:** Complete
**Author:** Codex
**Approved by:** Matt Carr, 2026-07-11 (full mobile parity instruction)
**Parent epic:** [EPIC-006 — Mobile-Web Capability Parity](../epics/EPIC-006-mobile-web-capability-parity.md)

## 1. Summary

Deliver the first write-capable parity journey: create, edit, and delete trips
from native mobile screens through bearer-aware, atomically idempotent v1
commands that call the existing application use cases.

## 2. Acceptance criteria

1. Shared schemas and generated OpenAPI describe `POST /api/v1/trips` and
   `PATCH`/`DELETE /api/v1/trips/{id}`, plus the read-only organization choices
   needed by create, using integer pence and closed enums.
2. Every command requires bearer auth and `Idempotency-Key`; same-key/same-body
   retries replay exactly, while same-key/different-body returns a closed
   conflict error.
3. Claim, canonical use-case mutation, and response record commit in one
   Postgres transaction per ADR 064, including concurrent-request tests.
4. Create validates organization membership; update collapses absent and
   inaccessible trips to neutral not-found; delete retains the existing
   owner/role rule.
5. Mobile can create a trip, edit name/budget/status, delete with destructive
   confirmation, and refresh/list/read back the same state.
6. A thin Maestro journey creates, edits, verifies, and deletes a uniquely
   named trip against the real backend; component/integration tests own edge
   states.
7. `trips.create`, `trips.update`, and `trips.delete` become `complete` in the
   parity ledger with web, mobile, and contract evidence.

## 3. Design

- Routes remain delivery adapters: parse shared schemas, authorize, execute the
  canonical `createTrip`, `editTrip`, or `deleteTrip` use case through the
  idempotent command executor, then return the standard envelope.
- Create explicitly accepts `organizationId`; mobile loads the user's
  organizations through the existing `getUserOrganizations` use case. The later
  organization slice supplies create/switch/member administration.
- Native forms use controlled text inputs, pence conversion at the boundary,
  closed status choices, inline errors, disabled pending state, stable test IDs,
  VoiceOver labels, and 44-point controls.
- Successful create navigates to detail. Successful edit refreshes detail and
  list data. Successful delete returns to the trips list.

## 4. Security and data

Membership/role checks run inside the same transaction as mutation. Neutral
not-found semantics prevent trip enumeration. Idempotency records key by user
and operation, store only request hashes and response JSON, and never contain
tokens or secrets.

## 5. Test plan

- Shared schema unit tests for valid/invalid pence, enums, names, and IDs.
- Real-Postgres executor integration tests for replay, conflict, concurrency,
  rollback, and user/operation key isolation.
- Route integration tests for auth, validation, membership/role isolation,
  canonical-use-case errors, success, and exact replay.
- RNTL tests for create/edit/delete states, accessibility, navigation, and API
  error mapping.
- Maestro golden write/read-back/delete journey against E2E fixtures.

## 6. Out of scope

Destination/fixed-cost CRUD (next SPEC in slice 3), organization creation and
switching (slice 7), offline queues, and bulk itinerary creation.

## 7. Rollback

Mobile routes/screens can be reverted while leaving the idempotency table and
executor unused. Migrations remain forward-only. No existing web behavior uses
the new routes.

## 8. Implementation order

1. [x] Shared schema tests, error vocabulary, and OpenAPI RED/GREEN.
2. [x] Idempotency repository/executor integration tests, schema migration, and
   composition-root wiring per ADR 064.
3. [x] Trip command route integration tests then minimal handlers.
4. [x] Mobile API/hooks and native screen component tests then UI.
5. [x] Maestro write journey and parity-ledger evidence.
6. [x] Full verification, architecture review, docs, and CI.

## 9. ADR and tech debt

[ADR 064](../decisions/064-atomic-idempotent-v1-command-execution.md) records the
transaction boundary. No existing tech-debt item is deferred into this slice.

---

## Implementation Deviations

| # | Deviation | Reason | Impact | Resolved? |
|---|-----------|--------|--------|-----------|

### Post-Implementation Notes

- CI run 29269377480 exercised create, update, status transition, and delete
  against the real backend. A post-update route race observed on the first
  attempt is guarded by waiting for the detail screen's edit control before
  beginning the delete pass.
- Architecture review confirmed that command routes reuse canonical use cases,
  unsafe retries cross the atomic ADR 064 executor, and mobile screens remain
  outside the web delivery boundary.
