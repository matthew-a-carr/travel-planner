# Routine: `draft-spec`

> Read this whole file before doing anything. It is the source of truth for
> what this routine does. The cloud-side prompt is a one-line shell that
> points at this file.

## Trigger

GitHub: `Issue opened` with filter `Labels is one of: claude:plan`.

The event fires when a new issue is opened with the `claude:plan` label
(usually via the **Feature request** issue template).

## What to do

1. Resolve `$ISSUE_NUMBER` and `$REPO` from the triggering event payload.
   If the routine's environment provides `NOTIFY_REPO`, use that for
   `$REPO`; otherwise derive from the event.
2. Invoke the `draft-spec` skill from `.agents/skills/draft-spec/SKILL.md`
   end-to-end. Follow every step.
3. The skill will:
   - Read the issue body.
   - Apply the engineering-principles plugin's `apply-principles` skill
     (gracefully continue if the plugin isn't loaded — log a warning in
     the PR body).
   - Read project standards (`AGENTS.md`, `CONSTITUTION.md`,
     `docs/tech-debt.md`, the parent epic if any).
   - Write `docs/specs/SPEC-NNN-<slug>.md` on a `claude/spec-NNN-<slug>`
     branch.
   - Self-review via the `review-spec` skill and
     `engineering-principles:architecture-review`.
   - Open a PR with label `claude:revise` and a §Open Questions section.
   - Apply `claude:planned` to the source issue + comment with the PR
     link.

## Tools to use

- Local git operations: standard `git` CLI (clone, branch, add, commit,
  push). These work via the Claude GitHub App's clone+push permission.
- Remote GitHub operations (read issue, create PR, add comments, apply
  labels): the `mcp__github__*` MCP tools provided by the Claude GitHub
  App. **Do not use `gh` CLI** — it has known auth issues in scheduled
  routines (anthropics/claude-code#42743).
- Slack notifications (blockers only): `mcp__claude_ai_Slack__slack_send_message`
  to `$SLACK_NOTIFY_USER`.

## When to block

Per the skill's "If blocked" section. Specifically:

- Issue body is genuinely unparseable.
- Claimed parent epic doesn't exist or is in `Draft` status.
- Work conflicts head-on with a Tier 1 principle.

When blocked: do NOT open a PR. Comment on the source issue with the
blocker line. Apply `claude:blocked`. Slack DM `$SLACK_NOTIFY_USER`.

## Reference

- Skill: [`.agents/skills/draft-spec/SKILL.md`](../../.agents/skills/draft-spec/SKILL.md)
- ADR: [`docs/decisions/056-...`](../../docs/decisions/057-autonomous-workflow-and-remote-execution.md)
- Runbook (one-time setup):
  [`docs/operations/autonomous-workflow.md`](../../docs/operations/autonomous-workflow.md)
