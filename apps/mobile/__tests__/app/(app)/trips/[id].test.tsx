/**
 * Trip detail screen tests (SPEC-012 §3). useAuth, useTripDetail, and
 * expo-router are mocked; the hook's behaviour has its own suite.
 *
 * Cases:
 *  (a) auth not signed_in → null
 *  (b) loading            → spinner (criterion 2)
 *  (c) loaded             → name/status/dates + spend + legs + fixed costs (criterion 1)
 *  (d) not_found          → dedicated state (criterion 3)
 *  (e) error              → message + Retry → reload (criterion 4)
 *  (f) pull-to-refresh    → refresh() (criterion 5)
 *  (g) empty sections     → placeholders (criterion 6)
 *  (h) over-allocated     → warning shown
 *  (i) back               → router.back()
 */

const mockUseAuth = jest.fn();
const mockUseTripDetail = jest.fn();
const mockBack = jest.fn();
const mockReload = jest.fn();
const mockRefresh = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../../src/auth/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));
jest.mock('../../../../src/trips/use-trip-detail', () => ({
  useTripDetail: (id: string) => mockUseTripDetail(id),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'trip-1' }),
}));

import { fireEvent, render, screen } from '@testing-library/react-native';
import TripDetailScreen from '../../../../app/(app)/trips/[id]';

const DETAIL = {
  id: 'trip-1',
  name: 'Japan 2026',
  status: 'planning' as const,
  totalBudget: { amountPence: 500_000, currency: 'GBP' as const },
  startDate: '2026-09-01',
  endDate: '2026-09-21',
  organizationId: 'org-1',
  updatedAt: '2026-05-30T12:34:56.789Z',
  destinations: [
    {
      id: 'd1',
      name: 'Tokyo',
      country: 'Japan',
      city: 'Tokyo',
      startDate: '2026-09-01',
      endDate: '2026-09-10',
      estimatedBudget: { amountPence: 250_000, currency: 'GBP' as const },
      comfortLevel: 'mid' as const,
      sortOrder: 0,
      spent: { amountPence: 12_345, currency: 'GBP' as const },
    },
    {
      id: 'd2',
      name: 'Kyoto',
      country: 'Japan',
      city: null,
      startDate: null,
      endDate: null,
      estimatedBudget: { amountPence: 100_000, currency: 'GBP' as const },
      comfortLevel: 'budget' as const,
      sortOrder: 1,
      spent: { amountPence: 0, currency: 'GBP' as const },
    },
  ],
  fixedCosts: [
    {
      id: 'f1',
      label: 'Flights',
      amount: { amountPence: 120_000, currency: 'GBP' as const },
      category: 'transport' as const,
      date: '2026-08-15',
      sortOrder: 0,
    },
  ],
  spend: {
    totalBudget: { amountPence: 500_000, currency: 'GBP' as const },
    fixedCosts: { amountPence: 120_000, currency: 'GBP' as const },
    allocated: { amountPence: 350_000, currency: 'GBP' as const },
    available: { amountPence: 30_000, currency: 'GBP' as const },
    spent: { amountPence: 12_345, currency: 'GBP' as const },
    isOverAllocated: false,
  },
};

