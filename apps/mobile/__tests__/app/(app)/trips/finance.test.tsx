const mockPush = jest.fn();
const mockFinancials = jest.fn();

jest.mock('../../../../src/auth/auth-context', () => ({
  useAuth: () => ({ status: 'signed_in' }),
}));
jest.mock('../../../../src/trips/use-trip-financials', () => ({
  useTripFinancials: () => mockFinancials(),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'trip-1' }),
}));

import { fireEvent, render, screen } from '@testing-library/react-native';
import FinanceScreen from '../../../../app/(app)/trips/[id]/finance';

const FINANCIALS = {
  entries: [
    {
      id: 'entry-1',
      destinationId: 'destination-1',
      amount: { amountPence: 2500, currency: 'GBP' },
      category: 'food',
      description: 'Ramen',
      spentAt: '2026-06-02',
      createdAt: '2026-06-02T12:00:00.000Z',
    },
  ],
  categoryTotals: [{ category: 'food', amountPence: 2500 }],
  burndown: {
    idealLine: [],
    actualLine: [],
    projectedLine: [],
    dailyPacePence: 1250,
    targetPacePence: 2000,
    paceRatio: 0.625,
    projectedExhaustionDate: null,
  },
  alerts: [{ type: 'over-pace', severity: 'warning', message: 'Spending over pace' }],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFinancials.mockReturnValue({ state: { status: 'loaded', financials: FINANCIALS } });
});

it('renders financial relationships, navigates entries, and dismisses alerts', () => {
  render(<FinanceScreen />);
  expect(screen.getByTestId('finance-daily-pace')).toHaveTextContent(/£12\.50/);
  expect(screen.getByTestId('finance-target-pace')).toHaveTextContent(/£20/);
  expect(screen.getByTestId('finance-category-food')).toHaveAccessibilityValue({
    text: '£25',
  });
  expect(screen.getByText('Spending over pace')).toBeOnTheScreen();
  fireEvent.press(screen.getByTestId('finance-dismiss-alerts'));
  expect(screen.queryByText('Spending over pace')).not.toBeOnTheScreen();
  fireEvent.press(screen.getByTestId('finance-entry-entry-1'));
  expect(mockPush).toHaveBeenCalledWith('/trips/trip-1/spend/entry-1');
});

it('renders the empty and unavailable states', () => {
  mockFinancials.mockReturnValue({
    state: {
      status: 'loaded',
      financials: { entries: [], categoryTotals: [], burndown: null, alerts: [] },
    },
  });
  render(<FinanceScreen />);
  expect(screen.getByTestId('finance-empty')).toBeOnTheScreen();
  expect(screen.getByTestId('finance-burndown-unavailable')).toBeOnTheScreen();
});
