# Routine: `weekly-tech-debt`

> The cloud-side prompt is a thin shell pointing here.

## Trigger

Schedule: `0 17 * * 0` (Sundays at 17:00 UTC = 18:00 BST in summer).

## What to do

1. Invoke the `review-tech-debt` skill at
   `.agents/skills/review-tech-debt/SKILL.md` end-to-end.
2. The skill reads `docs/tech-debt.md`, assesses each item's relevance
   and severity, and categorises actions.
3. Open a PR with proposed reclassifications, closures, or new entries
   under a `claude/tech-debt-review-<YYYY-MM-DD>` branch.
4. **Do not auto-close items** — Matt reviews the PR and decides which
   to merge.

## Tools

- Local: `git` for the branch + commit.
- Remote: `mcp__github__create_pull_request` to open the review PR.
- Optional: `mcp__github__list_pull_requests` to cross-reference recently
  merged work for "is this debt still relevant?" judgments.

## When to block

This routine doesn't block. If `docs/tech-debt.md` is empty or all items
are already in a healthy state, exit without opening a PR (silence =
nothing to do).

## Reference

- Skill: [`.agents/skills/review-tech-debt/SKILL.md`](../../.agents/skills/review-tech-debt/SKILL.md)
- Tech debt register: [`docs/tech-debt.md`](../../docs/tech-debt.md)
