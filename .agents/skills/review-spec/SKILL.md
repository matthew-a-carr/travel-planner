---
name: review-spec
description: >
  Cross-artefact consistency and quality review of an approved or draft SPEC.
  Use when the user says "review SPEC-NNN," before `implement-spec` runs, or
  by `draft-spec` / `revise-spec` before opening or updating a spec PR. Checks the
  SPEC against the constitution, ADRs, parent epic (if any), and tech debt
  register. Read-only — produces a structured report, never edits files.
---

# Review Spec

## When to use

Use this skill to gate a SPEC between `Draft` and `Approved`, or between
`Approved` and `implement-spec`. Also suitable for ad-hoc consistency
checks on a SPEC the user references by number.

Do **not** use this skill to *write* or *edit* a SPEC. It is read-only by
design — the report goes to the human, who decides what to change.

## Inputs

The user will identify the SPEC by number (e.g. "review SPEC-005"). If
ambiguous, ask. Do not guess.

## Load context

1. Read the target SPEC: `docs/specs/SPEC-NNN-*.md`.
2. If the SPEC's `Parent epic:` field is not `—`, read that epic file end-to-end
   (`docs/epics/EPIC-MMM-*.md`). Pay close attention to §6 (non-goals),
   §7 (slice table), and §10 (cross-cutting decisions).
3. Read `CONSTITUTION.md`.
4. Read `docs/decisions/README.md` to scan ADR titles. Then read any specific
   ADRs that the SPEC references in §13 or that are obviously implicated by
   the SPEC's subject area (e.g. SPEC touches money → read ADR 038; SPEC adds
   a `/api/v1/*` route → read ADR 050).
5. Read `docs/tech-debt.md` (Outstanding Items table only).

## Run six passes

For each finding, record severity: **Critical** (blocks implementation),
**Warning** (should be fixed or explicitly justified), **Suggestion**
(consider).

### Pass 1 — Constitution & ADR alignment

Check the SPEC against `CONSTITUTION.md` and the ADRs you loaded.

Examples of what to flag:
- Domain code in §7 that depends on infrastructure or application (violates
  layer rules).
- Money modelled as float, decimal, or string (violates the pence-as-integer
  rule and ADR 038).
- Fallible domain operations that throw rather than returning `Result` (ADR 038).
- A new `/api/v1/*` route whose error envelope or status codes disagree with
  ADR 050 / `docs/api-conventions.md`.
- A new test that mocks the database for use-case or repository code (violates
  the integration-test rule).
- An ADR-relevant decision (new library, CI structural change, project-wide
  standard, non-obvious trade-off) where §13 says "none required" but
  AGENTS.md trigger criteria are met.

Constitution / ADR violations are **Critical** by default. They cannot be
downgraded by reinterpretation — surface them and let the human decide.

### Pass 2 — Epic alignment (only if Parent epic ≠ —)

- Does this SPEC match a row in the epic's §7 slice table? If not, **Critical**.
- Does any acceptance criterion in §3 or step in §12 fall inside the epic's
  §6 non-goals? **Critical**.
- Does the SPEC re-litigate a decision settled in the epic's §10? **Warning** —
  the SPEC should reference the epic, not re-decide.
- Are the epic's §10 cross-cutting decisions visibly respected (e.g. auth model,
  packaging, observability)? If a relevant one is silently ignored, **Warning**.

### Pass 3 — Coverage

- Each acceptance criterion in §3 should map to **at least one test** in §9
  (E2E, integration, or unit) **and at least one step** in §12. Orphan
  criteria → **Warning**.
- Each step in §12 should pair *intent* with *verification* (test file or
  check). Steps with no verification → **Warning**.
- Demo script steps (§4) should be achievable from the acceptance criteria.
  Demo steps that imply functionality not in §3 → **Warning**.

### Pass 4 — Ambiguity

Search the SPEC body for unresolved language:

- Literal placeholders: `TBD`, `TODO`, `XXX`, `???`, `[?]`, `<placeholder>`,
  `FIXME`.
- Hedging that survived grilling: `probably`, `maybe`, `might`, `we could`,
  `should consider`, `not sure whether`.
- Empty bullet points or trailing `…` in design sections.

