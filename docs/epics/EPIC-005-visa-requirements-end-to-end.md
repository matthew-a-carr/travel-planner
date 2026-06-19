# EPIC-005: Visa Requirements — End-to-End

**Date:** 2026-06-15
**Status:** Draft
**Strategic ADR:** — (no separate strategic ADR; the determinism-boundary /
zones decision is captured as ADR 061, triggered by the foundation slice — see
§16. This epic operationalises a product need rather than a standalone strategic
direction.)
**Owner:** Matt Carr
**Approved by:** —

> Builds directly on **SPEC-015** (Visa Requirements — Data & Domain Modelling,
> merged), which delivers the reference schema, the pure-domain evaluator, the
> traveller-profile model, and the one-off AI-extraction seed job. SPEC-015 is
> the foundation slice of this epic; everything else here surfaces that model to
> a traveller. The modelling questions (zones, multi-passport, eligibility,
> sourcing) are **settled in SPEC-015 and out of scope for re-litigation** here.

---

## 1. Vision

A UK traveller planning a multi-country trip opens the trip and sees a **Visas**
panel. For each country on the itinerary it tells them, in plain language,
whether they can make the trip they've drawn: "Japan — visa-free, 90 days, you're
staying 40 ✓"; "Schengen Area — you're booked 95 days across France, Italy and
Spain, but the limit is 90 in any 180 ✗"; "Thailand — single-entry visa, but your
itinerary leaves and comes back ✗". The traveller has entered their passport(s)
and date of birth once on their profile, so the advice is personal and correct.
For somewhere like Australia they can flip a **trip intent** from "Tourism" to
"Working holiday" and the panel re-assesses against the Working Holiday visa
(age-eligible, ~12 months, work rights) instead of the 90-day tourist rule —
turning "I want to go to Australia to live" into a concrete, checkable plan.

## 2. Why now

The app helps people draw multi-country itineraries but says nothing about
whether those itineraries are *legal*. Overstaying Schengen, assuming a
single-entry visa covers a side-trip, or not knowing a Working Holiday visa
exists are real, expensive mistakes — and they're exactly the mistakes a planning
tool should catch. The modelling foundation (SPEC-015) is specced and merged; the
evaluator is deterministic and the seed is frozen, so surfacing it is incremental
and low-risk. There's even a hardcoded "UK passport holder" assumption already in
`anthropic-timeline-insights.ts` that this work replaces with a real per-traveller
model. Waiting six months means the planning product keeps shipping itineraries it
can't vet.

## 3. Definition of done

The epic is **Complete** when:

- [ ] A signed-in user can record their passport(s) and date of birth on a
      **profile page**, persisted and reused across trips.
- [ ] A trip detail page shows a **Visas panel** with per-country coverage
      (status, max stay, days planned, entries) and clear warnings for
      overstay, Schengen 90/180, single-entry side-trips, and cooling-off.
- [ ] The panel is correct for the four canonical cases: a long single-country
      stay across multiple cities, a multi-country Schengen overstay, a
      single-entry re-entry, and an age-gated Working Holiday option.
- [ ] A **per-trip intent selector** (Tourism / Working holiday / Long stay)
      re-assesses the trip; the Australia Working Holiday case works end-to-end.
- [ ] **Broad GBR destination coverage** is seeded and human-reviewed; countries
      with no data are shown honestly as "no visa data yet", never silently.
- [ ] The hardcoded "UK passport holder" assumption is gone; the web app has no
      regression and all pre-existing tests stay green.

Non-UK nationalities, a mobile surface, and visa-fee budgeting are **not** the
bar (see §6).

## 4. Demo script

1. Open **Profile** → add a "UK passport" (`GBR`) and set date of birth → save.
2. Open a trip with **two cities in Japan** totalling 40 days → the **Visas
   panel** shows "Japan — visa-free, up to 90 days, 40 planned ✓".
3. Open a trip across **France + Italy + Spain** totalling 95 days → the panel
   shows one **Schengen Area** warning: "90 days in any 180 — you're planning 95
   ✗", not three per-country lines.
4. On a trip that **leaves and re-enters Thailand** on a single-entry rule → a
   "single-entry visa won't cover re-entry" warning.
5. Open a trip to **Australia**; switch **trip intent** from *Tourism* to
   *Working holiday* → the panel re-assesses to the Working Holiday visa (12
   months, work rights), shown as eligible because the traveller is under 35.
6. Open a trip to a **country with no seeded data** → "We don't have visa data
   for X yet" rather than a blank or a wrong answer.

## 5. Outcome / success criteria

1. Visa advice on a trip is **deterministic and personal** — derived from the
   user's own passports/DOB and the trip's dates via the SPEC-015 evaluator, with
   **no AI call at request time**.
