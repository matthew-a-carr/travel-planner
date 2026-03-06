import type { OrganizationRepository } from '@/domain/organization/organization-repository';
import type { Organization } from '@/domain/organization/types';
import type { Result } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';

export type CreateOrganizationInput = {
  readonly actorUserId: string;
  readonly name: string;
};

export async function createOrganization(
  repository: OrganizationRepository,
  input: CreateOrganizationInput,
): Promise<Result<Organization>> {
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (name.length === 0) return err('Organization name is required');

  const now = new Date();
  const organization = await repository.createOrganizationWithOwner({
    organizationId: crypto.randomUUID(),
    name: name.slice(0, 80),
    ownerUserId: input.actorUserId,
    createdAt: now,
    updatedAt: now,
  });
  return ok(organization);
}
