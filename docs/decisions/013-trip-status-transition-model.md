# ADR 013: Trip Status Transition Model

**Date:** 2026-02-26
**Status:** Accepted

## Context

The `Trip` entity has three statuses: `planning`, `active`, and `completed`. As part of implementing the edit-trip feature (which allows users to update a trip's name, budget, and status), a decision is needed on whether status transitions should be enforced at the domain level.

**Option A — Free-form transitions:** Any status can transition to any other status (e.g. `completed → planning` is allowed). Simple, low-friction, and lets users correct accidental selections without ceremony.

**Option B — Enforced lifecycle:** Only forward transitions are permitted (`planning → active → completed`). Stricter, prevents marking a future trip `active` by mistake, but adds ceremony and makes it harder to undo errors.

At this stage the app has a single user per trip, there is no billing or external integration tied to status, and there is no evidence from user research that enforced transitions are needed.

## Decision

Use **free-form transitions** for MVP. Any `TripStatus` value may be set at any time. The UI presents the current status in a select with all three options, giving the user full control.

Enforced transition guards (e.g. `validateTripStatusTransition`) can be introduced in a future ADR if user research shows that accidental transitions are a real problem.

## Consequences

- No domain guard is required for status changes — the server action validates that the submitted value is one of the three known `TripStatus` values, and rejects anything else.
- Users can freely move a trip back to `planning` from `active` or `completed`, which is useful when travel dates shift.
- If enforced transitions are added later, the existing free-form path in the server action will need a guard inserted; no schema change is required.
