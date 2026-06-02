# Spec Revision: Search Integration PR

## Problem Description

A spec pull request for a full-text search integration (PR #17) has come back with review comments from multiple reviewers. The PR is on branch `claude/spec-017-search`. The comments include a direct contradiction between two reviewers on a performance target, a concrete architectural recommendation from the primary stakeholder, and a request that may conflict with the spec's stated non-goals.

Your job is to produce a revised spec and supporting revision documents that correctly handle all the feedback — including the conflict — according to the project's revision principles.

The input files are provided under `inputs/`:

- `inputs/SPEC-017-search.md` — the current spec file
- `inputs/review_comments.json` — the review comments (structured data representing what would be fetched from GitHub), with timestamps and authorship

## Output Specification

Produce the following files in your working directory:

1. `SPEC-017-search-revised.md` — the updated spec with all appropriate changes applied
2. `revision_plan.md` — for each comment: the comment ID, classification, action taken, and reasoning
3. `pr_comment_summary.md` — the full text of the top-level PR comment that would be posted, in the format used by the revise-spec workflow
4. `per_comment_replies.md` — the reply text for each individual comment
5. `commit_message.txt` — the exact commit message that would be used when pushing this revision

Work only from the files in `inputs/`. Treat the `review_comments.json` as the authoritative source of all feedback.
