import { canManageOrganizationMembers } from '@/domain/organization/organization';
import type { OrganizationRepository } from '@/domain/organization/organization-repository';
import type { OrganizationMember, OrganizationRole } from '@/domain/organization/types';
import type { Result } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';

export type OrganizationMembersView = {
  readonly members: OrganizationMember[];
  readonly actorRole: OrganizationRole;
  readonly canManageMembers: boolean;
};

export async function getOrganizationMembers(
  repository: OrganizationRepository,
  organizationId: string,
  actorUserId: string,
): Promise<Result<OrganizationMembersView>> {
  const membership = await repository.findMembership(organizationId, actorUserId);
  if (!membership) return err('Organization not found');

  const members = await repository.listMembers(organizationId);
  return ok({
    members,
    actorRole: membership.role,
    canManageMembers: canManageOrganizationMembers(membership.role),
  });
}
