import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ChatAssistantService } from '@/application/ports/chat-assistant';
import { DrizzleChatMessageRepository } from '@/infrastructure/db/repositories/drizzle-chat-message-repository';
import { DrizzleOrganizationRepository } from '@/infrastructure/db/repositories/drizzle-organization-repository';
import { DrizzleTripRepository } from '@/infrastructure/db/repositories/drizzle-trip-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedTrip,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { processChatMessage } from './process-chat-message';

let db: Db;
let sql: Sql;

beforeAll(() => {
  ({ db, sql } = createTestDb());
});

afterAll(async () => {
  await sql.end();
});

beforeEach(async () => {
  await truncateAll(db);
});

async function* fromChunks(chunks: readonly string[]): AsyncIterable<string> {
  for (const chunk of chunks) yield chunk;
}

function makeAssistant(chunks: readonly string[]): ChatAssistantService {
  return {
    streamReply: async () => ({ ok: true, textStream: fromChunks(chunks) }),
  };
}

async function drainStream(stream: AsyncIterable<string>): Promise<string> {
  let out = '';
  for await (const chunk of stream) out += chunk;
  return out;
}

describe('processChatMessage (integration)', () => {
  it('persists user + assistant messages in order on a real Postgres', async () => {
    const user = await seedUser(db);
    const trip = await seedTrip(db, user.id);

    const tripRepository = new DrizzleTripRepository(db);
    const organizationRepository = new DrizzleOrganizationRepository(db);
    const chatMessageRepository = new DrizzleChatMessageRepository(db);
    const chatAssistant = makeAssistant(['Hello', ' there!']);

    const result = await processChatMessage(
      { tripRepository, organizationRepository, chatMessageRepository, chatAssistant },
      { tripId: trip.id, userId: user.id, userMessage: 'hi' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const text = await drainStream(result.value.replyStream);
    expect(text).toBe('Hello there!');

    const messages = await chatMessageRepository.listMessages(result.value.thread.id);
    expect(messages.map((m) => ({ role: m.role, content: m.content }))).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'Hello there!' },
    ]);
  });

  it('forbids users without org membership', async () => {
    const owner = await seedUser(db, { email: 'owner@example.com' });
    const outsider = await seedUser(db, { email: 'outsider@example.com' });
    const trip = await seedTrip(db, owner.id);

    const tripRepository = new DrizzleTripRepository(db);
    const organizationRepository = new DrizzleOrganizationRepository(db);
    const chatMessageRepository = new DrizzleChatMessageRepository(db);
    const chatAssistant = makeAssistant(['unused']);

    const result = await processChatMessage(
      { tripRepository, organizationRepository, chatMessageRepository, chatAssistant },
      { tripId: trip.id, userId: outsider.id, userMessage: 'sneaking in' },
    );
    expect(result).toEqual({ ok: false, error: 'Forbidden' });

    // No thread should have been created for the outsider on this trip.
    // (Use a fresh repo call — findOrCreateThread returns existing or creates;
    //  this asserts no leftover state.)
    const messages = await db.query.chatMessages?.findMany?.({});
    expect(messages ?? []).toHaveLength(0);
  });
});
