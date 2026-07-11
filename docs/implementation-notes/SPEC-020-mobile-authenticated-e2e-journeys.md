# Implementation Notes — SPEC-020 Mobile Authenticated E2E Journeys

> Rolling observations captured while implementing SPEC-020. Triage these at
> close-out into the spec, ADRs, tech-debt register, or discard them.

## 2026-07-11 — Pre-flight and architecture

- Audited the mobile surface against the web Playwright journeys, shared API
  schemas, existing mobile screens, ADRs 045/052/055/059/060, EPIC-004, and
  TD-010. Mobile currently covers authentication plus read-only trips; full
  product parity requires a multi-slice epic rather than one oversized patch.
- Added ADR 063 and EPIC-006 to define behavioural parity through shared v1
  contracts, canonical web domain/application use cases, native presentation,
  and a machine-checked capability manifest in the next slice.
- Limited SPEC-020 to the prerequisite vertical slice: prove the existing
  authenticated mobile client can reach the real CI backend and complete the
  already-supported read journey before adding new contracts or screens.

## 2026-07-11 — TD-010 tracer bullet

- Re-read Apple's Simulator/local-network guidance. Simulator does not
  implement local-network privacy, so TD-010's leading privacy-prompt
  hypothesis cannot explain the failure on the GitHub Simulator.
- SPEC-014 tried numeric loopback (`127.0.0.1`) and the runner LAN address but
  did not try the hostname `localhost`. Chose `http://localhost:3000` as one
  bounded tracer bullet, with the epic's reviewed HTTPS backend as the next
  step if it fails.
- Removed runner-IP discovery from `mobile-e2e` and aligned the build-time
  origin, host canary, bundle assertion, and auth-seam smoke to the same
  hostname. The Next server remains bound to `0.0.0.0`.

## 2026-07-11 — Authenticated journey restored

- Added one stateful Maestro flow covering test-auth sign-in, seeded trip list
  and detail, a missing-trip deep link, profile navigation, and sign-out.
- Reused committed screen test IDs; no production component or API change was
  needed. Added deterministic scrolling for off-screen destination and fixed
  cost evidence.
- Historical SPEC-014 CI failures are the RED evidence for this restored flow.
  Local YAML/static/unit gates precede the authoritative macOS CI run because
  this workstation has no installed iOS Simulator runtime.

## 2026-07-11 — Integration-suite time bomb

- The full integration gate reproducibly failed before the CI tracer could be
  pushed: the cross-endpoint refresh/revoke test expected rotation to succeed,
  but its token was issued on 2026-05-22 with a 30-day lifetime. The production
  route evaluates expiry with the real clock, so the fixture had become expired
  and correctly returned 401.
- Made that test's healthy-token seed relative to the same real clock. The
  existing expected 200 rotation followed by predecessor reuse remains the
  regression guard; production auth code is unchanged.
