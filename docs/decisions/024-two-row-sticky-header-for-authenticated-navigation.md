# ADR 024: Two-Row Sticky Header for Authenticated Navigation

**Date:** 2026-03-06
**Status:** Accepted
**Supersedes:** ADR 023 (shared header/settings split)

## Context

ADR 023 moved organization management out of the trips dashboard and introduced
shared authenticated navigation. After implementation, the compact boxed header
still constrained growth:

1. Global controls and section navigation competed for limited horizontal space.
2. The layout would become congested as additional app-wide actions are added.
3. Mobile readability risked control overlap with long organization names.

We need a scalable information architecture that keeps organization context
switching globally accessible while leaving room for future utility controls.

## Decision

Refactor the authenticated header into a full-width, sticky, two-row app bar:

- Row 1 (utility row):
  - brand/home link
  - active organization switcher
  - account controls (avatar and sign out)
  - optional utility composition slots for future global actions
- Row 2 (section row):
  - primary section tabs: `Trips` and `Settings`
  - clear active route state via `aria-current="page"`

Layout behavior:

- Header is sticky at `top: 0` with backdrop and border treatment for scroll
  contrast.
- Authenticated pages (`/`, `/trips/[id]`, `/settings/organization`) share a
  consistent shell with content rendered below the header.
- Mobile keeps both rows visible (no drawer/bottom-nav switch), with safe
  wrapping/truncation behavior for organization switching.

This ADR does not change backend permissions, organization scope semantics, or
route contracts introduced in ADR 021 and ADR 023.

## Consequences

- Navigation remains stable as global utility controls are added.
- Organization context switching stays globally available without reintroducing
  organization management on the dashboard.
- Keyboard and accessibility coverage must include both header rows, active tab
  semantics, sticky behavior, and mobile non-overlap checks.
- Future global actions can be injected via header slots without restructuring
  the header layout.
