# Implementation Notes — SPEC-005: Shared Wire Types and Schemas (`@travel-planner/shared`)

**Spec:** [SPEC-005-shared-types-and-schemas](../specs/SPEC-005-shared-types-and-schemas.md)
**Started:** 2026-05-20

> Rolling log written by the implementing agent. Append new entries at the
> bottom as they happen — do not rewrite history. Each entry is a single
> observation, decision, or surprise. At spec close-out, every entry is
> triaged into one of: spec deviations table, spec post-implementation notes,
> docs/tech-debt.md, or discarded.

## Entries

### 2026-05-20 18:40 — biome.json `includes` extended to cover `packages/shared/src/**`

**Step:** Step 1 — packages/shared/ skeleton
**Type:** decision

**Note:**

Spec §12 step 1 only scaffolds the package files; it doesn't mention
linter coverage. Running `pnpm lint` after the scaffold passed
(`Checked 274 files`) but a quick check of `biome.json` showed the
`files.includes` array doesn't reach into `packages/shared/`, so the
new package would silently escape lint.

Small surgical addition: append `"packages/shared/src/**"` to
`files.includes`. Post-change `pnpm lint` reports `Checked 275 files`,
confirming `src/index.ts` is now covered. Clean.

This is the kind of small judgment call the spec wouldn't have called
out by name. Erring on the side of including it in step 1's commit
keeps the package consistent with the rest of the monorepo's lint
coverage from the moment it lands.

**Triage (filled at close-out):**

---


## Close-out triage summary

> Filled at the very end. One line per entry above plus where it landed.

| Entry | Landed in |
|-------|-----------|
