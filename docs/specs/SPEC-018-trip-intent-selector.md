# SPEC-018: Per-Trip Visa Intent Selector

**Date:** 2026-06-16
**Status:** Complete
**Author:** agent (interactive session)
**Approved by:** —
**Parent epic:** [EPIC-005](../epics/EPIC-005-visa-requirements-end-to-end.md) — slice 4

> Slice 4. The Visas panel (slice 3) defaults to short-stay/tourism. This slice
> lets a traveller set a **per-trip intent** (Tourism / Working holiday / Long
> stay); the assessment re-runs against that intent, so "go to Australia to live"
> resolves to the Working Holiday visa instead of the 90-day tourist rule.
> Resolves EPIC-005 §13 Q1 (per-trip, not per-destination) and Q2 (persisted on
> the trip).

---

## 1. Summary

On the trip's Visas panel, the user picks an **intent** for the trip. Changing it
re-assesses every country against that intent and persists the choice on the
trip, so the warnings are stable across sessions. For Australia, switching to
"Working holiday" surfaces the age-eligible 12-month work visa instead of the
tourist eVisitor.

## 2. Motivation

The model already computes working-holiday alternatives (`alternativeRuleIds`)
and `assess-trip-visas` already accepts `preferPurposes`; nothing lets the user
choose. This slice wires a persisted trip-level intent to that input — the last
piece that makes the headline "live in Australia" journey checkable.

## 3. Acceptance criteria

1. Given a trip with the default intent, when the user opens it, then the Visas
   panel shows an **intent selector** defaulting to "Tourism".
2. Given an Australia trip and an age-eligible traveller (GBR passport, under 35),
   when the user switches intent to "Working holiday", then the Australia row
   re-assesses to the Working Holiday rule (work rights, ~12 months) and the
   choice persists across a reload.
3. Given any trip, when the user changes intent, then the new intent is saved on
   the trip (`trips.intent`) and used on subsequent loads.
4. Given an invalid intent value submitted, when processed, then it is rejected
   and nothing is persisted.
5. Given a user who is not a member of the trip's organisation, when they submit
   an intent change, then it is rejected (authorised like the trip page).

## 4. Demo script

1. Open an Australia trip (GBR passport on file, DOB making the traveller 30).
2. The Visas panel shows **Tourism** selected; Australia = "Travel authorisation
   (ETA), 90 days".
3. Change the selector to **Working holiday** → the panel re-assesses: Australia
   now shows the Working Holiday visa (work rights, up to 365 days).
4. Reload → **Working holiday** is still selected and applied.

## 5. Out of scope

- **Per-destination** intent — §13 Q1 settled as per-trip.
- New visa categories/seed data — uses the existing seeded AUS rules.
- Surfacing every alternative as individually selectable — the selector maps
  intent → purpose preference; the evaluator picks the best matching rule.

## 6. Prerequisites

- SPEC-015–017 merged (evaluator + `preferPurposes`, profile, panel). A new
  migration adds `trips.intent`.

## 7. Design

### Data & domain

- `domain/trip/types.ts`: `TripIntent = 'tourism' | 'working-holiday' |
  'long-stay'`, a `TRIP_INTENTS` array, and an `isTripIntent` guard.
- `domain/visa/visa.ts`: pure `preferPurposesForIntent(intent): VisaPurpose[]`:
  `tourism → ['tourism','business','transit']`,
  `working-holiday → ['working-holiday']`,
  `long-stay → ['working-holiday','study']`. Unit-tested.
- **Intent is a focused per-trip setting, not part of the `Trip` aggregate** —
  accessed via two new `TripRepository` methods (`getIntent`, `setIntent`) to
  avoid churning the ~20 `Trip` construction sites. (Deviation candidate noted.)

### Behaviour

- `TripRepository.getIntent(tripId): Promise<TripIntent | null>` (null if trip
  absent) and `setIntent(tripId, intent): Promise<void>` — Drizzle impl reads/
  writes the `trips.intent` column.
- Use case `set-trip-intent.ts`: validate the intent, confirm the trip exists,
  persist. Returns `Result<TripIntent>`. (+ int-test.)
- Trip page: reads the intent (`getIntent`), maps it via
  `preferPurposesForIntent`, and passes `preferPurposes` to `assessTripVisas`.

### Storage & migrations

Add `intent text NOT NULL DEFAULT 'tourism'` to `trips`. Additive, transactional;
existing rows default to tourism.

### External integrations

N/A.

### UI / UX

- `ui/components/TripIntentSelector.tsx` (client): a labelled `<select>`
  (Tourism / Working holiday / Long stay) inside a `<form action>` that
  auto-submits on change (`requestSubmit`) with an "Apply" button fallback for
  no-JS; uses `useActionState`. Rendered in the Visas panel header.
