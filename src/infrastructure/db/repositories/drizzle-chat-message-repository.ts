import { asc, eq, sql } from 'drizzle-orm';
import type {
  AppendMessageInput,
  ChatMessageRepository,
} from '@/application/ports/chat-message-repository';
import type { ChatMessage, ChatRole, ChatThread } from '@/domain/chat/types';
import type { Db } from '../client';
import { chatMessages, chatThreads } from '../schema';

function toThread(row: typeof chatThreads.$inferSelect): ChatThread {
  return {
    id: row.id,
    tripId: row.tripId,
    userId: row.userId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toMessage(row: typeof chatMessages.$inferSelect): ChatMessage {
  return {
    id: row.id,
    threadId: row.threadId,
    role: row.role as ChatRole,
    content: row.content,
    createdAt: row.createdAt,
  };
}

export class DrizzleChatMessageRepository implements ChatMessageRepository {
  constructor(private readonly db: Db) {}

  async findOrCreateThread(tripId: string, userId: string): Promise<ChatThread> {
    const upserted = await this.db
      .insert(chatThreads)
      .values({ tripId, userId })
      .onConflictDoUpdate({
        target: [chatThreads.tripId, chatThreads.userId],
        set: { tripId: sql`excluded.trip_id` },
      })
      .returning();
    const row = upserted[0];
    if (!row) throw new Error('Failed to create chat thread');
    return toThread(row);
  }

  async listMessages(threadId: string): Promise<ChatMessage[]> {
    const rows = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.threadId, threadId))
      .orderBy(asc(chatMessages.createdAt), asc(chatMessages.id));
    return rows.map(toMessage);
  }

  async appendMessage(input: AppendMessageInput): Promise<ChatMessage> {
    const inserted = await this.db
      .insert(chatMessages)
      .values({
        threadId: input.threadId,
        role: input.role,
        content: input.content,
      })
      .returning();
    const row = inserted[0];
    if (!row) throw new Error('Failed to append chat message');

    await this.db
      .update(chatThreads)
      .set({ updatedAt: new Date() })
      .where(eq(chatThreads.id, input.threadId));

    return toMessage(row);
  }
}
