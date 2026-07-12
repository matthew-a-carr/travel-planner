import { createSpendRequestSchema } from '@travel-planner/shared';
import {
  getTripFinancialsForUser,
  toWireSpendEntry,
} from '@/application/use-cases/get-trip-financials-for-user';
import { recordSpend } from '@/application/use-cases/record-spend';
import { getAppContainer } from '@/infrastructure/container';
import { requireAuth } from '../../../_lib/auth';
import { respondWithError } from '../../../_lib/errors';
import {
  readIdempotencyKey,
  restoreResponse,
  safeJson,
  storeResponse,
} from '../../../_lib/idempotency';
import { respondWithData } from '../../../_lib/respond';
import { findAccessibleTrip, fromIsoDate } from '../../../_lib/trip-command';

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  try {
    const { id } = await context.params;
    const session = await requireAuth(request);
    if (!session.ok) return session.response;
    const container = getAppContainer();
    const financials = await getTripFinancialsForUser(
      container.organizationRepository,
      container.tripRepository,
      container.destinationRepository,
      container.spendEntryRepository,
      session.userId,
      id,
      new Date(),
    );
    if (!financials)
      return respondWithError(request, 'not_found', {
        detail: 'Trip not found.',
        pathParams: { id },
      });
    return respondWithData(request, financials, { pathParams: { id } });
  } catch (error) {
    console.error('[api/v1/trips/{id}/spend] unexpected read error', error);
    return respondWithError(request, 'internal', { detail: 'An unexpected error occurred.' });
  }
}

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const { id } = await context.params;
    const session = await requireAuth(request);
    if (!session.ok) return session.response;
    const key = readIdempotencyKey(request);
    if (!key)
      return respondWithError(request, 'bad_request', {
        detail: 'A valid Idempotency-Key header is required.',
        pathParams: { id },
      });
    const parsed = createSpendRequestSchema.safeParse(await safeJson(request));
    if (!parsed.success)
      return respondWithError(request, 'validation_failed', {
        detail: 'Invalid request body.',
        pathParams: { id },
      });
    const container = getAppContainer();
    const result = await container.idempotentCommandExecutor.execute(
      {
        userId: session.userId,
        operation: 'spend.create',
        idempotencyKey: key,
        requestHash: container.hashFn(JSON.stringify({ id, ...parsed.data })),
      },
      async (repos) => {
        const [trip, destination] = await Promise.all([
          findAccessibleTrip(
            repos.tripRepository,
            repos.organizationRepository,
            session.userId,
            id,
          ),
          repos.destinationRepository.findById(parsed.data.destinationId),
        ]);
        if (!trip || !destination || destination.tripId !== id)
          return storeResponse(
            respondWithError(request, 'not_found', {
              detail: 'Destination not found.',
              pathParams: { id },
            }),
          );
        const created = await recordSpend(repos.destinationRepository, repos.spendEntryRepository, {
          destinationId: parsed.data.destinationId,
          amountPence: parsed.data.amountPence,
          currency: 'GBP',
          category: parsed.data.category,
          description: parsed.data.description,
          spentAt: fromIsoDate(parsed.data.spentAt),
        });
        if (!created.ok)
          return storeResponse(
            respondWithError(request, 'validation_failed', {
              detail: created.error,
              pathParams: { id },
            }),
          );
        return storeResponse(
          respondWithData(request, toWireSpendEntry(created.value), {
            status: 201,
            pathParams: { id },
          }),
        );
      },
    );
    if (result.kind === 'conflict')
      return respondWithError(request, 'conflict', {
        detail: 'The idempotency key was already used with a different request.',
        pathParams: { id },
      });
    return restoreResponse(result.response);
  } catch (error) {
    console.error('[api/v1/trips/{id}/spend] unexpected create error', error);
    return respondWithError(request, 'internal', { detail: 'An unexpected error occurred.' });
  }
}
