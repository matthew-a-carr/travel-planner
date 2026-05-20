# Implementation Notes — SPEC-001: REST API Conventions for v1 and `GET /api/v1/me`

**Spec:** [SPEC-001](../specs/SPEC-001-rest-api-conventions-and-me.md)
**Started:** 2026-05-20

> Rolling log written by the implementing agent. Append new entries at the
> bottom as they happen — do not rewrite history. Each entry is a single
> observation, decision, or surprise. At spec close-out, every entry is
> triaged into one of: spec deviations table, spec post-implementation
> notes, docs/tech-debt.md, or discarded.

## Entries

### 2026-05-20 — pre-flight — anonymisation detection mechanism

**Step:** Pre-flight (before step 1)
**Type:** deviation
**Note:**

SPEC §3.3 says "anonymised (soft-deleted) user → 410 Gone". The spec
implicitly assumed a generic `isAnonymized` / `deletedAt` column on the
users table. There is none — ADR 031 anonymises via PII overwrite plus an
email pattern marker `deleted-{userId}@anonymized.local`. The 410 behaviour
described in the spec is still correct; the detection mechanism is the
email pattern, not a dedicated flag.

Implementation impact: `requireCookieSession()` checks the resolved user's
email against the ADR 031 pattern. If matched, returns the 410 response.

**Triage:** _see triage summary below_

---

### 2026-05-20 — pre-flight — `requireCookieSession()` deliberately does not reuse `getAuthenticatedAccessContext()`

**Step:** Pre-flight (before step 1)
**Type:** decision
**Note:**

`apps/web/src/infrastructure/organization/active-organization.ts` already
has `getAuthenticatedAccessContext()` which does:
session → resolveAuthenticatedUserId → isUserAllowedForApp → seed admin sync
→ organization lookup → active-org cookie resolution.

For `/api/v1/me` I need a leaner helper that:
1. doesn't load organisations (the v1 `/me` doesn't need them);
2. distinguishes between "no session", "user gone (anonymised → 410)", and
   "user present, isApproved=false → 200 with `isApproved:false`" —
   `isUserAllowedForApp` collapses the last two into one boolean and so
   isn't suitable.

`requireCookieSession()` re-uses `auth()` and `resolveAuthenticatedUserId`
but does its own user-row fetch and disposition. Org loading stays in the
existing helper.

**Triage:** _see triage summary below_

### 2026-05-20 — step 2 — pnpm v11 local-environment block

**Step:** Step 2 (envelope helper)
**Type:** blocker (worked around)
**Note:**

`pnpm test:unit` from repo root failed locally with
`[ERR_PNPM_IGNORED_BUILDS]` because `pnpm-workspace.yaml` has stale
placeholder entries under `allowBuilds:` (literally
`'@sentry/cli': set this to true or false` — a string, not a boolean).
pnpm v11.1.3 (local Homebrew) rejects this; CI uses pnpm v10 and is
unaffected.

Workaround for this slice: ran tests via
`cd apps/web && ./node_modules/.bin/vitest run --project=unit <file>`
which bypasses pnpm's deps-status check. All 17 tests pass.

Did NOT modify `pnpm-workspace.yaml` from SPEC-001 — it's out of scope
for the REST API conventions spec, and CI is currently green. Captured
as tech debt instead so a future small chore commit can fix it
(probably: replace `allowBuilds` with `onlyBuiltDependencies` listing
the deps that genuinely need build scripts, drop the placeholder).

**Triage:** _see triage summary below_

---

### 2026-05-20 — step 4 — `requireCookieSession()` extended with `email` and `name`

**Step:** Step 4 (handler + integration tests)
**Type:** deviation
**Note:**

SPEC §7 specified `CookieSessionResult` as `{ ok: true; userId; isApproved }`.
While wiring the `/me` handler, realised the helper had already queried
`{ email, isApproved }` to do the anonymisation check, but the handler
needed `email` and `name` for its response body. Two options were either
re-query in the handler (one extra SELECT for the same row) or extend the
helper's success type with the row fields already loaded.

Picked the latter. `CookieSessionResult` now carries `{ userId, email,
name, isApproved }` on success. Avoids the double-query and keeps the
handler trivial. Side-effect: slice 2's bearer-auth equivalent will need
to return the same shape so handlers don't fork.

**Triage:** _see triage summary below_

---

### 2026-05-20 — step 4 — next-auth `auth()` overload tripped `vi.mocked()`

**Step:** Step 4 (handler + integration tests)
**Type:** surprise
**Note:**

`vi.mocked(auth).mockResolvedValue(...)` failed type-check because
next-auth's `auth` is overloaded (no-args session / middleware / handler)
and `vi.mocked` picked the middleware overload. Worked around with a
narrow `MockedAuth` type alias at the top of the test file targeting just
the no-args session shape. Any future v1 route test mocking `auth()`
should copy this pattern (probably worth a shared test helper at slice 2
or 3 when a second route appears).

**Triage:** _see triage summary below_

---

### 2026-05-20 — step 3 — extracted `isAnonymisedEmail` to its own file

**Step:** Step 3 (cookie-session helper)
**Type:** decision
**Note:**

Original spec text had `isAnonymisedEmail` co-located in `auth.ts`. Unit
test failed because importing from `auth.ts` transitively pulls in
`next-auth` → which fails to resolve `next/server` in the unit-test
environment.

Extracted `isAnonymisedEmail` to `_lib/anonymised-email.ts` so it stays
unit-testable in isolation. Documented the reason in the file header
comment. `auth.ts` now imports it.

Side benefit: the file becomes the canonical reference for ADR 031's
detection mechanism — easier to grep for than a private helper inside a
larger file. If/when slice 7+ adds more shapes of "user deleted"
detection, they live there too.

**Triage:** _see triage summary below_

---

## Close-out triage summary

| Entry | Landed in |
|-------|-----------|
| 1 (pre-flight, anonymisation detection mechanism) | Discarded — the SPEC and ADR 050 already describe the behaviour; the email-pattern detection lives in `_lib/anonymised-email.ts` with a comment pointing at ADR 031. No reader needs the deviation surfaced beyond that. |
| 2 (pre-flight, `requireCookieSession()` not reusing `getAuthenticatedAccessContext()`) | Spec post-implementation notes — useful context for whoever writes slice 2's bearer helper. |
| 3 (step 2, pnpm v11 local block) | `docs/tech-debt.md` TD-001 — already filed during step 2. Out of scope for SPEC-001. |
| 4 (step 3, extracted `isAnonymisedEmail` to its own file) | Spec post-implementation notes — small structural decision worth recording for future helper extractions in this area. |
| 5 (step 4, `requireCookieSession()` extended to return `email` and `name`) | Spec **Implementation Deviations** table — changed the helper's contract vs. the spec's design (§7 listed only `userId` + `isApproved`). Resolved in-flight; no follow-up. |
| 6 (step 4, next-auth `auth()` overload tripped `vi.mocked`) | Spec post-implementation notes — testing pattern future slices will inherit. |
