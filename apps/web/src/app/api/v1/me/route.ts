import { requireAuth } from '../_lib/auth';
import { respondWithError } from '../_lib/errors';

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireAuth(request);
    if (!session.ok) return session.response;

    return Response.json(
      {
        id: session.userId,
        email: session.email,
        name: session.name,
        isApproved: session.isApproved,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[api/v1/me] unexpected error', error);
    return respondWithError('internal', 'An unexpected error occurred.');
  }
}
