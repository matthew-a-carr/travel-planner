/**
 * AuthProvider tests. Mocks `get-access-token`, `keychain`, and
 * `api/client` so the state-machine logic + side-effect ordering
 * is the only thing under test.
 *
 * Test pattern: a tiny `<AuthInspector />` consumer renders the
 * current state via testIDs so RNTL queries can assert it.
 */

jest.mock('../../src/auth/get-access-token', () => ({
  getAccessToken: jest.fn(),
}));
jest.mock('../../src/auth/keychain', () => ({
  readTokens: jest.fn(),
  storeTokens: jest.fn(),
  clearTokens: jest.fn(),
}));
jest.mock('../../src/api/client', () => ({
  apiPost: jest.fn(),
  apiGet: jest.fn(),
}));

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ApiError, ApiErrorCode } from '@travel-planner/shared';
import type React from 'react';
import { Pressable, Text, View } from 'react-native';
import { apiGet, apiPost } from '../../src/api/client';
import { AuthProvider, useAuth } from '../../src/auth/auth-context';
import { getAccessToken } from '../../src/auth/get-access-token';
import { clearTokens, readTokens, storeTokens } from '../../src/auth/keychain';

/**
 * Build a minimal-but-complete ApiError for mocking apiGet failures.
 * AuthProvider only dispatches on `result.ok`, but the SPEC-007 / ADR
 * 056 envelope's TypeScript contract requires the full RFC 7807 fields.
 */
function apiError(code: ApiErrorCode, detail: string): ApiError {
  return {
    type: `https://travel-planner.app/errors/${code}`,
    title: 'Mock title',
    status: 401,
    detail,
    instance: '/api/v1/me',
    code,
  };
}

const mockGetAccessToken = getAccessToken as jest.MockedFunction<typeof getAccessToken>;
const mockReadTokens = readTokens as jest.MockedFunction<typeof readTokens>;
const mockStoreTokens = storeTokens as jest.MockedFunction<typeof storeTokens>;
const mockClearTokens = clearTokens as jest.MockedFunction<typeof clearTokens>;
const mockApiGet = apiGet as jest.MockedFunction<typeof apiGet>;
const mockApiPost = apiPost as jest.MockedFunction<typeof apiPost>;

const fixtureMe = {
  id: 'user-uuid-1',
  email: 'matt@example.com',
  name: 'Matt',
  isApproved: true,
};

const fixtureTokens = {
  access_token: 'eyJaccess',
  refresh_token: 'opaque-refresh',
  access_expires_at: '2026-05-22T12:15:00.000Z',
};

function AuthInspector(): React.JSX.Element {
  const auth = useAuth();
  return (
    <View>
      <Text testID="status">{auth.status}</Text>
      {auth.status === 'signed_in' && <Text testID="me-email">{auth.me.email}</Text>}
      <Pressable
        testID="trigger-sign-in"
        onPress={() => {
          void auth.signIn(fixtureTokens);
        }}
      >
        <Text>Sign in</Text>
      </Pressable>
      <Pressable
        testID="trigger-sign-out"
        onPress={() => {
          void auth.signOut();
        }}
      >
        <Text>Sign out</Text>
      </Pressable>
    </View>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <AuthInspector />
    </AuthProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  // Sensible defaults — individual tests override.
  mockGetAccessToken.mockResolvedValue({ ok: false, reason: 'no_tokens' });
  mockReadTokens.mockResolvedValue(null);
  mockStoreTokens.mockResolvedValue();
  mockClearTokens.mockResolvedValue();
  mockApiGet.mockResolvedValue({ ok: true, data: fixtureMe });
  mockApiPost.mockResolvedValue({ ok: true, data: undefined });
});

describe('AuthProvider — cold-start', () => {
  it('(a) no tokens → signed_out', async () => {
    mockGetAccessToken.mockResolvedValue({ ok: false, reason: 'no_tokens' });

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('signed_out');
    });
    expect(mockApiGet).not.toHaveBeenCalled();
    expect(mockClearTokens).not.toHaveBeenCalled(); // nothing to clear
  });

  it('(b) valid token + /me success → signed_in', async () => {
    mockGetAccessToken.mockResolvedValue({ ok: true, token: 'eyJaccess' });
    mockApiGet.mockResolvedValue({ ok: true, data: fixtureMe });

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('signed_in');
    });
    expect(screen.getByTestId('me-email').props.children).toBe('matt@example.com');
    expect(mockApiGet).toHaveBeenCalledWith('/api/v1/me', expect.anything(), 'eyJaccess');
  });

  it('(c) expired access + /refresh success + /me success → signed_in', async () => {
    // getAccessToken handles the refresh internally and returns the new token.
    mockGetAccessToken.mockResolvedValue({ ok: true, token: 'new-access-after-refresh' });
    mockApiGet.mockResolvedValue({ ok: true, data: fixtureMe });

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('signed_in');
    });
    expect(mockApiGet).toHaveBeenCalledWith(
      '/api/v1/me',
      expect.anything(),
      'new-access-after-refresh',
    );
  });

  it('(d) expired access + /refresh failure → signed_out (getAccessToken already cleared keychain)', async () => {
    mockGetAccessToken.mockResolvedValue({ ok: false, reason: 'refresh_failed' });

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('signed_out');
    });
    expect(mockApiGet).not.toHaveBeenCalled();
    // AuthProvider doesn't double-clear — getAccessToken cleared already.
    expect(mockClearTokens).not.toHaveBeenCalled();
  });

  it('(e) valid token + /me 401 → signed_out + Keychain cleared', async () => {
    mockGetAccessToken.mockResolvedValue({ ok: true, token: 'eyJaccess' });
    mockApiGet.mockResolvedValue({
      ok: false,
      error: apiError('unauthenticated', 'No session found.'),
    });

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('signed_out');
    });
    expect(mockClearTokens).toHaveBeenCalledTimes(1);
  });

  it('(f) valid token + /me network failure → signed_out + Keychain cleared', async () => {
    mockGetAccessToken.mockResolvedValue({ ok: true, token: 'eyJaccess' });
    mockApiGet.mockResolvedValue({
      ok: false,
      error: apiError('internal', 'Could not reach the server.'),
    });

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('signed_out');
    });
    expect(mockClearTokens).toHaveBeenCalledTimes(1);
  });

  it('(g) cold-start throws → signed_out, never stranded on unknown', async () => {
    // An unhandled throw in cold-start (e.g. a Keychain read error) must
    // still leave 'unknown' so AuthGuard hides the splash — otherwise the
    // app hangs on the splash forever (the mobile-e2e stuck-screen bug).
    mockGetAccessToken.mockRejectedValue(new Error('keychain unavailable'));

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('signed_out');
    });
  });
});

