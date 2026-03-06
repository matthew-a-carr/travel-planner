# ADR 017: Use Community Terraform Provider for Neon

**Date:** 2026-03-06
**Status:** Accepted

## Context

The infrastructure rollout requires Neon lifecycle management from Terraform,
including projects and preview branches.

An official first-party Neon Terraform provider is not currently available for
this implementation path. The actively maintained community provider
`kislerdm/neon` supports the required resources.

## Decision

Adopt `kislerdm/neon` as the Neon Terraform provider and pin to version
`0.13.0` in infrastructure stacks.

Use it for:

- `neon_project`
- `neon_branch`
- `neon_endpoint`
- `neon_role`
- `neon_database`

## Consequences

### Positive

- Enables full Terraform-managed Neon provisioning now.
- Supports per-PR branch model needed for preview deployments.

### Negative / Trade-offs

- Dependency on a community provider introduces maintenance and compatibility
  risk versus a first-party provider.
- Provider upgrades require deliberate review before adoption.

## Risk controls

- Pin provider version in `required_providers`.
- Validate plans in CI before apply.
- Track provider releases and upgrade intentionally.

## Alternatives considered

- Custom scripts/API wrappers around Neon REST: rejected due to higher
  maintenance burden.
- Manage Neon outside Terraform: rejected because it breaks IaC completeness.
