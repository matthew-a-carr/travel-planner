/**
 * sign-in-flow.ts tests. Mock all three boundary surfaces (HTTP,
 * browser, crypto) so the orchestration logic is the only thing
 * under test.
 *
 * SPEC-007 reshape: the slice-6 `/me`-as-proof + `storeTokens` steps
 * moved into AuthProvider.signIn (single owner of "who is the
 * current user"). The flow now returns just the exchange tokens;
 * the caller hands them to the auth context.
 */

import type { ApiError, ApiErrorCode } from '@travel-planner/shared';
import { runSignInFlow, type SignInDeps } from '../../src/auth/sign-in-flow';

/**
 * Build a minimal-but-complete ApiError shape for mocking apiClient
 * failures. The orchestrator only dispatches on `error.code`, but the
 * SPEC-008 envelope's TypeScript contract requires the full RFC 7807
 * fields.
 */
function apiError(code: ApiErrorCode, detail: string): ApiError {
  return {
    type: `https://travel-planner.app/errors/${code}`,
    title: 'Mock title',
    status: 400,
    detail,
    instance: '/api/v1/mock',
    code,
  };
}

function deps(overrides: Partial<SignInDeps> = {}): SignInDeps {
  return {
    apiPost: jest.fn(),
    openAuthSession: jest.fn(),
    generateVerifier: jest.fn(),
    verifierToChallenge: jest.fn(),
    ...overrides,
  } as unknown as SignInDeps;
}

const startResponse = {
  ok: true as const,
  data: {
    authorise_url: 'https://accounts.google.test/o/oauth2/v2/auth?…',
    state: 'state-abc',
  },
};

const exchangeResponse = {
  ok: true as const,
  data: {
    access_token: 'eyJaccess',
    refresh_token: 'opaque-refresh',
    access_expires_at: '2026-05-22T12:15:00.000Z',
  },
};

describe('runSignInFlow — happy path', () => {
  it('walks start → browser → exchange and returns the mint tokens', async () => {
    const d = deps({
      generateVerifier: jest.fn().mockResolvedValue('verifier-abc'),
      verifierToChallenge: jest.fn().mockResolvedValue('challenge-xyz'),
      apiPost: jest
        .fn()
        .mockResolvedValueOnce(startResponse)
        .mockResolvedValueOnce(exchangeResponse),
      openAuthSession: jest.fn().mockResolvedValue({
        type: 'success',
        url: 'travelplanner://auth?code=one-time-code',
      }),
    });

    const result = await runSignInFlow(d);

    expect(result).toEqual({ status: 'success', tokens: exchangeResponse.data });
    // /exchange was called with the original verifier.
    expect(d.apiPost).toHaveBeenNthCalledWith(
      2,
      '/api/v1/auth/mobile/exchange',
      { code: 'one-time-code', code_verifier: 'verifier-abc' },
      expect.anything(),
    );
    // Only two apiPost calls — /start and /exchange. No /me here anymore.
    expect(d.apiPost).toHaveBeenCalledTimes(2);
  });
});

describe('runSignInFlow — cancellation', () => {
  it('returns { status: cancelled } when the browser modal is dismissed', async () => {
    const d = deps({
      generateVerifier: jest.fn().mockResolvedValue('verifier-abc'),
      verifierToChallenge: jest.fn().mockResolvedValue('challenge-xyz'),
      apiPost: jest.fn().mockResolvedValueOnce(startResponse),
      openAuthSession: jest.fn().mockResolvedValue({ type: 'cancel' }),
    });

    const result = await runSignInFlow(d);

    expect(result).toEqual({ status: 'cancelled' });
  });

  it('treats type: dismiss the same as cancel', async () => {
    const d = deps({
      generateVerifier: jest.fn().mockResolvedValue('verifier-abc'),
      verifierToChallenge: jest.fn().mockResolvedValue('challenge-xyz'),
      apiPost: jest.fn().mockResolvedValueOnce(startResponse),
      openAuthSession: jest.fn().mockResolvedValue({ type: 'dismiss' }),
    });

    const result = await runSignInFlow(d);

    expect(result).toEqual({ status: 'cancelled' });
  });
});

