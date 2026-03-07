# AGENTS.md — Travel Planner

> Read [`CONSTITUTION.md`](./CONSTITUTION.md) before writing any code.
> This file is the operational quick-reference. The constitution is the law.

---

## Verification — run this before pushing

```bash
pnpm lint               # Biome: lint + import ordering (src/ only)
pnpm db:check:migrations # reject non-transactional SQL in deploy migrations
pnpm type-check         # tsc --noEmit
pnpm test:unit          # Vitest unit tests (~1 s, no Docker)
pnpm test:integration   # Vitest integration tests — real Postgres via Testcontainers (Docker required)
```

All five must exit 0. Do not push with failures. The pre-push hook runs these
automatically, but run them manually to verify mid-task.

Before pushing, also verify the production build:

```bash
POSTGRES_URL=postgresql://build:build@localhost:5432/build pnpm build
```

A dummy `POSTGRES_URL` is required so drizzle can be instantiated (DrizzleAdapter
uses `instanceof` checks). The `postgres` library is lazy — no TCP connection is
opened during `next build`. See ADR 010 for the full explanation.

To run a single test file:
```bash
pnpm test -- src/domain/trip/trip.test.ts
```

To auto-fix safe lint issues:
```bash
pnpm run format           # biome format --write src/
pnpm lint -- --write      # biome check --write src/  (safe fixes)
```

Whenever ADR files in `docs/decisions/` are added, renamed, or have a status
change, update `docs/decisions/README.md` in the same commit.

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

### Dependency composition root (runtime DI)

- Runtime dependency construction lives in `src/infrastructure/container/`.
- `src/infrastructure/container/create-app-container.ts` is the only runtime file
  allowed to construct `new Drizzle*Repository(...)`.
- `src/app/**` runtime code must resolve dependencies via `getAppContainer()`.
- Guard enforcement:
  - `src/__tests__/app-construction-guard.test.ts`
  - `src/__tests__/composition-root-boundary.test.ts`
- Integration tests still use real Drizzle repositories + real Postgres via
  Testcontainers (no DB/repository mocks).

---

## Key commands

| Task | Command |
|---|---|
| Dev server (one command) | `pnpm dev` |
| Raw Next.js dev server (no bootstrap) | `pnpm dev:next` |
| DB schema push | `pnpm db:push` |
| DB migrations | `pnpm db:migrate` |
| Generate migration | `pnpm db:generate` |
| Seed reference data | `pnpm db:seed` |
| e2e tests (local) | `pnpm test:e2e` (Docker required — Testcontainers manages the DB) |
| e2e UI mode | `pnpm test:e2e:ui` |

---

## Adding a feature — standard sequence

1. Write the Playwright e2e test first (`tests/e2e/`).
2. Write domain unit tests (`*.test.ts` alongside the domain file). For use-case and
   repository layer changes, also write integration tests (`*.int-test.ts` in the same
   directory).
