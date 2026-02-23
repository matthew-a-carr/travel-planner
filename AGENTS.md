# AGENTS.md — Wanderlust Budget

> **Before writing any code, read [`CONSTITUTION.md`](./CONSTITUTION.md).**
> It is the authoritative source for all engineering standards on this project.
> What follows is a quick-reference summary only.

---

## Quick Reference

### Architecture — Layer Import Rules

```
domain/        → no external imports (pure TypeScript)
application/   → domain/ only
infrastructure → domain/ + application/
ui/ + app/     → any layer
```

Violations break `src/__tests__/architecture.test.ts`.

### Test-First Mandate

1. Write the Playwright e2e test first (acceptance criterion).
2. Write Vitest domain unit tests before implementing domain logic.
3. Implement only what is needed to make tests pass.
4. `pnpm lint && pnpm type-check && pnpm test` must all pass before committing.

### Commits — Conventional Commits (mandatory)

```
feat(scope): add destination budget validation
fix(auth): handle undefined session user
test(trip): cover ringfence invariant edge cases
docs(adr): record decision on Biome migration
chore: upgrade drizzle-orm
```

Types: `feat` · `fix` · `refactor` · `test` · `docs` · `chore` · `ci` · `perf`

### Changelog — Update on Every Change

Update `CHANGELOG.md` under `## [Unreleased]` as part of the same commit.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

### Code Style

- TypeScript strict mode. No `any`. No non-null assertions without justification.
- Money is always integers in pence. Never floats.
- Result types for fallible domain operations — no exceptions from domain.
- Prefer named exports. kebab-case filenames. PascalCase components.

### Naming

| Concept | Convention |
|---|---|
| Domain entities / Value objects | `PascalCase` |
| Use cases | `camelCase` verb phrase |
| Server actions | `camelCase` + `Action` suffix |
| DB tables | `snake_case` |

### Design System

- Tailwind CSS utility classes throughout.
- shadcn/ui components where appropriate — install as needed.
- Keep styling minimal and clean until a design system ADR is accepted.

---

Full rules → [`CONSTITUTION.md`](./CONSTITUTION.md)
ADRs → [`docs/decisions/`](./docs/decisions/)
