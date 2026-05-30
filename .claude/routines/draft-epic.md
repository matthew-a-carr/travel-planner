# Routine: `draft-epic`

> Read this whole file before doing anything. The cloud-side prompt is a
> thin shell pointing here.

## Trigger

GitHub: `Issue opened` with filter `Labels is one of: claude:plan-epic`.

Fired when an issue is opened with the **Epic** issue template (which
pre-applies `claude:plan-epic`).

## What to do

1. Resolve `$ISSUE_NUMBER` and `$REPO` from the event.
2. Invoke the `draft-epic` skill at
   `.agents/skills/draft-epic/SKILL.md` end-to-end.
3. The skill will:
   - Read the issue body and the strategic ADR it references.
   - Halt with a blocked DM if the strategic ADR is missing or in
     `Proposed` status (epics implement direction; ADRs decide it).
   - Apply `apply-principles` at epic altitude.
   - Write `docs/epics/EPIC-NNN-<slug>.md` on a `claude/epic-NNN-<slug>`
     branch, with a slice table seeded but no per-slice SPECs yet.
   - Self-review via `review-spec` and `architecture-review`.
   - Open the PR with label `claude:revise` and a §Open Questions section.
   - Apply `claude:planned` to the source issue + comment with the PR
     link.
4. **Do NOT auto-file slice issues** after the EPIC PR merges. Matt
   decides which slices to surface as `claude:plan` issues and in what
   order.

## Tools to use

Same as `draft-spec`:
- `git` CLI for local ops.
- `mcp__github__*` for remote ops (no `gh` CLI).
- `mcp__claude_ai_Slack__slack_send_message` for blocker DMs to
  `$SLACK_NOTIFY_USER`.

## When to block

- Strategic ADR missing / Proposed.
- Issue describes work that's actually one SPEC (suggest re-filing with
  `claude:plan`).
- Proposed slice count ≤ 1 or ≥ 15.

Block by: not opening a PR + comment + `claude:blocked` + Slack DM.

## Reference

- Skill: [`.agents/skills/draft-epic/SKILL.md`](../../.agents/skills/draft-epic/SKILL.md)
- Epic README: [`docs/epics/README.md`](../../docs/epics/README.md)
- ADR: [`docs/decisions/056-...`](../../docs/decisions/057-autonomous-workflow-and-remote-execution.md)
