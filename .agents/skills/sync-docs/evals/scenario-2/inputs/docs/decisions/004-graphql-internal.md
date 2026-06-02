# ADR 004: Adopt GraphQL for Internal Services

## Status: Accepted

## Decision

Internal service-to-service communication will use GraphQL for richer queries. This supersedes ADR 003 for internal traffic only; the public REST API remains unchanged.

## Consequences

ADR 003 remains valid for the public API. For internal calls, prefer GraphQL clients.
