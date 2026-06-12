# SPEC-013: Mobile E2E — Real Backend in the CI Loop

**Date:** 2026-06-12
**Status:** Complete
**Author:** Claude (interactive session, issue #146)
**Approved by:** —
**Parent epic:** [EPIC-004 — Mobile E2E Phase 2](../epics/EPIC-004-mobile-e2e-authenticated-journeys.md)

> Slice 1 of EPIC-004. Carries the epic's **pivot criterion** (§9): if this
> can't run green within ~2 focused days or adds >5 min to the median warm
> job, pivot to the OpenAPI-pinned fixture server and amend ADR 060.
> Per Matt's instruction ("do the slice and then the implementation") the
> SPEC ships in the same PR as the implementation — EPIC-002 precedent,
> recorded as deviation #1 below.

---

## 1. Summary

The `mobile-e2e` CI job stops testing an app that talks to nothing. After
this slice, the macOS runner provisions a native Postgres, migrates and
seeds it (reference data + deterministic e2e fixtures), boots the real
Next.js server in production mode, and builds the iOS app bundle with
`EXPO_PUBLIC_API_BASE_URL` pointing at it. The existing smoke flow still
gates the PR; two new runner-side assertions prove the backend is live and
the app bundle actually inlined the backend URL. No user-visible product
change — this is the infrastructure cliff EPIC-004's journeys (slices 2–3)
stand on.

## 2. Motivation

EPIC-004 §7 slice 1; strategic rationale in
[ADR 060](../decisions/060-mobile-e2e-real-backend-authenticated-journeys.md).
Inherited from the epic's §10 (not re-argued here): real backend over a
mock server, native Postgres in CI / Docker locally with `POSTGRES_URL` as
the seam, journey-level flow granularity, path-filter scope, budget and
blocking rules. This slice also resolves the epic's §13 deferred questions
Q1–Q3 (see §7 and §14).

## 3. Acceptance criteria

1. Given a PR touching `apps/mobile/**` (or `ci.yml`, the lockfile /
   workspace config, or — newly added by this slice per epic §10 —
   `packages/shared/**`), when `mobile-e2e` runs, then a Postgres instance is provisioned natively on the macOS
   runner (no Docker), migrations run via the existing `pnpm db:migrate`,
   and both `pnpm db:seed` (reference data) and the new e2e fixture seed
   complete — all before Maestro starts.
2. Given the seeded database, when the job boots the web app with
   `pnpm start` (production server, built via `pnpm build`), then a
   runner-side canary (`curl` against the app) succeeds before Maestro
   runs, and the job fails fast with the server log surfaced if it
   doesn't.
3. Given the xcodebuild step, when the Release JS bundle is produced, then
   `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3000` is inlined — proven by
   a `strings`-grep assertion against the built `.app`'s JS bundle (this
   is the operational answer to epic Q3; `127.0.0.1` is deliberately
   distinct from the code default `localhost` so the check can't pass
   vacuously).
4. Given the new e2e fixture seed module, when its integration test runs
   (Linux, Testcontainers — the normal `pnpm test:integration` suite),
   then it proves the fixtures insert correctly, are deterministic
   (stable IDs/values), and are idempotent (safe to run twice).
5. Given any job failure, then the backend server log is uploaded as a CI
   artifact alongside the existing Maestro report and crash diagnostics.
6. The existing `sign-in.yaml` smoke flow still passes (now against a
   live backend), and its stale "CI doesn't run a backend" comment is
   corrected.
7. The measured runtime delta on warm cache is recorded in the
   implementation notes and stays within the epic's +5 min pivot bound;
   the epic's §13 Q1–Q3 rows are updated with the resolved answers.

## 4. Demo script

1. Open the implementation PR; the `mobile-e2e` job log shows: Postgres
   init → migrate → seed (reference + fixtures) → `pnpm build` →
   server boot → canary OK → bundle-URL assertion OK → Maestro green.
