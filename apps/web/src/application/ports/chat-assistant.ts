import type { ChatMessage } from '@/domain/chat/types';
import type { ChatUIMessagePart } from './chat-message-repository';

export type StreamReplyInput = {
  /** Trip the conversation is scoped to. Tool implementations bind to this id
   *  so the model cannot read or mutate any other trip's data. */
  readonly tripId: string;
  /** Conversation history, oldest first. The most recent message is the
   *  user message that just landed and triggered this turn. */
  readonly history: readonly ChatMessage[];
  /** Called once with the assistant turn's structured parts after the
   *  stream finishes (or after a partial response if the stream errors).
   *  Use this to persist the assistant message via the chat message
   *  repository. */
  readonly onFinish: (parts: readonly ChatUIMessagePart[]) => Promise<void>;
};

/**
 * One assistant turn. Adapters wrap the AI SDK's `streamText().toUIMessageStreamResponse()`
 * and surface its `Response` directly so the route handler can stream it
 * to the client without any further transformation. Errors surface as
 * `{ ok: false, error }` so the no-op fallback can degrade gracefully.
 */
export type StreamReplyOutcome =
  | { readonly ok: true; readonly response: Response }
  | { readonly ok: false; readonly error: string };

export interface ChatAssistantService {
  streamReply(input: StreamReplyInput): Promise<StreamReplyOutcome>;
}
