import { stepCountIs, streamText } from 'ai';
import type {
  ChatAssistantService,
  StreamReplyInput,
  StreamReplyOutcome,
} from '@/application/ports/chat-assistant';
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
  returns { requiresConfirmation: true, summary }. Relay the summary
  verbatim and ask the user to confirm. Only re-call the tool with
  'confirmed: true' if the user explicitly says yes (e.g. "yes",
  "confirm", "do it", "go ahead"). If the user wavers or says no,
  do not call again.
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
