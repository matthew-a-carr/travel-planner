---
name: deploy-smoke-test
description: >
  Confirm a production deploy actually landed and is healthy. Verifies the
  latest Vercel Production deployment is READY and matches the current `main`
  commit, runs HTTP canary checks against travel.matthewcarr.dev, confirms
  migrations applied, and checks for a post-deploy Sentry error spike. Use after
  merging to `main`, or when a human asks "is prod healthy?" / "did the deploy
  go out?" / "smoke test production". Read-only against prod by default.
---

# Deploy Smoke Test

## When to use

Deploys here are **Vercel Git-integration**: a push to the production branch
(`main`) triggers a Vercel build (`pnpm build && pnpm db:migrate:deploy &&
pnpm db:seed`, per `infra/stacks/prod`) that deploys to
`https://travel.matthewcarr.dev` (project + domain managed in
`infra/modules/vercel-project`, ADR-tracked). There's no CI deploy job and no
GitHub Actions migration step (AGENTS.md). This skill is the post-deploy "did
it actually work in prod" check.

Use it after merging an impl PR, after an infra/migration change, or any time
someone needs confidence prod is serving the latest commit.

## Prerequisites

- **Vercel CLI** authenticated (`vercel whoami` succeeds) and the project
  linked (`vercel link`), **or** a `VERCEL_TOKEN` in the environment for
  non-interactive use. If the CLI isn't installed/authed, say so and point at
  the one-time setup (`pnpm dlx vercel login` + `vercel link`) rather than
  guessing deployment state.
- `curl` for the HTTP canaries.

## Step 1 — Identify the expected commit

1. `git rev-parse --short HEAD` on `main` (pull first). This is the SHA the
   live Production deployment should be serving.

## Step 2 — Confirm the deployment landed

2. List recent deployments: `vercel ls` (or the Vercel REST API with
   `VERCEL_TOKEN`). Find the most recent **Production** deployment.
3. `vercel inspect <deployment-url>` and confirm:
   - **State = READY** (not BUILDING / ERROR / CANCELED). A READY production
     deployment implies the build's `db:migrate:deploy` step succeeded — a
     failed migration fails the build, so it never reaches READY. Note that
     explicitly in the report.
   - The deployment's **git commit SHA matches Step 1**. A mismatch means the
     latest push didn't deploy (build still running, or a failed build left an
     older deployment live) — that's a finding, not a pass.

## Step 3 — HTTP canaries

There is currently **no dedicated `/health` endpoint** (see "Gaps" below), so
canary a small set of real routes against `https://travel.matthewcarr.dev`:

4. Home / landing page → `curl -sS -o /dev/null -w "%{http_code}"` expects
   `200` (or a `3xx` to sign-in, then that page `200`).
5. An authenticated `/api/v1/*` endpoint (e.g. `/api/v1/me`) **without** a
   bearer token → expects the proper JSON **401 envelope** (the shared
   `ApiErrorCode` shape, ADR 056), **not** a `500` and not an HTML error page.
   A 500 here is a strong signal the deploy is broken (bad env var, DB
   unreachable).
6. Check security/response headers are present and the response isn't a Vercel
   error page (`x-vercel-error`).

Record the status code + a one-line verdict for each. Any `5xx`, or an
`/api/v1` route returning HTML instead of the JSON envelope, is a **fail**.

## Step 4 — Post-deploy error check (optional but recommended)

7. Per `docs/operations/sentry.md`, check Sentry for a new error spike since the
   deployment timestamp on the `travel.matthewcarr.dev` project. A fresh burst
   of unhandled errors right after deploy is a fail even if the canaries pass.

## Step 5 — Report

```markdown
## Prod smoke test — <YYYY-MM-DD HH:MM>

- Expected commit: <sha>  ·  Live deployment: <sha> — ✅ match | ❌ mismatch
- Deployment state: READY ✅ | ERROR ❌  (migrations: applied via build)
- Canaries:
  - / → 200 ✅
  - /api/v1/me (no token) → 401 JSON envelope ✅ | 500 ❌
- Sentry: no new spike ✅ | <N> new errors since deploy ❌

**Verdict:** Healthy | Degraded | Broken
```

If **Broken**: state the most likely cause (failed build → check `vercel logs
<url>`; commit mismatch → build still running or errored; 500s → env/DB). In a
routine context, DM `$SLACK_NOTIFY_USER`.

## Acting on a bad deploy (only on explicit instruction)

- Inspect build logs: `vercel logs <deployment-url>`.
- Roll back to the previous good deployment: `vercel rollback <url>` (or
  `vercel promote <previous-url>`) — **only when the user asks**. Rolling back
  prod is outward-facing; confirm first.
- Don't trigger a fresh deploy by re-pushing without understanding the failure.

## Gaps worth closing (surface, don't silently work around)

- **No `/health` endpoint.** A tiny `app/api/health/route.ts` returning
  `{ status, commit, migratedAt }` would make this skill (and uptime monitoring)
  far more reliable than scraping page status codes. Per the repo's
  "durable over expedient" bias, recommend adding one as a small SPEC rather
  than permanently canarying UI routes. Flag it; don't build it from here.

## Do not

- Do **not** trigger deploys, rollbacks, or redeploys without explicit
  instruction — prod is outward-facing.
- Do **not** report "healthy" off a commit-mismatched deployment — that means
  the new code isn't live.
- Do **not** invent a health endpoint URL; canary real routes until one exists.
