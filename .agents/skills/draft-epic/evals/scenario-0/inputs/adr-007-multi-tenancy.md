# ADR-007: Multi-Tenancy Architecture

**Status**: Accepted  
**Date**: 2026-04-15  
**Deciders**: CTO, Head of Engineering, Head of Product

## Context

The platform currently serves all customers from a shared single-tenant deployment. As we scale to enterprise customers, we need to support tenant isolation for compliance, billing, and customisation reasons.

## Decision

Adopt row-level security (RLS) as the primary isolation mechanism for data, with tenant IDs propagated through the auth token (JWT claim `tid`). Service-level isolation is achieved through shared infrastructure with logical partitioning, not separate deployments.

## Consequences

- All new tables must include a `tenant_id` column with an RLS policy
- Auth tokens must carry a `tid` claim; services must validate it on every request
- Billing metering is per-tenant from the outset
- Per-tenant config is stored in a dedicated `tenant_config` table with RLS

## Alternatives considered

- Schema-per-tenant: rejected due to migration complexity at scale
- Database-per-tenant: rejected due to cost and operational overhead
