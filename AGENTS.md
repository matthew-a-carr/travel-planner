# AGENTS.md — Travel Planner

> Read [`CONSTITUTION.md`](./CONSTITUTION.md) before writing any code.
> This file is the operational quick-reference. The constitution is the law.
> The constitution inherits the shared
> [`engineering-principles`](https://github.com/matthew-a-carr/ai-plugins/tree/main/plugins/engineering-principles)
> plugin (cite principles by anchor — P5, C8, T3); use its `apply-principles`
> skill before a non-trivial change and `architecture-review` on a diff.

---

## Execution environment — Claude Code remote sessions only

Per [ADR 057](./docs/decisions/057-autonomous-workflow-and-remote-execution.md),
**all routines and the default interactive flow run on Claude Code Web**
(claude.ai/code) — Anthropic-managed cloud sessions. Matt's local Mac is
reserved for two narrow cases:

- Physical-iPhone Expo Go validation (a routine can't reach a real device).
- Manual debugging when a routine flags a blocker and Matt wants to drive
  the session interactively from a terminal.

What this means in practice:

- The `pnpm dev` / `pnpm dev:mobile` instructions below are kept for human-
  driven local sessions but **routines never run them**. Routines run
  `pnpm lint && pnpm type-check && pnpm test:unit && pnpm test:integration
  && pnpm build` and rely on CI's `mobile-e2e` job (ADR 055) for the
  Maestro/iOS Simulator gate.
- `.claude/hooks/session-start.sh` is gated on `CLAUDE_CODE_REMOTE=true` —
  cloud sessions bootstrap Docker + Terraform + gh + pnpm install +
  Playwright automatically; local sessions skip the bootstrap.
- Two plugins are pinned in `.claude/settings.json` via the
  `matthew-a-carr` marketplace (`matthew-a-carr/ai-plugins`):
  - `engineering-principles@matthew-a-carr` — constitution, cloud-native,
    tech-stack, behavioural-rules, plus the `apply-principles` and
    `architecture-review` skills.
  - `agent-skills@matthew-a-carr` — lifecycle skills (draft-spec,
    implement-spec, review-spec, revise-spec, draft-epic, babysit-pr,
    triage-dependabot, write-adr, sync-docs, review-implementation,
    review-tech-debt) plus TDD, handoff, design grilling, GitHub PR
    helpers, CLI design, etc. The autonomous routines source their
    skills from this plugin.
  The pin lives in the repo (not just Matt's user-level config) so any
  session/clone *requests* both. Loading is **best-effort**, not guaranteed:
  a marketplace plugin may need a trust prompt that a headless routine can't
  answer, so `apply-principles` / `architecture-review` may silently not load
  in a routine run. If a routine ever genuinely *depends* on a skill that
  fails to load, vendor it into `.agents/skills/` as a local override.

Operations runbook: [`docs/operations/autonomous-workflow.md`](./docs/operations/autonomous-workflow.md).

---

## Repo layout

This is a pnpm monorepo (ADR 046). The web application lives at
`apps/web/`; future apps (iOS — ADR 045) will sit alongside it under
`apps/`. Shared workspace packages live under `packages/`.

```
travel-planner/
├── .agents/skills/   ← local-only skills (deploy-smoke-test); lifecycle skills via agent-skills plugin
├── apps/web/         ← Next.js application (src/, tests/, drizzle/, configs)
├── packages/         ← shared workspace packages (empty for now)
├── docs/             ← project-wide docs and ADRs
│   ├── decisions/           ← Architecture Decision Records
│   ├── epics/               ← multi-SPEC initiatives (ADR 049)
│   ├── specs/               ← feature specifications (ADR 047)
│   ├── implementation-notes/ ← per-spec rolling logs (ADR 048)
│   └── tech-debt.md         ← tech debt register
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
| e2e tests (umbrella — web Playwright + mobile Maestro) | `pnpm test:e2e` |
| e2e — web only (Playwright; Docker required — Testcontainers manages the DB) | `pnpm test:e2e:web` |
| e2e — web Playwright UI mode | `pnpm test:e2e:web:ui` |
| e2e — mobile only (Maestro; requires iOS Simulator + Maestro CLI) | `pnpm test:e2e:mobile` |

---

## Decision-making bias: prefer durable over expedient

When choosing between a quick fix and a longer-term / more stable
solution, default to the durable option. Examples:

- Pay down related tech debt **inside the slice that touches it**, not
  in a follow-up "we'll get to it" spec.
- Wire up proper test infrastructure now rather than ship the placeholder
  and a TD-NNN entry promising to fix it later.
- Correct an architectural pattern as part of the feature that exposed
  it, not as drive-by churn after the fact.

When `draft-spec` lists §Open Questions or `implement-spec` logs a
deviation, **lead with the durable choice as the recommendation**, even
if it costs more upfront. The "quick" option still belongs in the table
for transparency — just not as the default.

Override only when:

- The user explicitly says "patch it for now" / "ship the quick version".
- The durable option genuinely exceeds the slice's own scope (then
  surface it as a separate spec or tech-debt entry, but don't paper over
  the choice).
- The quick fix is a documented intermediate step toward the durable
  one — not a permanent hack.

The cost of yak-shaving once is bounded; the cost of a TODO that outlives
the team's memory of why it's there is not.

---

## Autonomous workflow (ADRs 047, 049, 057)

Per ADR 057, the lifecycle is **issue-driven and routine-executed**. Humans
act at the submission and review gates; the loop in between runs on Claude
Code Web. The interactive `grill-me` / `plan-feature` / `plan-epic` flow
documented in earlier revisions of this file is **superseded** by the issue-
template + routine model below.

```
Matt opens issue (ai:plan or ai:plan-epic)
  → draft-spec / draft-epic routine opens a spec/epic PR
    → Matt reviews PR, drops comments, labels ai:revise-now
      → revise-spec routine rewrites and pushes
        → Matt merges spec PR with ai:implement label
          → implement-spec routine opens an implementation PR (ai:done)
            → Matt merges impl PR
```

Two artefact tiers (unchanged from ADRs 047 / 049):

- **Epic** (`docs/epics/EPIC-NNN-*.md`) — multi-SPEC initiative. Owns
  vision, slicing, kill criteria, and cross-cutting decisions all child
  SPECs inherit.
- **Spec** (`docs/specs/SPEC-NNN-*.md`) — one shippable unit, either
  standalone or a slice of an epic.

### When to write an epic

Write an epic when:
- The work needs more than ~3 SPECs to deliver real user value.
- Sequencing across SPECs matters — slice N unblocks slice N+1.
- Cross-cutting decisions (auth, packaging, observability) should be
  settled once rather than relitigated per SPEC.
- There's a meaningful chance the work is killed or pivoted partway, and
  pre-committing exit criteria matters.

Open an issue with the **Epic** template (label `ai:plan-epic`).

### When to write a spec

Write a spec (open an issue with the **Feature request** template, label
`ai:plan`) when:
- Adding a new user-facing feature
- Making a significant change to domain logic
- Adding a new integration or external service
- Any change that would benefit from up-front design

Do NOT write a spec for:
- Bug fixes (unless the fix reveals a design problem) — open a plain issue
- Dependency bumps
- Documentation-only changes
- Refactors with no behaviour change

### How feedback flows

- **Drafted SPEC PR not quite right?** Drop review comments on the PR, then
  apply label `ai:revise-now`. The `revise-spec` routine rewrites and
  removes the label.
- **Drafted SPEC is wrong on a fundamental axis?** Close the spec PR with a
  comment explaining; close the source issue or re-open with refined wording.
  The routine doesn't second-guess closes.
- **SPEC drafted with §Open Questions you want answered before merging?**
  Reply on the PR inline, then apply `ai:revise-now`. The routine
  resolves the questions in the same loop.
- **Approval = merge with `ai:implement`.** Merging the spec PR with that
  label fires the implement routine.
- **Implementation hit a wall?** The routine applies `ai:blocked` and
  Slack DMs Matt with the one-liner.

### Capture cheap, triage deliberate (unchanged from ADR 048)

The rolling implementation-notes mechanism is retained. `implement-spec`
appends timestamped entries to
`docs/implementation-notes/SPEC-NNN-<slug>.md` as it works, then triages
them at close-out into the spec's deviations table, post-impl notes,
`docs/tech-debt.md`, or discarded.

### Interactive planning in a remote session

The autonomous loop is the default, but interactive planning in a remote
Claude Code Web session is **fully supported** — open a session against
`travel-planner`, talk through the feature, get a SPEC PR by the end of the
conversation. The agent will:

1. For a **feature/slice**, take the description you give in conversation
   as the source of truth — there's no turn-by-turn interview; the
   `draft-spec` skill records any unresolved ambiguity in the SPEC's §Open
   Questions section for the PR review loop to settle. For an **epic**,
   `draft-epic` still runs `agent-skills:grill-me` at epic altitude (vision,
   slicing, kill criteria, cross-cutting decisions) before drafting.
2. File a `ai:plan` or `ai:plan-epic` GitHub issue with that
   description (or the grilled epic brief) as the body, so the
   source-of-truth lives where the autonomous flow expects it.
3. Continue straight into the `draft-spec` / `draft-epic` skill —
   drafting the SPEC/EPIC and opening the PR in the same session, no need
   to wait for the routine. The issue gets `ai:planned` so the
   routine won't redo the work.

From your end it feels like a single conversation: "plan a feature that
does X" → "here's PR #N for review," with any open questions surfaced in
the PR for a slice (or grilled up front for an epic). The PR then flows
through the standard revise / merge / implement loop.

This is also the right entry point when:

- You want to brainstorm and aren't sure if it's a SPEC or an epic yet
  (the agent picks based on what you describe).
- You're driving a routine session manually because it hit a blocker —
  the session URL is at `claude.ai/code/session_XXX`; pause it and
  continue interactively.

### Tech debt review

Before drafting a new spec, the `draft-spec` routine reads `docs/tech-debt.md`
and includes any items relevant to the new feature in the SPEC's
Implementation Order. The `weekly-tech-debt` routine triages the register
on Sundays.

### Skills

Skills follow the [Open Skills format](https://agentskills.io/specification):
each skill is a directory containing a `SKILL.md` file with YAML frontmatter
(`name` + `description`) and a markdown body with step-by-step instructions.

Most skills are provided by the `agent-skills@matthew-a-carr` plugin — they
are generic, repo-agnostic skills that read per-repo config from
`docs/agents/verification.md`. Only repo-specific skills live locally:

```
.agents/skills/
└── deploy-smoke-test/
    └── SKILL.md        ← Post-deploy prod health check (Vercel + canaries)
```

Plugin-provided skills (auto-loaded via `engineering-principles@matthew-a-carr`):

- `apply-principles` — ground a change in the principles before writing.
  Called by `draft-spec` and `implement-spec` during pre-flight.
- `architecture-review` — review a diff against the principles. Called by
  `draft-spec` and `revise-spec` after writing.

#### How skills work

1. **Discovery** — at session start, agents scan `.agents/skills/` for local
   skills and load plugin-provided skills from the marketplace.
2. **Activation** — when a task matches a skill's description, the agent reads
   the full `SKILL.md` body into context.
3. **Execution** — the agent follows the step-by-step instructions in the body.

#### Skill index

| Skill | Source | Invocation | What it does |
|-------|--------|------------|--------------|
| `draft-spec` | plugin | Routine on `Issue opened` + label `ai:plan`; or "draft a spec from issue #NNN" | Read issue → draft SPEC → open PR with §Open Questions |
| `draft-epic` | plugin | Routine on `Issue opened` + label `ai:plan-epic`; or "draft an epic from issue #NNN" | Read issue → draft EPIC (slice table, kill criteria, cross-cutting decisions) → open PR |
| `revise-spec` | plugin | Routine on PR labelled `ai:revise-now`; or "revise spec PR #NNN" | Read review comments → rewrite SPEC or EPIC → push to same branch |
| `review-spec` | plugin | "Review SPEC-NNN" | Read-only consistency check against constitution, ADRs, parent epic, tech debt |
| `implement-spec` | plugin | Routine on merged spec PR with label `ai:implement`; or "implement SPEC-NNN" | TDD → rolling notes → verification → impl PR with label `ai:done` |
| `review-implementation` | plugin | Routine on PR labelled `ai:done`; "review impl PR #NNN" | Read-only review of the impl diff against SPEC, constitution, ADRs, doc-staleness |
| `write-adr` | plugin | A change meets an ADR trigger; "write an ADR for X" | New ADR + `docs/decisions/README.md` index row + supersession status lines |
| `sync-docs` | plugin | Close-out of `implement-spec`; or "sync the docs" | Diff → doc-review table → patch stale docs + generated artifact checks |
| `babysit-pr` | plugin | "babysit PR #NNN" / "address the comments and merge when green" | Triage + apply review comments → push → wait green → squash-merge |
| `triage-dependabot` | plugin | "triage the dependabot PRs" | Apply repo dependency rules → merge/hold/close recommendation |
| `review-tech-debt` | plugin | Weekly routine; or "review tech debt" | Assess → categorise → report → act |
| [`deploy-smoke-test`](./.agents/skills/deploy-smoke-test/SKILL.md) | local | After merge to `main`; or "is prod healthy?" | Verify Vercel Production deploy is READY + HTTP canaries + migrations |

#### Adding a new skill

For **repo-specific** skills, create a directory under `.agents/skills/` with a
`SKILL.md`. For **generic** skills that should be shared across repos,
contribute them to
[`agent-skills`](https://github.com/matthew-a-carr/ai-plugins/tree/main/plugins/agent-skills).

See the [Agent Skills specification](https://agentskills.io/specification) for
the full format reference.

Epics, specs, per-spec implementation notes, and the tech debt register
live in `docs/epics/`, `docs/specs/`, `docs/implementation-notes/`, and
`docs/tech-debt.md` respectively. See
[`docs/epics/README.md`](./docs/epics/README.md),
[`docs/specs/README.md`](./docs/specs/README.md), and
[`docs/implementation-notes/README.md`](./docs/implementation-notes/README.md)
for the per-tier indexes and workflows.

Routine configuration (one-time setup): [`docs/operations/autonomous-workflow.md`](./docs/operations/autonomous-workflow.md).

---

## Adding a feature — standard sequence

The default path is the autonomous flow described above: open an issue with
the Feature request template (label `ai:plan`), review the SPEC PR the
routine opens, merge with `ai:implement`. The remaining steps below are
what the `implement-spec` routine performs — listed here for reference and
for the rare case where you're driving implementation interactively.

1. Read the approved (merged) **feature spec** (`docs/specs/`).
2. Write the Playwright e2e test first (`tests/e2e/`).
3. Write domain unit tests (`*.test.ts` alongside the domain file). For use-case and
   repository layer changes, also write integration tests (`*.int-test.ts` in the same
   directory).
4. Implement minimum code to make tests pass.
5. Append observations / deviations to
   `docs/implementation-notes/SPEC-NNN-<slug>.md` as they happen; triage at
   close-out into the spec's deviations table, post-impl notes, tech-debt,
   or discarded.
6. Run the verification commands above.
7. Update `CHANGELOG.md` under `## [Unreleased]`.
8. **Review and patch any docs that describe stale state** (see Doc review below).
9. **Write an ADR** if the change meets the trigger criteria below.
10. Open the implementation PR with label `ai:done` and a Conventional
    Commit title — Matt reviews and merges.

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
AUTH_JWT_SIGNING_KEY=    # HS256 signing key for /api/v1/* bearer tokens (openssl rand -base64 32). Must differ from AUTH_SECRET (SPEC-002).
AUTH_GOOGLE_ID=          # Google OAuth client ID
AUTH_GOOGLE_SECRET=      # Google OAuth client secret
AUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true     # trust host headers (required for Vercel preview domains)
AUTH_ENABLE_LOCAL_DEV=false   # set true to allow local-dev credentials outside NODE_ENV=development
RESEND_API_KEY=          # Resend API key (required in production)
EMAIL_FROM_ADDRESS=hello@mail.matthewcarr.dev
EMAIL_FROM_NAME=Travel Planner
AI_GATEWAY_API_KEY=      # Vercel AI Gateway key (local dev / non-Vercel CI). On Vercel deployments this is unset and the SDK uses VERCEL_OIDC_TOKEN automatically. See ADR 040.
# AI_GATEWAY_MODEL=      # override model id (defaults to openai/gpt-5.4-mini, gateway-routed). Terraform-managed in prod/preview via the ai_gateway_model variable — see ADR 040.
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

The five web jobs run in parallel on every push and PR; three
path-filtered mobile jobs (`mobile-typecheck`, `mobile-unit-test`,
`mobile-e2e` — ADR 052/055) run when `apps/mobile/**`, the lockfile /
workspace config, `packages/shared/**` (the wire contract), or `ci.yml`
itself changes, and can be forced on any branch via `workflow_dispatch`
with `mobile: true`. Since SPEC-013 / ADR 060 the macOS `mobile-e2e` job
runs Maestro against a **real backend**: native PostgreSQL (no Docker on
macOS runners) + `db:migrate`/`db:seed`/`seed:e2e` + the production Next
server, with a canary + bundle-URL assertion gating before Maestro.

The web jobs:

- `lint` (`pnpm lint`)
  - also runs `pnpm db:check:migrations` to enforce transactional migration policy
- `type-check` (`pnpm type-check`)
- `unit-test` (`pnpm test:unit`)
- `integration-test` (`pnpm test:integration`) — runs repository and use-case tests
  against a real Postgres database via Testcontainers. Docker is available by default
  on `ubuntu-latest` GitHub Actions runners.
- `e2e` (web Playwright) — builds the app with a dummy `POSTGRES_URL` (`pnpm build`),
  then runs `pnpm test:e2e:web`. `tests/e2e/setup/start-web-server.ts` starts a throwaway
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
| A new `/api/v1/*` endpoint or error code | `docs/api-conventions.md` (vocabulary tables, naming, streaming-compat); `packages/shared/src/api-errors.ts` is the source of truth for the `ApiErrorCode` / `ApiErrorBody` union + zod schema (SPEC-005); `apps/web/src/app/api/v1/_lib/errors.ts` holds the load-bearing `export type {...} from '@travel-planner/shared'` shim plus the server-side `respondWithError` helper and `STATUS_BY_CODE` map — keep them in lock-step when adding a code; `apps/web/src/proxy.ts` matcher already excludes `api/v1` (SPEC-002), so v1 endpoints handle their own auth |
| A `@travel-planner/shared` wire schema or a `/api/v1/*` request/response/error shape | Run `pnpm openapi:generate` and commit `docs/openapi/v1.yaml` in the same change — `pnpm openapi:check` (in the CI `lint` job) fails on drift. Generator: `apps/web/scripts/generate-openapi.ts` (zod-native `z.toJSONSchema`, SPEC-008 / ADR 056). New endpoints must be added to the generator's `paths`/registry |
| Proxy / middleware matcher (`apps/web/src/proxy.ts`) | Verify excluded paths (e.g. `api/auth`, `api/v1`) still handle their own auth and return their own envelopes; run `pnpm test:e2e:web` |
| Epic (add / status change / slice ledger update) | `docs/epics/README.md` index; the linked strategic ADR if any |
| A slice of an epic shipped or changed status | The parent epic's §7 slice table and slice ledger |
| Sentry configuration or alerts | `docs/decisions/032-sentry-error-monitoring.md`, `docs/operations/sentry.md` |
| Infrastructure modules or Terraform config (`infra/`) | `infra/README.md`, infrastructure specific ADRs |

**Signs a doc is stale:** it describes a tool, file, or behaviour that no longer
exists; it omits a key file or command that does exist; its prerequisites or
setup steps no longer work end-to-end.

---

Full rules → [`CONSTITUTION.md`](./CONSTITUTION.md)
ADRs → [`docs/decisions/`](./docs/decisions/)
Epics → [`docs/epics/`](./docs/epics/)
Feature specs → [`docs/specs/`](./docs/specs/)
Implementation notes → [`docs/implementation-notes/`](./docs/implementation-notes/)
Tech debt → [`docs/tech-debt.md`](./docs/tech-debt.md)
