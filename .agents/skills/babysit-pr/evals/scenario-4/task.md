# Write an Automation Script for PR Lifecycle Operations

## Problem/Feature Description

Your team runs a weekly automation that scans all open PRs, reads their current review and CI state, replies to any unanswered comment threads with a status update, and finally merges those that are fully ready. Currently this process is done manually by a developer every Friday afternoon, and the team wants to replace it with a script that an AI agent can execute autonomously.

Write a shell script (or a Node.js script) called `pr_lifecycle.sh` (or `pr_lifecycle.js`) that implements the following four operations for a PR whose number is passed as a command-line argument:

1. **Read the PR state**: Retrieve the PR's current review status, check run results, and all unresolved comment threads.
2. **Reply to unresolved threads**: Post a status message to each unresolved thread saying it has been reviewed and will be addressed.
3. **Wait for checks**: Poll until all required checks are either passing or failed (do not exit early).
4. **Merge the PR**: If all checks are green and no review is requesting changes, merge the PR and clean up the branch.

The script should clearly show which API calls it is making at each step. Include comments in the script explaining what each block of code is doing.

## Output Specification

Produce the script file (`pr_lifecycle.sh` or `pr_lifecycle.js`) in the current working directory. The script does not need to be fully executable in this environment — focus on the correct API surface and structure.
