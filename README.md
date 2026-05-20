# Travel Planner

A collaborative travel budget planning app for multi-destination round-the-world trips. Create trips, allocate budgets per destination, log spending, and track what you have left — with a ringfenced reserve for fixed costs like visas.

Built as a portfolio piece demonstrating production-quality Next.js architecture, DDD-inspired layered design, and AI-assisted development practices.

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, server components, server actions) |
| Language | TypeScript (strict mode) |
| Database | Vercel Postgres (Neon) via Drizzle ORM |
| Auth | Auth.js v5 — Google OAuth + dev-only local login fallback + app-level access controls |
| Observability | Sentry (Error monitoring & performance tracing) |
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
- Docker (required for one-command local dev, integration tests, and e2e tests)
- Optional: a Vercel Postgres/Neon database URL if you do not want the local Testcontainers database
- Optional: a Google OAuth application ([console.cloud.google.com](https://console.cloud.google.com)) for real Google sign-in

### Setup

```bash
git clone https://github.com/matthew-a-carr/travel-planner.git
cd travel-planner
pnpm install
```

Start the app with one command:

```bash
pnpm dev
```

If `POSTGRES_URL` is missing, `pnpm dev` will:
- start a throwaway `postgres:16-alpine` container via Testcontainers
- run `pnpm db:migrate`
- run `pnpm db:seed`
- set safe local defaults for `AUTH_SECRET`, `AUTH_JWT_SIGNING_KEY`, `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET`
- on macOS, attempt to open Docker Desktop automatically if the Docker runtime is not ready

In local development, you can always use a one-click **Sign in locally (dev)** button
without configuring Google OAuth. The **Sign in with Google** button only appears when
`AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are set to real (non-placeholder) values.

Production access is closed by default:
- users must be pre-provisioned and approved before Google sign-in is allowed
- users with no organization memberships are routed to `/settings/organizations`
- only app admins can create organizations
- invite emails use Resend in `VERCEL_ENV=production`; development/preview/test
  use a logging-only provider
- shared transactional email setup + template standards are documented in
  [`docs/email-delivery.md`](./docs/email-delivery.md)

Bootstrap the first admin in each environment before cutover:

```bash
POSTGRES_URL=... pnpm auth:bootstrap-admin -- admin@example.com \"Admin User\"
```

Organization creation and membership management are split in Settings:
- `/settings/organizations` for creating organizations and reviewing organizations
  you belong to
- `/settings/organization` for managing members of the currently active
  organization (owner-only mutations, member-visible read access)

Member assignment uses a searchable picker backed by the `users` table
(pre-provisioned users only). First-time pre-provision approval sends a warm
invite email; explicit resend is available from access settings.

If you want to use your own database and OAuth credentials, copy the template
and fill in your values. The web app reads `.env.local` from its own
directory (see ADR 046 for the monorepo layout):

```bash
cp apps/web/.env.example apps/web/.env.local
```

```
POSTGRES_URL=             # Vercel Postgres / Neon connection string
AUTH_SECRET=              # generate with: openssl rand -base64 32
AUTH_JWT_SIGNING_KEY=     # HS256 key for /api/v1/* bearer tokens (openssl rand -base64 32); must differ from AUTH_SECRET
AUTH_GOOGLE_ID=           # Google OAuth client ID
AUTH_GOOGLE_SECRET=       # Google OAuth client secret
AUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true      # trust host headers (required for Vercel preview domains)
AUTH_ENABLE_LOCAL_DEV=false
RESEND_API_KEY=           # Resend API key (required in Vercel production)
EMAIL_FROM_ADDRESS=hello@mail.matthewcarr.dev
EMAIL_FROM_NAME=Travel Planner
```

Open [http://localhost:3000](http://localhost:3000).

## Running checks

CI runs all checks on every push and PR. Run relevant checks locally before
pushing to catch issues early (see [`AGENTS.md`](./AGENTS.md) for the
change-aware verification table):


```bash
pnpm lint               # Biome lint + import ordering
pnpm db:check:migrations # block non-transactional SQL in deploy migrations
pnpm type-check         # TypeScript strict type check
pnpm test:unit          # Vitest unit tests (no Docker required)
pnpm test:integration   # Vitest integration tests — real Postgres via Testcontainers (Docker required)
pnpm test:e2e           # Playwright e2e — self-contained via Testcontainers (Docker required)
```

Before pushing changes that can affect production build/runtime wiring, also run:

```bash
POSTGRES_URL=postgresql://build:build@localhost:5432/build pnpm build
```

CI runs all checks in parallel: lint, type-check, unit tests, integration tests, and the
production build and e2e suite.

## Architecture

This is a pnpm monorepo (see [ADR 046](./docs/decisions/046-monorepo-layout.md)).
The web app lives at `apps/web/`; future apps (iOS — see [ADR 045](./docs/decisions/045-ios-app-strategy.md))
will live alongside it under `apps/`. Inside the web app, the codebase follows
a DDD-inspired layered architecture with mechanically enforced import boundaries:

```
apps/web/src/domain/        Pure TypeScript domain logic — no external dependencies
apps/web/src/application/   Use cases — orchestrates domain; no framework code
apps/web/src/infrastructure Adapters — Drizzle repositories, Auth.js, external APIs
apps/web/src/ui/            React components
apps/web/src/app/           Next.js App Router (pages, layouts, server actions)
```

Layer boundaries are enforced by `apps/web/src/__tests__/architecture.test.ts`. Breaking them fails CI.

Key domain decisions:
- **Money as integers in pence** — never floats
- **Result types** — `{ ok: true; value }` or `{ ok: false; error }` — no exceptions from domain
- **Named fixed costs** — a `Trip` has a list of `TripFixedCost` items (flights, insurance, etc.) each deducted from the total before destination allocations
- **Organization scoping** — trips belong to organizations; owners manage membership with searchable existing-user assignment and members collaborate inside shared organizations
- **Soft deleting** — users can be soft-deleted across all organizations simultaneously.

See [`AGENTS.md`](./AGENTS.md) for agent and contributor quick-reference.
See [`CONSTITUTION.md`](./CONSTITUTION.md) for full engineering standards.
See [`docs/decisions/`](./docs/decisions/) for architecture decision records.
See [`docs/email-delivery.md`](./docs/email-delivery.md) for email integration
runbook and template standards.
See [`docs/operations/sentry.md`](./docs/operations/sentry.md) for error monitoring and observability.

## Database

```bash
pnpm db:generate   # generate a Drizzle migration file from schema changes
pnpm db:migrate    # apply pending migrations
pnpm db:push       # push schema directly to DB (dev / quick iteration only)
pnpm db:seed       # seed country reference data (idempotent upsert)
```

## Deployment

Infrastructure and deployment wiring are Terraform-managed under [`infra/`](./infra):

- `infra/stacks/prod` manages production Vercel + Neon
- `infra/stacks/preview` manages per-PR preview Neon branches and preview env vars
- Terraform Cloud stores separate state for `travel-planner-prod` and `travel-planner-preview`

Vercel runs this build command (managed via Terraform):

```bash
pnpm build && pnpm db:migrate:deploy && pnpm db:seed
```

Migrations run inside deployment. If migration fails, deployment fails and transaction-scoped migration changes roll back.

If you want to keep this stack strictly on free tiers, see
[`docs/free-tier-guardrails.md`](./docs/free-tier-guardrails.md) for provider limits,
payment-risk triggers, and direct login links.
