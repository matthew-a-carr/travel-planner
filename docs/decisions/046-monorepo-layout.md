# ADR 046: Monorepo Layout — apps/ and packages/

**Date:** 2026-05-16
**Status:** Accepted

## Context

[ADR 045](045-ios-app-strategy.md) commits the project to adding an Expo
React Native iOS app alongside the existing Next.js web app, with both
clients calling the same use cases. That decision creates two new structural
needs:

1. **A second application in the same repository.** The iOS app will live
   alongside the web app, deployed independently, but sharing types and
   conventions. Atomic cross-cuts (e.g. add an API endpoint + a web call
   site + a mobile call site) need to land as a single PR.
2. **Shared TypeScript code between the two clients.** Domain types and zod
   schemas defined in the web app must be importable by the mobile app
   without npm-publishing or git submodules.

The repository was previously a single-package project: every file lived at
the root, `package.json` was the web app's package.json, and pnpm workspaces
were declared but not used (`pnpm-workspace.yaml` only carried
`ignoredBuiltDependencies`).

Three layout options were considered:

- **Keep root + add `mobile/` and `shared/` as siblings to `src/`.** Minimum
  disruption but conceptually muddled — the root is simultaneously the web
  app and the workspace root, which creates `package.json` semantics
  conflicts and obscures the "two equal apps" framing.
- **Keep root web app, add `apps/mobile/` and `packages/shared/`.** Asymmetric
  — one app at root, others nested. Path patterns (`apps/*`) and tooling
  globs become awkward.
- **Move web into `apps/web/`, add `apps/mobile/` and `packages/shared/`
  later.** Symmetric, idiomatic, matches the layout of every well-known
  Next.js + Expo monorepo template (T3 Turbo, Solito starter, Vercel's own
  examples).

## Decision

Move the existing Next.js application into `apps/web/`. Establish a pnpm
workspace at the repo root with the following structure:

```
travel-planner/
├── apps/
│   └── web/          ← the existing Next.js application
│       ├── src/
│       ├── tests/
│       ├── public/
│       ├── drizzle/
│       ├── scripts/
│       ├── package.json   (name: @travel-planner/web)
│       ├── next.config.ts
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       ├── playwright.config.ts
│       ├── drizzle.config.ts
│       ├── postcss.config.mjs
│       ├── sentry.{client,server,edge}.config.ts
│       └── .env.example
├── packages/         ← reserved for shared workspace packages (empty for now)
├── docs/             ← project-wide documentation (root)
├── infra/            ← Terraform (root, unchanged)
├── .github/          ← workflows (root, unchanged)
├── biome.json        ← workspace-wide formatter/linter config
├── package.json      ← workspace root (name: travel-planner, pass-through scripts)
├── pnpm-workspace.yaml
└── (CONSTITUTION.md, AGENTS.md, README.md, etc.)
```

### Workspace root scripts

The root `package.json` retains every previously available command via
pass-through to the web workspace:

- `pnpm dev`, `pnpm build`, `pnpm start`, `pnpm test:*`, `pnpm db:*`,
  `pnpm auth:bootstrap-admin` — filter to `@travel-planner/web`.
- `pnpm lint`, `pnpm format` — run Biome directly from the root (Biome 2
  is configured workspace-wide and is the only devDependency at the root).
- `pnpm type-check`, `pnpm test`, `pnpm test:unit`, `pnpm test:integration`
  — use `pnpm -r` to run recursively across every workspace that declares
  the script (currently just `web`; mobile will join when added).
- `prepare` (git hooks path) stays at the root.

This means **every CI command and developer command in `AGENTS.md` continues
to work unchanged**.

### Biome lives at the root

Biome is the only devDependency at the workspace root. `biome.json` stays at
the root with its `files.includes` glob widened to `apps/*/src/**` so any
future app added under `apps/` is picked up automatically. Biome's git-vcs
ignore-file detection works correctly from the root cwd, which would not
have been the case had `biome.json` lived inside `apps/web/`.

### What did *not* move

- `docs/`, `infra/`, `.github/`, `.githooks/`, `.claude/`
- `CONSTITUTION.md`, `AGENTS.md`, `CLAUDE.md` (symlink), `README.md`,
  `CONTRIBUTING.md`, `CHANGELOG.md`, `LICENSE`
- `pnpm-lock.yaml` (workspace lockfile)
- `node_modules/` (workspace store)

These are project-wide concerns and stay at the root.

### Release-please

`release-please-action` is configured with `release-type: node` which by
default reads version from the root `package.json`. The root package.json
keeps the name `travel-planner` and the current version, so release-please
behaviour is unchanged. The web app's package.json (`@travel-planner/web`)
carries the same version number for now; future versioning of the web
package independently from the workspace root is a deferred concern.

## Consequences

- **`AGENTS.md` "Verification" commands remain identical.** No developer
  documentation churn is forced by this move beyond a single short
  "Repo layout" section pointing readers at `apps/web/`.
- **CI workflow needed two small tweaks:** the Playwright browser install
  now goes through the web filter (`pnpm --filter @travel-planner/web exec
  playwright install`), and the failure-case Playwright report artifact
  path is `apps/web/playwright-report/`. The other four CI jobs are
  byte-identical because they call root scripts.
- **Vercel build configuration may need a Root Directory override** to
  point at `apps/web/`. Whether this is needed depends on the Vercel
  project's Build Output API support for pnpm workspaces; verified at
  deploy time. Not a blocker for the next slice.
- **In-document path references like `src/domain/` remain accurate** as
  conceptual paths within the web app. A new "Repo layout" section in
  `AGENTS.md` clarifies that these resolve under `apps/web/`.
- **Future apps and packages drop in cleanly.** `apps/mobile/` (Slice 5)
  and `packages/shared/` (Slice 4) are siblings of `apps/web/` and need
  no further structural decisions.
- **History is preserved.** Every move used `git mv`, so file history is
  followed across the rename.
- **All five verification commands and the production build pass after
  the move** (Lint 227 files, Type-check, Unit 350/350 tests, Integration
  217/217 tests, Migration safety, `next build` with all 8 routes).

## Alternatives considered

- **Single-package layout, sibling `mobile/` and `shared/` directories at
  root.** Rejected. Mixes the web app with the workspace root, creates
  package.json identity confusion, breaks the symmetry every future app
  would benefit from.
- **Hybrid layout: root = web app, `apps/mobile/` and `packages/shared/`
  nested.** Rejected. Asymmetric globs (`apps/*` doesn't cover the web
  app), Biome and TypeScript path patterns become bespoke per app.
- **Turborepo or Nx instead of vanilla pnpm workspaces.** Rejected for
  this slice. pnpm workspaces alone meet the requirement; Turborepo's
  task-pipeline benefits are real but add tooling complexity and a config
  surface that is overkill for two apps. Can be added later without
  restructuring.
- **Separate repository for the iOS app.** Rejected in ADR 045 — cross-
  cutting changes become multi-PR coordination, type sharing requires
  publishing a private npm package, and the AI-driven workflow works
  better against one repo per session.
