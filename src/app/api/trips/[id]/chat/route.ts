import type { UIMessage } from 'ai';
import type { NextRequest } from 'next/server';
import type { ChatUIMessagePart } from '@/application/ports/chat-message-repository';
import { processChatMessage } from '@/application/use-cases/process-chat-message';
import { getAppContainer } from '@/infrastructure/container';
import { getAuthenticatedAccessContext } from '@/infrastructure/organization/active-organization';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

type ChatRequestBody = {
  readonly messages?: unknown;
};

async function authorizeTripAccess(
  tripId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { tripRepository, organizationRepository } = getAppContainer();
  const trip = await tripRepository.findById(tripId);
  if (!trip) return { ok: false, status: 404, error: 'Trip not found' };
  const membership = await organizationRepository.findMembership(trip.organizationId, userId);
  if (!membership) return { ok: false, status: 403, error: 'Forbidden' };
  return { ok: true };
}

export async function GET(_request: NextRequest, { params }: RouteParams): Promise<Response> {
  const { id } = await params;
  const context = await getAuthenticatedAccessContext();
  if (!context) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await authorizeTripAccess(id, context.userId);
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

  const { chatMessageRepository } = getAppContainer();
  const thread = await chatMessageRepository.findOrCreateThread(id, context.userId);
  const messages = await chatMessageRepository.listMessages(thread.id);

  return Response.json({
    threadId: thread.id,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role === 'system' ? 'assistant' : m.role,
      parts: m.parts,
    })),
  });
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const { id } = await params;

  const context = await getAuthenticatedAccessContext();
  if (!context) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json(
      { error: 'Missing required field "messages" (UIMessage[])' },
      { status: 400 },
    );
  }

  const lastMessage = body.messages[body.messages.length - 1] as Partial<UIMessage> | undefined;
  if (!lastMessage || lastMessage.role !== 'user' || !Array.isArray(lastMessage.parts)) {
    return Response.json({ error: 'Last message must be a user UIMessage' }, { status: 400 });
  }

  const userParts = lastMessage.parts as ChatUIMessagePart[];

  const { tripRepository, organizationRepository, chatMessageRepository, chatAssistant } =
    getAppContainer();

  const outcome = await processChatMessage(
    { tripRepository, organizationRepository, chatMessageRepository, chatAssistant },
    { tripId: id, userId: context.userId, userParts },
  );
  if (!outcome.ok) {
    const status =
      outcome.error === 'Forbidden' ? 403 : outcome.error.startsWith('Trip not found') ? 404 : 400;
    return Response.json({ error: outcome.error }, { status });
  }

  return outcome.value.response;
}
