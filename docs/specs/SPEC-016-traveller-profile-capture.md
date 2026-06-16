# SPEC-016: Traveller Profile — Passports & Date of Birth Capture

**Date:** 2026-06-16
**Status:** In Progress
**Author:** agent (interactive session)
**Approved by:** —
**Parent epic:** [EPIC-005](../epics/EPIC-005-visa-requirements-end-to-end.md) — slice 2

> Slice 2 of the visa epic. SPEC-015 (slice 1) shipped the model + evaluator,
> which already consume a `TravellerProfile` (`{ passports, dateOfBirth }`). This
> slice lets a user **record** that profile so the assessment runs on real data.
> Inherits EPIC-005 §10 cross-cutting decisions (web-first; PII handling for DOB;
> `GBR`-first but nationality-generic). The Visas panel that displays the
> assessment is slice 3, out of scope here.

---

## 1. Summary

A signed-in user opens **Settings → Profile** and records the passport(s) they
hold (by nationality) and their date of birth. The data is saved against their
account and reused across all trips. This is the input the visa assessment needs;
without it, assessments fall back to a `GBR`-only guess.

## 2. Motivation

SPEC-015's `assess-trip-visas` use case takes a `TravellerProfile`, but nothing
captures one — and a hardcoded "UK passport holder" assumption still lives in the
AI timeline insights. This slice provides the capture surface and the read path
so the profile is real, per-user data. It unblocks slice 3 (the Visas panel) and
begins to retire the hardcoded assumption (EPIC-005 §16 / SPEC-015 §12 step 11).

## 3. Acceptance criteria

1. Given a signed-in user with no profile, when they open `/settings/profile`,
   then they see an empty date-of-birth field and no passports, with controls to
   add them.
2. Given the profile form, when the user sets a date of birth and adds a UK
   passport (nationality picked from the country list) and saves, then both
   persist (`users.date_of_birth`, a `user_passports` row) and are shown on
   reload.
3. Given a user adds two passports with the **same** nationality, when they save,
   then only one is stored (deduplicated) — no error, no duplicate row.
4. Given a date of birth in the future or an invalid value, when the user saves,
   then the save is rejected with a clear message and nothing is persisted.
5. Given a user removes a passport row and saves, then that passport no longer
   persists.
6. Given a saved profile, when `getTravellerProfile` is called for that user,
   then it returns the stored passports (ordered) and date of birth as a
   `TravellerProfile`.

## 4. Demo script

1. Sign in → click **Settings** → **Profile**.
2. Set **Date of birth** to `1990-05-15`.
3. Click **Add passport** → pick **United Kingdom** → optional label "UK
   passport".
4. Click **Save profile** → see "Profile updated".
5. Reload → the DOB and the UK passport are still shown.
6. Add a second passport "United Kingdom" again → Save → still one UK passport.

## 5. Out of scope

- **The Visas panel / displaying any assessment** — slice 3.
- **Per-trip passport/intent selection** — slice 4 (EPIC-005 §13 Q1).
- **Fully removing the hardcoded "UK passport holder" assumption** in
  `anthropic-timeline-insights.ts` — that wiring lands with slice 3 when the
  panel/insights read the profile; this slice provides the read path it needs.
- **Non-UK seed data** — the picker offers all countries, but only `GBR` rules
  are seeded (EPIC-005 §6).

## 6. Prerequisites

- SPEC-015 merged (the `users.date_of_birth` column, `user_passports` table, and
  `TravellerProfile` type already exist). No new migration required.

## 7. Design

### Data & domain

Reuse `TravellerProfile`, `Passport`, `Alpha3` from `domain/visa/types.ts`. New
`domain/user-profile/`:

- `user-profile.ts` — pure `validateTravellerProfileInput(input)` →
  `Result<TravellerProfile>`: uppercases/validates each nationality as a 3-letter
  ISO alpha-3, **deduplicates** by nationality (first wins, preserving order),
  trims labels (empty → null), and validates `dateOfBirth` (optional; must be a
  real `YYYY-MM-DD`, not in the future, year ≥ 1900). Empty passports / null DOB
  are valid.
- `user-profile-repository.ts` — `UserProfileRepository`:
  `findByUserId(userId): Promise<TravellerProfile>` (empty profile if none) and
  `save(userId, profile): Promise<void>`.

### Behaviour

Two use cases (`application/use-cases/`):

- `get-traveller-profile.ts` — `getTravellerProfile(repo, userId)` →
  `TravellerProfile`.
- `update-traveller-profile.ts` — `updateTravellerProfile(repo, input)` →
  `Result<TravellerProfile>`: validate via the domain function, then `repo.save`.

### Storage & migrations

**N/A — no schema change.** Tables exist (SPEC-015). `save` runs in a
transaction: `update users.date_of_birth`, then replace the user's
`user_passports` rows (delete-all + insert the validated set with `sort_order`).

### External integrations

N/A.

### UI / UX

- Route `app/settings/profile/page.tsx` (server component): `auth()` →
  `getAppContainer()` → `getTravellerProfile` + `countryReferenceRepository.findAll()`
  → render. Reuses the `/settings` layout; `SettingsNav` gains a **Profile** tab.
- `ui/components/TravellerProfileForm.tsx` (client): a `type="date"` DOB input and
  a dynamic list of passport rows (each a `CountryCombobox` for nationality + an
  optional label text input + a Remove button), an **Add passport** button, and a
  **Save profile** button. Uses `useActionState`. Passport rows submit as parallel
  repeated hidden inputs (`passportNationality`, `passportLabel`).