- `app/trips/[id]/visa-intent-actions.ts`: `setTripIntentAction` — authorises
  (session user is a member of the trip's org, like the page), calls the use
  case, `revalidatePath('/trips/[id]')`.
- Accessibility: the select has a visible label; keyboard-operable; the form
  works without JS via the Apply button. WCAG 2.1 AA.

## 8. Security & data considerations

- **Authorisation:** the action re-checks org membership for the trip (never
  trusts the form for identity); a non-member's change is rejected (AC5).
- Intent is non-sensitive trip metadata. Input is validated against the closed
  `TripIntent` set.

## 9. Test plan

### E2E (Playwright)

| Test file | Scenario |
|---|---|
| `tests/e2e/14-trip-intent.spec.ts` | Australia trip + eligible GBR traveller → switch to Working holiday → panel re-assesses to the work visa + persists on reload (AC2) |

### Integration (Vitest + Testcontainers)

| Test file | What it covers |
|---|---|
| `set-trip-intent.int-test.ts` | persists + reads back; rejects invalid intent (AC4); trip-not-found |
| `drizzle-trip-repository.int-test.ts` (extend) | `getIntent` default + `setIntent` round-trip |

### Unit (Vitest)

| Test file | What it covers |
|---|---|
| `visa.test.ts` (extend) | `preferPurposesForIntent` mapping for each intent |
| `trip.test.ts` (extend) | `isTripIntent` guard |

### Manual checks

- Keyboard-only: tab to the select, change with arrows, confirm re-assessment.

## 10. Observability

- Logs: the action logs `{ tripId, intent }` on change (no PII).
- Metrics: count of intent changes (adoption of the working-holiday path).

## 11. Rollback / safety

Additive: one nullable-with-default column, two repo methods, one use case, one
selector. Existing trips default to tourism (current behaviour). Rollback =
revert PR + drop the column.

## 12. Implementation order

1. [ ] **Intent:** `TripIntent` + guard (`trip/types.ts`) + `preferPurposesForIntent`
   (`visa/visa.ts`) + unit tests. **Verification:** unit green.
2. [ ] **Intent:** `trips.intent` schema + migration. **Verification:**
   `db:generate` + `db:check:migrations`.
3. [ ] **Intent:** `TripRepository.getIntent/setIntent` + Drizzle impl + extend
   repo int-test. **Verification:** repo int-test (CI).
4. [ ] **Intent:** `set-trip-intent` use case + int-test. **Verification:** CI.
5. [ ] **Intent:** `TripIntentSelector` + `setTripIntentAction`; wire intent into
   the trip page + Visas panel header. **Verification:** type-check, lint, build.
6. [ ] **Intent:** e2e spec. **Verification:** `pnpm test:e2e:web` (CI).
7. [ ] **Intent:** docs sync (AGENTS.md, epic ledger, mark SPEC-017 Complete).

## 13. ADR triggers and tech-debt review

### ADR?

- [ ] New library / tool / vendor · [ ] CI change · [ ] project-wide standard ·
  [ ] non-obvious trade-off · [ ] cross-cutting decision not in the epic

**ADRs to write:** none — within EPIC-005's settled decisions.

### Tech debt

- [x] Reviewed `docs/tech-debt.md` — nothing relevant.

**Tech debt items addressed:** none.

## 14. Risks & open questions

- **Intent off the `Trip` aggregate.** Chosen to avoid 20-file churn; if intent
  grows into core trip behaviour, fold it into the aggregate later. Logged as a
  deviation, not a blocker.
- **"Long stay" mapping** (`['working-holiday','study']`) is a best guess; no
  `study` rules are seeded yet, so it currently behaves like working-holiday with
  a study fallback. Acceptable; revisit when study routes are seeded.

---

## Implementation Deviations

| # | Deviation | Reason | Impact | Resolved? |
|---|-----------|--------|--------|-----------|
| 1 | Intent stored via dedicated `TripRepository.get/setIntent` methods rather than on the `Trip` aggregate | ~20 `Trip` construction sites would otherwise need churning | One extra cheap query on the trip page; intent isn't on the `Trip` type | Yes (accepted) |

### Post-Implementation Notes

- `trips.intent` is a nullable-with-default-`'tourism'` additive column — existing
  trips keep current behaviour (no re-assessment change until a user opts in).
- The selector lives in the Visas panel header and auto-submits; the server
  action authorises by org membership (AC5).
- "Long stay" maps to `['working-holiday','study']`; no `study` rules are seeded
  yet, so it currently behaves like working-holiday with a study fallback.
- This completes the headline "go to Australia to live" journey end-to-end.
- Remaining EPIC-005 work: slice 5 (broad GBR seed via `pnpm visa:fetch` + human
  review — needs an AI key).
- Integration + e2e are CI-gated (Docker Hub rate limit); unit (488), lint,
  type-check, migrations, and `pnpm build` pass locally.
