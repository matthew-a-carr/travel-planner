# Implementation Notes — SPEC-004: Mobile OAuth Endpoints

**Spec:** [SPEC-004-mobile-oauth-endpoints](../specs/SPEC-004-mobile-oauth-endpoints.md)
**Started:** 2026-05-20

> Rolling log written by the implementing agent. Append new entries at the
> bottom as they happen — do not rewrite history. Each entry is a single
> observation, decision, or surprise. At spec close-out, every entry is
> triaged into one of: spec deviations table, spec post-implementation notes,
> docs/tech-debt.md, or discarded.

## Entries

### 2026-05-20 17:07 — Step 1 (schemas + migration) landed clean

**Step:** Step 1 — Drizzle schemas + migration
**Type:** decision
**Note:**

Migration `drizzle/0014_freezing_ultimates.sql` generated cleanly. All
four tables (`mobile_auth_states`, `mobile_auth_exchange_codes`,
`refresh_tokens`, `auth_rate_limit_attempts`) match SPEC-004 §7
verbatim. One small judgment call: used a **partial index** for the
"active refresh chain head" lookup
(`WHERE revoked_at IS NULL AND replaced_by_id IS NULL`) instead of a
plain composite index. Drizzle's index DSL with `.where(sql\`…\`)` is the
canonical Drizzle-supported pattern; produces a small, hot lookup
index that doesn't include revoked or rotated rows. Worth mentioning
because the spec didn't explicitly call out the partial-index variant
— just said "(user_id, revoked_at) partial for active-chain lookups."
This honours the intent.

Migration policy check passed. Full existing integration suite
(45 files, 230 tests) green against the new schema — confirms no
breakage from adding the FK to `users` cascade.

**Triage (filled at close-out):**

---

## Close-out triage summary

_(populated at close-out)_

| Entry | Landed in |
|-------|-----------|
