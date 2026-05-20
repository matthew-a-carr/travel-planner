# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project uses [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

## [Unreleased]

### Added

- **REST API v1 baseline.** New `/api/v1/*` surface with versioned URL prefix,
  typed error envelope (`{ error: { code, message, details? } }`), and
  per-handler `Result<T, E>` → HTTP mapping. Conventions in
  `docs/api-conventions.md`; decision recorded in ADR 050.
- **`GET /api/v1/me`** — first endpoint on the v1 surface. Returns
  `{ id, email, name, isApproved }` for an authenticated cookie session.
  410 for anonymised users (ADR 031 marker); 200 with `isApproved: false`
  for authenticated-but-unapproved sessions.
- **Bearer-token authentication on `/api/v1/*`.** `Authorization: Bearer <jwt>`
  is now accepted alongside cookie sessions. Tokens are HS256-signed JWTs
  per ADR 051 (Mobile Authentication Model); bearer wins when both are
  present. `GET /api/v1/me` accepts either credential.
- **`pnpm auth:mint-token`** — dev-only CLI for minting JWT access tokens
  against an existing user. Refuses to run when `NODE_ENV=production`.
  Useful for manual `/api/v1` testing until slice 3 ships the PKCE
  issuance flow.

## [1.15.0](https://github.com/matthew-a-carr/travel-planner/compare/v1.14.0...v1.15.0) (2026-05-18)


### Features

