# Routine: `review-implementation`

> The cloud-side prompt is a thin shell pointing here.

## Trigger

GitHub: `Custom` event (`pull_request.labeled`) with filter
`Labels is one of: ai:done`.

Fires once when an implementation PR is labelled `ai:done` (the
`implement-spec` routine applies that label when it opens the PR). This gives
Matt an agent-side review on the impl PR before he reads it — the code-review
counterpart to `review-spec` on the spec PR.

## What to do

1. Resolve `$PR_NUMBER` and `$REPO` from the event.
2. Invoke the `review-implementation` skill at
   `.agents/skills/review-implementation/SKILL.md` end-to-end, in **routine
   mode**.
3. The skill will:
   - Read the diff, the SPEC it implements, the implementation-notes file,
     `CONSTITUTION.md`, the touched layers' `AGENTS.md`, and implicated ADRs.
   - Run its seven passes (SPEC fidelity, architecture/layer boundaries,
     conventions, tests, ADR obligations, doc staleness, simplicity).
   - Post the structured report as a PR review comment via `mcp__github__*`.
4. If the verdict is **Needs changes** with **Critical** findings, DM
   `$SLACK_NOTIFY_USER` via `mcp__claude_ai_Slack__slack_send_message` with the
   PR link + the one-line verdict so Matt knows not to merge yet. A clean
   *Ready to merge* report posts to the PR with no DM (silence = fine to merge).

## Boundaries

- **Read-only.** The routine never edits code, never pushes, never merges. It
  reports. Addressing the findings and merging is `babysit-pr`'s job (under
  explicit instruction) or Matt's.
- If a **Blocked** verdict surfaces a design question the SPEC never resolved,
  apply `ai:blocked` to the PR + DM, same as the other routines.

## Tools

- Remote: `mcp__github__*` (read PR + diff, post review comment, apply labels).
- Blockers / Critical heads-up: `mcp__claude_ai_Slack__slack_send_message` to
  `$SLACK_NOTIFY_USER`.
- Best-effort: the engineering-principles `architecture-review` skill as a
  cross-check (continue if not loaded).

## When to block

Only on a **Blocked** verdict (a Critical that needs a design decision the SPEC
should have resolved). Routine review findings otherwise post to the PR; they
don't block — Matt decides whether to merge or send to `babysit-pr`.

## Reference

- Skill: [`.agents/skills/review-implementation/SKILL.md`](../../.agents/skills/review-implementation/SKILL.md)
- ADR: [`docs/decisions/057-...`](../../docs/decisions/057-autonomous-workflow-and-remote-execution.md)
