# Application Layer — AGENTS.md

> Rules for `src/application/`. These add specificity to the root AGENTS.md.

## Hard rules

- **Import from `domain/` only.** No `next`, `drizzle`, `react`, or infrastructure imports.
- **Thin orchestration only.** Use cases fetch, validate, and delegate — no business logic here.
- Business logic belongs in `domain/`. Infrastructure concerns belong in `infrastructure/`.
- **Every use case must have a co-located integration test.** When you add `my-use-case.ts`,
  you must also add `my-use-case.int-test.ts` in the same directory. A use case without an
  integration test is considered incomplete and must not be merged.

These rules are enforced by `src/__tests__/architecture.test.ts` (layer isolation)
and by code review / CI for the integration test requirement.

## Structure

```
src/application/
  email/
    base-email-template.ts         + base-email-template.test.ts
    user-added-invite-template.ts  + user-added-invite-template.test.ts
  use-cases/
    create-trip.ts                + create-trip.int-test.ts
    edit-trip.ts                  + edit-trip.int-test.ts
    move-trip-to-organization.ts  + move-trip-to-organization.int-test.ts
    add-destination.ts            + add-destination.int-test.ts
    edit-destination.ts           + edit-destination.int-test.ts
    remove-destination.ts         + remove-destination.int-test.ts
    add-fixed-cost.ts             + add-fixed-cost.int-test.ts
    remove-fixed-cost.ts          + remove-fixed-cost.int-test.ts
    edit-fixed-cost.ts            + edit-fixed-cost.int-test.ts
    record-spend.ts               + record-spend.int-test.ts
    edit-spend-entry.ts           + edit-spend-entry.int-test.ts
    delete-spend-entry.ts         + delete-spend-entry.int-test.ts
    get-country-references.ts     + get-country-references.int-test.ts
    create-organization.ts        + create-organization.int-test.ts
    get-user-organizations.ts     + get-user-organizations.int-test.ts
    list-trips-for-user.ts        + list-trips-for-user.int-test.ts
    get-trip-detail-for-user.ts   + get-trip-detail-for-user.int-test.ts
    get-organization-members.ts   + get-organization-members.int-test.ts
    add-organization-member.ts    + add-organization-member.int-test.ts
    search-organization-member-candidates.ts + search-organization-member-candidates.int-test.ts
    delete-trip.ts                + delete-trip.int-test.ts
    delete-user.ts                + delete-user.int-test.ts
    remove-organization-member.ts + remove-organization-member.int-test.ts
    get-user-access-list.ts       + get-user-access-list.int-test.ts
    set-user-approval.ts          + set-user-approval.int-test.ts
    set-user-admin.ts             + set-user-admin.int-test.ts
    pre-provision-user-access.ts  + pre-provision-user-access.int-test.ts
    send-user-access-invite.ts    + send-user-access-invite.int-test.ts
```

## Email templates

- Keep all outbound email copy/layout rendering in `src/application/email/`.
- Use `renderBaseEmailTemplate(...)` as the common shell so all notifications
  share consistent branding and structure.

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

There are currently 34 integration test files in `use-cases/` (plus 5 under `use-cases/auth/`), **one per use case**.
Adding a use case without its paired `.int-test.ts` breaks this invariant.
