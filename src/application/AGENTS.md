# Application Layer — AGENTS.md

> Rules for `src/application/`. These add specificity to the root AGENTS.md.

## Hard rules

- **Import from `domain/` only.** No `next`, `drizzle`, `react`, or infrastructure imports.
- **Thin orchestration only.** Use cases fetch, validate, and delegate — no business logic here.
- Business logic belongs in `domain/`. Infrastructure concerns belong in `infrastructure/`.

These rules are enforced by `src/__tests__/architecture.test.ts`.

## Structure

```
src/application/
  use-cases/
    create-trip.ts
    add-destination.ts
    edit-destination.ts
    remove-destination.ts
    add-fixed-cost.ts
    remove-fixed-cost.ts
    record-spend.ts
    edit-spend-entry.ts
    delete-spend-entry.ts
    get-country-references.ts
```

## Use case shape

Each use case is a single exported async function:

```typescript
export async function createTrip(
  repo: TripRepository,   // interface from domain/
  input: { ... },
): Promise<Trip> {
  // 1. validate / build domain object
  // 2. delegate to repo
  // 3. return result
}
```

- Accepts repository interfaces as parameters (dependency injection).
- Returns domain types or `Result<T, E>` — never raw DB rows.
- No direct DB access. No `next/headers`, `next/navigation`, or server-action imports.

## Testing

Use cases are tested with integration tests (`.int-test.ts` files co-located in
`use-cases/`). These run against a real Testcontainers PostgreSQL instance — never
mock repositories or the database in integration tests.

```bash
pnpm test:integration   # runs all *.int-test.ts files (Docker required)
pnpm test:integration -- src/application/use-cases/create-trip.int-test.ts  # single file
```

There are currently 9 integration test files in `use-cases/`, one per use case.
