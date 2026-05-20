# Implementation Notes — SPEC-002: Bearer-Token Auth Alongside Cookie Sessions

**Spec:** [SPEC-002](../specs/SPEC-002-bearer-token-auth.md)
**Started:** 2026-05-20

> Rolling log written by the implementing agent. Append new entries at the
> bottom as they happen — do not rewrite history. Each entry is a single
> observation, decision, or surprise. At spec close-out, every entry is
> triaged into one of: spec deviations table, spec post-implementation
> notes, docs/tech-debt.md, or discarded.

## Entries

### 2026-05-20 — step 1 — jose pinned as `dependencies`, not `devDependencies`

**Step:** Step 1 (jose pin + env var)
**Type:** deviation (small)
**Note:**

SPEC §6 and §12 said pin jose as a direct **dev**Dep. That was wrong —
`bearer-token.ts` (slice 2 step 3) imports `jose` at runtime, so it must
ship in the production bundle. Pinning under `dependencies` instead of
`devDependencies`.

**Triage:** see triage summary below

---

### 2026-05-20 — step 8 — proxy middleware was redirecting `/api/v1/*` to `/login`

**Step:** Step 8 (Playwright e2e)
**Type:** surprise (bug surfaced and fixed)
**Note:**

The first Playwright e2e for the no-cookie path returned the homepage
HTML with status 200 instead of the typed 401 envelope. Root cause:
`src/proxy.ts` (Next.js 16 middleware) has matcher
`'/((?!api/auth|_next/static|_next/image|favicon.ico).*)'` which
intercepts **every** route except `api/auth` and the build asset
paths. `/api/v1/*` was caught, and `authConfig.callbacks.authorized`
returns `false` for unauthenticated non-public paths → next-auth
middleware redirects to `/login`. The integration tests in SPEC-001
called the route handler directly and bypassed middleware, so this
went undetected until e2e exercised the full stack.

Fix: add `api/v1` to the matcher exclusion. `/api/v1/*` endpoints
handle their own auth (cookie via `requireCookieSession`, bearer via
`requireBearerSession`, or both via `requireAuth`) and return the v1
typed error envelope on 401 — they must not be intercepted by the
session-redirect middleware.

This was a pre-existing latent bug from SPEC-001 (slice 1). Fixing
under slice 2 because slice 2's e2e is the first thing that exercises
the full stack and would have failed CI immediately. Adding a doc-
review-table entry so future contributors know the matcher excludes
`api/v1` deliberately.

**Triage:** see triage summary below

---

### 2026-05-20 — step 8 — e2e file renamed `04-api-me` → `11-api-me`

**Step:** Step 8 (Playwright e2e)
**Type:** deviation (cosmetic)
**Note:**

SPEC-002 §9 named the new e2e `tests/e2e/04-api-me.spec.ts`, unaware
that `04-auth-avatar.spec.ts` already exists. Renamed to
`11-api-me.spec.ts` to follow the existing numerical sequence (last
existing is `10-chat-foundation.spec.ts`).

**Triage:** see triage summary below

## Close-out triage summary

| Entry | Landed in |
|-------|-----------|
| 1 (step 1, jose under `dependencies` not `devDependencies`) | Spec **Implementation Deviations** table — design intent change (SPEC §6 and §12 wording corrected). Small but real. |
| 2 (step 8, proxy middleware redirecting `/api/v1/*`) | Spec **Post-Implementation Notes** + `AGENTS.md` doc-review table — pre-existing latent bug from SPEC-001 that integration tests had bypassed; fix committed; AGENTS row prevents regression. Worth a learning entry so future slices know middleware coverage matters. |
| 3 (step 8, e2e file renamed `04-api-me` → `11-api-me`) | Discarded — cosmetic file-naming clash with `04-auth-avatar.spec.ts` already existing; resolved in the same commit that introduced the file. No future reader needs the original spec wording. |
