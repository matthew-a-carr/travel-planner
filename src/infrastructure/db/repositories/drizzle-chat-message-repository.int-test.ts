import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createTestDb,
  type Db,
  type Sql,
  seedTrip,
  seedUser,
  truncateAll,
} from '../../testing/helpers';
import { DrizzleChatMessageRepository } from './drizzle-chat-message-repository';

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

describe('DrizzleChatMessageRepository', () => {
  it('creates a thread on first lookup and returns it on subsequent lookups', async () => {
    const repo = new DrizzleChatMessageRepository(db);
    const user = await seedUser(db);
    const trip = await seedTrip(db, user.id);

    const first = await repo.findOrCreateThread(trip.id, user.id);
    const second = await repo.findOrCreateThread(trip.id, user.id);

    expect(first.id).toBe(second.id);
    expect(first.tripId).toBe(trip.id);
    expect(first.userId).toBe(user.id);
  });

  it('lists messages oldest-first and persists role + content', async () => {
    const repo = new DrizzleChatMessageRepository(db);
    const user = await seedUser(db);
    const trip = await seedTrip(db, user.id);
    const thread = await repo.findOrCreateThread(trip.id, user.id);

    await repo.appendMessage({ threadId: thread.id, role: 'user', content: 'hi' });
    await repo.appendMessage({
      threadId: thread.id,
      role: 'assistant',
      content: 'hello there',
    });

    const messages = await repo.listMessages(thread.id);
    expect(messages.map((m) => ({ role: m.role, content: m.content }))).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello there' },
    ]);
  });

  it('isolates threads per user within the same trip', async () => {
    const repo = new DrizzleChatMessageRepository(db);
    const userA = await seedUser(db, { email: 'a@example.com' });
    const userB = await seedUser(db, { email: 'b@example.com' });
    const trip = await seedTrip(db, userA.id);

    const threadA = await repo.findOrCreateThread(trip.id, userA.id);
    const threadB = await repo.findOrCreateThread(trip.id, userB.id);

    expect(threadA.id).not.toBe(threadB.id);

    await repo.appendMessage({ threadId: threadA.id, role: 'user', content: 'A says hi' });
    const messagesB = await repo.listMessages(threadB.id);
    expect(messagesB).toHaveLength(0);
  });
});
