# Implementation Notes — SPEC-NNN: [Title]

**Spec:** [SPEC-NNN-title](../specs/SPEC-NNN-title.md)
**Started:** YYYY-MM-DD

> Rolling log written by the implementing agent. Append new entries at the
> bottom as they happen — do not rewrite history. Each entry is a single
> observation, decision, or surprise. At spec close-out, every entry is
> triaged into one of: spec deviations table, spec post-implementation notes,
> docs/tech-debt.md, or discarded.

## Entries

### YYYY-MM-DD HH:MM — <one-line summary>

**Step:** <which step from spec section 9, e.g. "Step 3: create repository">
**Type:** deviation | surprise | decision | blocker | learning
**Note:**

<Free-form. Be specific. Quote error messages. Link the commit if relevant.>

**Triage (filled at close-out):** spec-deviation #N | post-impl-note |
tech-debt TD-NNN | discarded — <why>

---

### YYYY-MM-DD HH:MM — <next entry>

...

## Close-out triage summary

> Filled at the very end. One line per entry above plus where it landed.

| Entry | Landed in |
|-------|-----------|
| 1 | Spec deviation #1 |
| 2 | TD-007 |
| 3 | Discarded (resolved before commit) |
