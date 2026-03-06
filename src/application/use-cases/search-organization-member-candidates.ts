import { canManageOrganizationMembers } from '@/domain/organization/organization';
import type { OrganizationRepository } from '@/domain/organization/organization-repository';
import type { OrganizationMemberCandidate } from '@/domain/organization/types';
import type { Result } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 20;

export type SearchOrganizationMemberCandidatesInput = {
  readonly actorUserId: string;
  readonly organizationId: string;
  readonly query: string;
  readonly limit?: number;
};

function normalizeLimit(limit: number | undefined): number {
  if (!limit || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  if (limit < 1) return 1;
  return Math.min(Math.trunc(limit), MAX_LIMIT);
}

export async function searchOrganizationMemberCandidates(
  repository: OrganizationRepository,
  input: SearchOrganizationMemberCandidatesInput,
): Promise<Result<readonly OrganizationMemberCandidate[]>> {
  const actorMembership = await repository.findMembership(input.organizationId, input.actorUserId);
  if (!actorMembership) return err('Organization not found');
  if (!canManageOrganizationMembers(actorMembership.role)) return err('Forbidden');

  const candidates = await repository.searchMemberCandidates({
    organizationId: input.organizationId,
    query: input.query.trim(),
    limit: normalizeLimit(input.limit),
  });

  return ok(candidates);
}
