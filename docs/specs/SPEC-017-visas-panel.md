# SPEC-017: Visas Panel on the Trip Page (Milestone)

**Date:** 2026-06-16
**Status:** Complete
**Author:** agent (interactive session)
**Approved by:** —
**Parent epic:** [EPIC-005](../epics/EPIC-005-visa-requirements-end-to-end.md) — slice 3 (milestone)

> The payoff slice: the trip detail page shows a **Visas** panel built from the
> `assess-trip-visas` evaluator (slice 1) and the traveller's saved profile
> (slice 2). Also retires the hardcoded "UK passport holder" assumption in the AI
> timeline insights. Inherits EPIC-005 §10 (web-first; read via `getAppContainer()`;
> deterministic, no runtime AI for the assessment). Per-trip intent selection is
> slice 4 — this slice defaults to short-stay/tourism.

---

## 1. Summary

A user opens a trip and sees a **Visas** panel: for each country (or shared zone
like Schengen) on the itinerary, its status, the visa category, days planned, and
any warnings — Schengen 90/180 overstay, single-entry re-entry, cooling-off,
max-stay. The advice is personalised to the passport(s) and date of birth they
set on their profile. If they have no passport on file, the panel points them to
Settings → Profile.

## 2. Motivation

Slices 1–2 built the evaluator and the profile but nothing surfaces the answer.
This slice makes the feature real and visible — the first time a user can see
whether their itinerary is actually permitted. It also retires the lingering
hardcoded "UK passport holder" assumption in `anthropic-timeline-insights.ts`
(SPEC-015 §12 step 11) now that a real per-user nationality is available.

## 3. Acceptance criteria

1. Given a signed-in user with a `GBR` passport and a trip whose dated
   destinations sum to >90 days across Schengen countries, when they open the
   trip, then the Visas panel shows one **Schengen Area** entry with a `danger`
   "90 days in any 180" warning.
2. Given a trip to a single visa-free country within its limit, when opened, then
   that country shows an `ok` status with its category (e.g. "Visa-free") and the
   days planned.
3. Given a destination with no matching rule (or the user has no passport on
   file), when opened, then it shows an honest "No visa data" / unknown state —
   never a confident wrong answer.
4. Given a user with no passports saved, when they open a trip, then the panel
   shows a prompt linking to **Settings → Profile**.
5. Given a trip with no dated destinations, when opened, then the panel shows a
   gentle empty state (no crash).
6. Given the AI timeline insights run, then the prompt uses the traveller's
   **actual** nationality rather than a hardcoded "UK passport holder" (defaulting
   to the United Kingdom only when no profile nationality is available).

## 4. Demo script

1. Sign in, ensure a `GBR` passport is saved (Settings → Profile).
2. Open a trip with France 40d + Italy 30d + Spain 25d → the **Visas** panel
   shows **Schengen Area · Issue · "95 days planned, limit is 90 in any 180"**.
3. Open a trip with Japan 20d → **Japan · OK · Visa-free · 20 days planned**.
4. Open a trip to a country with no seeded rule → **No visa data yet**.
5. Remove all passports → the panel shows "Add your passport in Settings →
   Profile".

## 5. Out of scope

- **Per-trip intent selector** (tourism vs working-holiday) — slice 4. Defaults to
  short-stay here; working-holiday alternatives are computed but not surfaced as a
  selector yet.
- **Editing visa data / fees / budget wiring** — EPIC-005 §6.
- **Mobile** — web only (EPIC-005 §10).
- **A `/api/v1` visa endpoint** — the panel reads server-side via the use case.

## 6. Prerequisites

- SPEC-015 + SPEC-016 merged (evaluator, use case, profile read path, seeded GBR
  rules incl. Schengen). No new migration.

## 7. Design

### Data & domain

No new domain. Reuses `VisaAssessment` / `CountryCoverage` (`domain/visa/types.ts`)
and `TravellerProfile`.

### Behaviour

- **Container:** register `visaRuleRepository` (`DrizzleVisaRuleRepository`) in
  `create-app-container.ts` + `types.ts` (it was added in SPEC-015 but never
  wired, since nothing called it at runtime).
- **Trip detail page** (`app/trips/[id]/page.tsx`, server component): additionally
  resolves the signed-in user's profile (`getTravellerProfile`) and runs
  `assessTripVisas(destinationRepository, countryReferenceRepository,
  visaRuleRepository, { tripId, profile })` in the existing `Promise.all`. Passes
  the assessment + country references to the panel. On `Result` error, renders the
  panel's empty state (logged, never throws).
- **Retire the hardcoded assumption:** add an optional `nationalities?: readonly
  string[]` (country display names) to `AnalyseTimelineInput` (the
  `TimelineInsightsService` port). `analyse-trip-timeline` gains a `nationalities`
  param (default `[]`); the timeline page builds it from the user's profile +
  country references (falling back to `['United Kingdom']`). The adapter
  interpolates it into the prompt: "for a passport holder from
  {names.join(' or ')}" — defaulting to "the United Kingdom" when empty, so
  existing callers/tests are unaffected. The cache key naturally varies by
  nationality.

### Storage & migrations

**N/A — no schema change.**

### External integrations

The AI timeline insights prompt is updated (above); the **visa assessment uses no
AI at runtime** (ADR 061).

### UI / UX

