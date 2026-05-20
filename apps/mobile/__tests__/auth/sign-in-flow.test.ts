/**
 * sign-in-flow.ts tests. Mock all four boundary surfaces (HTTP,
 * browser, crypto, keychain) so the orchestration logic is the only
 * thing under test.
 */

import { runSignInFlow, type SignInDeps } from '../../src/auth/sign-in-flow';

function deps(overrides: Partial<SignInDeps> = {}): SignInDeps {
  return {
    apiPost: jest.fn(),
    apiGet: jest.fn(),
    openAuthSession: jest.fn(),
    generateVerifier: jest.fn(),
    verifierToChallenge: jest.fn(),
    storeTokens: jest.fn(),
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
    access_expires_at: '2026-05-20T12:15:00.000Z',
  },
};

const meResponse = {
  ok: true as const,
  data: {
    id: 'user-uuid',
    email: 'matt@example.com',
    name: 'Matt',
    isApproved: true,
  },
};

describe('runSignInFlow — happy path', () => {
  it('walks start → browser → exchange → me → storeTokens and returns the email', async () => {
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
      apiGet: jest.fn().mockResolvedValue(meResponse),
      storeTokens: jest.fn().mockResolvedValue(undefined),
    });

    const result = await runSignInFlow(d);

    expect(result).toEqual({ status: 'success', email: 'matt@example.com' });
    expect(d.storeTokens).toHaveBeenCalledTimes(1);
    expect(d.storeTokens).toHaveBeenCalledWith(exchangeResponse.data);
    // /me was called with the freshly-minted access token.
    expect(d.apiGet).toHaveBeenCalledWith('/api/v1/me', expect.anything(), 'eyJaccess');
    // /exchange was called with the original verifier.
    expect(d.apiPost).toHaveBeenNthCalledWith(
      2,
      '/api/v1/auth/mobile/exchange',
      { code: 'one-time-code', code_verifier: 'verifier-abc' },
      expect.anything(),
    );
  });
});

describe('runSignInFlow — cancellation', () => {
  it('returns { status: cancelled } and does NOT persist when the browser modal is dismissed', async () => {
    const d = deps({
      generateVerifier: jest.fn().mockResolvedValue('verifier-abc'),
      verifierToChallenge: jest.fn().mockResolvedValue('challenge-xyz'),
      apiPost: jest.fn().mockResolvedValueOnce(startResponse),
      openAuthSession: jest.fn().mockResolvedValue({ type: 'cancel' }),
    });

    const result = await runSignInFlow(d);

    expect(result).toEqual({ status: 'cancelled' });
    expect(d.storeTokens).not.toHaveBeenCalled();
    expect(d.apiGet).not.toHaveBeenCalled();
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
    expect(d.storeTokens).not.toHaveBeenCalled();
  });
});

describe('runSignInFlow — access_denied (closed-auth)', () => {
  it('returns the access_denied bucket with no Keychain write', async () => {
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
    expect(d.storeTokens).not.toHaveBeenCalled();
    expect(d.apiGet).not.toHaveBeenCalled();
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
    expect(d.storeTokens).not.toHaveBeenCalled();
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
    expect(d.storeTokens).not.toHaveBeenCalled();
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
  it('returns a generic failure with the API error code and does NOT persist', async () => {
    const d = deps({
      generateVerifier: jest.fn().mockResolvedValue('verifier-abc'),
      verifierToChallenge: jest.fn().mockResolvedValue('challenge-xyz'),
      apiPost: jest
        .fn()
        .mockResolvedValueOnce(startResponse)
        .mockResolvedValueOnce({
          ok: false,
          error: { code: 'pkce_mismatch', message: 'The verifier did not match.' },
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
    expect(d.storeTokens).not.toHaveBeenCalled();
    expect(d.apiGet).not.toHaveBeenCalled();
  });
});

describe('runSignInFlow — /me failure after a successful /exchange', () => {
  it('does NOT persist tokens — guards the "no partial state" invariant', async () => {
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
      apiGet: jest.fn().mockResolvedValue({
        ok: false,
        error: { code: 'unauthenticated', message: 'No session found.' },
      }),
    });

    const result = await runSignInFlow(d);

    expect(result).toEqual({
      status: 'error',
      reason: 'generic',
      code: 'unauthenticated',
    });
    expect(d.storeTokens).not.toHaveBeenCalled();
  });
});

describe('runSignInFlow — /start failure', () => {
  it('returns a generic failure with the API error code before opening the browser', async () => {
    const d = deps({
      generateVerifier: jest.fn().mockResolvedValue('verifier-abc'),
      verifierToChallenge: jest.fn().mockResolvedValue('challenge-xyz'),
      apiPost: jest.fn().mockResolvedValueOnce({
        ok: false,
        error: { code: 'rate_limited', message: 'Slow down.' },
      }),
    });

    const result = await runSignInFlow(d);

    expect(result).toEqual({
      status: 'error',
      reason: 'generic',
      code: 'rate_limited',
    });
    expect(d.openAuthSession).not.toHaveBeenCalled();
    expect(d.storeTokens).not.toHaveBeenCalled();
  });
});
