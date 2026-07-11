# ADR 064: Atomic Idempotent v1 Command Execution

**Date:** 2026-07-11
**Status:** Accepted

## Context

ADR 063 requires every unsafe v1 operation to accept `Idempotency-Key` and
replay its original result. Mobile clients retry when a response is lost. A
two-phase implementation that reserves a key, commits the domain mutation, and
then records the response has a crash window: the mutation may commit without a
replayable result. Re-running risks duplication; refusing to run leaves the
client permanently uncertain.

The existing domain/application use cases and repository interfaces are the
business-rule authority. Routes must not gain direct Drizzle access, and runtime
repository construction remains confined to the composition root (ADR 028).

## Decision

Unsafe `/api/v1/*` commands execute through an application-layer
`IdempotentCommandExecutor` port with a Postgres/Drizzle infrastructure adapter.

For one authenticated user, operation name, and idempotency key, the adapter
opens one database transaction and:

1. claims the unique command key with a hash of the canonical request;
2. on an existing completed claim with the same hash, returns the stored HTTP
   status and JSON response without invoking the command;
3. rejects reuse of the key with a different request;
4. invokes the canonical application use case through transaction-scoped domain
   repositories; and
5. stores the resulting status and response before committing.

The command mutation and replay record therefore commit or roll back together.
Concurrent requests for the same key serialize on the unique database key. The
executor stores expected 2xx/4xx command results; unexpected exceptions roll the
transaction back and remain retryable.

Routes own HTTP parsing and mapping but receive the executor from
`getAppContainer()`. The concrete adapter and all transaction-scoped Drizzle
repositories are constructed by `create-app-container.ts`; app routes never
construct repositories or import the database client. Records are retained for
at least the maximum supported mobile retry window and can be pruned by a later
operational job without changing command semantics.

### Alternatives considered

- **Reserve, mutate, then complete in separate transactions.** Rejected because
  a process crash creates an unrecoverable response gap.
- **In-memory key cache.** Rejected because deploys, replicas, and restarts lose
  the guarantee.
- **Make every mutation naturally idempotent with client-generated IDs.** Useful
  for creates, but insufficient for exact response replay and inconsistent
  across update/delete commands.
- **Implement idempotency independently in each route.** Rejected because it
  duplicates concurrency and replay rules at the most failure-prone boundary.

## Consequences

Retries are exact and multi-instance safe, and route handlers reuse one tested
mechanism. The design introduces an idempotency table, an application port, a
transaction-aware infrastructure adapter, and transaction-scoped repository
construction at the existing composition root. Integration tests must cover
same-request replay, conflicting reuse, concurrent duplicate requests, rollback
after exceptions, authorization, and tenant isolation.

The executor is intentionally limited to database-backed commands. External
side effects must use an outbox or another explicitly atomic mechanism rather
than being placed inside the transaction callback.
