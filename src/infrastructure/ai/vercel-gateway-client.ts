/**
 * Default Anthropic model id for itinerary parsing and timeline insights.
 * The `provider/model` form is resolved by the AI SDK's gateway provider
 * (`@ai-sdk/gateway`) and routed through the Vercel AI Gateway, which in
 * turn dispatches to Anthropic. Override via AI_GATEWAY_MODEL.
 */
export const DEFAULT_MODEL_ID = 'anthropic/claude-sonnet-4-6';

/**
 * True when AI Gateway calls have a chance of authenticating.
 *
 * Two paths:
 *  1. `AI_GATEWAY_API_KEY` is set — explicit gateway key (local dev / non-Vercel CI).
 *  2. We're running on a Vercel Function (`VERCEL=1`) — the platform delivers
 *     the OIDC token per-request as the `x-vercel-oidc-token` header.
 *     The gateway provider reads it via `getVercelOidcToken()` at call time.
 *     Project must have `oidc_token_config` set in Terraform / OIDC enabled
 *     in Project Settings → Security; otherwise the call surfaces a 401.
 *
 * Note on `VERCEL_OIDC_TOKEN`: that env var is only populated **at build
 * time**, not at runtime. Reading `process.env.VERCEL_OIDC_TOKEN` from a
 * Vercel Function returns empty — historically this returned `false` here
 * and silently routed every production call to the no-op fallback. See
 * https://vercel.com/docs/oidc#in-vercel-functions.
 */
export function hasAiCredentials(): boolean {
  if ((process.env.AI_GATEWAY_API_KEY ?? '').trim() !== '') return true;
  if ((process.env.VERCEL ?? '').trim() === '1') return true;
  return false;
}

export function gatewayModelId(): string {
  const override = process.env.AI_GATEWAY_MODEL?.trim();
  return override && override !== '' ? override : DEFAULT_MODEL_ID;
}
