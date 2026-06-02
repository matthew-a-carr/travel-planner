# Spec Revision: Notification Service PR

## Problem Description

A spec pull request for a real-time notification service (PR #42) has received a batch of review comments and needs to be revised. The PR is on branch `claude/spec-042-notifications`. The review includes a mix of concrete change requests, a question about ownership, an out-of-scope suggestion, and a schema addition from the top-level review.

The revision should carefully address each comment according to its nature and update the spec accordingly, then document what was done.

The input files are provided under `inputs/`:

- `inputs/SPEC-042-notifications.md` — the current spec file
- `inputs/review_comments.json` — the review comments on the PR (structured data representing what would be fetched from GitHub), including metadata about when the last revise commit was made

## Output Specification

Produce the following files in your working directory:

1. `SPEC-042-notifications-revised.md` — the updated spec with all appropriate changes applied
2. `revision_plan.md` — a structured document that for each comment states:
   - The comment ID and author
   - The classification (concrete change / question / disagreement / ambiguous / out-of-scope)
   - The action taken or planned
3. `pr_comment_summary.md` — the text of the top-level PR comment you would post, summarising the round (how many comments addressed, deferred, replied-to; link placeholder; open questions remaining)
4. `per_comment_replies.md` — the reply text you would post on each individual comment

Work only from the files in `inputs/`. Do not make up additional context beyond what is provided.
