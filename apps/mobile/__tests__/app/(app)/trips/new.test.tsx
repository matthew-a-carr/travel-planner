const mockUseAuth = jest.fn();
const mockUseOrganizations = jest.fn();
const mockCreateMobileTrip = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('../../../../src/auth/auth-context', () => ({ useAuth: () => mockUseAuth() }));
jest.mock('../../../../src/trips/use-organizations', () => ({
  useOrganizations: () => mockUseOrganizations(),
}));
jest.mock('../../../../src/trips/trip-commands', () => ({
  createMobileTrip: (...args: unknown[]) => mockCreateMobileTrip(...args),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack }),
}));

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ScrollView } from 'react-native';
import NewTripScreen from '../../../../app/(app)/trips/new';

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ status: 'signed_in' });
  mockUseOrganizations.mockReturnValue({
    state: {
      status: 'loaded',
      organizations: [{ id: 'org-1', name: 'Home', role: 'owner' }],
    },
    reload: jest.fn(),
  });
});

describe('NewTripScreen', () => {
  it('keeps form controls actionable while dismissing the keyboard on scroll', () => {
    const view = render(<NewTripScreen />);
    const form = view.UNSAFE_getByType(ScrollView);

    expect(form.props.keyboardShouldPersistTaps).toBe('handled');
    expect(form.props.keyboardDismissMode).toBe('on-drag');
  });

  it('submits pence through the selected organization and opens the created trip', async () => {
    mockCreateMobileTrip.mockResolvedValue({ ok: true, data: { id: 'trip-1' } });
    render(<NewTripScreen />);

    fireEvent.press(screen.getByTestId('trip-create-organization-org-1'));
    fireEvent.changeText(screen.getByTestId('trip-create-name'), 'Japan');
    fireEvent.changeText(screen.getByTestId('trip-create-budget'), '5000');
    fireEvent.press(screen.getByTestId('trip-create-submit'));

    await waitFor(() =>
      expect(mockCreateMobileTrip).toHaveBeenCalledWith({
        organizationId: 'org-1',
        name: 'Japan',
        totalBudgetPence: 500_000,
      }),
    );
    expect(mockReplace).toHaveBeenCalledWith('/trips/trip-1');
  });

  it('shows local validation and does not submit an invalid budget', async () => {
    render(<NewTripScreen />);

    fireEvent.changeText(screen.getByTestId('trip-create-name'), 'Japan');
    fireEvent.changeText(screen.getByTestId('trip-create-budget'), 'nope');
    fireEvent.press(screen.getByTestId('trip-create-submit'));

    expect(await screen.findByTestId('trip-create-error')).toHaveTextContent(/valid budget/i);
    expect(mockCreateMobileTrip).not.toHaveBeenCalled();
  });
});
