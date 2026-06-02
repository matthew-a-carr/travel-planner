# Routine prompts — source of truth

Each file in this directory is the **canonical prompt** for one Claude Code
Web routine. The routine's cloud-side prompt (set at
[claude.ai/code/routines](https://claude.ai/code/routines)) is a thin shell
that reads the file from the cloned repo and follows it:

```text
Read .claude/routines/<name>.md from the cloned repo and execute it. The
file is the source of truth for what this routine does, what tools it uses,
and when to escalate.
```

This way edits to a routine's behaviour go through PR review like any other
change. The runbook
([`docs/operations/autonomous-workflow.md`](../../docs/operations/autonomous-workflow.md))
covers the one-time setup; the files here cover the recurring behaviour.

## Routines

| Routine | File | Trigger |
|---|---|---|
| `draft-spec` | [`draft-spec.md`](./draft-spec.md) | GitHub: `Issue opened` + label `claude:plan` |
| `draft-epic` | [`draft-epic.md`](./draft-epic.md) | GitHub: `Issue opened` + label `claude:plan-epic` |
| `revise-spec` | [`revise-spec.md`](./revise-spec.md) | GitHub: `Custom` event (`pull_request.labeled`) + label `claude:revise-now` |
| `implement-spec` | [`implement-spec.md`](./implement-spec.md) | GitHub: `PR merged` + label `claude:implement` |
| `review-implementation` | [`review-implementation.md`](./review-implementation.md) | GitHub: `Custom` event (`pull_request.labeled`) + label `claude:done` |
| `daily-digest` | [`daily-digest.md`](./daily-digest.md) | Schedule: `0 17 * * *` (17:00 UTC = 18:00 BST) |
| `weekly-tech-debt` | [`weekly-tech-debt.md`](./weekly-tech-debt.md) | Schedule: `0 17 * * 0` (Sun 17:00 UTC) |

## Editing a prompt

1. Edit the file on a branch.
2. Open a PR — review the change like any other code change.
3. Merge. The next routine run reads the updated prompt from `main` after
   the clone.

No cloud-side change is needed unless you change the **trigger** itself
(label name, schedule, event type). The thin-shell prompt at
claude.ai/code/routines stays untouched.

## Why this layout

Routine prompts in the cloud are easy to drift from the repo if they live
only in the runbook. Anchoring them as files in the repo means:

- One read-path: clone the repo, read the file, run it.
- Diffable, reviewable, versioned alongside the skills they invoke.
- A new operator clones the repo and gets the prompts for free.
- The routine itself can be re-pointed at a different branch (e.g. a
  staging branch with experimental prompt changes) without rewriting the
  cloud-side config.
