# Decide Whether a Bug Fix Needs an ADR

## Problem/Feature Description

The same Next.js + TypeScript project records Architecture Decision Records in
`docs/decisions/`. The project's rule (from `AGENTS.md`, "When to write an ADR")
is that an ADR records a **decision** — choosing a library/tool, changing CI
structure, changing dependency-management policy, establishing a project-wide
standard, changing the database schema strategy, or making a non-obvious
architectural trade-off. It explicitly does **not** require one for a bug fix
with no design decision, a routine version bump, or a test following an
established pattern, and notes that a "noise" ADR (one that captures
implementation notes rather than a decision) is itself a violation.

A PR fixes an **off-by-one error** in an existing date-range helper
(`getNightsBetween`) — it was excluding the final night. The fix changes one
comparison operator and adds a unit test that reproduces the bug, following the
existing test pattern in the same file. No new library, no new convention, no
schema or CI change, no architectural trade-off.

Your job: decide whether this change warrants an ADR.

## Output Specification

Produce a single file `adr_decision.md` containing:

- A clear yes/no on whether an ADR should be written.
- The reasoning, referencing the project's ADR triggers.
