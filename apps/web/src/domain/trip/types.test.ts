import { describe, expect, it } from 'vitest';
import { addMoney, formatMoney, money, moneyUnchecked } from './types';

// ─── money ────────────────────────────────────────────────────────────────────

describe('money', () => {
  it('returns ok with a Money value for valid integer pence', () => {
    const result = money(5_000, 'GBP');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.amountPence).toBe(5_000);
      expect(result.value.currency).toBe('GBP');
    }
  });

  it('defaults currency to GBP when not provided', () => {
    const result = money(1_000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.currency).toBe('GBP');
  });

  it('accepts zero', () => {
    const result = money(0, 'GBP');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.amountPence).toBe(0);
  });

  it('accepts negative values (used for over-allocated available budget)', () => {
    const result = money(-500, 'GBP');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.amountPence).toBe(-500);
  });

  it('returns err when amountPence is not an integer', () => {
    const result = money(10.5, 'GBP');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/integer/);
  });

  it('accepts all supported currencies', () => {
    for (const currency of ['USD', 'EUR', 'AUD'] as const) {
      const result = money(100, currency);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.currency).toBe(currency);
    }
  });
});

// ─── addMoney ─────────────────────────────────────────────────────────────────

describe('addMoney', () => {
  it('returns ok with the sum when currencies match', () => {
    const result = addMoney(moneyUnchecked(1_000, 'GBP'), moneyUnchecked(2_000, 'GBP'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.amountPence).toBe(3_000);
      expect(result.value.currency).toBe('GBP');
    }
  });

  it('correctly handles adding zero', () => {
    const result = addMoney(moneyUnchecked(5_000, 'GBP'), moneyUnchecked(0, 'GBP'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.amountPence).toBe(5_000);
  });

  it('correctly handles negative operands', () => {
    const result = addMoney(moneyUnchecked(5_000, 'GBP'), moneyUnchecked(-2_000, 'GBP'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.amountPence).toBe(3_000);
  });

  it('returns err when currencies differ', () => {
    const result = addMoney(moneyUnchecked(1_000, 'GBP'), moneyUnchecked(1_000, 'USD'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/different currencies/);
  });
});

// ─── formatMoney ──────────────────────────────────────────────────────────────

describe('formatMoney', () => {
  it('formats GBP with £ symbol', () => {
    expect(formatMoney(moneyUnchecked(5_000_00, 'GBP'))).toBe('£5000.00');
  });

  it('formats USD with $ symbol', () => {
    expect(formatMoney(moneyUnchecked(1_000, 'USD'))).toBe('$10.00');
  });

  it('formats EUR with € symbol', () => {
    expect(formatMoney(moneyUnchecked(2_500, 'EUR'))).toBe('€25.00');
  });

  it('formats AUD with A$ symbol', () => {
    expect(formatMoney(moneyUnchecked(3_750, 'AUD'))).toBe('A$37.50');
  });

  it('formats zero correctly', () => {
    expect(formatMoney(moneyUnchecked(0, 'GBP'))).toBe('£0.00');
  });

  it('formats amounts with pence (two decimal places)', () => {
    expect(formatMoney(moneyUnchecked(1_099, 'GBP'))).toBe('£10.99');
  });

  it('formats negative amounts with a minus sign', () => {
    expect(formatMoney(moneyUnchecked(-500, 'GBP'))).toBe('£-5.00');
  });
});
