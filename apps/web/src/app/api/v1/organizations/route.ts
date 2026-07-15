import type { OrganizationSummary } from '@travel-planner/shared';
import { getUserOrganizations } from '@/application/use-cases/get-user-organizations';
import { getAppContainer } from '@/infrastructure/container';
import { requireAuth } from '../_lib/auth';
import { respondWithError } from '../_lib/errors';
import { respondWithData } from '../_lib/respond';

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireAuth(request);
    if (!session.ok) return session.response;

    const organizations = await getUserOrganizations(
      getAppContainer().organizationRepository,
      session.userId,
    );
    const summaries: OrganizationSummary[] = organizations.map(({ organization, role }) => ({
      id: organization.id,
      name: organization.name,
      role,
    }));

    return respondWithData(request, summaries);
  } catch (error) {
    console.error('[api/v1/organizations] unexpected error', error);
    return respondWithError(request, 'internal', { detail: 'An unexpected error occurred.' });
  }
}
