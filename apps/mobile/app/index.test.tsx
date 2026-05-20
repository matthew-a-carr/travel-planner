import { render, screen } from '@testing-library/react-native';
import HelloScreen from './index';

describe('HelloScreen', () => {
  it('renders the greeting text', () => {
    render(<HelloScreen />);

    expect(screen.getByTestId('hello-screen-greeting')).toBeOnTheScreen();
    expect(screen.getByText('Hello, Travel Planner')).toBeOnTheScreen();
  });

  it('exposes a stable root testID for Maestro flows', () => {
    render(<HelloScreen />);

    expect(screen.getByTestId('hello-screen-root')).toBeOnTheScreen();
  });
});
