# Infrastructure Layer — AGENTS.md

> Rules for `src/infrastructure/`. These add specificity to the root AGENTS.md.

## Responsibilities

- DB schema and Drizzle ORM configuration (`db/`)
- Repository implementations (`db/repositories/`)
- Auth.js configuration and adapters (`auth/`)
- External API clients and adapters (for example Resend invite email delivery)

## Import rules

May import from `domain/` and `application/`. Must NOT import from `ui/` or `src/app/`.

## Structure

```
src/infrastructure/
  container/
    types.ts                    ← typed app runtime dependencies
    create-app-container.ts     ← composition root for concrete repo construction
    create-test-app-container.ts ← test helper to build real container + overrides
    index.ts                    ← runtime singleton accessor (`getAppContainer`)
  auth/
    auth.config.ts       ← provider config (no DB, used in middleware)
    index.ts             ← full NextAuth with DrizzleAdapter (imports db from client.ts)
    access-policy.ts     ← signup/approval/admin policy helpers
    provider-availability.ts ← env-aware auth provider visibility helpers (UI + provider wiring)
  organization/
    active-organization.ts ← auth/session + cookie-aware active organization resolver
  email/
    create-invite-email-service.ts ← env-aware provider selection (Resend vs logging)
    resend-email-service.ts         ← production invite delivery via Resend API
    logging-email-service.ts        ← dev/preview/test log-only delivery
  db/
    schema.ts            ← Drizzle schema (source of truth for all tables)
    client.ts            ← singleton db instance (see note below)
    migrate.ts           ← migration runner
    repositories/
      drizzle-trip-repository.ts
      drizzle-destination-repository.ts
      drizzle-spend-entry-repository.ts
      drizzle-trip-fixed-cost-repository.ts
      drizzle-country-reference-repository.ts
      drizzle-organization-repository.ts
      drizzle-user-access-repository.ts
    seed/
      country-reference-seed.ts  ← seed data for 33 countries
      seed.ts                    ← idempotent upsert runner (pnpm db:seed)
```

## Repository pattern

Each repository:
1. Implements a `domain/` interface (e.g. `TripRepository`).
2. Maps between DB rows and domain types in private mapper functions.
3. Uses `onConflictDoUpdate` for upsert (save = insert or update by id).
4. Never leaks Drizzle types or SQL into the return type.

## Runtime composition root

- Construct runtime repositories only in
  `src/infrastructure/container/create-app-container.ts`.
- Construct runtime invite email providers only in
  `src/infrastructure/email/create-invite-email-service.ts`.
- Keep provider adapters focused on delivery only; do not inline email copy or
  layout in infrastructure. Template rendering belongs in
  `src/application/email/`.
- App/auth/organization runtime paths resolve dependencies with
  `getAppContainer()` and do not instantiate project classes directly.
- `new Drizzle*Repository(...)`, `new LoggingEmailService(...)`, and
  `new ResendEmailService(...)` outside approved composition root files are
  policy violations blocked by `src/__tests__/composition-root-boundary.test.ts`.

## Schema changes

1. Edit `src/infrastructure/db/schema.ts`.
2. Run `pnpm db:generate` to create migration file.
3. Run `pnpm db:push` (dev) or `pnpm db:migrate` (prod) to apply.
4. Update corresponding repository mapper functions.
5. Check for type errors: `pnpm type-check`.

## Auth

`auth.config.ts` has no DB access — safe to import in `middleware.ts`.
`provider-availability.ts` centralises environment checks for which sign-in providers are shown.
`access-policy.ts` owns app-level closed-auth checks (approved-user gating, local-dev bootstrap
admin sync, canonical email matching).
`index.ts` imports the Drizzle adapter — only import in server-side code, never in middleware.
`index.ts` uses the shared `db` from `client.ts` (not its own connection). Do not create
a separate drizzle instance inside `auth/`.
`AUTH_ENABLE_LOCAL_DEV=true` can explicitly enable local-dev credentials outside
`NODE_ENV=development` (used for preview deployments); production should keep it false.

## Build-time database requirement

`client.ts` calls `createDb()` at module evaluation time. `next build` imports server
modules without a real database, so a syntactically-valid dummy URL must be supplied:

```bash
POSTGRES_URL=postgresql://build:build@localhost:5432/build pnpm build
```

The `postgres` library is lazy — no TCP connection is made until the first query.
`next start` spawns a fresh Node.js process with the real `POSTGRES_URL`. See ADR 010.

## Testing

Repository implementations are tested with integration tests (`.int-test.ts` files
co-located in `db/repositories/`). These run against a real Testcontainers PostgreSQL
instance — never mock the database in repository tests.
Integration tests for use cases/repositories must use real Drizzle implementations
and real Postgres (no repository doubles).

Email integration runbook (DNS/env/provider routing) lives in
`docs/email-delivery.md`.

```bash
pnpm test:integration   # runs all *.int-test.ts files (Docker required)
pnpm test:integration -- src/infrastructure/db/repositories/drizzle-trip-repository.int-test.ts  # single file
pnpm db:check:migrations # enforce deploy-safe transactional migration SQL
```

There are currently 7 integration test files in `db/repositories/`, one per repository.

Do not use in-memory fakes or mock `db` in repository tests. The Testcontainers
container is shared across all integration test files in a single run — start-up cost
is paid once (~10–15 s on first run).
