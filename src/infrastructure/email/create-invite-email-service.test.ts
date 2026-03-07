import { describe, expect, it } from 'vitest';
import { createInviteEmailService } from './create-invite-email-service';
import { LoggingEmailService } from './logging-email-service';
import { ResendEmailService } from './resend-email-service';

describe('createInviteEmailService', () => {
  it('returns logging provider for development-like environments', () => {
    const service = createInviteEmailService({
      NODE_ENV: 'development',
      VERCEL_ENV: 'development',
      RESEND_API_KEY: 're_example',
    });

    expect(service).toBeInstanceOf(LoggingEmailService);
  });

  it('returns logging provider in production when api key is missing', () => {
    const service = createInviteEmailService({
      NODE_ENV: 'production',
      VERCEL_ENV: 'production',
      RESEND_API_KEY: '',
    });

    expect(service).toBeInstanceOf(LoggingEmailService);
  });

  it('returns resend provider in Vercel production with a configured key', () => {
    const service = createInviteEmailService({
      NODE_ENV: 'production',
      VERCEL_ENV: 'production',
      RESEND_API_KEY: 're_prod_123',
      EMAIL_FROM_ADDRESS: 'hello@mail.matthewcarr.dev',
      EMAIL_FROM_NAME: 'Travel Planner',
    });

    expect(service).toBeInstanceOf(ResendEmailService);
  });

  it('accepts RESEND_API_KEY_PRODUCTION as a fallback source', () => {
    const service = createInviteEmailService({
      NODE_ENV: 'production',
      VERCEL_ENV: 'production',
      RESEND_API_KEY_PRODUCTION: 're_prod_fallback_123',
      EMAIL_FROM_ADDRESS: 'hello@mail.matthewcarr.dev',
      EMAIL_FROM_NAME: 'Travel Planner',
    });

    expect(service).toBeInstanceOf(ResendEmailService);
  });
});
