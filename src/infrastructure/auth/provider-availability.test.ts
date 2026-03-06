import { describe, expect, it } from 'vitest';
import {
  getVisibleSignInProviders,
  isDevLocalLoginEnabled,
  isGoogleConfigured,
} from './provider-availability';

describe('provider-availability', () => {
  it('shows local dev only when in development with placeholder Google credentials', () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: 'development',
      AUTH_GOOGLE_ID: 'dev-placeholder-client-id',
      AUTH_GOOGLE_SECRET: 'dev-placeholder-client-secret',
    };

    expect(isDevLocalLoginEnabled(env)).toBe(true);
    expect(isGoogleConfigured(env)).toBe(false);
    expect(getVisibleSignInProviders(env)).toEqual({
      showGoogle: false,
      showLocalDev: true,
    });
  });

  it('shows both local dev and Google when development has real Google credentials', () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: 'development',
      AUTH_GOOGLE_ID: 'real-google-client-id',
      AUTH_GOOGLE_SECRET: 'real-google-client-secret',
    };

    expect(getVisibleSignInProviders(env)).toEqual({
      showGoogle: true,
      showLocalDev: true,
    });
  });

  it('shows only Google in production when credentials are configured', () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      AUTH_GOOGLE_ID: 'real-google-client-id',
      AUTH_GOOGLE_SECRET: 'real-google-client-secret',
    };

    expect(getVisibleSignInProviders(env)).toEqual({
      showGoogle: true,
      showLocalDev: false,
    });
  });

  it('shows local dev in production only when explicitly enabled', () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      AUTH_ENABLE_LOCAL_DEV: 'true',
      AUTH_GOOGLE_ID: 'real-google-client-id',
      AUTH_GOOGLE_SECRET: 'real-google-client-secret',
    };

    expect(isDevLocalLoginEnabled(env)).toBe(true);
    expect(getVisibleSignInProviders(env)).toEqual({
      showGoogle: true,
      showLocalDev: true,
    });
  });

  it('hides both providers in production when Google is missing or placeholders are used', () => {
    const envMissing: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      AUTH_GOOGLE_ID: '',
      AUTH_GOOGLE_SECRET: '',
    };
    const envPlaceholder: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      AUTH_GOOGLE_ID: 'replace-with-google-oauth-client-id',
      AUTH_GOOGLE_SECRET: 'replace-with-google-oauth-client-secret',
    };

    expect(getVisibleSignInProviders(envMissing)).toEqual({
      showGoogle: false,
      showLocalDev: false,
    });
    expect(getVisibleSignInProviders(envPlaceholder)).toEqual({
      showGoogle: false,
      showLocalDev: false,
    });
  });

  it('treats CI placeholder values as configured Google credentials', () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      AUTH_GOOGLE_ID: 'ci-placeholder-client-id',
      AUTH_GOOGLE_SECRET: 'ci-placeholder-client-secret',
    };

    expect(isGoogleConfigured(env)).toBe(true);
  });

  it('treats common truthy values as enabled for AUTH_ENABLE_LOCAL_DEV', () => {
    const baseEnv: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      AUTH_GOOGLE_ID: '',
      AUTH_GOOGLE_SECRET: '',
    };

    expect(isDevLocalLoginEnabled({ ...baseEnv, AUTH_ENABLE_LOCAL_DEV: '1' })).toBe(true);
    expect(isDevLocalLoginEnabled({ ...baseEnv, AUTH_ENABLE_LOCAL_DEV: 'yes' })).toBe(true);
    expect(isDevLocalLoginEnabled({ ...baseEnv, AUTH_ENABLE_LOCAL_DEV: 'on' })).toBe(true);
    expect(isDevLocalLoginEnabled({ ...baseEnv, AUTH_ENABLE_LOCAL_DEV: 'false' })).toBe(false);
  });
});
