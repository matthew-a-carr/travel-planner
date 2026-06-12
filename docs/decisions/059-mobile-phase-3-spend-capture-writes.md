# ADR 059: Mobile Phase 3 — Spend Capture over a v1 Write Surface

**Date:** 2026-06-12
**Status:** Accepted

> Operationalised by [EPIC-003](../epics/EPIC-003-mobile-spend-capture.md).
> Drafted autonomously at Matt's instruction ("plan the next epic without
> me") immediately after EPIC-002 signed off; accepted 2026-06-12 via his
> instruction to land the plan on `main` directly, with the design ambition
> raised to an App-Store-grade bar at his direction.

## Context

EPIC-002 shipped read-only trips on the phone (ADR 058): list, detail,
timeline, spend summary. The app can show what a trip costs but can't change
anything — and the highest-frequency data entry in this domain happens *away
from a laptop*: you spend money while travelling. Today every spend entry
waits until someone is back at the web app, which means batched, forgotten,
and approximated entries — undermining the burndown tracking (ADR 037) the
product is built around.

ADR 058 explicitly deferred writes to "a later epic". With the read
foundation proven (bearer auth, envelope, org-scoped authz, OpenAPI, the
mobile data-hook pattern), the strategic question is what phase 3 is. The
two candidates at EPIC-002 close-out:

1. **Mobile writes** — starting with spend capture.
2. **Apple Developer Program funding** — TestFlight, native OAuth (TD-004),
   Sentry RN, push; the gate that brings the partner in as a second user.

## Decision

Phase 3 is **spend capture on the phone over a new `/api/v1/*` write
surface**, scoped to spend entries only. Specifically:

1. **Writes are spend-only this phase.** Record, edit, and delete spend
   entries from the mobile app. Trip / destination / fixed-cost editing
   stays on the web — those are planning activities that happen at a
   laptop; spend capture is the in-the-moment activity that happens on a
   phone.
2. **First bearer-auth write endpoints, idempotent by design.** Every
   unsafe endpoint accepts an `Idempotency-Key` header (engineering
   principles P6 / T3); replays return the original result without
   re-applying the side effect. This is settled now because the first
   write establishes the pattern every later write inherits.
3. **Reuse the existing use cases.** `recordSpend`, `editSpendEntry`,
   `deleteSpendEntry` already exist and enforce the domain rules
   (positive amounts, `Result` returns). The v1 routes compose them
   through `getAppContainer()` exactly as the read endpoints did — no
   forked validation, no client-side duplication of domain rules.
4. **Still Expo-Go, still no ADP.** The distribution/native foundation
   stays deferred (ADR 058's framing stands): spend capture is valuable
   to the current single user immediately, and lands the writes pattern
   that a second user would need anyway. ADP becomes the natural phase 4
   when a second device matters.
5. **No offline queue.** Submitting requires connectivity; a failed
   submit stays on the form for retry. Offline capture-and-sync remains
   parked (ADR 045) — it's a large correctness problem the audience of
   one doesn't yet justify.
6. **App-Store-grade experience bar.** The capture flow is held to the
   standard of a polished App Store app — design tokens with first-class
   dark mode, haptic feedback, animated value changes, VoiceOver and
   Dynamic Type support — while staying inside the Expo Go SDK 54 module
   set (anything outside it requires its own ADR; TD-003 lockstep).
   Distribution stays Expo-Go: the *bar* is App-Store-grade, the actual
   App Store submission is the phase-4 epic gated on ADP funding.

## Consequences

**Easier:**

- Spend data gets captured at the moment of spending — fresher burndown,
  less end-of-trip reconstruction.
- The v1 write pattern (request schemas, idempotency, 201/validation
  envelopes, OpenAPI for writes) is established once, small, and inherited
  by every future write surface.
- Reusing the web's use cases keeps validation parity for free.

**Harder / deferred:**

- Mobile users still can't fix a trip's plan (dates, budgets, destinations)
  from the phone — a visible asymmetry once spend editing works.
- The partner still can't install the app (Expo-Go-only); ADP remains the
  unlock and is consciously sequenced after writes.
- Idempotency adds a small persistence surface (replay detection) to
  design carefully in slice 1.

**Trade-offs:**

- **Writes before distribution:** value to the existing user now vs a
  second user sooner. Chosen because writes compound the just-shipped read
  surface, while ADP is a cost + ceremony decision best made when a second
  device is concretely in play.
- **Spend-only vs general editing:** a narrower epic that can actually
  finish, on the highest-frequency mobile job. General editing parity is a
  potential later epic, not silently in scope.

## References

- [ADR 058 — Mobile Phase 2: Read-Only Data](./058-mobile-phase-2-read-only-data.md)
- [ADR 045 — iOS App Strategy](./045-ios-app-strategy.md) (offline parked)
- [ADR 037 — Burndown Budget Pace Tracker](./037-burndown-budget-pace-tracker.md) (why fresh spend data matters)
- [EPIC-003 — Mobile Spend Capture](../epics/EPIC-003-mobile-spend-capture.md)
- Engineering principles P6 (idempotency at every boundary), T3 (Idempotency-Key header for unsafe operations)