- `app/settings/profile/actions.ts`: `updateTravellerProfileAction` — reads
  `formData.getAll(...)`, zips rows, calls the use case, `revalidatePath`.
- Accessibility: labelled inputs, the combobox is already keyboard/ARIA-complete,
  Remove buttons have accessible names. WCAG 2.1 AA (ADR 007).

## 8. Security & data considerations

- **PII — date of birth & nationality.** Both are personal data. Read/write
  **only** for the signed-in user (`session.user.id`); no admin or cross-user
  access surface is added. DOB is never logged or sent to AI prompts (EPIC-005
  §10). The combobox stores ISO alpha-3, not free text.
- **Authorisation:** the action derives `userId` from the session, never from the
  form — a user can only edit their own profile.
- **Input validation:** domain validation rejects malformed nationality/DOB;
  the action treats all form fields as untrusted.
- Secrets: none.

## 9. Test plan

### E2E (Playwright)

| Test file | Scenario |
|---|---|
| `tests/e2e/NN-traveller-profile.spec.ts` | Sign in → set DOB + add UK passport → save → reload → still shown (AC2) |

### Integration (Vitest + Testcontainers)

| Test file | What it covers |
|---|---|
| `drizzle-user-profile-repository.int-test.ts` | save → findByUserId round-trip (DOB + ordered passports); replace-on-save (removal) |
| `get-traveller-profile.int-test.ts` | empty profile for unknown/blank user; populated profile |
| `update-traveller-profile.int-test.ts` | persists; dedupes same nationality (AC3); rejects future/invalid DOB (AC4); removal (AC5) |

### Unit (Vitest)

| Test file | What it covers |
|---|---|
| `user-profile.test.ts` | `validateTravellerProfileInput`: alpha-3 normalisation/validation, dedupe, label trim, DOB rules (valid/future/malformed/empty) |

### Manual checks

- Keyboard-only pass through the form (combobox + add/remove + save).

## 10. Observability

- Logs: the action logs a structured success (userId, passport count) — **never**
  DOB or nationality values.
- Metrics: count of profile saves (proxy for adoption ahead of slice 3).
- Sentry: action catches and reports unexpected repository errors.

## 11. Rollback / safety

Additive: one new page, two use cases, one repository, one nav tab. No schema
change, no change to existing flows. Rollback = revert the PR. No feature flag
needed (the page is opt-in via the new nav tab).

## 12. Implementation order

1. [ ] **Intent:** domain `user-profile.ts` + failing `user-profile.test.ts`.
   **Verification:** red → green unit tests; architecture test (zero imports).
2. [ ] **Intent:** `UserProfileRepository` interface + `DrizzleUserProfileRepository`
   (transactional save) + int-test. **Verification:** repo int-test green (CI).
3. [ ] **Intent:** `get-traveller-profile` + `update-traveller-profile` use cases
   + int-tests. **Verification:** use-case int-tests green (CI).
4. [ ] **Intent:** register `userProfileRepository` in the container.
   **Verification:** container guard tests pass.
5. [ ] **Intent:** `/settings/profile` page + `TravellerProfileForm` + `actions.ts`
   + `SettingsNav` tab. **Verification:** type-check, lint, build.
6. [ ] **Intent:** e2e spec. **Verification:** `pnpm test:e2e:web` (CI).
7. [ ] **Intent:** docs sync (AGENTS.md listings, EPIC-005 slice ledger).
   **Verification:** `sync-docs` checks.

## 13. ADR triggers and tech-debt review

### ADR?

- [ ] New library, external tool, or vendor
- [ ] CI pipeline or workflow structural change
- [ ] New project-wide standard
- [ ] Non-obvious architectural trade-off
- [ ] Cross-cutting decision not already settled by the parent epic

**ADRs to write:** none required — reuses settled patterns (server actions,
repository DI) and EPIC-005's cross-cutting decisions.

### Tech debt

- [x] Reviewed `docs/tech-debt.md` — nothing relevant; this slice does not yet
  fully resolve the hardcoded "UK passport holder" assumption (that's slice 3).

**Tech debt items addressed by this spec:** none (begins, but does not complete,
the assumption removal).

## 14. Risks & open questions

- **`TravellerProfile` lives under `domain/visa/`** rather than a neutral location.
  Reused as-is to avoid churn; if a non-visa consumer appears, consider relocating
  to `domain/user-profile/`. Logged as a deviation candidate, not a blocker.
- **Country list as the nationality source.** `country_reference_data` doubles as
  the nationality picker; acceptable (ISO alpha-3 is the same set).

---

## Implementation Deviations

| # | Deviation | Reason | Impact | Resolved? |
|---|-----------|--------|--------|-----------|
| 1 | `TravellerProfile`/`Passport` reused from `domain/visa/types.ts` rather than relocated to `domain/user-profile/` | Avoids churning the merged SPEC-015 types; only one consumer (visa) today | None functional; a future non-visa consumer may justify relocation | Yes (accepted) |

### Post-Implementation Notes

- No migration needed — SPEC-015 already shipped `users.date_of_birth` and
  `user_passports`. This slice is purely additive (domain validator, repository,
  two use cases, a page + form + nav tab).
- `save` is delete-all-then-insert inside a transaction, which makes "remove a
  passport" trivially correct (the stored set always equals the submitted set).
- Integration (3 files) and e2e (1 file) are CI-gated — the sandbox can't pull
  the Testcontainers Postgres image (Docker Hub rate limit). Unit (477), lint,
  type-check, and `pnpm build` pass locally.
- The hardcoded "UK passport holder" assumption in `anthropic-timeline-insights.ts`
  is intentionally **not** removed here — it lands with slice 3 when the panel /
  insights actually read the profile.
