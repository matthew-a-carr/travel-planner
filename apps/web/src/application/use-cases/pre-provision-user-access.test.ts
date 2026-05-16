import type { InviteEmailService } from '@/application/ports/invite-email-service';
import { describe, expect, it, vi } from 'vitest';
import type { UserAccessRepository } from '@/domain/user-access/user-access-repository';
import { preProvisionUserAccess } from './pre-provision-user-access';

function createRepositoryMock(): UserAccessRepository {
  return {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    listAll: vi.fn(),
    createOrApproveByEmail: vi.fn(),
    updateApproval: vi.fn(),
    updateAdmin: vi.fn(),
    findSoleOwnerOrganizations: vi.fn(),
    deleteUser: vi.fn(),
  };
}

function createInviteEmailServiceMock(): InviteEmailService {
  return {
    sendUserAddedInvite: vi.fn(),
  };
}

describe('preProvisionUserAccess', () => {
  it('forbids non-admin actors', async () => {
    const repository = createRepositoryMock();
    const inviteEmailService = createInviteEmailServiceMock();
    vi.mocked(repository.findById).mockResolvedValue({
      id: 'actor',
      email: 'actor@example.com',
      name: 'Actor',
      firstName: 'Actor',
      lastName: null,
      isApproved: true,
      isAdmin: false,
      createdAt: new Date(),
    });

    const result = await preProvisionUserAccess(repository, inviteEmailService, {
      actorUserId: 'actor',
      email: 'new.user@example.com',
      name: 'New User',
      loginUrl: 'http://localhost:3000/login',
    });

    expect(result).toEqual({ ok: false, error: 'Forbidden' });
    expect(inviteEmailService.sendUserAddedInvite).not.toHaveBeenCalled();
  });

  it('returns validation error for invalid emails', async () => {
    const repository = createRepositoryMock();
    const inviteEmailService = createInviteEmailServiceMock();

    const result = await preProvisionUserAccess(repository, inviteEmailService, {
      actorUserId: 'actor',
      email: 'not-an-email',
      name: null,
      loginUrl: 'http://localhost:3000/login',
    });

    expect(result).toEqual({ ok: false, error: 'Valid email is required' });
    expect(repository.findById).not.toHaveBeenCalled();
    expect(inviteEmailService.sendUserAddedInvite).not.toHaveBeenCalled();
  });

  it('pre-provisions approved users and sends invite when approval changes', async () => {
    const repository = createRepositoryMock();
    const inviteEmailService = createInviteEmailServiceMock();
    vi.mocked(repository.findById).mockResolvedValue({
      id: 'admin',
      email: 'admin@example.com',
      name: 'Admin',
      firstName: 'Admin',
      lastName: null,
      isApproved: true,
      isAdmin: true,
      createdAt: new Date(),
    });
    vi.mocked(repository.createOrApproveByEmail).mockResolvedValue({
      user: {
        id: 'new-user',
        email: 'new.user@example.com',
        name: 'New User',
        firstName: 'New',
        lastName: 'User',
        isApproved: true,
        isAdmin: false,
        createdAt: new Date(),
      },
      approvalTransition: 'approved_now',
    });
    vi.mocked(inviteEmailService.sendUserAddedInvite).mockResolvedValue({
      ok: true,
      providerMessageId: 'email_123',
    });

    const result = await preProvisionUserAccess(repository, inviteEmailService, {
      actorUserId: 'admin',
      email: 'New.User@Example.com',
      name: '  New User  ',
      loginUrl: 'http://localhost:3000/login',
    });

    expect(result.ok).toBe(true);
    expect(repository.createOrApproveByEmail).toHaveBeenCalledWith({
      email: 'New.User@Example.com',
      name: 'New User',
      isApproved: true,
      isAdmin: false,
    });
    expect(inviteEmailService.sendUserAddedInvite).toHaveBeenCalledWith({
      recipient: expect.objectContaining({
        email: 'new.user@example.com',
      }),
      inviter: expect.objectContaining({
        email: 'admin@example.com',
      }),
      loginUrl: 'http://localhost:3000/login',
    });
  });

  it('skips invite sends for already-approved users', async () => {
    const repository = createRepositoryMock();
    const inviteEmailService = createInviteEmailServiceMock();
    vi.mocked(repository.findById).mockResolvedValue({
      id: 'admin',
      email: 'admin@example.com',
      name: 'Admin',
      firstName: 'Admin',
      lastName: null,
      isApproved: true,
      isAdmin: true,
      createdAt: new Date(),
    });
    vi.mocked(repository.createOrApproveByEmail).mockResolvedValue({
      user: {
        id: 'existing-user',
        email: 'existing.user@example.com',
        name: 'Existing User',
        firstName: 'Existing',
        lastName: 'User',
        isApproved: true,
        isAdmin: false,
        createdAt: new Date(),
      },
      approvalTransition: 'already_approved',
    });

    const result = await preProvisionUserAccess(repository, inviteEmailService, {
      actorUserId: 'admin',
      email: 'existing.user@example.com',
      name: 'Existing User',
      loginUrl: 'http://localhost:3000/login',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.inviteDelivery).toEqual({ status: 'skipped' });
    expect(inviteEmailService.sendUserAddedInvite).not.toHaveBeenCalled();
  });

  it('keeps pre-provision successful when invite delivery fails', async () => {
    const repository = createRepositoryMock();
    const inviteEmailService = createInviteEmailServiceMock();
    vi.mocked(repository.findById).mockResolvedValue({
      id: 'admin',
      email: 'admin@example.com',
      name: 'Admin',
      firstName: 'Admin',
      lastName: null,
      isApproved: true,
      isAdmin: true,
      createdAt: new Date(),
    });
    vi.mocked(repository.createOrApproveByEmail).mockResolvedValue({
      user: {
        id: 'new-user',
        email: 'new.user@example.com',
        name: 'New User',
        firstName: 'New',
        lastName: 'User',
        isApproved: true,
        isAdmin: false,
        createdAt: new Date(),
      },
      approvalTransition: 'approved_now',
    });
    vi.mocked(inviteEmailService.sendUserAddedInvite).mockResolvedValue({
      ok: false,
      error: 'provider unavailable',
    });

    const result = await preProvisionUserAccess(repository, inviteEmailService, {
      actorUserId: 'admin',
      email: 'new.user@example.com',
      name: 'New User',
      loginUrl: 'http://localhost:3000/login',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.user.email).toBe('new.user@example.com');
    expect(result.value.inviteDelivery).toEqual({
      status: 'failed',
      error: 'provider unavailable',
    });
  });
});
