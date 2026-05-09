# ADR 040: Vercel AI Gateway for In-App Itinerary AI

**Date:** 2026-05-09
**Status:** Accepted

## Context

The Timeline tab (ADR 041) integrates two AI-powered affordances directly in the
product UI:

1. **Paste-to-Timeline** — extract destination rows (country, city, dates, comfort
   level) from a free-form pasted itinerary or booking confirmation.
2. **Timeline insights** — surface non-obvious findings (seasonality warnings,
   missing inter-country transport) on a constructed itinerary.

Neither affordance is a chatbot. Both call the LLM with a structured schema and
consume its typed output directly. We needed a hosting choice that:

- works on the project's current Vercel tier (no Pro-only feature dependencies),
- keeps the vendor surface area small (no new accounts/dashboards),
- supports model-agnostic routing in case we want to switch providers later, and
- gives us per-endpoint observability and spend caps without building a custom
  proxy.

## Decision

Use the **Vercel AI Gateway** as the only outbound LLM endpoint. Talk to it
through the **Vercel AI SDK** (`ai` + `@ai-sdk/anthropic`) using
`generateObject` with Zod schemas.

The default model is **Google Gemini 3 Flash**, exposed via the gateway under
model id `google/gemini-3-flash` and overridable via `AI_GATEWAY_MODEL`. We
moved off Claude Sonnet 4.6 (the original choice — see *Provider selection*
below) for cost: Flash 3 is roughly an order of magnitude cheaper on input
tokens and ~6× cheaper on output tokens, with reasoning quality competitive
for itinerary extraction, timeline insights, and conversational tool-use.
The override mechanism is unchanged so individual deployments can switch
back per-environment if needed.

### Provider selection

Anthropic Claude Sonnet 4.6 was chosen for itinerary extraction and travel
reasoning over the cheaper `gpt-4o-mini` option — the cost difference is
negligible at expected volumes (a few requests per active trip per day) and the
extraction quality on noisy travel text is meaningfully better.

### Why the Gateway and not direct Anthropic

- Single env var (`AI_GATEWAY_API_KEY`) for local/CI, plus `VERCEL_OIDC_TOKEN`
  auto-injected on Vercel deployments — see "Authentication" below.
- Built-in caching at the gateway layer for identical requests is a free
  second-line defence behind our application-level `ai_cache` table.
- Spend caps and per-route metrics are configured in the Vercel dashboard with
  no application code.
- Switching providers later (OpenAI, Google) is a one-line model id change.

### Authentication: OIDC on Vercel, API key elsewhere

Production runs on Vercel. **Two things must be true for the OIDC path to
work** — both turned out to be subtle:

1. **OIDC must be enabled on the Vercel project** (Project Settings →
   Security → Secure backend access with OIDC federation). We enable it via
   Terraform: the `vercel-project` module sets
   `oidc_token_config = { issuer_mode = "team" }`. With OIDC disabled, no
   token is issued and `getVercelOidcToken()` throws.
2. **The token is delivered per-request via the `x-vercel-oidc-token`
   request header**, not via `process.env.VERCEL_OIDC_TOKEN`. That env var
   is only populated *at build time*; reading it at runtime returns empty.
   See https://vercel.com/docs/oidc#in-vercel-functions.

The gateway provider in `@ai-sdk/gateway` resolves credentials in this order:

1. `AI_GATEWAY_API_KEY` — explicit override (local dev, CI, emergency).
2. `getVercelOidcToken()` — reads the request header (or env var as a
   fallback) and exchanges it with the gateway.

