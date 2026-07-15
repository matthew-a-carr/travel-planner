import { createFixedCostRequestSchema } from '@travel-planner/shared';
import { addFixedCost } from '@/application/use-cases/add-fixed-cost';
import { toWireFixedCost } from '@/application/use-cases/get-trip-detail-for-user';
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
    const parsed = createFixedCostRequestSchema.safeParse(await safeJson(request));
    if (!parsed.success)
      return respondWithError(request, 'validation_failed', {
        detail: 'Invalid request body.',
        pathParams: { id },
      });
    const container = getAppContainer();
    const result = await container.idempotentCommandExecutor.execute(
      {
        userId: session.userId,
        operation: 'fixed-cost.create',
        idempotencyKey: key,
        requestHash: container.hashFn(JSON.stringify({ id, ...parsed.data })),
      },
      async (repos) => {
        if (
          !(await findAccessibleTrip(
            repos.tripRepository,
            repos.organizationRepository,
            session.userId,
            id,
          ))
        )
          return storeResponse(
            respondWithError(request, 'not_found', {
              detail: 'Trip not found.',
              pathParams: { id },
            }),
          );
        const created = await addFixedCost(repos.tripRepository, repos.tripFixedCostRepository, {
          tripId: id,
          label: parsed.data.label,
          amountPence: parsed.data.amountPence,
          currency: 'GBP',
          category: parsed.data.category,
          date: fromIsoDate(parsed.data.date),
        });
        if (!created.ok)
          return storeResponse(
            respondWithError(request, 'validation_failed', {
              detail: created.error,
              pathParams: { id },
            }),
          );
        return storeResponse(
          respondWithData(request, toWireFixedCost(created.value), {
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
    console.error('[api/v1/trips/{id}/fixed-costs] unexpected error', error);
    return respondWithError(request, 'internal', { detail: 'An unexpected error occurred.' });
  }
}
