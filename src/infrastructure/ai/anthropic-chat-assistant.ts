import { streamText } from 'ai';
import type {
  ChatAssistantService,
  StreamReplyInput,
  StreamReplyOutcome,
} from '@/application/ports/chat-assistant';

const SYSTEM_PROMPT = `You are the trip-planning assistant for a personal travel-budgeting app.
You help the traveller understand their plan and spending.

Slice 0 capability: read-only conversation. You do not yet have tools to query
trip data or make changes — answer general travel-planning questions concisely
and tell the user that data-backed insights and edits are coming in the next
slices when they ask for them.

Style: short, direct answers. No corporate filler. Pence/£ for money.`;

/**
 * Streams a free-form assistant reply via the Vercel AI Gateway.
 *
 * Slice 0: no tools, no trip context, no structured output. The reply is
 * a plain text stream. Tools and trip-context plumbing land in Slice 1.
 */
export class AnthropicChatAssistant implements ChatAssistantService {
  constructor(private readonly modelId: string) {}

  async streamReply(input: StreamReplyInput): Promise<StreamReplyOutcome> {
    try {
      const result = streamText({
        model: this.modelId,
        system: SYSTEM_PROMPT,
        messages: input.history.map((message) => ({
          role: message.role === 'system' ? 'assistant' : message.role,
          content: message.content,
        })),
      });

      return {
        ok: true,
        textStream: result.textStream,
      };
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : String(cause);
      return { ok: false, error };
    }
  }
}
