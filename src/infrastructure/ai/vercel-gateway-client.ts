/**
 * Default Anthropic model id for itinerary parsing and timeline insights.
 * The `provider/model` form is resolved by the AI SDK's gateway provider
 * (`@ai-sdk/gateway`) and routed through the Vercel AI Gateway, which in
 * turn dispatches to Anthropic. Override via AI_GATEWAY_MODEL.
 */
export const DEFAULT_MODEL_ID = 'anthropic/claude-sonnet-4-6';

/**
 * True if either authentication mechanism the gateway provider supports is
 * available:
 *   - `AI_GATEWAY_API_KEY` — explicit Vercel AI Gateway key (local dev / CI).
 *   - `VERCEL_OIDC_TOKEN` — automatically injected on Vercel deployments.
 *
 * The gateway provider in `@ai-sdk/gateway` prefers the API key when both
 * are set and falls back to the OIDC token otherwise. Mirrors that
 * precedence here so the container can decide whether to wire real or
 * no-op AI services.
 *
 * See https://vercel.com/docs/ai-gateway/authentication-and-byok.
 */
export function hasAiCredentials(): boolean {
  if ((process.env.AI_GATEWAY_API_KEY ?? '').trim() !== '') return true;
  if ((process.env.VERCEL_OIDC_TOKEN ?? '').trim() !== '') return true;
  return false;
}

export function gatewayModelId(): string {
  const override = process.env.AI_GATEWAY_MODEL?.trim();
  return override && override !== '' ? override : DEFAULT_MODEL_ID;
}
