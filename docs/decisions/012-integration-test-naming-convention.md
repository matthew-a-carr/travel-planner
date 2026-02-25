# ADR 012: Integration Test File Naming Convention (`.int-test.ts`)

**Date:** 2026-02-25
**Status:** Accepted

## Context

When the integration test suite was introduced (ADR 009), integration tests were placed in
specific directories (`src/infrastructure/db/repositories/` and `src/application/use-cases/`)
and the Vitest config used a directory list to distinguish them from unit tests:

```typescript
// unit
include: ['src/domain/**/*.test.ts', 'src/__tests__/**/*.test.ts']

// integration
include: [
  'src/infrastructure/db/repositories/**/*.test.ts',
  'src/application/use-cases/**/*.test.ts',
]
```

This approach has two problems:

1. **Brittle directory list**: Adding a new layer (e.g. `src/services/`) requires updating
   `vitest.config.ts` to include the new directory, and it's easy to forget.

2. **Ambiguous by name alone**: Looking at a file named `create-trip.test.ts`, there is no
   visual signal at the file-name level that it requires Docker to run.

## Decision

Integration tests use the `.int-test.ts` file suffix. Unit tests keep `.test.ts`.

The Vitest config uses suffix-based globs, with no directory lists:

```typescript
// unit — matches *.test.ts, excluding *.int-test.ts
include: ['src/**/*.test.ts'],
exclude: ['**/node_modules/**', 'src/**/*.int-test.ts'],

// integration — matches *.int-test.ts anywhere under src/
include: ['src/**/*.int-test.ts'],
```

CI has two separate jobs: `unit-test` (runs `pnpm test:unit`, no Docker) and
`integration-test` (runs `pnpm test:integration`, Testcontainers starts Postgres).

## Consequences

**Easier:**
- Adding a new integration test file anywhere under `src/` is automatically picked up —
  no config change needed.
- File names are self-describing: `create-trip.int-test.ts` immediately signals that it
  needs a real database.
- The unit job stays fast and Docker-free; the integration job runs in parallel in CI.

**Harder / conventions to remember:**
- Developers must use the `.int-test.ts` suffix consistently. A test placed in
  `src/application/use-cases/` with a `.test.ts` suffix will be treated as a unit test and
  fail at runtime (missing `POSTGRES_URL`).
- The `exclude` pattern for the unit project must be kept in sync if the naming convention
  ever changes.
