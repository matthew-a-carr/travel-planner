# ADR 057: Autonomous Workflow and Remote-Only Execution

**Date:** 2026-05-23
**Status:** Accepted
**Supersedes:** [ADR 048 — Grilling Step and Rolling Implementation Notes](./048-grilling-and-implementation-notes.md) (grilling step only — the rolling implementation notes mechanism is retained)
**Amends:** [ADR 047 — Specification-Driven AI Development Lifecycle](./047-specification-driven-ai-development-lifecycle.md), [ADR 049 — Epic Tier for Multi-SPEC Initiatives](./049-epic-tier-for-multi-spec-initiatives.md)

## Context

ADRs 047, 048, and 049 established a spec-driven lifecycle whose primary
interface was an **interactive** Claude Code session: the human invokes
`grill-me`, then `plan-feature`, then `implement-spec`, with each step blocking
on conversational back-and-forth.

That interactive model has two limitations now that the project is multi-SPEC
deep:

1. **The human is the scheduler.** Nothing happens unless Matt opens a session
   and types `plan-feature for X`. With multiple SPECs queued (the EPIC-002
   mobile parity work alone is many slices), this becomes the bottleneck.

2. **Execution is tied to the laptop.** Even when Matt does start a session,
   the work proceeds only while the terminal is open. Closing the lid pauses
   everything.

Claude Code launched **routines** in April 2026 — cloud-hosted, scheduled and
event-driven sessions that run on Anthropic-managed infrastructure regardless
of whether Matt's laptop is open. Routines support three trigger types:
schedule (≥1h interval), API (HTTP POST to `/fire`), and GitHub (native
webhook on PR, release, and issue events — including `Issue opened` with a
`Labels is one of` filter and a `Custom` option for finer-grained events). The
project pins the relevant plugins in its own `.claude/settings.json`
(via the `matthew-a-carr/claude-plugins` marketplace), so the principles
and helper skills auto-load in every routine session and every fresh clone
— independent of any user-level config.

In parallel, Matt's preferred operating mode has shifted to **remote-only**:
all routines and most interactive sessions should run on Claude Code Web
(claude.ai/code) rather than the local Mac. The local Mac stays available for
physical-iPhone Expo Go validation and the occasional manual debug, but is no
longer the assumed execution environment for any automated step.

## Decision

### 1. Replace the interactive lifecycle with an issue-driven autonomous loop

The new flow has five stages, with the human acting only at submission and
review gates:

```
Matt opens issue (labelled ai:plan)
  → routine drafts SPEC, opens spec PR
    → Matt reviews PR (comments / re-labels)
      → routine revises spec, pushes updates
        → Matt merges spec PR + applies ai:implement label
          → routine implements, opens impl PR
            → Matt merges impl PR
```

No step requires Matt to type into a terminal. Feedback flows through GitHub
PR review comments, not interactive interviews.

### 2. Remove the `grill-me`, `plan-feature`, and `plan-epic` skills from this repo

Interactive grilling is replaced by:

- **Issue templates** that prompt the human for the same information grilling
  used to extract, structured as YAML/markdown fields (`.github/ISSUE_TEMPLATE/`).
- **A non-interactive `draft-spec` skill** that reads the issue, applies the
  engineering-principles plugin's `apply-principles` skill, proceeds on best
  interpretation, and lists any unresolved questions in a dedicated §Open
  Questions section of the draft SPEC. The PR review loop is where those
  questions get answered.
- **A non-interactive `revise-spec` skill** that reads PR review comments and
  rewrites the spec accordingly, pushing to the same `claude/spec-NNN-*` branch.

`grill-me` remains available via the user-level
`dev-skills@matthew-a-carr` plugin install (also pinned in this repo's
`.claude/settings.json` so it auto-loads in every routine session) — agents
can still invoke it manually if a session genuinely needs interactive
interrogation. It is just
no longer part of the default lifecycle.

### 3. Triggers

All five routines use **native** Claude Code GitHub triggers — no GH Actions
bridge required.

| Stage | Trigger | Filter |
|---|---|---|
| Plan a feature | `Issue opened` | `Labels is one of` → `ai:plan` |
| Plan an epic | `Issue opened` | `Labels is one of` → `ai:plan-epic` |
| Revise a spec PR | `Custom` (PR labeled) | `Labels is one of` → `ai:revise-now` |
| Implement | `PR merged` | `Labels is one of` → `ai:implement` |
| Daily digest | Schedule (18:00 BST) | — |
| Weekly tech-debt review | Schedule (Sun 18:00 BST) | — |

Matt drives all of this from labels: open an issue with `ai:plan`, the
draft-spec routine fires. Drop review comments on the spec PR, then re-label
it `ai:revise-now`; the revise routine fires. Merge the spec PR with
`ai:implement` applied; the implement routine fires.

API trigger endpoints are reserved as an escape hatch for external systems
(e.g. Sentry alerts kicking a triage routine) but are not part of the default
loop.

### 4. Remote-only execution as a project invariant

All routines and the default interactive flow run on **Claude Code Web**
(claude.ai/code) — Anthropic-managed cloud sessions. The local Mac is reserved
for:

