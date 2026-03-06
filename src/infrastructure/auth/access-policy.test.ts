import { describe, expect, it } from 'vitest';
import {
  getAdminEmailSet,
  isConfiguredAdminEmail,
  isSelfRegistrationEnabled,
  normalizeEmail,
  splitName,
} from './access-policy';

describe('access-policy helpers', () => {
  it('parses comma-separated admin emails case-insensitively', () => {
    const env = {
      AUTH_ADMIN_EMAILS: ' Admin@Example.com , second@example.com ,,',
    };

    const admins = getAdminEmailSet(env);
    expect(admins.has('admin@example.com')).toBe(true);
    expect(admins.has('second@example.com')).toBe(true);
    expect(admins.size).toBe(2);
  });

  it('parses newline and semicolon separated admin emails', () => {
    const env = {
      AUTH_ADMIN_EMAILS: 'admin@example.com;\nsecond@example.com',
    };

    const admins = getAdminEmailSet(env);
    expect(admins.has('admin@example.com')).toBe(true);
    expect(admins.has('second@example.com')).toBe(true);
    expect(admins.size).toBe(2);
  });

  it('detects configured admin email regardless of case', () => {
    const env = {
      AUTH_ADMIN_EMAILS: 'admin@example.com',
    };

    expect(isConfiguredAdminEmail('ADMIN@example.com', env)).toBe(true);
    expect(isConfiguredAdminEmail('other@example.com', env)).toBe(false);
  });

  it('does not treat local-dev user as configured admin without explicit allowlist', () => {
    const env = {
      AUTH_ADMIN_EMAILS: 'admin@example.com',
      AUTH_ENABLE_LOCAL_DEV: 'true',
      NODE_ENV: 'production',
    } as const;

    expect(isConfiguredAdminEmail('local-dev@travel-planner.local', env)).toBe(false);
  });

  it('matches gmail aliases against configured admin emails', () => {
    const env = {
      AUTH_ADMIN_EMAILS: 'carr.matty@gmail.com',
    };

    expect(isConfiguredAdminEmail('CarrMatty@googlemail.com', env)).toBe(true);
    expect(isConfiguredAdminEmail('c.a.r.r.m.a.t.t.y+alias@gmail.com', env)).toBe(true);
  });

  it('supports truthy self-registration flag values', () => {
    expect(isSelfRegistrationEnabled({ AUTH_SELF_REGISTRATION_ENABLED: 'true' })).toBe(true);
    expect(isSelfRegistrationEnabled({ AUTH_SELF_REGISTRATION_ENABLED: '1' })).toBe(true);
    expect(isSelfRegistrationEnabled({ AUTH_SELF_REGISTRATION_ENABLED: 'on' })).toBe(true);
    expect(isSelfRegistrationEnabled({ AUTH_SELF_REGISTRATION_ENABLED: 'false' })).toBe(false);
  });

  it('normalizes emails safely', () => {
    expect(normalizeEmail('  Test@Example.Com ')).toBe('test@example.com');
    expect(normalizeEmail('Carr.Matty+travel@GoogleMail.com')).toBe('carrmatty@gmail.com');
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