2. Compare the job's wall-clock against a recent `main` run — delta
   within budget, recorded in the implementation notes.
3. Re-run with a deliberately broken canary locally (kill the server) to
   show the failure path: job fails before Maestro, server log artifact
   uploaded. (Demonstrated during development, not left in the PR.)
4. `pnpm test:integration` includes the new fixture-seed test, green on
   Linux with Docker — no macOS needed to iterate on fixtures.

## 5. Out of scope

- **The test-auth seam and any signed-in flow** — slice 2. The smoke flow
  still stops at the sign-in screen; the app makes no authenticated call
  yet.
- **New Maestro flows / flow assertions against seeded data** — slice 3
  consumes the fixtures; this slice only proves they exist in the DB.
- **Local `pnpm test:e2e:mobile` backend orchestration** — slice 4 (the
  CI scripts keep the `POSTGRES_URL` seam so slice 4 can reuse them).
- **Screen-recording diagnostics** — slice 4 (the server-log artifact
  lands here because slice 1 itself is undebuggable without it).
- Everything in the epic's §6 non-goals (Android, devices, ADP, etc.).

## 6. Prerequisites

- EPIC-004 approved (done — PR #145 merged 2026-06-12).
- No new accounts, secrets, or env vars outside the job itself.

## 7. Design

### CI job shape (`.github/workflows/ci.yml`, `mobile-e2e`)

Extends the ADR 055 pipeline in place; no step it already has is removed.
New steps, in order (existing steps unchanged unless noted):

1. **Start Postgres (native)** — new script
   `apps/mobile/scripts/ci/start-postgres.sh`:
   prefer the runner image's Homebrew PostgreSQL (`brew --prefix
   postgresql@<N>` for the newest preinstalled major); fall back to
   `brew install postgresql@16` if none present (resilience against
   runner-image drift — **epic Q2 resolved: preinstalled-with-fallback,
   no version pin beyond "newest preinstalled"**). `initdb` into
   `$RUNNER_TEMP/pgdata` (trust auth, localhost only, throwaway data),
   `pg_ctl start`, `createdb travel_planner_e2e`, then append
   `POSTGRES_URL=postgresql://127.0.0.1:5432/travel_planner_e2e` (with
   the runner user) to `$GITHUB_ENV`. Runs early so it overlaps the
   existing background simulator boot.
2. **Migrate + seed** — `pnpm db:migrate`, `pnpm db:seed`, then
   `pnpm --filter @travel-planner/web seed:e2e` (new script, below).
3. **Build web app** — `POSTGRES_URL=<dummy> pnpm build` (ADR 010 dummy-
   URL pattern, same as the web e2e job). The dev-grade auth env
   (`AUTH_SECRET`, `AUTH_JWT_SIGNING_KEY`, placeholder `AUTH_GOOGLE_*`,
   `AUTH_URL`) is set at **job level** — the web e2e job sets it there
   because next-auth needs it during `next build`, not just at runtime —
   with `apps/web/.next/cache`
   added to a new `actions/cache` entry keyed on
   `hashFiles('pnpm-lock.yaml', 'apps/web/**', 'packages/shared/**')` —
   mobile-only PRs get a warm Next build cache. **Epic Q1 resolved:
   `pnpm build` + `pnpm start` (production server), mirroring the web
   e2e CI path and ADR 055's self-contained-over-lazy lesson;
   `pnpm dev:next` is the documented fallback if the build step alone
   busts the +5 min budget.**
4. **Boot server (background)** — new script
   `apps/mobile/scripts/ci/start-backend.sh`: starts `pnpm start` with
   the real `POSTGRES_URL` (auth env inherited from the job level),
   stdout/stderr → `$RUNNER_TEMP/backend.log`, PID recorded. Started
   before prebuild/xcodebuild so its boot overlaps the native build.
