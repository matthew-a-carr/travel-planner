# SPEC-015: Visa Requirements — Data & Domain Modelling

**Date:** 2026-06-15
**Status:** Complete
**Author:** agent (interactive planning session)
**Approved by:** —
**Parent epic:** — (a "Visa requirements end-to-end" epic, covering UI
surfacing and trip-intent selection, is planned to follow via `draft-epic`)

> This SPEC is the **modelling foundation** for visa requirements: the
> reference data, the pure-domain evaluator, the traveller profile, and the
> one-off data-sourcing job. Where visa information surfaces in the UI and how
> a traveller chooses a trip intent (tourism vs working-holiday) are
> **deliberately deferred** to the follow-on epic. The modelling is built so
> that epic is "wire it to a panel", not "rethink the data".

---

## 1. Summary

A traveller planning a trip can be told, deterministically, what visa rules
apply to each country on their itinerary — based on the passport(s) they hold,
their age, and their travel dates. The model correctly handles staying a long
time in one country (across multiple cities), country groupings that share one
allowance (the Schengen Area's "90 days in any 180"), single- vs
multiple-entry visas, cooling-off periods before re-entry, and rules that
change over time. This SPEC delivers the data and domain layers only; a later
epic surfaces it in the UI.

## 2. Motivation

The app helps people plan multi-country trips but says nothing about whether
they're actually *allowed* to make the trip they're drawing. Visa rules are the
highest-value missing piece of planning truth: overstaying Schengen or assuming
a single-entry visa covers a side-trip are real, expensive mistakes. There's
even a hardcoded "UK passport holder" assumption already baked into
`src/infrastructure/ai/anthropic-timeline-insights.ts` — this SPEC replaces that
guess with a real, per-traveller model.

The design splits cleanly along a determinism boundary:

- **Evaluation is deterministic** — given a frozen rule table plus the trip's
  destinations/dates, the answer is a pure function. It lives in the domain
  layer and mirrors the existing `detectDeterministicFindings` vs AI
  `TimelineInsights` split.
- **Data acquisition is not** — visa policy is natural-language and changes, so
  it's gathered once, offline, by an AI-assisted extraction job and frozen into
  a committed, schema-validated, human-reviewed seed file (the
  `scripts/fetch-countries.ts` → `country-list-seed.ts` → `db:seed` pattern).
  No AI runs at request time.

## 3. Acceptance criteria

1. Given a traveller holding a `GBR` passport and a trip with two cities in one
   country totalling 100 days, when visas are assessed, then the country's
   `CountryStay.totalDays` is 100 (summed across cities) and a
   `max-stay-exceeded` violation is raised against a 90-day rule.
2. Given a trip visiting three Schengen countries totalling 95 days within a
   180-day window, when assessed, then a single zone-level
   `rolling-window-exceeded` violation is raised (90/180), not three per-country
   ones.
3. Given a single-entry rule and an itinerary that leaves and re-enters the same
   country, when assessed, then a `single-entry-multiple-entries` violation is
   raised; given a multiple-entry rule, none is.
4. Given a rule with `minDaysOutBeforeReturn = 60` and two stays 30 days apart,
   when assessed, then a `cooling-off-violated` violation is raised.
5. Given two rules for the same (nationality, destination) with overlapping
   validity windows, when assessed for a trip in that overlap, then the rule
   with the **latest `validFrom`** is selected.
6. Given a destination with no matching rule, when assessed, then its coverage
   `status` is `'unknown'` and it appears in `VisaAssessment.unknownCountries`
   (no error thrown).
7. Given a traveller aged 34 and an Australia trip, when assessed, then the
   Working Holiday rule is **eligible** (recorded in `alternativeRuleIds`) while
   the short-stay tourist rule is auto-selected; given a traveller aged 36, the
   Working Holiday rule is filtered out entirely.
8. Given a traveller holding two passports, when assessed, then per destination
   the **most favourable eligible** coverage is chosen and
   `CountryCoverage.appliedNationality` records which passport produced it.
9. `pnpm visa:fetch` produces a Zod-valid, committed `visa-rule-seed.ts`; `pnpm
   db:seed` idempotently upserts visa rules, zones, and zone membership.

## 4. Demo script

> No UI in this SPEC — the demo is the test suite + a seed run.

1. Run `pnpm test:unit` — the evaluator suite passes, including the Schengen
   90/180 boundary (89 days OK, 91 flagged), two-cities summation,
   single-vs-multiple-entry, cooling-off, temporal selection, and the Australia
   age-eligibility fixtures.
2. Run `pnpm db:seed` against a local Testcontainers Postgres; show `visa_rules`,
   `visa_zones`, `visa_zone_membership` populated with `GBR` data including
   Schengen and the Australia tourist + Working Holiday rows.
3. Run `pnpm test:integration` — `assess-trip-visas` reads real seeded rows and
   returns a `VisaAssessment` for a sample trip.
4. Show `git diff` of a re-run `pnpm visa:fetch` — the seed file is the
   reviewable record of AI-extracted policy (`source: 'ai-extracted'`,
   `sourceNote` citations).

## 5. Out of scope

- **All UI / UX** — no panel, route, or component. Deferred to the follow-on
  epic.
- **Trip-intent selection** (tourism vs working-holiday). The data model
  represents purpose and surfaces non-selected eligible rules via
  `alternativeRuleIds`, but choosing among them is an epic concern; v1 defaults
  to short-stay/tourism.
- **Non-UK nationalities** — the model is nationality-generic, but only `GBR`
  rules are seeded in this SPEC.
- **Visa cost/fee budgeting** — `'visas'` already exists as a `FixedCostCategory`;
  wiring assessment to budget is out of scope here.
- **Live/online lookups at request time** — explicitly excluded by design.
- **Automated factual correctness of policy data** — gated by human review of
  the seed diff, not by tests (see §8, §14).

## 6. Prerequisites

- AI Gateway access for the one-off extraction job (`AI_GATEWAY_API_KEY` locally,
  or Vercel OIDC) — ADR 040. Only needed to *run* `visa:fetch`, never at
  runtime.
- No other SPECs block this.

## 7. Design

> Source of truth: the approved modelling design. Country identity is **ISO
> alpha-3** (stable join key, unlike free-text `Destination.country`). Date-only
> values are ISO `YYYY-MM-DD` strings inside rules; `Date` only where they come
> from `Destination`.

### Data & domain

New subdomain `apps/web/src/domain/visa/` (zero external imports, pure,
`Result`-returning — per `src/domain/CLAUDE.md`).

**`types.ts`:**

- `Alpha3 = string` (ISO 3166-1 alpha-3).
- `Passport { nationality: Alpha3; label: string | null }`.
- `TravellerProfile { passports: readonly Passport[]; dateOfBirth: string | null }`
  — `passports` non-empty (v1 only `GBR`); `dateOfBirth` (ISO date-only,
  nullable) drives age eligibility; shape kept open for future attributes.
- `VisaPurpose = 'tourism' | 'business' | 'working-holiday' | 'transit' | 'study'`.
  Default selection considers short-stay purposes (`tourism`/`business`/`transit`).
- `Eligibility { minAgeYears: number | null; maxAgeYears: number | null; notes: string | null }`
  — `null` bounds = no constraint.
- `VisaCategory = 'visa-free' | 'visa-on-arrival' | 'e-visa' | 'eta' | 'visa-required' | 'admission-refused'`.
- `EntryType = 'single' | 'multiple'`.
- `RollingWindow { allowanceDays; windowDays }` — e.g. `{90, 180}`; `null` when
  the only limit is `maxStayDays` per visit.
- `VisaRule { id, nationality, destination, zoneCode: string | null, purpose,
  workRights: boolean, eligibility, category, maxStayDays: number | null,
  visaValidityDays: number | null, entryType, minDaysOutBeforeReturn: number |
  null, rollingWindow: RollingWindow | null, otherRequirements: readonly
  string[], validFrom: string, validTo: string | null, source: 'ai-extracted' |
  'manual', sourceNote: string | null }`. The Working Holiday "must leave by 36th
  birthday" age-out is captured by `eligibility.maxAgeYears = 35` + `maxStayDays`
  + an `otherRequirements` note (no separate field in v1).
- `CountryStay { destination, totalDays, entries, firstArrival, lastDeparture,
  segments }` — `segments: StaySegment[]` are merged-contiguous presence
  intervals; `entries` = count of distinct (gap-separated) segments.
- `StaySegment { start; end; days }`.
- `VisaViolationKind = 'max-stay-exceeded' | 'single-entry-multiple-entries' |
  'cooling-off-violated' | 'rolling-window-exceeded' | 'visa-required' |
  'admission-refused'`.
- `VisaViolation { kind; message; limit: number | null; actual: number | null }`.
- `CoverageStatus = 'ok' | 'action-needed' | 'violation' | 'unknown'`.
- `CountryCoverage { destination, zoneCode, appliedNationality: Alpha3 | null,
  status, appliedRuleId: string | null, category: VisaCategory | null, purpose:
  VisaPurpose | null, workRights: boolean, stay: CountryStay, violations,
  otherRequirements, alternativeRuleIds: readonly string[] }` —
  `alternativeRuleIds` surfaces other *eligible* rules not auto-selected (the
  hook the epic's intent selector hangs off).
- `VisaAssessment { coverages: readonly CountryCoverage[]; unknownCountries: readonly Alpha3[] }`.

Missing rules are a **domain outcome** (`status: 'unknown'`), not an error —
matching `findReference` returning `null`.

### Behaviour

**`visa.ts` — pure evaluator** (reuses `destinationDays`,
`timelineDateRange`):

- `aggregateCountryStays(destinations, toAlpha3, zoneOf)` — maps each
  `Destination.country` to alpha-3 via injected resolver, groups by
  `zoneOf(alpha3) ?? alpha3` (Schengen countries bucket together), sums days,
  merges contiguous/overlapping ranges into `segments`, counts gap-separated
  segments as `entries`. Undated destinations contribute nothing. Returns
  `Result<readonly CountryStay[]>`.
- `filterEligibleRules(candidateRules, profile, travel)` — computes age at
  `travel.start` from `profile.dateOfBirth`, drops rules whose age bounds exclude
  it. `null` DOB → age-bounded rules kept but flagged eligibility-unknown (not
  silently dropped).
- `selectApplicableRule(candidateRules, travel, { preferPurposes })` — temporal
  selection over *eligible* rules, scoped by default to short-stay purposes.
  Working-holiday/study rules are eligible candidates but not auto-selected in v1
  → they flow into `alternativeRuleIds`. Returns `Result<VisaRule | null>`.
- `evaluateCoverage(stay, rule)` — pure; computes every violation kind: category
  gate, per-segment `max-stay-exceeded`, `single-entry` when `entries > 1`,
  `cooling-off` when a gap `< minDaysOutBeforeReturn`, and the rolling window.
  Derives `status`.
- `evaluateRollingWindow(segments, window)` — factored out for direct testing;
  the canonical Schengen 90/180 check over merged segments. Returns
  `{ exceeded, peakDays, peakOn }`.
- `pickBestCoverage(coverages)` — multi-passport auto-best: rank by `status`
  (`ok` > `action-needed` > `violation` > `unknown`), then `category`
  (visa-free > visa-on-arrival > e-visa > eta > visa-required >
  admission-refused), then larger `maxStayDays`, then `multiple` > `single`,
  tie-broken by `appliedNationality`.
- `assessVisas(profile, destinations, rulesByNatDest, toAlpha3, zoneOf, travel)`
  — orchestrates the pure pipeline: aggregate once → per country, per passport
  `filterEligibleRules` → `selectApplicableRule` → `evaluateCoverage` →
  `pickBestCoverage` (recording non-selected eligible rules as
  `alternativeRuleIds`) → assemble `VisaAssessment`. Pure.

Modelling notes: `entries` counts merged segments, not raw rows (two cities on
contiguous dates = 1 entry; a return after leaving = 2). `maxStayDays` is
per-segment; the rolling window limits the aggregate — both can fire.

**Temporal selection:** travel window = `timelineDateRange(destinations)` as ISO
date-only. A rule matches when `validFrom <= travel.end && (validTo ?? +∞) >=
travel.start`. 0 matches → `ok(null)` → `'unknown'`. >1 → newest `validFrom`
wins, tie-broken by `id`. No dated destinations → report category/maxStay
informationally; window-dependent checks `'unknown'`.

**Repository interface** (`visa-rule-repository.ts`, impl in infrastructure):
`findByNationalitiesAndDestinations(nationalities, destinations)` +
`findByNationality(nationality)`. Read-only, like `CountryReferenceRepository`.

**Application use case** (`assess-trip-visas.ts`): read-only orchestration —
load destinations + the signed-in user's passports/DOB + zone membership +
matching rules, build `toAlpha3`/`zoneOf` resolvers from
`CountryReferenceRepository` + `visa_zone_membership`, call pure `assessVisas`,
return `Result<VisaAssessment>`.

### Storage & migrations

Add to `apps/web/src/infrastructure/db/schema.ts` (conventions: `text`
enums-by-convention, `date` columns, `jsonb` arrays, idempotent unique index):

- **`visa_rules`**: `id uuid pk defaultRandom`, `nationality text`, `destination
  text`, `zone_code text` (nullable), `purpose text default 'tourism'`,
  `work_rights boolean default false`, `min_age_years integer` (nullable),
  `max_age_years integer` (nullable), `eligibility_notes text` (nullable),
  `category text`, `max_stay_days integer` (nullable), `visa_validity_days
  integer` (nullable), `entry_type text default 'single'`,
  `min_days_out_before_return integer` (nullable), `rolling_allowance_days
  integer` + `rolling_window_days integer` (both-or-neither, validated in
  mapper/Zod), `other_requirements jsonb default '[]'`, `valid_from date
  notNull`, `valid_to date` (nullable = open-ended), `source text default
  'ai-extracted'`, `source_note text`, `created_at`/`updated_at`.
  Indexes: `idx_visa_rules_nat_dest (nationality, destination)`,
  `idx_visa_rules_zone (zone_code)`, unique
  `uq_visa_rules_nat_dest_purpose_from (nationality, destination, purpose,
  valid_from)` as the idempotent seed target (`purpose` in the key so tourist +
  working-holiday rows coexist).
- **`visa_zones`**: `{ code PK ('SCHENGEN'), name, rolling_allowance_days,
  rolling_window_days, notes }`.
- **`visa_zone_membership`**: `{ zone_code FK, alpha3 }`, composite PK (junction
  pattern, like `organization_memberships`). Seeded with the ~29 Schengen
  members.
- **`user_passports`**: `{ user_id FK, nationality (alpha3), label, sort_order }`,
  composite PK `(user_id, nationality)`.
- **`users.date_of_birth date`** (nullable) — drives age eligibility (PII —
  §8).

Rationale: two `date` columns (not pg `daterange`) keep the Drizzle mapper
trivial and match `destinations.start_date/end_date`; rolling window flattened
to two nullable ints (queried/validated, not opaque); `text` enums match
`comfort_level`/`status`. Migration via `pnpm db:generate` →
`pnpm db:check:migrations` → `pnpm db:migrate`.

### External integrations

Vercel AI Gateway (ADR 040), **only** inside the one-off `visa:fetch` script via
a `VisaRuleExtractor` port (`generateObject` + Zod). The runtime evaluator and
use case never call AI. Extraction emits one-or-more rules per destination (e.g.
Australia → tourist + working-holiday), flattened into seed rows keyed by
purpose. Zod validates: alpha-3 `destination`; `purpose`/`category`/`entry_type`
enums; `work_rights` boolean; `min_age_years`/`max_age_years` nullable
non-negative with `min <= max`; nullable positive ints;
`rollingWindow.allowanceDays <= windowDays`; bounded `otherRequirements`;
non-empty `sourceNote` (forces a citation).

### UI / UX

N/A — deferred to the follow-on epic. Hooks left in place: `CountryCoverage`
maps cleanly onto the existing `TimelineFinding` shape (`'visa-required'` is
already a finding kind), and `alternativeRuleIds` feeds a future trip-intent
selector.

## 8. Security & data considerations

- **PII — date of birth.** New `users.date_of_birth`. Store minimally; keep it
  out of logs and out of AI prompts; only ever read the signed-in user's own
  DOB. Age is derived in-domain, never persisted alongside marketing/analytics.
- **Authorisation.** `assess-trip-visas` reads only the requesting user's
  passports/DOB and their own trip's destinations (org-scoped, per existing trip
  access rules).
- **AI output is untrusted policy data.** The extraction job's output is
  schema-validated (shape) but factual correctness is **not** test-guaranteed —
  gated by mandatory human review of the seed PR diff. Conservative prompt
  ("emit only well-established policy; note uncertainty"); forced `sourceNote`
  citations; `source: 'ai-extracted'` provenance so a reviewer can promote
  verified rows to `'manual'`.
- **Secrets needed:** AI Gateway credential to *run* `visa:fetch` only.

## 9. Test plan

Tests written **before** implementation (CONSTITUTION.md §3).

### E2E (Playwright / Maestro)

N/A — no UI in this SPEC. E2E lands with the UI epic.

### Integration (Vitest + Testcontainers)

| Test file | What it covers |
|---|---|
| `drizzle-visa-rule-repository.int-test.ts` | Seeded rules round-trip; lookup by nationalities + destinations; zone membership join |
| `assess-trip-visas.int-test.ts` | Use case over real seeded rows: GBR trip → `VisaAssessment` incl. Schengen + Australia rows |

### Unit (Vitest)

| Test file | What it covers |
|---|---|
| `visa.test.ts` | `aggregateCountryStays` (two-cities summation, contiguous-vs-gapped segments, entry counting); `selectApplicableRule` (0/1/many, newest-wins, open-ended `validTo`); `evaluateCoverage` (max-stay, single-entry, cooling-off, category gate); `evaluateRollingWindow` (Schengen 89 OK / 91 flagged, multi-country summation); `filterEligibleRules` (age 34 eligible, 36 excluded, null DOB flagged); `pickBestCoverage` ordering; purpose-default selection (tourist auto-selected, Working Holiday → `alternativeRuleIds`) |
| `fetch-visa-rules.test.ts` | Zod schema + deterministic sanity checks + seed serialiser over fixture candidates (no network) |

### Manual checks

- Review the generated `visa-rule-seed.ts` diff for factual correctness before
  committing (the irreducible human-review gate).

## 10. Observability

- **Logs:** `assess-trip-visas` logs a structured summary (trip id, country
  count, violation count) — **never** DOB or raw age.
- **Metrics:** count of assessments run and of assessments containing at least
  one violation (feeds the future UI epic's value measurement).
- **Sentry:** the extraction script reports parse/validation failures; the
  runtime path has no AI and no new external failure mode.

## 11. Rollback / safety

Additive only — new tables and a new read-only use case; no change to existing
behaviour. Rollback = revert the migration (drop new tables) and the code. No
production data is mutated; seeded reference data is idempotent and
re-runnable. No feature flag needed because nothing user-facing ships here.

## 12. Implementation order

> **Status (2026-06-16):** steps 1–9 + 12 are implemented. PR #160 landed the
> foundation (schema/migration, the full pure evaluator with 22 unit tests, the
> repository + int-test, the initial hand-authored GBR seed, the
> `assess-trip-visas` use case + int-test, ADR 061 + doc sync). A follow-up
> adds **step 9** — the `VisaRuleExtractor` port + `GatewayVisaRuleExtractor`
> adapter + `fetch-visa-rules` script (`pnpm visa:fetch`) + Zod schema +
> deterministic sanity-check/serialiser unit tests, writing into the
> AUTO-GENERATED `visa-rule-ai-seed.ts`. **Both remaining steps have now landed:**
> **step 11** (replace the hardcoded "UK passport holder" assumption) shipped with
> the Visas panel (EPIC-005 slice 3, SPEC-017), and **step 10** (broad GBR seed +
> human-reviewed diff) shipped via the SPEC-019 extraction skill — the gateway
> `visa:fetch`/`visa-rule-ai-seed.ts` path of step 9 was **superseded by ADR 062**
> (subscription Agent-SDK/Codex artifacts ingested at deploy). SPEC is now
> **Complete**.

1. [ ] **Intent:** `visa_rules` / `visa_zones` / `visa_zone_membership` /
   `user_passports` / `users.date_of_birth` schema + migration. **Verification:**
   `pnpm db:generate && pnpm db:check:migrations`; migration is transactional.
2. [ ] **Intent:** domain `types.ts` + failing `visa.test.ts` for
   `aggregateCountryStays`. **Verification:** red test.
3. [ ] **Intent:** implement `aggregateCountryStays`. **Verification:** green;
   architecture test (zero external imports) passes.
4. [ ] **Intent:** `selectApplicableRule` + `filterEligibleRules` (temporal +
   age). **Verification:** unit tests incl. newest-wins, age 34/36.
5. [ ] **Intent:** `evaluateCoverage` + `evaluateRollingWindow`.
   **Verification:** Schengen 90/180 + single-entry + cooling-off fixtures green.
6. [ ] **Intent:** `pickBestCoverage` + `assessVisas` orchestration.
   **Verification:** multi-passport + purpose-default fixtures green.
7. [ ] **Intent:** `VisaRuleRepository` interface + Drizzle impl + mapper.
   **Verification:** `drizzle-visa-rule-repository.int-test.ts` green.
8. [ ] **Intent:** seed `visa_zones`/membership (Schengen) + extend `seed.ts`
   upsert. **Verification:** `pnpm db:seed` idempotent (run twice).
9. [ ] **Intent:** `VisaRuleExtractor` port + AI adapter + `fetch-visa-rules.ts`
   + Zod + `fetch-visa-rules.test.ts`; wire `pnpm visa:fetch`. **Verification:**
   unit tests green; a dry run produces a Zod-valid seed for a sample.
10. [ ] **Intent:** generate the `GBR` seed (incl. Australia tourist +
    Working Holiday), human-review the diff, commit. **Verification:** seed
    review + `assess-trip-visas.int-test.ts` green.
11. [ ] **Intent:** replace the hardcoded "UK passport holder" assumption in
    `anthropic-timeline-insights.ts` with the traveller profile.
    **Verification:** existing insights tests still green.
12. [ ] **Intent:** ADR 061 + docs sweep (`db` AGENTS.md, README database
    section, decisions index). **Verification:** `sync-docs` checks pass.

## 13. ADR triggers and tech-debt review

### ADR?

- [x] New library, external tool, or vendor — *uses existing AI Gateway, but the
  AI-extraction-to-frozen-seed sourcing strategy is a novel pattern.*
- [ ] CI pipeline or workflow structural change
- [x] New project-wide standard — *temporal reference-data shape (valid_from /
  valid_to selection) and the determinism boundary for AI-sourced data.*
- [x] Non-obvious architectural trade-off — *deterministic runtime over a frozen,
  AI-extracted, human-reviewed seed; first-class zone allowances.*
- [ ] Cross-cutting decision not already settled by the parent epic

**ADRs to write:** ADR 061 — "Visa requirements: deterministic evaluation over
an AI-extracted frozen seed, with first-class zones." Update
`docs/decisions/README.md`.

### Tech debt

- [x] Reviewed `docs/tech-debt.md`.

**Tech debt items addressed by this spec:** removes the hardcoded "UK passport
holder" assumption in `anthropic-timeline-insights.ts`. (Confirm against the
register at implementation time; log any newly-discovered items.)

## 14. Risks & open questions

- **Factual accuracy of seeded policy** is the irreducible risk — mitigated by
  human review of the seed diff, conservative prompting, forced citations, and
  `source` provenance, not by tests. Wrong data is a reviewable bug, never
  runtime non-determinism.
- **Seed breadth.** First pass may only fully populate high-traffic
  destinations for `GBR`; long-tail countries resolve to `'unknown'` (a safe,
  honest outcome) until seeded. Acceptable for the modelling foundation.
- **SPEC size.** This is a large single unit (schema + evaluator + sourcing). It
  could be split (Slice 1 reference model, Slice 2 evaluator, Slice 3 traveller
  profile) if review prefers — the §12 order is already sliced along those
  seams. Flagged for the reviewer.
- **"Most favourable" ordering** in `pickBestCoverage` is a heuristic, not a
  legal total order; it only chooses among *eligible short-stay* rules, and the
  alternatives remain visible via `alternativeRuleIds`, so the epic's intent
  selector can override.

---

## Implementation Deviations

| # | Deviation | Reason | Impact | Resolved? |
|---|-----------|--------|--------|-----------|
| 1 | `evaluateCoverage` returns a `CoverageEvaluation`, not a full `CountryCoverage`; `pickBestCoverage` tie-breaks on fewer-violations rather than `maxStayDays`/`entryType`; `CountryStay` gained a `countries` field | `evaluateCoverage` can't know the passport; `CountryCoverage` doesn't carry the dropped tie-break fields; zone groups need member countries for rule lookup | None on behaviour — all acceptance criteria covered by tests | Yes |

### Post-Implementation Notes

_To be filled by the implementing agent._
