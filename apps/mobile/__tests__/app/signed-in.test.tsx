import { render, screen } from '@testing-library/react-native';
import SignedInScreen from '../../app/signed-in';

const mockUseAuth = jest.fn();

jest.mock('../../src/auth/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

beforeEach(() => {
  mockUseAuth.mockReset();
});

describe('SignedInScreen', () => {
  it('renders the email from auth context when signed_in', () => {
    mockUseAuth.mockReturnValue({
      status: 'signed_in',
      me: { id: 'u1', email: 'matt@example.com', name: 'Matt', isApproved: true },
      signIn: jest.fn(),
      signOut: jest.fn(),
    });

    render(<SignedInScreen />);
    expect(screen.getByTestId('signed-in-screen-email')).toHaveTextContent(
      'Signed in as matt@example.com.',
    );
  });

  it('exposes the screen-root testID for Maestro', () => {
    mockUseAuth.mockReturnValue({
      status: 'signed_in',
      me: { id: 'u1', email: 'matt@example.com', name: 'Matt', isApproved: true },
      signIn: jest.fn(),
      signOut: jest.fn(),
    });
    render(<SignedInScreen />);
    expect(screen.getByTestId('signed-in-screen-root')).toBeOnTheScreen();
  });
});
