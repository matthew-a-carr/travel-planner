# SPEC-019: Visa Extraction via Agent-SDK / Codex Skill, Ingested at Deploy

**Date:** 2026-06-20
**Status:** Complete
**Author:** agent (interactive session)
**Approved by:** —
**Parent epic:** [EPIC-005](../epics/EPIC-005-visa-requirements-end-to-end.md) — slice 5

> Re-architects the data-acquisition half of SPEC-015. The deterministic runtime
> evaluator and ADR 061's frozen/human-reviewed boundary are unchanged — only the
> *mechanism* of acquiring and ingesting the data changes. Captured as ADR 062.

---

## 1. Summary

Broad visa coverage is sourced by a **triggerable extraction script** that
researches policy per (nationality → destination) using the operator's **Claude
subscription (Claude Agent SDK) or OpenAI Codex** — not a metered gateway key —
and writes **committed JSON artifacts**, schema-validated. Those artifacts are
**ingested into Postgres at deploy** (idempotent upsert). The runtime still does
no AI; the long tail stops showing "No visa data yet" once artifacts are merged.

## 2. Motivation

SPEC-015's gateway extractor needs `AI_GATEWAY_API_KEY` and has never been run.
The operator wants to run it themselves on a schedule against their own
subscription, with the output ingested automatically on deploy. This unblocks
EPIC-005 slice 5 without a metered key and standardises a reusable, provider-
agnostic extraction skill.

## 3. Acceptance criteria

1. `pnpm visa:schema` regenerates `apps/web/visa-rule.schema.json` from the Zod
   `visaRuleExtractionSchema`; `pnpm visa:schema:check` fails on drift (CI gate).
2. `pnpm visa:extract --runner=claude|codex [--nationality=GBR] <DEST…>` writes
   one `VisaRuleSeed[]` JSON artifact per pair under
   `src/infrastructure/db/seed/visa-rules-data/<NAT>/<DEST>.json`, schema-valid,
   with sanity warnings printed. Claude uses `CLAUDE_CODE_OAUTH_TOKEN`; Codex
   uses `codex login` — no `AI_GATEWAY_API_KEY`.
3. `ingestVisaData(db)` loads zones + manual seed + every artifact, **Zod-validates
   each row**, and upserts idempotently; a malformed artifact throws.
4. Deploy (`db:migrate:deploy`) and local (`db:migrate`, `db:seed`) all run the
   ingestion after schema migrations; re-running does not duplicate rows.
5. The SPEC-015 gateway extractor, port, `visa:fetch` script, and generated TS
   seed are removed; the app and tests stay green.

## 4. Demo script

1. `pnpm visa:schema:check` → "up to date".
2. (Operator) `CLAUDE_CODE_OAUTH_TOKEN=… pnpm visa:extract --runner=claude VNM IND` →
   two artifacts written; review the JSON diff against the cited sources.
3. Merge the artifact PR → deploy → `migrate-deploy` logs "Ingested N visa rule(s)".
4. Open a trip to Vietnam/India → the Visas panel shows real coverage (no longer
   "No visa data yet").

## 5. Out of scope

- **Running the extraction / committing real data** — the operator does that
  (the diff review is the accuracy gate). This SPEC delivers the machinery.
- **Scheduling** — the operator wires the trigger; the script is the entry point.
- Non-UK nationalities beyond what the operator extracts; the evaluator is already
  nationality-generic.

## 6. Prerequisites

- SPEC-015–018 merged. Zod 4 (`z.toJSONSchema`). For *running* extraction:
  `claude setup-token` (Agent SDK) or `codex login` (Codex) — not needed to build
  or to pass CI.

## 7. Design

### Data & domain

No domain change. The shared contract lives in
`src/infrastructure/visa-extraction/extraction-schema.ts`: the Zod
`visaRuleExtractionSchema` (agent output) + `visaRuleSeedSchema` (the stamped,
persisted row, validated on ingest) + the research system prompt.

### Behaviour

- `scripts/generate-visa-schema.ts` (`visa:schema` / `:check`) →
  `apps/web/visa-rule.schema.json` via `z.toJSONSchema(..., { target: 'draft-7' })`.
- `scripts/extract-visa-rules.ts` (`visa:extract`) orchestrates per pair: build
  prompt → run `scripts/visa-extraction/claude-agent-runner.ts`
  (`@anthropic-ai/claude-agent-sdk` `query()` + `outputFormat: json_schema`,
  `CLAUDE_CODE_OAUTH_TOKEN`) or `codex-runner.ts` (`codex exec --json
  --output-schema`) → Zod-validate → `runSanityChecks`
  (`src/infrastructure/visa-extraction/checks.ts`) → stamp → write artifact.
  Dev-only; never imported by the app.
- `src/infrastructure/db/ingest-visa-rules.ts` `ingestVisaData(db)`:
  `loadExtractedVisaRules()` (Zod-validated) + manual seeds → idempotent upsert on
  `uq_visa_rules_nat_dest_purpose_from`. Called by `migrate.ts`,
  `migrate-deploy.ts`, and `seed.ts`.

### Storage & migrations

No schema migration — ingestion is a transactional-safe data step after
migrations. Artifacts live in-repo and are read via `fs` by the tsx scripts at
deploy (present in the build checkout).

