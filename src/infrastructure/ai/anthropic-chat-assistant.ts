import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from 'ai';
import type {
  ChatAssistantService,
  StreamReplyInput,
  StreamReplyOutcome,
} from '@/application/ports/chat-assistant';
import type { ChatUIMessagePart } from '@/application/ports/chat-message-repository';
import { formatChatStreamError } from '@/domain/chat/format-chat-stream-error';
import { type ChatToolDeps, createChatTools } from './chat-tools';

const MAX_STEPS = 8;

const SYSTEM_PROMPT = `You are the trip-planning assistant for a personal travel-budgeting app.
You help the traveller understand their plan and spending, and you can make
edits on their behalf.

Read-only tools — call these instead of guessing numbers:
- get_trip_summary — name, dates, budget headlines, destination count.
- list_destinations — full destination list with dates and budgets.
- get_burndown — daily pace vs target, projection, active alerts.
- get_spending_by_category — totals per category across the whole trip.

Write tools — bound to this trip; you cannot touch any other trip:
- record_spend — log a spend entry on a destination.
- edit_destination — partial update on a destination (name, country, city,
  budget, comfort, dates). Only fields you set are changed.
- add_fixed_cost — add a named fixed cost (flights, insurance, visas, etc.).
- edit_trip_budget — change the trip's total budget, name, or status.
- delete_spend_entry — remove a spend entry; the prior values are returned
  so the user can ask to put it back.

How write tools work:
- All amounts are pence (integer). All money is GBP. Dates are YYYY-MM-DD.
- Risky changes (large overspend, schedule date changes, budget edits that
  would breach available headroom, total-budget changes) require user
  confirmation. When you call such a tool without 'confirmed: true', it
  returns { requiresConfirmation: true, summary }. **Do not paraphrase**:
  the UI already renders Confirm and Cancel buttons inline next to the
  tool call from your structured output. After the user clicks, they
  reply with the literal message "Confirmed." or "Cancelled.". On
  "Confirmed.", re-call the same tool with the same arguments plus
  'confirmed: true'. On "Cancelled.", do nothing — acknowledge briefly.
- If the user sends a message starting "Restore the deleted spend:"
  followed by structured args (destinationId, amountPence, category,
  spentAt, optional description), call 'record_spend' with those args
  plus 'confirmed: true' to put the entry back.
- Low-risk tools (a small spend within pace, a label-only edit) execute
  immediately and return { ok: true, summary }. State the summary in
  your reply.
- If a tool returns { error }, surface the message — do not retry blindly.
- Before calling record_spend or edit_destination, look up the destination
  id with list_destinations if you don't already know it. Never invent
  ids.
- Resolve relative dates ("today", "tomorrow", "next Monday") yourself
  using the user's local date and pass YYYY-MM-DD to the tools.

Style: short, direct answers. No corporate filler. Pence/£ for money —
convert pence to £ in your replies (e.g. 500000 pence → "£5,000"). Two
decimal places only when sub-pound precision matters.`;

/**
 * Streams a UI message response via the Vercel AI Gateway. The route
 * handler returns the resulting `Response` directly, so the AI SDK 6
 * UI message protocol surfaces text, tool calls, and tool results to
 * `useChat` in the drawer without further transformation.
 *
 * Persistence happens in `onFinish`: once the stream completes (or
 * fails after partial output), the assistant's structured parts are
 * handed back to the use case via `input.onFinish` for storage in
 * `chat_messages.parts`.
 */
export class AnthropicChatAssistant implements ChatAssistantService {
  constructor(
    private readonly modelId: string,
    private readonly deps: ChatToolDeps,
  ) {}

  async streamReply(input: StreamReplyInput): Promise<StreamReplyOutcome> {
    try {
      const tools = createChatTools(this.deps, input.tripId);

      // History is already in UIMessage shape (role + parts); convert to
      // ModelMessage so the LLM sees prior tool calls/results faithfully.
      const uiHistory: UIMessage[] = input.history.map((message) => ({
        id: message.id,
        role: message.role === 'system' ? 'assistant' : message.role,
        // biome-ignore lint/suspicious/noExplicitAny: parts are stored as `unknown[]` in domain to keep it dependency-free
        parts: message.parts as any,
      }));

      const modelMessages = await convertToModelMessages(uiHistory);
      const result = streamText({
        model: this.modelId,
        system: SYSTEM_PROMPT,
        messages: modelMessages,
        tools,
        stopWhen: stepCountIs(MAX_STEPS),
      });

      const response = result.toUIMessageStreamResponse({
        // The SDK default is a generic "An error occurred." — replace with
        // a categorised, user-readable line (gateway quota, auth, network,
        // timeout, fallback) so the drawer surfaces something actionable.
        onError: (error) => formatChatStreamError(error),
        onFinish: async ({ messages }) => {
          // Find the assistant turn(s) emitted in this run and forward
          // their parts to the use case for persistence. There can be
          // more than one assistant message when tool calls are
          // interleaved; flatten them into a single persisted message
          // so hydration replays the whole turn in order.
          const assistant = messages.filter((m) => m.role === 'assistant');
          if (assistant.length === 0) return;
          const merged: ChatUIMessagePart[] = assistant.flatMap((m) => m.parts);
          await input.onFinish(merged);
        },
      });

      return { ok: true, response };
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : String(cause);
      return { ok: false, error };
    }
  }
}
