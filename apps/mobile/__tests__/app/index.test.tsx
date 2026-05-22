import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { SignInResult } from '../../src/auth/sign-in-flow';

const mockRouterReplace = jest.fn();
const mockRunSignInFlow: jest.Mock<Promise<SignInResult>, []> = jest.fn();
const mockSignIn = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockRouterReplace }),
}));

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('../../src/auth/sign-in-flow', () => ({
  runSignInFlow: (...args: unknown[]) => mockRunSignInFlow(...(args as [])),
}));

jest.mock('../../src/auth/auth-context', () => ({
  useAuth: () => ({
    status: 'signed_out',
    signIn: mockSignIn,
    signOut: jest.fn(),
  }),
}));

import SignInScreen from '../../app/index';

const fixtureTokens = {
  access_token: 'eyJaccess',
  refresh_token: 'opaque-refresh',
  access_expires_at: '2026-05-22T12:15:00.000Z',
};

beforeEach(() => {
  mockRouterReplace.mockReset();
  mockRunSignInFlow.mockReset();
  mockSignIn.mockReset().mockResolvedValue(undefined);
});

describe('SignInScreen — idle render', () => {
  it('renders the sign-in button + root testID', () => {
    render(<SignInScreen />);

    expect(screen.getByTestId('login-screen-root')).toBeOnTheScreen();
    expect(screen.getByTestId('login-google-button')).toBeOnTheScreen();
    expect(screen.getByText('Sign in with Google')).toBeOnTheScreen();
    expect(screen.queryByTestId('login-screen-error')).toBeNull();
  });
});

describe('SignInScreen — success branch', () => {
  it('hands tokens to auth.signIn and navigates to /signed-in', async () => {
    mockRunSignInFlow.mockResolvedValueOnce({ status: 'success', tokens: fixtureTokens });

    render(<SignInScreen />);
    fireEvent.press(screen.getByTestId('login-google-button'));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith(fixtureTokens);
    });
    expect(mockRouterReplace).toHaveBeenCalledWith('/signed-in');
    expect(screen.queryByTestId('login-screen-error')).toBeNull();
  });
});

describe('SignInScreen — cancellation branch', () => {
  it('silently returns to idle (no error UI, no navigation)', async () => {
    mockRunSignInFlow.mockResolvedValueOnce({ status: 'cancelled' });

    render(<SignInScreen />);
    fireEvent.press(screen.getByTestId('login-google-button'));

    await waitFor(() => {
      expect(mockRunSignInFlow).toHaveBeenCalledTimes(1);
    });
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(screen.queryByTestId('login-screen-error')).toBeNull();
    expect(screen.getByText('Sign in with Google')).toBeOnTheScreen();
  });
});

describe('SignInScreen — access_denied branch', () => {
  it('renders the distinct closed-auth copy', async () => {
    mockRunSignInFlow.mockResolvedValueOnce({
      status: 'error',
      reason: 'access_denied',
      code: 'access_denied',
    });

    render(<SignInScreen />);
    fireEvent.press(screen.getByTestId('login-google-button'));

    const errorView = await screen.findByTestId('login-screen-error');
    expect(errorView).toHaveTextContent(
      'Sign-in is restricted. Ask the app admin to approve your account.',
    );
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });
});

describe('SignInScreen — generic error branch', () => {
  it('renders the generic copy with the underlying error code tag', async () => {
    mockRunSignInFlow.mockResolvedValueOnce({
      status: 'error',
      reason: 'generic',
      code: 'pkce_mismatch',
    });

    render(<SignInScreen />);
    fireEvent.press(screen.getByTestId('login-google-button'));

    const errorView = await screen.findByTestId('login-screen-error');
    expect(errorView).toHaveTextContent('Sign-in failed. Try again. [code: pkce_mismatch]');
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it('re-enables the button so the user can retry', async () => {
    mockRunSignInFlow
      .mockResolvedValueOnce({ status: 'error', reason: 'generic', code: 'rate_limited' })
      .mockResolvedValueOnce({ status: 'success', tokens: fixtureTokens });

    render(<SignInScreen />);
    fireEvent.press(screen.getByTestId('login-google-button'));
    await screen.findByTestId('login-screen-error');

    // Tap again — should fire the flow a second time and navigate on success.
    fireEvent.press(screen.getByTestId('login-google-button'));
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledTimes(1);
    });
    expect(mockRunSignInFlow).toHaveBeenCalledTimes(2);
    expect(mockSignIn).toHaveBeenCalledTimes(1);
  });
});
