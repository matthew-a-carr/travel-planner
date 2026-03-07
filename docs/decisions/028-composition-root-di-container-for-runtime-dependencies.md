# ADR 028: Composition Root DI Container for Runtime Dependencies

**Date:** 2026-03-07
**Status:** Accepted

## Context

Runtime entrypoints in `src/app/` and parts of `src/infrastructure/` directly
constructed Drizzle repository implementations with `new Drizzle*Repository(db)`.
That created several issues:

- dependency wiring was duplicated across pages, server actions, and auth/org paths
- swapping implementations (for example email/auth providers in follow-up work)
  required touching many runtime files
- architectural drift risk increased because new runtime code could bypass a
  single composition point

The project already requires real integration tests with Testcontainers Postgres,
so we needed a dependency model that improves swapability without introducing
mocked integration behavior.

## Decision

Adopt a composition-root container at `src/infrastructure/container/`:

- `create-app-container.ts` is the only runtime location allowed to construct
  concrete Drizzle repositories.
- `index.ts` exposes `getAppContainer()` as a singleton accessor for runtime code.
- Runtime app/auth/organization entrypoints resolve repository dependencies from
  the container instead of direct construction.
- `create-test-app-container.ts` provides a test helper to build real container
  implementations with optional overrides.

Guardrails are enforced with unit tests:

- `src/__tests__/app-construction-guard.test.ts` blocks `new` construction of
  project-owned classes in `src/app/**` runtime files.
- `src/__tests__/composition-root-boundary.test.ts` blocks
  `new Drizzle*Repository(...)` outside the composition root.

Integration tests continue to use real Drizzle repositories and real Postgres
via Testcontainers. No integration behavior is mocked.

## Consequences

### Positive

- Runtime dependency wiring is centralized and consistent.
- Swapping implementations is now explicit and localised to container composition.
- Guard tests make regressions to ad-hoc construction fail fast in CI.
- Follow-up work (closed auth + invite onboarding with pluggable email provider)
  can build on the same container pattern.

### Trade-offs

- Adds container boilerplate and an additional abstraction layer.
- Singleton lifecycle must be understood in tests; module resets/mocking may be
  required for some unit scenarios.
- Guard tests rely on static pattern checks and need maintenance if construction
  conventions evolve.
