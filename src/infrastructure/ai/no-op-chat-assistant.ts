import type { ChatAssistantService, StreamReplyOutcome } from '@/application/ports/chat-assistant';

/**
 * Fallback when no AI Gateway credentials are configured. Returns a clear
 * error so the UI can show a helpful "AI offline" message rather than
 * silently failing — same pattern as `NoOpItineraryParser`.
 */
export class NoOpChatAssistant implements ChatAssistantService {
  async streamReply(): Promise<StreamReplyOutcome> {
    return {
      ok: false,
      error:
        'Trip assistant is unavailable: set AI_GATEWAY_API_KEY locally, or deploy to Vercel with OIDC enabled.',
    };
  }
}
