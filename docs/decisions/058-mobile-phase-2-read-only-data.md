# ADR 058: Mobile Phase 2 — Read-Only Data over the Existing Foundation

**Date:** 2026-05-30
**Status:** Accepted

> Operationalised by [EPIC-002](../epics/EPIC-002-mobile-read-only-data.md).
> Builds on [ADR 045](./045-ios-app-strategy.md) (iOS App Strategy), which
> this ADR moves from `Proposed` to `Accepted` now that EPIC-001 has shipped
> its milestone.

## Context

EPIC-001 delivered the iOS app's foundation: an Expo + React Native shell
distributed via Expo Go, Google sign-in via server-mediated PKCE, short-lived
JWT + rotating refresh tokens in the Keychain, and an authenticated "me"
screen. The app can log in but shows nothing beyond the user's identity — the
web app's domain (`trip`, `timeline`, `spending`, `destination`) is not yet
exposed to mobile (only `/api/v1/me` + `/api/v1/auth/mobile/*` exist).

ADR 045 set the iOS strategy but deliberately scoped *out* — and deferred "to
a future ADR" — App Store / TestFlight distribution, APNs, and native
on-device OAuth, and was never moved past `Proposed`. EPIC-001 also deferred
its slice 9 (Sentry RN + EAS source maps) because that work needs EAS Build,
which the Expo-Go-only constraint (ADR 053 / TD-003) precludes.

The next increment of user value is making the app **useful**: show the user
their actual travel data on the phone. That raises a strategic question —
do we first invest in the native-distribution foundation (Apple Developer
Program, EAS Build, TestFlight, native OAuth), or ship data value over the
foundation we already have? This ADR decides phase 2's direction so EPIC-002
can operationalise it.

## Decision

Phase 2 of the iOS app is **read-only mobile data over the existing
Expo-Go + server-mediated-PKCE foundation.** Specifically:

1. **Stay Expo-Go-only.** Do **not** fund the Apple Developer Program
   ($99/yr) in this phase. EAS Build, TestFlight, APNs, and **native
   on-device OAuth (TD-004)** remain deferred — they all hang off the same
   ADP/EAS trigger and belong to a later phase. **Sentry RN + EAS source
   maps (EPIC-001 slice 9) is carried with them**, not into EPIC-002.

2. **Read-only first.** The mobile app *reads and displays* the user's data.
   Writes/edits stay on the web (Server Actions). No mobile create/update
   endpoints, no optimistic UI, no offline/conflict design in this phase —
   each of those is deferred (ADR 045 already parks offline/conflict).

3. **Trips are the entry point.** The first milestone is a **trips list →
   trip detail** experience (trip detail surfacing the timeline and spend),
   since the trip is the headline domain object. Spending-only and AI-chat
   surfaces are deferred to later slices/phases.

4. **Reuse the v1 contract.** New read endpoints (e.g. `GET /api/v1/trips`,
   `GET /api/v1/trips/{id}`) follow the standardised envelope (ADR 056) with
   wire schemas in `@travel-planner/shared` and the generated OpenAPI spec —
   no new transport, no tRPC/GraphQL (ADR 045 §non-goals stands).

This ADR also moves **ADR 045 from `Proposed` to `Accepted`**: EPIC-001 has
validated the strategy in production-equivalent use, so the foundational
direction is no longer provisional. Native distribution / OAuth / push remain
ADR-045-deferred and become a *future* strategic ADR when ADP funding is on
the table.

## Consequences

**Easier:**

- Ships user-visible value (your trips on your phone) **without** the cost,
  Apple-account setup, and CI complexity of EAS Build/TestFlight.
- The read-only constraint keeps the surface small: no write validation
  parity, no offline sync, no conflict resolution.
- Reuses the envelope + shared-schema + OpenAPI machinery already built
  (SPEC-005, SPEC-008 / ADR 056) — data endpoints are incremental.

**Harder / deferred:**

- The app stays Expo-Go-only, so on-device install remains the QR-code +
  Expo Go dance (no TestFlight). Acceptable for an audience of one.
- Mobile remains read-only; users who want to edit on the phone must wait
  for a later phase. Surfaced as an explicit non-goal so it isn't a surprise.
- Native OAuth (TD-004), Sentry RN (EPIC-001 slice 9), and TestFlight
  distribution all wait for a future ADP-funding decision.

**Trade-offs:**

- **Data value now vs foundation now.** We pick value. The native foundation
  (ADP/EAS/TestFlight/OAuth) is real work with real cost and is better
  triggered by a concrete need (App Store intent, a second device, the
  partner re-entering scope) than built speculatively. ADR 045 already
  framed this deferral; this ADR confirms it for phase 2.
- **Accepting ADR 045 now** records that the strategy is settled, while
  keeping its deferred items explicitly deferred (not silently adopted).

## References

- [ADR 045 — iOS App Strategy](./045-ios-app-strategy.md) (this ADR moves it to Accepted)
- [ADR 053 — Temporary Downgrade to Expo SDK 54](./053-expo-sdk-54-temporary-downgrade.md) / TD-003 (Expo-Go-only constraint)
- [ADR 056 — REST API Response Envelope and OpenAPI Publication](./056-api-response-envelope-and-openapi.md)
- TD-004 (native on-device OAuth — deferred), EPIC-001 slice 9 (Sentry RN — deferred)
- [EPIC-002 — Mobile Read-Only Data](../epics/EPIC-002-mobile-read-only-data.md) (operationalises this ADR)
