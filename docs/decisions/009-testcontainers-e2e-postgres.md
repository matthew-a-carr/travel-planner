# ADR 009: Testcontainers for E2E PostgreSQL

**Date:** 2026-02-23
**Status:** Accepted

## Context

Prior to this ADR, the E2E test suite had two problems:

1. **External service dependency.** CI used a GitHub Actions `services.postgres`
   block to spin up a PostgreSQL container. Locally, developers had to manage their
   own Postgres instance and set `POSTGRES_URL` by hand. The two environments were
   only loosely coupled through documentation.

2. **All authenticated tests were skipped.** Every test in `trips.spec.ts`,
   `destinations.spec.ts`, and `spend.spec.ts` was wrapped in
   `test.skip(!process.env.PLAYWRIGHT_AUTH_TOKEN, ...)`. No mechanism existed to
   produce a valid `PLAYWRIGHT_AUTH_TOKEN`, so those tests never ran — either
   locally or in CI.

The result was an incomplete test suite and a local-dev experience that required
manual infrastructure setup.

## Decision

Adopt **Testcontainers** (`@testcontainers/postgresql`) to own the full lifecycle
of the test database, and use Playwright's **`storageState`** to inject
pre-seeded auth sessions.

### How it works

```
pnpm test:e2e
     │
     ▼
playwright globalSetup  (tests/e2e/setup/global.setup.ts)
  ├─ Start postgres:16-alpine container (Testcontainers)
  ├─ Set process.env.POSTGRES_URL = <container connection URI>
  ├─ Run Drizzle migrations
  ├─ Seed country reference data
  ├─ INSERT test user + session into DB
  ├─ Write tests/e2e/fixtures/auth-state.json  (session cookie)
  └─ Write tests/e2e/fixtures/.container-id    (for teardown)
     │
     ▼
Playwright starts Next.js web server
  └─ Inherits POSTGRES_URL from globalSetup process.env
     │
     ▼
Tests run (workers: 1, serial)
  ├─ 01-trips.spec.ts       (authenticated via storageState)
  ├─ 02-destinations.spec.ts (authenticated via storageState)
  ├─ 03-spend.spec.ts        (authenticated via storageState)
  ├─ accessibility.spec.ts   (public describes: no cookie;
  │                            dashboard describe: storageState)
  └─ auth.spec.ts            (explicitly clears storageState)
     │
     ▼
playwright globalTeardown  (tests/e2e/setup/global.teardown.ts)
  └─ docker stop + rm <container-id>
```

### Test ordering

Authenticated tests have a data dependency chain:

```
01-trips → creates "Test Round the World" trip
02-destinations → adds Japan destination to that trip
03-spend → records spend against Japan
```

Numeric file prefixes (`01-`, `02-`, `03-`) make this order explicit and are
enforced by Playwright's default alphabetical file discovery. Each spec assumes
the state left by the previous one; tests run serially (`workers: 1`).

### Auth state injection

NextAuth v5 (Drizzle adapter) stores sessions in the `sessions` table. A session
is valid when a row exists with a matching `sessionToken` and a future `expires`
timestamp. `globalSetup` inserts such a row and writes the token into
`auth-state.json` as a `authjs.session-token` cookie. Playwright injects this
cookie via `use.storageState` in `playwright.config.ts`.

Tests that must run as **unauthenticated** override this via:

```typescript
test.use({ storageState: { cookies: [], origins: [] } });
```

## Consequences

### Positive

- **Zero infrastructure setup.** `pnpm test:e2e` works on any machine with Docker,
  identical to CI.
- **Fresh database every run.** Containers are ephemeral — no stale state between
  runs.
- **All authenticated tests now run.** The `PLAYWRIGHT_AUTH_TOKEN` guard pattern
  is removed. The full journey (trip → destination → spend) is continuously
  exercised.
- **CI simplified.** The GitHub Actions `services.postgres` block and explicit
  `pnpm db:migrate` step are removed; everything is self-contained in the test
  runner.

### Negative / Trade-offs

- **Slower cold start.** Container startup adds ~10–15 s before tests begin (one
  time per run, not per test). Acceptable for a CI gate; negligible locally where
  `reuseExistingServer: true` avoids rebuilding the app.
- **Docker required.** Machines without Docker cannot run `pnpm test:e2e`. This
  is an explicit trade-off — the same Docker requirement previously applied to CI
  only.
- **Data dependency between spec files.** The ordered spec approach (01/02/03)
  means a failure in `01-trips` will cascade to `02-destinations` and `03-spend`.
  This is a known limitation of stateful integration tests; it is mitigated by
  the small scope of each spec and Playwright's per-test failure reporting.

## Alternatives considered

**Keep the GitHub Actions service container, add manual auth token seeding**

Would fix the auth token problem but leave local-dev setup fragmented. Developers
would still need a local Postgres instance. Rejected.

**Pre-seed all test data in `globalSetup` and use independent specs**

Would eliminate inter-spec data dependencies and allow parallel execution. The
additional complexity of maintaining seed data separately from test assertions was
not worth the benefit at the current scale. Can be revisited if the suite grows.

**Playwright's built-in SQLite or in-process Postgres (e.g. PGlite)**

Would remove the Docker dependency entirely. At the time of writing, PGlite lacks
production parity (e.g. `date` columns, certain extension behaviour) and Drizzle
migration support is limited. Revisit when PGlite matures.

## Current implementation note (2026-03-02)

The decision remains accepted: E2E uses Testcontainers + Playwright
`storageState`, and Docker is required.

Current wiring differs from some historical flow text above:

- The PostgreSQL container is started by `tests/e2e/setup/start-web-server.ts`
  (configured via Playwright `webServer.command`), not by `global.setup.ts`.
- `global.setup.ts` waits for the `.postgres-url` file, then runs migrations,
  seeds reference data, and writes `auth-state.json`.
- Auth state is now generated as a JWT cookie via `next-auth/jwt` encode; the
  setup does not insert a row into the `sessions` table.
- In CI, `start-web-server.ts` runs `pnpm start`; locally it runs
  `pnpm dev:next`.
- `reuseExistingServer` is currently `false` in `playwright.config.ts`.
