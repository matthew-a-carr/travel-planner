# Implementation Notes — SPEC-005: Shared Wire Types and Schemas (`@travel-planner/shared`)

**Spec:** [SPEC-005-shared-types-and-schemas](../specs/SPEC-005-shared-types-and-schemas.md)
**Started:** 2026-05-20

> Rolling log written by the implementing agent. Append new entries at the
> bottom as they happen — do not rewrite history. Each entry is a single
> observation, decision, or surprise. At spec close-out, every entry is
> triaged into one of: spec deviations table, spec post-implementation notes,
> docs/tech-debt.md, or discarded.

## Entries

### 2026-05-20 18:40 — biome.json `includes` extended to cover `packages/shared/src/**`

**Step:** Step 1 — packages/shared/ skeleton
**Type:** decision

**Note:**

Spec §12 step 1 only scaffolds the package files; it doesn't mention
linter coverage. Running `pnpm lint` after the scaffold passed
(`Checked 274 files`) but a quick check of `biome.json` showed the
`files.includes` array doesn't reach into `packages/shared/`, so the
new package would silently escape lint.

Small surgical addition: append `"packages/shared/src/**"` to
`files.includes`. Post-change `pnpm lint` reports `Checked 275 files`,
confirming `src/index.ts` is now covered. Clean.

This is the kind of small judgment call the spec wouldn't have called
out by name. Erring on the side of including it in step 1's commit
keeps the package consistent with the rest of the monorepo's lint
coverage from the moment it lands.

**Triage (filled at close-out):**

---

### 2026-05-20 18:45 — Step 3: spec's grep-as-test design rests on a falsified assumption; user picks option B (type-only enforcement)

**Step:** Step 3 — MobileAuthCallbackError union + structural test
**Type:** deviation

**Note:**

Code walk of `?error=<reason>` emit sites turned up 5 reasons across
TWO files, not one:

- `apps/web/src/app/api/v1/auth/mobile/callback/route.ts` — 2 reasons
  as **inline string literals**:
  - `'travelplanner://auth?error=invalid_request'` (missing code or state)
  - `'travelplanner://auth?error=server_error'` (catch block)
- `apps/web/src/application/use-cases/auth/mobile/handle-mobile-callback.ts`
  — 3 reasons via a **template-literal helper** `deny(error: string)`
  that builds the URL as `` `${APP_REDIRECT_BASE}?error=${encodeURIComponent(error)}` ``:
  - `deny('invalid_state')` × 3 call sites
  - `deny('google_error')`
  - `deny('access_denied')`

The spec's §9 part-(a) grep test only covered `callback/route.ts`
(missing the use-case file's 3 reasons), and the spec's §9 part-(b)
"no `${`-prefixed template literals in callback/route.ts" is
trivially satisfied (the template literal lives in the OTHER file,
which the spec didn't grep). The spec's §14 risk bullet about
literals-only assumption was correctly worried about the wrong file.

Surfaced before writing the union; consulted the human; picked
**option B — type-only enforcement**:

1. Add `MobileAuthCallbackError` (`z.enum([...])`) to
   `@travel-planner/shared`. Five values: `invalid_request`,
   `server_error`, `invalid_state`, `google_error`, `access_denied`.
2. Type `deny()`'s parameter in `handle-mobile-callback.ts` from
   `string` to `MobileAuthCallbackError`. Three call sites now
   compile-time-checked.
3. Add a tiny local helper in `callback/route.ts`:
   `buildErrorRedirect(reason: MobileAuthCallbackError): Response`
   that builds `Response.redirect(\`travelplanner://auth?error=${reason}\`, 302)`.
   Two emit sites refactored to use it.
4. **No new architecture-test for the union.** `pnpm type-check`
   subsumes the runtime grep — adding `deny('new_reason')` or
   `buildErrorRedirect('new_reason')` where `'new_reason'` isn't in
   the enum becomes a compile error. CI catches it.

Spec §9's Unit table will lose the second + third architecture-test
rows (the bidirectional union literals test and the no-template-
literals test). Spec §3 AC#9 is satisfied by type-check.

**Triage (filled at close-out):** likely spec-deviation #1.

---


## Close-out triage summary

> Filled at the very end. One line per entry above plus where it landed.

| Entry | Landed in |
|-------|-----------|
