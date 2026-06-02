# Plan the PR Lifecycle Operations an Agent Runs

## Problem/Feature Description

Your team runs a weekly pass over open PRs: for a given PR it reads the current
review and CI state, replies to any unanswered comment threads with a status
update, waits for the required checks to conclude, and merges the PR if it is
fully ready. Today a developer does this by hand every Friday; the team wants a
Claude Code **agent** to do it directly — the agent calls tools itself. It does
**not** write or run a standalone shell script.

Produce a step-by-step execution plan for handling one PR (its number is the
input) that the agent would follow. For **each** of the four operations, name
the exact tool you would call:

1. **Read the PR state** — review status, check-run results, and all unresolved
   comment threads.
2. **Reply to unresolved threads** — post a status message on each.
3. **Wait for checks** — poll until every required check has concluded; do not
   exit early.
4. **Merge when ready** — if all required checks are green and no review is
   requesting changes, merge the PR and delete the head branch.

This repo's convention: every GitHub remote operation goes through the
`mcp__github__*` MCP tools (the Claude GitHub App), **never** the `gh` CLI; and
merges are **squash** merges whose title is a valid Conventional Commit.

## Output Specification

Produce a single file `pr_lifecycle_plan.md` containing:

- A numbered step for each of the four operations, in order.
- The exact tool name used at each step (e.g. `mcp__github__pull_request_read`).
- For the merge step, the squash-commit title format you would use.
