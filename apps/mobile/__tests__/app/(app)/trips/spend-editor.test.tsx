const mockReplace = jest.fn();
const mockCreate = jest.fn();

jest.mock('../../../../src/auth/auth-context', () => ({
  useAuth: () => ({ status: 'signed_in' }),
}));
jest.mock('../../../../src/trips/use-trip-detail', () => ({
  useTripDetail: () => ({
    state: {
      status: 'loaded',
      trip: { destinations: [{ id: 'destination-1', name: 'Tokyo' }] },
    },
  }),
}));
jest.mock('../../../../src/trips/use-trip-financials', () => ({
  useTripFinancials: () => ({ state: { status: 'loaded', financials: { entries: [] } } }),
}));
jest.mock('../../../../src/trips/spend-commands', () => ({
  createMobileSpend: (...args: unknown[]) => mockCreate(...args),
  updateMobileSpend: jest.fn(),
  deleteMobileSpend: jest.fn(),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'trip-1', entryId: 'new' }),
}));

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Keyboard } from 'react-native';
import SpendEditorScreen from '../../../../app/(app)/trips/[id]/spend/[entryId]';

it('validates and creates destination spend in integer pence', async () => {
  const dismiss = jest.spyOn(Keyboard, 'dismiss');
  mockCreate.mockResolvedValue({ ok: true, data: { id: 'entry-1' } });
  render(<SpendEditorScreen />);
  fireEvent.press(screen.getByTestId('spend-submit'));
  expect(screen.getByTestId('spend-error')).toHaveTextContent(/amount/i);
  fireEvent.changeText(screen.getByTestId('spend-amount'), '25.50');
  fireEvent.changeText(screen.getByTestId('spend-description'), 'Ramen');
  fireEvent(screen.getByTestId('spend-description'), 'submitEditing');
  expect(dismiss).toHaveBeenCalled();
  fireEvent.press(screen.getByTestId('spend-category-food'));
  fireEvent.press(screen.getByTestId('spend-submit'));
  await waitFor(() =>
    expect(mockCreate).toHaveBeenCalledWith(
      'trip-1',
      expect.objectContaining({
        destinationId: 'destination-1',
        amountPence: 2550,
        category: 'food',
        description: 'Ramen',
      }),
    ),
  );
  expect(mockReplace).toHaveBeenCalledWith('/trips/trip-1/finance');
});
