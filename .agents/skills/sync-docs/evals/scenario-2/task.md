# Sync Docs After Architecture Decision Update

## Problem/Feature Description

The engineering team has been discussing a shift in how internal services communicate. A new Architecture Decision Record has been staged for commit, capturing the decision to adopt GraphQL for service-to-service calls. The author staged the ADR file but hasn't had time to handle the surrounding documentation bookkeeping before handing off to you.

The `AGENTS.md` at the project root outlines which supporting docs need attention when decision records change. The team wants you to run a doc-sync sweep over the staged changes, apply any needed updates, and produce a summary of what was done.

The repository is in the current working directory (`inputs/`). Run all commands from there.

## Output Specification

Produce a file called `doc-sync-report.md` in the current working directory describing:

- What changed paths were detected
- Which docs were checked as a result
- What updates were made (or confirmed clean)
- Any items left unresolved

Do not modify source code files.
