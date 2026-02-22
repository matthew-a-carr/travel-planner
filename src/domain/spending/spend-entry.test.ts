import { describe, it, expect } from 'vitest';
import { calculateTotalSpend, groupByCategory } from './spend-entry';
import type { SpendEntry } from './types';
import { money } from '../trip/types';

function makeSpendEntry(overrides: Partial<SpendEntry> = {}): SpendEntry {
  return {
    id: 'entry-1',
    destinationId: 'dest-1',
    amount: money(10_000, 'GBP'), // £100
    category: 'food',
    description: null,
    spentAt: new Date('2026-06-15'),
    createdAt: new Date('2026-06-15'),
    ...overrides,
  };
}

describe('calculateTotalSpend', () => {
  it('should return zero GBP when there are no entries', () => {
    const result = calculateTotalSpend([]);
    expect(result.amountPence).toBe(0);
    expect(result.currency).toBe('GBP');
  });

  it('should sum all entry amounts', () => {
    const entries = [
      makeSpendEntry({ id: 'e1', amount: money(5_000, 'GBP') }),
      makeSpendEntry({ id: 'e2', amount: money(3_000, 'GBP') }),
      makeSpendEntry({ id: 'e3', amount: money(2_000, 'GBP') }),
    ];
    const result = calculateTotalSpend(entries);
    expect(result.amountPence).toBe(10_000);
  });

  it('should return currency from the first entry', () => {
    const entries = [makeSpendEntry({ amount: money(5_000, 'GBP') })];
    const result = calculateTotalSpend(entries);
    expect(result.currency).toBe('GBP');
  });
});

describe('groupByCategory', () => {
  it('should return an empty map when there are no entries', () => {
    const result = groupByCategory([]);
    expect(result.size).toBe(0);
  });

  it('should group entries by category', () => {
    const entries = [
      makeSpendEntry({ id: 'e1', category: 'food' }),
      makeSpendEntry({ id: 'e2', category: 'transport' }),
      makeSpendEntry({ id: 'e3', category: 'food' }),
    ];
    const result = groupByCategory(entries);
    expect(result.get('food')).toHaveLength(2);
    expect(result.get('transport')).toHaveLength(1);
  });

  it('should preserve all entry data in groups', () => {
    const entry = makeSpendEntry({ id: 'e1', category: 'accommodation' });
    const result = groupByCategory([entry]);
    expect(result.get('accommodation')?.[0]).toEqual(entry);
  });
});
