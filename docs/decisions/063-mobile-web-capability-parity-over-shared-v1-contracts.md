# ADR 063: Mobile-Web Capability Parity over Shared v1 Contracts

**Date:** 2026-07-11
**Status:** Accepted

## Context

The web application is the complete delivery surface. The iOS application
currently exposes authentication, a trips list, read-only trip detail, and
sign-out. ADRs 058 and 059 deliberately sequenced mobile as read-only data
followed by spend-only writes; ADR 059 explicitly left trip, destination, and
fixed-cost editing on the web. That direction no longer matches the product
goal: the mobile application must now provide every user capability available
in the web application and prove that parity end to end.

Literal component or layout parity would duplicate Next.js delivery code in
React Native and couple unlike platforms. The durable invariant is capability
parity: the same authorised user can achieve the same domain outcome and see
the same persisted result on either client, using platform-native interaction
patterns.

## Decision

The iOS application will reach and retain capability parity with the web
application through the canonical `/api/v1/*` boundary.

1. The domain and application layers in `apps/web` remain the single
   implementation of business rules. Web server actions and v1 route handlers
   are delivery adapters over the same use cases; mobile never reimplements
   domain validation.
2. Every capability shared by web and mobile is exposed through a bearer-aware
   v1 endpoint. Wire schemas live in `packages/shared`, the OpenAPI document is
   generated from those schemas, and CI fails on drift. Unsafe operations use
   `Idempotency-Key` and replay the original result.
3. A machine-checked capability manifest is the parity ledger. Each web
   capability has a stable identifier, its web evidence, its mobile evidence,
   its API contract where applicable, and one of `missing`, `in_progress`, or
   `complete`. CI rejects a `complete` capability whose referenced evidence is
   absent and rejects release parity while any in-scope capability is not
   complete.
4. Parity is behavioural, not visual. Mobile uses native navigation, sheets,
   gestures, Dynamic Type, VoiceOver, and 44-point touch targets. Platform-only
   mechanics may differ, but domain outcomes, authorisation, persisted data,
   and error semantics line up one-to-one.
5. Verification follows the test pyramid: domain unit tests, real-Postgres use
   case and route integration tests, React Native component tests for states
   and accessibility, and a thin Maestro journey for each shipped user journey
   against the real backend. The authenticated E2E blocker in TD-010 must be
   resolved before parity features are widened.
6. Administrative capabilities are in scope. A user's role may hide a feature,
   but any capability available to that role on web is available on mobile.

### Alternatives considered

- **Share web UI code with React Native.** Rejected because the delivery
  frameworks, navigation, accessibility primitives, and interaction patterns
  differ; forced reuse would create a shallow cross-platform abstraction.
- **Duplicate server actions as mobile-specific business logic.** Rejected
  because it creates two authorities for invariants and guarantees drift.
- **Declare parity manually in prose.** Rejected because parity is a rule worth
  keeping and therefore requires mechanical enforcement (P14).

## Consequences

The same domain capability can be exercised from either client without
duplicating business rules, and API/OpenAPI drift becomes a build failure.
Future web features cannot silently widen the gap because the parity manifest
must be updated with evidence or an explicit, reviewed platform exception.

The v1 surface grows substantially, including bearer-aware equivalents for
capabilities currently available only through server actions. This increases
contract and integration-test work, and unsafe mobile writes require durable
idempotency. Mobile CI also becomes more expensive, so Maestro remains a thin
journey layer rather than a copy of every Playwright edge case.

ADR 059 remains the record for why spend capture was originally chosen as
phase 3, but its decision to keep general editing web-only is superseded by
this ADR.
