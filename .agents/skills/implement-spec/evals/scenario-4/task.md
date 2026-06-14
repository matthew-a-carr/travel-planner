# Plan a Spec Implementation Pre-flight Checklist and Escalation Protocol

## Problem/Feature Description

A new team is adopting a spec-centric development workflow. They want to document the exact pre-flight procedure that should be followed before any code is written for a spec implementation. This includes how the implementation branch should be named, what checks must pass before starting, how to handle the case where the spec review comes back with different verdicts, and the complete escalation protocol for when work can't proceed.

The team has heard that the pre-flight step includes invoking a spec review as a gate, but they need clarity on: what happens when it returns different verdicts (blocked vs. warnings), which GitHub operations use which tools (and what tools are explicitly off-limits), and how to handle a situation where the spec review finds a problem after the PR for the spec has already been merged.

They also want a clear reference for the blocked/escalation scenario: when is `ai:blocked` applied, to which artifact, what must the comment contain, and who gets notified and how.

## Output Specification

Produce the following files:

- `pre-flight-checklist.md` — a structured checklist document covering the complete pre-flight procedure. It should include: how to resolve the spec from the merged PR, the spec review gate (and what each verdict means for whether to proceed), which standards documents to read, the branch naming convention, the implementation notes file setup, and how the engineering-principles plugin is handled when it's unavailable.

- `escalation-protocol.md` — a reference document for the blocked/escalation scenario. It must specify: which label to apply and via which tool, to which artifact (impl PR vs spec PR, and when), what the PR comment must contain (problem, resolution, link), who receives the Slack DM and via which tool and channel, and the rule about partial-state branches.

- `tool-conventions.md` — a short reference documenting the tool choices: which tool for local git operations, which tool for package management, which tool for remote GitHub operations (and what is explicitly NOT used), and which tool for blocker notifications.
