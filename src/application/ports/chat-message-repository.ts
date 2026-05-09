import type { ChatMessage, ChatThread } from '@/domain/chat/types';

export type AppendMessageInput = {
  readonly threadId: string;
  readonly role: ChatMessage['role'];
  readonly content: string;
};

export interface ChatMessageRepository {
  /** Find the existing thread for (tripId, userId) or create one. */
  findOrCreateThread(tripId: string, userId: string): Promise<ChatThread>;
  /** Load all messages on a thread, oldest first. */
  listMessages(threadId: string): Promise<ChatMessage[]>;
  /** Append a single message and bump the thread's updatedAt. */
  appendMessage(input: AppendMessageInput): Promise<ChatMessage>;
}
