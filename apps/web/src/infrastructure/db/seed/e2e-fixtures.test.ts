import { describe, expect, it } from 'vitest';
import { E2E_FIXTURES } from './e2e-fixtures';

describe('E2E_FIXTURES', () => {
  it('leaves room for mutating planning journeys', () => {
    const plannedPence =
      E2E_FIXTURES.destinations.reduce((total, item) => total + item.estimatedBudgetPence, 0) +
      E2E_FIXTURES.fixedCosts.reduce((total, item) => total + item.amountPence, 0);

    expect(plannedPence).toBeLessThan(E2E_FIXTURES.trip.totalBudgetPence);
  });
});
