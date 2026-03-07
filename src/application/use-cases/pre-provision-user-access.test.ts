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
  };
}

describe('preProvisionUserAccess', () => {
  it('forbids non-admin actors', async () => {
    const repository = createRepositoryMock();
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

    const result = await preProvisionUserAccess(repository, {
      actorUserId: 'actor',
      email: 'new.user@example.com',
      name: 'New User',
    });

    expect(result).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('returns validation error for invalid emails', async () => {
    const repository = createRepositoryMock();

    const result = await preProvisionUserAccess(repository, {
      actorUserId: 'actor',
      email: 'not-an-email',
      name: null,
    });

    expect(result).toEqual({ ok: false, error: 'Valid email is required' });
    expect(repository.findById).not.toHaveBeenCalled();
  });

  it('pre-provisions approved non-admin users when actor is admin', async () => {
    const repository = createRepositoryMock();
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
      id: 'new-user',
      email: 'new.user@example.com',
      name: 'New User',
      firstName: 'New',
      lastName: 'User',
      isApproved: true,
      isAdmin: false,
      createdAt: new Date(),
    });

    const result = await preProvisionUserAccess(repository, {
      actorUserId: 'admin',
      email: 'New.User@Example.com',
      name: '  New User  ',
    });

    expect(result.ok).toBe(true);
    expect(repository.createOrApproveByEmail).toHaveBeenCalledWith({
      email: 'New.User@Example.com',
      name: 'New User',
      isApproved: true,
      isAdmin: false,
    });
  });
});
