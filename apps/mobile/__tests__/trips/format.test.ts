import { formatDateRange, formatPence } from '../../src/trips/format';

describe('formatPence', () => {
  it('formats whole-pound amounts without pence', () => {
    expect(formatPence({ amountPence: 500_000, currency: 'GBP' })).toBe('£5,000');
  });

  it('keeps pence when the remainder is non-zero', () => {
    expect(formatPence({ amountPence: 12_345, currency: 'GBP' })).toBe('£123.45');
  });

  it('formats zero', () => {
    expect(formatPence({ amountPence: 0, currency: 'GBP' })).toBe('£0');
  });

  it('formats negative amounts (over-allocated budgets)', () => {
    expect(formatPence({ amountPence: -5_000, currency: 'GBP' })).toBe('-£50');
  });

  it('uses the right symbol per currency', () => {
    expect(formatPence({ amountPence: 100, currency: 'USD' })).toBe('$1');
    expect(formatPence({ amountPence: 100, currency: 'EUR' })).toBe('€1');
    expect(formatPence({ amountPence: 100, currency: 'AUD' })).toBe('A$1');
  });

  it('adds thousands separators to large amounts', () => {
    expect(formatPence({ amountPence: 123_456_789, currency: 'GBP' })).toBe('£1,234,567.89');
  });
});

describe('formatDateRange', () => {
  it('formats a full range', () => {
    expect(formatDateRange('2026-09-01', '2026-09-21')).toBe('1 Sep 2026 – 21 Sep 2026');
  });

  it('formats a start-only range', () => {
    expect(formatDateRange('2026-09-01', null)).toBe('From 1 Sep 2026');
  });

  it('formats an end-only range', () => {
    expect(formatDateRange(null, '2026-09-21')).toBe('Until 21 Sep 2026');
  });

  it('falls back when both sides are missing', () => {
    expect(formatDateRange(null, null)).toBe('Dates TBC');
  });

  it('covers every month abbreviation', () => {
    expect(formatDateRange('2026-01-15', '2026-12-31')).toBe('15 Jan 2026 – 31 Dec 2026');
  });
});
