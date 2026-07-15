# SPEC-024: Mobile Spend and Financial Insight

**Date:** 2026-07-11
**Status:** Complete
**Author:** Codex
**Approved by:** Matt Carr, 2026-07-11 (full mobile parity instruction)
**Parent epic:** [EPIC-006 — Mobile-Web Capability Parity](../epics/EPIC-006-mobile-web-capability-parity.md)

## 1. Summary

Mobile travellers can record, edit, and remove destination spend, then see the
same category totals, budget pace, projected exhaustion, and budget warnings
as the web application. Every mutation is retry-safe and every insight is
computed by the existing domain implementation.

## 2. Acceptance criteria

1. Shared schemas and generated OpenAPI publish an authenticated
   `GET/POST /api/v1/trips/{tripId}/spend` resource plus idempotent
   `PATCH/DELETE /api/v1/trips/{tripId}/spend/{entryId}` commands.
2. Missing, inaccessible, wrong-trip, and wrong-destination resources collapse
   to neutral not-found before reads or mutations; invalid money/category/date
   inputs return the standard validation envelope.
3. The financial read model lists spend newest-first and returns category
   totals, trip-wide burndown lines, daily/target pace, projected exhaustion,
   and alerts from `domain/spending` without duplicating formulas in routes or
   mobile.
4. Mobile trip detail links to a native finance screen with accessible summary,
   category bars, budget alerts that can be dismissed for the current view,
   and empty/unavailable states equivalent to web.
5. Native create/edit forms support destination, positive integer GBP pence,
   closed category, optional description, and calendar date; destructive delete
   requires confirmation and every successful command refreshes server state.
6. Real-Postgres tests cover authorization, tenant/parent isolation, exact
   replay, conflict, and rollback. Unit/component tests cover formatting,
   forms, alerts, charts, error states, and canonical-header behavior.
7. A real-backend Maestro journey creates, edits, verifies the category/pace
   read-back, deletes spend, and restores the empty state. Slice-4 manifest
   entries become complete only after the macOS gate passes.

## 3. Design

- Add wire spend-entry and financial-insight schemas to
  `@travel-planner/shared`; dates are ISO date/time strings and money remains
  integer GBP pence.
- Add `getTripFinancialsForUser` in the application layer. It authorizes through
  organization membership, loads destinations/spend, and delegates totals,
  burndown, and alert calculations to the existing pure spending domain.
- Extend ADR 064's transaction repository bundle with `SpendEntryRepository`.
  Nested routes use existing `recordSpend`, `editSpendEntry`, and
  `deleteSpendEntry` use cases inside that atomic executor.
- Add one native finance route and one `new|entryId` editor route. Accessible
  proportional bars use React Native `View` primitives and textual values; no
  third-party chart package is introduced.

## 4. Security and data

Bearer auth, organization membership, trip/destination parent checks, and
opaque idempotency keys are mandatory. Descriptions are plain text rendered by
React Native. No new secrets, persistence tables, currencies, or external
services are introduced.

## 5. Test plan

- Shared schema/unit tests for categories, dates, entries, projections, alerts,
  and empty/unavailable financial states.
- Application and route integration tests against real PostgreSQL for the read
  model and all commands, including replay/isolation/rollback.
- Jest/RNTL tests for command service, finance screen, editor validation,
  accessible bars, dismissible alerts, and delete confirmation.
- Maestro create/edit/category-read-back/delete journey through the real
  tunnel-backed CI backend.
- Full lint, type-check, unit, integration, OpenAPI, migration, production
  build, parity validator, and macOS mobile E2E gates.

## 6. Out of scope

Multiple currencies, receipt images, offline command queues, persisted alert
dismissal, analytics telemetry, and AI/timeline features. The web chart's exact
pixels are not copied; equivalent values and accessible relationships are.

## 7. Rollback

Remove the native screens and nested routes. No schema migration is required;
existing web spend rows remain untouched. The shared idempotency table and
executor extension remain backward-compatible.

## 8. Implementation order

1. [x] Shared schemas, read use case tests, route integration tests, OpenAPI.
2. [x] Minimal read route and financial domain-to-wire mapping.
3. [x] Atomic spend command route tests and executor repository extension.
4. [x] Native command service and finance/editor component tests.
5. [x] Native screens, Maestro journey, and in-progress parity evidence.
6. [x] Full verification, architecture review, docs, and CI.

## 9. ADR and tech debt

ADR 063 owns shared-contract parity and ADR 064 owns atomic idempotency. Native
accessible bars use existing platform primitives, so no new ADR is required.
TD-010 was the authoritative CI gate and is resolved by run 29269377480.

---

## Implementation Deviations

| # | Deviation | Reason | Impact | Resolved? |
|---|-----------|--------|--------|-----------|

### Post-Implementation Notes

- CI run 29269377480 passed spend create/edit/delete, category totals,
  burndown, and alert dismissal on its first attempt against the real backend.
- Failure artifacts from runs 29260214856 and 29264501830 exposed controls
  clipped under the navigation header and rows pushed below the viewport after
  alert regeneration. Centered `scrollUntilVisible` guards now keep both
  post-mutation edit passes deterministic.
