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
    index.ts             ← full NextAuth with DrizzleAdapter
  db/
    schema.ts            ← Drizzle schema (source of truth for all tables)
    client.ts            ← singleton db instance
    migrate.ts           ← migration runner
    repositories/
      drizzle-trip-repository.ts
      drizzle-destination-repository.ts
      drizzle-spend-entry-repository.ts
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