§14 ("Risks & open questions") is the *correct* home for unresolved items —
hedging there is fine. Anywhere else, flag as **Warning** (or **Critical** if
the ambiguity blocks the very first step of §12).

**Mid-deliberation prose is a Warning, not a Suggestion.** Watch for passages
where the SPEC narrates the *process* of deciding rather than stating the
*outcome*. Tell-tale shape:

> "X would be ugly. Cleaner: Y or Z. **Decision: Y.** Added as ..."

Both the rejected option and the chosen option end up in the final design
section. A future reader (or implementer) has to re-derive which sentences
describe the final design and which describe the path not taken. This pattern
empirically correlates with deviations at implementation time — the decision
wasn't fully made when the SPEC was approved.

Rewrite rule when you flag this: the final design section should describe the
chosen design as a fact. Rejected alternatives belong in the draft brief or
in a dedicated "Alternatives considered" subsection, not interleaved with the
decided design.

Phrases that should trigger this check:
- `would be ugly`, `would be cleaner`, `would be nicer`
- `inline X or split it into Y`, `either ... or ...`
- `**Decision: ...**` or `Decision: ...` *inside* a design section (the
  decision marker itself signals the surrounding prose was deliberation)
- Two adjacent paragraphs that describe two *different* shapes for the same
  table, type, or flow

### Pass 5 — Underspecification

- All 14 sections present? Missing section → **Critical**.
- Sections that are empty or just a heading → **Critical**.
- Sections marked `N/A` without a reason → **Warning**. Template requires
  `N/A — [reason]`.
- §8 (Security) marked `N/A` for a SPEC that clearly handles user data, auth,
  or money → **Critical**, regardless of stated reason.
- §11 (Rollback) marked `N/A` for a SPEC touching production data, auth, or
  money → **Critical**.

### Pass 6 — Tech debt linkage

For each Outstanding Item in `docs/tech-debt.md`:

- Does this SPEC touch the same subsystem, file area, or concept? (Quick
  heuristic: shared file paths, shared module names, shared domain
  terminology.)
- If yes and §13 "Tech debt items addressed" doesn't mention it, **Suggestion**
  — recommend either folding it in or acknowledging "won't address now, see
  TD-NNN".

## Report

Produce a structured report directly to the user. **Use this template verbatim:**
the four section headings (`## Critical`, `## Warnings`, `## Suggestions`,
`## Passes with no findings`) and the Verdict — exactly one of `Ready for
implementation`, `Needs revision`, `Blocked` — are a fixed contract. Do not
reword the verdict (no "Approve"/"LGTM") or invent a different structure.

```markdown
# Review of SPEC-NNN — <title>

**Verdict:** Ready for implementation | Needs revision | Blocked

## Critical
- [Section §N] <finding> — <why it blocks>

## Warnings
- [Section §N] <finding> — <suggested fix>

## Suggestions
- [Section §N] <finding>

## Passes with no findings
- e.g. "Pass 2 — Epic alignment: clean"
```

Rules:
- One bullet per finding, prefixed with the SPEC section it relates to.
- Quote short snippets from the SPEC where useful. Do not paraphrase if the
  literal text matters (e.g. ambiguous wording).
- If **Critical** is empty and **Warnings** is empty, verdict is *Ready for
  implementation*.
- **A genuinely clean SPEC earns *Ready for implementation*.** Do not manufacture
  Critical or Warning findings to look thorough — a Suggestion, or an honest
  "Passes with no findings", is the correct output for a solid spec. Over-flagging
  a clean spec is as wrong as missing a real problem.
- If any **Critical** is present, verdict is *Needs revision*.
- If a Critical finding can only be resolved by deeper design work (e.g. a
  genuine unresolved design question surfaced too late), verdict is *Blocked*:
  surface the question in the SPEC's §Open Questions and let the PR review
  loop (`revise-spec` + `ai:revise-now`) resolve it, or fall back to an
  interactive `agent-skills:grill-me` session on the specific point.

## Do not

- Do **not** edit the SPEC, the epic, ADRs, or the tech debt register.
- Do **not** invoke `implement-spec` even if the verdict is Ready —
  proceeding is a human decision.
- Do **not** invoke `draft-spec` / `revise-spec` to rewrite the SPEC. Report and stop.
