# ADR 018: Run Drizzle Migrations in Vercel Deployment with Transactional Safety Gate

**Date:** 2026-03-06
**Status:** Accepted

## Context

We need migrations to execute as part of deployment, not in GitHub Actions.
Deployment must fail safely and roll back migration changes on errors.

## Decision

Set Vercel build command to:

```bash
pnpm build && pnpm db:migrate:deploy
```

`db:migrate:deploy` does the following:

1. Runs `pnpm db:check:migrations` to reject non-transactional SQL patterns.
2. Acquires a PostgreSQL advisory lock.
3. Runs Drizzle migrations with the postgres-js driver.
4. Exits non-zero on failure so deployment is not promoted.

## Consequences

### Positive

- Migration success is coupled to deploy success.
- Failed migration prevents deployment promotion.
- Advisory lock reduces concurrent migration races.

### Negative / Trade-offs

- Build duration increases by migration execution time.
- Strict migration policy blocks some SQL patterns unless intentionally redesigned.

## Notes on rollback

For postgres-js Drizzle migrations, statements run within transaction semantics
of the migrator path used in this project. Migration failure during deploy is
expected to roll back transaction-scoped schema changes.

## Alternatives considered

- Run migrations in GitHub Actions: rejected by requirement.
- Manual migration execution: rejected due to operational risk and drift.
