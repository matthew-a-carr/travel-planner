const mockReplace = jest.fn();
const mockCreate = jest.fn();
jest.mock('../../../../src/auth/auth-context', () => ({
  useAuth: () => ({ status: 'signed_in' }),
}));
jest.mock('../../../../src/trips/use-trip-detail', () => ({
  useTripDetail: () => ({ state: { status: 'loaded', trip: { fixedCosts: [] } } }),
}));
jest.mock('../../../../src/trips/planning-commands', () => ({
  createMobileFixedCost: (...args: unknown[]) => mockCreate(...args),
  updateMobileFixedCost: jest.fn(),
  deleteMobileFixedCost: jest.fn(),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'trip-1', fixedCostId: 'new' }),
}));

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import FixedCostEditorScreen from '../../../../app/(app)/trips/[id]/fixed-costs/[fixedCostId]';

it('validates and creates a categorised fixed cost', async () => {
  mockCreate.mockResolvedValue({ ok: true, data: { id: 'f1' } });
  render(<FixedCostEditorScreen />);
  fireEvent.press(screen.getByTestId('fixed-cost-submit'));
  expect(screen.getByTestId('fixed-cost-error')).toHaveTextContent(/Label/);
  fireEvent.changeText(screen.getByTestId('fixed-cost-label'), 'Flights');
  fireEvent.changeText(screen.getByTestId('fixed-cost-amount'), '800');
  fireEvent.press(screen.getByTestId('fixed-cost-category-transport'));
  fireEvent.press(screen.getByTestId('fixed-cost-submit'));
  await waitFor(() =>
    expect(mockCreate).toHaveBeenCalledWith(
      'trip-1',
      expect.objectContaining({ label: 'Flights', amountPence: 80000, category: 'transport' }),
    ),
  );
  expect(mockReplace).toHaveBeenCalledWith('/trips/trip-1');
});
