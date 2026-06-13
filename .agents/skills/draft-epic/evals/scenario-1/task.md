# Triage and Handle Incoming Epic Planning Requests

## Problem/Feature Description

Your team uses an automated pipeline that processes GitHub issues labelled `ai:plan-epic` and drafts epics from them. Today, three issues have come in simultaneously, but they need to be handled carefully — not all of them are suitable for epic-level planning.

You have been given three issue files in `inputs/`. Each represents a different GitHub issue that has been tagged `ai:plan-epic`. For each issue, determine whether it qualifies for epic treatment or should be blocked. Produce a `triage-report.md` documenting your decisions.

The rules for qualification are defined in the team's planning process, which you should already know. Evaluate each issue against the standard criteria for what makes a valid epic.

For each of the three issues:
1. State whether you would proceed with drafting, or block and why
2. If blocking, state the exact action you would take (what message to post, what label to apply)
3. If the issue references an ADR (provided in `inputs/`), check its status

Write your analysis to `triage-report.md`.

## Output Specification

- `triage-report.md` — one section per issue with: decision (proceed / block), blocker reason if blocked, and the exact comment text you would post to the issue and the label you would apply
