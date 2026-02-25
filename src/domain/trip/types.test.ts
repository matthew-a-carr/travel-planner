import { describe, expect, it } from 'vitest';
import { addMoney, formatMoney, money } from './types';

// ─── money ────────────────────────────────────────────────────────────────────

describe('money', () => {
  it('creates a Money value with the given amountPence and currency', () => {
    const m = money(5_000, 'GBP');
    expect(m.amountPence).toBe(5_000);
    expect(m.currency).toBe('GBP');
  });

  it('defaults currency to GBP when not provided', () => {
    const m = money(1_000);
    expect(m.currency).toBe('GBP');
  });

  it('accepts zero', () => {
    expect(money(0, 'GBP').amountPence).toBe(0);
  });

  it('accepts negative values (used for over-allocated available budget)', () => {
    expect(money(-500, 'GBP').amountPence).toBe(-500);
  });

  it('throws when amountPence is not an integer', () => {
    expect(() => money(10.5, 'GBP')).toThrow('integer');
  });

  it('accepts all supported currencies', () => {
    expect(money(100, 'USD').currency).toBe('USD');
    expect(money(100, 'EUR').currency).toBe('EUR');
    expect(money(100, 'AUD').currency).toBe('AUD');
  });
});

// ─── addMoney ─────────────────────────────────────────────────────────────────

describe('addMoney', () => {
  it('sums two amounts with the same currency', () => {
    const result = addMoney(money(1_000, 'GBP'), money(2_000, 'GBP'));
    expect(result.amountPence).toBe(3_000);
    expect(result.currency).toBe('GBP');
  });

  it('correctly handles adding zero', () => {
    const result = addMoney(money(5_000, 'GBP'), money(0, 'GBP'));
    expect(result.amountPence).toBe(5_000);
  });

  it('correctly handles negative operands', () => {
    const result = addMoney(money(5_000, 'GBP'), money(-2_000, 'GBP'));
    expect(result.amountPence).toBe(3_000);
  });

  it('throws when currencies differ', () => {
    expect(() => addMoney(money(1_000, 'GBP'), money(1_000, 'USD'))).toThrow(
      'different currencies',
    );
  });
});

// ─── formatMoney ──────────────────────────────────────────────────────────────

describe('formatMoney', () => {
  it('formats GBP with £ symbol', () => {
    expect(formatMoney(money(5_000_00, 'GBP'))).toBe('£5000.00');
  });

  it('formats USD with $ symbol', () => {
    expect(formatMoney(money(1_000, 'USD'))).toBe('$10.00');
  });

  it('formats EUR with € symbol', () => {
    expect(formatMoney(money(2_500, 'EUR'))).toBe('€25.00');
  });

  it('formats AUD with A$ symbol', () => {
    expect(formatMoney(money(3_750, 'AUD'))).toBe('A$37.50');
  });

  it('formats zero correctly', () => {
    expect(formatMoney(money(0, 'GBP'))).toBe('£0.00');
  });

  it('formats amounts with pence (two decimal places)', () => {
    expect(formatMoney(money(1_099, 'GBP'))).toBe('£10.99');
  });

  it('formats negative amounts with a minus sign', () => {
    expect(formatMoney(money(-500, 'GBP'))).toBe('£-5.00');
  });
});
