# Engineering Constitution — Wanderlust Budget

> **This document MUST be read and consulted before any coding work begins.**
> It defines the non-negotiable engineering standards for this project. Deviations require an
> explicit Architecture Decision Record (ADR) in `docs/decisions/`.

---

## 1. Architecture & Domain Separation

This project follows a DDD-inspired layered architecture with strictly enforced import boundaries.

### Layers

```
src/domain/        Pure domain logic. No external dependencies whatsoever.
src/application/   Use cases only. Imports domain. No framework code.
src/infrastructure/ Adapters (DB, Auth, APIs). Imports domain + application.
src/ui/            React components, server actions, Next.js pages.
src/app/           Next.js App Router (pages, layouts, API routes).
```

### Import Rules (non-negotiable)

| Layer | Allowed imports |
|---|---|
| `domain/` | None — pure TypeScript only |
| `application/` | `domain/` only |
| `infrastructure/` | `domain/`, `application/` |
| `ui/` | Any layer |
| `app/` | Any layer |

> Violations are enforced by `src/__tests__/architecture.test.ts`. Tests will fail on import
> boundary breaches.

### Domain Design Rules

- **No exceptions from domain logic.** Use `Result<T, E>` for operations that can fail:
  `{ ok: true; value: T } | { ok: false; error: E }`.
- **Money is always integers in pence.** Never use floats for monetary values.
- **Prefer value objects over primitives** for domain concepts: `Money`, `Currency`, `DateRange`.
- **Domain functions are pure.** No side effects. No I/O. No `async`.
- **Aggregates own their invariants.** A `Trip` must enforce its own budget constraints.

---

## 2. Test-Driven Development (TDD / ATDD)

### The Rule

**Tests come first. Always.**

No production code is written without a failing test describing the expected behaviour.

### Workflow

```
1. Write e2e acceptance test (Playwright) — defines the user-facing acceptance criterion.
2. Write domain unit tests (Vitest) — for any new domain logic.
3. Implement the minimum code to make tests pass (no more).
4. Refactor if needed, keeping tests green.
5. Run: biome check + tsc --noEmit + vitest run — ALL must pass before committing.
```

### Unit Test Rules

- Domain logic MUST have Vitest unit tests.
- Tests live alongside the code they test (`foo.test.ts` next to `foo.ts`).
- Use descriptive names: `it('should reject allocation that exceeds available budget')`.
- **No mocking of domain objects.** Mock only infrastructure boundaries (repositories, APIs).
- Test behaviour, not implementation. Do not test private functions directly.

### e2e Test Rules

- Acceptance tests live in `tests/e2e/`.
- Each feature starts with a failing Playwright test before any implementation.
- Auth-required tests skip gracefully without `PLAYWRIGHT_AUTH_TOKEN`.
- A feature is not considered done until its e2e test passes against a running app.

---

## 3. Conventional Commits

**All commits MUST follow the [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) specification.**

### Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Commit Types

| Type | When to use |
|---|---|
| `feat` | A new feature or user-facing capability |
| `fix` | A bug fix |
| `refactor` | Code change that is neither a fix nor a feature |
| `test` | Adding or updating tests only |
| `docs` | Documentation only changes |
| `chore` | Build system, dependency updates, tooling config |
| `ci` | CI/CD pipeline changes |
| `perf` | A performance improvement |

### Rules

- Subject line: **lowercase**, no trailing period, **≤ 72 characters**.
- Use **imperative mood**: "add feature" not "added feature" or "adds feature".
- Breaking changes: append `!` after type (`feat!:`) and include a `BREAKING CHANGE:` footer.
- Scope is optional but encouraged: `feat(destination):`, `fix(auth):`, `test(spend):`.

### Examples

```
feat(destination): add validateNewDestination domain function
fix(auth): handle undefined session.user when narrowing type
test(trip): add unit tests for ringfence budget invariant
docs(adr): add decision record for Biome migration
chore: upgrade drizzle-orm to 0.43.0
ci: add e2e job to GitHub Actions workflow
```

---

## 4. Changelog

**`CHANGELOG.md` MUST be updated with every commit that introduces a user-facing change.**

### Rules

- Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
- Changes go under `## [Unreleased]` until a version is tagged.
- On release, move unreleased entries to a version section with the date.
- Sections within a release: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
- Write entries from the perspective of the end user, not the implementer.

### Example Entry

```markdown
## [Unreleased]

### Added
- Destination management: add and remove destinations per trip with budget validation

### Fixed
- Budget summary no longer shows negative available amount when ringfence exceeds allocation
```

---

## 5. Code Quality

### TypeScript

- Strict mode enforced (`strict: true` in `tsconfig.json`). No exceptions.
- No `any` types. Use `unknown` and narrow, or model the type properly.
- No non-null assertions (`!`) unless with explicit justification in a comment.
- Prefer named exports over default exports.
- File names: `kebab-case.ts`. Component files: `PascalCase.tsx`.

### Linting & Formatting

- **Biome v2** is the single tool for linting, formatting, and import organisation.
- Run `pnpm lint` before every commit. No warnings left unresolved.
- Auto-fix safe issues: `pnpm run format`. Unsafe fixes require manual review.

### Naming Conventions

| Concept | Convention | Example |
|---|---|---|
| Domain entities | PascalCase | `Trip`, `Destination` |
| Value objects | PascalCase | `Money`, `BudgetAllocation` |
| Use cases | camelCase verb phrase | `createTrip`, `recordSpend` |
| Repository interfaces | PascalCase + suffix | `TripRepository` |
| DB tables | snake_case | `spend_entries` |
| React components | PascalCase | `BudgetSummary.tsx` |
| Server actions | camelCase + `Action` suffix | `createTripAction` |

---

## 6. Git Workflow

- Work on feature branches. Merge to `main` via PR (or fast-forward for solo work).
- One logical change per commit. Do not batch unrelated changes.
- Always run the full check suite before pushing:
  ```
  pnpm lint && pnpm type-check && pnpm test
  ```
- Do not push with failing checks.
- `CHANGELOG.md` update must be part of the same commit as the change, not a follow-up.

---

## 7. Architecture Decision Records (ADRs)

Significant technical decisions MUST be documented as ADRs in `docs/decisions/`.

### Naming Convention

```
NNN-short-descriptive-title.md
```

Where `NNN` is a zero-padded sequence number. The title must describe the decision itself,
not just the feature it relates to. A reader should understand the subject from the filename alone.

### Template

```markdown
# ADR NNN: Title

**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Superseded by ADR NNN

## Context
Why does this decision need to be made?

## Decision
What was decided?

## Consequences
What are the trade-offs? What becomes easier/harder?
```
