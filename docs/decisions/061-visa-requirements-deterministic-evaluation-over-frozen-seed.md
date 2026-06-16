# ADR 061: Visa Requirements — Deterministic Evaluation over an AI-Extracted Frozen Seed, with First-Class Zones

**Date:** 2026-06-15
**Status:** Accepted

## Context

Travellers planning multi-country trips need to know whether their itinerary is
permitted: maximum stays, the Schengen Area's "90 days in any 180" shared
allowance, single- vs multiple-entry visas, cooling-off periods, and rules that
differ per passport and per traveller age (e.g. Australia's Working Holiday
visa). SPEC-015 introduces this model.

Visa policy is natural-language, jurisdiction-specific, changes over time, and
is not available as a clean machine-readable feed keyed on
(nationality × destination). So two things are in tension: the *answer* a
traveller sees must be stable and testable, but the *data* behind it can only be
gathered from prose sources.

A few cross-cutting choices needed settling once for the whole feature:

- Where does non-determinism live — at request time, or at data-acquisition time?
- How are country groupings that share one allowance (Schengen) modelled?
- How is temporal validity (a rule that applied last year but not this year)
  represented and selected?

## Decision

**Split the system along a determinism boundary.**

1. **Runtime evaluation is deterministic.** Given the frozen rule table plus a
   trip's destinations/dates and the traveller's passports/DOB, the assessment
   is a pure function (`src/domain/visa/`) — DB reads + arithmetic, no I/O, no
   AI, `Result`-returning. This mirrors the existing
   `detectDeterministicFindings` vs AI `TimelineInsights` split.

2. **Data acquisition is AI-assisted but frozen.** Visa rules are gathered once,
   offline, by an AI-assisted extraction job and committed to a
   schema-validated, **human-reviewed** seed file (`visa-rule-seed.ts`), the same
   `fetch-countries.ts → country-list-seed.ts → db:seed` pattern. Rows carry a
   `source` (`ai-extracted` | `manual`) and a required citation `sourceNote`.
   **No AI runs at request time.** A wrong rule is therefore a reviewable data
   bug in a PR diff, never runtime non-determinism.

3. **Zones are first-class.** A `visa_zones` + `visa_zone_membership` pair models
   shared-allowance groupings (the Schengen Area). Stay accounting groups
   destinations by `zone ?? country`, so days sum across all member countries and
   the rolling-window allowance is evaluated once at zone level.

4. **Temporal validity by `[valid_from, valid_to]` intersection.** Each rule
   carries a validity window; the rule whose window intersects the trip's travel
   dates is selected, newest `valid_from` winning on overlap.

5. **Multi-passport, auto-best, eligibility-filtered.** Every passport is
   evaluated; ineligible rules (age bounds vs DOB) are filtered out; the most
   favourable eligible coverage is chosen per destination. Non-selected eligible
   rules (e.g. a Working Holiday visa) are surfaced as alternatives for a future
   trip-intent selector.

## Consequences

- **Easier:** the product's actual logic (stay maths, Schengen 90/180,
  entry/cooling-off, eligibility, passport selection) is 100% unit-testable and
  reproducible; the runtime has no new external failure mode; correctness of
  policy is a reviewable diff, not a silent model call.
- **Harder / accepted cost:** factual accuracy of the seed is gated by human
  review, not by tests — the irreducible cost of sourcing prose policy. Data goes
  stale and must be refreshed by re-running the extraction job and re-reviewing.
  Countries without a rule resolve to a safe, honest `unknown` rather than a
  guess.
- **PII:** age eligibility introduces `users.date_of_birth`. It is stored
  minimally, kept out of logs and AI prompts, and read only for the signed-in
  user.
- This boundary is inherited by EPIC-005's later slices (profile capture, the
  Visas panel, the trip-intent selector) and is out of scope for per-slice
  re-litigation.
