# ADR 022: Owner-Only Hard Delete for Trips

**Date:** 2026-03-06
**Status:** Accepted

## Context

Trips were editable and movable but could not be deleted after creation. This left users with no
way to remove obsolete plans and caused dashboard clutter. We needed to choose:

1. Whether deletion should be hard delete or soft delete/archive.
2. Which role is allowed to delete in organization-scoped workspaces.

The existing schema already defines `ON DELETE CASCADE` from `trips` to `trip_fixed_costs` and
`destinations`, and from `destinations` to `spend_entries`.

## Decision

- Implement trip deletion as a hard delete.
- Restrict trip deletion to organization owners only.
- Expose deletion from trip detail with an explicit confirmation modal.

Implementation uses `TripRepository.delete(id)` and enforces authorization in an application use
case (`deleteTrip`) by verifying both membership and owner role before deleting.

## Consequences

- Simpler model and queries than soft delete/archive (no `deleted_at` flags or filtered reads).
- Deleting a trip reliably removes all dependent records via database-level cascade constraints.
- Stronger safety for collaborative workspaces: members can edit but cannot permanently remove
  shared trip data.
- Deletion is irreversible; accidental deletion risk is mitigated by the confirmation modal.
