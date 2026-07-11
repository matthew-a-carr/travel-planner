import { updateTripRequestSchema } from '@travel-planner/shared';
import { deleteTrip } from '@/application/use-cases/delete-trip';
import { editTrip } from '@/application/use-cases/edit-trip';
import { getTripDetailForUser } from '@/application/use-cases/get-trip-detail-for-user';
import { toTripSummary } from '@/application/use-cases/list-trips-for-user';
import { getAppContainer } from '@/infrastructure/container';
import { requireAuth } from '../../_lib/auth';
import { respondWithError } from '../../_lib/errors';
import {
  readIdempotencyKey,
  restoreResponse,
  safeJson,
  storeResponse,
} from '../../_lib/idempotency';
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

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { id } = await context.params;
    const session = await requireAuth(request);
    if (!session.ok) return session.response;

    const idempotencyKey = readIdempotencyKey(request);
    if (!idempotencyKey) {
      return respondWithError(request, 'bad_request', {
        detail: 'A valid Idempotency-Key header is required.',
        pathParams: { id },
      });
    }

    const parsed = updateTripRequestSchema.safeParse(await safeJson(request));
    if (!parsed.success) {
      return respondWithError(request, 'validation_failed', {
        detail: 'Invalid request body.',
        pathParams: { id },
        details: {
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path,
            message: issue.message,
          })),
        },
      });
    }

    const container = getAppContainer();
    const result = await container.idempotentCommandExecutor.execute(
      {
        userId: session.userId,
        operation: 'trip.update',
        idempotencyKey,
        requestHash: container.hashFn(JSON.stringify({ id, ...parsed.data })),
      },
      async ({
        tripRepository,
        organizationRepository,
        destinationRepository,
        tripFixedCostRepository,
      }) => {
        const existing = await tripRepository.findById(id);
        if (!existing) {
          return storeResponse(
            respondWithError(request, 'not_found', {
              detail: 'Trip not found.',
              pathParams: { id },
            }),
          );
        }
        const membership = await organizationRepository.findMembership(
          existing.organizationId,
          session.userId,
        );
        if (!membership) {
          return storeResponse(
            respondWithError(request, 'not_found', {
              detail: 'Trip not found.',
              pathParams: { id },
            }),
          );
        }

        const updated = await editTrip(
          tripRepository,
          destinationRepository,
          tripFixedCostRepository,
          {
            tripId: id,
            name: parsed.data.name,
            totalBudgetPence: parsed.data.totalBudgetPence,
            currency: 'GBP',
            status: parsed.data.status,
          },
        );
        if (!updated.ok) {
          return storeResponse(
            respondWithError(request, 'validation_failed', {
              detail: updated.error,
              pathParams: { id },
            }),
          );
        }

        const destinations = await destinationRepository.findByTrip(id);
        return storeResponse(
          respondWithData(request, toTripSummary(updated.value, destinations), {
            pathParams: { id },
          }),
        );
      },
    );

    if (result.kind === 'conflict') {
      return respondWithError(request, 'conflict', {
        detail: 'The idempotency key was already used with a different request.',
        pathParams: { id },
      });
    }
    return restoreResponse(result.response);
  } catch (error) {
    console.error('[api/v1/trips/{id}] unexpected update error', error);
    return respondWithError(request, 'internal', { detail: 'An unexpected error occurred.' });
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { id } = await context.params;
    const session = await requireAuth(request);
    if (!session.ok) return session.response;

    const idempotencyKey = readIdempotencyKey(request);
    if (!idempotencyKey) {
      return respondWithError(request, 'bad_request', {
        detail: 'A valid Idempotency-Key header is required.',
        pathParams: { id },
      });
    }

    const container = getAppContainer();
    const result = await container.idempotentCommandExecutor.execute(
      {
        userId: session.userId,
        operation: 'trip.delete',
        idempotencyKey,
        requestHash: container.hashFn(JSON.stringify({ id })),
      },
      async ({ tripRepository, organizationRepository }) => {
        const deleted = await deleteTrip(tripRepository, organizationRepository, {
          actorUserId: session.userId,
          tripId: id,
        });
        if (!deleted.ok) {
          const code = deleted.error === 'Forbidden' ? 'forbidden' : 'not_found';
          return storeResponse(
            respondWithError(request, code, {
              detail:
                code === 'forbidden'
                  ? 'Only organization owners can delete trips.'
                  : 'Trip not found.',
              pathParams: { id },
            }),
          );
        }
        return { status: 204, body: null };
      },
    );

    if (result.kind === 'conflict') {
      return respondWithError(request, 'conflict', {
        detail: 'The idempotency key was already used with a different request.',
        pathParams: { id },
      });
    }
    return restoreResponse(result.response);
  } catch (error) {
    console.error('[api/v1/trips/{id}] unexpected delete error', error);
    return respondWithError(request, 'internal', { detail: 'An unexpected error occurred.' });
  }
}
