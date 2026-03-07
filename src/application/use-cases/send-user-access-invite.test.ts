import type { InviteEmailService } from '@/application/ports/invite-email-service';
import { describe, expect, it, vi } from 'vitest';
import type { UserAccessRepository } from '@/domain/user-access/user-access-repository';
import { sendUserAccessInvite } from './send-user-access-invite';

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

function createInviteServiceMock(): InviteEmailService {
  return {
    sendUserAddedInvite: vi.fn(),
  };
}

describe('sendUserAccessInvite', () => {
  it('forbids non-admin actors', async () => {
    const repository = createRepositoryMock();
    const inviteService = createInviteServiceMock();
    vi.mocked(repository.findById).mockResolvedValueOnce({
      id: 'member',
      email: 'member@example.com',
      name: 'Member User',
      firstName: 'Member',
      lastName: 'User',
      isApproved: true,
      isAdmin: false,
      createdAt: new Date(),
    });

    const result = await sendUserAccessInvite(repository, inviteService, {
      actorUserId: 'member',
      targetUserId: 'target',
      loginUrl: 'http://localhost:3000/login',
    });

    expect(result).toEqual({ ok: false, error: 'Forbidden' });
    expect(inviteService.sendUserAddedInvite).not.toHaveBeenCalled();
  });

  it('returns failed delivery outcome without failing the action', async () => {
    const repository = createRepositoryMock();
    const inviteService = createInviteServiceMock();
    vi.mocked(repository.findById)
      .mockResolvedValueOnce({
        id: 'admin',
        email: 'admin@example.com',
        name: 'Admin User',
        firstName: 'Admin',
        lastName: 'User',
        isApproved: true,
        isAdmin: true,
        createdAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: 'target',
        email: 'target@example.com',
        name: 'Target User',
        firstName: 'Target',
        lastName: 'User',
        isApproved: true,
        isAdmin: false,
        createdAt: new Date(),
      });
    vi.mocked(inviteService.sendUserAddedInvite).mockResolvedValue({
      ok: false,
      error: 'provider outage',
    });

    const result = await sendUserAccessInvite(repository, inviteService, {
      actorUserId: 'admin',
      targetUserId: 'target',
      loginUrl: 'http://localhost:3000/login',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.inviteDelivery).toEqual({
      status: 'failed',
      error: 'provider outage',
    });
  });
});
