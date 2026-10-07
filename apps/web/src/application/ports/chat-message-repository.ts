import type { ChatMessage, ChatMessagePart, ChatThread } from '@/domain/chat/types';

/** Persisted message parts; SDK-specific narrowing belongs in the adapter. */
export type ChatUIMessagePart = ChatMessagePart;

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