describe('AuthProvider — signIn', () => {
  it('(g) success: stores tokens, fetches /me, transitions to signed_in', async () => {
    // Cold-start lands signed_out.
    mockGetAccessToken.mockResolvedValueOnce({ ok: false, reason: 'no_tokens' });
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('signed_out');
    });

    // Now sign in — /me succeeds.
    mockApiGet.mockResolvedValueOnce({ ok: true, data: fixtureMe });

    await act(async () => {
      fireEvent.press(screen.getByTestId('trigger-sign-in'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('signed_in');
    });
    expect(mockStoreTokens).toHaveBeenCalledTimes(1);
    expect(mockStoreTokens).toHaveBeenCalledWith(fixtureTokens);
    expect(mockApiGet).toHaveBeenLastCalledWith(
      '/api/v1/me',
      expect.anything(),
      fixtureTokens.access_token,
    );
  });

  it('(h) /me failure post-exchange: clears Keychain, transitions to signed_out', async () => {
    mockGetAccessToken.mockResolvedValueOnce({ ok: false, reason: 'no_tokens' });
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('signed_out');
    });

    mockApiGet.mockResolvedValueOnce({
      ok: false,
      error: apiError('unauthenticated', 'No session found.'),
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('trigger-sign-in'));
    });

    await waitFor(() => {
      expect(mockClearTokens).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId('status').props.children).toBe('signed_out');
    // storeTokens was still called once before the /me check — the
    // rollback is via clearTokens after the failure.
    expect(mockStoreTokens).toHaveBeenCalledTimes(1);
  });
});

describe('AuthProvider — signOut', () => {
  it('(i) tokens present: state to signed_out, Keychain cleared, /revoke fired with the refresh token', async () => {
    // Cold-start signed_in.
    mockGetAccessToken.mockResolvedValueOnce({ ok: true, token: 'eyJaccess' });
    mockApiGet.mockResolvedValueOnce({ ok: true, data: fixtureMe });
    mockReadTokens.mockResolvedValueOnce(fixtureTokens);

    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('signed_in');
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('trigger-sign-out'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('signed_out');
    });
    expect(mockClearTokens).toHaveBeenCalledTimes(1);
    expect(mockApiPost).toHaveBeenCalledWith('/api/v1/auth/mobile/revoke', {
      refresh_token: fixtureTokens.refresh_token,
    });
  });

  it('(j) /revoke rejection: signOut still resolves successfully (fire-and-forget never throws)', async () => {
    mockGetAccessToken.mockResolvedValueOnce({ ok: true, token: 'eyJaccess' });
    mockApiGet.mockResolvedValueOnce({ ok: true, data: fixtureMe });
    mockReadTokens.mockResolvedValueOnce(fixtureTokens);
    mockApiPost.mockRejectedValueOnce(new Error('network down'));

    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('signed_in');
    });

    // Should NOT throw despite the /revoke rejection.
    await act(async () => {
      fireEvent.press(screen.getByTestId('trigger-sign-out'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('signed_out');
    });
    expect(mockClearTokens).toHaveBeenCalledTimes(1);
  });

  it('(k) tokens already absent: state to signed_out, no /revoke call', async () => {
    // Edge case: signOut called when readTokens returns null (defensive).
    // Tested by manipulating readTokens mid-test rather than reaching it
    // through cold-start, since cold-start with no tokens already lands
    // signed_out and there's nothing to read.
    mockGetAccessToken.mockResolvedValueOnce({ ok: true, token: 'eyJaccess' });
    mockApiGet.mockResolvedValueOnce({ ok: true, data: fixtureMe });
    // For signOut: readTokens returns null (simulates Keychain wiped
    // out-of-band, e.g. user clearing app data).
    mockReadTokens.mockResolvedValueOnce(null);

    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('signed_in');
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('trigger-sign-out'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('signed_out');
    });
    expect(mockClearTokens).toHaveBeenCalledTimes(1);
    expect(mockApiPost).not.toHaveBeenCalled();
  });
});

describe('useAuth — error path', () => {
  it('throws when used outside AuthProvider', () => {
    // Suppress React's error-boundary noise for this expected throw.
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    function StandaloneConsumer(): React.JSX.Element {
      const auth = useAuth();
      return <Text testID="x">{auth.status}</Text>;
    }

    expect(() => render(<StandaloneConsumer />)).toThrow(
      /useAuth must be used inside AuthProvider/,
    );

    errSpy.mockRestore();
  });
});