* **chat:** Slice 2 — write-side tools with inline-confirm risk policy ([#82](https://github.com/matthew-a-carr/travel-planner/issues/82)) ([815504e](https://github.com/matthew-a-carr/travel-planner/commit/815504ec380ec01126cd07630488e413a754d504))
* **chat:** Slice 2.5 — UI message protocol + ToolCallCard ([#84](https://github.com/matthew-a-carr/travel-planner/issues/84)) ([86fea4d](https://github.com/matthew-a-carr/travel-planner/commit/86fea4defb153aa90943ee2db61d228832b811b4))
* **chat:** suggested-prompt chips on assistant drawer empty state ([#88](https://github.com/matthew-a-carr/travel-planner/issues/88)) ([135e06a](https://github.com/matthew-a-carr/travel-planner/commit/135e06afd695641c0df5eb00f72969552210a38f))
* **repo:** iOS app strategy (ADR 045) + monorepo restructure (ADR 046) ([#93](https://github.com/matthew-a-carr/travel-planner/issues/93)) ([a74e76b](https://github.com/matthew-a-carr/travel-planner/commit/a74e76b33dacdb11ad12258d7a0b4dad04f568c9))
* **timeline:** visa-required, event-clash, peak-pricing insight kinds ([#90](https://github.com/matthew-a-carr/travel-planner/issues/90)) ([23d3dee](https://github.com/matthew-a-carr/travel-planner/commit/23d3deed776d5cad5f817e3667981afac14e4384))
* **trip:** AI burndown narrative panel on the overview (ADR 043) ([#89](https://github.com/matthew-a-carr/travel-planner/issues/89)) ([e8246ca](https://github.com/matthew-a-carr/travel-planner/commit/e8246ca202e08a1bfb3170c7e96aa37ade1dd2a0))
* **trip:** AI-assisted trip creation from a pasted paragraph (ADR 044) ([#92](https://github.com/matthew-a-carr/travel-planner/issues/92)) ([899d962](https://github.com/matthew-a-carr/travel-planner/commit/899d962f5cce2aa5e251704a5bfcd5f839fe3664))


### Bug Fixes

* **chat:** surface a friendly error when the AI gateway fails ([#91](https://github.com/matthew-a-carr/travel-planner/issues/91)) ([bd57a6e](https://github.com/matthew-a-carr/travel-planner/commit/bd57a6e7c4dd5136ea656914af2c875f33643955))
* **ci:** repair infra workflows after the monorepo restructure ([#96](https://github.com/matthew-a-carr/travel-planner/issues/96)) ([921eb36](https://github.com/matthew-a-carr/travel-planner/commit/921eb361d667f9838d7e70ff6aecf4d600717209))

## [1.14.0](https://github.com/matthew-a-carr/travel-planner/compare/v1.13.0...v1.14.0) (2026-05-09)


### Features

* **chat:** conversational trip assistant — Slice 0 foundations ([#79](https://github.com/matthew-a-carr/travel-planner/issues/79)) ([d03824e](https://github.com/matthew-a-carr/travel-planner/commit/d03824e4b4a2b5481e67a4e40effae96727f08ee))
* **chat:** Slice 1 — read-only Q&A tools (ADR 042) ([#80](https://github.com/matthew-a-carr/travel-planner/issues/80)) ([9cbcee7](https://github.com/matthew-a-carr/travel-planner/commit/9cbcee70ab47afa33cf4b75fa63bee4e62af63fe))
* **timeline:** AI-powered Trip Timeline tab with Vercel AI Gateway ([#77](https://github.com/matthew-a-carr/travel-planner/issues/77)) ([6e70610](https://github.com/matthew-a-carr/travel-planner/commit/6e70610f326a00f1c1e608376c95457597ef0567))


### Bug Fixes

* **ai:** pick up Vercel OIDC token at runtime ([#81](https://github.com/matthew-a-carr/travel-planner/issues/81)) ([5f7ad56](https://github.com/matthew-a-carr/travel-planner/commit/5f7ad56466dbf46297e4b6c9388acc0aa0aad5e2))

## [Unreleased]

### Features

* **trip:** AI-assisted trip creation. The create-trip modal now has a "Plan with AI" tab next to the existing manual form. Paste a rough itinerary (e.g. "3 weeks Vietnam from Aug 1, then Cambodia 10 days, Laos a week, Thailand till mid-Oct") and the parser extracts destinations, suggests a trip name derived from up to three countries plus a month/year segment, and proposes a total budget = sum of per-country reference suggestions + 10% contingency rounded up to £100. The row list is editable before submission; submit composes `createTrip` + `bulkAddDestinations` in a new `createTripWithDestinations` use case with a compensating-delete rollback if bulk-add breaches the budget invariant. Reuses the existing AI gateway parser — no new model port or new cache key. (ADR 044)

### Bug Fixes

* **chat:** the assistant drawer now surfaces a categorised, actionable error instead of a generic "Something went wrong". Gateway quota errors (e.g. Vercel's `RestrictedModelsError` / `no_providers_available`) read "AI is temporarily unavailable — the gateway quota has been reached. Try again later."; auth, network, and timeout failures get their own short lines; short pass-through messages are surfaced verbatim; only truly opaque errors fall back to the original generic line. Implemented as a pure-domain `formatChatStreamError` helper wired into both the server-side `toUIMessageStreamResponse({ onError })` and the client's `useChat`-surfaced error so the message is consistent in both places.

### Features

* **timeline:** three new AI-driven insight kinds — `visa-required` (UK passport tourist visa heads-up with a "verify with the embassy" suggestion), `event-clash` (major festivals / holiday clusters / sporting events that spike prices or close attractions), and `peak-pricing` (well-known peak tourist windows for non-luxury comfort levels). Bumped the timeline-insights cache key to `timeline-insights-v2` so post-deploy runs aren't served stale v1 payloads. The system prompt now instructs the model to skip rather than fabricate, and to direct visa enquiries to the embassy. (extends ADR 041 / 040)
* **trip:** AI-written "What's the headline?" panel on the trip overview, sitting between the budget overview and the alerts banner. A new `TripNarrativeService` port + Vercel-Gateway adapter generates a 2–3 sentence paragraph and up to three actionable bullets from the trip's burndown, allocation, and alerts. Cached in `ai_cache` (`trip-narrative-v1`, 6 h TTL, rolls on spend or current-day change). No-op fallback returns an empty narrative so the panel hides cleanly when the gateway is unavailable. (ADR 043)
* **chat:** suggested-prompt chips on the assistant drawer's empty state. Chips are derived server-side from the trip's lifecycle phase (empty / planning / active / completed) and the current dated destination, so a planning trip surfaces budget-shaping prompts while an active trip nudges toward "I spent £X" and "what's coming up next?". Clicking a chip pre-fills the textarea so the user can tweak before sending.
* **chat:** Slice 2.5 — drawer upgraded to the AI SDK 6 UI message protocol via `@ai-sdk/react`'s `useChat`. Tool invocations now render inline through a new `ToolCallCard` component with explicit Confirm / Cancel buttons (for risky mutations) and an Undo button (for `delete_spend_entry`). Confirm/Cancel send a synthetic `Confirmed.` / `Cancelled.` chat message; the system prompt directs the model to re-call the most recent confirm-required tool with `confirmed: true` (or stop). Persistence migrates from `chat_messages.content text` to `chat_messages.parts jsonb` so structured tool calls round-trip through reload. (ADR 042)
* **chat:** Slice 2 — write-side tools (`record_spend`, `edit_destination`, `add_fixed_cost`, `edit_trip_budget`, `delete_spend_entry`) wrap the existing application use cases as chat tools bound to the conversation's trip. A pure-domain `classifyToolRisk` policy decides per call whether to auto-execute or ask the user to confirm. Risky calls return `{ requiresConfirmation: true, summary }` and the model relays the summary verbatim until the user agrees, then re-calls with `confirmed: true`. `delete_spend_entry` returns `undo` metadata so the user can ask to put it back. The assistant can now act on intents like "I spent £8 on lunch in Hanoi" or "add £200 visas on 1 April" without leaving the chat. (ADR 042)
* **chat:** per-trip conversational assistant drawer (Slice 0 — read-only foundations) with streaming replies via Vercel AI Gateway and persisted chat history per (trip, user). Tool-calling mutations land in subsequent slices. (ADR 042)
* **chat:** Slice 1 — read-only Q&A tools (`get_trip_summary`, `list_destinations`, `get_burndown`, `get_spending_by_category`). The assistant can now answer "Am I on pace?", "What's my plan?", "Where is my money going?" with real data instead of generic guidance. Tools are bound to the conversation's trip at call time so the model cannot read any other trip. (ADR 042)
* **timeline:** add Trip Timeline tab with horizontal Gantt of dated destinations and fixed-cost pins (ADR 041)
* **timeline:** AI-powered "Paste itinerary" panel — extract destination rows from free-form text via Claude Sonnet 4.6 through Vercel AI Gateway, pre-fill budgets from country reference data, preview, and bulk-insert (ADR 040, 041)
* **timeline:** AI + deterministic insights panel — gaps, overlaps, budget-vs-reference mismatches, plus AI-only seasonality and missing-transport detection
* **infra:** new `ai_cache` table for SHA-256-keyed caching of LLM outputs in Postgres (no Vercel KV dependency)
* **infra:** AI Gateway auth uses `VERCEL_OIDC_TOKEN` (auto-injected on Vercel deployments) by default; no long-lived gateway secret in Terraform. Local dev / non-Vercel CI fall back to `AI_GATEWAY_API_KEY`. The app degrades gracefully when neither is set.

### Performance

* **ai:** switch default gateway model from Claude Sonnet 4.6 to Google Gemini 3 Flash. Roughly an order of magnitude cheaper on input tokens and ~6× cheaper on output, with competitive reasoning quality for itinerary extraction, timeline insights, and tool-using conversation. Behaviour and the architecture are unchanged — only the default model id changes. Override per-environment with `AI_GATEWAY_MODEL`. (ADR 040)

### Bug Fixes

* **ai:** detect Vercel runtime via `VERCEL=1` rather than `process.env.VERCEL_OIDC_TOKEN`. Vercel delivers the OIDC token per-request via the `x-vercel-oidc-token` header (the env var is build-time only), so the previous check silently fell back to no-op AI services on every production request — visible as the "AI offline" message in the chat drawer and timeline insights. Enables `oidc_token_config` on the Vercel project via Terraform so OIDC tokens are actually issued. (ADR 040)
* **ai:** resolve real-vs-fallback per request, not at container construction. `createAiServices()` now wires a runtime-aware router per port that re-checks `hasAiCredentials()` on every call and delegates to either the Anthropic-backed real implementation or the no-op fallback. Container is still the DI seam — but the decision is no longer frozen for the worker's lifetime. (ADR 040)

## [1.13.0](https://github.com/matthew-a-carr/travel-planner/compare/v1.12.1...v1.13.0) (2026-05-09)


### Features

* **a11y:** add mobile-first responsive layout and WCAG 2.1 AA accessibility ([6651a0c](https://github.com/matthew-a-carr/travel-planner/commit/6651a0cbc222dcd438c02ef1cce9ab6b8e8a5d42))
* add integration test suite, fix code smells, automate releases ([#8](https://github.com/matthew-a-carr/travel-planner/issues/8)) ([8c56c1c](https://github.com/matthew-a-carr/travel-planner/commit/8c56c1c130382ae19c6b87e85723b5a9c44457de))
* add spend entry delete and edit ([cd33275](https://github.com/matthew-a-carr/travel-planner/commit/cd332758157ba8f6cb34585a4bc6b5393b9debcc))
* **auth:** add dev-only local login fallback ([f131ae5](https://github.com/matthew-a-carr/travel-planner/commit/f131ae5789988e1d1625731ecc5c063874a99f84))
* **auth:** enforce closed invite-only membership flow ([bd0577c](https://github.com/matthew-a-carr/travel-planner/commit/bd0577cf8f1fd89e627f71b1490641b1d5ddebde))
* **auth:** implement admin user deletion with soft delete and anonymization ([1378b8f](https://github.com/matthew-a-carr/travel-planner/commit/1378b8f3a2eff635c014798c5a334969a8dae31d))
* **auth:** implement closed access onboarding with resend invite delivery ([373bd73](https://github.com/matthew-a-carr/travel-planner/commit/373bd736e4d97275276814d6648acb9098e9a782))
* **auth:** implement controlled signup and admin access management ([08bc734](https://github.com/matthew-a-carr/travel-planner/commit/08bc734a88cbf1c45832bed396682e1446c47b62))
* bootstrap travel-planner project scaffold ([fbd4c29](https://github.com/matthew-a-carr/travel-planner/commit/fbd4c2994f6ef1df9f790b93a51be5d6fe358fb4))
* **country-reference:** add budget suggestion engine and destination dates ([f6b0625](https://github.com/matthew-a-carr/travel-planner/commit/f6b0625f68ee88c230928f908cbf75ae7512efb9))
* destination management, spend recording, and e2e scaffolding ([44a2604](https://github.com/matthew-a-carr/travel-planner/commit/44a2604ecda9bdf8087a8d74c5c4b25f00cf4259))
* **destination:** add destination editing; fix CI build (lazy DB client) ([45287af](https://github.com/matthew-a-carr/travel-planner/commit/45287afc8245db447501e142ab863b60f34dfcf2))
* **destinations:** comprehensive country reference data with combobox selection ([#34](https://github.com/matthew-a-carr/travel-planner/issues/34)) ([d532ffb](https://github.com/matthew-a-carr/travel-planner/commit/d532ffb3f675e362766a800403a7271aa2672aff))
* **dev:** bootstrap local dev db and stabilize integration runs ([c3931ef](https://github.com/matthew-a-carr/travel-planner/commit/c3931efce05e3a7a9875d6cba54de940809d6fd5))
* **e2e:** self-contained Testcontainers PostgreSQL for e2e tests ([26a1b72](https://github.com/matthew-a-carr/travel-planner/commit/26a1b728ffb58f6dd292101fa1de9e9a31747284))
* **fixed-costs+charts:** replace ringfenced amount with named cost items; add Recharts charts ([c8b4c8c](https://github.com/matthew-a-carr/travel-planner/commit/c8b4c8c6193d89c6b653b58d351cd3dfedb24729))
* **fixed-costs:** add eating-out, subscriptions, healthcare, visas categories ([0c08921](https://github.com/matthew-a-carr/travel-planner/commit/0c08921bdf4a45ee92a7336670f56d92fa6dd484))
* **fixed-costs:** add edit, categories, and date fields ([2ddd838](https://github.com/matthew-a-carr/travel-planner/commit/2ddd83810e9be2d4007133d43bc18600261003a0))
* **infra:** add sentry error monitoring with terraform-managed project and alerts ([f88e38e](https://github.com/matthew-a-carr/travel-planner/commit/f88e38e3a96e633e3437426c6a759817d8769aab))
* **infra:** manage vercel and neon with terraform ([c23f288](https://github.com/matthew-a-carr/travel-planner/commit/c23f2889d5c4d9be9444a9746f695fd7628886a5))
* **organization:** add org-scoped trip sharing and workspace management ([e108ded](https://github.com/matthew-a-carr/travel-planner/commit/e108ded464714fd67f6446da60b7d39a1dfd541a))
* **organization:** add searchable user picker for member assignment ([eeb5ebd](https://github.com/matthew-a-carr/travel-planner/commit/eeb5ebdfefff30b608b6080435126e9a644ccc52))
* **settings:** separate organization creation from member management ([1ca13c8](https://github.com/matthew-a-carr/travel-planner/commit/1ca13c892ac31d30c96bacdef25f203f75765b58))
* **spending:** add burndown budget pace tracker with alerts ([#39](https://github.com/matthew-a-carr/travel-planner/issues/39)) ([3436fc8](https://github.com/matthew-a-carr/travel-planner/commit/3436fc8e089bb2eb2911349568a04907e39ab35f))
* trip creation, persistence, and detail page ([96770a4](https://github.com/matthew-a-carr/travel-planner/commit/96770a46ba2fd3b7f67435d674de0616d85f6c3c))
* **trip:** add owner-only hard delete for trips ([7d06f25](https://github.com/matthew-a-carr/travel-planner/commit/7d06f25a91808b466e164000c9eb54d87f5c175d))
* **trips:** add interactive journey map and budget timeline ([8f3e302](https://github.com/matthew-a-carr/travel-planner/commit/8f3e302c226ca7b219c2c3a64bc0ea9d35f994ea))
* **trips:** order trips most-recent-first and show created date ([a5ca2f5](https://github.com/matthew-a-carr/travel-planner/commit/a5ca2f529c7f5be2747b559c242e4ee42e6ea4b0))
* **trips:** stage-aware detail page and streamlined destination form ([#75](https://github.com/matthew-a-carr/travel-planner/issues/75)) ([c8ca563](https://github.com/matthew-a-carr/travel-planner/commit/c8ca563c5d229dafd14b9cda85a0dc63e4cc389c))
* **ui:** move organization management to settings with shared app header ([08f5174](https://github.com/matthew-a-carr/travel-planner/commit/08f5174e71bbab5839641d62487c38b2b99856b1))
* update sticky header and global nav ([f351617](https://github.com/matthew-a-carr/travel-planner/commit/f3516176c12beb2f9f8abbb06632c5eff6ca493f))


### Bug Fixes

* **a11y:** fix WCAG AA color-contrast violations on dashboard ([f166399](https://github.com/matthew-a-carr/travel-planner/commit/f16639906056c1f99ad068876faf5b971ff3868d))
* **auth:** canonicalize adapter callbacks ([663a559](https://github.com/matthew-a-carr/travel-planner/commit/663a559341242d73678046eda801f0cd5e3e2e7c))
* **auth:** canonicalize db email lookups for google aliases ([2ddb000](https://github.com/matthew-a-carr/travel-planner/commit/2ddb000dab378ba77ff929255f850ae2be7762b5))
* **auth:** grant local-dev bootstrap admin in preview auth mode ([c7708c7](https://github.com/matthew-a-carr/travel-planner/commit/c7708c7522bd7e3d3e0d958d99042fe70b317c3c))
* **auth:** harden admin allowlist parsing and google email verification ([c511f71](https://github.com/matthew-a-carr/travel-planner/commit/c511f710374fb986e18416b1401df2e57a92be25))
* **auth:** harden google avatar rendering and add e2e regression ([7b166bc](https://github.com/matthew-a-carr/travel-planner/commit/7b166bc09b35130cd1042839ceeaa73f75b01e86))
* **auth:** load admin allowlist from github secrets ([e240835](https://github.com/matthew-a-carr/travel-planner/commit/e240835e3467d81a5416a75a31219464b50aece6))
* **auth:** log explicit sign-in denial reason ([962a533](https://github.com/matthew-a-carr/travel-planner/commit/962a5336810464c7e1d6bad20c8ddf2bc82a8b51))
* **auth:** normalize email matching and backfill admin approvals ([b6182cb](https://github.com/matthew-a-carr/travel-planner/commit/b6182cb4411dcb81c3636a1634199d0e4ff917f1))
* **auth:** normalize emails for oauth linking ([02fe0f0](https://github.com/matthew-a-carr/travel-planner/commit/02fe0f0af7813e0975a23c3ad557990a0d7aac8e))
* **auth:** trust preview hosts for authjs login ([a8b2099](https://github.com/matthew-a-carr/travel-planner/commit/a8b2099d9c823bb1a680fede049882fc9d604e18))
* **ci:** fix e2e build failures — local fonts and proxy migration ([e6e7d4e](https://github.com/matthew-a-carr/travel-planner/commit/e6e7d4effbbcedd1f5f83d583acad08ea65e5ac0))
* **ci:** generate drizzle migration journal; add pre-commit/pre-push hooks ([ebf3d65](https://github.com/matthew-a-carr/travel-planner/commit/ebf3d658c9a7a3d94c18aadbc5ce0dbb1b4b1182))
* **ci:** resolve build failure — dummy POSTGRES_URL for next build ([03e4782](https://github.com/matthew-a-carr/travel-planner/commit/03e47820e5a44806aa0b854d214375f7956b9d61))
* **ci:** support manual preview apply with explicit pr map ([33810c9](https://github.com/matthew-a-carr/travel-planner/commit/33810c9aa1d87dbc8037b7446c45ab2708187ef6))
* e2e test failures and date picker UX on Chrome desktop ([38f26c0](https://github.com/matthew-a-carr/travel-planner/commit/38f26c0e755ff7acfacbdc93cd3a14139eb228d4))
* **e2e:** check pathname only in auth redirect assertion ([01c0b45](https://github.com/matthew-a-carr/travel-planner/commit/01c0b45275e667ef2e933540daa692cae2d11d20))
* **e2e:** fix broken E2E tests caused by auth middleware and test setup ([#52](https://github.com/matthew-a-carr/travel-planner/issues/52)) ([19d0597](https://github.com/matthew-a-carr/travel-planner/commit/19d059767e58c62d9ead73815c2e55b4fef57397))
* **e2e:** harden Move to assertion with toPass retry loop ([ad57030](https://github.com/matthew-a-carr/travel-planner/commit/ad57030692b8daa034754f42368b637ee8c6c57e))
* **e2e:** stabilize ci auth harness and test reliability ([5580ca2](https://github.com/matthew-a-carr/travel-planner/commit/5580ca2db9723c53defeb24ea86721a30e0f32f4))
* **e2e:** update trip creation test to match current UI (ADR 005) ([1c72fea](https://github.com/matthew-a-carr/travel-planner/commit/1c72fea956903b76d1d4ed3ce8c89ceee015ff21))
* **email:** enforce strict vercel env contract for resend ([391f740](https://github.com/matthew-a-carr/travel-planner/commit/391f7401ed380336285dd1f227b0fbc02696f23c))
* **email:** fail loudly on production resend misconfiguration ([52af59b](https://github.com/matthew-a-carr/travel-planner/commit/52af59bf86e4d263c7ba1136edae69ec00af04d5))
* fix header position ([2799610](https://github.com/matthew-a-carr/travel-planner/commit/27996107c3435876097a8638246257d1a8411140))
* formatting terraform ([6b77c1c](https://github.com/matthew-a-carr/travel-planner/commit/6b77c1c0b91872a41b517056b2c92581540beb75))
* **infra:** correct sentry provider version and resource syntax ([b0ef379](https://github.com/matthew-a-carr/travel-planner/commit/b0ef379059319b60e276bccfb1589d7a4607ba85))
* **infra:** prevent non-pr preview deploy failures ([a2304ec](https://github.com/matthew-a-carr/travel-planner/commit/a2304ec0db36af3e8652b5738314602367f677d4))
* **infra:** remove metric alert — requires team internal_id not available ([ad1df36](https://github.com/matthew-a-carr/travel-planner/commit/ad1df368975ad54dd5936e5765c5350489ffed5f))
* **infra:** remove metric alert environment field for new sentry project ([62a289e](https://github.com/matthew-a-carr/travel-planner/commit/62a289efa2a99b9228e3b610e307d4e3d4df00b0))
* **infra:** remove unsupported neon endpoint suspend timeout ([ccc786c](https://github.com/matthew-a-carr/travel-planner/commit/ccc786cccbcde3ece4b4fca56a0af82f38fb6d5a))
* **infra:** serialize neon preview role creation ([93357a4](https://github.com/matthew-a-carr/travel-planner/commit/93357a4c9f6cee3ff9bf86e22f77811732a65873))
* regenerate pnpm-lock.yaml after duplicate @types/node entries from Dependabot merges ([a4ca792](https://github.com/matthew-a-carr/travel-planner/commit/a4ca79208613d140507d453c278db81579e0a05b))
* **sso:** fix sso account linking ([#27](https://github.com/matthew-a-carr/travel-planner/issues/27)) ([48ccbb2](https://github.com/matthew-a-carr/travel-planner/commit/48ccbb20ff37d3bd02227597910dd3e516a919db))
* **ui:** close edit trip modal on successful save ([1e6ad5d](https://github.com/matthew-a-carr/travel-planner/commit/1e6ad5d019f46e32aa972959609275efebe54306))
* **ui:** enlarge organization member search input ([175454d](https://github.com/matthew-a-carr/travel-planner/commit/175454dc2206741dc10144d0fa87438f76aee6b6))
* **ui:** fix mobile layout issues and collapse add fixed cost form ([#38](https://github.com/matthew-a-carr/travel-planner/issues/38)) ([ab7e635](https://github.com/matthew-a-carr/travel-planner/commit/ab7e6357a846437f5b4d543638f6afcf2c9efdda))
* **ui:** match member search input size to organization input ([9503c2f](https://github.com/matthew-a-carr/travel-planner/commit/9503c2f511360e4402320f25aab548adca6091ee))

## [1.12.1](https://github.com/matthew-a-carr/travel-planner/compare/v1.12.0...v1.12.1) (2026-03-21)


### Bug Fixes

* **e2e:** fix broken E2E tests caused by auth middleware and test setup ([#52](https://github.com/matthew-a-carr/travel-planner/issues/52)) ([19d0597](https://github.com/matthew-a-carr/travel-planner/commit/19d059767e58c62d9ead73815c2e55b4fef57397))

## [1.12.0](https://github.com/matthew-a-carr/travel-planner/compare/v1.11.0...v1.12.0) (2026-03-15)


### Features

* **spending:** add burndown budget pace tracker with alerts ([#39](https://github.com/matthew-a-carr/travel-planner/issues/39)) ([3436fc8](https://github.com/matthew-a-carr/travel-planner/commit/3436fc8e089bb2eb2911349568a04907e39ab35f))
* **trips:** add interactive journey map and budget timeline ([8f3e302](https://github.com/matthew-a-carr/travel-planner/commit/8f3e302c226ca7b219c2c3a64bc0ea9d35f994ea))


### Bug Fixes

* **ui:** fix mobile layout issues and collapse add fixed cost form ([#38](https://github.com/matthew-a-carr/travel-planner/issues/38)) ([ab7e635](https://github.com/matthew-a-carr/travel-planner/commit/ab7e6357a846437f5b4d543638f6afcf2c9efdda))

## [Unreleased]

### Added

* **a11y:** keyboard navigation (ArrowUp/Down, Enter, Escape) for CityAutocomplete listbox
* **db:** CHECK constraints on enum-like text columns (trip status, comfort level, spend/fixed-cost categories)
* **db:** indexes on foreign key columns (trips.organization_id, destinations.trip_id, spend_entries.destination_id, trip_fixed_costs.trip_id)
* **spending:** burndown budget pace tracker with daily pace calculation, projected exhaustion dates, and smart budget alerts
* **charts:** burndown line chart showing ideal, actual, and projected budget drawdown over time
* **destinations:** burn rate indicator on destination cards showing daily spending pace vs target pace
* **trips:** "What next?" panel on brand-new trips with shortcuts to add a destination or fixed cost
* **destinations:** "Save and add another" button on the add-destination form for rapid entry

### Changed

* **trips:** trip detail page now hides empty Budget Overview, Charts, and Journey Map sections until the trip has data to display
* **destinations:** estimated budget auto-fills from the country/comfort/dates suggestion (still editable); destination name is now optional and falls back to city or country when blank
* **ci:** Dependabot now groups all minor and patch updates into a single PR per ecosystem (npm, github-actions); major versions still land as individual PRs
* **auth:** middleware now checks `isApproved` — unapproved users are redirected to `/login`
* **domain:** `money()`, `addMoney()`, and `calculateTotalSpend()` return `Result` instead of throwing; added `moneyUnchecked()` for trusted contexts (ADR 038)
* **use-cases:** `deleteSpendEntry`, `removeFixedCost`, and `removeDestination` now return `Result<void>` with not-found checks

### Fixed

* **refactor:** centralize `canonicalEmailSql()` into shared module (was duplicated in 3 files)
* **cleanup:** remove unused `_trip` parameter from `calculateTripBurndown`

## [1.11.0](https://github.com/matthew-a-carr/travel-planner/compare/v1.10.0...v1.11.0) (2026-03-14)


### Features

* **trips:** order trips most-recent-first and show created date ([a5ca2f5](https://github.com/matthew-a-carr/travel-planner/commit/a5ca2f529c7f5be2747b559c242e4ee42e6ea4b0))


### Bug Fixes

* **a11y:** fix WCAG AA color-contrast violations on dashboard ([f166399](https://github.com/matthew-a-carr/travel-planner/commit/f16639906056c1f99ad068876faf5b971ff3868d))
* regenerate pnpm-lock.yaml after duplicate @types/node entries from Dependabot merges ([a4ca792](https://github.com/matthew-a-carr/travel-planner/commit/a4ca79208613d140507d453c278db81579e0a05b))
* **ui:** close edit trip modal on successful save ([1e6ad5d](https://github.com/matthew-a-carr/travel-planner/commit/1e6ad5d019f46e32aa972959609275efebe54306))

## [1.10.0](https://github.com/matthew-a-carr/travel-planner/compare/v1.9.0...v1.10.0) (2026-03-14)


### Features

* **destinations:** comprehensive country reference data with combobox selection ([#34](https://github.com/matthew-a-carr/travel-planner/issues/34)) ([d532ffb](https://github.com/matthew-a-carr/travel-planner/commit/d532ffb3f675e362766a800403a7271aa2672aff))
* **fixed-costs:** add eating-out, subscriptions, healthcare, visas categories ([0c08921](https://github.com/matthew-a-carr/travel-planner/commit/0c08921bdf4a45ee92a7336670f56d92fa6dd484))

## [1.9.0](https://github.com/matthew-a-carr/travel-planner/compare/v1.8.1...v1.9.0) (2026-03-09)


### Features

* **fixed-costs:** add edit, categories, and date fields ([2ddd838](https://github.com/matthew-a-carr/travel-planner/commit/2ddd83810e9be2d4007133d43bc18600261003a0))
* **infra:** add sentry error monitoring with terraform-managed project and alerts ([f88e38e](https://github.com/matthew-a-carr/travel-planner/commit/f88e38e3a96e633e3437426c6a759817d8769aab))


### Bug Fixes

* e2e test failures and date picker UX on Chrome desktop ([38f26c0](https://github.com/matthew-a-carr/travel-planner/commit/38f26c0e755ff7acfacbdc93cd3a14139eb228d4))
* formatting terraform ([6b77c1c](https://github.com/matthew-a-carr/travel-planner/commit/6b77c1c0b91872a41b517056b2c92581540beb75))
* **infra:** correct sentry provider version and resource syntax ([b0ef379](https://github.com/matthew-a-carr/travel-planner/commit/b0ef379059319b60e276bccfb1589d7a4607ba85))
* **infra:** remove metric alert — requires team internal_id not available ([ad1df36](https://github.com/matthew-a-carr/travel-planner/commit/ad1df368975ad54dd5936e5765c5350489ffed5f))
* **infra:** remove metric alert environment field for new sentry project ([62a289e](https://github.com/matthew-a-carr/travel-planner/commit/62a289efa2a99b9228e3b610e307d4e3d4df00b0))

## [1.8.1](https://github.com/matthew-a-carr/travel-planner/compare/v1.8.0...v1.8.1) (2026-03-08)


### Bug Fixes

* **auth:** canonicalize adapter callbacks ([663a559](https://github.com/matthew-a-carr/travel-planner/commit/663a559341242d73678046eda801f0cd5e3e2e7c))
* **auth:** normalize emails for oauth linking ([02fe0f0](https://github.com/matthew-a-carr/travel-planner/commit/02fe0f0af7813e0975a23c3ad557990a0d7aac8e))
* **sso:** fix sso account linking ([#27](https://github.com/matthew-a-carr/travel-planner/issues/27)) ([48ccbb2](https://github.com/matthew-a-carr/travel-planner/commit/48ccbb20ff37d3bd02227597910dd3e516a919db))

## [1.8.0](https://github.com/matthew-a-carr/travel-planner/compare/v1.7.0...v1.8.0) (2026-03-08)


### Features

* **auth:** implement admin user deletion with soft delete and anonymization ([1378b8f](https://github.com/matthew-a-carr/travel-planner/commit/1378b8f3a2eff635c014798c5a334969a8dae31d))
* **auth:** implement closed access onboarding with resend invite delivery ([373bd73](https://github.com/matthew-a-carr/travel-planner/commit/373bd736e4d97275276814d6648acb9098e9a782))


### Bug Fixes

* **email:** enforce strict vercel env contract for resend ([391f740](https://github.com/matthew-a-carr/travel-planner/commit/391f7401ed380336285dd1f227b0fbc02696f23c))
* **email:** fail loudly on production resend misconfiguration ([52af59b](https://github.com/matthew-a-carr/travel-planner/commit/52af59bf86e4d263c7ba1136edae69ec00af04d5))

## [Unreleased]

### Added

* **trips:** display created date on trip cards in the dashboard

* **destinations:** comprehensive country reference data with 200 countries (ADR 033):
  - REST Countries API + World Bank GDP PPP calibration for estimated daily costs
  - ISO 3166-1 alpha-2/alpha-3 codes, region, and subregion per country
  - `scripts/fetch-countries.ts` developer script for repeatable data refresh
  - Accessible combobox replaces free-text country input (WAI-ARIA pattern)
  - Server-side validation rejects invalid country values
  - Budget suggestions labelled "Suggested" (manual data) or "Estimated" (model-derived)
  - Deploy-time seeding via idempotent upsert in Vercel build pipeline
* **auth:** Admins can delete users (soft delete with anonymization, preserving organization data)
* **fixed-costs:** add new fixed cost categories: eating-out, subscriptions, healthcare, visas
* **infra:** Sentry error monitoring and performance tracing (ADR 032):
  - `@sentry/nextjs` SDK with client, server, and edge runtime initialisation
  - Terraform-managed Sentry project, issue alerts (new issue, regression,
    reappeared, high error rate), and metric alert (error count threshold)
  - Vercel env vars (`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`,
    `SENTRY_AUTH_TOKEN`) managed by Terraform in both prod and preview stacks
  - New `infra/modules/sentry-project` reusable module
  - CI workflows updated for Sentry secrets/variables
  - Operational runbook at `docs/operations/sentry.md`

## [1.7.0](https://github.com/matthew-a-carr/travel-planner/compare/v1.6.0...v1.7.0) (2026-03-07)


### Features

* **auth:** enforce closed invite-only membership flow ([bd0577c](https://github.com/matthew-a-carr/travel-planner/commit/bd0577cf8f1fd89e627f71b1490641b1d5ddebde))


### Bug Fixes

* **e2e:** harden Move to assertion with toPass retry loop ([ad57030](https://github.com/matthew-a-carr/travel-planner/commit/ad57030692b8daa034754f42368b637ee8c6c57e))

## [1.6.0](https://github.com/matthew-a-carr/travel-planner/compare/v1.5.0...v1.6.0) (2026-03-06)


### Features

* **settings:** separate organization creation from member management ([1ca13c8](https://github.com/matthew-a-carr/travel-planner/commit/1ca13c892ac31d30c96bacdef25f203f75765b58))


### Bug Fixes

* **ui:** enlarge organization member search input ([175454d](https://github.com/matthew-a-carr/travel-planner/commit/175454dc2206741dc10144d0fa87438f76aee6b6))
* **ui:** match member search input size to organization input ([9503c2f](https://github.com/matthew-a-carr/travel-planner/commit/9503c2f511360e4402320f25aab548adca6091ee))

## [1.5.0](https://github.com/matthew-a-carr/travel-planner/compare/v1.4.0...v1.5.0) (2026-03-06)


### Features

* **organization:** add searchable user picker for member assignment ([eeb5ebd](https://github.com/matthew-a-carr/travel-planner/commit/eeb5ebdfefff30b608b6080435126e9a644ccc52))


### Bug Fixes

* **auth:** canonicalize db email lookups for google aliases ([2ddb000](https://github.com/matthew-a-carr/travel-planner/commit/2ddb000dab378ba77ff929255f850ae2be7762b5))
* **auth:** harden admin allowlist parsing and google email verification ([c511f71](https://github.com/matthew-a-carr/travel-planner/commit/c511f710374fb986e18416b1401df2e57a92be25))
* **auth:** log explicit sign-in denial reason ([962a533](https://github.com/matthew-a-carr/travel-planner/commit/962a5336810464c7e1d6bad20c8ddf2bc82a8b51))

## [1.4.0](https://github.com/matthew-a-carr/travel-planner/compare/v1.3.0...v1.4.0) (2026-03-06)


### Features

* **auth:** implement controlled signup and admin access management ([08bc734](https://github.com/matthew-a-carr/travel-planner/commit/08bc734a88cbf1c45832bed396682e1446c47b62))


### Bug Fixes

* **auth:** grant local-dev bootstrap admin in preview auth mode ([c7708c7](https://github.com/matthew-a-carr/travel-planner/commit/c7708c7522bd7e3d3e0d958d99042fe70b317c3c))
* **auth:** load admin allowlist from github secrets ([e240835](https://github.com/matthew-a-carr/travel-planner/commit/e240835e3467d81a5416a75a31219464b50aece6))
* **auth:** normalize email matching and backfill admin approvals ([b6182cb](https://github.com/matthew-a-carr/travel-planner/commit/b6182cb4411dcb81c3636a1634199d0e4ff917f1))

## [1.3.0](https://github.com/matthew-a-carr/travel-planner/compare/v1.2.0...v1.3.0) (2026-03-06)


### Features

* **organization:** add org-scoped trip sharing and workspace management ([e108ded](https://github.com/matthew-a-carr/travel-planner/commit/e108ded464714fd67f6446da60b7d39a1dfd541a))
* **trip:** add owner-only hard delete for trips ([7d06f25](https://github.com/matthew-a-carr/travel-planner/commit/7d06f25a91808b466e164000c9eb54d87f5c175d))
* **ui:** move organization management to settings with shared app header ([08f5174](https://github.com/matthew-a-carr/travel-planner/commit/08f5174e71bbab5839641d62487c38b2b99856b1))
* update sticky header and global nav ([f351617](https://github.com/matthew-a-carr/travel-planner/commit/f3516176c12beb2f9f8abbb06632c5eff6ca493f))

## [1.2.0](https://github.com/matthew-a-carr/travel-planner/compare/v1.1.0...v1.2.0) (2026-03-06)


### Features

* **infra:** manage vercel and neon with terraform ([c23f288](https://github.com/matthew-a-carr/travel-planner/commit/c23f2889d5c4d9be9444a9746f695fd7628886a5))


### Bug Fixes

* **auth:** harden google avatar rendering and add e2e regression ([7b166bc](https://github.com/matthew-a-carr/travel-planner/commit/7b166bc09b35130cd1042839ceeaa73f75b01e86))
* **auth:** trust preview hosts for authjs login ([a8b2099](https://github.com/matthew-a-carr/travel-planner/commit/a8b2099d9c823bb1a680fede049882fc9d604e18))
* **ci:** support manual preview apply with explicit pr map ([33810c9](https://github.com/matthew-a-carr/travel-planner/commit/33810c9aa1d87dbc8037b7446c45ab2708187ef6))
* **infra:** prevent non-pr preview deploy failures ([a2304ec](https://github.com/matthew-a-carr/travel-planner/commit/a2304ec0db36af3e8652b5738314602367f677d4))
* **infra:** remove unsupported neon endpoint suspend timeout ([ccc786c](https://github.com/matthew-a-carr/travel-planner/commit/ccc786cccbcde3ece4b4fca56a0af82f38fb6d5a))
* **infra:** serialize neon preview role creation ([93357a4](https://github.com/matthew-a-carr/travel-planner/commit/93357a4c9f6cee3ff9bf86e22f77811732a65873))

## [1.1.0](https://github.com/matthew-a-carr/travel-planner/compare/v1.0.0...v1.1.0) (2026-03-01)


### Features

* **auth:** add dev-only local login fallback ([f131ae5](https://github.com/matthew-a-carr/travel-planner/commit/f131ae5789988e1d1625731ecc5c063874a99f84))


### Bug Fixes

* **e2e:** stabilize ci auth harness and test reliability ([5580ca2](https://github.com/matthew-a-carr/travel-planner/commit/5580ca2db9723c53defeb24ea86721a30e0f32f4))

## 1.0.0 (2026-03-01)


### Features

* **a11y:** add mobile-first responsive layout and WCAG 2.1 AA accessibility ([6651a0c](https://github.com/matthew-a-carr/travel-planner/commit/6651a0cbc222dcd438c02ef1cce9ab6b8e8a5d42))
* add integration test suite, fix code smells, automate releases ([#8](https://github.com/matthew-a-carr/travel-planner/issues/8)) ([8c56c1c](https://github.com/matthew-a-carr/travel-planner/commit/8c56c1c130382ae19c6b87e85723b5a9c44457de))
* add spend entry delete and edit ([cd33275](https://github.com/matthew-a-carr/travel-planner/commit/cd332758157ba8f6cb34585a4bc6b5393b9debcc))
* bootstrap travel-planner project scaffold ([fbd4c29](https://github.com/matthew-a-carr/travel-planner/commit/fbd4c2994f6ef1df9f790b93a51be5d6fe358fb4))
* **country-reference:** add budget suggestion engine and destination dates ([f6b0625](https://github.com/matthew-a-carr/travel-planner/commit/f6b0625f68ee88c230928f908cbf75ae7512efb9))
* destination management, spend recording, and e2e scaffolding ([44a2604](https://github.com/matthew-a-carr/travel-planner/commit/44a2604ecda9bdf8087a8d74c5c4b25f00cf4259))
* **destination:** add destination editing; fix CI build (lazy DB client) ([45287af](https://github.com/matthew-a-carr/travel-planner/commit/45287afc8245db447501e142ab863b60f34dfcf2))
* **dev:** bootstrap local dev db and stabilize integration runs ([c3931ef](https://github.com/matthew-a-carr/travel-planner/commit/c3931efce05e3a7a9875d6cba54de940809d6fd5))
* **e2e:** self-contained Testcontainers PostgreSQL for e2e tests ([26a1b72](https://github.com/matthew-a-carr/travel-planner/commit/26a1b728ffb58f6dd292101fa1de9e9a31747284))
* **fixed-costs+charts:** replace ringfenced amount with named cost items; add Recharts charts ([c8b4c8c](https://github.com/matthew-a-carr/travel-planner/commit/c8b4c8c6193d89c6b653b58d351cd3dfedb24729))
* trip creation, persistence, and detail page ([96770a4](https://github.com/matthew-a-carr/travel-planner/commit/96770a46ba2fd3b7f67435d674de0616d85f6c3c))


### Bug Fixes

* **ci:** fix e2e build failures — local fonts and proxy migration ([e6e7d4e](https://github.com/matthew-a-carr/travel-planner/commit/e6e7d4effbbcedd1f5f83d583acad08ea65e5ac0))
* **ci:** generate drizzle migration journal; add pre-commit/pre-push hooks ([ebf3d65](https://github.com/matthew-a-carr/travel-planner/commit/ebf3d658c9a7a3d94c18aadbc5ce0dbb1b4b1182))
* **ci:** resolve build failure — dummy POSTGRES_URL for next build ([03e4782](https://github.com/matthew-a-carr/travel-planner/commit/03e47820e5a44806aa0b854d214375f7956b9d61))
* **e2e:** check pathname only in auth redirect assertion ([01c0b45](https://github.com/matthew-a-carr/travel-planner/commit/01c0b45275e667ef2e933540daa692cae2d11d20))
* **e2e:** update trip creation test to match current UI (ADR 005) ([1c72fea](https://github.com/matthew-a-carr/travel-planner/commit/1c72fea956903b76d1d4ed3ce8c89ceee015ff21))

## [Unreleased]

### Added
- Transactional invite email delivery for access onboarding:
  - auto-send on first-time approval during pre-provision
  - admin-only explicit resend invite action in `/settings/access`
  - warm invite template linking users to `/login`
- Resend email provider integration via DI with logging-only provider in
  dev/preview/test.
- New ADR 030 documenting invite email delivery and provider routing decisions.
- Closed-auth onboarding architecture:
  - admin pre-provision flow in `/settings/access` to create/approve users by email
  - first-admin bootstrap command: `pnpm auth:bootstrap-admin -- <email> [name]`
  - explicit no-membership authenticated state routed to `/settings/organizations`
- New ADR 029 documenting closed auth + invite-only membership model.
- New DI guardrails and tests:
  - `src/__tests__/app-construction-guard.test.ts` to block direct project-class
    construction in `src/app/**`.
  - `src/__tests__/composition-root-boundary.test.ts` to enforce repository
    construction only in the composition root.
  - `src/infrastructure/container/create-test-app-container.ts` for test-time
    container construction with optional overrides.
- App-level signup controls with `AUTH_SELF_REGISTRATION_ENABLED` and
  `AUTH_ADMIN_EMAILS` for controlled access in production.
- New admin-only `/settings/access` page to manage:
  - user approval/revocation
  - app admin role assignment
  - linked identity providers
  - organization memberships per user
- User access data model fields on `users`:
  - `first_name`, `last_name`, `is_approved`, `is_admin`
- New ADR 025 documenting controlled signup and admin access management.
- New ADR 026 documenting searchable organization member assignment from the
  existing user directory, PII visibility decisions, and unchanged signup policy.
- New ADR 027 documenting the split between organization creation and active
  organization member management settings flows.
- Moved the user Avatar and Sign out button to the far right side of the application header.
- Organization-scoped collaboration model:
  - New `organizations` and `organization_memberships` tables
  - `trips.organization_id` scope for trip visibility and mutations
  - Active organization switcher on the dashboard
  - Owner-managed member assignment via searchable existing-user directory
  - Owner-only trip move between organizations
- First-sign-in organization bootstrap:
  - Users with no memberships now get a personal workspace automatically
  - Personal workspace naming convention:
    - `"<user.name>'s Workspace"` when a name exists
    - `"<email-local-part>'s Workspace"` when no name exists
    - `Local Dev Workspace` for local-dev auth user
- New e2e acceptance coverage for organization sharing, first-login bootstrap,
  owner/member permissions, and trip reassignment between organizations.
- Terraform infrastructure under `infra/` with split stacks for production and
  preview environments (`infra/stacks/prod`, `infra/stacks/preview`) and reusable
  modules for Vercel and Neon resources.
- New infrastructure GitHub workflows:
  - `infra-validate.yml` for Terraform fmt/validate and migration SQL policy checks
  - `infra-prod.yml` for production stack apply
  - `infra-preview.yml` for per-PR preview stack apply/cleanup
- Deployment migration command `pnpm db:migrate:deploy` with PostgreSQL advisory
  locking for safer concurrent deploy behavior.
- Transaction-safety guard `pnpm db:check:migrations` to reject migration SQL
  statements that cannot run safely in transaction-scoped deploy migrations.
- Edit trip: users can now update a trip's name, total budget, and status
  (planning / active / completed) via an Edit trip button on the trip detail page.
  Reducing the budget below existing fixed costs + destination allocations is
  rejected with a clear error message (ADR 013).
- `validateTripBudgetEdit` domain guard enforces the budget invariant on edits.
- Integration test for `get-country-references` use case (previously missing).
- `seedCountryReference` factory in the test harness (`src/infrastructure/testing/helpers.ts`).
- Dev-only local login fallback: in development, a one-click **Sign in locally (dev)**
  path is now available for manual testing without configuring Google OAuth. The
  local flow provisions/reuses a stable test user so trip ownership remains
  consistent across sessions.
- Owner-only trip deletion: organization owners can now permanently delete a trip
  from the trip detail page via a confirmation modal. Deleting a trip hard-deletes
  associated fixed costs, destinations, and spend entries via database cascades
  (ADR 022).

### Changed
- Invite emails now render through a shared branded base template
  (`src/application/email/base-email-template.ts`) to standardize layout and
  styling across future notification email types.
- User pre-provision repository contract now returns approval transition metadata
  (`approved_now` vs `already_approved`) to support deterministic invite send rules.
- Terraform production stack now manages email runtime env vars
  (`RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`).
- Sign-in policy is now DB-driven only (`user exists && is_approved`) with no
  environment-variable signup toggles.
- Organization creation is now admin-only.
- First-sign-in personal workspace bootstrap has been removed.
- Runtime dependency wiring now uses a composition-root container in
  `src/infrastructure/container/`; app/auth/organization runtime entrypoints
  resolve repositories via `getAppContainer()` instead of constructing Drizzle
  repositories directly.
- Authenticated request context now enforces access policy checks so revoked users
  lose app access on the next request.
- Settings now include section tabs for organization management and app-level access
  management.

- Vercel build command is now intended to run migrations in deployment:
  `pnpm build && pnpm db:migrate:deploy`.
- Preview auth configuration now supports `AUTH_ENABLE_LOCAL_DEV=true` to allow
  local-dev credentials in preview deployments while production remains SSO-only.
- Integration test files renamed from `.test.ts` to `.int-test.ts` suffix; Vitest config
  now uses file-suffix globs (`src/**/*.int-test.ts`) so new integration tests are
  auto-discovered without updating the config (ADR 012)
- Local development startup is now one command: `pnpm dev` auto-starts a
  throwaway Postgres container via Testcontainers when `POSTGRES_URL` is
  missing, runs migrations + reference-data seed, injects safe auth env
  defaults for local bootstrapping, and auto-detects Docker context settings
  (including Colima socket overrides)
- `.env.example` no longer hard-codes `POSTGRES_URL`, so local setup defaults
  to auto-bootstrapped Postgres unless developers opt into a custom database.
- CI: `unit-test` job now runs `pnpm test:unit`; new `integration-test` job runs
  `pnpm test:integration` in stage 2; E2E gate moved to stage 3 (needs integration-test)
- `CONTRIBUTING.md`: added test file naming convention table and mandatory pre-push
  checklist
- Auth sign-in UX now adapts to configured providers:
  - Development: local dev login is always shown.
  - Development: Google login is shown only when `AUTH_GOOGLE_ID` and
    `AUTH_GOOGLE_SECRET` are non-placeholder values.
  - Production: local dev login is hidden.
- Settings organization management is now split by intent:
  - `/settings/organizations` handles organization creation and organization list
  - `/settings/organization` handles member management for the active organization
  - top-level `Settings` navigation now targets `/settings/organizations`
- Authenticated navigation now uses a full-width sticky two-row header:
  - utility row for organization context and account controls
  - section row for `Trips`/`Settings` tabs with active-route state
  This replaces the compact boxed header and improves scalability for future
  global controls across desktop and mobile layouts.

### Removed

- `AUTH_SELF_REGISTRATION_ENABLED` and `AUTH_ADMIN_EMAILS` from runtime and infra configuration
  (app config, dev bootstrap, e2e web-server bootstrap, Terraform, and infra workflows).
- Automatic personal organization creation during auth/request context.

### Fixed

- Invite email provider misconfiguration is now explicit in production:
  - `LoggingEmailService` no longer reports false success when used as a
    production fallback
  - runtime now emits `email_provider_misconfigured` and returns invite send
    failure to the calling use case
  - provider routing now uses a strict Vercel contract only:
    `VERCEL_ENV=production` + `RESEND_API_KEY`
- Auth access checks now normalize and compare email addresses more robustly
  (trim + lowercase, Gmail alias canonicalization) to prevent false
  `AccessDenied` responses for allowed users.
- User/session resolution and access-policy DB lookups now use the same
  Gmail/Googlemail canonicalization logic as sign-in evaluation, preventing
  false denials when provider-returned aliases differ from stored emails.
- Added one-time migration backfill to set `is_approved=true` for existing
  admin users and trim whitespace from stored user emails.
- Preview/local-dev credentials sign-ins now receive bootstrap admin access
  when `AUTH_ENABLE_LOCAL_DEV=true`, so `/settings/access` remains reachable
  in preview environments that expose local-dev login.
- Admin allowlist parsing now supports comma, newline, and semicolon separators,
  and Google `email_verified` checks accept common truthy payload variants to
  reduce false `AccessDenied` failures during OAuth callbacks.
- Local development no longer crashes on startup when an existing auth session
  references a user ID not present in the current database (for example after
  local DB reset/rebootstrap); the app now resolves or recreates the session user
  before organization bootstrap.
- Preview deployments for non-PR branches no longer fail with missing
  `POSTGRES_URL`; Terraform now sets a default preview database URL while
  PR-specific preview branches continue to receive branch-scoped DB URLs.
- Preview Terraform apply now avoids Neon account-tier endpoint errors by not
  forcing a suspend interval on preview branch endpoints.
- Preview Terraform apply now waits for Neon branch endpoints before creating
  branch roles, reducing branch bootstrap races during apply.
- Preview Auth.js login no longer fails with `UntrustedHost` on Vercel preview
  domains; host trust is now explicitly enabled in auth config and Terraform-managed
  env vars for preview and production.
- Production Google SSO avatars now render correctly by allowing Google-hosted
  profile image domains in Next.js image configuration and falling back to
  initials if an avatar URL cannot be loaded.
- Dark mode accessibility across dashboard and trip detail pages: low-contrast
  text, cards, forms, and modal surfaces now use explicit dark-theme colors;
  create/edit trip modals no longer render as bright white overlays in dark mode.
- Added dark-mode accessibility regression coverage in Playwright for the
  dashboard create-trip modal and trip detail page.
- Lint: replaced non-null assertion (`!`) in `helpers.ts` and `spend-entry.ts` with
  explicit null-checks (biome `noNonNullAssertion`)
- TypeScript: `global-setup.ts` container teardown now returns `Promise<void>` to satisfy
  the `containerStop` type
- `DestinationSection.tsx`: corrected JSX fragment indentation (biome format)
- Dev auth: local-dev sign-in no longer depends on `ON CONFLICT (email)` upsert semantics,
  preventing `CallbackRouteError` on drifted local schemas where the expected unique
  constraint is missing.

## [0.4.0] - 2026-02-25

### Added

- Integration test suite: repository layer (5 files) and application use-case layer (9 files)
  tested against a real PostgreSQL database via Testcontainers — no mocks; ~55 new tests
- Reusable test harness: `src/infrastructure/testing/helpers.ts` with `createTestDb()`,
  `truncateAll()`, and typed seed factories (`seedUser`, `seedTrip`, `seedDestination`,
  `seedFixedCost`, `seedSpendEntry`) consumed by all integration test files
- `vitest-mock-extended` dev dependency for Mockito-style mocking in future adapter tests
- `pnpm test:unit` and `pnpm test:integration` scripts; Vitest projects split (unit runs
  without Docker, integration starts a Testcontainers Postgres container)
- `nextFixedCostSortOrder` pure domain function extracted to `src/domain/trip/trip.ts`
- `toSpendCategory()` and `toComfortLevel()` type-guard helpers in server actions — eliminates
  all unsafe `as SpendCategory` / `as ComfortLevel` casts
- Error states on remove/delete UI actions: `DestinationCard`, `SpendEntryRow`, and
  `FixedCostRow` now surface network/server errors to the user rather than silently swallowing
  them inside `useTransition`
- Spend entry edit and delete E2E tests (`tests/e2e/03-spend.spec.ts`)
- Trip detail page accessibility audit at three canonical viewports
  (`tests/e2e/accessibility.spec.ts`)
- Release Please GitHub Actions workflow (`.github/workflows/release-please.yml`) for
  automated versioning, CHANGELOG generation, and GitHub Releases from conventional commits
- ADR 011 documenting the GBP-only MVP currency decision
- `CONTRIBUTING.md` internal team guide: prerequisites, setup, test commands, commit
  conventions, branch workflow, and release process

### Fixed

- `createTripAction` now returns `{ error: string | null }` consistent with all other server
  actions — previously it `throw`s, forcing `CreateTripForm` to wrap it in a `.catch()` shim
- `calculateTotalSpend` now throws on mixed-currency entries instead of silently returning
  the wrong total
- `removeDestination` use case no longer accepts a dead `ownerId` parameter
- `COMFORT_LABELS` extracted from inside `DestinationCard` render to module-level constant

### Added

- Destination editing: each destination card now has an **Edit** button that expands an inline
  form pre-filled with the existing name, country, estimated budget, comfort level, and dates;
  the budget suggestion hint is shown (same as when adding); changes are saved immediately and
  all budget totals update in real time
- `validateDestinationEdit` domain function — uses a delta approach: only a budget *increase*
  consumes available headroom, so `canAllocateBudget` is called with `newBudget − oldBudget`
  rather than the full new amount, avoiding any exclusion logic
- `editDestination` application use case
- `editDestinationAction` server action (verifies trip ownership before mutating)
- `EditDestinationForm` client component

### Fixed

- Application failed to build in CI (`next build`) because `auth/index.ts` called
  `DrizzleAdapter(getDb(), …)` at module-evaluation time without a database available;
  `auth/index.ts` now imports the shared `db` singleton from `client.ts` (removing the
  duplicate connection) and `next build` is run with a syntactically-valid dummy
  `POSTGRES_URL` — the `postgres` library is lazy so no TCP connection is ever opened
  during the build phase (see ADR 010)

### Also in this branch (previous commit)

- Spend entry editing: each recorded spend item now shows an **Edit** button that expands
  an inline form pre-filled with the existing amount, date, category, and description; changes
  are saved immediately and the page reflects the updated totals
- Spend entry deletion: a **Delete** button on each spend item removes the entry and recalculates
  the destination's total spend in real time
- `deleteSpendEntry` and `editSpendEntry` application use cases
- `deleteSpendEntryAction` and `editSpendEntryAction` server actions (both verify trip ownership
  before mutating)
- `EditSpendEntryForm` client component

### Also in this branch (previous commit)

- Trip fixed costs: `trip_fixed_costs` table replaces single `ringfenced_amount` field; users
  can now add named line items (flights, insurance, phone contract, Netflix, etc.) each deducted
  from the available budget; add/remove per trip from a new `FixedCostSection` on the trip page
- `TripFixedCost` domain type, `TripFixedCostRepository` interface, `DrizzleTripFixedCostRepository`
- `calculateTotalFixedCosts` domain function; `calculateAvailableBudget`, `canAllocateBudget`, and
  `getTripBudgetSummary` now accept `fixedCosts[]` instead of a single ringfenced amount
- `addFixedCost` and `removeFixedCost` application use cases
- `drizzle/0000_initial_schema.sql` — complete SQL migration covering all tables including
  `trip_fixed_costs` and `country_reference_data` (replaces `drizzle-kit push` for production)
- Charts via Recharts: budget breakdown donut (fixed costs / destinations / available), estimated
  vs actual grouped bar per destination, spend by category donut — all computed server-side and
  passed as props; rendered conditionally when data exists
- ADR 005 (trip fixed costs) and ADR 006 (charts) documenting design decisions
- 6 new unit tests for `calculateTotalFixedCosts` and updated budget tests; total: 66 passing

### Changed

- `CreateTripForm` simplified — ringfenced fieldset removed; hardcoded "Australia Visa & Living"
  defaults gone; hint text directs user to add fixed costs after trip creation
- Budget overview card now shows per-line fixed cost deductions instead of a single "Ringfenced"
  row
- `addDestination` use case now accepts `TripFixedCostRepository` to validate budget including
  all fixed costs
- Dashboard trip cards: removed ringfenced label display (no longer on `Trip` type)

### Also in this branch (previous commit)

- Country reference data: `country_reference_data` DB table seeded with 33 countries and their
  mid-range daily travel costs in GBP pence (Japan £80/day, Thailand £35/day, etc.)
- `CountryReference` domain type, `CountryReferenceRepository` interface, and
  `DrizzleCountryReferenceRepository` implementation
- `findReference` and `suggestBudget` pure domain functions, with 14 unit tests
- `COMFORT_MULTIPLIERS` constant (budget 0.65×, mid 1.0×, luxury 1.8×) used by suggestion engine
- `destinationDays` domain function deriving trip duration from start/end dates, with 6 unit tests
- `getCountryReferences` application use case
- `pnpm db:seed` script — idempotent upsert of country reference seed data
- Budget suggestion hint on Add Destination form: when country + dates + comfort level are filled,
  shows "Suggested £X,XXX — N days in [Country] (mid-range)" beneath the budget input
- Start/end date inputs on Add Destination form (both optional)
- Duration display ("· 45 days") shown on destination cards when dates are set
- ADR 004 documenting the country reference data design decisions

### Changed

- `AddDestinationForm` is now a controlled component tracking country, dates, and comfort level
  for client-side suggestion computation — no server round-trip needed
- `DestinationSection` now accepts and forwards `countryReferences` prop
- Trip detail page now fetches country references in parallel with destinations and spend
- Server action `addDestinationAction` now parses optional `startDate` / `endDate` fields

### Also in this branch (previous commit)

- `CONSTITUTION.md` section 1 "The Harness": enforcement map table, feedback loop command, and
  context efficiency rules derived from OpenAI harness engineering principles
- Per-layer `AGENTS.md` files in `src/domain/`, `src/application/`, `src/infrastructure/`
- `AGENTS.md` restructured as concise operational quick-reference
- Application renamed from "Wanderlust Budget" to "Travel Planner" throughout codebase
- `README.md` replaced auto-generated Next.js starter with project-specific content

## [0.3.0] - 2026-02-23

### Added

- Destination management: add and remove destinations per trip, validated against the trip's
  budget allocation invariant (allocated + ringfenced ≤ total)
- Spend recording: log expenditure against a destination with amount, date, category, and
  optional description
- Budget dashboard: per-destination spend progress bars and over-spend warning badges on the
  trip detail page
- Playwright e2e test scaffolding with acceptance criteria for auth, trips, destinations, and
  spend flows (auth-required tests skip gracefully without `PLAYWRIGHT_AUTH_TOKEN`)
- `DestinationRepository` and `SpendEntryRepository` interfaces in the domain layer
- `DrizzleDestinationRepository` and `DrizzleSpendEntryRepository` infrastructure
  implementations
- `addDestination`, `removeDestination`, and `recordSpend` application use cases
- `validateNewDestination` and `nextSortOrder` domain functions with full unit test coverage

### Changed

- Trip detail page redesigned with `BudgetOverviewCard` showing total / ringfenced /
  allocated / available budget rows plus a progress bar

## [0.2.0] - 2026-02-22

### Added

- Biome v2 replaces ESLint + Prettier + typescript-eslint as the single lint/format tool
- ADR 002 documenting the rationale for the Biome migration

### Changed

- All source files reformatted to Biome style (single quotes, 100-column, trailing commas)
- Import organisation delegated to Biome's assist action

### Removed

- ESLint, typescript-eslint, and related packages removed from devDependencies

## [0.1.0] - 2026-02-22

### Added

- Initial project bootstrap: Next.js 15, TypeScript strict mode, pnpm, Tailwind CSS v4
- DDD-inspired layered architecture: `domain/` → `application/` → `infrastructure/` → `ui/`
- Drizzle ORM schema: users, accounts, sessions, trips, destinations, spend entries tables
- Auth.js v5 with Google OAuth and Drizzle adapter; JWT session strategy
- Route protection middleware
- Trip aggregate with budget invariant logic (`calculateAvailableBudget`,
  `canAllocateBudget`, `getTripBudgetSummary`)
- Destination and SpendEntry domain types with validation functions
- Create Trip form with modal, server action, and Drizzle persistence
- Dashboard listing all trips for the authenticated user
- Trip detail page with budget summary card
- Vitest unit tests (34 passing); architecture tests enforcing layer import boundaries
- GitHub Actions CI pipeline: lint → type-check → test
- ADR 001 documenting the initial stack decisions
