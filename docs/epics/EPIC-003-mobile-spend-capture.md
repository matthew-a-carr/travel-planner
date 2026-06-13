# EPIC-003: Mobile Spend Capture — Record Spend on the Phone, Beautifully

**Date:** 2026-06-12
**Status:** Approved
**Strategic ADR:** [059 — Mobile Phase 3: Spend Capture over a v1 Write Surface](../decisions/059-mobile-phase-3-spend-capture-writes.md)
**Owner:** Matt Carr
**Approved by:** Matt Carr, 2026-06-12 (instruction to land the plan on `main` directly; drafted autonomously, decisions in §13 taken on recommendation)

> Drafted autonomously at Matt's instruction after EPIC-002 signed off, then
> raised to an explicit **App-Store-grade experience bar** at his direction
> ("go big with the design — award-winning App Store style"). The epic-
> altitude grilling didn't happen; §13 records the decisions that would have
> come out of it, each taken on the leading recommendation. Wrong calls get
> epic-level deviations, not silent rework.

---

## 1. Vision

You buy lunch in Kyoto and capture it before the receipt hits the table:
open the trip, tap **＋**, and a focused amount-first entry sheet slides up —
big numerals, category chips, destination already inferred from the dates,
today's date pre-set. Type `9.40`, tap *Food*, **Save** — a soft haptic, the
sheet drops away, and the Kyoto leg's spent figure ticks up in place. Fat-
fingered it? Tap the entry, fix it, or swipe it away. The whole exchange
takes seconds, feels native — dark mode, VoiceOver, one-handed reach — and
the web's burndown reflects reality by the time you've finished the ramen.
This is the slice of the product that should feel like an app you'd find in
an App Store "apps we love" list, because it's the one users touch daily.

## 2. Why now

EPIC-002 made the phone a window onto trip data; the highest-frequency data
*entry* — spending money — happens precisely when only the phone is at hand.
Every day of delay is another day of batched, reconstructed entries
degrading the burndown tracking (ADR 037) the product exists for. The server
machinery (bearer auth, envelope, org-scoped authz, OpenAPI, mobile data
hooks) is proven and the write-side use cases already exist — the remaining
work is the write surface, the capture UX, and the polish that makes daily
use pleasant instead of tolerable. See ADR 059 (spend-only, idempotent
writes, still Expo-Go, App-Store-grade bar).

## 3. Definition of done

- [ ] `POST /api/v1/destinations/{id}/spend` records a spend entry,
      idempotent via `Idempotency-Key`, envelope-wrapped, OpenAPI published.
- [ ] `PATCH` + `DELETE /api/v1/spend/{id}` edit and remove entries under
      the same authz rule; trip detail carries spend entries per destination.
- [ ] The mobile trip detail offers an **amount-first record-spend sheet**
      (destination inferred, category chips, date defaulting smartly) and
      per-entry edit/delete.
- [ ] A double-submitted record (retry, double-tap, app-kill mid-flight)
      produces exactly one entry — proven by an integration test replaying
      the same `Idempotency-Key`.