function withDetailState(state: unknown, refreshing = false) {
  mockUseTripDetail.mockReturnValue({
    state,
    refreshing,
    reload: mockReload,
    refresh: mockRefresh,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRefresh.mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({
    status: 'signed_in',
    me: { id: 'u1', email: 'matt@example.com', name: 'Matt', isApproved: true },
    signIn: jest.fn(),
    signOut: jest.fn(),
  });
  withDetailState({ status: 'loaded', trip: DETAIL });
});

describe('TripDetailScreen', () => {
  it('(a) renders null while auth.status !== "signed_in"', () => {
    mockUseAuth.mockReturnValue({ status: 'signed_out', signIn: jest.fn(), signOut: jest.fn() });

    render(<TripDetailScreen />);

    expect(screen.queryByTestId('trip-detail-root')).toBeNull();
  });

  it('(b) renders the loading state', () => {
    withDetailState({ status: 'loading' });

    render(<TripDetailScreen />);

    expect(screen.getByTestId('trip-detail-loading')).toBeOnTheScreen();
  });

  it('(c) renders the trip header, spend summary, timeline legs, and fixed costs', () => {
    render(<TripDetailScreen />);

    expect(mockUseTripDetail).toHaveBeenCalledWith('trip-1');
    expect(screen.getByTestId('trip-detail-name')).toHaveTextContent(/Japan 2026/);
    expect(screen.getByText(/Planning · 1 Sep 2026 – 21 Sep 2026/)).toBeOnTheScreen();

    const spend = screen.getByTestId('trip-detail-spend');
    expect(spend).toHaveTextContent(/Total budget/);
    expect(spend).toHaveTextContent(/£5,000/);
    expect(spend).toHaveTextContent(/Fixed costs/);
    expect(spend).toHaveTextContent(/£1,200/);
    expect(spend).toHaveTextContent(/Allocated to destinations/);
    expect(spend).toHaveTextContent(/£3,500/);
    expect(spend).toHaveTextContent(/Available/);
    expect(spend).toHaveTextContent(/£300/);
    expect(spend).toHaveTextContent(/Spent so far/);
    expect(spend).toHaveTextContent(/£123\.45/);
    expect(screen.queryByTestId('trip-detail-over-allocated')).toBeNull();

    const tokyo = screen.getByTestId('trip-detail-destination-d1');
    expect(tokyo).toHaveTextContent(/Tokyo, Japan/);
    expect(tokyo).toHaveTextContent(/1 Sep 2026 – 10 Sep 2026/);
    expect(tokyo).toHaveTextContent(/Mid-range/);
    expect(tokyo).toHaveTextContent(/£123\.45 spent of £2,500 budget/);

    const kyoto = screen.getByTestId('trip-detail-destination-d2');
    expect(kyoto).toHaveTextContent(/Kyoto/);
    expect(kyoto).toHaveTextContent(/Dates TBC/);

    const flight = screen.getByTestId('trip-detail-fixed-cost-f1');
    expect(flight).toHaveTextContent(/Flights/);
    expect(flight).toHaveTextContent(/15 Aug 2026/);
    expect(flight).toHaveTextContent(/£1,200/);
  });

  it('(d) renders the not-found state', () => {
    withDetailState({ status: 'not_found' });

    render(<TripDetailScreen />);

    expect(screen.getByTestId('trip-detail-not-found')).toHaveTextContent(/Trip not found/);
  });

  it('(e) renders the error state and Retry triggers reload()', () => {
    withDetailState({ status: 'error', message: 'Could not load this trip.' });

    render(<TripDetailScreen />);

    expect(screen.getByTestId('trip-detail-error')).toHaveTextContent(/Could not load this trip\./);
    fireEvent.press(screen.getByTestId('trip-detail-retry'));
    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it('(f) pull-to-refresh triggers refresh()', () => {
    render(<TripDetailScreen />);

    const scroll = screen.getByTestId('trip-detail-scroll');
    scroll.props.refreshControl.props.onRefresh();

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('(g) renders empty placeholders for a bare trip', () => {
    withDetailState({
      status: 'loaded',
      trip: { ...DETAIL, destinations: [], fixedCosts: [] },
    });

    render(<TripDetailScreen />);

    expect(screen.getByTestId('trip-detail-timeline-empty')).toBeOnTheScreen();
    expect(screen.getByTestId('trip-detail-fixed-costs-empty')).toBeOnTheScreen();
  });

  it('(h) shows the over-allocation warning and negative available', () => {
    withDetailState({
      status: 'loaded',
      trip: {
        ...DETAIL,
        spend: {
          ...DETAIL.spend,
          available: { amountPence: -50_000, currency: 'GBP' as const },
          isOverAllocated: true,
        },
      },
    });

    render(<TripDetailScreen />);

    expect(screen.getByTestId('trip-detail-over-allocated')).toBeOnTheScreen();
    expect(screen.getByTestId('trip-detail-spend')).toHaveTextContent(/-£500/);
  });

  it('(i) the back control navigates back to the list', () => {
    render(<TripDetailScreen />);

    fireEvent.press(screen.getByTestId('trip-detail-back'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
