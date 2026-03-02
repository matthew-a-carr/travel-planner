# Contributing

Internal team guide. See `CONSTITUTION.md` for the full engineering contract.

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20 LTS | Use `nvm use` or `fnm use` if you have a version manager |
| pnpm | 10 | `npm install -g pnpm@10` |
| Docker | 24+ | Required for integration tests and E2E tests (Testcontainers) |

## First-time setup

```bash
pnpm install
pnpm dev
```

`pnpm dev` is the default local bootstrap path. When `POSTGRES_URL` is not set,
it starts a throwaway Testcontainers Postgres instance, runs migrations, and
seeds country reference data automatically.

If you want to use your own database/OAuth credentials instead:

```bash
cp .env.example .env.local
# fill in .env.local values
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Running tests

| Command | What it runs | Docker required |
|---------|-------------|-----------------|
| `pnpm test:unit` | Domain functions + architecture tests | No |
| `pnpm test:integration` | Repository + use-case tests against a real Postgres DB | Yes |
| `pnpm test` | All unit + integration tests | Yes |
| `pnpm test:e2e` | Playwright end-to-end tests | Yes |

**Unit tests** are instant (~1 s) — run these during development for rapid feedback.

**Integration tests** start a Testcontainers PostgreSQL instance (~10–15 s first run). The
container is shared across all integration test files in a single `pnpm test:integration` run.

**E2E tests** start the full Next.js application and a separate Testcontainers Postgres instance.

### Test file naming convention

| Suffix | Type | Docker | Example |
|--------|------|--------|---------|
| `.test.ts` | Unit | No | `src/domain/trip/trip.test.ts` |
| `.int-test.ts` | Integration | Yes | `src/application/use-cases/create-trip.int-test.ts` |
| `.spec.ts` | E2E (Playwright) | Yes | `tests/e2e/01-trips.spec.ts` |

The Vitest config uses file-suffix globs (`src/**/*.test.ts` / `src/**/*.int-test.ts`) so new
integration test files are picked up automatically — no config change needed.
See `docs/decisions/012-integration-test-naming-convention.md`.

## Before pushing — pre-push hook

A git pre-push hook in `.githooks/pre-push` runs automatically on every `git push` and
blocks the push if any check fails:

1. `pnpm lint` — Biome, zero errors required
2. `pnpm type-check` — TypeScript strict, zero errors required
3. `pnpm test:unit` — unit tests, no Docker required
4. `pnpm test:integration` — real-DB tests via Testcontainers (skipped with a warning if Docker is unavailable; CI always runs them)

The hook is activated by the `prepare` npm lifecycle script, which runs on install:

```bash
pnpm install   # installs deps AND runs: git config core.hooksPath .githooks
```

**Bypass** (emergency only, requires team lead approval):

```bash
git push --no-verify
```

## Commit conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).
Every commit message on `main` must follow the format:

```
<type>(<optional scope>): <description>

[optional body]

[optional footer]
```

Common types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`.

Breaking changes: append `!` after the type (`feat!:`) or add `BREAKING CHANGE:` in the footer.

## Branch workflow

1. Create a branch from `main`: `git checkout -b feat/my-feature`
2. Make small, focused commits with conventional commit messages
3. Open a pull request against `main`
4. CI must pass (lint + type-check + tests) before merging
5. Squash or rebase onto `main` — no merge commits

See `CONSTITUTION.md` for the full branch and review policy.

## Release workflow

Releases are automated via [Release Please](https://github.com/googleapis/release-please).

1. Push conventional commits to `main` (via merged PRs)
2. Release Please opens/updates a **"chore: release X.Y.Z"** PR that bumps `package.json`
   and generates the CHANGELOG section from your commits
3. The team reviews and merges the Release PR
4. Release Please tags the merge commit (e.g. `v0.5.0`) and creates a GitHub Release

**Do not manually edit `CHANGELOG.md`** for release notes. The `[Unreleased]` section can be used
during development for in-progress notes; Release Please will incorporate them on next release.

## Architecture overview

```
src/
  domain/         Pure business logic — no framework dependencies
  application/    Use cases — orchestrate domain + repository interfaces
  infrastructure/ Drizzle repositories, Auth.js, DB client
  ui/             React components (client-side state, forms)
  app/            Next.js App Router (pages, server actions)
```

Layer boundaries (enforced by architecture tests):

- `domain` must not import from `application`, `infrastructure`, or `ui`
- `application` must not import from `infrastructure` or `ui`
- `infrastructure` must not import from `ui`

## Key conventions

- **Money as integers**: all monetary amounts are stored as integer pence/cents. Never use floats
  for money. Conversion from user-entered pounds to pence happens at the server action boundary
  (`Math.round(parseFloat(pounds) * 100)`).
- **Result type**: use cases return `Result<T>` — never throw for expected error paths.
- **GBP only (MVP)**: currency is hardcoded to GBP throughout. See `docs/decisions/011-gbp-only-currency.md`.
- **Real DB tests**: integration tests use Testcontainers — never mock repositories or the DB.
