---
name: extract-visa-rules
description: >
  Extract visa-policy rules for (nationality → destination) pairs into committed,
  schema-validated JSON artifacts, using a Claude subscription (Claude Agent SDK)
  or OpenAI Codex — not a metered gateway key. Use when broadening visa data
  coverage (EPIC-005 slice 5), when a human says "run the visa extraction" /
  "fetch visa rules for X", or on a schedule. Produces a reviewable PR; the diff
  review is the factual-accuracy gate. Never runs at request time. SPEC-019 / ADR 062.
---

# Extract Visa Rules

Offline, human-gated data-acquisition for the deterministic visa evaluator. The
runtime app does **no** AI; this skill freezes researched policy into committed
JSON that is ingested into Postgres at deploy time.

## When to use

- Broadening visa coverage beyond the hand-authored seed (the long tail
  currently shows "No visa data yet").
- A scheduled/triggered refresh of existing destinations.
- A human asks to run/refresh the extraction.

Do **not** use it to change the schema or the evaluator — those are SPEC-015's
domain.

## Prerequisites (auth — your subscription)

Pick one runner:

- **Claude Agent SDK** (`--runner=claude`, default): run `claude setup-token`
  once and export the result:
  `export CLAUDE_CODE_OAUTH_TOKEN=…` (subscription credits; no `ANTHROPIC_API_KEY`).
- **Codex** (`--runner=codex`): `codex login` (ChatGPT subscription). The CLI
  must be on `PATH`.

The shared output contract is `apps/web/visa-rule.schema.json` (generated from
the Zod `visaRuleExtractionSchema` via `pnpm visa:schema`). Both runners enforce
it; ingestion re-validates with Zod.

## Steps

1. Ensure the schema is current: `pnpm visa:schema` (commit if it changed).
2. Run the extraction for the target destinations (ISO alpha-3):
   ```bash
   # default nationality GBR; default runner claude
   pnpm visa:extract --runner=claude JPN VNM THA AUS NZL CAN SGP
   # or via Codex
   pnpm visa:extract --runner=codex --nationality=GBR AUS NZL
   ```
   Each pair writes `src/infrastructure/db/seed/visa-rules-data/<NAT>/<DEST>.json`
   (a `VisaRuleSeed[]`), schema-validated, with cross-field sanity warnings
   printed for anything suspicious.
3. **Review the JSON diff** — this is the accuracy gate. Check each rule against
   the cited `sourceNote` (gov.uk / official guidance). Fix or delete anything
   wrong. Address every sanity warning.
4. Open a PR with the new/changed artifacts. Conventional Commit
   `feat(visa-data): …` or `chore(visa-data): …`.
5. On merge + deploy, `ingestVisaData()` upserts the rows idempotently (no manual
   ingest step). Verify the Visas panel shows real coverage for the new
   destinations.

## Guardrails

- Never run at request time / in CI — offline only.
- Never bypass the diff review; AI-extracted facts are untrusted until a human
  confirms them against the source.
- Keep `source: 'ai-extracted'`; promote to `'manual'` (in `visa-rule-seed.ts`)
  only after independent verification.
- If a runner's output can't be schema-validated, fix the prompt/schema — do not
  hand-write rows into artifacts to force them through.
