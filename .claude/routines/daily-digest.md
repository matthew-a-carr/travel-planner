# Routine: `daily-digest`

> The cloud-side prompt is a thin shell pointing here.

## Trigger

Schedule: `0 17 * * *` (17:00 UTC daily = 18:00 BST in summer, 17:00 BST in
winter). Adjust via `/schedule update` if the operator wants a different
slot.

## What to do

Once per run, look at the current state of `$NOTIFY_REPO` and DM
`$SLACK_NOTIFY_USER` a single bulleted message **only if there's something
worth saying**. Silence is the success signal — no DM = nothing needs Matt's
attention today.

Gather, using `mcp__github__*` tools:

1. Issues with `claude:blocked`.
2. PRs with `claude:blocked`.
3. PRs opened or merged in the last 24h with any `claude:*` label.
4. Open spec/epic PRs awaiting review (`claude:revise` label, no
   `claude:revise-now`).
5. In-flight impl PRs with `claude:done` (need merge).

If ALL of those are empty → exit without sending anything.

Otherwise, DM `$SLACK_NOTIFY_USER` via
`mcp__claude_ai_Slack__slack_send_message` with this shape:

```text
*Travel-planner — autonomous loop, <YYYY-MM-DD>*

*Blocked* (action needed)
• <list, or omit section if empty>

*Awaiting your review*
• <PR links + titles, or omit if empty>

*Ready to merge*
• <PR links, or omit if empty>

*Shipped in the last 24h*
• <PR links + one-line summaries, or omit if empty>
```

Slack mrkdwn — use `*bold*` and `•` for bullets. No `#` headings. Omit
empty sections entirely; don't say "None".

## Tools

- `mcp__github__list_issues`, `mcp__github__list_pull_requests`,
  `mcp__github__search_pull_requests` for the gathering.
- `mcp__claude_ai_Slack__slack_send_message` for the DM.

## When to block

This routine doesn't block — it's a read-only summariser. If the summary
itself can't be generated (MCP failure, rate limit), exit non-zero so the
session log surfaces it. No need to Slack the operator about a failed
digest; the absence of a daily DM is itself a signal worth investigating.

## Reference

- ADR: [`docs/decisions/056-...`](../../docs/decisions/057-autonomous-workflow-and-remote-execution.md)