- New `ui/components/VisasPanel.tsx` (server component, presentational): a card
  titled "Visas" with one row per `CountryCoverage`, mirroring
  `TimelineInsightsPanel` severity styling (status → badge: `ok`→green,
  `action-needed`→amber, `violation`→red, `unknown`→zinc). Each row shows the
  resolved country/zone name (alpha-3 → `CountryReference.country`; `SCHENGEN` →
  "Schengen Area"), category label, "{days} days planned" (+ entries when >1),
  violation messages, and any `otherRequirements`. Empty/unknown and
  no-passport states per §3.
- Placed on the trip page after the narrative panel, before fixed costs.
- A subtle footer line links to `/settings/profile` ("Based on your saved
  passports").
- Accessibility: the panel is a labelled `section`; status is conveyed by text
  (not colour alone). WCAG 2.1 AA (ADR 007).

## 8. Security & data considerations

- The assessment reads only the requesting user's own profile and a trip they can
  already see (existing org-scoped trip access on the page). No new authz surface.
- No DOB/nationality is logged or sent to the AI insights prompt beyond the
  derived nationality **display name(s)** (e.g. "United Kingdom") — not the DOB.
- Visa advice is informational; the panel copy notes policies change.

## 9. Test plan

### E2E (Playwright)

| Test file | Scenario |
|---|---|
| `tests/e2e/13-visas-panel.spec.ts` | Seed a `GBR` passport for the test user + a Schengen-overstay trip → open trip → assert the Schengen `danger` warning is visible (AC1) |

### Integration (Vitest + Testcontainers)

N/A new — `assess-trip-visas.int-test.ts` already covers the use case; the page
wiring is exercised by e2e. (Container change is covered by the guard tests.)

### Unit (Vitest)

| Test file | What it covers |
|---|---|
| `VisasPanel.test.tsx` (or a pure `visa-panel-view` helper test) | status→severity mapping, alpha-3/zone name resolution, days/entries summary, empty + no-passport states |

### Manual checks

- Keyboard/screen-reader pass over the panel; colour-blind check (text labels).

## 10. Observability

- Logs: the page logs a structured assessment summary (trip id, coverage count,
  violation count) — never DOB.
- Metrics: count of trip views with at least one visa violation surfaced.
- Sentry: assessment errors are caught on the page and reported; the panel
  degrades to its empty state.

## 11. Rollback / safety

Additive: one new panel + one container registration + an optional prompt field.
No schema change. Rollback = revert the PR. The panel fails soft (empty state) if
the assessment errors, so it can't break the trip page.

## 12. Implementation order

1. [ ] **Intent:** register `visaRuleRepository` in the container.
   **Verification:** container guard tests + type-check.
2. [ ] **Intent:** pure `visa-panel-view` helper (coverage → view model) + unit
   test. **Verification:** unit tests green.
3. [ ] **Intent:** `VisasPanel` component using the helper.
   **Verification:** type-check, lint.
4. [ ] **Intent:** wire profile + `assessTripVisas` into the trip page, render the
   panel. **Verification:** `pnpm build`.
5. [ ] **Intent:** retire the hardcoded passport assumption (port field + use-case
   param + adapter interpolation + timeline page wiring).
   **Verification:** existing insights tests still green; type-check.
6. [ ] **Intent:** seed visa reference data in the e2e global setup + the panel
   e2e spec. **Verification:** `pnpm test:e2e:web` (CI).
7. [ ] **Intent:** docs sync (AGENTS.md, EPIC ledger, SPEC-016 → Complete).
   **Verification:** `sync-docs`.

## 13. ADR triggers and tech-debt review

### ADR?

- [ ] New library, external tool, or vendor
- [ ] CI pipeline or workflow structural change
- [ ] New project-wide standard
- [ ] Non-obvious architectural trade-off
- [ ] Cross-cutting decision not already settled by the parent epic

**ADRs to write:** none — reuses settled patterns + EPIC-005 decisions.

### Tech debt

- [x] Reviewed `docs/tech-debt.md`. This slice **resolves** the hardcoded
  "UK passport holder" assumption (SPEC-015 §12 step 11).

**Tech debt items addressed:** the hardcoded passport assumption in
`anthropic-timeline-insights.ts`.

## 14. Risks & open questions

- **No-passport default.** With no profile passports, coverages are `unknown`; the
  panel must guide the user to add one rather than look broken. Covered by AC4.
- **Country-name resolution.** Free-text `Destination.country` is mapped to alpha-3
  via `CountryReference`; unmapped countries fall through to the evaluator's
  `unknown`. Acceptable and honest.
- **Insights prompt change** is kept backward-compatible (optional field, default
  wording) to avoid disturbing the existing timeline feature.

---

## Implementation Deviations

| # | Deviation | Reason | Impact | Resolved? |
|---|-----------|--------|--------|-----------|
| 1 | The "UK passport holder" removal was done via an optional `nationalities` field + defaulted use-case param (not a required field) | Keep the existing timeline-insights feature/tests undisturbed | None — default preserves prior wording when no profile nationality | Yes |

### Post-Implementation Notes

- The Visas panel reads server-side via `getAppContainer()` → `assess-trip-visas`
  (no AI at runtime, ADR 061). It fails soft: a `Result` error renders the
  empty/no-data state and logs, so it can never break the trip page.
- `visaRuleRepository` was added to the container in this slice — SPEC-015 created
  the repository but nothing called it at runtime until now.
- SPEC-015 §12 step 11 (hardcoded "UK passport holder") is **resolved** here.
- The remaining EPIC-005 work is slice 4 (per-trip intent selector) and slice 5
  (broad GBR seed via `pnpm visa:fetch` + human review, needs an AI key).
- Integration + e2e are CI-gated (Docker Hub rate limit in the sandbox); unit
  (484), lint, type-check, and `pnpm build` pass locally.
