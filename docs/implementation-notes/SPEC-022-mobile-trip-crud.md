# SPEC-022 Implementation Notes

## 2026-07-11 — Atomic retry boundary

The existing use cases remain the business-rule authority, but exact mobile
retry semantics require their repository instances to share the executor's
transaction. The four affected Drizzle repositories now accept the narrower
`DbSession` type and are constructed inside the executor callback by the
composition root. ADR 064 records this boundary.

## 2026-07-11 — Organization choice

Trip creation requires an explicit organization. A small read-only
`GET /api/v1/organizations` adapter over the existing
`getUserOrganizations` use case supplies the native picker without pulling
organization administration into this slice.

## 2026-07-11 — CI evidence sequencing

The parity ledger claims the three trip command capabilities only after shared
contract, native component, route integration, executor concurrency, and a
real-backend Maestro flow all exist. The authoritative macOS run is the final
close-out gate.

## 2026-07-13 — Real-device close-out

- Run 29269377480 completed the trip create/edit/status/delete journey. Its
  first attempt exposed a route-transition race after update: visible form text
  was not sufficient proof that detail navigation had completed.
- The flow now waits for the detail-only edit selector before asserting the
  updated name and entering the delete pass. A static test prevents regression
  to text-only transition evidence.
