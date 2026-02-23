# ADR 010: Build-time POSTGRES_URL pattern for next build

**Date:** 2026-02-23
**Status:** Accepted

---

## Context

`next build` statically analyses server routes to collect page data. During this
phase it imports and evaluates all server modules — including
`src/infrastructure/db/client.ts` and `src/infrastructure/auth/index.ts` — without
a real database connection being available.

The Auth.js `DrizzleAdapter` uses `instanceof` checks to determine which drizzle
dialect is in use (postgres-js, MySQL, SQLite). This check runs at adapter
initialisation time, i.e. during module evaluation, not during a request.

This creates a conflict: `next build` needs a real drizzle instance to satisfy the
`instanceof` checks, but a real database is not available during the build step.

### Approaches that do not work

**Eager throw without any URL:** the original implementation threw
`Error: POSTGRES_URL environment variable is required` during module evaluation,
immediately failing the build.

**Lazy Proxy (`new Proxy({}, { get: () => getDb()[prop] })`):** a `Proxy` wrapping
an empty object has no prototype chain. `instanceof PgDatabase` returns `false`,
so DrizzleAdapter throws `"Unsupported database type (object)"`. The Proxy approach
is incompatible with DrizzleAdapter's type detection.

**Separate DB client in `auth/index.ts`:** the auth module previously created its
own drizzle connection, duplicating the pool and suffering the same eager-evaluation
problem. This was removed; `auth/index.ts` now imports the shared `db` from
`client.ts`.

---

## Decision

Supply a **syntactically-valid dummy `POSTGRES_URL`** for the build step only:

```
POSTGRES_URL=postgresql://build:build@localhost:5432/build
```

This allows `drizzle(postgres(url), { schema })` to create a real drizzle instance
that DrizzleAdapter can inspect. No TCP connection is ever opened, because the
`postgres` npm library is lazy: connections are established only when a query is
executed, which never happens during `next build`.

`next start` (the production server) spawns a fresh Node.js process. All modules
are re-evaluated with the real `POSTGRES_URL` provided by the runtime environment
(Testcontainers in CI, a real Neon/Vercel Postgres URL in production). The dummy
value never reaches a live server.

### Where the dummy URL is applied

- **CI** (`.github/workflows/ci.yml`): the `Build application` step sets
  `POSTGRES_URL=postgresql://build:build@localhost:5432/build` inline.
- **Pre-push hook** (`.githooks/pre-push`): the build step uses
  `POSTGRES_URL="${POSTGRES_URL:-postgresql://build:build@localhost:5432/build}"`,
  falling back to the dummy only when no real URL is set.

### Important: do not remove the dummy URL

Without a syntactically-valid `POSTGRES_URL`, `createDb()` throws and the build
fails. If you see `Error: POSTGRES_URL environment variable is required` during
`next build`, the dummy URL has been removed from the build step.

---

## Consequences

### Positive

- `next build` completes without a database, enabling CI to validate the production
  build before running the more expensive e2e suite.
- The pre-push hook mirrors CI exactly: local pushes catch build failures before
  they reach CI.
- Application code remains straightforward — no conditional build-time stubs or
  dynamic imports needed.
- `auth/index.ts` uses the same `db` singleton as all repositories, eliminating a
  duplicate connection pool.

### Negative / Trade-offs

- The dummy URL must be kept in two places (CI workflow and pre-push hook). If
  either is removed, build failures will reappear. The pre-push hook guards against
  this locally, but there is no mechanical check that the CI workflow still has the
  dummy URL.
- The pattern is non-obvious: a developer seeing `POSTGRES_URL=...build...` might
  think it is a mistake and remove it. This ADR exists to prevent that.

---

## Alternatives considered

**`NEXT_PHASE` environment variable detection**

Next.js sets `process.env.NEXT_PHASE = 'phase-production-build'` during
`next build`. We could conditionally create a stub drizzle instance only in that
phase. This would eliminate the need for a dummy URL in CI config but couples
application code to Next.js internals, which is undesirable.

**`next/dynamic` or lazy route imports**

Marking the auth route as dynamic to prevent static evaluation would suppress the
error, but would also prevent Next.js from optimising the route. Not worth the
trade-off.

**PGlite or in-process SQLite for build**

Would remove the need for any URL but requires maintaining a separate schema
bootstrap path. Ruled out due to complexity.
