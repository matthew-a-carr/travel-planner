import { requireAuth } from '../_lib/auth';
import { respondWithError } from '../_lib/errors';
import { respondWithData } from '../_lib/respond';

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireAuth(request);
    if (!session.ok) return session.response;

    return respondWithData(request, {
      id: session.userId,
      email: session.email,
      name: session.name,
      isApproved: session.isApproved,
    });
  } catch (error) {
    console.error('[api/v1/me] unexpected error', error);
    return respondWithError(request, 'internal', { detail: 'An unexpected error occurred.' });
  }
}
