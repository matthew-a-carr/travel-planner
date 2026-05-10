import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import type {
  ChatAssistantService,
  StreamReplyInput,
  StreamReplyOutcome,
} from '@/application/ports/chat-assistant';

const OFFLINE_MESSAGE =
  'Trip assistant is unavailable: set AI_GATEWAY_API_KEY locally, or deploy to Vercel with OIDC enabled.';

/**
 * Fallback when no AI Gateway credentials are configured. Returns a
 * one-shot UI message stream containing a single text part so the
 * drawer's `useChat` consumer renders the offline message exactly like
 * any other assistant reply — no special-cased error path on the
 * client.
 */
export class NoOpChatAssistant implements ChatAssistantService {
  async streamReply(input: StreamReplyInput): Promise<StreamReplyOutcome> {
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.write({ type: 'text-start', id: 'offline-text' });
        writer.write({ type: 'text-delta', id: 'offline-text', delta: OFFLINE_MESSAGE });
        writer.write({ type: 'text-end', id: 'offline-text' });
      },
    });

    // Persist the offline text as the assistant turn so hydration is
    // consistent with the live path.
    await input.onFinish([{ type: 'text', text: OFFLINE_MESSAGE }]);

    const response = createUIMessageStreamResponse({ stream });
    return { ok: true, response };
  }
}
