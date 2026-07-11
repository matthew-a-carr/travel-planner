const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockCreate = jest.fn();
jest.mock('../../../../src/auth/auth-context', () => ({
  useAuth: () => ({ status: 'signed_in' }),
}));
jest.mock('../../../../src/trips/use-trip-detail', () => ({
  useTripDetail: () => ({ state: { status: 'loaded', trip: { destinations: [] } } }),
}));
jest.mock('../../../../src/trips/use-countries', () => ({
  useCountries: () => ({
    loading: false,
    error: null,
    countries: [
      {
        country: 'Japan',
        alpha2: 'JP',
        alpha3: 'JPN',
        region: 'Asia',
        subregion: null,
        currency: 'GBP',
        suggestedDailyBudget: {
          budget: { amountPence: 6500, currency: 'GBP' },
          mid: { amountPence: 10000, currency: 'GBP' },
          luxury: { amountPence: 18000, currency: 'GBP' },
        },
      },
    ],
  }),
}));
jest.mock('../../../../src/trips/planning-commands', () => ({
  createMobileDestination: (...args: unknown[]) => mockCreate(...args),
  updateMobileDestination: jest.fn(),
  deleteMobileDestination: jest.fn(),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'trip-1', destinationId: 'new' }),
}));

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import DestinationEditorScreen from '../../../../app/(app)/trips/[id]/destinations/[destinationId]';

it('suggests a canonical budget and creates a destination', async () => {
  mockCreate.mockResolvedValue({ ok: true, data: { id: 'd1' } });
  render(<DestinationEditorScreen />);
  fireEvent.changeText(screen.getByTestId('destination-country'), 'Jap');
  fireEvent.press(screen.getByTestId('destination-country-JPN'));
  fireEvent.changeText(screen.getByTestId('destination-start-date'), '2027-04-01');
  fireEvent.changeText(screen.getByTestId('destination-end-date'), '2027-04-08');
  await waitFor(() => expect(screen.getByTestId('destination-budget').props.value).toBe('700'));
  fireEvent.press(screen.getByTestId('destination-submit'));
  await waitFor(() => expect(mockCreate).toHaveBeenCalled());
  expect(mockReplace).toHaveBeenCalledWith('/trips/trip-1');
});
