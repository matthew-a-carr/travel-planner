/**
 * Me screen tests. Mocks useAuth to inject fixture auth states.
 *
 * Five cases (per SPEC-007 §9 me-screen row):
 *  (a) status === 'unknown'   → renders null (no testIDs in tree)
 *  (b) signed_in, name 'Matt' → "Hello, Matt" + email visible
 *  (c) signed_in, name null   → "Hello!" + email visible
 *  (d) signed_in, !isApproved → approval banner appears
 *  (e) signed_in, sign-out tap → auth.signOut() called once
 */

const mockUseAuth = jest.fn();
const mockSignOut = jest.fn();

jest.mock('../../../src/auth/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

import { fireEvent, render, screen } from '@testing-library/react-native';
import MeScreen from '../../../app/(app)/index';

const fixtureMe = {
  id: 'user-uuid-1',
  email: 'matt@example.com',
  name: 'Matt',
  isApproved: true,
};

type MeOverrides = {
  email?: string;
  name?: string | null;
  isApproved?: boolean;
};

function withSignedIn(overrides: MeOverrides = {}) {
  mockUseAuth.mockReturnValue({
    status: 'signed_in',
    me: { ...fixtureMe, ...overrides },
    signIn: jest.fn(),
    signOut: mockSignOut,
  });
}

beforeEach(() => {
  mockUseAuth.mockReset();
  mockSignOut.mockReset();
});

describe('MeScreen', () => {
  it('(a) renders null while auth.status === "unknown"', () => {
    mockUseAuth.mockReturnValue({
      status: 'unknown',
      signIn: jest.fn(),
      signOut: mockSignOut,
    });

    render(<MeScreen />);

    expect(screen.queryByTestId('me-screen-root')).toBeNull();
    expect(screen.queryByTestId('me-screen-greeting')).toBeNull();
  });

  it('(b) signed_in with a name: renders "Hello, {name}" + email', () => {
    withSignedIn();

    render(<MeScreen />);

    expect(screen.getByTestId('me-screen-root')).toBeOnTheScreen();
    expect(screen.getByTestId('me-screen-greeting')).toHaveTextContent('Hello, Matt');
    expect(screen.getByTestId('me-screen-email')).toHaveTextContent('matt@example.com');
    expect(screen.queryByTestId('me-screen-approval-banner')).toBeNull();
  });

  it('(c) signed_in with name: null: renders "Hello!" + email always visible', () => {
    withSignedIn({ name: null });

    render(<MeScreen />);

    expect(screen.getByTestId('me-screen-greeting')).toHaveTextContent('Hello!');
    expect(screen.getByTestId('me-screen-email')).toHaveTextContent('matt@example.com');
  });

  it('(d) signed_in with isApproved: false: renders the approval banner', () => {
    withSignedIn({ isApproved: false });

    render(<MeScreen />);

    expect(screen.getByTestId('me-screen-greeting')).toHaveTextContent('Hello, Matt');
    expect(screen.getByTestId('me-screen-email')).toHaveTextContent('matt@example.com');
    expect(screen.getByTestId('me-screen-approval-banner')).toHaveTextContent(
      'Your account is pending approval.',
    );
  });

  it('(e) sign-out tap calls auth.signOut() once', () => {
    withSignedIn();

    render(<MeScreen />);
    fireEvent.press(screen.getByTestId('me-screen-sign-out'));

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
