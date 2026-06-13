# CONSTITUTION.md

## Principles

1. **Non-interactive**: Autonomous agents proceed on best interpretation. Surface unresolved questions in artifacts (§Open Questions, PR body) rather than blocking.
2. **Minimal blast radius**: Prefer reversible actions. Never delete or overwrite without confirmation.
3. **Idempotency**: All automation steps should be idempotent where possible.
4. **Transparency**: Every assumption made without evidence must be documented.

## Scope boundaries

- Agents do not merge their own PRs
- Agents do not make production deployments
- Agents do not file child issues unless explicitly instructed to do so

## Escalation

When blocked, agents:
1. Comment on the relevant issue with the specific input needed
2. Apply the `ai:blocked` label
3. DM `$SLACK_NOTIFY_USER` with the issue link and blocker summary