5. **xcodebuild** (existing step, one change) — exported
   `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3000` in the step env so
   the "Bundle React Native code and images" phase inlines it.
6. **Canary + bundle assertion** (new, after xcodebuild, before
   install): `curl --fail --retry` against
   `http://127.0.0.1:3000/api/auth/providers` (unauthenticated, cheap,
   and proves Next + its auth wiring booted); then locate the `.app`'s JS
   bundle and assert `strings <bundle> | grep -q '127.0.0.1:3000'`.
   The RN bundle phase has no declared input/output files, so Xcode
   re-runs it every build even with cached DerivedData — believed, and
   now **asserted on every run**, which is the durable answer to epic
   Q3: if a future Xcode/RN change starts skipping the phase, this
   check fails loudly instead of the env silently going stale.
7. **Server log artifact** — `actions/upload-artifact` of
   `$RUNNER_TEMP/backend.log` on `failure()`, 7-day retention, beside
   the existing Maestro/crash artifacts.
8. **Path filter** — the `detect-changes` mobile filter gains
   `packages/shared/**`, implementing the epic §10 / ADR 060 decision in
   the slice that touches the filter's file (durable bias) rather than
   deferring to slice 2.

Existing cache discipline (TD-009) untouched: the mobile native cache
key/`--clean`-on-miss logic is not modified; the `.next` cache is a new,
independent entry.

### E2E fixture seed (`apps/web`)

New `apps/web/src/infrastructure/db/seed/e2e-fixtures.ts` (fixture
constants + `applyE2eFixtures(db)`) with CLI entry `seed-e2e.ts` alongside
(package script `seed:e2e`), matching the existing `seed.ts` /
`country-list-seed.ts` pattern — the vitest integration project only
collects `src/**/*.int-test.ts`, so the module and its co-located
integration test must live under `src/`, and the seed needs the drizzle
schema anyway: one approved e2e user + organization + membership, and
one deterministic "Kyoto-style" trip — two destinations with dates
bracketing a fixed "today" anchor, at least one fixed cost and spend
entries so slice 3's detail flow has real figures to assert. All IDs and
values constant and exported from the module so future flows/tests (and,
later, the web Playwright suite — epic §10 "share where shapes allow";
adoption itself out of scope) import rather than duplicate. Idempotent via
upsert-or-skip so a re-run (CI retry) can't fail on conflicts.

### Mobile app

No source change. `src/api/client.ts` already reads
`EXPO_PUBLIC_API_BASE_URL` at bundle time with a `localhost:3000` default;
CI sets `127.0.0.1:3000` explicitly. `sign-in.yaml` gets a comment update
only (its "CI doesn't run a backend" rationale is now false; the flow
behaviour is unchanged until slice 2).

### Storage & migrations

N/A — no schema change. The job runs existing migrations against a
throwaway runner-local database.

### External integrations

None. The deliberate absence of Docker/Testcontainers on the macOS path is
the point (ADR 060); everything used (Homebrew Postgres, curl, strings) is
runner-image stock.

## 8. Security & data considerations

- The CI Postgres is loopback-only, trust-auth, seeded with synthetic
  fixtures, and destroyed with the runner — no real data, no exposure
  surface.
- The backend env uses the same placeholder secrets as the existing web
  e2e bootstrap (`dev-only-not-a-real-secret` class values); nothing new
  is minted and no repository secret is consumed.
