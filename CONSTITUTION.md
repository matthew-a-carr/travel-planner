# Engineering Constitution — Travel Planner

> **Read this before writing any code.**
> It defines the non-negotiable engineering standards. Deviations require an ADR in `docs/decisions/`.

---

## 1. The Harness

This project is designed to be worked on by human engineers and AI agents interchangeably.
The engineering harness consists of three things:

- **Constraints** — what the system mechanically prevents (layer boundaries, type safety, lint rules)
- **Feedback loops** — how you know when your work is correct (test suite, type checker, linter)
- **Enforcement** — automated checks that run on every commit and every PR

### Enforcement map

| What | Where | Run via |
|---|---|---|
| Layer import boundaries | `src/__tests__/architecture.test.ts` | `pnpm test:unit` |
| Runtime construction guard (`src/app/**`) | `src/__tests__/app-construction-guard.test.ts` | `pnpm test:unit` |
| Composition-root boundary (`Drizzle*Repository` construction) | `src/__tests__/composition-root-boundary.test.ts` | `pnpm test:unit` |
| TypeScript correctness | `tsconfig.json` (strict) | `pnpm type-check` |
| Code style + lint | `biome.json` | `pnpm lint` |
| Repository + use-case correctness | `src/**/*.int-test.ts` | `pnpm test:integration` |
| e2e acceptance criteria | `tests/e2e/` | `pnpm test:e2e` |
| Accessibility (WCAG 2.1 AA) | `tests/e2e/accessibility.spec.ts` | `pnpm test:e2e` |
| Responsive layout (375/768/1280px) | `tests/e2e/accessibility.spec.ts` | `pnpm test:e2e` |
| Production build | `next build` (dummy `POSTGRES_URL` required) | `pnpm build` |
| CI gate | `.github/workflows/ci.yml` | automatic on push/PR |

**Nothing ships unless all gates are green.**

### Feedback loop for agents

The pre-push hook enforces all checks automatically — you do not need to run them
manually before pushing. The hook runs lint, type-check, unit tests, and integration
tests (when Docker is available) in sequence on every `git push`.

If you need to run checks manually (e.g. mid-task to verify progress):
```bash
pnpm lint && pnpm db:check:migrations && pnpm type-check && pnpm test:unit && pnpm test:integration
```
If any fail, fix them before proceeding — do not move on.

---

## 2. Architecture & Domain Separation

### Layers and import rules

```
src/domain/        Pure domain logic. No external dependencies whatsoever.
src/application/   Use cases only. Imports domain. No framework code.
src/infrastructure/ Adapters (DB, Auth, external APIs). Imports domain + application.
src/ui/            React components. May import any layer.
src/app/           Next.js App Router (pages, layouts, server actions). May import any layer.
```

These rules are **mechanically enforced** by `src/__tests__/architecture.test.ts`.
Breaking them causes test failures. Do not use `// @ts-ignore` or similar to silence them.

### Runtime dependency composition rule

- Runtime dependency wiring is centralized in
  `src/infrastructure/container/create-app-container.ts`.
- `src/app/**` runtime files must resolve dependencies through
  `getAppContainer()` instead of constructing project classes directly.
- `new Drizzle*Repository(...)` is only allowed in the composition root.
- These constraints are enforced by:
  - `src/__tests__/app-construction-guard.test.ts`
  - `src/__tests__/composition-root-boundary.test.ts`

### Auth access invariants

- Production access is closed by default:
  - sign-in is allowed only for users that already exist in the DB and are approved
  - do not use environment-variable allowlists or self-registration toggles
- Authentication must not auto-create organizations on first sign-in.
- Organization creation is admin-only; membership assignment must not create users implicitly.

### Domain design rules

- **No exceptions from domain logic.** Return `Result<T, E>`:
  `{ ok: true; value: T } | { ok: false; error: E }`
- **Money is always integers in pence.** Never floats. Convert at the UI boundary only.
- **Value objects over primitives.** Use `Money`, `Currency`, `DateRange` — not raw numbers/strings.
- **Domain functions are pure.** No side effects. No I/O. No `async`.
- **Aggregates own their invariants.** A `Trip` enforces its own budget constraints.
- **Repository interfaces live in `domain/`.** Implementations live in `infrastructure/`.

