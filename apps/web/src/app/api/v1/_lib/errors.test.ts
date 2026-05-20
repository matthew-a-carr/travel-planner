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
};

describe('respondWithError', () => {
  it.each(Object.entries(EXPECTED_STATUS))(
    'maps code "%s" to HTTP status %s',
    async (code, status) => {
      const response = respondWithError(code as ApiErrorCode, 'test message');
      expect(response.status).toBe(status);
    },
  );

  it('returns the canonical envelope shape', async () => {
    const response = respondWithError('unauthenticated', 'No session found.');
    const body = await response.json();

    expect(body).toEqual({
      error: {
        code: 'unauthenticated',
        message: 'No session found.',
      },
    });
  });

  it('preserves details when supplied', async () => {
    const response = respondWithError('validation_failed', 'Bad input.', {
      field_errors: [{ field: 'email', code: 'format' }],
    });
    const body = await response.json();

    expect(body).toEqual({
      error: {
        code: 'validation_failed',
        message: 'Bad input.',
        details: {
          field_errors: [{ field: 'email', code: 'format' }],
        },
      },
    });
  });

  it('omits the details key entirely when not supplied', async () => {
    const response = respondWithError('not_found', 'Trip not found.');
    const body = (await response.json()) as { error: Record<string, unknown> };

    expect(Object.keys(body.error)).toEqual(['code', 'message']);
    expect('details' in body.error).toBe(false);
  });

  it('sets Cache-Control: no-store on every response', () => {
    const response = respondWithError('internal', 'Something went wrong.');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('uses application/json content type', () => {
    const response = respondWithError('forbidden', 'Forbidden.');
    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('does not mutate the provided details object', () => {
    const details = { retry_after_seconds: 30 } as const;
    respondWithError('rate_limited', 'Slow down.', details);
    expect(details).toEqual({ retry_after_seconds: 30 });
  });
});