- Physical-iPhone Expo Go validation (Maestro alone can't cover this; only the
  author's iPhone reaches it).
- Manual debugging when a routine flags a blocker and Matt wants to drive the
  session interactively.

Consequences for the codebase:

- The `apps/mobile/` `pnpm dev:mobile` flow is human-only. Routines never run
  Metro or iOS Simulator. CI's `mobile-e2e` job (ADR 055) handles simulator-
  based Maestro flows on macOS runners.
- The repo's `.claude/hooks/session-start.sh` already gates its work on
  `CLAUDE_CODE_REMOTE=true`, which is correct.
- `engineering-principles@matthew-a-carr` and `dev-skills@matthew-a-carr`
  are both pinned in this repo's `.claude/settings.json` via the
  `matthew-a-carr/claude-plugins` marketplace, so routines and fresh clones
  load the same plugin set regardless of who's running them.

### 5. Notification policy: blockers only

Routines DM Matt in Slack **only** when input is genuinely required:

- Ambiguous scope the routine refuses to guess on.
- Implementation loop has failed verification N times (configurable per
  routine; default 3).
- A principle conflict the routine surfaces rather than averages (per
  `behavioural-rules.md` Rule 6).
- A decision implied by the spec that touches data loss, security, or a
  breaking change.

Routine PRs opened, status changes, and successful merges do not trigger
notifications. The daily digest covers progress; the absence of a notification
is the success signal.

## Consequences

**What becomes easier:**

- The "submit and forget" loop matches Matt's actual preferred mode. SPECs
  queue up overnight; impl PRs arrive at his desk by morning.
- Cross-laptop continuity: Matt can submit an issue from his phone, the
  routine handles it, and the PR is reviewable from anywhere.
- Mobile parity becomes a queue of issues rather than a sequence of typing
  sessions. One `ai:plan-epic` issue ("mobile feature parity with web")
  spawns EPIC-002, which spawns one `ai:plan` issue per slice.
- Routine runs are reviewable as full sessions at claude.ai/code/session_XXX
  if Matt wants to inspect what the agent did.

**What becomes harder:**

- One-time setup is non-trivial: routines must be created manually at
  claude.ai/code/routines (the API doesn't currently support programmatic
  routine creation), the Claude GitHub App must be installed on the repo for
  native issue/PR triggers, and Slack MCP must be connected.
  `docs/operations/autonomous-workflow.md` is the runbook.
- Feedback latency on a SPEC is now "label the PR" + routine schedule offset
  (a few minutes), not "Claude answers in the next message." For most
  iterations this is fine; for tight back-and-forth Matt can still open the
  routine's session URL and continue manually.
- The bridge GH Action is a workflow file that lives in this repo and must
  stay in lock-step with the routine setup. Renames or deletions require
  re-pointing the routine.
- Routine usage draws down Matt's daily routine cap. Hourly minimum on
  schedule triggers; per-routine + per-account caps on GitHub webhook events.

**Known races (acceptable):**

- **Numbering collision.** Two issues opened back-to-back fire two
  concurrent `draft-spec` routine sessions. Both read `docs/specs/README.md`
  and pick the same next-free SPEC number. Both PRs open with the same
  ID. The reviewer renames one in PR review. Cost of getting this wrong
  is one rename; cost of preventing it (lockfile, central counter) is
  not worth it. Same applies to ADR numbering.
- **Duplicate draft on slow `ai:planned` apply.** Step 23 of
  `draft-spec` applies `ai:planned` to the source issue *after* the
  PR opens. A second webhook event firing before that apply lands could
  start a second draft. Mitigation: step 23 has been moved *before* heavy
  work where possible (so the label is applied early), but the residual
  race is acceptable because the second draft will collide on branch
  name (`claude/spec-NNN-<slug>`) and fail loud.
- **Label-removal race in `revise-spec`.** The `ai:revise-now` label
  must be removed *only after* the revision is pushed. The skill
  enforces this ordering; reordering would loop.

**Trade-offs:**

- Killing `grill-me` from the default lifecycle is a real loss for genuinely
  ambiguous specs. Mitigation: the `§Open Questions` section of the draft SPEC
  is where ambiguity surfaces, and the PR review loop is where it gets
  answered. If a class of work emerges that grilling materially improved,
  reinstate it as a "draft-spec then optionally hand off to grill-me" branch
  in `draft-spec/SKILL.md`.
- Remote-only execution means every routine run pays the cost of cloning the
  repo + warming the environment. The cached setup script keeps this in the
  seconds range, but it's not free. Routines should be coarse-grained (one
  spec drafted per run, one impl per run) rather than chatty.

## Backwards compatibility

- ADR 047's spec template, deviations table, and tech-debt register are
  unchanged.
- ADR 048's **rolling implementation notes** mechanism is retained. The
  grilling step is what 057 supersedes.
- ADR 049's epic tier is unchanged in structure; only the trigger changes
  (issue with `ai:plan-epic` label instead of "user invokes plan-epic
  skill").
- Existing in-flight SPECs (currently none are in-flight on this branch)
  remain valid. The new flow applies to any SPEC drafted after this ADR
  lands.