3. Implement minimum code to make tests pass.
4. Run the verification commands above.
5. Update `CHANGELOG.md` under `## [Unreleased]`.
6. **Review and patch any docs that describe stale state** (see Doc review below).
7. **Write an ADR** if the change meets the trigger criteria below.
8. Commit with a [Conventional Commit](https://www.conventionalcommits.org/) message.

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

## Environment variables (`.env.local`, optional for local dev)

`pnpm dev` now bootstraps local development automatically when `POSTGRES_URL` is
missing: it starts a Testcontainers Postgres instance, runs migrations + seed,
and injects safe local defaults for auth vars.

In `NODE_ENV=development`, local manual testing can sign in via a dev-only
`local-dev` credentials provider (no Google setup required). Google sign-in is
shown only when `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are real values (not
placeholder defaults).
Application signup policy is controlled via `AUTH_SELF_REGISTRATION_ENABLED`
and `AUTH_ADMIN_EMAILS`.

Use `.env.local` when you want to target your own database/OAuth credentials:

```
POSTGRES_URL=            # Vercel Postgres / Neon connection string
AUTH_SECRET=             # next-auth secret (openssl rand -base64 32)
AUTH_GOOGLE_ID=          # Google OAuth client ID
AUTH_GOOGLE_SECRET=      # Google OAuth client secret
AUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true     # trust host headers (required for Vercel preview domains)
AUTH_ENABLE_LOCAL_DEV=false   # set true to allow local-dev credentials outside NODE_ENV=development
AUTH_SELF_REGISTRATION_ENABLED=false  # true = auto-approve first-time sign-ins
AUTH_ADMIN_EMAILS=admin@example.com   # comma-separated bootstrap app admins
```

---

## CI pipeline (`.github/workflows/ci.yml`)

All five jobs run in parallel on every push and PR:

- `lint` (`pnpm lint`)
  - also runs `pnpm db:check:migrations` to enforce transactional migration policy
- `type-check` (`pnpm type-check`)
- `unit-test` (`pnpm test:unit`)
- `integration-test` (`pnpm test:integration`) — runs repository and use-case tests
  against a real Postgres database via Testcontainers. Docker is available by default
  on `ubuntu-latest` GitHub Actions runners.
- `e2e` — builds the app with a dummy `POSTGRES_URL` (`pnpm build`), then runs
  `pnpm test:e2e`. `tests/e2e/setup/start-web-server.ts` starts a throwaway
  `postgres:16-alpine` container via Testcontainers and boots the app (`pnpm start`
  in CI, `pnpm dev:next` locally). Playwright `globalSetup` then waits for the
  DB URL file, runs migrations, seeds data, and writes `auth-state.json`. Failed
  runs upload the Playwright HTML report as an artifact (7-day retention). See
  ADR 009 for Testcontainers rationale.

Dependabot (`.github/dependabot.yml`) raises weekly PRs for npm and GitHub
Actions updates. Dev tooling is grouped into a single PR to reduce noise.

See ADR 008 for CI structure rationale, ADR 009 for Testcontainers, ADR 010 for
the build-time dummy POSTGRES_URL pattern, and ADR 028 for runtime composition-root DI.

## Infra automation workflows

Terraform orchestration lives in dedicated workflows:

- `.github/workflows/infra-validate.yml` — fmt/validate for `infra/stacks/prod` and `infra/stacks/preview` plus migration policy check
- `.github/workflows/infra-prod.yml` — applies `infra/stacks/prod` with Terraform Cloud remote state workspace `travel-planner-prod`
- `.github/workflows/infra-preview.yml` — applies `infra/stacks/preview` per PR lifecycle with Terraform Cloud remote state workspace `travel-planner-preview`

Drizzle migrations are intentionally **not** run in GitHub Actions. They run in Vercel deploys via `pnpm build && pnpm db:migrate:deploy`.

---

## Doc review — keeping docs true

Docs go stale when code changes but the surrounding description doesn't. Review
the docs listed below whenever you touch the corresponding area of the codebase.
Update any description that no longer matches reality in the **same commit** as
the code change.

| You changed… | Check these docs |
|---|---|
| CI pipeline (`.github/workflows/ci.yml`) | `AGENTS.md` CI section, relevant ADR, `CONSTITUTION.md` enforcement map |
| Git hooks (`.githooks/`) | `AGENTS.md` verification section, `CONSTITUTION.md` feedback loop |
| A use case (`src/application/use-cases/`) | `src/application/AGENTS.md` structure |
| Domain functions or types (`src/domain/`) | `src/domain/AGENTS.md` structure |
| Infrastructure repos or auth (`src/infrastructure/`) | `src/infrastructure/AGENTS.md` structure |
| Environment variables | `AGENTS.md` env section, `README.md` setup section |
| Runtime dependency wiring / DI container | `CONSTITUTION.md` enforcement map, `src/infrastructure/AGENTS.md`, ADR 028 |
| Database schema or migration strategy | `src/infrastructure/AGENTS.md`, `README.md` database section |
| A significant architectural decision | New ADR in `docs/decisions/`, update superseded ADR status if applicable, and update `docs/decisions/README.md` index |
| ADR files in `docs/decisions/` (add/rename/status) | `docs/decisions/README.md` index, superseded ADR status lines, and any ADR cross-references in `AGENTS.md`/`README.md` |
| Any user-facing feature | `CHANGELOG.md` under `## [Unreleased]` |

**Signs a doc is stale:** it describes a tool, file, or behaviour that no longer
exists; it omits a key file or command that does exist; its prerequisites or
setup steps no longer work end-to-end.

---

Full rules → [`CONSTITUTION.md`](./CONSTITUTION.md)
ADRs → [`docs/decisions/`](./docs/decisions/)
