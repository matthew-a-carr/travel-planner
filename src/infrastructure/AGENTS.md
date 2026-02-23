# Infrastructure Layer — AGENTS.md

> Rules for `src/infrastructure/`. These add specificity to the root AGENTS.md.

## Responsibilities

- DB schema and Drizzle ORM configuration (`db/`)
- Repository implementations (`db/repositories/`)
- Auth.js configuration and adapters (`auth/`)
- Any external API clients (future: currency conversion, AI SDK)

## Import rules

May import from `domain/` and `application/`. Must NOT import from `ui/` or `src/app/`.

## Structure

```
src/infrastructure/
  auth/
    auth.config.ts       ← provider config (no DB, used in middleware)
    index.ts             ← full NextAuth with DrizzleAdapter (imports db from client.ts)
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

## Schema changes

1. Edit `src/infrastructure/db/schema.ts`.
2. Run `pnpm db:generate` to create migration file.
3. Run `pnpm db:push` (dev) or `pnpm db:migrate` (prod) to apply.
4. Update corresponding repository mapper functions.
5. Check for type errors: `pnpm type-check`.

## Auth

`auth.config.ts` has no DB access — safe to import in `middleware.ts`.
`index.ts` imports the Drizzle adapter — only import in server-side code, never in middleware.
`index.ts` uses the shared `db` from `client.ts` (not its own connection). Do not create
a separate drizzle instance inside `auth/`.

## Build-time database requirement

`client.ts` calls `createDb()` at module evaluation time. `next build` imports server
modules without a real database, so a syntactically-valid dummy URL must be supplied:

```bash
POSTGRES_URL=postgresql://build:build@localhost:5432/build pnpm build
```

The `postgres` library is lazy — no TCP connection is made until the first query.
`next start` spawns a fresh Node.js process with the real `POSTGRES_URL`. See ADR 010.
