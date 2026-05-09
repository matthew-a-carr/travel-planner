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

The default model is **Anthropic Claude Sonnet 4.6**, exposed via the gateway
under model id `claude-sonnet-4-6` and overridable via `AI_GATEWAY_MODEL`.

### Provider selection

Anthropic Claude Sonnet 4.6 was chosen for itinerary extraction and travel
reasoning over the cheaper `gpt-4o-mini` option — the cost difference is
negligible at expected volumes (a few requests per active trip per day) and the
extraction quality on noisy travel text is meaningfully better.

### Why the Gateway and not direct Anthropic

- Single env var (`AI_GATEWAY_API_KEY`) instead of provider-specific creds.
- Built-in caching at the gateway layer for identical requests is a free
  second-line defence behind our application-level `ai_cache` table.
- Spend caps and per-route metrics are configured in the Vercel dashboard with
  no application code.
- Switching providers later (OpenAI, Google) is a one-line model id change.

### Application-level caching

A new `ai_cache` table (Drizzle migration `0010_magenta_thunderbolts`) stores
parser and insights outputs keyed by SHA-256 of the kind + canonicalised
input. TTLs:

- Parser: 7 days. The same paste produces the same answer.
- Insights: 24 hours. Auto-invalidated when destinations or fixed costs change
  (the cache key incorporates a stable JSON fingerprint of the trip's state).

The cache lives in Postgres (already provisioned via Neon) rather than Vercel
KV so the feature works on Hobby tier without additional vendors.

### No-op fallbacks

When `AI_GATEWAY_API_KEY` is unset (local dev without a gateway, CI builds,
test runs), the container wires `NoOpItineraryParser` and
`NoOpTimelineInsights`. The UI surfaces a discreet "AI offline" badge in the
insights panel; deterministic findings (gaps, overlaps, budget vs reference)
still render. The feature degrades gracefully rather than gating the timeline
view.

### Architecture boundaries

- `src/application/ports/itinerary-parser.ts` and
  `timeline-insights-service.ts` are the only types use cases see.
- `src/infrastructure/ai/` holds adapters, the gateway client, and Zod schemas.
  Use cases never import zod or the AI SDK.
- The AI cache is wired into the runtime container alongside other
  repositories.

## Consequences

- One new managed dependency (Vercel AI Gateway). One new sensitive env var.
- Three new npm packages: `ai`, `@ai-sdk/anthropic`, `zod`.
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
