# ADR 027: Separate Organization Creation from Member Management

**Date:** 2026-03-06
**Status:** Accepted

## Context

The settings experience mixed two different workflows in one panel:

1. creating a new organization
2. managing members of the currently active organization

This created ambiguous ownership and scope in the UI. Users could be looking at
one organization's members while simultaneously seeing organization-creation
controls in the same card. It was also unclear whether creation permissions were
tied to the active organization's role.

## Decision

Split organization settings into two explicit sections:

- `/settings/organizations`
  - create a new organization
  - list organizations the user belongs to
- `/settings/organization`
  - manage members for the active organization only

Navigation and route updates:

- Settings navigation now has three tabs: `Organizations`, `Members`, `Access`.
- The top-level `Settings` header link now targets `/settings/organizations`.
- `Access` remains admin-only; non-admin access redirects to
  `/settings/organizations`.

Permission model:

- Any signed-in user can create a new organization.
- Only owners of the active organization can add/remove members there.
- Non-owners can still view member lists.

Server-action organization:

- Active-organization switching remains in shared `app/organizations/actions.ts`.
- Create-organization action lives under `app/settings/organizations/actions.ts`.
- Member add/search/remove actions live under `app/settings/organization/actions.ts`.

## Consequences

### Positive

- Information architecture now matches user intent: personal/workspace creation
  is separate from active-organization member administration.
- Members page has a single responsibility and clearer permission messaging.
- Route semantics are explicit and easier to test.

### Trade-offs

- More settings routes and navigation states to maintain.
- Existing e2e/accessibility tests and docs must be updated to reflect the new
  route split and header target.
