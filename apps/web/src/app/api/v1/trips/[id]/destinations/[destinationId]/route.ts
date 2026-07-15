import { updateDestinationRequestSchema } from '@travel-planner/shared';
import { editDestination } from '@/application/use-cases/edit-destination';
import { toWireDestination } from '@/application/use-cases/get-trip-detail-for-user';
import { removeDestination } from '@/application/use-cases/remove-destination';
import { getAppContainer } from '@/infrastructure/container';
import { requireAuth } from '../../../../_lib/auth';
import { respondWithError } from '../../../../_lib/errors';
import {
  readIdempotencyKey,
  restoreResponse,
  safeJson,
  storeResponse,
} from '../../../../_lib/idempotency';
import { respondWithData } from '../../../../_lib/respond';
import { findAccessibleTrip, fromIsoDate } from '../../../../_lib/trip-command';

type Context = { params: Promise<{ id: string; destinationId: string }> };

async function execute(
  request: Request,
  context: Context,
  kind: 'update' | 'delete',
): Promise<Response> {
  try {
    const { id, destinationId } = await context.params;
    const session = await requireAuth(request);
    if (!session.ok) return session.response;
    const key = readIdempotencyKey(request);
    if (!key)
      return respondWithError(request, 'bad_request', {
        detail: 'A valid Idempotency-Key header is required.',
        pathParams: { id, destinationId },
      });
    const parsed =
      kind === 'update' ? updateDestinationRequestSchema.safeParse(await safeJson(request)) : null;
    if (parsed && !parsed.success)
      return respondWithError(request, 'validation_failed', {
        detail: 'Invalid request body.',
        pathParams: { id, destinationId },
      });
    const container = getAppContainer();
    const body = parsed?.success ? parsed.data : {};
    const result = await container.idempotentCommandExecutor.execute(
      {
        userId: session.userId,
        operation: `destination.${kind}`,
        idempotencyKey: key,
        requestHash: container.hashFn(JSON.stringify({ id, destinationId, ...body })),
      },
      async (repos) => {
        const trip = await findAccessibleTrip(
          repos.tripRepository,
          repos.organizationRepository,
          session.userId,
          id,
        );
        const existing = await repos.destinationRepository.findById(destinationId);
        if (!trip || !existing || existing.tripId !== id)
          return storeResponse(
            respondWithError(request, 'not_found', {
              detail: 'Destination not found.',
              pathParams: { id, destinationId },
            }),
          );
        if (kind === 'delete') {
          const removed = await removeDestination(repos.destinationRepository, destinationId);
          if (!removed.ok)
            return storeResponse(
              respondWithError(request, 'not_found', {
                detail: 'Destination not found.',
                pathParams: { id, destinationId },
              }),
            );
          return { status: 204, body: null };
        }
        if (!parsed?.success) throw new Error('Parsed destination body missing');
        if (!(await repos.countryReferenceRepository.findByCountry(parsed.data.country)))
          return storeResponse(
            respondWithError(request, 'validation_failed', {
              detail: 'Please select a valid country.',
              pathParams: { id, destinationId },
            }),
          );
        const updated = await editDestination(
          repos.tripRepository,
          repos.destinationRepository,
          repos.tripFixedCostRepository,
          {
            destinationId,
            tripId: id,
            name: parsed.data.name || parsed.data.city || parsed.data.country,
            country: parsed.data.country,
            city: parsed.data.city,
            latitude: parsed.data.latitude,
            longitude: parsed.data.longitude,
            estimatedBudgetPence: parsed.data.estimatedBudgetPence,
            currency: 'GBP',
            comfortLevel: parsed.data.comfortLevel,
            startDate: parsed.data.startDate ? fromIsoDate(parsed.data.startDate) : null,
            endDate: parsed.data.endDate ? fromIsoDate(parsed.data.endDate) : null,
          },
        );
        if (!updated.ok)
          return storeResponse(
            respondWithError(request, 'validation_failed', {
              detail: updated.error,
              pathParams: { id, destinationId },
            }),
          );
        return storeResponse(
          respondWithData(request, toWireDestination(updated.value), {
            pathParams: { id, destinationId },
          }),
        );
      },
    );
    if (result.kind === 'conflict')
      return respondWithError(request, 'conflict', {
        detail: 'The idempotency key was already used with a different request.',
        pathParams: { id, destinationId },
      });
    return restoreResponse(result.response);
  } catch (error) {
    console.error('[api/v1/trips/{id}/destinations/{destinationId}] unexpected error', error);
    return respondWithError(request, 'internal', { detail: 'An unexpected error occurred.' });
  }
}

export const PATCH = (request: Request, context: Context) => execute(request, context, 'update');
export const DELETE = (request: Request, context: Context) => execute(request, context, 'delete');
