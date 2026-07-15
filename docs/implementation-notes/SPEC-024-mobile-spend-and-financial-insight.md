# Implementation Notes — SPEC-024

## 2026-07-11

- Started after the secure-tunnel pivot was locally verified and committed;
  authoritative macOS verification remains pending, so all affected parity
  entries stay `in_progress`.
- Added one financial read model rather than duplicating web calculations:
  category grouping, trip burndown, and alerts all call the existing pure
  spending domain. The mobile visual uses accessible platform bars, avoiding a
  chart dependency.
- Extended the ADR 064 transaction repository bundle with spend persistence;
  the real-Postgres suite proves both the spend row and idempotency claim roll
  back together on failure.
- Architecture review found the slice aligned with inward layer dependencies,
  composition-root construction, generated contracts, authenticated nested
  resources, transactional idempotency, and native accessibility semantics.
  No novel dependency or architectural decision was introduced.
- Local lint, type-check, unit, integration, migration, OpenAPI, parity,
  production-build, and diff-integrity gates pass. The parity entries remain
  `in_progress` until the macOS Maestro job exercises the journey.

## 2026-07-13 — Viewport failures resolved and CI green

- Run 29260214856 proved create/edit reached the financial screen but the alert
  action was clipped under the native navigation header. Centering the alert
  action exposed a second geometry effect: the created row was then pushed
  below the viewport.
- Run 29264501830 proved alert dismissal and first edit, then showed the updated
  row at bounds `[32,866][370,922]` below the 874px viewport after the alert was
  regenerated. Both row selections now center before tapping.
- Run 29269377480 passed spend create/edit/delete, category breakdown,
  burndown, and alert dismissal on attempt one. All repository gates were green.
