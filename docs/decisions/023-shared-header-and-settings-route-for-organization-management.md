# ADR 023: Shared Header and Settings Route for Organization Management

**Date:** 2026-03-06
**Status:** Superseded by ADR 024

## Context

Organization features were initially embedded in the dashboard (`/`) UI. This
caused two UX issues:

1. The trips page mixed day-to-day trip work with administrative controls.
2. Organization management was always near the primary workflow and felt
   intrusive, especially on smaller screens.

We needed a standard SaaS information architecture that keeps context switching
close to the global navigation while moving management actions to a dedicated
settings surface.

## Decision

Adopt a shared authenticated header and split organization UI responsibilities:

- Add a shared authenticated header (dashboard, trip detail, settings) with:
  - primary nav links: `Trips` and `Settings`
  - compact active-organization switcher
  - user identity and sign-out controls
- Move organization management to a dedicated route:
  - `/settings/organization`
- Keep organization switching available globally in the header.
- Keep non-owner settings access visible but restricted:
  - non-owners can view organization details and members
  - owner-only controls (create org, add/remove members) remain hidden/disabled
    with explanatory messaging.

No backend authorization model changes are introduced by this decision; this is
an interaction and IA restructuring of existing capabilities.

## Consequences

- Trips dashboard stays focused on planning and trip operations.
- Navigation becomes consistent across authenticated pages.
- Organization context switching is always reachable without opening management
  controls.
- Settings route provides a clearer place for future account/workspace options.
- E2E and accessibility tests must cover the new `/settings/organization` route
  and shared-header keyboard/mobile behavior.