### External integrations

`@anthropic-ai/claude-agent-sdk` (apps/web **devDependency**, scripts only) and
the external **Codex CLI** (`child_process`, feature-detected). Auth is the
operator's subscription. No runtime/Vercel AI Gateway use for extraction.

### UI / UX

N/A.

## 8. Security & data considerations

- **Untrusted AI output:** schema-validated (shape) but factual accuracy is gated
  by **human review of the artifact diff** (ADR 061/062), enforced by `sourceNote`
  citations + sanity checks. A malformed artifact fails the deploy loudly.
- **Auth:** subscription tokens (`CLAUDE_CODE_OAUTH_TOKEN`) / `codex login` live
  only in the operator's run environment; never committed; never used at runtime.
- Runtime path adds no new external failure mode (no AI at request time).

## 9. Test plan

### Unit (Vitest)

| Test file | What it covers |
|---|---|
| `visa-extraction/checks.test.ts` | `runSanityChecks` (moved) |
| `db/ingest-visa-rules.test.ts` | `loadExtractedVisaRules`: validates, rejects malformed/non-array, missing dir → [] |

### Integration (Vitest + Testcontainers)

| Test file | What it covers |
|---|---|
| `db/ingest-visa-rules.int-test.ts` | `ingestVisaData` upserts zones + manual rules; idempotent re-run; Australia working-holiday present |

### CI gates

`visa:schema:check` (drift) added to the CI lint job.

### Manual (operator-run, out of band)

`visa:extract` both runner paths; review the artifact JSON diff before merge.

## 10. Observability

Migrate/seed runners log ingested zone/rule counts. The extraction script prints
per-pair results + sanity warnings. No PII.

## 11. Rollback / safety

Additive at runtime (ingestion is idempotent; empty artifact dir = current
behaviour). Removing the gateway path is covered by tests. Rollback = revert the
PR. A bad artifact only blocks its own deploy (loud validation error), never
corrupts existing rows.

## 12. Implementation order

1. [x] Shared schema module + `visa:schema(:check)` + committed JSON Schema.
2. [x] Move `runSanityChecks` to `visa-extraction/checks.ts` (drop the TS serialiser).
3. [x] `ingest-visa-rules.ts` + unit + int tests; wire into seed/migrate/migrate-deploy.
4. [x] Dev runners (`claude-agent-runner`, `codex-runner`) + `extract-visa-rules` + skill.
5. [x] Remove gateway extractor/port/fetch-script/AI-seed; update `package.json`.
6. [x] CI drift gate; ADR 062 + docs sync.

## 13. ADR triggers and tech-debt review

### ADR?

- [x] New library / external tool — `@anthropic-ai/claude-agent-sdk`; Codex CLI.
- [x] New project-wide standard — subscription-auth extraction + JSON-artifact
  ingestion at deploy.
- [x] Non-obvious architectural trade-off — replaces ADR 061's frozen-TS-seed
  mechanism with JSON artifacts + deploy ingestion (boundary unchanged).

**ADRs to write:** **ADR 062**; update ADR 061's mechanism note.

### Tech debt

- [x] Reviewed `docs/tech-debt.md` — nothing relevant.

## 14. Risks & open questions

- **Agent SDK / Codex output-shape drift.** The runners are dev-only and not
  CI-exercised; the SDK API was pinned against the installed types. If a CLI/SDK
  release changes the output shape, the operator adjusts the runner.
- **"Long stay" study routes** remain unseeded (SPEC-018 note) — orthogonal.

---

## Implementation Deviations

| # | Deviation | Reason | Impact | Resolved? |
|---|-----------|--------|--------|-----------|
| 1 | Ingestion wired into `db:migrate` (not only deploy) | Local/dev parity + the int test exercises the same path | `pnpm db:migrate` now also seeds visa data (idempotent) | Yes |

### Post-Implementation Notes

- The extraction runners (`scripts/visa-extraction/*`) are dev tooling — never
  imported by the app, so CI never runs the AI. Verified: lint, type-check, unit
  (491), build, `db:check:migrations`, `visa:schema:check` all green; the ingest
  int-test is CI-gated (Docker).
- `@anthropic-ai/claude-agent-sdk@^0.3.183` confirmed: `query()` →
  async-generator → `result` message with `structured_output`; subscription auth
  via `CLAUDE_CODE_OAUTH_TOKEN`.
- This completes EPIC-005's machinery; merged + extracted, the epic is shippable.
- **Initial broad GBR batch ingested (2026-06-21).** 18 destinations researched
  against gov.uk foreign travel advice and committed as `visa-rules-data/GBR/*.json`
  (NZL, CAN, IND, SGP, ARE, TUR, CHN, IDN, MYS, MEX, ZAF, BRA, EGY, MAR, LKA, QAT,
  KOR, PHL), schema-validated via `loadExtractedVisaRules` (PRs #169). Merged to
  main; the production deploy ran `ingestVisaData` (chained `db:migrate:deploy &&
  db:seed`) and reached READY on `travel.matthewcarr.dev`. Two time-boxed rules
  are flagged: CHN `validTo: 2026-12-31` and a KOR K-ETA exemption note. This
  closes EPIC-005 slice 5 (broad GBR coverage).
