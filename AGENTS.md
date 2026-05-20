# AGENTS.md — Travel Planner

> Read [`CONSTITUTION.md`](./CONSTITUTION.md) before writing any code.
> This file is the operational quick-reference. The constitution is the law.

---

## Repo layout

This is a pnpm monorepo (ADR 046). The web application lives at
`apps/web/`; future apps (iOS — ADR 045) will sit alongside it under
`apps/`. Shared workspace packages live under `packages/`.

```
travel-planner/
├── .agents/skills/   ← agent skills (Open Skills format, ADR 047)
├── apps/web/         ← Next.js application (src/, tests/, drizzle/, configs)
├── packages/         ← shared workspace packages (empty for now)
├── docs/             ← project-wide docs and ADRs
│   ├── decisions/    ← Architecture Decision Records
│   ├── specs/        ← feature specifications (ADR 047)
│   └── tech-debt.md  ← tech debt register
├── infra/            ← Terraform
├── biome.json        ← workspace-wide formatter/linter config
├── package.json      ← workspace root with pass-through scripts
└── pnpm-workspace.yaml
```

**Path references in this document and the layer-specific `AGENTS.md`
files describe paths *within* the web app.** For example, `src/domain/`
resolves to `apps/web/src/domain/`. All `pnpm` commands below run from the
repo root and pass through to the right workspace automatically.

---

## Verification — run this before pushing

```bash
pnpm lint               # Biome: lint + import ordering (src/ only)
pnpm db:check:migrations # reject non-transactional SQL in deploy migrations
pnpm type-check         # tsc --noEmit
pnpm test:unit          # Vitest unit tests (~1 s, no Docker)
pnpm test:integration   # Vitest integration tests — real Postgres via Testcontainers (Docker required)
```

All five must exit 0. Do not push with failures. CI is the hard gate — but
running checks locally before pushing avoids unnecessary round-trips.

### What to run based on what you changed

| You changed… | Run before pushing |
|---|---|
| Anything in `src/` | `pnpm lint && pnpm type-check && pnpm test:unit` |
| Domain logic (`src/domain/`) | `pnpm test:unit` (covers architecture tests too) |
| Use cases or repositories | `pnpm test:unit && pnpm test:integration` |
| DB schema or migrations | `pnpm db:check:migrations && pnpm test:integration` |
| Terraform / infra (`infra/`) | `terraform fmt -check -recursive` |
| CI config (`.github/workflows/`) | Verify in the PR — CI is self-testing |

When in doubt, run the full suite. When making a small, scoped change, use the
table above to run only what is relevant.

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

Every `AGENTS.md` (root and per-layer) has a sibling `CLAUDE.md` symlink so
Claude Code auto-loads the same content. When you add a new `AGENTS.md`
anywhere in the repo, create the symlink in the same commit:

```bash
ln -s AGENTS.md CLAUDE.md
```

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

## Specification-driven development (ADR 047)

Every non-trivial feature starts with a **spec**. The spec is the contract
between the planning phase and the implementation phase.

### When to write a spec

Write a spec when:
- Adding a new user-facing feature
- Making a significant change to domain logic
- Adding a new integration or external service
- Any change that would benefit from up-front design

Do NOT write a spec for:
- Bug fixes (unless the fix reveals a design problem)
- Dependency bumps
- Documentation-only changes
- Refactors with no behaviour change

### Spec lifecycle

1. Copy `docs/specs/_template.md` → `docs/specs/SPEC-NNN-title.md`.
2. Fill in **every** section (use "N/A — [reason]" for inapplicable sections).
3. Set status: `Draft`.
4. Request human review and approval.
5. **Do NOT begin implementation until status is `Approved`.**

### During implementation

- Follow the implementation order in the spec.
- Log every deviation in the spec's "Implementation Deviations" table.
- When unsure about a deviation: **STOP and consult the human.**
- When a deviation creates tech debt: add it to `docs/tech-debt.md`.

### After implementation

- Run the full verification suite (see "Verification" section above).
- Update spec status → `Complete`.
- Write post-implementation notes in the spec.
- Move unresolved deviations to `docs/tech-debt.md`.

### Tech debt review

Before planning a new spec, review `docs/tech-debt.md`. If any outstanding
items are relevant to the new feature or can be addressed alongside it,
include them in the spec's implementation order.

### Skills — step-by-step invocation

