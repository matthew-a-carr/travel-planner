/**
 * Maps a streaming-time error from the chat assistant adapter onto a short,
 * user-friendly string. Used by:
 *   - `AnthropicChatAssistant`'s `onError` for `toUIMessageStreamResponse` so
 *     the SDK encodes a useful message into the stream.
 *   - The drawer client when `useChat`'s `status === 'error'` surfaces an
 *     `Error` with a `message` we can read.
 *
 * Categories handled in priority order:
 *   1. Vercel AI Gateway quota / restricted-models — the most likely cause
 *      on free tiers; the gateway response carries `no_providers_available`
 *      or `RestrictedModelsError`.
 *   2. Gateway auth failure (HTTP 403 with no quota signal).
 *   3. Network reachability (`fetch failed`, `ENOTFOUND`, abort).
 *   4. Timeout (`504`, `timeout`, or `AbortError` from a stream that ran long).
 *   5. Fallback: surface the raw message if it's short and non-empty;
 *      otherwise a generic "try again" line.
 */

const FALLBACK_MESSAGE = 'Something went wrong sending your message. Try again.';
const MAX_RAW_MESSAGE_LENGTH = 180;

export function formatChatStreamError(error: unknown): string {
  const text = extractText(error);
  const lower = text.toLowerCase();

  if (
    lower.includes('no_providers_available') ||
    lower.includes('restrictedmodelserror') ||
    lower.includes('free credits') ||
    lower.includes('quota')
  ) {
    return 'AI is temporarily unavailable — the gateway quota has been reached. Try again later.';
  }

  if (lower.includes('403') || lower.includes('unauthorized') || lower.includes('forbidden')) {
    return 'AI service rejected the request — please contact the site owner.';
  }

  if (
    lower.includes('fetch failed') ||
    lower.includes('enotfound') ||
    lower.includes('econnrefused') ||
    lower.includes('network')
  ) {
    return 'Could not reach the AI service. Check your connection and try again.';
  }

  if (lower.includes('timeout') || lower.includes('aborterror') || lower.includes('504')) {
    return 'The AI took too long to respond. Try again with a shorter message.';
  }

  const trimmed = text.trim();
  if (trimmed.length > 0 && trimmed.length <= MAX_RAW_MESSAGE_LENGTH) {
    return trimmed;
  }
  return FALLBACK_MESSAGE;
}

function extractText(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) {
    // Some adapters embed structured info on `cause` or stringify it
    // alongside the human message — combine both so the pattern match
    // catches whichever shape the gateway returns.
    const parts = [error.message];
    if ('cause' in error && error.cause !== undefined && error.cause !== null) {
      parts.push(String(error.cause));
    }
    return parts.join(' ');
  }
  if (error !== null && typeof error === 'object') {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error ?? '');
}
