import {
  apiErrorEnvelopeSchema,
  apiSuccessSchema,
  ENVELOPE_VERSION,
  meResponseSchema,
} from '@travel-planner/shared';
import { expect, test } from '@playwright/test';

/**
 * First Playwright e2e for the /api/v1 surface. Cookie path only —
 * the bearer path is exercised by the route's integration tests, which
 * cover more branches at lower cost than e2e.
 *
 * The authenticated test uses the storageState written by
 * global.setup.ts (auth-state.json). The unauthenticated test
 * overrides storageState to an empty one, following the pattern in
 * auth.spec.ts.
 *
 * Updated for SPEC-008 / ADR 056: every response now carries the
 * standard envelope. Success bodies are parsed via
 * apiSuccessSchema(meResponseSchema); error bodies via
 * apiErrorEnvelopeSchema.
 */

const meSuccessEnvelope = apiSuccessSchema(meResponseSchema);

test.describe('GET /api/v1/me — authenticated cookie session', () => {
  test('receives the user shape wrapped in the standard envelope', async ({ request }) => {
    const response = await request.get('/api/v1/me');

    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toBe('no-store');

    const body = await response.json();
    const parsed = meSuccessEnvelope.parse(body);
    expect(parsed.data).toMatchObject({
      id: expect.any(String),
      email: expect.any(String),
      isApproved: true,
    });
    expect(parsed.request.path).toBe('/api/v1/me');
    expect(parsed.request.method).toBe('GET');
    expect(parsed.version).toBe(ENVELOPE_VERSION);
    expect(parsed.asof).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});

test.describe('GET /api/v1/me — no session', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('returns 401 unauthenticated in the RFC 7807 + code envelope', async ({ request }) => {
    const response = await request.get('/api/v1/me');

    expect(response.status()).toBe(401);
    const body = await response.json();
    const parsed = apiErrorEnvelopeSchema.parse(body);
    expect(parsed.error.code).toBe('unauthenticated');
    expect(parsed.error.status).toBe(401);
    expect(parsed.error.type).toBe('https://travel-planner.app/errors/unauthenticated');
    expect(parsed.error.instance).toBe('/api/v1/me');
    expect(parsed.request.path).toBe('/api/v1/me');
  });
});