### Sub-directory guidance

Each layer has its own `AGENTS.md` with layer-specific rules. Read it before editing that layer.

---

## 3. Test-Driven Development (TDD / ATDD)

### The rule: tests first, always

No production code is written without a failing test that describes the expected behaviour.

### Workflow

```
1. Write Playwright e2e test → defines the acceptance criterion (what the user experiences).
2. Write Vitest domain unit tests → for any new domain logic.
3. Write Vitest integration tests → for any new use cases or repository methods
   (.int-test.ts alongside the source file; Docker + Testcontainers required).
4. Implement the minimum code to make tests pass.
5. Refactor if needed, keeping all tests green.
6. pnpm lint && pnpm db:check:migrations && pnpm type-check && pnpm test:unit && pnpm test:integration must all
   pass before pushing.
```

A feature is not done until its e2e test passes against a running application.

### Unit test rules

- Domain logic MUST have Vitest unit tests.
- Tests co-located with source: `trip.ts` → `trip.test.ts`.
- Descriptive names: `it('should reject allocation that exceeds available budget')`.
- No mocking of domain objects. Mock only infrastructure boundaries.
- Test behaviour, not implementation. Never test private functions directly.

### Integration test rules

- Repository implementations and use cases MUST have integration tests (`.int-test.ts`).
- Tests co-located with source: `create-trip.ts` → `create-trip.int-test.ts`.
- Use a real Testcontainers PostgreSQL instance — never mock the database in integration tests.
- Use real repository implementations in integration tests; do not replace runtime
  repositories with test doubles.
- The container is shared across all integration test files in a single `pnpm test:integration` run.
- Docker is required. If Docker is unavailable locally, the pre-push hook skips integration
  tests with a WARNING and CI runs them instead.

### e2e test rules

- Acceptance tests in `tests/e2e/`.
- A throwaway PostgreSQL database is started automatically via Testcontainers (Docker required).
  `pnpm test:e2e` is fully self-contained — no external database or auth token needed.
- `globalSetup` starts the container, runs migrations, seeds reference data, creates a test
  user + session, and writes `tests/e2e/fixtures/auth-state.json` (session cookie).
  `globalTeardown` stops the container when the suite finishes.
- Test files are numbered (`01-trips`, `02-destinations`, `03-spend`) to make the data
  dependency chain explicit. Authenticated tests use the session from `auth-state.json`;
  public tests override with `test.use({ storageState: { cookies: [], origins: [] } })`.
- CI runs e2e in stage 2 (after lint/type-check/unit-test). Docker is available by default
  on `ubuntu-latest` GitHub Actions runners — no extra service containers required.

---

## 4. Conventional Commits

**All commits MUST follow [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).**

### Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Use for |
|---|---|
| `feat` | New user-facing feature |
| `fix` | Bug fix |
| `refactor` | Code change that is neither fix nor feature |
| `test` | Adding or updating tests only |
| `docs` | Documentation only |
| `chore` | Build, dependencies, tooling |
| `ci` | CI/CD pipeline changes |
| `perf` | Performance improvement |

### Rules

- Subject line: lowercase, no trailing period, ≤ 72 characters.
- Imperative mood: "add feature" not "added" or "adds".
- Breaking changes: `feat!:` + `BREAKING CHANGE:` footer.
- Scope is optional but encouraged: `feat(destination):`, `fix(auth):`.

### Examples

```
feat(destination): add validateNewDestination domain function
fix(auth): handle undefined session.user when narrowing type
test(trip): add unit tests for ringfence budget invariant
docs: add engineering constitution
chore: upgrade drizzle-orm to 0.43.0
```

---

## 5. Changelog

**`CHANGELOG.md` MUST be updated with every commit that changes user-facing behaviour.**
The update must be part of the same commit — not a follow-up.

- Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
- New entries go under `## [Unreleased]`.
- Sections: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
- Write from the user's perspective, not the implementer's.

### What requires a changelog entry