2. The four edge cases that motivated the work — multi-city summation, Schengen
   zone allowance, single-vs-multiple entry, age-gated working-holiday — are each
   demonstrably correct in the UI, not just in unit tests.
3. The traveller can express **intent** and see the assessment change, making the
   "go to Australia to live" journey concrete.
4. Countries without data fail **safe and honest** (`unknown` surfaced as such),
   never with a confidently wrong answer.
5. No existing web behaviour regresses; the "UK passport holder" guess is
   replaced by real profile data.

## 6. Non-goals

- **Non-UK nationalities.** The model is nationality-generic (SPEC-015), but only
  `GBR` rules are seeded and surfaced. Other nationalities are a parking-lot
  follow-on epic.
- **A mobile surface.** This epic targets the **web** trip page. A
  `/api/v1/.../visa-assessment` endpoint + mobile panel is parking-lot (the
  evaluator and use case are client-agnostic, so it's additive later).
- **Visa-fee budgeting.** `'visas'` already exists as a `FixedCostCategory`;
  wiring an assessment into the budget waterfall is out of scope.
- **Live / online visa lookups.** Explicitly excluded by SPEC-015's determinism
  boundary — runtime is frozen-seed reads only.
- **Automated factual-correctness guarantees on policy data.** Accuracy is gated
  by human review of the seed diff, not by tests (SPEC-015 §8/§14).
- **Booking, applications, or document storage.** We tell the traveller what
  applies; we don't apply for visas or store documents.

## 7. Vertical slices

Each slice is shippable and demoable. Slice 1 is the merged modelling foundation;
slices 2–5 surface it. SPECs for slices 3–5 are drafted lazily (`draft-spec` from
an `ai:plan` issue) when the slice is ready.

| # | Slice | Demo script line(s) | Becomes SPEC | Depends on | Status |
|---|-------|---------------------|--------------|------------|--------|
| 1 | **Modelling foundation** — `visa_rules`/`visa_zones`/`visa_zone_membership`/`user_passports`/`users.date_of_birth` schema, pure `src/domain/visa/` evaluator, `assess-trip-visas` use case, AI-extraction seed job, initial `GBR` seed (incl. Schengen + Australia), remove the hardcoded "UK passport holder" assumption | (foundation — enables 1–6) | [SPEC-015](../specs/SPEC-015-visa-requirements-modelling.md) (In Progress) | — | In Progress |
| 2 | **Traveller profile capture** — profile page to add/remove passports + set date of birth; persistence (`user_passports`, `users.date_of_birth`) via a use case + server action; assessment reads real profile data | 1 | [SPEC-016](../specs/SPEC-016-traveller-profile-capture.md) (Complete) | 1 | Complete |
| 3 | **Visas panel on the trip page (default Tourism)** — trip detail page renders per-country `CountryCoverage` + warnings (overstay, Schengen, single-entry, cooling-off), wired via a server-side call to `assess-trip-visas` through `getAppContainer()`. **Milestone slice** | 2–4, 6 | [SPEC-017](../specs/SPEC-017-visas-panel.md) (In Progress) | 1, 2 | In Progress |
| 4 | **Per-trip intent selector** — persisted trip `intent` (Tourism / Working holiday / Long stay) drives `preferPurposes`; panel re-assesses; Australia Working Holiday case end-to-end | 5 | _not yet planned_ | 3 | Not started |
| 5 | **Broad GBR seed + accuracy pass** — run `visa:fetch` across the full country list, human-review the diff, commit; `unknown` countries surfaced honestly in the panel | 6 | _not yet planned_ | 1, 3 | Not started |

## 8. Sequencing rationale

Slice 1 (the merged SPEC-015) is the hard dependency for everything — no evaluator,
no panel. Slice 2 (profile) precedes the panel because age-eligibility and
multi-passport selection need real DOB/passport data; without it the panel could
only show short-stay defaults for a hardcoded `GBR`. Slice 3 is the milestone: the
first time a user *sees* visa truth on a trip — and it's the thinnest end-to-end
vertical that proves the whole strategic bet (deterministic evaluator → real
itinerary → correct warning). Slice 4 (intent) layers onto the panel and is
reversible in ordering with slice 5; it's sequenced first because the Australia
"live there" journey is a headline outcome (§5.3). Slice 5 (seed breadth) can run
in parallel with 3–4 — it's a data/sourcing effort gated by human review, not by
UI — but the panel must already render `unknown` honestly (slice 3) for the breadth
work to be demoable. Slices 3 and 5 are the natural parallelisation seam.

## 9. Kill / pivot criteria

- **Kill the determinism bet** if, by the end of slice 5, more than ~25% of the
  top-30 GBR destinations cannot be expressed in the SPEC-015 model without a
  per-trip AI call — that would mean the frozen-seed/pure-evaluator split is the
  wrong shape, and visa advice should be reframed as AI-assisted (non-deterministic)
  guidance. Re-open the SPEC-015 design.
- **Pivot sourcing to hand-curated** if human review of the AI-extracted seed
  finds material factual errors in more than ~20% of a sampled set of rows — the
  extraction job isn't pulling its weight; fall back to hand-authoring the top
  destinations and keep AI only for the long tail.
- **Pause** if capturing date of birth surfaces a data-protection concern that
  needs an explicit privacy decision — DOB is the only new PII and slice 2 is the
  gate.
- **Pivot intent UX** if the per-trip intent selector proves confusing in slice 4
  review (e.g. users expect per-destination intent) — fall back to surfacing
  eligible alternatives read-only (the `alternativeRuleIds` already exist).

## 10. Cross-cutting decisions

| Concern | Decision | Why |
|---------|----------|-----|
| Runtime determinism | Visa advice is computed by the pure `assess-trip-visas` use case over the frozen seed; **no AI at request time** (SPEC-015). | Reviewable data bug, never runtime non-determinism. |
| Delivery surface | **Web-first.** The panel reads the assessment server-side via `getAppContainer()` → `assess-trip-visas` (same pattern as timeline insights), **no new `/api/v1` endpoint** this epic. | Smallest surface; mobile parity is additive (parking lot). |
| UI placement | A dedicated **Visas panel** on the trip detail page; warnings reuse the existing `TimelineFinding` severity vocabulary (`danger`/`warning`/`info`) for visual consistency. | One coherent home with room for the stay maths + alternatives. |
| Trip intent | A **per-trip** `intent` field (default `tourism`), persisted on the trip, mapped to the evaluator's `preferPurposes`. | Matches the "go to Australia to live" journey; stable across sessions. |
| Traveller PII | Passports + DOB captured once on the **user profile**; DOB stored minimally, kept out of logs and AI prompts, only ever read for the signed-in user (SPEC-015 §8). | One PII field, one home, least exposure. |
| Nationality scope | `GBR` only, broad destinations. The model is nationality-generic but no other passport is seeded/surfaced. | Real value for the actual user without multiplying review effort. |
| Unknown data | A country with no matching rule renders an explicit "no visa data yet" state, never silence or a guessed answer. | Fail safe and honest (§5.4). |
| Authorisation | The assessment reads only the requesting user's profile and a trip they can already see (existing org-scoped trip access). | No new authz surface. |

## 11. External dependencies & constraints

| Dependency | What we rely on | Constraint / status |
|------------|-----------------|---------------------|
| Vercel AI Gateway (ADR 040) | Running the one-off `visa:fetch` extraction job | Build/offline only — **never** at request time. Needs `AI_GATEWAY_API_KEY` locally or Vercel OIDC. |
| AI-extracted policy data | The seed's factual accuracy | Gated by **mandatory human review** of the seed diff (SPEC-015 §8); not a third-party SLA. |

No new vendor account, no paid service, no platform (Apple/Google) gating.

## 12. Cost & budget

| Item | Cost | When incurred | Decision |
|------|------|---------------|----------|
| AI Gateway extraction tokens | Negligible (one-off, cached) | When running `visa:fetch` for the broad seed (slice 5) | In scope; trivial |
| Human review of the seed | ~0.5–1 day of careful review for broad GBR coverage | Slice 5 | In scope; the irreducible accuracy gate |

Rough effort: ~8–12 focused days across slices 2–5 (slice 1 is the separate
SPEC-015 implementation). No incremental infra/vendor cost.

## 13. Open questions

> Each leads with a recommendation; resolved on the EPIC PR or at slice grilling.

| # | Question | Owner | Answer by slice |
|---|----------|-------|-----------------|
| 1 | **Intent granularity — per-trip vs per-destination?** *Recommend per-trip (a trip has one purpose); revisit only if a real itinerary needs mixed intent.* Cost of wrong: a per-destination override slice later. | Matt | Slice 4 |
| 2 | **Persist `intent` on the trip, or keep it ephemeral UI state?** *Recommend persist on the trip so warnings are stable across sessions and shareable.* Cost of wrong: a small migration. | Matt | Slice 4 |
| 3 | **Mobile `/api/v1/.../visa-assessment` endpoint — this epic or parking lot?** *Recommend parking lot; the use case is client-agnostic, so it's purely additive when a mobile slice is funded.* Cost of wrong: a follow-on slice. | Matt | Slice 3 |
| 4 | **How rich is the panel for a single country — headline status only, or expandable detail (validity, requirements, alternatives)?** *Recommend headline + expandable detail; `otherRequirements` and `alternativeRuleIds` already exist to fill it.* Cost of wrong: UI iteration. | Matt | Slice 3 |
| 5 | **Seed breadth target for "broad" — all ~200 countries, or the top GBR destinations first?** *Recommend top GBR destinations first (where unknowns hurt most), expanding outward; unknowns are safe.* Cost of wrong: incremental seed runs. | Matt | Slice 5 |

## 14. Parking lot

- Non-UK nationalities (multi-nationality seed + review) — likely its own epic.
- A `/api/v1/.../visa-assessment` endpoint + a **mobile** Visas panel.
- Wiring visa **fees** into the budget (`'visas'` `FixedCostCategory` + waterfall).
- Per-destination intent override (if §13 Q1 flips).
- Document/application tracking (passport expiry reminders, visa application status).
- Surfacing visa warnings inline on the **timeline** in addition to the panel.

## 15. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Seeded policy is factually wrong | Medium | High (users trust a wrong "✓") | Human review of the seed diff; forced `sourceNote` citations; `source` provenance; conservative prompt; "no data yet" beats a wrong answer |
| Country name → alpha-3 resolution gaps (free-text `Destination.country`) | Medium | Medium (false `unknown`) | Reuse `CountryReference` alpha-3 mapping; slice 3/5 assert resolution for seeded destinations |
| Intent selector confuses users | Low–Med | Medium | §9 pivot to read-only alternatives; slice-4 review gate |
| DOB capture raises a privacy concern | Low | Medium | §9 pause; minimal storage, no logs/prompts, own-user-only reads |
| Panel UX cramped on a busy trip | Medium | Low | Headline + expandable detail (§13 Q4); reuse timeline-finding severities |

## 16. ADR triggers

| Slice | Likely ADR(s) | Notes |
|-------|---------------|-------|
| 1 | **ADR 061** — visa requirements: deterministic evaluation over an AI-extracted frozen seed, with first-class zones (temporal `valid_from`/`valid_to` selection) | Triggered by SPEC-015; written when slice 1 implementation begins |
| 4 | Possible ADR if `intent` introduces a new trip-level cross-cutting field pattern | Only if it's non-obvious; otherwise a plain migration |

Numbers claimed at write time.

## 17. References

- [SPEC-015 — Visa Requirements: Data & Domain Modelling](../specs/SPEC-015-visa-requirements-modelling.md) (foundation slice; merged)
- ADR 061 (forthcoming) — visa determinism boundary + zones (triggered by slice 1)
- [ADR 040 — Vercel AI Gateway for itinerary AI](../decisions/040-vercel-ai-gateway-for-itinerary-ai.md) (the one-off extraction job rides this)
- Domain foundations reused: `apps/web/src/domain/{trip,destination,timeline,country-reference}/`; `apps/web/src/application/use-cases/`
- Tech debt: removes the hardcoded "UK passport holder" assumption in `apps/web/src/infrastructure/ai/anthropic-timeline-insights.ts`

---

## Slice ledger (append-only)

| Date | Slice # | SPEC | Status change | Notes |
|------|---------|------|---------------|-------|
| 2026-06-15 | — | — | Drafted | EPIC-005 drafted (interactive session). Foundation slice already specced + merged as SPEC-015. Awaiting human review of §13 Open Questions + slice table. |
| 2026-06-15 | 1 | SPEC-015 | In Progress | Foundation slice implementation opened: domain evaluator + schema/migration + repository + seed + `assess-trip-visas` use case + ADR 061. AI extraction job, broad seed, and the hardcoded-assumption removal deferred (SPEC §12 steps 9–11). |
| 2026-06-15 | 1 | SPEC-015 | Merged | Foundation (PR #160) + AI extraction job (PR #162) merged to main; steps 1–9 + 12 done. Steps 10–11 still pending. |
| 2026-06-16 | 2 | SPEC-016 | In Progress | Traveller profile capture drafted + implemented: `/settings/profile` page, `user-profile` domain + repository + get/update use cases, SettingsNav tab. No migration (reuses SPEC-015 tables). |
| 2026-06-16 | 2 | SPEC-016 | Complete | Merged (PR #164), CI green incl. e2e + integration. |
| 2026-06-16 | 3 | SPEC-017 | In Progress | Milestone Visas panel drafted + implemented: server-rendered panel on the trip page from `assess-trip-visas`, `visaRuleRepository` wired into the container, retired the hardcoded "UK passport holder" assumption (SPEC-015 step 11). |

## Epic-level deviations

_None yet._

## Post-epic notes

_Filled when the epic closes._