- **No test-auth seam in this slice** — the security-sensitive endpoint
  (ADR 060's double gate) is slice 2; this slice adds no auth surface at
  all.
- Threats considered: none beyond CI-resource misuse; the job's path
  filter and concurrency cancellation already bound that.

## 9. Test plan

### E2E (Maestro)

| Test file | Scenario |
|---|---|
| `.maestro/flows/sign-in.yaml` (existing, comment-only change) | App launches clean to sign-in screen with a live backend behind it — plus the two runner-side assertions (canary, bundle URL) that gate before Maestro starts |

### Integration (Vitest + Testcontainers)

| Test file | What it covers |
|---|---|
| `apps/web/src/infrastructure/db/seed/e2e-fixtures.int-test.ts` | Fixtures insert against a fresh migrated DB; deterministic values match the exported constants; running twice is a no-op (idempotency); user is approved + org-scoped correctly |

### Unit

N/A — no domain/application logic; shell scripts are exercised by the CI
run itself (CI config is self-testing per AGENTS.md).

### Manual checks

- Trigger `workflow_dispatch` with `mobile: true` on the branch before
  opening the PR to validate the full job (the run IS the verification
  for the workflow half).
- Record warm/cold runtime from those runs for acceptance criterion 7.

## 10. Observability

- CI-only change: the job log groups each new phase (`::group::`), the
  canary failure path prints the tail of `backend.log` inline, and the
  full log uploads on failure.
- Runtime baseline recorded in
  `docs/implementation-notes/SPEC-013-mobile-e2e-real-backend.md` for the
  epic's budget checkpoint (§9 / DoD).

## 11. Rollback / safety

Revert the PR — the job returns to ADR 055's shape (no backend, smoke
flow only). No production surface, no data, no schema change. The new
`.next` cache entry is independent and dies with the key.

## 12. Implementation order

1. [ ] **Intent:** fixture-seed integration test (red) defining the
   deterministic fixtures + idempotency. **Verification:**
   `pnpm test:integration` fails on the new test only.
2. [ ] **Intent:** implement `seed-e2e-fixtures` module + `seed:e2e`
   package script. **Verification:** test from step 1 green;
   `pnpm lint && pnpm type-check`.
3. [ ] **Intent:** `start-postgres.sh` + `start-backend.sh` under
   `apps/mobile/scripts/ci/`. **Verification:** shell review +
   `bash -n`; behaviour verified in step 4's CI run.
4. [ ] **Intent:** wire the `mobile-e2e` job: pg → migrate/seed →
   `.next`-cached build → background server → env at xcodebuild →
   canary + bundle assertion → log artifact. **Verification:**
   `workflow_dispatch` (mobile=true) run on the branch is green;
   deliberately-broken canary run shows the fail-fast path + artifact.
5. [ ] **Intent:** update `sign-in.yaml` comments, mobile `AGENTS.md`
   (job description), root `AGENTS.md` CI section if stale, epic §13
   Q1–Q3 answers + slice ledger row, implementation notes with runtime
   baseline. **Verification:** `sync-docs` pass; docs match the shipped
   job.

## 13. ADR triggers and tech-debt review

### ADR?

- [x] CI pipeline or workflow structural change — **covered by ADR 060**
  (drafted with the epic; this slice implements it). Epic §16: a new ADR
  only if the pivot fires or the server-boot decision materially changed
  ADR 060's shape — `build`+`start` is the shape it describes. **None
  required.**
- [ ] New library, external tool, or vendor — none (runner-stock tools).
- [ ] New project-wide standard — none.
- [ ] Non-obvious architectural trade-off — settled in ADR 060.
- [ ] Cross-cutting decision not already settled by the parent epic — none.

**ADRs to write:** none required.

### Tech debt

- [x] Reviewed `docs/tech-debt.md`. **TD-009** (mobile-e2e cache/flake
  history) constrains this slice: the native cache key and
  `--clean`-on-miss logic are deliberately untouched; the `.next` cache
  is a separate entry so a poisoned web build cache can't recreate
  TD-009's stale-native failure mode. **TD-003** (SDK 54 pin): no SDK
  surface touched. No items resolved or added.

**Tech debt items addressed by this spec:** none (TD-009 respected, not
extended).

## 14. Risks & open questions

Decisions taken by best guess (the §Open Questions for this spec — each
names the rejected alternative and the cost of being wrong):

