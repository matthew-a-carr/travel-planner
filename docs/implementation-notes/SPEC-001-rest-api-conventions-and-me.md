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

**Triage (filled at close-out):**

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

**Triage (filled at close-out):**

## Close-out triage summary

> Filled at the very end. One line per entry above plus where it landed.

| Entry | Landed in |
|-------|-----------|
