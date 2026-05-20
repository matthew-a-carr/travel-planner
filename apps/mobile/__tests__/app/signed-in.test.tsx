import { render, screen } from '@testing-library/react-native';
import SignedInScreen from '../../app/signed-in';

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn().mockReturnValue({ email: 'matt@example.com' }),
}));

describe('SignedInScreen', () => {
  it('renders the email from the route param', () => {
    render(<SignedInScreen />);
    expect(screen.getByTestId('signed-in-screen-email')).toHaveTextContent(
      'Signed in as matt@example.com.',
    );
  });

  it('exposes the screen-root testID for Maestro', () => {
    render(<SignedInScreen />);
    expect(screen.getByTestId('signed-in-screen-root')).toBeOnTheScreen();
  });
});
