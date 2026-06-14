# Autonomous workflow — operations runbook

> Per [ADR 057](../decisions/057-autonomous-workflow-and-remote-execution.md).
> All routines run on Claude Code Web (claude.ai/code) — no local execution.

This runbook is the one-time setup Matt follows to wire up the autonomous loop.
Once configured, the loop runs on its own: open a GitHub issue, get a SPEC PR,
review, merge, get an implementation PR. Slack DMs only when a routine is
genuinely stuck.

## Prerequisites

1. Claude Code Web access on a paid plan (Pro, Max, Team, or Enterprise).
2. Routines enabled at the org level (Team/Enterprise admins: see
   [claude.ai/admin-settings/claude-code](https://claude.ai/admin-settings/claude-code)).
3. The **Claude GitHub App** installed on `matthew-a-carr/travel-planner`.
   The routine creation flow prompts for this on first GitHub-trigger setup.
   Installing the app also exposes the `mcp__github__*` MCP tools to routine
   sessions — the skills rely on those (not the `gh` CLI, which has known
   auth issues in scheduled routines — see anthropics/claude-code#42743).
4. Slack MCP connector connected on the operator's `claude.ai` account
   (Settings → Connectors → Slack). Routines DM the recipient configured via
   the `SLACK_NOTIFY_USER` environment variable (set per-routine — see
   "Routine environment variables" below) using
   `mcp__claude_ai_Slack__slack_send_message`.
5. GitHub auth on the cloud session — run `/web-setup` in any Claude Code Web
   session to grant repo-clone access.
6. Two plugins must be enabled on Matt's `claude.ai` account (routines
   inherit user-level `enabledPlugins`):

   **Migrate `~/.claude/settings.json`** if it still has the old structure
   (`principles@engineering-principles`, `matthew-a-carr@matthew-a-carr-skills`).
   Replace those entries with:

   ```jsonc
   {
     "enabledPlugins": {
       "engineering-principles@matthew-a-carr": true,
       "dev-skills@matthew-a-carr": true
     },
     "extraKnownMarketplaces": {
       "matthew-a-carr": {
         "source": {
           "source": "github",
           "repo": "matthew-a-carr/claude-plugins"
         }
       }
     }
   }
   ```

   The repo-level `.claude/settings.json` already pins the same plugins as
   a safety net, but the user-level pin is what cloud routines actually use.

   What each plugin provides:
   - `engineering-principles@matthew-a-carr` — constitution, cloud-native,
     tech-stack, behavioural-rules, `apply-principles`, and
     `architecture-review`.
   - `dev-skills@matthew-a-carr` — TDD, handoff, grilling, GitHub PR
     helpers, CLI design.

   If a routine session reports "skill not found: apply-principles", the
   plugins didn't load — confirm both are in `enabledPlugins` and the
   marketplace is in `extraKnownMarketplaces`. Skills degrade gracefully
   without the plugin (they continue without principle citations) but log
   a warning in the PR body so it's visible.

## Step 0 — Smoke-test before pointing routines at production labels

The routines are non-trivial to debug after the fact because each run is a
short-lived cloud session. The cheap way to catch config mistakes is to
verify ONE routine works against a throwaway label before wiring all six
against the real labels.

```bash
gh label create "ai:test-routine" --color "ededed" --description "Throwaway label for smoke-testing the autonomous loop"
```

Configure exactly one routine — pick `draft-spec` — with trigger `Issue
opened` + `Labels is one of` → `ai:test-routine` instead of `ai:plan`.
Set the `SLACK_NOTIFY_USER` env var. Save.

Open a test issue:

```bash
gh issue create --title "smoke-test: please ignore" --label ai:test-routine --body "Throwaway issue to verify the routine fires, the plugin loads, and the Slack DM reaches me. Routine should comment on this issue then bail."
```

Then, within a minute or two, check `claude.ai/code/routines` → the routine's
"Past runs" tab. Click the run. Look for:

1. **Session started** — the routine fires at all.
2. **Plugin loaded** — search the transcript for `apply-principles` being
   invoked successfully (not "skill not found").
3. **GitHub MCP works** — `mcp__github__issue_read` returns the issue body.
4. **Slack reaches you** — the routine sends a test DM via
   `mcp__claude_ai_Slack__slack_send_message` to `$SLACK_NOTIFY_USER`.

If any of those fail, fix the gap (re-check user-level `~/.claude/settings.json`,
confirm Claude GitHub App installed, confirm Slack connector active) before
configuring the other five routines. Then close the smoke-test issue,
delete the `ai:test-routine` label, and re-point the `draft-spec`
trigger at `ai:plan`.

## Labels — create these once

```bash
gh label create "ai:plan"        --color "1d76db" --description "Fires draft-spec routine on issue open"
gh label create "ai:plan-epic"   --color "0e8a16" --description "Fires draft-epic routine on issue open"
gh label create "ai:planned"     --color "c5def5" --description "Set by draft-spec/draft-epic after PR opens — prevents re-drafting"
gh label create "ai:revise"      --color "fbca04" --description "Applied to spec PRs awaiting human review"
gh label create "ai:revise-now"  --color "d93f0b" --description "Apply to fire revise-spec routine on the PR"
gh label create "ai:implement"   --color "0e8a16" --description "Apply to spec PR before merging — fires implement-spec on merge"
gh label create "ai:blocked"     --color "b60205" --description "Routine couldn't proceed; needs human input"
gh label create "ai:done"        --color "5319e7" --description "Applied by implement-spec when impl PR is ready for review"
```

Run these from a checkout of `travel-planner` with `gh auth login` complete.

## Routine environment variables

Each routine needs these env vars set in its **Environment** config (the
cloud icon below the prompt box → settings → Environment variables). They
hold the per-operator notification target without committing sensitive
identifiers to the public repo.

| Variable | Value | What it does |
|---|---|---|
| `SLACK_NOTIFY_USER` | Your Slack user ID (e.g. `U01ABC2DEF3`) — get it from your Slack profile → "More" → "Copy member ID" | Skills DM this user on blockers. Look up via `mcp__claude_ai_Slack__slack_search_users` then `mcp__claude_ai_Slack__slack_send_message`. |
| `NOTIFY_REPO` | `matthew-a-carr/travel-planner` | The owning repo for any "open issue / comment on PR" calls. Matches the repositories list. |

The skills reference these by name. Replace the value if a different
operator wires up their own copy of the routines — there's no other
operator-specific config baked into the skill files.

## Routines

You need **six routines**. Each follows the same shape:

- **Repositories**: add the travel-planner repo. Leave "Allow unrestricted
  branch pushes" **off** — routines push to `claude/*` branches only.
- **Connectors**: keep GitHub. Keep Slack. Remove everything else.
- **Environment variables**: `SLACK_NOTIFY_USER`, `NOTIFY_REPO` (see above).
- **Prompt**: a thin shell that points at the canonical prompt file in this
  repo (see "The thin-shell prompt pattern" below).
- **Trigger**: per-routine, listed below.

### The thin-shell prompt pattern

Each routine's cloud-side prompt is **one paragraph** that says "read the
file at `.claude/routines/<name>.md` in the cloned repo and execute it."
This keeps the source of truth in the repo where it can be reviewed and
versioned. Paste this verbatim into each routine's prompt box, substituting
the routine name:

```text
You are running the `<NAME>` routine for matthew-a-carr/travel-planner. The
canonical behaviour for this routine lives at .claude/routines/<NAME>.md in
the cloned repo. Read that file from the default branch end-to-end before
doing anything else, then execute the steps it describes.

The file tells you what to do, which tools to use (mcp__github__* — not the
gh CLI — and mcp__claude_ai_Slack__slack_send_message for blockers), and
when to escalate. Treat the file as authoritative; if anything in this
prompt conflicts with the file, the file wins.

Triggering event payload is available to you — extract ISSUE_NUMBER /
PR_NUMBER / REPO as relevant. The environment variables SLACK_NOTIFY_USER
and NOTIFY_REPO are set on this routine.
```

### The six routines

| # | Name | Trigger | Canonical prompt file |
|---|---|---|---|
| 1 | `draft-spec` | GitHub: `Issue opened` + filter `Labels is one of: ai:plan` | [`.claude/routines/draft-spec.md`](../../.claude/routines/draft-spec.md) |
| 2 | `draft-epic` | GitHub: `Issue opened` + filter `Labels is one of: ai:plan-epic` | [`.claude/routines/draft-epic.md`](../../.claude/routines/draft-epic.md) |
| 3 | `revise-spec` | GitHub: `Custom` event `pull_request.labeled` + filter `Labels is one of: ai:revise-now` | [`.claude/routines/revise-spec.md`](../../.claude/routines/revise-spec.md) |
| 4 | `implement-spec` | GitHub: `PR merged` + filter `Labels is one of: ai:implement` | [`.claude/routines/implement-spec.md`](../../.claude/routines/implement-spec.md) |
| 5 | `daily-digest` | Schedule: `0 17 * * *` (17:00 UTC) | [`.claude/routines/daily-digest.md`](../../.claude/routines/daily-digest.md) |
| 6 | `weekly-tech-debt` | Schedule: `0 17 * * 0` (Sun 17:00 UTC) | [`.claude/routines/weekly-tech-debt.md`](../../.claude/routines/weekly-tech-debt.md) |

For each: open `claude.ai/code/routines` → New routine → paste the
thin-shell prompt (substituting the routine name) → set the trigger from
the table → set env vars → save.

### Why thin-shell instead of inline prompts

The full prompt for a routine is dozens of lines. Inline-pasting it into
the cloud means:

- Edits to the prompt have no review trail.
- Prompts drift from the skill files they invoke.
- A new operator has to copy six prompts by hand.

With the thin-shell pattern, edits go through PR review like any other
code change, and a new operator clones the repo to get the prompts. The
only thing in the cloud is the trigger, env vars, and the one-paragraph
shell.

## Bootstrap — mobile feature parity

Once the six routines above are configured, kick off the first epic:

```bash
gh issue create --title "epic: mobile feature parity with web" --label "ai:plan-epic" --body-file - <<'EOF'
**Vision:** the mobile app reaches feature parity with the web app for everything currently shipped to authenticated users.

**Definition of done:**
- A signed-in user on iOS Expo Go can do everything a signed-in user on web can do, with feature parity verified by a per-screen demo script.
- Maestro flows cover the golden path of each feature.

**Scope:**
- In scope: trip CRUD, trip listing, trip overview, fixed costs, timeline, country reference, conversational assistant, narrative, AI-assisted trip creation, organisation management.
- Out of scope: web-specific admin tooling, infra dashboards.

**Kill criteria:**
- If the partner-device demo loop reveals that Expo Go is fundamentally too constrained for two of the features, kill the no-TestFlight constraint and re-plan as EPIC-003 with TestFlight.
- If three slices in a row regress the mobile-e2e job for more than a week, pause and re-evaluate.

**Strategic ADR:** ADR-045 (iOS App Strategy) — the underlying direction.

**Cross-cutting decisions (inherit per slice):**
- Auth: bearer tokens via /api/v1/auth/mobile (ADR-051, SPEC-002).
- API surface: /api/v1/* only (ADR-050).
- Packaging: Expo Go (ADR-045 / ADR-052 / ADR-053). TestFlight deferred.
- Shared types: @travel-planner/shared (SPEC-005).
- Mobile e2e: Maestro via expo prebuild + xcodebuild on CI macOS runner (ADR-055).

**Rough slice list:**
1. Trip list + view trip overview (read-only).
2. Trip CRUD (create, edit, delete).
3. Fixed costs UI.
4. Timeline view.
5. Country reference + suggestions.
6. Conversational assistant.
7. Narrative on overview.
8. AI-assisted trip creation.
9. Organisation management (member list + assignment).

The draft-epic routine will refine this into a proper slice ledger.
EOF
```

Once the epic PR is merged, file one `ai:plan` issue per slice (or ask the
`draft-epic` routine to do it for you in a follow-up).

## Notification contract — what Matt sees

| When | Notification | Where |
|---|---|---|
| Routine drafted a SPEC PR | none | (visible in GH PR list) |
| Routine revised a SPEC PR | none | (visible on the PR) |
| Routine opened an impl PR | none | (visible in GH PR list) |
| Routine blocked | Slack DM | `$SLACK_NOTIFY_USER` — one-line problem + link |
| Daily 17:00 UTC | Slack DM | only if anything to report (blockers, reviews, merges) |
| CI failed on a routine-opened PR | none from Claude | GH email notification handles this |

The absence of a Slack DM during the day means the routines are flowing.

## Troubleshooting

### A routine fires but the session fails

Open the session URL from claude.ai/code/routines → past runs. The transcript
shows what happened. Common causes:

- Network access blocked a host the skill needed. Edit the environment to
  allow it, or use a connector.
- `engineering-principles@matthew-a-carr` not loaded — usually means
  the marketplace fetch was rate-limited. Re-run.
- GitHub permissions: the routine pushed to a non-`claude/*` branch. Either
  rename the branch in the skill or enable "Allow unrestricted branch
  pushes" for `claude/spec-*` patterns.

### A trigger doesn't fire

- Confirm the Claude GitHub App is installed on the repo (Settings → GitHub
  Apps).
- Confirm the label is exactly one of the values created above (case
  sensitive).
- The routine's per-account hourly cap may have throttled the event. Check
  claude.ai/code/routines for the current cap.

### A routine ran but didn't open a PR

Check the session transcript — the skill may have classified the run as
blocked and Slack DM'd Matt without writing files. The DM contains the
specific reason.

### How to disable a routine temporarily

claude.ai/code/routines → click the routine → toggle **Repeats** off (paused
state). Configuration is retained; flip it back on later.

## Local-dev sanity (the rare case where you do open a terminal)

The autonomous loop is the default. But you can always:

- Run a skill manually from a Claude Code session: open this repo, ask
  "draft a spec from issue #NNN" — same skill, interactive entry point.
- Watch a live routine run: open the session URL from
  `claude.ai/code/routines`. You can pause it and continue the conversation
  manually if you spot something the routine should do differently.

## Changing routine prompts

Routine prompts live in the cloud, not in this repo. If a prompt needs
updating, edit it at claude.ai/code/routines. Reference this runbook for the
canonical version of each prompt, and keep this file in sync when you edit a
prompt in the UI — drift between the two is the most likely source of
confusion six months from now.
