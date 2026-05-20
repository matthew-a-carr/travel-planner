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
 */

test.describe('GET /api/v1/me — authenticated cookie session', () => {
  test('receives the user shape', async ({ request }) => {
    const response = await request.get('/api/v1/me');

    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toBe('no-store');

    const body = await response.json();
    expect(body).toMatchObject({
      id: expect.any(String),
      email: expect.any(String),
      isApproved: true,
    });
  });
});

test.describe('GET /api/v1/me — no session', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('returns 401 unauthenticated', async ({ request }) => {
    const response = await request.get('/api/v1/me');

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({
      error: {
        code: 'unauthenticated',
        message: expect.any(String),
      },
    });
  });
});
