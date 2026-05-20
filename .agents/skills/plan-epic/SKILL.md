---
name: plan-epic
description: >
  Plan a multi-SPEC initiative by writing a formal epic. Use when the user
  describes work that needs more than ~3 SPECs to deliver value, says "plan an
  epic," "plan the X initiative," or references a strategic ADR that needs
  operationalising into shippable slices. Grills at epic altitude (vision,
  slicing, kill criteria, cross-cutting decisions, external constraints), then
  writes EPIC-NNN. Does NOT write SPECs — child SPECs are created via
  `plan-feature` slice-by-slice when each slice is ready to begin.
---

# Plan an Epic

## When to use

Use this skill when the work matches the epic triggers in
`docs/epics/README.md`:

- The work needs more than ~3 SPECs to deliver real user value.
- Sequencing across SPECs matters (slice N unblocks slice N+1).
- Cross-cutting decisions (auth, packaging, observability, vendor) should
  be settled once rather than relitigated per SPEC.
- There's a meaningful chance the work is killed or pivoted partway, and
  pre-committing exit criteria matters.

Do **not** use for single-SPEC features (use `plan-feature` directly),
tactical refactors with no user-facing demo, or anything where the
strategic ADR is already the right level of detail.

## Pre-flight

1. Read `AGENTS.md`, `CONSTITUTION.md`, and `docs/epics/README.md`.
2. Read `docs/tech-debt.md` — flag any items that this epic might address
   or that might constrain its slicing.
3. Read existing epics in `docs/epics/` for tone and depth — match them.
4. Identify the strategic ADR this epic operationalises. If there isn't
   one, **stop and consider whether you should be writing the ADR first.**
   Epics implement direction; they do not decide it.
5. Read `docs/epics/README.md` to determine the next epic number
   (EPIC-NNN).

## Grill the epic first

6. Invoke the `grill-me` skill at **epic altitude** unless a draft brief
   already exists at `docs/epics/_draft-NNN-<slug>.md`. Grill specifically
   on:
   - **Vision and demo** — what's the one-paragraph demo at the end of
     the whole epic? What's the *milestone slice* — the thinnest end-to-end
     vertical that proves the strategic decision?
   - **Definition of done** — what's the gate the slice plan has to pass
     through? When are we done vs done-enough?
   - **Slicing** — what's the minimum first slice that produces user-
     visible value? What are the dependencies between slices? What can be
     parallelised? Which slices are reversible if we re-sequence?
   - **Kill / pivot criteria** — what concrete signal would make us stop
     or change course? What's the threshold?
   - **Cross-cutting decisions** — which trade-offs should be settled
     once at epic level so child SPECs inherit them and don't relitigate?
   - **External dependencies & constraints** — what's outside the
     codebase that shapes this? Vendor accounts, third-party APIs,
     hardware, billing, certificates, regulatory or platform rules?
   - **Cost & budget** — subscriptions, paid services, headcount, calendar.
   - **Open questions** — what are we deliberately deferring rather than
     guessing? Who answers each, and by which slice?
   - **Parking lot** — what good ideas don't fit but shouldn't be lost?
7. **When the grilling loop ends, this skill writes the draft brief**
   itself — `grill-me` does not produce artefacts. Save it to
   `docs/epics/_draft-NNN-<slug>.md` with sections mirroring §1, §3, §5,
   §7, §9, §10, §13, §14 of the epic template. Keep it tight (~1 page).
8. If a draft brief exists, read it end-to-end and treat its contents as
   inputs to the epic — do not silently relitigate decisions captured
   there. If anything is still genuinely unresolved, run another grilling
   pass on just those items.

## Research

9. Read the strategic ADR end-to-end; cite it in the epic's §2 Why now,
   §17 References, and front-matter `Strategic ADR` field.
10. For each affected app or package, read the layer's `AGENTS.md` (for
    the web app: `apps/web/src/{domain,application,infrastructure}/AGENTS.md`).
    Cross-cutting decisions in the epic's §10 must reconcile with whatever
    each layer already enforces.
11. Read related existing ADRs and existing epics. Note any prior work
    that constrains slicing or sequencing.
12. If the strategic ADR is **Proposed**, do not write the epic yet —
    surface the ADR for human decision first. An epic operationalises an
    accepted strategic direction.

## Write the epic

13. Copy `docs/epics/_template.md` → `docs/epics/EPIC-NNN-<slug>.md`.
14. Fill in **every** section, using the draft brief as the source of
    truth for vision, scope, alternatives, and rejected options.
    - Use `N/A — [reason]` for sections that don't apply.
    - The slice table must list every slice with its demo-script line(s),
      dependency, and status (`Not started` initially). Each slice gets a
      `_not yet planned_` placeholder in the SPEC column — SPECs are
      created lazily.
    - The definition of done (§3) and demo script (§4) must be concrete
      enough that a future reader can evaluate "are we done?" without
      asking you.
    - The cross-cutting decisions table (§10) must list every decision a
      child SPEC would otherwise ask. Anything missing here will get
      rediscovered (badly) at slice-grilling time.
    - The kill / pivot criteria (§9) must be **measurable**. Vague kill
      criteria are unkillable.
15. Seed the slice ledger (after the main template body) with a single
    "Epic drafted" row.
16. Set status to `Draft`.

## Submit for review

17. Update `docs/epics/README.md` — add the new epic to the index table.
18. Delete (or rename to `_draft-NNN-<slug>.superseded.md`) the draft
    brief now that the epic supersedes it.
19. Present the epic to the human for review.
20. **STOP. Do not begin any slice's SPEC until the human sets epic status
    to `Approved`.**

## If changes are requested

21. Revise the epic based on human feedback.
22. If feedback exposes a genuinely unresolved question, run another
    `grill-me` pass on just that question rather than guessing.
23. Re-submit for review.
24. Repeat until approved.

## After approval — handoff to `plan-feature`

25. The epic is now the source of truth. When the human (or you) is ready
    to start a slice, invoke `plan-feature` for that slice. `plan-feature`
    will read the parent epic, inherit its cross-cutting decisions, and
    write the slice's SPEC.
26. Each child SPEC must include `**Parent epic:** [EPIC-NNN link]` in its
    front matter, and `plan-feature` updates the epic's slice table and
    slice ledger when status changes.

## During epic execution

27. The epic file is **append-only** below the line for the slice ledger
    and epic-level deviations. The structured sections above the line
    (vision, slices, decisions, etc.) are amendable but each amendment
    should land with a slice-ledger note explaining why.
28. If a child SPEC's implementation forces a change to a §10
    cross-cutting decision or §7 slice sequence, log it in §16 "Epic-level
    deviations" — not just in the SPEC's local deviations table.
29. The epic closes when every slice in §7 has shipped or been explicitly
    dropped, OR when a §9 kill criterion fires. Update status to
    `Complete` or `Abandoned`, write the post-epic notes section, and
    update `docs/epics/README.md`.
