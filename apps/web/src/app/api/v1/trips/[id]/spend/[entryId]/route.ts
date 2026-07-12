import { updateSpendRequestSchema } from '@travel-planner/shared';
import { deleteSpendEntry } from '@/application/use-cases/delete-spend-entry';
import { editSpendEntry } from '@/application/use-cases/edit-spend-entry';
import { toWireSpendEntry } from '@/application/use-cases/get-trip-financials-for-user';
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

type Context = { params: Promise<{ id: string; entryId: string }> };

async function execute(
  request: Request,
  context: Context,
  kind: 'update' | 'delete',
): Promise<Response> {
  try {
    const { id, entryId } = await context.params;
    const session = await requireAuth(request);
    if (!session.ok) return session.response;
    const key = readIdempotencyKey(request);
    if (!key)
      return respondWithError(request, 'bad_request', {
        detail: 'A valid Idempotency-Key header is required.',
        pathParams: { id, entryId },
      });
    const parsed =
      kind === 'update' ? updateSpendRequestSchema.safeParse(await safeJson(request)) : null;
    if (parsed && !parsed.success)
      return respondWithError(request, 'validation_failed', {
        detail: 'Invalid request body.',
        pathParams: { id, entryId },
      });
    const container = getAppContainer();
    const body = parsed?.success ? parsed.data : {};
    const result = await container.idempotentCommandExecutor.execute(
      {
        userId: session.userId,
        operation: `spend.${kind}`,
        idempotencyKey: key,
        requestHash: container.hashFn(JSON.stringify({ id, entryId, ...body })),
      },
      async (repos) => {
        const [trip, entry] = await Promise.all([
          findAccessibleTrip(
            repos.tripRepository,
            repos.organizationRepository,
            session.userId,
            id,
          ),
          repos.spendEntryRepository.findById(entryId),
        ]);
        const destination = entry
          ? await repos.destinationRepository.findById(entry.destinationId)
          : null;
        if (!trip || !entry || !destination || destination.tripId !== id)
          return storeResponse(
            respondWithError(request, 'not_found', {
              detail: 'Spend entry not found.',
              pathParams: { id, entryId },
            }),
          );
        if (kind === 'delete') {
          const removed = await deleteSpendEntry(repos.spendEntryRepository, entryId);
          if (!removed.ok) throw new Error('Spend entry disappeared during command');
          return { status: 204, body: null };
        }
        if (!parsed?.success) throw new Error('Parsed spend body missing');
        const updated = await editSpendEntry(repos.spendEntryRepository, {
          entryId,
          amountPence: parsed.data.amountPence,
          currency: 'GBP',
          category: parsed.data.category,
          description: parsed.data.description,
          spentAt: fromIsoDate(parsed.data.spentAt),
        });
        if (!updated.ok)
          return storeResponse(
            respondWithError(request, 'validation_failed', {
              detail: updated.error,
              pathParams: { id, entryId },
            }),
          );
        return storeResponse(
          respondWithData(request, toWireSpendEntry(updated.value), {
            pathParams: { id, entryId },
          }),
        );
      },
    );
    if (result.kind === 'conflict')
      return respondWithError(request, 'conflict', {
        detail: 'The idempotency key was already used with a different request.',
        pathParams: { id, entryId },
      });
    return restoreResponse(result.response);
  } catch (error) {
    console.error('[api/v1/trips/{id}/spend/{entryId}] unexpected error', error);
    return respondWithError(request, 'internal', { detail: 'An unexpected error occurred.' });
  }
}

export const PATCH = (request: Request, context: Context) => execute(request, context, 'update');
export const DELETE = (request: Request, context: Context) => execute(request, context, 'delete');
