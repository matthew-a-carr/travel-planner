# ADR 021: Organization-Scoped Trip Sharing and First-Sign-In Bootstrap

**Date:** 2026-03-06
**Status:** Superseded by ADR 029

## Context

Trips were previously scoped to a single owner (`trips.owner_id`), which
prevented collaborative planning. The product now needs shared access so a
partner can sign in and work on the same trips.

Constraints:

- No email/SMS invite integration in v1
- Existing production data must be migrated safely
- Local-dev auth must continue to work in development/preview

## Decision

Adopt an organization membership model as the authorization boundary.

1. Add `organizations` and `organization_memberships` tables.
2. Add `trips.organization_id` and scope trip visibility/actions by membership.
3. Keep `trips.owner_id` as creator metadata for now (not auth boundary).
4. On first successful sign-in, auto-provision a personal organization and owner
   membership when the user has no memberships.
5. Active organization is user-selectable in the UI and persisted in a cookie.
6. Member permissions:
   - `member`: can view/create/edit trip content in their organizations
   - `owner`: can also manage organization members and move trips between organizations
7. Add-member flow is existing-user-only by email in v1 (no pending invite workflow).

Personal workspace naming:

- `"<user.name>'s Workspace"` when name exists
- `"<email-local-part>'s Workspace"` when name is missing
- `Local Dev Workspace` for `local-dev@travel-planner.local`

## Consequences

### Positive

- Enables trip sharing without adding external invite infrastructure.
- Preserves current auth provider setup while enabling collaboration.
- Gives each user a usable default workspace immediately after sign-in.
- Supports multiple organizations per user and owner-controlled member management.

### Negative / Trade-offs

- Adds non-trivial schema and authorization complexity.
- `owner_id` becomes historical metadata and may be confusing until renamed.
- Cookie-based active org context requires careful validation on every request.
- Existing-user-only member assignment is less user-friendly than invite links.

## Alternatives considered

### Keep owner-scoped trips and add per-trip collaborators

Rejected: duplicates authorization logic across trip descendants and scales worse
than organization-level scoping.

### Require admin/manual organization assignment before first use

Rejected: creates onboarding friction and blocks self-serve sign-in.

### Introduce invite table + acceptance flow now

Rejected for v1 due higher implementation and operational overhead without email
delivery.
