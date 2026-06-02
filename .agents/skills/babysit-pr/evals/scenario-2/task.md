# Decide Whether to Merge Three PRs and Document the Reasoning

## Problem/Feature Description

You are responsible for landing a batch of three open pull requests at the end of a sprint. Each one is in a different state: one looks ready, one has an unresolved problem, and one is ambiguous. Before you merge anything, you need to assess each PR against the team's merge criteria and write a decision document — because the final merge buttons will be pressed by an automated process that reads your decision file.

The PR states are described in `inputs/pr_states.json`. For each PR, determine whether it is safe to merge right now, and if so, specify how it should be merged. If it is not safe, state what is blocking it and what needs to happen before it can be merged.

## Output Specification

Produce a file called `merge_decisions.md` with one section per PR containing:

- **PR number and title**
- **Decision**: `merge` or `blocked`
- **If merge**: the merge strategy to use and the exact commit title format
- **If blocked**: the specific blocker and what action would unblock it

Also note for each PR whether the head branch should be deleted after merging.
