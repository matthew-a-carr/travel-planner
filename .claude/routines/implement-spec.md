# Routine: `implement-spec`

> The cloud-side prompt is a thin shell pointing here.

## Trigger

GitHub: `PR merged` with filter `Labels is one of: claude:implement`.

Fires when a spec PR is merged into `main` with the `claude:implement`
label applied. That label is Matt's "approve and execute" signal.

## What to do

1. Resolve `$MERGED_PR_NUMBER` and `$REPO` from the event.
2. Invoke the `implement-spec` skill at
   `.agents/skills/implement-spec/SKILL.md` end-to-end.
3. The skill will:
   - Resolve the SPEC file path from the merged PR.
   - Re-run `review-spec` as a final gate (block if Critical findings).
   - Apply `apply-principles` against the SPEC.
   - Create a `claude/impl-NNN-<slug>` branch from `main` (post-merge,
     so it includes the SPEC).
   - Implement the SPEC's Implementation Order using TDD per
     CONSTITUTION §3 — write tests first, minimum code to pass, commit
     each step with a Conventional Commit message.
   - Append observations to `docs/implementation-notes/SPEC-NNN-<slug>.md`
     as they happen (don't context-switch into the spec mid-flight).
   - Run the full verification suite:
     `pnpm lint && pnpm db:check:migrations && pnpm type-check && pnpm
     test:unit && pnpm test:integration && pnpm build` (with the dummy
     `POSTGRES_URL` per ADR 010).
   - Retry verification up to 3 times. If still failing, block (claude:blocked
     + DM with the failure output + one-line root-cause guess).
   - Triage the notes file at close-out → deviations table /
     post-impl notes / `docs/tech-debt.md` / discarded.
   - Update spec status to `Complete`, populate deviations,
     `CHANGELOG.md`, parent epic's slice table (if any).
   - Push the branch and open the impl PR with label `claude:done`.

## Mobile slices

Routines never run Metro or iOS Simulator. They run unit + component tests
(`pnpm test:mobile`) and lint + type-check only. Maestro and the iOS
Simulator gate happen in CI's `mobile-e2e` job (ADR 055). Physical-iPhone
Expo Go validation is a manual step Matt performs before merging.

The impl PR body should explicitly call out: "Mobile manual gate: scan
Expo Go QR code on your iPhone and run through the demo script before
merging."

## Tools

- Local: `git`, `pnpm` (via `.claude/hooks/session-start.sh` bootstrap),
  Docker (for Testcontainers).
- Remote: `mcp__github__*` (no `gh` CLI).
- Blockers: `mcp__claude_ai_Slack__slack_send_message` to
  `$SLACK_NOTIFY_USER`.

## When to block

- Verification fails after 3 attempts.
- `review-spec` returns Needs revision / Blocked (SPEC went stale between
  merge and routine fire).
- The implementation needs a design decision the SPEC didn't anticipate
  and the §Open Questions process should have caught.

Block by: apply `claude:blocked` to the impl PR (open it as draft if not
yet open) + comment with the verification output + Slack DM.

## Reference

- Skill: [`.agents/skills/implement-spec/SKILL.md`](../../.agents/skills/implement-spec/SKILL.md)
- ADR: [`docs/decisions/056-...`](../../docs/decisions/057-autonomous-workflow-and-remote-execution.md)
