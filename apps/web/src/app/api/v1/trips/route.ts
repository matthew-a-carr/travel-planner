import { listTripsForUser } from '@/application/use-cases/list-trips-for-user';
import { getAppContainer } from '@/infrastructure/container';
import { requireAuth } from '../_lib/auth';
import { respondWithError } from '../_lib/errors';
import { respondWithData } from '../_lib/respond';

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireAuth(request);
    if (!session.ok) return session.response;

    const container = getAppContainer();
    const summaries = await listTripsForUser(
      container.organizationRepository,
      container.tripRepository,
      container.destinationRepository,
      session.userId,
    );

    return respondWithData(request, summaries);
  } catch (error) {
    console.error('[api/v1/trips] unexpected error', error);
    return respondWithError(request, 'internal', { detail: 'An unexpected error occurred.' });
  }
}
