# Travel Planner

A personal travel budget planning app for multi-destination round-the-world trips. Create trips, allocate budgets per destination, log spending, and track what you have left — with a ringfenced reserve for fixed costs like visas.

Built as a portfolio piece demonstrating production-quality Next.js architecture, DDD-inspired layered design, and AI-assisted development practices.

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router, server components, server actions) |
| Language | TypeScript (strict mode) |
| Database | Vercel Postgres (Neon) via Drizzle ORM |
| Auth | Auth.js v5 — Google OAuth |
| Styling | Tailwind CSS v4 |
| Lint / Format | Biome v2 |
| Unit tests | Vitest |
| Integration tests | Vitest + Testcontainers |
| e2e tests | Playwright |
| Package manager | pnpm |
| Deployment | Vercel |

## Local development

### Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- Docker (required for integration tests and e2e tests — Testcontainers manages the database automatically)
- A Vercel Postgres or Neon database (or any Postgres connection string) for local dev
- A Google OAuth application ([console.cloud.google.com](https://console.cloud.google.com))

### Setup

```bash
git clone https://github.com/matthew-a-carr/travel-planner.git
cd travel-planner
pnpm install
```

Copy the environment variable template and fill in your values:

```bash
cp .env.example .env.local
```

```
POSTGRES_URL=             # Vercel Postgres / Neon connection string
AUTH_SECRET=              # generate with: openssl rand -base64 32
AUTH_GOOGLE_ID=           # Google OAuth client ID
AUTH_GOOGLE_SECRET=       # Google OAuth client secret
```

Apply database migrations and seed reference data:

```bash
pnpm db:migrate
pnpm db:seed
```

Start the dev server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Running checks

A pre-push hook runs all checks automatically before every `git push` — you don't need
to invoke them manually before pushing.

To run checks mid-task:

```bash
pnpm lint               # Biome lint + import ordering
pnpm type-check         # TypeScript strict type check
pnpm test:unit          # Vitest unit tests (no Docker required)
pnpm test:integration   # Vitest integration tests — real Postgres via Testcontainers (Docker required)
pnpm test:e2e           # Playwright e2e — self-contained via Testcontainers (Docker required)
```

CI runs all checks in parallel: lint, type-check, unit tests, integration tests, and the
production build and e2e suite.

## Architecture

The codebase follows a DDD-inspired layered architecture with mechanically enforced import boundaries:

```
src/domain/        Pure TypeScript domain logic — no external dependencies
src/application/   Use cases — orchestrates domain; no framework code
src/infrastructure Adapters — Drizzle repositories, Auth.js, external APIs
src/ui/            React components
src/app/           Next.js App Router (pages, layouts, server actions)
```

Layer boundaries are enforced by `src/__tests__/architecture.test.ts`. Breaking them fails CI.

Key domain decisions:
- **Money as integers in pence** — never floats
- **Result types** — `{ ok: true; value }` or `{ ok: false; error }` — no exceptions from domain
- **Named fixed costs** — a `Trip` has a list of `TripFixedCost` items (flights, insurance, etc.) each deducted from the total before destination allocations

See [`AGENTS.md`](./AGENTS.md) for agent and contributor quick-reference.
See [`CONSTITUTION.md`](./CONSTITUTION.md) for full engineering standards.
See [`docs/decisions/`](./docs/decisions/) for architecture decision records.

## Database

```bash
pnpm db:generate   # generate a Drizzle migration file from schema changes
pnpm db:migrate    # apply pending migrations
pnpm db:push       # push schema directly to DB (dev / quick iteration only)
pnpm db:seed       # seed country reference data (idempotent upsert)
```

## Deployment

Deploys to Vercel. Connect the GitHub repository in the Vercel dashboard, set the environment variables, and deployments happen automatically on push to `main`.
