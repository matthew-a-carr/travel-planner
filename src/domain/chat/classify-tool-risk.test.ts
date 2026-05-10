import { describe, expect, it } from 'vitest';
import { type ClassifyContext, classifyToolRisk } from './classify-tool-risk';

function ctx(overrides: Partial<ClassifyContext> = {}): ClassifyContext {
  return {
    remainingDailyBudgetPence: 5_000,
    destinationAvailablePence: 100_000,
    fixedCostHeadroomPence: 500_000,
    changesScheduleDates: false,
    breachesAllocationCap: false,
    amountPence: 0,
    ...overrides,
  };
}

describe('classifyToolRisk', () => {
  describe('edit_trip_budget', () => {
    it('always confirms — trip-level invariant', () => {
      expect(classifyToolRisk('edit_trip_budget', ctx({ amountPence: 1 }))).toBe('confirm');
      expect(classifyToolRisk('edit_trip_budget', ctx({ amountPence: 6_000_000 }))).toBe('confirm');
    });
  });

  describe('delete_spend_entry', () => {
    it('always auto — reversible via undo', () => {
      expect(classifyToolRisk('delete_spend_entry', ctx())).toBe('auto');
    });
  });

  describe('record_spend', () => {
    it('auto when within pace headroom and destination has room', () => {
      const result = classifyToolRisk(
        'record_spend',
        ctx({ amountPence: 6_000, remainingDailyBudgetPence: 5_000 }),
      );
      expect(result).toBe('auto');
    });

    it('confirms when above 1.5× the daily pace target', () => {
      const result = classifyToolRisk(
        'record_spend',
        ctx({ amountPence: 8_000, remainingDailyBudgetPence: 5_000 }),
      );
      expect(result).toBe('confirm');
    });

    it('confirms when destination has no available budget', () => {
      const result = classifyToolRisk(
        'record_spend',
        ctx({
          amountPence: 1_000,
          remainingDailyBudgetPence: 5_000,
          destinationAvailablePence: 500,
        }),
      );
      expect(result).toBe('confirm');
    });

    it('confirms when daily pace is unknown (no dated plan)', () => {
      const result = classifyToolRisk(
        'record_spend',
        ctx({ amountPence: 100, remainingDailyBudgetPence: 0 }),
      );
      expect(result).toBe('confirm');
    });
  });

  describe('edit_destination', () => {
    it('auto for budget/label/comfort tweaks within cap', () => {
      const result = classifyToolRisk(
        'edit_destination',
        ctx({ changesScheduleDates: false, breachesAllocationCap: false }),
      );
      expect(result).toBe('auto');
    });

    it('confirms when schedule dates change', () => {
      const result = classifyToolRisk(
        'edit_destination',
        ctx({ changesScheduleDates: true, breachesAllocationCap: false }),
      );
      expect(result).toBe('confirm');
    });

    it('confirms when the budget delta would breach the allocation cap', () => {
      const result = classifyToolRisk(
        'edit_destination',
        ctx({ changesScheduleDates: false, breachesAllocationCap: true }),
      );
      expect(result).toBe('confirm');
    });
  });

  describe('add_fixed_cost', () => {
    it('auto when the new cost fits in the remaining headroom', () => {
      const result = classifyToolRisk(
        'add_fixed_cost',
        ctx({ amountPence: 100_000, fixedCostHeadroomPence: 500_000 }),
      );
      expect(result).toBe('auto');
    });

    it('confirms when the new cost would exceed headroom', () => {
      const result = classifyToolRisk(
        'add_fixed_cost',
        ctx({ amountPence: 600_000, fixedCostHeadroomPence: 500_000 }),
      );
      expect(result).toBe('confirm');
    });

    it('confirms when headroom is zero', () => {
      const result = classifyToolRisk(
        'add_fixed_cost',
        ctx({ amountPence: 1, fixedCostHeadroomPence: 0 }),
      );
      expect(result).toBe('confirm');
    });
  });
});