- [ ] Every mobile screen (EPIC-002's included) supports **dark mode**,
      **Dynamic Type**, and **VoiceOver** labels; save/delete give haptic
      feedback; the edge-case register (§15) is covered by tests slice by
      slice.
- [ ] Recorded/edited/deleted spend is visible identically on the web (no
      regression); all pre-existing tests stay green; mobile stays Expo-Go
      (no modules outside the SDK 54 set without an ADR).

## 4. Demo script

1. Open a trip → tap **＋** on the Kyoto leg (or the screen-level **＋**,
   which infers Kyoto from today's date).
2. The entry sheet slides up, amount keypad focused: type `9.40`, tap
   *Food*, note "ramen" → **Save** → haptic tick, sheet dismisses, Kyoto's
   "spent" figure and the trip summary animate to their new values.
3. Tap the entry → edit amount to `11.20` → save → figures update.
4. Swipe the entry → delete (with confirm) → figures revert.
5. Airplane mode → try to save → inline failure, form intact; back online →
   retry → exactly one entry exists (check the web in parallel).
6. Flip the phone to dark mode — every screen follows. Turn on VoiceOver —
   the capture flow is fully navigable. Crank Dynamic Type — layouts hold.
7. Open the same trip on the web → identical numbers, burndown current.

## 5. Outcome / success criteria

1. Pocket-to-database in **under ~10 seconds** of phone interaction for a
   typical entry (amount + category, defaults for the rest).
2. Mobile and web write through the same `application` use cases
   (`recordSpend` / `editSpendEntry` / `deleteSpendEntry`) via
   `getAppContainer()` — zero forked validation.
3. Replayed unsafe requests are idempotent (P6): same `Idempotency-Key` →
   same result, exactly one side effect.
4. The v1 write conventions (request schemas in `@travel-planner/shared`,
   201/200/204 + error envelopes, OpenAPI `requestBody`) exist once and are
   inherited by every future write.
5. The app passes an accessibility audit at the capture flow (VoiceOver
   navigable, 44pt targets, WCAG-AA contrast in both colour schemes) —
   P18 applied to native, not just web.

## 6. Non-goals

- **Trip / destination / fixed-cost editing on mobile.** Planning stays on
  the web this phase (ADR 059). Pulling any of it in requires amending the
  epic.
- **Offline capture / queue-and-sync.** Connectivity required; a failed
  submit preserves the form for retry. Parked (ADR 045 / ADR 059).
- **Actual App Store submission / TestFlight / ADP / native OAuth / push.**
  The *experience bar* is App-Store-grade; the *distribution* remains
  Expo-Go. Shipping to the real App Store is the natural phase-4 epic and
  needs the ADP funding decision first.
- **Currency conversion.** Entries are recorded in the trip's currency
  (GBP-only data today, ADR 011); ¥→£ arithmetic stays in the user's head.
- **Spend analytics on mobile** (charts, burndown) — web-only for now.
- **Receipt photos / OCR.** Needs camera modules + storage — post-ADP
  territory.

## 7. Vertical slices

| # | Slice | Demo script line(s) | Becomes SPEC | Depends on | Status |
|---|-------|---------------------|--------------|------------|--------|
| 1 | **Write surface** — `POST /api/v1/destinations/{id}/spend` + reusable `Idempotency-Key` machinery (table + replay short-circuit) + spend entries added to the trip-detail wire + shared schemas + OpenAPI write conventions + integration tests (incl. replay + authz isolation) | 5, 7 (server half) | _not yet planned_ | — | Not started |
| 2 | **Capture sheet** (**milestone**) — amount-first entry sheet with category chips, destination inference, smart date default, haptic save, animated figure updates, full error/edge handling; lands with a Maestro capture-journey flow on the EPIC-004 harness (deviation #1) | 1–2, 5 | _not yet planned_ | 1, EPIC-004 slice 5 | Not started |
| 3 | **Edit/delete endpoints** — `PATCH` + `DELETE /api/v1/spend/{id}` reusing slice-1 conventions + integration tests | 3–4 (server half) | _not yet planned_ | 1 | Not started |
| 4 | **Entry management UX** — per-destination entry list, edit sheet, swipe-to-delete with confirm + undo window | 3–4 | _not yet planned_ | 2, 3 | Not started |
| 5 | **App-Store polish pass** — design tokens (type/spacing/colour), dark mode across all screens incl. EPIC-002's, Dynamic Type + VoiceOver audit, transitions/haptics consistency, app icon + splash refresh | 6 | _not yet planned_ | 2 | Not started |

> SPECs are drafted lazily (one `ai:plan` issue per slice). Slice 3 can
> run parallel to slice 2; slice 5 can start once slice 2's patterns exist.

## 8. Sequencing rationale

Server-first mirrors EPIC-002's proven shape. Slice 1 is deliberately the
fattest server slice: it settles idempotency, request validation, and write
OpenAPI — the machinery slices 3–4 inherit cheaply — and extends the detail
wire so the capture sheet has entries to render against. Slice 2 is the
milestone: record-only capture is independently valuable even if the epic
stopped there. Slice 5 comes last so polish lands on settled interactions,
but its *standards* (tokens, dark-mode-aware styles, a11y props) bind from
slice 2 onward — slice 5 is the audit and backfill, not the first time
anyone thinks about design.

## 9. Kill / pivot criteria

- **Kill** if exposing writes over bearer auth requires duplicating domain
  validation client-side or forking a use case — that breaks ADR 045's
  premise from the write side and warrants a strategic rethink.
- **Pivot to a responsive web capture page** if the native sheet work in
  slice 2 balloons past ~2× budget — the server surface keeps its value
  either way.
- **Drop slice 5 to a follow-up epic** (rather than letting it expand) if
  the polish audit uncovers more than ~a week of backfill — polish must not
  hold the capture value hostage.
- **Pause** if idempotency can't be a reusable helper (per-endpoint bespoke
  mechanisms won't scale to future writes).

## 10. Cross-cutting decisions

| Concern | Decision | Why |
|---------|----------|-----|
| Auth | Same `requireAuth` + org-membership rule as reads; non-member and unknown → 404 (no existence leak, SPEC-010 precedent). **Writes additionally require `isApproved`** → 403 `forbidden`. | One authz rule across v1; closed-auth posture (ADR 029) for mutations. |
| Idempotency | Every unsafe endpoint requires a client-generated UUID `Idempotency-Key`. Server persists `(key, user_id, endpoint, response)` in a dedicated `idempotency_keys` table and replays the stored response on duplicates. Built once in slice 1 as a reusable helper. Keys are generated **per form-open**, not per submit attempt. | P6/T3; the first write sets the pattern; per-form-open keys make retry-after-timeout safe. |
| Request validation | zod request schemas in `@travel-planner/shared`; the mobile form reuses them for inline display, the server stays authoritative. `validation_failed` envelope with `issues`. | SPEC-005/008 source-of-truth pattern. |
| Status codes | `201` + created resource (POST), `200` + updated (PATCH), `204` (DELETE). | api-conventions / ADR 056; the client already handles 204. |
| Wire shape | `spendEntry` schema in shared; trip detail gains `spendEntries` per destination (composite stays one round-trip — EPIC-002 §13 Q1 logic). One minor envelope bump for the epic. | Same pattern as EPIC-002; payload-size risk re-accepted. |
| Mobile data | Extend the `src/trips/` hook pattern; mutations submit → on success re-fetch detail. **No optimistic UI** this epic — correctness first, the re-fetch is fast. | Smallest correct thing; optimistic spend figures that rollback are worse than a 300ms wait. |
| **Design system** | A `src/design/` token module (spacing scale, type ramp, semantic colours with light+dark values via `useColorScheme`) replaces per-screen hex literals. All new UI consumes tokens; EPIC-002 screens migrate in slice 5. | "Go big with the design" needs a system, not per-screen taste; dark mode is impossible to retrofit screen-by-screen without tokens. |
| **Interaction quality** | Haptics via `expo-haptics` (in the Expo Go SDK 54 set); transitions via React Native's built-in `Animated`/`LayoutAnimation`. **Reanimated or any module outside the SDK-54 Expo Go set requires an ADR first** (TD-003 lockstep). | Award-winning feel inside the Expo-Go constraint; the dependabot lockstep (TD-009) makes casual native deps expensive. |
| **Accessibility** | P18 applied natively: VoiceOver labels/roles on every interactive element, Dynamic Type respected (no fixed-height text containers), 44pt minimum targets, WCAG-AA contrast in both schemes. Audited in slice 5, required in every slice's component tests from slice 2. | The constitution's a11y bar is product-wide, not web-only. |
| Capture UX | Amount-first (big-numerals keypad, pence-safe — no float maths), category as one-tap chips ordered by recency, destination inferred from today ∈ [destination dates] (fallback: picker), date defaults to today. | The 10-second pocket-to-database target (§5.1) drives every default. |

## 11. External dependencies & constraints

| Dependency | What we rely on | Constraint / status |
|------------|-----------------|---------------------|
| Expo Go (SDK 54) | `expo-haptics`, `Appearance`/`useColorScheme`, `Animated` — all in the managed set | TD-003 pin stands; anything outside the set needs an ADR |
| None new | No vendor, no paid service, no ADP | — |

## 12. Cost & budget

| Item | Cost | When incurred | Decision |
|------|------|---------------|----------|
| Engineering | ~13–17 focused days across 5 slices | — | This epic |
| Infra / vendors | £0 incremental | — | — |

## 13. Decisions taken at approval (in lieu of grilling)

> Matt delegated the plan ("plan the next epic without me", "push straight
> to main"); these were the §Open Questions, resolved on the leading
> recommendation. A slice that proves one wrong files an epic-level
> deviation rather than silently re-deciding.

| # | Question | Decision |
|---|----------|----------|
| 1 | Idempotency persistence | Dedicated reusable `idempotency_keys` table storing the serialized response (P6's `(key, result)` pattern); a per-table unique column wouldn't generalise to PATCH/DELETE. |
| 2 | Spend entries on the wire | Extend `GET /api/v1/trips/{id}` (composite, one round-trip — EPIC-002 precedent). Split to a sub-resource only if payload size actually bites (§15). |
| 3 | Route shape | `POST /api/v1/destinations/{id}/spend` — entries belong to destinations in the domain; matches api-conventions' nested style. |
| 4 | `spentAt` semantics | Calendar date, no time component — matches the domain column and the burndown's "what day" question. The client sends the device-local date. |
| 5 | Approval gating | Writes `isApproved`-only (403 `forbidden`); read endpoints stay as shipped (tightening reads is out of scope). |
| 6 | Trip-status gating | Spend may be recorded against trips in **any** status — late expenses against `completed` trips are legitimate (the receipt that surfaces a week after the flight home). |

## 14. Parking lot

- **The App Store epic** — ADP funding, TestFlight, native OAuth (TD-004),
  Sentry RN, push, App Store assets/review. This epic builds the experience
  bar that makes that submission credible; distribution itself is phase 4.
- General mobile editing parity (trips, destinations, budgets).
- Offline capture queue (ADR 045) — revisit on real connectivity pain.
- Currency-aware capture (enter ¥, store £) — needs a rates decision.
- Receipt photo / OCR capture — post-ADP (camera + storage modules).
- Public dev hostname (would also fix the on-device dev OAuth constraint
  documented in mobile AGENTS.md).

## 15. Risks & edge-case register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Idempotency helper over-engineered | Medium | Wasted slice-1 budget | Design for this epic's 3 endpoints only; kill criterion #4 |
| Native form/sheet UX balloons | Medium | Slice 2 overruns | Pivot criterion: responsive web capture page |
| Polish slice expands indefinitely | Medium | Epic never closes | Kill criterion #3: cap at ~a week, spill to a follow-up |
| Write authz drift from reads | Low | Cross-org data leak | Same-rule reuse + replay of EPIC-002's isolation int-tests on every write |
| Detail payload growth (entries on the wire) | Low | Slow detail loads | Re-accepted from EPIC-002; sub-resource split is the documented fallback |

**Edge-case register** — inherited by every slice's SPEC; each case lands as
a test in the slice that owns it:

| Area | Case | Expected behaviour | Slice |
|------|------|--------------------|-------|
| Input | Zero / negative amount | Domain rejects (`recordSpend` guard); keypad prevents, server test proves | 1, 2 |
| Input | Fractional-pence / float input | Impossible by construction — keypad emits integer pence; schema `int()` | 1, 2 |
| Input | Very large amount (≥ £10m) | Accepted (JS-safe integers); summary formatting holds | 1, 2 |
| Input | Empty / whitespace / emoji / very long description | Trimmed; null when empty; length-capped with inline counter; emoji fine (UTF-8 end-to-end) | 1, 2 |
| Input | Future `spentAt`, or date outside the destination's range | Allowed with a soft inline hint, never blocked (late bookings, pre-payments) | 2 |
| Network | Double-tap Save | Button disables on first tap; idempotency key dedupes anyway | 2 |
| Network | Timeout after server committed | Retry reuses the per-form-open key → replayed response, one entry | 1, 2 |
| Network | Airplane mode mid-save | Inline failure, form state fully preserved, retry available | 2 |
| Network | App killed mid-submit | No dupe on relaunch (key was burned with the committed write; a fresh form is a fresh entry — acceptable) | 1 |
| Auth | Access token expires mid-flow | `getAccessToken()` refresh path; on `refresh_failed` the form persists and the error names the fix | 2 |
| Auth | Unapproved user attempts a write | 403 `forbidden` envelope; client shows the pending-approval message | 1, 2 |
| State | Destination deleted on the web mid-form | 404 on submit → friendly "this leg no longer exists" + detail refresh | 2 |
| State | User removed from the org mid-session | Writes/reads 404 → detail falls to not-found state (already shipped), list refresh drops the trip | 1 |
| State | Same entry edited on web + phone | Last write wins; no conflict detection this epic — recorded here so it's a decision, not an accident | 3 |
| State | Entry deleted on web, then edited on phone | PATCH → 404 → entry list refreshes it away with a notice | 3, 4 |
| Device | Dark mode, mid-session scheme flip | Tokens re-resolve live (`useColorScheme`); no hardcoded hex anywhere new | 2, 5 |
| Device | Dynamic Type at accessibility sizes | Layouts reflow, nothing truncates silently | 5 |
| Device | VoiceOver | Full capture flow navigable; figures announce their changes | 2, 5 |
| Device | iPhone SE width / one-handed reach | Sheet controls in thumb zone; 44pt targets | 2 |
| Device | Locale decimal separators | Keypad owns formatting (no `TextInput` free-text for amounts) | 2 |

## 16. ADR triggers

| Slice | Likely ADR(s) | Notes |
|-------|---------------|-------|
| 1 | Idempotency-key storage | Only if the design deviates from §13 #1's table pattern |
| 2 | Animation library | Only if `Animated`/`LayoutAnimation` prove insufficient and Reanimated (or similar) enters — TD-003 lockstep makes this a real decision |
| 5 | Design-token approach | Only if tokens grow beyond a module (e.g. a theming library) |

## 17. References

- [ADR 059 — Mobile Phase 3: Spend Capture](../decisions/059-mobile-phase-3-spend-capture-writes.md) (strategic ADR)
- [ADR 058](../decisions/058-mobile-phase-2-read-only-data.md) / [EPIC-002](./EPIC-002-mobile-read-only-data.md) (foundation)
- [ADR 037 — Burndown Budget Pace Tracker](../decisions/037-burndown-budget-pace-tracker.md) (why fresh spend data matters)
- [ADR 029](../decisions/029-closed-auth-invite-only-membership.md) (closed auth → write gating)
- Existing use cases: `apps/web/src/application/use-cases/{record-spend,edit-spend-entry,delete-spend-entry}.ts`
- `docs/api-conventions.md`; engineering principles P6, P18, T3
- Issue [#141](https://github.com/matthew-a-carr/travel-planner/issues/141) (planning record)

---

## Slice ledger (append-only)

| Date | Slice # | SPEC | Status change | Notes |
|------|---------|------|---------------|-------|
| 2026-06-12 | — | — | Drafted | Drafted autonomously post-EPIC-002 sign-off (issue #141). |
| 2026-06-12 | — | — | Approved | Raised to the App-Store-grade bar and landed on `main` directly at Matt's instruction; §13 decisions taken on recommendation. |

## Epic-level deviations

| # | Deviation | Reason | Impact on other slices | Resolved? |
|---|-----------|--------|------------------------|-----------|
| 1 | Slice 2 gains "lands with a Maestro capture-journey flow on the EPIC-004 harness" and a dependency on EPIC-004 slice 5 (write-journey readiness) | [EPIC-004](./EPIC-004-mobile-e2e-authenticated-journeys.md) builds the authenticated mobile E2E harness; the reciprocal flow obligation was approved with EPIC-004 (its §13 decision 4, PR #145) | Slice 2's implementation must wait for EPIC-004 slice 5; slices 1 and 3 unaffected | Stands by design |

## Post-epic notes

_Filled when the epic closes._
