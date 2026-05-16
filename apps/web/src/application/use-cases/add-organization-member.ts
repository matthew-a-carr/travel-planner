import { canManageOrganizationMembers } from '@/domain/organization/organization';
import type { OrganizationRepository } from '@/domain/organization/organization-repository';
import type { OrganizationMembership } from '@/domain/organization/types';
import type { Result } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';

export type AddOrganizationMemberInput = {
  readonly actorUserId: string;
  readonly organizationId: string;
  readonly targetUserId: string;
};

export async function addOrganizationMember(
  repository: OrganizationRepository,
  input: AddOrganizationMemberInput,
): Promise<Result<OrganizationMembership>> {
  const actorMembership = await repository.findMembership(input.organizationId, input.actorUserId);
  if (!actorMembership) return err('Organization not found');
  if (!canManageOrganizationMembers(actorMembership.role)) return err('Forbidden');

  const normalizedTargetUserId = input.targetUserId.trim();
  if (normalizedTargetUserId.length === 0) return err('User is required');

  const targetUserExists = await repository.findUserById(normalizedTargetUserId);
  if (!targetUserExists) return err('User has not signed in yet');

  const existingMembership = await repository.findMembership(
    input.organizationId,
    normalizedTargetUserId,
  );
  if (existingMembership) return err('User is already a member');

  const membership = await repository.addMember({
    organizationId: input.organizationId,
    userId: normalizedTargetUserId,
    role: 'member',
    createdAt: new Date(),
  });

  return ok(membership);
}
