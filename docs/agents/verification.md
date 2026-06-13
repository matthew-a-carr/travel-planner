# Stack & Verification

The injection point the universal engineering skills (`tdd`,
`debugging-and-error-recovery`, `security-and-hardening`, `code-review`, …)
read to learn this repo's toolchain and commands, so the same language-agnostic
skill works here as it does in any other repo.

## Stack

- **Runtime/framework**: Next.js (App Router) + React + TypeScript, pnpm monorepo
- **Package manager / build**: pnpm
- **Lint/format**: Biome
- **Unit / integration tests**: Vitest (integration uses real Postgres via Testcontainers)
- **e2e**: Playwright (web) + Maestro (mobile)
- **DB**: Drizzle + Postgres

## Verification

**`AGENTS.md` is canonical.** Do not duplicate the command list here — it drifts.
Run the commands from the two tables in the root [`AGENTS.md`](../../AGENTS.md):

- **"Verification — run this before pushing"** — the five gates (`pnpm lint`,
  `pnpm db:check:migrations`, `pnpm type-check`, `pnpm test:unit`,
  `pnpm test:integration`) plus the production build check.
- **"What to run based on what you changed"** — the scoped subset to run for a
  given change.

CI (`.github/workflows/ci.yml`) is the hard gate; run the relevant subset
locally first to avoid round-trips.
