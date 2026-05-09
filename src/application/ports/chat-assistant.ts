import type { ChatMessage } from '@/domain/chat/types';

export type StreamReplyInput = {
  /** Trip the conversation is scoped to. Tool implementations bind to this id
   *  so the model cannot read or mutate any other trip's data. */
  readonly tripId: string;
  /** Conversation history, oldest first. The most recent message is the
   *  user message that just landed and triggered this turn. */
  readonly history: readonly ChatMessage[];
};

/**
 * Streamed-text outcome for a single assistant turn. Errors surface as
 * `{ ok: false, error }` rather than thrown — same contract as
 * `ItineraryParser` so adapters can degrade gracefully.
 */
export type StreamReplyOutcome =
  | {
      readonly ok: true;
      /** Async iterator of incremental text deltas. Consumers append each
       *  chunk to the in-progress assistant message. */
      readonly textStream: AsyncIterable<string>;
    }
  | {
      readonly ok: false;
      readonly error: string;
    };

export interface ChatAssistantService {
  streamReply(input: StreamReplyInput): Promise<StreamReplyOutcome>;
}
