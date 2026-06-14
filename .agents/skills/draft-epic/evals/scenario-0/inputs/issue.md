# Add multi-tenant support to the platform

**Label**: ai:plan-epic  
**Strategic ADR**: docs/adr/adr-007-multi-tenancy.md

## Vision

We need to evolve the platform from a single-tenant architecture to a fully multi-tenant SaaS offering. Today every customer shares the same database schema and the same auth namespace, which means any per-customer customisation requires code changes. Moving to multi-tenancy lets us onboard new customers in minutes, offer tenant-specific configuration, and isolate billing and usage reporting per customer.

## Scope

This initiative covers:
- A new `Tenant` data model with associated migration
- Updating the auth layer to scope sessions to tenants
- Per-tenant configuration API and storage
- Billing isolation (usage metering, invoice generation)
- Observability: per-tenant dashboards and alerting

Out of scope: white-labelling (custom domains, branding) — covered by a separate initiative.

## Kill criteria

If we can't demonstrate an end-to-end onboarding of a new tenant without an engineer-in-the-loop within 6 months, we should pivot to a simpler isolation model.

## Rough slice ideas

1. Tenant data model and migration
2. Auth scoping to tenant
3. Per-tenant config API
4. Billing isolation
5. Observability per tenant

## Cross-cutting concerns to settle

- Database isolation strategy (row-level security vs. schema-per-tenant vs. database-per-tenant)
- Auth token format and tenant claim
- Which services are affected in the monorepo
