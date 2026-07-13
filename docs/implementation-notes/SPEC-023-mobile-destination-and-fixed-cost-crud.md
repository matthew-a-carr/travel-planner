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

## 2026-07-13 — Real-device close-out

- Run 29269377480 passed the full planning-core journey on attempt one against
  exact reseeded fixtures and the production Next.js server.
- Shared schemas, OpenAPI generation, nested-resource authorization, native
  editor tests, and atomic replay tests were all green in the same run.
