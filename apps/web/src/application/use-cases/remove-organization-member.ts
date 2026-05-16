import { canManageOrganizationMembers } from '@/domain/organization/organization';
import type { OrganizationRepository } from '@/domain/organization/organization-repository';
import type { Result } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';

export type RemoveOrganizationMemberInput = {
  readonly actorUserId: string;
  readonly organizationId: string;
  readonly memberUserId: string;
};

export async function removeOrganizationMember(
  repository: OrganizationRepository,
  input: RemoveOrganizationMemberInput,
): Promise<Result<void>> {
  const actorMembership = await repository.findMembership(input.organizationId, input.actorUserId);
  if (!actorMembership) return err('Organization not found');
  if (!canManageOrganizationMembers(actorMembership.role)) return err('Forbidden');

  const memberMembership = await repository.findMembership(
    input.organizationId,
    input.memberUserId,
  );
  if (!memberMembership) return err('Member not found');
  if (memberMembership.role === 'owner') return err('Cannot remove organization owner');

  await repository.removeMember(input.organizationId, input.memberUserId);
  return ok(undefined);
}
