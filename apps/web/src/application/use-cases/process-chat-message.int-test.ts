import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ChatAssistantService } from '@/application/ports/chat-assistant';
import type { ChatUIMessagePart } from '@/application/ports/chat-message-repository';
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

function textParts(text: string): ChatUIMessagePart[] {
  return [{ type: 'text', text }];
}

function makeAssistant(replyParts: readonly ChatUIMessagePart[]): ChatAssistantService {
  return {
    streamReply: async (input) => {
      await input.onFinish(replyParts);
      return { ok: true, response: new Response('ok', { status: 200 }) };
    },
  };
}

describe('processChatMessage (integration)', () => {
  it('persists user + assistant message parts in order on a real Postgres', async () => {
    const user = await seedUser(db);
    const trip = await seedTrip(db, user.id);

    const tripRepository = new DrizzleTripRepository(db);
    const organizationRepository = new DrizzleOrganizationRepository(db);
    const chatMessageRepository = new DrizzleChatMessageRepository(db);
    const chatAssistant = makeAssistant(textParts('Hello there!'));

    const result = await processChatMessage(
      { tripRepository, organizationRepository, chatMessageRepository, chatAssistant },
      { tripId: trip.id, userId: user.id, userParts: textParts('hi') },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const messages = await chatMessageRepository.listMessages(result.value.thread.id);
    expect(messages.map((m) => ({ role: m.role, parts: m.parts }))).toEqual([
      { role: 'user', parts: [{ type: 'text', text: 'hi' }] },
      { role: 'assistant', parts: [{ type: 'text', text: 'Hello there!' }] },
    ]);
  });

  it('persists structured tool-call parts when the assistant emits them', async () => {
    const user = await seedUser(db);
    const trip = await seedTrip(db, user.id);

    const tripRepository = new DrizzleTripRepository(db);
    const organizationRepository = new DrizzleOrganizationRepository(db);
    const chatMessageRepository = new DrizzleChatMessageRepository(db);

    const toolPart: ChatUIMessagePart = {
      type: 'tool-record_spend',
      state: 'output-available',
      toolCallId: 'call-1',
      input: { destinationId: 'dest-1', amountPence: 800, category: 'food' },
      output: { ok: true, summary: 'Recorded £8.00 of food on Hanoi.' },
    };
    const chatAssistant = makeAssistant([{ type: 'text', text: 'Done.' }, toolPart]);

    const result = await processChatMessage(
      { tripRepository, organizationRepository, chatMessageRepository, chatAssistant },
      {
        tripId: trip.id,
        userId: user.id,
        userParts: textParts('I spent £8 on lunch in Hanoi.'),
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const messages = await chatMessageRepository.listMessages(result.value.thread.id);
    expect(messages).toHaveLength(2);
    expect(messages[1]?.role).toBe('assistant');
    expect(messages[1]?.parts).toEqual([{ type: 'text', text: 'Done.' }, toolPart]);
  });

  it('forbids users without org membership', async () => {
    const owner = await seedUser(db, { email: 'owner@example.com' });
    const outsider = await seedUser(db, { email: 'outsider@example.com' });
    const trip = await seedTrip(db, owner.id);

    const tripRepository = new DrizzleTripRepository(db);
    const organizationRepository = new DrizzleOrganizationRepository(db);
    const chatMessageRepository = new DrizzleChatMessageRepository(db);
    const chatAssistant = makeAssistant(textParts('unused'));

    const result = await processChatMessage(
      { tripRepository, organizationRepository, chatMessageRepository, chatAssistant },
      { tripId: trip.id, userId: outsider.id, userParts: textParts('sneaking in') },
    );
    expect(result).toEqual({ ok: false, error: 'Forbidden' });

    const messages = await db.query.chatMessages?.findMany?.({});
    expect(messages ?? []).toHaveLength(0);
  });
});
