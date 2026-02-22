import type { Destination } from './types';
import type { Result } from '../trip/types';
import { ok, err } from '../trip/types';

/**
 * Validates that a destination's date range is coherent.
 * Both dates must be provided together, and start must be before end.
 */
export function validateDateRange(
  destination: Pick<Destination, 'startDate' | 'endDate'>,
): Result<true> {
  const { startDate, endDate } = destination;

  if (startDate === null && endDate === null) return ok(true);

  if (startDate !== null && endDate === null) {
    return err('End date is required when start date is set');
  }

  if (startDate === null && endDate !== null) {
    return err('Start date is required when end date is set');
  }

  if (startDate !== null && endDate !== null && startDate >= endDate) {
    return err('Start date must be before end date');
  }

  return ok(true);
}

/**
 * Returns destinations sorted by their sort_order, then creation date.
 */
export function sortDestinations(
  destinations: readonly Destination[],
): Destination[] {
  return [...destinations].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}
