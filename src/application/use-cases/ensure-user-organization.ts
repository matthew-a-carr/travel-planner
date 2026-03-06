import { derivePersonalOrganizationName } from '@/domain/organization/organization';
import type { OrganizationRepository } from '@/domain/organization/organization-repository';
import type { OrganizationWithRole } from '@/domain/organization/types';

export type EnsureUserOrganizationInput = {
  readonly userId: string;
  readonly userName: string | null;
  readonly email: string | null;
};

export async function ensureUserOrganization(
  repository: OrganizationRepository,
  input: EnsureUserOrganizationInput,
): Promise<OrganizationWithRole> {
  const existingOrganizations = await repository.findOrganizationsForUser(input.userId);
  const firstOrganization = existingOrganizations[0];
  if (firstOrganization) return firstOrganization;

  const now = new Date();
  const organization = await repository.createOrganizationWithOwner({
    organizationId: crypto.randomUUID(),
    name: derivePersonalOrganizationName({
      userName: input.userName,
      email: input.email,
    }),
    ownerUserId: input.userId,
    createdAt: now,
    updatedAt: now,
  });

  return {
    organization,
    role: 'owner',
  };
}
