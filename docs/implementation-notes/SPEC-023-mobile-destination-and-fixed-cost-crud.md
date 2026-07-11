# SPEC-023 Implementation Notes

## 2026-07-11 — Canonical budget suggestions

The web domain owns comfort multipliers and reference daily costs, while the
mobile domain boundary cannot import web internals. `GET /api/v1/countries`
therefore publishes the server-calculated daily suggestion at each closed
comfort level. Mobile performs only the deterministic day multiplication and
does not duplicate the multipliers.

## 2026-07-11 — Child isolation

Every item command resolves the accessible parent and verifies the child points
to that exact trip inside the idempotent transaction. Missing, mismatched, and
inaccessible combinations intentionally share one not-found response.

## 2026-07-11 — Native route economy

Each resource type uses one editor route: the literal `new` path value selects
create mode and a UUID selects edit/delete. This avoids duplicate forms while
keeping destination and fixed-cost concepts separate.
