# Implementation Notes — SPEC-019: Visa Extraction Skill + Deploy Ingestion

**Spec:** [SPEC-019-visa-extraction-skill](../specs/SPEC-019-visa-extraction-skill.md)
**Started:** 2026-06-20

## Entries

### 2026-06-20 — Confirmed the Agent SDK API against installed types

**Step:** §7 runners
**Type:** decision
**Note:** Installed `@anthropic-ai/claude-agent-sdk@^0.3.183` and inspected
`sdk.d.ts`: `query({ prompt, options })` → `AsyncGenerator<SDKMessage>`; options
take `outputFormat: { type: 'json_schema', schema }`, `systemPrompt`,
`allowedTools`, `permissionMode`, `maxTurns`; the `result` message carries
`structured_output` (success) or `subtype: 'error_max_structured_output_retries'`.
Subscription auth via `CLAUDE_CODE_OAUTH_TOKEN`. Pinned the runner to this.

### 2026-06-20 — Ingestion wired into db:migrate, not only deploy

**Step:** §7 ingestion
**Type:** deviation
**Note:** Per the plan, `ingestVisaData` runs in `migrate-deploy.ts` (deploy),
`migrate.ts` (local) and `seed.ts`. So `pnpm db:migrate` now also seeds visa
data (idempotent). Logged as spec deviation #1.

### 2026-06-20 — Runners are dev-only; CI never runs AI

**Step:** §9 verification
**Type:** decision
**Note:** `scripts/visa-extraction/*` + `extract-visa-rules.ts` are never imported
by the app or tests, so CI stays AI-free and green without any subscription
token. The drift gate `visa:schema:check` is added to the CI lint job. The new
`ingest-visa-rules.int-test.ts` is CI-gated (Docker). Locally verified: lint,
type-check, unit (491), build, `db:check:migrations`, `visa:schema:check`.

## Close-out triage summary

| Entry | Landed in |
|-------|-----------|
| 1 | Post-impl note |
| 2 | Spec deviation #1 |
| 3 | Post-impl note + PR body |
