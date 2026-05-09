import { stepCountIs, streamText } from 'ai';
import type {
  ChatAssistantService,
  StreamReplyInput,
  StreamReplyOutcome,
} from '@/application/ports/chat-assistant';
import { type ChatToolDeps, createChatTools } from './chat-tools';

const MAX_STEPS = 5;

const SYSTEM_PROMPT = `You are the trip-planning assistant for a personal travel-budgeting app.
You help the traveller understand their plan and spending.

Capabilities (Slice 1):
- Read-only conversation backed by tools that look up trip data.
- When the user asks anything that depends on the actual plan or spending,
  call the appropriate tool first, then answer from the tool result. Do not
  invent numbers.
- Available tools:
    * get_trip_summary — name, dates, budget headlines, destination count.
    * list_destinations — full destination list with dates and budgets.
    * get_burndown — daily pace vs target, projection, active alerts.
    * get_spending_by_category — totals per category across the whole trip.
- Mutations (recording spend, editing destinations, etc.) are not available
  yet — they arrive in the next slice. If the user asks to change something,
  acknowledge and tell them edits arrive shortly.

Style: short, direct answers. No corporate filler. Pence/£ for money — convert
pence to £ in your replies (e.g. 500000 pence → "£5,000"). Two decimal places
only when sub-pound precision matters.`;

/**
 * Streams a free-form assistant reply via the Vercel AI Gateway.
 *
 * Slice 1 adds read-only tools bound to the trip the conversation is scoped
 * to. The model decides whether to call a tool or answer directly. Tool
 * results are folded back into the same `streamText` loop and the surfaced
 * `textStream` only emits the model's natural-language deltas — the drawer
 * stays a plain text consumer.
 */
export class AnthropicChatAssistant implements ChatAssistantService {
  constructor(
    private readonly modelId: string,
    private readonly deps: ChatToolDeps,
  ) {}

  async streamReply(input: StreamReplyInput): Promise<StreamReplyOutcome> {
    try {
      const tools = createChatTools(this.deps, input.tripId);
      const result = streamText({
        model: this.modelId,
        system: SYSTEM_PROMPT,
        messages: input.history.map((message) => ({
          role: message.role === 'system' ? 'assistant' : message.role,
          content: message.content,
        })),
        tools,
        stopWhen: stepCountIs(MAX_STEPS),
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
