# ADR 062: Visa Extraction via a Subscription-Auth Agent-SDK/Codex Skill, Ingested at Deploy

**Date:** 2026-06-20
**Status:** Accepted

## Context

ADR 061 set the boundary: visa **evaluation** is deterministic; **data
acquisition** is AI-assisted, frozen, and human-reviewed. SPEC-015 implemented
acquisition as a Vercel-AI-Gateway job (`generateObject` + Zod) that wrote a
generated TypeScript seed file, ingested via `pnpm db:seed`. That path needs a
metered `AI_GATEWAY_API_KEY` and was never run.

The operator wants to run extraction themselves, on a schedule, using their
**Claude subscription or OpenAI Codex** (not a metered key), with the output
ingested into Postgres automatically on deploy. This ADR records the resulting
mechanism change. ADR 061's determinism/human-review boundary is unchanged.

## Decision

1. **Subscription-auth, provider-agnostic extraction.** A triggerable script
   (`pnpm visa:extract`) researches policy per (nationality → destination) via
   either the **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`, auth via
   `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token`) or the **OpenAI Codex
   CLI** (`codex exec --output-schema`, auth via `codex login`). It is packaged
   as the local skill `extract-visa-rules`. No Vercel AI Gateway, no
   `ANTHROPIC_API_KEY` required.

2. **One Zod schema is the contract ("pydantic for AI").** `visaRuleExtractionSchema`
   generates `visa-rule.schema.json` (`z.toJSONSchema`), consumed by both runners'
   native structured output. Rows are Zod-re-validated on ingest
   (`visaRuleSeedSchema`) — defense-in-depth. A CI drift gate (`visa:schema:check`)
   keeps the JSON Schema in lock-step with the Zod source.

3. **JSON artifacts are the frozen, human-reviewed record.** One committed
   `VisaRuleSeed[]` file per pair under
   `src/infrastructure/db/seed/visa-rules-data/<NAT>/<DEST>.json`. The PR diff
   review **is** the factual-accuracy gate (`source: 'ai-extracted'`; a reviewer
   promotes verified rows to `'manual'`).

4. **Ingestion happens at deploy.** `ingestVisaData()` loads the zone/manual seeds
   plus every artifact, validates, and idempotently upserts. It runs after schema
   migrations in `db:migrate:deploy` (and locally in `db:migrate` / `db:seed`),
   so merged artifacts reach production without a separate manual step.

## Consequences

- **Easier:** extraction uses included subscription credits; the data pipeline is
  provider-agnostic and reviewable as plain JSON diffs; production data is
  refreshed by merging an artifact PR; the runtime still does no AI.
- **Harder / accepted:** the extraction runners are dev tooling not exercised by
  CI, so an SDK/CLI output-shape change is caught by the operator at run time, not
  by tests. Factual accuracy remains a human-review gate, not a test.
- **Supersedes (in part) ADR 061's mechanism:** the generated-TS-seed +
  gateway-`generateObject` acquisition path (`GatewayVisaRuleExtractor`,
  `visa-rule-ai-seed.ts`, `pnpm visa:fetch`) is removed. ADR 061's *boundary*
  stands.
- **New dependency:** `@anthropic-ai/claude-agent-sdk` (apps/web devDependency);
  the Codex CLI is an external, optional tool. New operator env var
  `CLAUDE_CODE_OAUTH_TOKEN`.
