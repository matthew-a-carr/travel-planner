/**
 * Chat domain types — used by the per-trip conversational assistant
 * (`src/app/api/trips/[id]/chat/route.ts`).
 *
 * Slice 0 keeps the role set minimal: 'user' messages from the human and
 * 'assistant' replies from the model. Tool-call invocations and the
 * `classifyToolRisk` policy land in later slices when the first tools are
 * introduced.
 */

export type ChatRole = 'user' | 'assistant' | 'system';

export type ChatThread = {
  readonly id: string;
  readonly tripId: string;
  readonly userId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type ChatMessage = {
  readonly id: string;
  readonly threadId: string;
  readonly role: ChatRole;
  readonly content: string;
  readonly createdAt: Date;
};
