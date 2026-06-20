# AI-extracted visa rules (artifacts)

One committed JSON file per `<NATIONALITY>/<DESTINATION>.json` (ISO alpha-3),
each a `VisaRuleSeed[]` produced by `pnpm visa:extract` (SPEC-019 / ADR 062).

- **Source of truth, reviewable in PR diffs** — this review **is** the factual
  accuracy gate (ADR 061/062). `source: 'ai-extracted'`; a reviewer may promote
  verified rows to `source: 'manual'` in `../visa-rule-seed.ts`.
- **Ingested at deploy** by `ingestVisaData()` (idempotent upsert into
  `visa_rules`), validated against `visaRuleSeedSchema`.
- Regenerate a pair by re-running `pnpm visa:extract --runner=claude|codex <DEST>`;
  files overwrite per pair.

Do not hand-edit beyond corrections during review.
