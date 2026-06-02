# Write an ADR for a New Charting Library

## Problem/Feature Description

A team builds a Next.js + TypeScript app whose engineering docs live in `docs/`,
with Architecture Decision Records in `docs/decisions/` (indexed by
`docs/decisions/README.md`) and an ADR template at
`docs/decisions/000-template.md`. Their conventions:

- ADR filenames are `NNN-short-descriptive-title.md` — zero-padded to three
  digits, kebab-case, and self-describing **from the filename alone**.
- Each ADR has exactly three sections: **Context**, **Decision**, **Consequences**.
- An ADR ships in the **same commit/branch** as the change it documents.
- ADRs that supersede an earlier one update the old ADR's status line.

A feature PR adds **Recharts** as the charting library for a new analytics
dashboard, chosen over Victory and Chart.js. It does not supersede any prior
ADR. The highest-numbered ADR currently on `main` is
`docs/decisions/057-autonomous-workflow-and-remote-execution.md`.

Your job: produce everything needed to record this decision as an ADR.

## Output Specification

Produce a single file `adr_plan.md` containing:

- A one-line statement of whether an ADR is warranted and which trigger it meets.
- The exact ADR filename you would create (under `docs/decisions/`).
- The full ADR markdown content (all required sections, filled in).
- The exact new row you would add to the `docs/decisions/README.md` index table.
- The exact commit message you would use.
