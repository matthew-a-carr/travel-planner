# Spec Revision Planning: Blocked and Ambiguous Feedback

## Problem Description

You have been asked to revise spec PR #88, which covers a data retention policy service. The PR branch is `claude/spec-088-retention`. When you attempted to set up the local workspace by checking out the branch and rebasing, the rebase failed with a merge conflict — Matt had made a direct edit to the spec file through the GitHub web interface while the revision was queued.

Additionally, you have already collected the review comments on the PR. After reading them all, you determine that every single comment is ambiguous: they raise concerns but do not clearly request any specific change. There is no concrete action you can take without more information from the reviewers.

Both of these situations require specific handling workflows. Your task is to document exactly what actions you would take in each case, in the correct order, producing the exact artifacts (PR comments, Slack messages, label changes) that the workflow calls for.

## Output Specification

Produce the following files in your working directory:

1. `rebase_conflict_response.md` — the exact text of the PR comment you would post when the rebase conflict is detected, and the ordered list of actions taken (git commands run, labels applied/removed, Slack DM sent)
2. `blocked_response.md` — the exact text of the top-level PR comment you would post for the all-ambiguous-comments scenario, and the ordered list of subsequent actions (labels applied/removed, Slack DM sent), explaining the reasoning for the order
3. `analysis.md` — a brief explanation of why both situations result in a blocked outcome, and why no revision commit should be pushed in either case

Treat these as real operational documents. Do not add caveats about this being a hypothetical scenario.
