import { describe, expect, it } from 'vitest';
import { normalizeEmail, splitName } from './access-policy';

describe('access-policy helpers', () => {
  it('normalizes emails safely', () => {
    expect(normalizeEmail('  Test@Example.Com ')).toBe('test@example.com');
    expect(normalizeEmail('Jane.Doe+travel@GoogleMail.com')).toBe('janedoe@gmail.com');
    expect(normalizeEmail('   ')).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });

  it('splits names into first and last name', () => {
    expect(splitName('  Mary Jane Watson  ')).toEqual({
      firstName: 'Mary',
      lastName: 'Jane Watson',
    });
    expect(splitName('Prince')).toEqual({ firstName: 'Prince', lastName: null });
    expect(splitName(' ')).toEqual({ firstName: null, lastName: null });
  });
});
