/**
 * Chat domain types — used by the per-trip conversational assistant
 * (`src/app/api/trips/[id]/chat/route.ts`).
 *
 * Persistence holds structured message parts (text, tool invocations,
 * etc.) so that hydrated conversations replay tool calls correctly when
 * sent back to the model. The `ChatMessagePart` shape mirrors the AI
 * SDK's `UIMessagePart` but is restated here so the domain layer stays
 * dependency-free per `src/domain/CLAUDE.md`.
 */

export type ChatRole = 'user' | 'assistant' | 'system';

export type ChatThread = {
  readonly id: string;
  readonly tripId: string;
  readonly userId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

/**
 * One part of a chat message. The `type` discriminator and additional
 * fields match the AI SDK 6 UIMessagePart contract — for example
 * `{ type: 'text', text: 'Hello' }` or
 * `{ type: 'tool-record_spend', state: 'output-available', input: ..., output: ... }`.
 *
 * Repositories serialise/deserialise this transparently through the
 * `chat_messages.parts` jsonb column. Application/infrastructure layers
 * may narrow this to `UIMessagePart` from the `ai` package.
 */
export type ChatMessagePart = {
  readonly type: string;
  readonly [key: string]: unknown;
};

export type ChatMessage = {
  readonly id: string;
  readonly threadId: string;
  readonly role: ChatRole;
  readonly parts: readonly ChatMessagePart[];
  readonly createdAt: Date;
};
