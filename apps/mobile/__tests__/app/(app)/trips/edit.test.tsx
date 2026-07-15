const mockUseAuth = jest.fn();
const mockUseTripDetail = jest.fn();
const mockUpdateMobileTrip = jest.fn();
const mockDeleteMobileTrip = jest.fn();
const mockReplace = jest.fn();

jest.mock('../../../../src/auth/auth-context', () => ({ useAuth: () => mockUseAuth() }));
jest.mock('../../../../src/trips/use-trip-detail', () => ({
  useTripDetail: () => mockUseTripDetail(),
}));
jest.mock('../../../../src/trips/trip-commands', () => ({
  updateMobileTrip: (...args: unknown[]) => mockUpdateMobileTrip(...args),
  deleteMobileTrip: (...args: unknown[]) => mockDeleteMobileTrip(...args),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'trip-1' }),
  useRouter: () => ({ replace: mockReplace, back: jest.fn() }),
}));

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import EditTripScreen from '../../../../app/(app)/trips/[id]/edit';

const TRIP = {
  id: 'trip-1',
  name: 'Japan',
  status: 'planning',
  totalBudget: { amountPence: 500_000, currency: 'GBP' },
  destinations: [],
  fixedCosts: [],
  spend: {},
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ status: 'signed_in' });
  mockUseTripDetail.mockReturnValue({ state: { status: 'loaded', trip: TRIP }, reload: jest.fn() });
});

describe('EditTripScreen', () => {
  it('updates the canonical editable fields and returns to detail', async () => {
    mockUpdateMobileTrip.mockResolvedValue({ ok: true, data: { id: 'trip-1' } });
    render(<EditTripScreen />);

    fireEvent.changeText(screen.getByTestId('trip-edit-name'), 'Japan updated');
    fireEvent.changeText(screen.getByTestId('trip-edit-budget'), '6000');
    fireEvent.press(screen.getByTestId('trip-edit-status-active'));
    fireEvent.press(screen.getByTestId('trip-edit-submit'));

    await waitFor(() =>
      expect(mockUpdateMobileTrip).toHaveBeenCalledWith('trip-1', {
        name: 'Japan updated',
        totalBudgetPence: 600_000,
        status: 'active',
      }),
    );
    expect(mockReplace).toHaveBeenCalledWith('/trips/trip-1');
  });

  it('requires an explicit second tap before deleting and returns to the list', async () => {
    mockDeleteMobileTrip.mockResolvedValue({ ok: true, data: undefined });
    render(<EditTripScreen />);

    fireEvent.press(screen.getByTestId('trip-edit-delete'));
    expect(mockDeleteMobileTrip).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('trip-edit-delete-confirm'));

    await waitFor(() => expect(mockDeleteMobileTrip).toHaveBeenCalledWith('trip-1'));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
