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

**Triage (filled at close-out):** post-impl-note — small learning for
future package authors; no spec-design change. Surfaced as part of the
"Lint coverage when adding a new workspace package" note in §Post-Impl.

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

**Triage (filled at close-out):** spec-deviation #1 — design change vs
§9 + §12 step 3. Type-check now subsumes the proposed runtime grep test.
Landed via commits dbe9646 (union + emit-site refactor) and afd2580.

---

### 2026-05-20 19:07 — Step 4: `ApiErrorBody` shipped without `readonly` modifiers

**Step:** Step 4 — Move ApiErrorCode + ApiErrorBody to shared package
**Type:** decision

**Note:**

Existing `ApiErrorBody` in `apps/web/src/app/api/v1/_lib/errors.ts`
carried `readonly` on `error`, `code`, `message`, and `Readonly<...>`
on `details`. zod's `z.infer<typeof apiErrorBodySchema>` produces
non-readonly fields by default. Preserving the `readonly` annotations
would need a manual type wrapper.

Decision: drop the `readonly` modifiers. Reasoning:

1. `ApiErrorBody` is only used as a type annotation on the local
   `body` variable inside `respondWithError`. Not exported beyond
   the shim and not consumed anywhere else in the codebase
   (verified by `grep -rn ApiErrorBody apps/web/src` — two hits,
   both in `errors.ts`).
2. The `readonly` modifiers had no runtime effect — they were
   defence-in-depth type hints. Tests (`errors.test.ts`) don't
   assert on the mutability of the response body.
3. Adding a manual `Readonly<>` wrapper around the inferred type
   would split the source of truth between the zod schema and a
   wrapper type — exactly the drift the shared package exists to
   prevent.

Verification: `pnpm -r type-check` exits 0; `pnpm test:unit` 410/410
green (errors.test.ts unchanged); the shim `export type {...} from
'@travel-planner/shared'` keeps existing imports working.

**Triage (filled at close-out):** spec-deviation #2 — minor type-shape
change vs the implicit spec contract ("move existing types"). Justified
by source-of-truth-via-zod-schema being the spec's whole point.

---


## Close-out triage summary

> Filled at the very end. One line per entry above plus where it landed.

| Entry | Landed in |
|-------|-----------|
| 1 — biome.json `includes` extended to cover `packages/shared/src/**` | Post-Implementation Notes — "Lint coverage when adding a new workspace package" |
| 2 — Step 3 spec design (option B, type-only enforcement for MobileAuthCallbackError) | Spec deviation #1 |
| 3 — Step 4 `ApiErrorBody` readonly modifiers dropped | Spec deviation #2 |

