import type { UIMessagePart } from 'ai';
import type { ChatMessage, ChatThread } from '@/domain/chat/types';

/** AI SDK UIMessagePart with our (currently empty) data/tool generic args. */
// biome-ignore lint/suspicious/noExplicitAny: matches the AI SDK's default UIMessagePart generic args
export type ChatUIMessagePart = UIMessagePart<any, any>;

export type AppendMessageInput = {
  readonly threadId: string;
  readonly role: ChatMessage['role'];
  readonly parts: readonly ChatUIMessagePart[];
};

export interface ChatMessageRepository {
  /** Find the existing thread for (tripId, userId) or create one. */
  findOrCreateThread(tripId: string, userId: string): Promise<ChatThread>;
  /** Load all messages on a thread, oldest first. */
  listMessages(threadId: string): Promise<ChatMessage[]>;
  /** Append a single message and bump the thread's updatedAt. */
  appendMessage(input: AppendMessageInput): Promise<ChatMessage>;
}