Our pre-flight `hasAiCredentials()` reflects the same model. It treats
either `AI_GATEWAY_API_KEY` *or* `VERCEL=1` (the platform-set marker that
we're inside a Vercel Function invocation) as sufficient — actual OIDC
auth happens at call time. **It does not look at
`process.env.VERCEL_OIDC_TOKEN`** because that env var is build-time only.

We rely on OIDC in production. **No long-lived AI Gateway secret is stored
in Terraform or Vercel project env vars.** Local dev and CI use an explicit
`AI_GATEWAY_API_KEY` (in `.env.local` or as a CI secret). This eliminates a
class of credential-rotation work entirely on Vercel.

To activate the simpler architecture we pass the model as a *string id*
(`'google/gemini-3-flash'`, or `'anthropic/claude-sonnet-4-6'`, etc.)
rather than constructing a provider with a baseURL override. The AI SDK routes string ids through
the gateway provider automatically. We dropped the `@ai-sdk/anthropic`
dependency in favour of this pattern; only `ai` and `zod` remain.

Reference: https://vercel.com/docs/ai-gateway/authentication-and-byok.

### Application-level caching

A new `ai_cache` table (Drizzle migration `0010_magenta_thunderbolts`) stores
parser and insights outputs keyed by SHA-256 of the kind + canonicalised
input. TTLs:

- Parser: 7 days. The same paste produces the same answer.
- Insights: 24 hours. Auto-invalidated when destinations or fixed costs change
  (the cache key incorporates a stable JSON fingerprint of the trip's state).

The cache lives in Postgres (already provisioned via Neon) rather than Vercel
KV so the feature works on Hobby tier without additional vendors.

### No-op fallbacks (per-request resolution)

The container exposes one `ItineraryParser` / `TimelineInsightsService` /
`ChatAssistantService` for the whole app — that's the DI seam. But the
real-vs-fallback decision is made **per call**, not at construction time.

`src/infrastructure/ai/runtime-aware-services.ts` defines a tiny router
per port. `createAiServices()` always wires the router with both
implementations behind it; on every method call the router calls
`hasAiCredentials()` and delegates to either the Anthropic-backed real
class or the no-op class. Why not check at construction:

- The container is a process-wide singleton (`getAppContainer()`). A
  one-time check would freeze the answer for the worker's lifetime.
- The OIDC token is delivered per-request (`x-vercel-oidc-token` header),
  so even though `VERCEL=1` is stable on Vercel, the spirit of the check
  is "can the gateway authenticate *right now*?" — that has to be
  evaluated alongside each request.
- Stubbing env vars in tests works without rebuilding the container.

When `hasAiCredentials()` returns false (local dev without a gateway,
non-Vercel CI, test runs), the fallback path is used: `NoOpItineraryParser`
returns a clear "AI gateway not configured" error, `NoOpTimelineInsights`
returns no AI findings (deterministic findings still render), and
`NoOpChatAssistant` returns the same error so the chat drawer surfaces
"AI offline" rather than crashing.

### Architecture boundaries

- `src/application/ports/itinerary-parser.ts` and
  `timeline-insights-service.ts` are the only types use cases see.
- `src/infrastructure/ai/` holds adapters, the gateway client, and Zod schemas.
  Use cases never import zod or the AI SDK.
- The AI cache is wired into the runtime container alongside other
  repositories.

## Consequences

- One new managed dependency (Vercel AI Gateway). No new long-lived secret in
  production — OIDC handles auth. `AI_GATEWAY_API_KEY` is only needed for
  local dev and non-Vercel CI.
- Two new npm packages: `ai`, `zod`. (`@ai-sdk/anthropic` is *not* needed —
  the gateway provider routes Anthropic calls via the string-model shorthand.)
- The application keeps working with the gateway disabled — no hard dep.
- Observability and cost ceilings are handled at the gateway. We do not build
  request-counting or budget-enforcement plumbing of our own.

## Alternatives considered

- **Direct Anthropic SDK** — more direct, but loses model swap-out and a single
  observability surface. Adds Anthropic-only metrics rather than per-endpoint
  view.
- **Vercel KV for cache** — Pro-tier only. Postgres caching is already wired
  and adequate for the volumes involved.
- **OpenAI gpt-4o-mini** — slightly cheaper but materially weaker on noisy
  travel-text extraction in spot checks. Reconsider if Claude pricing rises.
- **No caching, rely on gateway only** — gateway caching is opaque and may be
  invalidated independently. Application-level cache also serves as a
  deterministic test seam.
