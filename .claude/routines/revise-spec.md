# Routine: `revise-spec`

> The cloud-side prompt is a thin shell pointing here.

## Trigger

GitHub: `Custom` event (`pull_request.labeled`) with filter
`Labels is one of: claude:revise-now`.

Fires when Matt drops review comments on a spec or epic PR and applies the
`claude:revise-now` label. Works for both SPEC and EPIC PRs (the skill
auto-detects which based on the file path the PR modifies).

## What to do

1. Resolve `$PR_NUMBER` and `$REPO` from the event.
2. Invoke the `revise-spec` skill at
   `.agents/skills/revise-spec/SKILL.md` end-to-end.
3. The skill will:
   - Check out the PR branch.
   - `git fetch origin <branch>` and `git rebase --autostash` against the
     remote — bail if conflicts (claude:blocked + DM).
   - Read every unresolved review comment (filter to "since last revise"
     using the timestamp of the most recent commit by this routine — see
     skill step 7).
   - Classify each (apply / answer / push-back / ambiguous / out-of-scope).
   - Rewrite the SPEC or EPIC file in place. Update §Open Questions.
   - Re-run `review-spec` + `architecture-review` against the new diff.
   - Push to the same `claude/spec-NNN-*` or `claude/epic-NNN-*` branch.
   - **Remove the `claude:revise-now` label as the LAST step** (after the
     push succeeds), so the trigger doesn't refire on the same event.
   - Post a top-level PR comment summarising the round.

## Tools

- Local: `git` CLI (fetch, rebase, commit, push).
- Remote: `mcp__github__*` (list comments, push files via PR branch,
  apply/remove labels, post comments).
- Blockers: `mcp__claude_ai_Slack__slack_send_message` to
  `$SLACK_NOTIFY_USER`.

## When to block

- Rebase conflicts (Matt edited the file in the GitHub UI).
- Every reviewer comment is ambiguous.
- Two comments conflict on a load-bearing decision.

Block by: comment "Blocked: <reason>. Need: <input>." on the PR + apply
`claude:blocked` + remove `claude:revise-now` + Slack DM.

## Reference

- Skill: [`.agents/skills/revise-spec/SKILL.md`](../../.agents/skills/revise-spec/SKILL.md)
- ADR: [`docs/decisions/056-...`](../../docs/decisions/057-autonomous-workflow-and-remote-execution.md)
