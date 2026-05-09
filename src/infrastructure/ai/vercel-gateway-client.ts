import { createAnthropic } from '@ai-sdk/anthropic';

/**
 * Default Vercel AI Gateway base URL for Anthropic.
 * Override via AI_GATEWAY_BASE_URL for self-hosted gateways or testing.
 */
const DEFAULT_GATEWAY_BASE_URL = 'https://gateway.ai.vercel/v1/anthropic';

/**
 * Default Anthropic model for itinerary parsing and timeline insights.
 * Sonnet 4.6 balances speed and reasoning quality for travel-domain extraction.
 * Override via AI_GATEWAY_MODEL.
 */
export const DEFAULT_MODEL_ID = 'claude-sonnet-4-6';

export type GatewayConfig = {
  readonly apiKey: string;
  readonly baseURL: string;
  readonly modelId: string;
};

export function readGatewayConfig(): GatewayConfig | null {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey || apiKey.trim() === '') return null;
  return {
    apiKey: apiKey.trim(),
    baseURL: process.env.AI_GATEWAY_BASE_URL?.trim() || DEFAULT_GATEWAY_BASE_URL,
    modelId: process.env.AI_GATEWAY_MODEL?.trim() || DEFAULT_MODEL_ID,
  };
}

export function createGatewayModel(config: GatewayConfig) {
  const provider = createAnthropic({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
  return provider(config.modelId);
}
