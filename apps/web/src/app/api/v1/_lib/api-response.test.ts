import { describe, expect, it } from 'vitest';
import { apiError, apiOk, type ApiErrorCode } from './api-response';

describe('apiOk', () => {
  it('serialises the value as JSON with status 200 by default', async () => {
    const response = apiOk({ greeting: 'hi' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ greeting: 'hi' });
  });

  it('accepts a custom status (e.g. 201 for created)', async () => {
    const response = apiOk({ id: 'abc' }, 201);
    expect(response.status).toBe(201);
  });
});

describe('apiError', () => {
  const cases: ReadonlyArray<{ code: ApiErrorCode; status: number }> = [
    { code: 'unauthenticated', status: 401 },
    { code: 'account_pending_approval', status: 403 },
    { code: 'forbidden', status: 403 },
    { code: 'not_found', status: 404 },
    { code: 'gone', status: 410 },
    { code: 'invalid_input', status: 400 },
    { code: 'internal_error', status: 500 },
  ];

  for (const { code, status } of cases) {
    it(`maps "${code}" to HTTP ${status}`, async () => {
      const response = apiError(code, `${code} happened`);
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({
        error: { code, message: `${code} happened` },
      });
    });
  }
});
