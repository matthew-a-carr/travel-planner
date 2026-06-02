# Finalize the Payments Package Addition

## Problem/Feature Description

A developer on the platform team has scaffolded a new `packages/payments` sub-package in the monorepo. The package includes its own `AGENTS.md` file that maps source paths to docs. The changes are staged and ready to review.

Before this work gets merged, the team lead wants a doc-sync pass to ensure the new package follows all project conventions and that no documentation is left in an inconsistent state. The root `AGENTS.md` at the repo root explains the project's doc-review conventions — you should use it as your guide for what to check.

The repository is located in the current working directory (`inputs/`). Run your work from there.

## Output Specification

Produce a file called `doc-sync-report.md` in the current working directory summarizing what was checked and what actions were taken. The report should make clear which files were verified, which actions were performed, and any remaining issues.

Do not modify any source code files — only documentation and necessary structural files.
