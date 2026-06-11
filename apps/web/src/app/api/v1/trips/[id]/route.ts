import { getTripDetailForUser } from '@/application/use-cases/get-trip-detail-for-user';
import { getAppContainer } from '@/infrastructure/container';
import { requireAuth } from '../../_lib/auth';
import { respondWithError } from '../../_lib/errors';
import { respondWithData } from '../../_lib/respond';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { id } = await context.params;

    const session = await requireAuth(request);
    if (!session.ok) return session.response;

    const container = getAppContainer();
    const detail = await getTripDetailForUser(
      container.organizationRepository,
      container.tripRepository,
      container.destinationRepository,
      container.tripFixedCostRepository,
      container.spendEntryRepository,
      session.userId,
      id,
    );

    if (!detail) {
      // Missing trip and non-member collapse to one answer — no existence leak.
      return respondWithError(request, 'not_found', {
        detail: 'Trip not found.',
        pathParams: { id },
      });
    }

    return respondWithData(request, detail, { pathParams: { id } });
  } catch (error) {
    console.error('[api/v1/trips/{id}] unexpected error', error);
    return respondWithError(request, 'internal', { detail: 'An unexpected error occurred.' });
  }
}
