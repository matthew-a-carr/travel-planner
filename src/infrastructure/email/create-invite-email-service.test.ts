import { describe, expect, it } from 'vitest';
import { createInviteEmailService } from './create-invite-email-service';
import { LoggingEmailService } from './logging-email-service';
import { ResendEmailService } from './resend-email-service';

const inviteInput = {
  recipient: {
    id: 'recipient',
    email: 'new.member@example.com',
    name: 'New Member',
    firstName: 'New',
    lastName: 'Member',
    isApproved: true,
    isAdmin: false,
    createdAt: new Date('2026-03-07T10:00:00.000Z'),
  },
  inviter: {
    id: 'admin',
    email: 'admin@example.com',
    name: 'Admin User',
    firstName: 'Admin',
    lastName: 'User',
    isApproved: true,
    isAdmin: true,
    createdAt: new Date('2026-03-07T09:00:00.000Z'),
  },
  loginUrl: 'https://travel.matthewcarr.dev/login',
} as const;

describe('createInviteEmailService', () => {
  it('returns logging provider for development-like environments', () => {
    const service = createInviteEmailService({
      NODE_ENV: 'development',
      VERCEL_ENV: 'development',
      RESEND_API_KEY: 're_example',
    });

    expect(service).toBeInstanceOf(LoggingEmailService);
  });

  it('returns logging provider in preview even when api key is set', () => {
    const service = createInviteEmailService({
      NODE_ENV: 'production',
      VERCEL_ENV: 'preview',
      RESEND_API_KEY: 're_preview_key',
    });

    expect(service).toBeInstanceOf(LoggingEmailService);
  });

  it('returns production misconfigured path when api key is missing in production', async () => {
    const service = createInviteEmailService({
      NODE_ENV: 'production',
      VERCEL_ENV: 'production',
      RESEND_API_KEY: '',
    });

    expect(service).toBeInstanceOf(LoggingEmailService);

    await expect(service.sendUserAddedInvite(inviteInput)).resolves.toEqual({
      ok: false,
      error: 'Invite email provider misconfigured in production (missing RESEND_API_KEY).',
    });
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

  it('does not treat NODE_ENV=production as Vercel production', () => {
    const service = createInviteEmailService({
      NODE_ENV: 'production',
      RESEND_API_KEY: 're_prod_123',
      EMAIL_FROM_ADDRESS: 'hello@mail.matthewcarr.dev',
      EMAIL_FROM_NAME: 'Travel Planner',
    });

    expect(service).toBeInstanceOf(LoggingEmailService);
  });
});
