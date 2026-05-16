import { describe, expect, it } from 'vitest';
import { LoggingEmailService } from './logging-email-service';

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

describe('LoggingEmailService', () => {
  it('returns success in non-production environments', async () => {
    const service = new LoggingEmailService({
      environment: 'preview',
      fromAddress: 'hello@mail.matthewcarr.dev',
      fromName: 'Travel Planner',
    });

    const result = await service.sendUserAddedInvite(inviteInput);
    expect(result).toEqual({
      ok: true,
      providerMessageId: null,
    });
  });

  it('returns failure when used as production fallback', async () => {
    const service = new LoggingEmailService({
      environment: 'production',
      fromAddress: 'hello@mail.matthewcarr.dev',
      fromName: 'Travel Planner',
      isProductionFallback: true,
    });

    const result = await service.sendUserAddedInvite(inviteInput);
    expect(result).toEqual({
      ok: false,
      error: 'Invite email provider misconfigured in production (missing RESEND_API_KEY).',
    });
  });
});
