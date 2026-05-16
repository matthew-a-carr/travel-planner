import type { OrganizationRepository } from '@/domain/organization/organization-repository';
import type { Organization } from '@/domain/organization/types';
import type { Result } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';
import type { UserAccessRepository } from '@/domain/user-access/user-access-repository';

export type CreateOrganizationInput = {
  readonly actorUserId: string;
  readonly name: string;
};

export async function createOrganization(
  organizationRepository: OrganizationRepository,
  userAccessRepository: UserAccessRepository,
  input: CreateOrganizationInput,
): Promise<Result<Organization>> {
  const actor = await userAccessRepository.findById(input.actorUserId);
  if (!actor?.isAdmin) return err('Forbidden');

  const name = input.name.trim().replace(/\s+/g, ' ');
  if (name.length === 0) return err('Organization name is required');

  const now = new Date();
  const organization = await organizationRepository.createOrganizationWithOwner({
    organizationId: crypto.randomUUID(),
    name: name.slice(0, 80),
    ownerUserId: input.actorUserId,
    createdAt: now,
    updatedAt: now,
  });
  return ok(organization);
}
