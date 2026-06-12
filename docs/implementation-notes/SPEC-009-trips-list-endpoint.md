# Implementation Notes — SPEC-009: `GET /api/v1/trips` — Trips List Endpoint

**Spec:** [SPEC-009-trips-list-endpoint](../specs/SPEC-009-trips-list-endpoint.md)
**Started:** 2026-06-11

> Rolling log written by the implementing agent. Append new entries at the
> bottom as they happen — do not rewrite history. Each entry is a single
> observation, decision, or surprise. At spec close-out, every entry is
> triaged into one of: spec deviations table, spec post-implementation notes,
> docs/tech-debt.md, or discarded.

## Entries

### 2026-06-11 — Single branch for all four EPIC-002 slices (process deviation)

**Step:** Pre-flight
**Type:** decision
**Note:**

Matt asked interactively to "complete the mobile implementation that's
read-only … commit as you go … keep going until we have parity". The
`implement-spec` default of one branch + PR per slice with a human merge
between slices would block the session at slice 1, so all four EPIC-002
slices are implemented as small sequential commits on a single branch
(`claude/impl-epic-002-read-only-mobile`), opened as one reviewable PR at
the end. Slices 2–4 have no pre-drafted SPECs (the epic drafts them
lazily); compact SPEC docs are written as part of each slice so the spec
index stays true.

**Triage (filled at close-out):** spec-deviation #1

---

### 2026-06-11 — List ordering: createdAt desc across orgs (judgment call)

**Step:** Step 3: listTripsForUser use case
**Type:** decision
**Note:**

The SPEC doesn't specify list ordering. The web's trips list orders
`createdAt desc` (`DrizzleTripRepository.findAllByOrganization`), so the
use case sorts the cross-org concatenation the same way — one consistent
order between clients, deterministic for tests. `createdAt` itself is not
exposed on the wire.

**Triage (filled at close-out):** spec-deviation #2

---

### 2026-06-11 — src/application/AGENTS.md use-case list was already stale

**Step:** Step 3 doc review
**Type:** surprise
**Note:**

The structure list was missing ~7 existing use cases (analyse-trip-timeline,
bulk-add-destinations, create-trip-with-destinations, edit-destination,
move-trip-to-organization, parse-itinerary-text, process-chat-message,
summarise-trip-narrative, plus the `auth/` subtree) and claimed "26
integration test files" when there are 33 (+5 in auth/). Added the new
use case's row and corrected the count; the missing pre-existing rows are
left for the close-out `sync-docs` pass rather than churned mid-slice.

**Triage (filled at close-out):** post-impl-note (and the epic-level
sync-docs pass fixes the historical rows)

---

## Close-out triage summary

> Filled at the very end. One line per entry above plus where it landed.

| Entry | Landed in |
|-------|-----------|
| 1 (single branch for the epic) | Spec deviation #1 |
| 2 (createdAt-desc ordering) | Spec deviation #2 |
| 3 (stale application AGENTS.md) | Post-impl note + epic sync-docs pass |