describe('runSignInFlow — access_denied (closed-auth)', () => {
  it('returns the access_denied bucket', async () => {
    const d = deps({
      generateVerifier: jest.fn().mockResolvedValue('verifier-abc'),
      verifierToChallenge: jest.fn().mockResolvedValue('challenge-xyz'),
      apiPost: jest.fn().mockResolvedValueOnce(startResponse),
      openAuthSession: jest.fn().mockResolvedValue({
        type: 'success',
        url: 'travelplanner://auth?error=access_denied',
      }),
    });

    const result = await runSignInFlow(d);

    expect(result).toEqual({
      status: 'error',
      reason: 'access_denied',
      code: 'access_denied',
    });
  });
});

describe('runSignInFlow — generic deep-link errors', () => {
  it.each([
    'invalid_request',
    'server_error',
    'invalid_state',
    'google_error',
  ] as const)('maps deep-link ?error=%s to a generic failure carrying the code', async (errorCode) => {
    const d = deps({
      generateVerifier: jest.fn().mockResolvedValue('verifier-abc'),
      verifierToChallenge: jest.fn().mockResolvedValue('challenge-xyz'),
      apiPost: jest.fn().mockResolvedValueOnce(startResponse),
      openAuthSession: jest.fn().mockResolvedValue({
        type: 'success',
        url: `travelplanner://auth?error=${errorCode}`,
      }),
    });

    const result = await runSignInFlow(d);

    expect(result).toEqual({
      status: 'error',
      reason: 'generic',
      code: errorCode,
    });
  });

  it('maps an unknown ?error=<string> to code: unknown_callback_error', async () => {
    const d = deps({
      generateVerifier: jest.fn().mockResolvedValue('verifier-abc'),
      verifierToChallenge: jest.fn().mockResolvedValue('challenge-xyz'),
      apiPost: jest.fn().mockResolvedValueOnce(startResponse),
      openAuthSession: jest.fn().mockResolvedValue({
        type: 'success',
        url: 'travelplanner://auth?error=something_brand_new',
      }),
    });

    const result = await runSignInFlow(d);

    expect(result).toEqual({
      status: 'error',
      reason: 'generic',
      code: 'unknown_callback_error',
    });
  });

  it('maps a success URL with neither code nor error to code: no_code_in_callback', async () => {
    const d = deps({
      generateVerifier: jest.fn().mockResolvedValue('verifier-abc'),
      verifierToChallenge: jest.fn().mockResolvedValue('challenge-xyz'),
      apiPost: jest.fn().mockResolvedValueOnce(startResponse),
      openAuthSession: jest.fn().mockResolvedValue({
        type: 'success',
        url: 'travelplanner://auth?other=garbage',
      }),
    });

    const result = await runSignInFlow(d);

    expect(result).toEqual({
      status: 'error',
      reason: 'generic',
      code: 'no_code_in_callback',
    });
  });
});

describe('runSignInFlow — /exchange failure', () => {
  it('returns a generic failure with the API error code', async () => {
    const d = deps({
      generateVerifier: jest.fn().mockResolvedValue('verifier-abc'),
      verifierToChallenge: jest.fn().mockResolvedValue('challenge-xyz'),
      apiPost: jest
        .fn()
        .mockResolvedValueOnce(startResponse)
        .mockResolvedValueOnce({
          ok: false,
          error: apiError('pkce_mismatch', 'The verifier did not match.'),
        }),
      openAuthSession: jest.fn().mockResolvedValue({
        type: 'success',
        url: 'travelplanner://auth?code=one-time-code',
      }),
    });

    const result = await runSignInFlow(d);

    expect(result).toEqual({
      status: 'error',
      reason: 'generic',
      code: 'pkce_mismatch',
    });
  });
});

describe('runSignInFlow — /start failure', () => {
  it('returns a generic failure with the API error code before opening the browser', async () => {
    const d = deps({
      generateVerifier: jest.fn().mockResolvedValue('verifier-abc'),
      verifierToChallenge: jest.fn().mockResolvedValue('challenge-xyz'),
      apiPost: jest.fn().mockResolvedValueOnce({
        ok: false,
        error: apiError('rate_limited', 'Slow down.'),
      }),
    });

    const result = await runSignInFlow(d);

    expect(result).toEqual({
      status: 'error',
      reason: 'generic',
      code: 'rate_limited',
    });
    expect(d.openAuthSession).not.toHaveBeenCalled();
  });
});
