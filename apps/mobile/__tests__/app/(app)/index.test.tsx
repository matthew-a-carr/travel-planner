/**
 * Trips list screen tests (SPEC-011 §3). useAuth, useTrips, and
 * expo-router are mocked so each case injects its state directly; the
 * hook's own behaviour has its own suite (__tests__/trips/use-trips).
 *
 * Cases:
 *  (a) auth not signed_in        → renders null
 *  (b) loading                   → spinner state (criterion 2)
 *  (c) loaded with trips         → name/dates/status/budget (criterion 1)
 *  (d) loaded empty              → empty state (criterion 4)
 *  (e) error                     → message + Retry calls reload (criterion 3)
 *  (f) pull-to-refresh           → refresh() called (criterion 5)
 *  (g) profile button            → router.push('/me') (criterion 6)
 *  (h) item tap                  → router.push('/trips/{id}')
 */

const mockUseAuth = jest.fn();
const mockUseTrips = jest.fn();
const mockPush = jest.fn();
const mockReload = jest.fn();
const mockRefresh = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../src/auth/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));
jest.mock('../../../src/trips/use-trips', () => ({
  useTrips: () => mockUseTrips(),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
}));

import { fireEvent, render, screen } from '@testing-library/react-native';
import TripsScreen from '../../../app/(app)/index';

const TRIP = {
  id: 'trip-1',
  name: 'Japan 2026',
  status: 'planning' as const,
  totalBudget: { amountPence: 500_000, currency: 'GBP' as const },
  startDate: '2026-09-01',
  endDate: '2026-09-21',
  organizationId: 'org-1',
  updatedAt: '2026-05-30T12:34:56.789Z',
};

function withTripsState(state: unknown, refreshing = false) {
  mockUseTrips.mockReturnValue({ state, refreshing, reload: mockReload, refresh: mockRefresh });
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
  withTripsState({ status: 'loaded', trips: [TRIP] });
});

describe('TripsScreen', () => {
  it('(a) renders null while auth.status !== "signed_in"', () => {
    mockUseAuth.mockReturnValue({ status: 'unknown', signIn: jest.fn(), signOut: jest.fn() });

    render(<TripsScreen />);

    expect(screen.queryByTestId('trips-screen-root')).toBeNull();
  });

  it('(b) renders the loading state while the fetch is in flight', () => {
    withTripsState({ status: 'loading' });

    render(<TripsScreen />);

    expect(screen.getByTestId('trips-screen-loading')).toBeOnTheScreen();
    expect(screen.queryByTestId('trips-screen-empty')).toBeNull();
    expect(screen.queryByTestId('trips-screen-error')).toBeNull();
  });

  it('(c) renders name, date range, status, and budget for each trip', () => {
    render(<TripsScreen />);

    const card = screen.getByTestId('trips-screen-item-trip-1');
    expect(card).toBeOnTheScreen();
    expect(card).toHaveTextContent(/Japan 2026/);
    expect(card).toHaveTextContent(/1 Sep 2026 – 21 Sep 2026/);
    expect(card).toHaveTextContent(/Planning/);
    expect(card).toHaveTextContent(/£5,000 budget/);
  });

  it('(d) renders the empty state for a user with no trips', () => {
    withTripsState({ status: 'loaded', trips: [] });

    render(<TripsScreen />);

    expect(screen.getByTestId('trips-screen-empty')).toBeOnTheScreen();
    expect(screen.getByText('No trips yet')).toBeOnTheScreen();
  });

  it('(e) renders the error state and Retry triggers reload()', () => {
    withTripsState({ status: 'error', message: 'Could not load your trips.' });

    render(<TripsScreen />);

    expect(screen.getByTestId('trips-screen-error')).toHaveTextContent(
      /Could not load your trips\./,
    );
    fireEvent.press(screen.getByTestId('trips-screen-retry'));
    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it('(f) pull-to-refresh triggers refresh()', () => {
    render(<TripsScreen />);

    const list = screen.getByTestId('trips-screen-list');
    list.props.refreshControl.props.onRefresh();

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('(g) the profile button navigates to /me', () => {
    render(<TripsScreen />);

    fireEvent.press(screen.getByTestId('trips-screen-profile'));

    expect(mockPush).toHaveBeenCalledWith('/me');
  });

  it('(h) tapping a trip navigates to its detail route', () => {
    render(<TripsScreen />);

    fireEvent.press(screen.getByTestId('trips-screen-item-trip-1'));

    expect(mockPush).toHaveBeenCalledWith('/trips/trip-1');
  });
});
