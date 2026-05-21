import { apiErrorEnvelopeSchema, ENVELOPE_VERSION } from '@travel-planner/shared';
import { describe, expect, it } from 'vitest';
import { type ApiErrorCode, respondWithError } from './errors';

const EXPECTED_STATUS: Record<ApiErrorCode, number> = {
  validation_failed: 400,
  bad_request: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  user_deleted: 410,
  gone: 410,
  rate_limited: 429,
  internal: 500,
  unavailable: 503,
  invalid_exchange_code: 400,
  pkce_mismatch: 400,
  refresh_reused: 401,
  refresh_expired: 401,
  refresh_revoked: 401,
  refresh_unknown: 401,
};

function fakeRequest(path: string = '/api/v1/me'): Request {
  return new Request(`http://localhost${path}`);
}

describe('respondWithError — status mapping', () => {
  it.each(Object.entries(EXPECTED_STATUS))(
    'maps code "%s" to HTTP status %s',
    (code, status) => {
      const response = respondWithError(fakeRequest(), code as ApiErrorCode);
      expect(response.status).toBe(status);
    },
  );
});

describe('respondWithError — envelope shape', () => {
  it('returns the canonical RFC 7807 + code envelope with siblings', async () => {
    const response = respondWithError(fakeRequest('/api/v1/me'), 'unauthenticated', {
      detail: 'No session found.',
    });
    const body = await response.json();
    const parsed = apiErrorEnvelopeSchema.parse(body);

    expect(parsed.error.code).toBe('unauthenticated');
    expect(parsed.error.status).toBe(401);
    expect(parsed.error.type).toBe('https://travel-planner.app/errors/unauthenticated');
    expect(parsed.error.title).toBe('Authentication required');
    expect(parsed.error.detail).toBe('No session found.');
    expect(parsed.error.instance).toBe('/api/v1/me');
    expect(parsed.request.path).toBe('/api/v1/me');
    expect(parsed.version).toBe(ENVELOPE_VERSION);
    expect(parsed.asof).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('defaults `detail` to the title when no detail is supplied', async () => {
    const response = respondWithError(fakeRequest(), 'internal');
    const body = await response.json();
    const parsed = apiErrorEnvelopeSchema.parse(body);
    expect(parsed.error.detail).toBe(parsed.error.title);
    expect(parsed.error.title).toBe('Internal server error');
  });

  it('lets callers override the title', async () => {
    const response = respondWithError(fakeRequest(), 'rate_limited', {
      title: 'Slow down',
      detail: 'Too many auth requests; try again in a few minutes.',
    });
    const body = await response.json();
    const parsed = apiErrorEnvelopeSchema.parse(body);
    expect(parsed.error.title).toBe('Slow down');
    expect(parsed.error.detail).toBe('Too many auth requests; try again in a few minutes.');
  });

  it('preserves details when supplied', async () => {
    const response = respondWithError(fakeRequest(), 'validation_failed', {
      detail: 'Bad input.',
      details: { field_errors: [{ field: 'email', code: 'format' }] },
    });
    const body = await response.json();
    const parsed = apiErrorEnvelopeSchema.parse(body);
    expect(parsed.error.details).toEqual({
      field_errors: [{ field: 'email', code: 'format' }],
    });
  });

  it('omits the details key entirely when not supplied', async () => {
    const response = respondWithError(fakeRequest(), 'not_found');
    const body = (await response.json()) as { error: Record<string, unknown> };
    expect('details' in body.error).toBe(false);
  });

  it('sets the type URI deterministically per code', async () => {
    const codes: ApiErrorCode[] = [
      'validation_failed',
      'refresh_expired',
      'user_deleted',
      'pkce_mismatch',
    ];
    for (const code of codes) {
      const response = respondWithError(fakeRequest(), code);
      const body = await response.json();
      const parsed = apiErrorEnvelopeSchema.parse(body);
      expect(parsed.error.type).toBe(`https://travel-planner.app/errors/${code}`);
    }
  });

  it('echoes the request method + path + path/query params', async () => {
    const request = new Request('http://localhost/api/v1/auth/mobile/refresh?probe=1', {
      method: 'POST',
    });
    const response = respondWithError(request, 'refresh_expired');
    const body = await response.json();
    const parsed = apiErrorEnvelopeSchema.parse(body);
    expect(parsed.request.method).toBe('POST');
    expect(parsed.request.path).toBe('/api/v1/auth/mobile/refresh');
    expect(parsed.request.query_params).toEqual({ probe: '1' });
    expect(parsed.error.instance).toBe('/api/v1/auth/mobile/refresh');
  });

  it('sets Cache-Control: no-store on every error response', () => {
    const response = respondWithError(fakeRequest(), 'internal');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('uses application/json content type', () => {
    const response = respondWithError(fakeRequest(), 'forbidden');
    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('does not mutate the provided details object', () => {
    const details = { retry_after_seconds: 30 } as const;
    respondWithError(fakeRequest(), 'rate_limited', { details });
    expect(details).toEqual({ retry_after_seconds: 30 });
  });
});
