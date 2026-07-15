import type { StoredHttpResponse } from '@/application/ports/idempotent-command-executor';

const MAX_IDEMPOTENCY_KEY_LENGTH = 255;

export function readIdempotencyKey(request: Request): string | null {
  const value = request.headers.get('idempotency-key')?.trim();
  if (!value || value.length > MAX_IDEMPOTENCY_KEY_LENGTH) return null;
  return value;
}

export async function safeJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function storeResponse(response: Response): Promise<StoredHttpResponse> {
  return {
    status: response.status,
    body: response.status === 204 ? null : await response.json(),
  };
}

export function restoreResponse(stored: StoredHttpResponse): Response {
  if (stored.status === 204) {
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  }
  return Response.json(stored.body, {
    status: stored.status,
    headers: { 'Cache-Control': 'no-store' },
  });
}