| Commit type | Changelog required? | Reason |
|---|---|---|
| `feat` — new UI capability | **Yes** | User experiences something new |
| `fix` — visible bug fix | **Yes** | User's experience improves |
| `feat(e2e)` / `test` — test infrastructure | No | Not visible to users |
| `chore(deps)` — dependency bumps | No | No behaviour change |
| `ci` — CI/CD pipeline | No | No behaviour change |
| `docs` — documentation only | No | Not a behaviour change |
| `refactor` — internal restructuring | No, unless it fixes a visible bug |

When in doubt: if a real user would notice a difference, the changelog needs an entry.

---

## 6. Code Quality

### TypeScript

- Strict mode (`strict: true`). No exceptions.
- No `any`. Use `unknown` and narrow, or model the type properly.
- No non-null assertions (`!`) without an explanatory comment.
- Prefer named exports.

### Linting & formatting

- **Biome v2** handles lint, format, and import ordering.
- `pnpm lint` must be clean before committing.
- `pnpm run format` for auto-formatting.
- Config in `biome.json`.

### Naming

| Concept | Convention | Example |
|---|---|---|
| Domain entities / value objects | PascalCase | `Trip`, `Money` |
| Use cases | camelCase verb phrase | `createTrip`, `recordSpend` |
| Repository interfaces | PascalCase + `Repository` | `TripRepository` |
| Server actions | camelCase + `Action` | `createTripAction` |
| DB tables | snake_case | `spend_entries` |
| React components | PascalCase | `BudgetSummary.tsx` |
| File names | kebab-case | `spend-entry.ts` |

---

## 7. Architecture Decision Records (ADRs)

Significant technical decisions MUST be documented as ADRs in `docs/decisions/`.

### Naming

```
NNN-short-descriptive-title.md
```

The filename must convey the subject from the filename alone — not "next-features-approach" but
"atdd-destination-spend-dashboard-approach". A reader unfamiliar with the project must understand
the decision from the title.

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
What are the trade-offs? What becomes easier or harder as a result?
```

---

## 8. Mobile-First & Accessibility

The application must be fully usable on all commonly-used devices and screen sizes. This is a non-negotiable product requirement.

### Target viewports

| Device class | Width | Representative device |
|---|---|---|
| Mobile | 375px | iPhone SE / most Android phones |
| Tablet | 768px | iPad Mini / iPad Air |
| Desktop | 1280px | Standard laptop / desktop |

All layouts must be functional and readable at every viewport listed above.

### Mobile-first CSS

- Write base styles for mobile (smallest viewport).
- Layer larger-screen overrides using Tailwind responsive prefixes: `sm:` (≥640px), `md:` (≥768px), `lg:` (≥1024px).
- Two-column form grids (`grid-cols-2`) must stack to a single column on mobile: `grid grid-cols-1 gap-4 sm:grid-cols-2`.
- Minimum touch target size: 44×44px for all interactive elements on mobile.

### Accessibility standard

**Minimum: WCAG 2.1 Level AA.**

- Every interactive element must have an accessible name (via visible label, `aria-label`, or `aria-labelledby`).
- Colour is never the sole means of conveying information.
- Progress bars and other visual indicators use `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`.
- Form inputs are always associated to a `<label>` via `htmlFor` / `id`.
- Sufficient colour contrast: 4.5:1 for normal text, 3:1 for large text and UI components.

### Automated enforcement

Accessibility and responsive-layout regressions are caught by `tests/e2e/accessibility.spec.ts`:

- **axe-core** (`@axe-core/playwright`) audits every key page at all three viewports.
- The test file runs as part of the standard `pnpm test:e2e` suite.
- A failing axe audit is treated the same as a failing unit test — it blocks merging.

**No UI change ships without verifying it passes the accessibility spec at all three viewports.**

---

## 9. Context Efficiency

Keep the context agents work with clean and signal-dense:

- Delete dead code immediately — do not comment it out.
- Remove unused imports, variables, and types (enforced by Biome).
- Do not leave `TODO` or `FIXME` comments in committed code — file an issue or create a task instead.
- Keep files focused. If a file grows beyond ~200 lines, consider whether it has a single responsibility.
- ADRs capture *decisions*, not implementation notes. Keep them concise.
