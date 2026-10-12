# App performance review — 2026-09-06

Scope: web page orchestration, database repository queries and indexes, shared
financial calculations, mobile trip hooks and screens, AI use cases, and client
bundle imports. Priority reflects common trip journeys and demonstrable work
removed; production traffic and latency traces were not available for this review.

## Implemented priorities

| Priority | Bottleneck | Change and evidence |
| --- | --- | --- |
| 1 | Overview and timeline wait for optional AI on cache misses | Stream AI panels inside Suspense. Real-Postgres regression tests hold the provider pending and verify the main page returns. Timeline deterministic findings remain visible while AI loads. |
| 2 | AI panels reread page data, including on cache hits | Reuse the authorized page snapshot. Removes four repository reads per overview render and four per timeline render. Existing callers share the same cache/fallback implementation. |
| 3 | Closed assistant eagerly loads the chat SDK and tool UI | Load the drawer body only when opened. The production route's initial chunks shrink by 302,074 bytes raw and approximately 79,966 bytes gzipped. |

## Bundle measurement

Same checkout, Node 24.20.0 and production build command before and after:
`POSTGRES_URL=postgresql://build:build@localhost:5432/build pnpm build`.
Summed the unique initial trip-page chunks listed in the generated
`page_client-reference-manifest.js` entry, including its shared chunks.

| Initial trip-page JavaScript | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Raw bytes | 842,151 | 540,077 | 35.9% |
| Gzipped bytes | 228,485 | 148,519 | 35.0% |

Gzip totals compress each chunk independently; CDN transfer sizes can differ.
These are build measurements, not production latency claims. The first assistant
opening now waits for its code download, with a loading state. AI narrative
insertion can move content after the main page has appeared.

## Verification

- Lint exits 0; one pre-existing optional-chain warning in the chat API route.
- Migration policy, workspace type checks, and production build pass.
- Unit suites: 82 shared, 495 web, 155 mobile, plus 14 mobile script checks pass.
- All 385 integration tests pass against real PostgreSQL.
- Production browser run: 85 pass, including chat reopen/history and accessibility
  at 375/768/1280px. One existing development-only local sign-in test is skipped.
- Browser navigation generated React server stream-close cancellation logs.
  The installed React server renderer emits these when its destination closes;
  no browser tests failed. Effects on production error telemetry were not measured.
- Physical-device/mobile E2E was not run; mobile implementation and wire contracts
  are unchanged.

## Architecture review

- P15 (Conventional Commits): aligned — local changes use conventional messages.
- P17 (Small commits): aligned — separate snapshot refactor, deferred chat loading,
  and streamed page integration.
- P3 (Small slice): aligned — three bounded improvements to the trip load journey.
- P4 (Root cause): aligned — removes AI blocking, repeated reads, and eager imports.
- P7 (Tests): aligned — regressions demonstrated failing first; database seams and
  browser journeys verified. Conditional browser skip is disclosed above.
- P31 (Trunk-based): aligned — short-lived local branch; no deployment or push.
- P33 (Review etiquette): aligned — findings grounded in measured work and behavior.
- P2/P14: enforced by architecture, composition-root, lint, and type-check gates.
- P19: aligned — trip authentication and membership checks precede streamed output.
- P11/P12: aligned — API and wire contracts unchanged.
- P16/P18: aligned — changelog updated and responsive accessibility suite exercised.
- P28/P9: aligned — existing React/Next primitives, no dependencies or schema changes;
  changes can be reverted. Decision recorded in ADR 070.
