import { describe, expect, it, vi } from 'vitest';
import type { ChatAssistantService } from '@/application/ports/chat-assistant';
import type { ChatMessageRepository } from '@/application/ports/chat-message-repository';
import type { ChatMessage, ChatThread } from '@/domain/chat/types';
import type { OrganizationRepository } from '@/domain/organization/organization-repository';
import type { OrganizationMembership } from '@/domain/organization/types';
import type { TripRepository } from '@/domain/trip/trip-repository';
import { moneyUnchecked, type Trip } from '@/domain/trip/types';
import { processChatMessage, type ProcessChatMessageDeps } from './process-chat-message';

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    organizationId: 'org-1',
    ownerId: 'user-1',
    name: 'Test Trip',
    totalBudget: moneyUnchecked(100000, 'GBP'),
    status: 'planning',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeThread(overrides: Partial<ChatThread> = {}): ChatThread {
  return {
    id: 'thread-1',
    tripId: 'trip-1',
    userId: 'user-1',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeMembership(): OrganizationMembership {
  return {
    organizationId: 'org-1',
    userId: 'user-1',
    role: 'owner',
    createdAt: new Date('2026-01-01'),
  };
}

function makeTripRepo(trip: Trip | null = makeTrip()): TripRepository {
  return {
    findById: vi.fn().mockResolvedValue(trip),
    findAllByOrganization: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
}

function makeOrgRepo(membership: OrganizationMembership | null = makeMembership()): OrganizationRepository {
  return {
    findById: vi.fn(),
    findMembership: vi.fn().mockResolvedValue(membership),
    findOrganizationsForUser: vi.fn(),
    listMembers: vi.fn(),
    findUserById: vi.fn(),
    findUserByEmail: vi.fn(),
    searchMemberCandidates: vi.fn(),
    createOrganizationWithOwner: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
  };
}

function makeChatRepo(thread: ChatThread = makeThread()): ChatMessageRepository {
  return {
    findOrCreateThread: vi.fn().mockResolvedValue(thread),
    listMessages: vi.fn().mockResolvedValue([] as ChatMessage[]),
    appendMessage: vi.fn().mockImplementation(async ({ threadId, role, content }) => ({
      id: `${role}-msg`,
      threadId,
      role,
      content,
      createdAt: new Date(),
    })),
  };
}

async function* fromChunks(chunks: readonly string[]): AsyncIterable<string> {
  for (const chunk of chunks) yield chunk;
}

function makeAssistant(chunks: readonly string[]): ChatAssistantService {
  return {
    streamReply: vi.fn().mockResolvedValue({ ok: true, textStream: fromChunks(chunks) }),
  };
}

function makeFailingAssistant(error: string): ChatAssistantService {
  return {
    streamReply: vi.fn().mockResolvedValue({ ok: false, error }),
  };
}

function makeDeps(overrides: Partial<ProcessChatMessageDeps> = {}): ProcessChatMessageDeps {
  return {
    tripRepository: overrides.tripRepository ?? makeTripRepo(),
    organizationRepository: overrides.organizationRepository ?? makeOrgRepo(),
    chatMessageRepository: overrides.chatMessageRepository ?? makeChatRepo(),
    chatAssistant: overrides.chatAssistant ?? makeAssistant(['Hello', ' world']),
  };
}

async function drainStream(stream: AsyncIterable<string>): Promise<string> {
  let out = '';
  for await (const chunk of stream) out += chunk;
  return out;
}

describe('processChatMessage', () => {
  it('rejects an empty message', async () => {
    const result = await processChatMessage(makeDeps(), {
      tripId: 'trip-1',
      userId: 'user-1',
      userMessage: '   ',
    });
    expect(result).toEqual({ ok: false, error: 'Message is empty' });
  });

  it('rejects an over-long message', async () => {
    const result = await processChatMessage(makeDeps(), {
      tripId: 'trip-1',
      userId: 'user-1',
      userMessage: 'x'.repeat(4_001),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/too long/);
  });

  it('returns trip-not-found when the trip does not exist', async () => {
    const deps = makeDeps({ tripRepository: makeTripRepo(null) });
    const result = await processChatMessage(deps, {
      tripId: 'missing',
      userId: 'user-1',
      userMessage: 'hi',
    });
    expect(result).toEqual({ ok: false, error: 'Trip not found: missing' });
  });

  it('forbids users without a membership in the trip’s org', async () => {
    const deps = makeDeps({ organizationRepository: makeOrgRepo(null) });
    const result = await processChatMessage(deps, {
      tripId: 'trip-1',
      userId: 'outsider',
      userMessage: 'hi',
    });
    expect(result).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('persists the user message and streams the assistant reply', async () => {
    const chatRepo = makeChatRepo();
    const assistant = makeAssistant(['Hel', 'lo']);
    const deps = makeDeps({ chatMessageRepository: chatRepo, chatAssistant: assistant });

    const result = await processChatMessage(deps, {
      tripId: 'trip-1',
      userId: 'user-1',
      userMessage: 'hi there',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(chatRepo.findOrCreateThread).toHaveBeenCalledWith('trip-1', 'user-1');
    expect(chatRepo.appendMessage).toHaveBeenNthCalledWith(1, {
      threadId: 'thread-1',
      role: 'user',
      content: 'hi there',
    });

    const text = await drainStream(result.value.replyStream);
    expect(text).toBe('Hello');

    expect(chatRepo.appendMessage).toHaveBeenNthCalledWith(2, {
      threadId: 'thread-1',
      role: 'assistant',
      content: 'Hello',
    });
  });

  it('surfaces a failing assistant outcome as a use-case error', async () => {
    const deps = makeDeps({
      chatAssistant: makeFailingAssistant('AI offline'),
    });
    const result = await processChatMessage(deps, {
      tripId: 'trip-1',
      userId: 'user-1',
      userMessage: 'hi',
    });
    expect(result).toEqual({ ok: false, error: 'AI offline' });
  });

  it('persists partial output if the upstream stream throws', async () => {
    const chatRepo = makeChatRepo();
    async function* failingStream(): AsyncIterable<string> {
      yield 'partial';
      throw new Error('upstream broke');
    }
    const assistant: ChatAssistantService = {
      streamReply: vi.fn().mockResolvedValue({ ok: true, textStream: failingStream() }),
    };
    const deps = makeDeps({ chatMessageRepository: chatRepo, chatAssistant: assistant });

    const result = await processChatMessage(deps, {
      tripId: 'trip-1',
      userId: 'user-1',
      userMessage: 'hi',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await expect(drainStream(result.value.replyStream)).rejects.toThrow('upstream broke');

    expect(chatRepo.appendMessage).toHaveBeenNthCalledWith(2, {
      threadId: 'thread-1',
      role: 'assistant',
      content: 'partial',
    });
  });
});
