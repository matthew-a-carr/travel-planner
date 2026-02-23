# AGENTS.md — Travel Planner

> Read [`CONSTITUTION.md`](./CONSTITUTION.md) before writing any code.
> This file is the operational quick-reference. The constitution is the law.

---

## Verification — run this before every commit

```bash
pnpm lint          # Biome: lint + import ordering (src/ only)
pnpm type-check    # tsc --noEmit
pnpm test          # Vitest unit tests (~1 s)
```

All three must exit 0. Do not commit with failures.

To run a single test file:
```bash
pnpm test -- src/domain/trip/trip.test.ts
```

To auto-fix safe lint issues:
```bash
pnpm run format           # biome format --write src/
pnpm lint -- --write      # biome check --write src/  (safe fixes)
```

---

## Architecture — enforced by structural tests

```
src/domain/        → ZERO external imports. Pure TypeScript only.
src/application/   → domain/ imports only.
src/infrastructure → domain/ + application/ imports only.
src/ui/            → any layer.
src/app/           → any layer (Next.js App Router).
```

Violations **break CI**. Enforcement lives in `src/__tests__/architecture.test.ts`.
Each layer has its own `AGENTS.md` with local rules.

---

## Key commands

| Task | Command |
|---|---|
| Dev server | `pnpm dev` |
| DB schema push | `pnpm db:push` |
| DB migrations | `pnpm db:migrate` |
| Generate migration | `pnpm db:generate` |
| e2e tests (local) | `pnpm test:e2e` |
| e2e UI mode | `pnpm test:e2e:ui` |

---

## Adding a feature — standard sequence

1. Write the Playwright e2e test first (`tests/e2e/`).
2. Write domain unit tests (`*.test.ts` alongside the domain file).
3. Implement minimum code to make tests pass.
4. Run the verification trio above.
5. Update `CHANGELOG.md` under `## [Unreleased]`.
6. **Write an ADR** if the change meets the trigger criteria below.
7. Commit with a [Conventional Commit](https://www.conventionalcommits.org/) message.

---

## When to write an ADR

An ADR is required for **any significant decision** — not just application code.
If you are unsure, write one. The cost of an unnecessary ADR is low; the cost of
an undocumented decision is high.

**Always write an ADR when you:**

- Choose a library or external tool (e.g. charting library, auth provider, ORM)
- Change the CI pipeline structure (stages, jobs, parallelism, service containers)
- Add or change a dependency management tool (Dependabot, Renovate, manual)
- Establish a project-wide standard (accessibility target, responsive breakpoints)
- Change the database schema strategy (migrations vs push, seed approach)
- Make a non-obvious architectural trade-off in any layer

**You do not need an ADR for:**
- Bug fixes with no design decision
- Routine dependency version bumps
- Test additions that follow established patterns

ADRs live in `docs/decisions/NNN-descriptive-title.md`.
See CONSTITUTION.md §7 for the required template and naming rules.

---

## Conventions (quick reference)

- Money: always integers in **pence**. Never floats.
- Fallible domain ops: `Result<T, E>` — no exceptions from domain.
- File names: `kebab-case.ts`. Components: `PascalCase.tsx`.
- Commits: `feat(scope):`, `fix(scope):`, `test:`, `docs:`, `chore:`, `ci:`
- Server actions: suffix `Action` (e.g. `createTripAction`).
- Repository interfaces live in `domain/`; implementations in `infrastructure/`.

---

## Environment variables (`.env.local`)

```
POSTGRES_URL=            # Vercel Postgres / Neon connection string
AUTH_SECRET=             # next-auth secret (openssl rand -base64 32)
AUTH_GOOGLE_ID=          # Google OAuth client ID
AUTH_GOOGLE_SECRET=      # Google OAuth client secret
```

---

## CI pipeline (`.github/workflows/ci.yml`)

Two-stage pipeline on every push and PR:

**Stage 1 — parallel:**
- `lint` (`pnpm lint`)
- `type-check` (`pnpm type-check`)
- `unit-test` (`pnpm test`)

**Stage 2 — after Stage 1 passes:**
- `e2e` — spins up `postgres:16`, runs `pnpm db:migrate`, builds the app
  (`pnpm build`), then runs `pnpm test:e2e` (Playwright with `pnpm start`).
  Failed runs upload the Playwright HTML report as a CI artifact.

Dependabot (`.github/dependabot.yml`) raises weekly PRs for npm and GitHub
Actions updates. Dev tooling is grouped into a single PR to reduce noise.

See ADR 008 for the rationale behind this structure.

---

Full rules → [`CONSTITUTION.md`](./CONSTITUTION.md)
ADRs → [`docs/decisions/`](./docs/decisions/)
