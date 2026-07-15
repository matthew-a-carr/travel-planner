import { createTripRequestSchema } from '@travel-planner/shared';
import { createTrip } from '@/application/use-cases/create-trip';
import { listTripsForUser, toTripSummary } from '@/application/use-cases/list-trips-for-user';
import { getAppContainer } from '@/infrastructure/container';
import { requireAuth } from '../_lib/auth';
import { respondWithError } from '../_lib/errors';
import { readIdempotencyKey, restoreResponse, safeJson, storeResponse } from '../_lib/idempotency';
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

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await requireAuth(request);
    if (!session.ok) return session.response;

    const idempotencyKey = readIdempotencyKey(request);
    if (!idempotencyKey) {
      return respondWithError(request, 'bad_request', {
        detail: 'A valid Idempotency-Key header is required.',
      });
    }

    const parsed = createTripRequestSchema.safeParse(await safeJson(request));
    if (!parsed.success) {
      return respondWithError(request, 'validation_failed', {
        detail: 'Invalid request body.',
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
        operation: 'trip.create',
        idempotencyKey,
        requestHash: container.hashFn(JSON.stringify(parsed.data)),
      },
      async ({ tripRepository, organizationRepository }) => {
        const membership = await organizationRepository.findMembership(
          parsed.data.organizationId,
          session.userId,
        );
        if (!membership) {
          return storeResponse(
            respondWithError(request, 'forbidden', {
              detail: 'You are not a member of this organization.',
            }),
          );
        }

        const created = await createTrip(tripRepository, {
          organizationId: parsed.data.organizationId,
          ownerId: session.userId,
          name: parsed.data.name,
          totalBudgetPence: parsed.data.totalBudgetPence,
          currency: 'GBP',
        });
        if (!created.ok) {
          return storeResponse(
            respondWithError(request, 'validation_failed', { detail: created.error }),
          );
        }

        return storeResponse(
          respondWithData(request, toTripSummary(created.value, []), { status: 201 }),
        );
      },
    );

    if (result.kind === 'conflict') {
      return respondWithError(request, 'conflict', {
        detail: 'The idempotency key was already used with a different request.',
      });
    }
    return restoreResponse(result.response);
  } catch (error) {
    console.error('[api/v1/trips] unexpected create error', error);
    return respondWithError(request, 'internal', { detail: 'An unexpected error occurred.' });
  }
}
