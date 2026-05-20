# Implementation Notes

Per-spec rolling log of things that didn't go according to plan, observations,
and small decisions made during implementation. The `implement-spec` skill
writes here in real time so deviations are captured the moment they happen, not
reconstructed at the end.

At spec close-out, the implementing agent triages each entry into:

1. **The spec's "Implementation Deviations" table** — for things that changed
   the design intent.
2. **The spec's "Post-Implementation Notes"** — for learnings and
   would-do-differently observations.
3. **`docs/tech-debt.md`** — for unresolved debt that must outlive the spec.
4. **Discarded** — for entries that were resolved during implementation and
   don't need to outlive it.

After triage, the notes file is left in place as the raw record. It is not
authoritative — the spec and the tech debt register are. Treat it like a
working notebook.

## File naming

`docs/implementation-notes/SPEC-NNN-<slug>.md` — one file per spec, created
when implementation starts.

See `_template.md` for the structure.

## Why a separate file, not just the spec?

Two reasons:

- **Friction.** Capturing a note in a dedicated, append-only file is cheaper
  than editing a structured table inside the spec mid-flight. Lower friction
  = more honest capture.
- **Triage.** Raw notes are messy. Triaging them at close-out into the spec's
  tables and tech-debt is a *deliberate* synthesis step, not an afterthought.

If a notes file ends up empty at close-out, that's a good sign — not a
problem. Either implementation went smoothly, or (more likely) something was
missed; either way, the empty file makes that visible.
