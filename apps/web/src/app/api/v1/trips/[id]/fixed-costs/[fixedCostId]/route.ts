import { updateFixedCostRequestSchema } from '@travel-planner/shared';
import { editFixedCost } from '@/application/use-cases/edit-fixed-cost';
import { toWireFixedCost } from '@/application/use-cases/get-trip-detail-for-user';
import { removeFixedCost } from '@/application/use-cases/remove-fixed-cost';
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

type Context = { params: Promise<{ id: string; fixedCostId: string }> };

async function execute(
  request: Request,
  context: Context,
  kind: 'update' | 'delete',
): Promise<Response> {
  try {
    const { id, fixedCostId } = await context.params;
    const session = await requireAuth(request);
    if (!session.ok) return session.response;
    const key = readIdempotencyKey(request);
    if (!key)
      return respondWithError(request, 'bad_request', {
        detail: 'A valid Idempotency-Key header is required.',
        pathParams: { id, fixedCostId },
      });
    const parsed =
      kind === 'update' ? updateFixedCostRequestSchema.safeParse(await safeJson(request)) : null;
    if (parsed && !parsed.success)
      return respondWithError(request, 'validation_failed', {
        detail: 'Invalid request body.',
        pathParams: { id, fixedCostId },
      });
    const container = getAppContainer();
    const body = parsed?.success ? parsed.data : {};
    const result = await container.idempotentCommandExecutor.execute(
      {
        userId: session.userId,
        operation: `fixed-cost.${kind}`,
        idempotencyKey: key,
        requestHash: container.hashFn(JSON.stringify({ id, fixedCostId, ...body })),
      },
      async (repos) => {
        const trip = await findAccessibleTrip(
          repos.tripRepository,
          repos.organizationRepository,
          session.userId,
          id,
        );
        const existing = await repos.tripFixedCostRepository.findById(fixedCostId);
        if (!trip || !existing || existing.tripId !== id)
          return storeResponse(
            respondWithError(request, 'not_found', {
              detail: 'Fixed cost not found.',
              pathParams: { id, fixedCostId },
            }),
          );
        if (kind === 'delete') {
          const removed = await removeFixedCost(repos.tripFixedCostRepository, fixedCostId);
          if (!removed.ok)
            return storeResponse(
              respondWithError(request, 'not_found', {
                detail: 'Fixed cost not found.',
                pathParams: { id, fixedCostId },
              }),
            );
          return { status: 204, body: null };
        }
        if (!parsed?.success) throw new Error('Parsed fixed-cost body missing');
        const updated = await editFixedCost(repos.tripFixedCostRepository, {
          fixedCostId,
          label: parsed.data.label,
          amountPence: parsed.data.amountPence,
          currency: 'GBP',
          category: parsed.data.category,
          date: fromIsoDate(parsed.data.date),
        });
        if (!updated.ok)
          return storeResponse(
            respondWithError(request, 'validation_failed', {
              detail: updated.error,
              pathParams: { id, fixedCostId },
            }),
          );
        return storeResponse(
          respondWithData(request, toWireFixedCost(updated.value), {
            pathParams: { id, fixedCostId },
          }),
        );
      },
    );
    if (result.kind === 'conflict')
      return respondWithError(request, 'conflict', {
        detail: 'The idempotency key was already used with a different request.',
        pathParams: { id, fixedCostId },
      });
    return restoreResponse(result.response);
  } catch (error) {
    console.error('[api/v1/trips/{id}/fixed-costs/{fixedCostId}] unexpected error', error);
    return respondWithError(request, 'internal', { detail: 'An unexpected error occurred.' });
  }
}

export const PATCH = (request: Request, context: Context) => execute(request, context, 'update');
export const DELETE = (request: Request, context: Context) => execute(request, context, 'delete');
