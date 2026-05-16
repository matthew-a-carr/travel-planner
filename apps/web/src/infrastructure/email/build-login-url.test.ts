import { describe, expect, it } from 'vitest';
import { buildLoginUrl, resolveAppBaseUrl } from './build-login-url';

describe('build-login-url', () => {
  it('uses AUTH_URL when configured', () => {
    expect(resolveAppBaseUrl({ AUTH_URL: 'https://travel.matthewcarr.dev/' })).toBe(
      'https://travel.matthewcarr.dev',
    );
    expect(buildLoginUrl({ AUTH_URL: 'https://travel.matthewcarr.dev/' })).toBe(
      'https://travel.matthewcarr.dev/login',
    );
  });

  it('falls back to https VERCEL_URL when AUTH_URL is missing', () => {
    expect(buildLoginUrl({ VERCEL_URL: 'travel-preview.vercel.app' })).toBe(
      'https://travel-preview.vercel.app/login',
    );
  });

  it('falls back to localhost when neither AUTH_URL nor VERCEL_URL is set', () => {
    expect(buildLoginUrl({})).toBe('http://localhost:3000/login');
  });
});
