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
| Layer import boundaries | `src/__tests__/architecture.test.ts` | `pnpm test` |
| TypeScript correctness | `tsconfig.json` (strict) | `pnpm type-check` |
| Code style + lint | `biome.json` | `pnpm lint` |
| e2e acceptance criteria | `tests/e2e/` | `pnpm test:e2e` |
| CI gate | `.github/workflows/ci.yml` | automatic on push/PR |

**Nothing ships unless all gates are green.**

### Feedback loop for agents

After every change, run the verification trio:
```bash
pnpm lint && pnpm type-check && pnpm test
```
This is the single source of truth for correctness. If all three pass, the change is safe to commit.
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
3. Implement the minimum code to make tests pass.
4. Refactor if needed, keeping all tests green.
5. pnpm lint && pnpm type-check && pnpm test must all pass before committing.
```

A feature is not done until its e2e test passes against a running application.

### Unit test rules

- Domain logic MUST have Vitest unit tests.
- Tests co-located with source: `trip.ts` → `trip.test.ts`.
- Descriptive names: `it('should reject allocation that exceeds available budget')`.
- No mocking of domain objects. Mock only infrastructure boundaries.
- Test behaviour, not implementation. Never test private functions directly.

### e2e test rules

- Acceptance tests in `tests/e2e/`.
- Auth-required tests skip gracefully without `PLAYWRIGHT_AUTH_TOKEN`.
- CI skips e2e (requires running server + DB). Run locally with `pnpm test:e2e`.

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

## 8. Context Efficiency

Keep the context agents work with clean and signal-dense:

- Delete dead code immediately — do not comment it out.
- Remove unused imports, variables, and types (enforced by Biome).
- Do not leave `TODO` or `FIXME` comments in committed code — file an issue or create a task instead.
- Keep files focused. If a file grows beyond ~200 lines, consider whether it has a single responsibility.
- ADRs capture *decisions*, not implementation notes. Keep them concise.
