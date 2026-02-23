# ADR 001: Initial Technology Stack

**Date:** 2026-02-22
**Status:** Accepted

## Context

We are building a personal travel budget planning application — Travel Planner — to plan and track spending across a multi-destination round-the-world trip. The application needs to be production-quality (serving as a portfolio piece), maintainable over time, and deployed publicly.

The developer (Matt) is a Senior Backend Engineer with deep experience in Java/Spring Boot, DDD, and TDD. The stack should feel natural to someone coming from a typed, layered backend background while fully embracing the modern JavaScript/TypeScript ecosystem.

## Decision

### Framework: Next.js 15 (App Router)

Next.js provides full-stack React with server components, server actions, and API routes in a single framework. The App Router model aligns well with layered architecture: server components handle data fetching (infrastructure layer concerns), while client components handle interactivity (UI layer). Vercel's first-party support makes deployment trivial.

### Language: TypeScript (strict mode)

TypeScript strict mode is non-negotiable. No `any` types. The domain layer uses pure TypeScript with no framework dependencies, enabling value objects, Result types, and rich domain modelling with full type safety.

### Database: Vercel Postgres (Neon)

Zero-configuration Postgres on Vercel. Real SQL database (not SQLite or an in-memory store), suitable for production. Neon provides serverless Postgres with connection pooling that works well in Vercel's serverless environment.

### ORM: Drizzle ORM

Drizzle is lightweight, schema-first, and provides excellent TypeScript inference. Unlike Prisma, it doesn't abstract away SQL — queries are composable and explicit. The schema-as-code approach in TypeScript keeps the DB schema co-located with the codebase and enables strong typing at the repository layer.

### Auth: Auth.js v5 (next-auth@beta)

Auth.js v5 is the native Next.js authentication solution with first-class App Router support. The Drizzle adapter means auth tables live in the same Postgres database as application data. Google OAuth is the initial provider — simple to configure, and Matt has a Google account.

### Styling: Tailwind CSS v4

Utility-first CSS that produces consistent, maintainable styling without custom CSS files. v4 brings improved performance and a native CSS custom properties approach. shadcn/ui provides accessible, unstyled components built on Radix primitives that integrate cleanly with Tailwind.

### Testing: Vitest (unit/domain) + Playwright (e2e)

Vitest is fast, modern, and compatible with Jest syntax. It runs domain tests without needing a browser or Next.js runtime. Playwright handles e2e tests against the running application. Domain tests are co-located with domain code; e2e tests live in `tests/e2e/`.

### Package Manager: pnpm

Faster installs, efficient disk usage via content-addressable storage, and strict dependency isolation. Workspace support for monorepo expansion if needed.

### Deployment: Vercel

First-party Next.js hosting with instant preview deployments per PR, automatic Postgres provisioning, and environment variable management. Planned deployment under matthewcarr.dev domain.

### CI: GitHub Actions

Runs on every push and PR: lint, type-check, unit tests. Lightweight, no external CI service required.

## Architecture: DDD-Inspired Layers

The codebase is structured in four layers with strict import rules enforced by structural tests:

| Layer | Location | Rule |
|---|---|---|
| Domain | `src/domain/` | ZERO external imports. Pure TypeScript only. |
| Application | `src/application/` | May import from `domain/` only. |
| Infrastructure | `src/infrastructure/` | May import from `domain/` and `application/`. |
| UI | `src/app/` + `src/ui/` | May import from any layer. |

This separation ensures the domain layer is framework-agnostic and independently testable. Business logic (budget invariants, ringfencing) lives in pure functions, not in route handlers or ORM callbacks.

## Key Domain Decisions

- **Money as integers in pence:** All monetary values are stored and computed as integers (pence/cents). No floating point arithmetic for money. The domain layer converts to display strings; the DB stores raw integers.
- **Australia ringfence as first-class concept:** The `Trip` aggregate has a `ringfencedAmount` field representing the reserved Australia visa/living budget (£16,000). This reduces available budget before any destination allocation. It is not a destination — it is a constraint on the `Trip` itself.
- **Result types over exceptions:** Domain functions return `{ ok: true, value }` or `{ ok: false, error }` — never throw. This makes failure modes explicit and type-safe.

## Consequences

- The domain layer can be tested without spinning up Next.js, a database, or any external service.
- Infrastructure implementations (repositories) are swappable — the domain only depends on interfaces.
- The Drizzle schema and Auth.js configuration are entirely in the infrastructure layer; the domain has no knowledge of them.
- Future additions (currency conversion, AI cost estimation via Vercel AI SDK) fit naturally into the existing layers.
