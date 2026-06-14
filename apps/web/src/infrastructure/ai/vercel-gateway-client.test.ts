import { afterEach, describe, expect, it, vi } from 'vitest';
import { gatewayModelId, hasAiCredentials } from './vercel-gateway-client';

describe('hasAiCredentials', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns false when neither AI_GATEWAY_API_KEY nor VERCEL is set', () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '');
    vi.stubEnv('VERCEL', '');
    expect(hasAiCredentials()).toBe(false);
  });

  it('returns true when AI_GATEWAY_API_KEY has a value', () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', 'sk-fake');
    vi.stubEnv('VERCEL', '');
    expect(hasAiCredentials()).toBe(true);
  });

  it('treats whitespace-only AI_GATEWAY_API_KEY as missing', () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '   ');
    vi.stubEnv('VERCEL', '');
    expect(hasAiCredentials()).toBe(false);
  });

  it('returns true on Vercel runtime (VERCEL=1) — OIDC token arrives per-request via header', () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '');
    vi.stubEnv('VERCEL', '1');
    expect(hasAiCredentials()).toBe(true);
  });

  it('only treats VERCEL=1 as a Vercel runtime signal, not arbitrary truthy values', () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '');
    vi.stubEnv('VERCEL', 'true');
    expect(hasAiCredentials()).toBe(false);
  });

  it('does NOT trust process.env.VERCEL_OIDC_TOKEN — it is only set at build time', () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '');
    vi.stubEnv('VERCEL', '');
    vi.stubEnv('VERCEL_OIDC_TOKEN', 'eyJhbGciOiJSUzI1NiIs.fake.oidc-jwt');
    expect(hasAiCredentials()).toBe(false);
  });
});

describe('gatewayModelId', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the default GPT-5.4 Mini model id when AI_GATEWAY_MODEL is unset', () => {
    vi.stubEnv('AI_GATEWAY_MODEL', '');
    expect(gatewayModelId()).toBe('openai/gpt-5.4-mini');
  });

  it('returns the override when AI_GATEWAY_MODEL is set', () => {
    vi.stubEnv('AI_GATEWAY_MODEL', 'anthropic/claude-sonnet-4-6');
    expect(gatewayModelId()).toBe('anthropic/claude-sonnet-4-6');
  });
});
