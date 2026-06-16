# Implementation Notes — SPEC-016: Traveller Profile Capture

**Spec:** [SPEC-016-traveller-profile-capture](../specs/SPEC-016-traveller-profile-capture.md)
**Started:** 2026-06-16

## Entries

### 2026-06-16 05:55 — Reused `TravellerProfile` from `domain/visa/`

**Step:** §7 design
**Type:** decision
**Note:** The `TravellerProfile`/`Passport` types already exist under
`domain/visa/types.ts` (added in SPEC-015). Reused them as-is rather than moving
to a neutral `domain/user-profile/` location, to avoid churning merged code. The
new `domain/user-profile/` holds only the validator + repository interface and
imports the types from visa. Flagged in SPEC §14 as a future relocation
candidate if a non-visa consumer appears.

**Triage (filled at close-out):** spec-deviation #1

### 2026-06-16 06:00 — Nationality resolved client-side from country name

**Step:** §7 UI
**Type:** decision
**Note:** `CountryCombobox` emits the country *name*. The form resolves alpha-3
from the loaded country list at render and submits it via a hidden
`passportNationality` input (the combobox's own hidden input is given an ignored
name). Keeps the server action simple (no name→alpha-3 lookup) and the domain
validator receives alpha-3 directly.

**Triage (filled at close-out):** post-impl-note

### 2026-06-16 06:00 — Integration + e2e are CI-gated locally

**Step:** §9 verification
**Type:** blocker (environment)
**Note:** Same Docker Hub rate-limit as SPEC-015 — Testcontainers can't pull
Postgres in the sandbox, so the 3 new `.int-test.ts` files and the e2e spec run
on CI. Locally verified: unit (477, incl. 9 new domain tests), lint, type-check,
and `pnpm build` (the `/settings/profile` route compiles).

**Triage (filled at close-out):** post-impl-note

## Close-out triage summary

| Entry | Landed in |
|-------|-----------|
| 1 | Spec deviation #1 |
| 2 | Post-impl note |
| 3 | Post-impl note + PR body |
