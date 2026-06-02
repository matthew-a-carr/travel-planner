---
name: babysit-pr
description: >
  Drive a PR to merge: address review comments (human + Copilot), push fixes,
  wait for CI to go green, then squash-merge. Use when a human says "babysit PR
  #NNN", "address the comments and merge when green", or "get this PR landed".
  Pushes and merges — invoking it IS the authorization to do so. Refuses to
  merge on red CI, unresolved blocking reviews, or conflicts; escalates instead.
---

# Babysit a PR to Merge

## When to use

Use when the user wants a PR carried the last mile: comments addressed, CI
green, merged — without them babysitting it themselves. The invocation is the
standing authorization to push to the PR branch and merge it (overriding the
default "only push/merge when asked" rule for *this* PR).

This skill composes with the others: `review-implementation` / `code-review`
*find* issues; `babysit-pr` *resolves* them and lands the PR. For Dependabot
PRs, triage with `triage-dependabot` first — don't babysit a PR that touches a
version-locked family.

## Tool conventions

- **Local**: `git` for branch ops + commits, `pnpm` for verification.
- **Remote GitHub**: `mcp__github__*` (read PR, comments, checks, reply, merge).
  Prefer these over `gh` for parity with the autonomous skills.
- This skill **does not** override branch protection. If required checks fail or
  a review requests changes, it stops — it never merges with `--admin`.

## Step 1 — Resolve the PR and its state

1. Resolve the PR (number given, or "the PR for this branch" via
   `mcp__github__list_pull_requests` on the current branch). Read it with
   `mcp__github__pull_request_read`: head branch, mergeable state, required
   checks, reviews, and **all** comment threads (top-level review comments,
   inline diff comments, and Copilot comments).
2. Check out the head branch locally and pull latest.

## Step 2 — Triage every comment (don't blindly apply)

3. For each unresolved comment, decide: **accept** (it's right — apply it) or
   **reject** (it's wrong, out of scope, or based on a misread — push back).
   Rule 6: don't average conflicting feedback into a mushy hybrid; pick, and
   explain. Copilot comments especially are suggestions, not gospel — evaluate
   each (this is the `dev-skills:gh-copilot-address-pr` discipline).
4. Keep accepted changes **surgical** (Rule 3): change only what the comment
   calls for. If a comment requests something that would violate the
   constitution or an ADR, reject it and say why — the rules win over a review
   nit.

## Step 3 — Apply, verify, push

5. Make the accepted changes. Follow TDD where behaviour changes (CONSTITUTION
   §3) — a fix for a bug a reviewer caught gets a test that reproduces it first.
6. Run the verification subset for what you touched (AGENTS.md "what to run"
   table); when in doubt run the full gate:
   `pnpm lint && pnpm db:check:migrations && pnpm type-check && pnpm test:unit
   && pnpm test:integration`. If a wire schema / `/api/v1/*` shape changed, run
   `pnpm openapi:check` (regenerate if needed). Never push a failing local gate.
7. Commit with a Conventional Commit message and `git push` to the PR branch.
8. Reply to each thread via `mcp__github__*`: on accepted comments, say what
   changed (and resolve the thread if appropriate); on rejected comments, post
   the reasoning. Do not silently ignore a comment — every thread gets a
   response (Rule 9).

## Step 4 — Wait for green

9. Poll the PR's check runs (`mcp__github__pull_request_read` / status) until
   every **required** check concludes. To pace the wait in an interactive
   session, use the `/loop` skill or a short `ScheduleWakeup`; don't busy-wait.
10. If a check **fails**: read its logs, reproduce locally, fix (with a test),
    push, and return to step 9. Bound this to **3 fix attempts** — if still red
    after 3, stop and escalate (Step 6).
11. **Known-flaky judgement:** `mobile-e2e` red on a dependency or unrelated PR
    is often the TD-009 mechanism (stale native cache / Expo lockstep), not your
    change. Re-run the job once (it already retries 3×) before treating it as a
    real failure — but never dismiss a red check that your diff plausibly caused.

## Step 5 — Merge

12. Merge **only when all of**: required checks green, no review requesting
    changes (approvals satisfied if required), no merge conflict, branch up to
    date with base. Merge via `mcp__github__merge_pull_request` with
    **squash**, a Conventional Commit title (release-please consumes these for
    the changelog/version), and delete the head branch.
13. If the PR carries a `claude:*` lifecycle label or closes an issue/SPEC,
    confirm the linkage resolved (e.g. an impl PR's merge completes the SPEC
    lifecycle per `implement-spec`). Report the merge commit + what landed.

## Step 6 — Escalate instead of forcing

Stop and report (do **not** merge) when:
- CI is still red after 3 fix attempts, or red for a reason you can't diagnose.
- A review requests changes you've rejected and the disagreement is genuine —
  that's the human's call.
- There's a merge conflict you can't resolve safely, or the change needed
  exceeds the PR's scope (it wants a new SPEC / ADR).

Escalation: post a comment summarising the blocker (one line problem, one line
proposed path) and, in a routine context, apply `claude:blocked` + DM
`$SLACK_NOTIFY_USER`. A loud stop beats a forced merge.

## Do not

- Do **not** merge on red, with `--admin`, or over an unresolved "changes
  requested" review.
- Do **not** apply every comment uncritically — reject wrong ones with reasons.
- Do **not** push `--no-verify` or `.skip` a failing test to get green.
- Do **not** expand scope beyond addressing the comments + landing the PR.
