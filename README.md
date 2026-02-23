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
| e2e tests | Playwright |
| Package manager | pnpm |
| Deployment | Vercel |

## Local development

### Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- A Vercel Postgres or Neon database (or any Postgres connection string)
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

Push the database schema:

```bash
pnpm db:push
```

Start the dev server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Running checks

```bash
pnpm lint          # Biome lint + import ordering
pnpm type-check    # TypeScript strict type check
pnpm test          # Vitest unit tests
pnpm test:e2e      # Playwright e2e (requires running server)
```

All three (`lint`, `type-check`, `test`) run automatically in CI on every push and PR.

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
- **Ringfenced budget** — a `Trip` has a `ringfencedAmount` for fixed costs (e.g. visa reserve) that reduces allocatable budget before any destination allocation

See [`AGENTS.md`](./AGENTS.md) for agent and contributor quick-reference.
See [`CONSTITUTION.md`](./CONSTITUTION.md) for full engineering standards.
See [`docs/decisions/`](./docs/decisions/) for architecture decision records.

## Database

```bash
pnpm db:push       # push schema to DB (dev / quick iteration)
pnpm db:generate   # generate Drizzle migration files
pnpm db:migrate    # run migrations (production)
```

## Deployment

Deploys to Vercel. Connect the GitHub repository in the Vercel dashboard, set the environment variables, and deployments happen automatically on push to `main`.
