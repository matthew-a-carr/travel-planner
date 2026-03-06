# ADR 016: Terraform Cloud Split State with No CLI Workspaces

**Date:** 2026-03-06
**Status:** Accepted

## Context

We need infrastructure-as-code for Vercel and Neon with strict environment
separation between production and PR previews.

The requirement is to avoid Terraform CLI workspaces while still using Terraform
Cloud for remote state.

## Decision

Use two Terraform root stacks with separate Terraform Cloud remote states:

- `infra/stacks/prod` → workspace `travel-planner-prod`
- `infra/stacks/preview` → workspace `travel-planner-preview`

Do not use Terraform CLI workspaces (`terraform workspace select/new`) in local
or CI flows.

Use reusable modules under `infra/modules/` for shared resource patterns.

## Consequences

### Positive

- Clear blast-radius separation between production and preview state.
- Easier least-privilege controls and approvals per stack.
- Simpler operational model than multi-environment workspace switching.

### Negative / Trade-offs

- Two stack roots must be kept aligned for provider settings and conventions.
- Shared resources must not be managed by both states to avoid drift/conflicts.

## Alternatives considered

- Terraform CLI workspaces in a single root: rejected by requirement.
- Single state for all environments: rejected due to higher blast radius.
