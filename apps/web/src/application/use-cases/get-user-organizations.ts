import type { OrganizationRepository } from '@/domain/organization/organization-repository';
import type { OrganizationWithRole } from '@/domain/organization/types';

export async function getUserOrganizations(
  repository: OrganizationRepository,
  userId: string,
): Promise<OrganizationWithRole[]> {
  return repository.findOrganizationsForUser(userId);
}
