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
    remove-destination.ts
    record-spend.ts
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

Use cases are tested indirectly via e2e tests or with in-memory repository fakes.
Unit-test use cases only when they contain non-trivial orchestration logic.
