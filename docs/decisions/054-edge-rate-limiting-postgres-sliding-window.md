# ADR 054: Edge Rate-Limiting via Postgres Sliding-Window Counter

**Date:** 2026-05-20
**Status:** Accepted

## Context

EPIC-001 §10 settled the principle ("rate-limit `/api/v1/auth/mobile/*`
at the edge; per-user rate limits on authenticated `/api/v1/*` stay
deferred") but left the mechanism, thresholds, and storage backend to
the implementing slice. SPEC-004 fills those in. This ADR codifies
them as a project-wide pattern so future auth-adjacent endpoints can
inherit.

The rate-limited surface in v1 is only the four
`/api/v1/auth/mobile/*` endpoints. They are the only unauthenticated
ingress in the new REST API; everything else is closed-auth (ADR 029).
Audience-of-two means abuse from real users is implausible; the
target is probing / scraping / credential-stuffing automation.

Options considered:

1. **Vercel KV / Upstash Redis sliding-window** — canonical choice for
   edge rate-limit. Off-the-shelf libraries (`@upstash/ratelimit`)
   provide token-bucket and sliding-window primitives. Costs ~$0–$5/mo
   at this volume. Adds a new external dep + new env vars + a new ops
   touchpoint.
2. **Postgres sliding-window counter** (chosen) — same DB the rest of
   the app already uses. No new env vars. ~1 extra DB round-trip per
   request, all on the slowest endpoints anyway. Auditable from
   psql.
3. **In-memory map** — fragile on Vercel's serverless model where each
   function invocation may land on a different instance.
4. **No rate limit** — contradicts EPIC §10.

## Decision

Implement edge rate-limiting via a Postgres `auth_rate_limit_attempts`
table (created in SPEC-004 step 1) and a `rateLimitOrReject` wrapper
applied per route handler.

### Schema

```ts
{
  id: uuid PK,
  key: text indexed,         // e.g. "ip:1.2.3.4" or "ip:1.2.3.4#endpoint:start"
  endpoint: text,
  occurredAt: timestamp default now()  indexed alongside key
}
```

Compound index on `(key, occurred_at desc)` for fast windowed scans.

### Thresholds

| Key shape | Window | Limit | Applies to |
|-----------|--------|-------|------------|
| `ip:<address>` | 5 min | 30 | All four auth endpoints |
| `ip:<address>#endpoint:<name>` | 5 min | 10 | Per individual endpoint |
| `user:<userId>` | 5 min | 60 | `/refresh` only (user is known there) |

A request is allowed only if **all applicable** thresholds are under
the limit. Breach → `429 rate_limited` with the standard
`/api/v1` envelope.

### Implementation shape

`apps/web/src/app/api/v1/auth/mobile/_lib/with-rate-limit.ts` exports
`rateLimitOrReject({ request, endpoint, repo, userId? })`:

1. Resolves the client IP from `x-forwarded-for` (Vercel's
   header) → `x-real-ip` → `0.0.0.0` fallback.
2. Calls `AuthRateLimitRepository.recordAndCount` (which inserts + counts
   inside a transaction) for each applicable key.
3. Returns `null` if all under limits; `Response` (429 envelope) otherwise.

Caller pattern in each route:

```ts
const rateLimit = await rateLimitOrReject({
  request,
  endpoint: 'start',
  repo: container.authRateLimitRepository,
});
if (rateLimit) return rateLimit;
// ...normal handler...
```

### GC policy

`AuthRateLimitRepository.gcOlderThan` is available for explicit
pruning if it ever becomes necessary. For v1 we rely on the table
being naturally small (audience of two + 5-minute window + ~four
endpoints). When ramp-up justifies it, a `pnpm db:gc:rate-limit` cron
can be added in EPIC-002.

### Why not the callback endpoint?

`GET /api/v1/auth/mobile/callback` is Google's redirect target. Rate-
limiting Google's requests doesn't make sense and could break
legitimate flows. The other three endpoints are mobile-client-facing
and are the realistic abuse surface.

## Consequences

**What becomes easier:**
- Zero new infra dependency to introduce in slice 3. The same
  Testcontainers Postgres that integration tests already spin up
  covers rate-limit testing.
- Rate-limit decisions are auditable from psql; ops can see exactly
  which IP / endpoint / userId is being hit and how often.
- The thresholds are documented numbers, not magic constants in
  middleware code.

**What becomes harder:**
- Every auth-endpoint request now performs ~3 small DB transactions
  (one per key checked) before the use case runs. Each is a
  short-running INSERT + COUNT — measured ~5–10ms on the
  Testcontainers Postgres, expected similar on Neon Hobby. Acceptable
  given audience-of-two volumes.
- If the abuse pattern ever scales past Postgres's ability to handle
  the load, the migration is to swap the
  `AuthRateLimitRepository` implementation for an Upstash-backed one
  without touching the rest of the codebase. The interface was
  designed to enable that swap.

**Trade-offs:**

- **Postgres vs Upstash KV**: chose Postgres for the simplicity of "no
  new infra in slice 3." If a second authenticated rate-limit surface
  ships (e.g. an `/api/v1/email/*` group), this trade-off should be
  re-examined — once two endpoint groups need rate-limit, KV starts
  looking better cost-amortised.
- **Sliding window vs token bucket**: chose sliding window (count rows
  in `[now - window, now]`) for clarity. Token bucket gives smoother
  bursting; not worth the algorithmic complexity here.
- **Hard limits vs soft warnings**: chose hard 429. EPIC §10's
  closed-auth (ADR 029) means a legitimate user hitting the limit is
  doing something abnormal; a hard refusal is honest. Soft warnings
  belong on user-facing endpoints, which auth isn't.

## References

- [SPEC-004 §7 — Mobile OAuth Endpoints](../specs/SPEC-004-mobile-oauth-endpoints.md)
- [ADR 029 — Closed Auth with Pre-Provisioned Membership](029-closed-auth-invite-only-membership.md)
- [ADR 050 — REST API Conventions for /api/v1/*](050-rest-api-conventions-v1.md)
- [ADR 051 — Mobile Authentication Model](051-mobile-authentication-model.md)
- [EPIC-001 §10 — Cross-cutting decisions](../epics/EPIC-001-ios-app.md)