Each phase of the lifecycle has a corresponding skill in `.agents/skills/`.
Skills follow the [Open Skills format](https://agentskills.io/specification):
each skill is a directory containing a `SKILL.md` file with YAML frontmatter
(`name` + `description`) and a markdown body with step-by-step instructions.

```
.agents/skills/
├── plan-feature/
│   └── SKILL.md        ← "Plan a feature for [idea]"
├── implement-spec/
│   └── SKILL.md        ← "Implement SPEC-NNN"
└── review-tech-debt/
    └── SKILL.md        ← "Review tech debt"
```

#### How skills work

1. **Discovery** — at session start, agents scan `.agents/skills/` and read
   each `SKILL.md`'s `name` and `description` fields (~100 tokens per skill).
2. **Activation** — when a task matches a skill's description, the agent reads
   the full `SKILL.md` body into context.
3. **Execution** — the agent follows the step-by-step instructions in the body.

#### Skill index

| Skill | Invocation | What it does |
|-------|-----------|--------------|
| [`plan-feature`](./.agents/skills/plan-feature/SKILL.md) | "Plan a feature for [idea]" | Research → write spec → request approval |
| [`implement-spec`](./.agents/skills/implement-spec/SKILL.md) | "Implement SPEC-NNN" | TDD → deviation logging → verification → close-out |
| [`review-tech-debt`](./.agents/skills/review-tech-debt/SKILL.md) | "Review tech debt" | Assess → categorise → report → act |

#### Adding a new skill

To add a new skill, create a directory under `.agents/skills/` with a `SKILL.md`:

```yaml
---
name: my-skill-name          # must match directory name; lowercase + hyphens only
description: >               # 1–1024 chars; describes WHAT it does and WHEN to use it
  Do X when the user asks Y.
---

# Step-by-step instructions here...
```

See the [Agent Skills specification](https://agentskills.io/specification) for
the full format reference, and `.agents/skills/plan-feature/SKILL.md` for a
working example.

Specs and the tech debt register live in `docs/specs/` and `docs/tech-debt.md`.
See [`docs/specs/README.md`](./docs/specs/README.md) for the full index.

---

## Adding a feature — standard sequence

1. Write or review the **feature spec** (`docs/specs/`). Get human approval.
2. Write the Playwright e2e test first (`tests/e2e/`).
3. Write domain unit tests (`*.test.ts` alongside the domain file). For use-case and
   repository layer changes, also write integration tests (`*.int-test.ts` in the same
   directory).
4. Implement minimum code to make tests pass.
5. Log any deviations from the spec in its "Implementation Deviations" table.
6. Run the verification commands above.
7. Update `CHANGELOG.md` under `## [Unreleased]`.
8. **Review and patch any docs that describe stale state** (see Doc review below).
9. **Write an ADR** if the change meets the trigger criteria below.
10. Commit with a [Conventional Commit](https://www.conventionalcommits.org/) message.

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
placeholder defaults). Production access is closed by default: users must be
pre-provisioned and approved in the database before sign-in is allowed.
Invite emails are sent via Resend only in `VERCEL_ENV=production`; dev/preview/test
use a logging-only provider.
Email integration DNS/env setup and template standards are documented in
`docs/email-delivery.md`.

Use `.env.local` when you want to target your own database/OAuth credentials:

```
POSTGRES_URL=            # Vercel Postgres / Neon connection string
AUTH_SECRET=             # next-auth secret (openssl rand -base64 32)
AUTH_GOOGLE_ID=          # Google OAuth client ID
AUTH_GOOGLE_SECRET=      # Google OAuth client secret
AUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true     # trust host headers (required for Vercel preview domains)
AUTH_ENABLE_LOCAL_DEV=false   # set true to allow local-dev credentials outside NODE_ENV=development
RESEND_API_KEY=          # Resend API key (required in production)
EMAIL_FROM_ADDRESS=hello@mail.matthewcarr.dev
EMAIL_FROM_NAME=Travel Planner
AI_GATEWAY_API_KEY=      # Vercel AI Gateway key (local dev / non-Vercel CI). On Vercel deployments this is unset and the SDK uses VERCEL_OIDC_TOKEN automatically. See ADR 040.
# AI_GATEWAY_MODEL=      # override model id (defaults to google/gemini-3-flash, gateway-routed)
```

Bootstrap the first admin user in each environment:

```bash
POSTGRES_URL=... pnpm auth:bootstrap-admin -- admin@example.com \"Admin User\"
```

Email template rule:
- Keep message layout/copy rendering in `src/application/email/`.
- Reuse `src/application/email/base-email-template.ts` for all new outbound
  notification templates so branding stays consistent.

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
Actions updates. All minor and patch updates are grouped into a single PR per
ecosystem to reduce noise; major versions still land as individual PRs so
breaking-change changelogs can be reviewed separately.

See ADR 008 for CI structure rationale, ADR 009 for Testcontainers, ADR 010 for
the build-time dummy POSTGRES_URL pattern, ADR 028 for runtime composition-root DI,
and ADR 033 for the removal of the pre-push hook.

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
| Added a new `AGENTS.md` at any level | Create sibling `CLAUDE.md` symlink (`ln -s AGENTS.md CLAUDE.md`) in the same commit |
| Any user-facing feature | `CHANGELOG.md` under `## [Unreleased]` |
| Feature spec or tech debt | `docs/specs/README.md` index, `docs/tech-debt.md` |
| Sentry configuration or alerts | `docs/decisions/032-sentry-error-monitoring.md`, `docs/operations/sentry.md` |
| Infrastructure modules or Terraform config (`infra/`) | `infra/README.md`, infrastructure specific ADRs |

**Signs a doc is stale:** it describes a tool, file, or behaviour that no longer
exists; it omits a key file or command that does exist; its prerequisites or
setup steps no longer work end-to-end.

---

Full rules → [`CONSTITUTION.md`](./CONSTITUTION.md)
ADRs → [`docs/decisions/`](./docs/decisions/)
Feature specs → [`docs/specs/`](./docs/specs/)
Tech debt → [`docs/tech-debt.md`](./docs/tech-debt.md)