- **Prod server over dev server (epic Q1):** rejected `pnpm dev:next`
  (no build step, lazy compile). Cost if wrong: the build step busts the
  +5 min budget and step 4 swaps to the documented dev-server fallback —
  bounded, and the runtime numbers from step 4 settle it with evidence.
- **Preinstalled-Homebrew-with-fallback Postgres (epic Q2):** rejected
  pinning an exact version via mandatory `brew install` (slower every
  run) and rejected vendoring binaries. Cost if wrong: runner-image
  drift changes the preinstalled major and behaviour shifts silently —
  mitigated by the migrations being version-agnostic in our range and
  the fallback path.
- **`strings`-grep bundle assertion (epic Q3):** rejected trusting the
  "bundle phase always runs" belief untested, and rejected a Maestro-
  level connectivity proof (the signed-out app makes no API call;
  driving the sign-in tap into a browser sheet is slice-2 territory).
  Cost if wrong: Hermes bytecode stops exposing the URL via `strings`
  in a future SDK — the check fails loudly and gets replaced, never
  silently passes.
- **Fixture seed lives in `apps/web/src/infrastructure/db/seed/`**
  (needs the drizzle schema; the integration suite only collects
  `src/**/*.int-test.ts`): rejected `apps/web/scripts/` (test would
  silently not run), `apps/mobile/` (no schema access), and the
  Playwright setup (not invocable standalone). Cost if wrong: slice 4's
  local orchestration wants it elsewhere — a file move.
- **Risk:** macOS runner Homebrew Postgres may be missing/broken on a
  future image. Mitigated by the install fallback; if both paths fail
  repeatedly, that's pivot-criterion evidence, not something to patch
  around.

---

## Implementation Deviations

| # | Deviation | Reason | Impact | Resolved? |
|---|-----------|--------|--------|-----------|
| 1 | SPEC + implementation in one PR, on the session branch, instead of a standalone spec PR merged with `claude:implement` | Matt's instruction in-session ("do the slice and then the implementation"); EPIC-002 precedent | Single review gate instead of two | Yes (authorised) |
| 2 | Spec text amended mid-PR (fixture-seed location `scripts/` → `src/infrastructure/db/seed/`, job-level auth env, canary route named, `packages/shared/**` filter pulled in) | `review-spec` self-review findings, applied before implementation started | Implementation matches the final spec; no code-level drift | Yes |

### Post-Implementation Notes

- **Runtime (AC7):** first `workflow_dispatch` run (27410045709) green on
  attempt 1: 13m47s wall clock, of which **~46s** is directly attributable
  to the new steps (pg 16s, migrate+seed 4s, build 24s — on a `.next`
  cache MISS — canary+assertion 1s; server boot fully overlapped). The
  nearest comparable `main` run (edce7ca) was tracking ≈ 12m before being
  cancelled by the concurrency group. Delta comfortably inside the +5 min
  pivot bound — the pivot criterion never came close to firing.
- arm64 macOS runners build Next.js in ~24s even cold; epic Q1's
  `dev:next` fallback (kept for a build-cost blowout) looks permanently
  unnecessary, but remains documented.
- Fixture dates are fixed absolutes (Kyoto 2026-06-01→15, Tokyo
  2026-06-15→30) — deterministic over run-time-relative; they happen to
  bracket the fixed 2026-06-12 anchor, satisfying the spec wording. If a
  future flow needs "today inside a range" (EPIC-003 destination
  inference), extend the fixture then rather than making this one
  non-deterministic.
- The `strings`-grep bundle assertion worked first try against the
  Hermes bundle — epic Q3's "believed yes" is now a per-run loud check,
  exactly as designed.
- Session-environment learning: Docker Hub rate-limited the unauthenticated
  `postgres:16-alpine` pull in the remote session; `mirror.gcr.io/library/`
  + retag unblocked the local integration suite. Worth remembering for
  future cloud sessions (not repo tech debt — CI runners are unaffected).
