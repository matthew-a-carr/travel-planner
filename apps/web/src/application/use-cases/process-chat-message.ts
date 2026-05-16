import type { ChatAssistantService } from '@/application/ports/chat-assistant';
import type {
  ChatMessageRepository,
  ChatUIMessagePart,
} from '@/application/ports/chat-message-repository';
import type { ChatThread } from '@/domain/chat/types';
import type { OrganizationRepository } from '@/domain/organization/organization-repository';
import type { TripRepository } from '@/domain/trip/trip-repository';
import type { Result } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';

const MAX_TOTAL_TEXT_LENGTH = 4_000;

export type ProcessChatMessageRequest = {
  readonly tripId: string;
  readonly userId: string;
  /** The new user message as structured UI message parts. */
  readonly userParts: readonly ChatUIMessagePart[];
};

export type ProcessChatMessageOutcome = {
  readonly thread: ChatThread;
  /** The assistant's UI message stream. The route handler returns this
   *  Response directly; the assistant adapter persists the assistant
   *  message via the onFinish callback wired up below. */
  readonly response: Response;
};

export type ProcessChatMessageDeps = {
  readonly tripRepository: TripRepository;
  readonly organizationRepository: OrganizationRepository;
  readonly chatMessageRepository: ChatMessageRepository;
  readonly chatAssistant: ChatAssistantService;
};

function totalTextLength(parts: readonly ChatUIMessagePart[]): number {
  let total = 0;
  for (const part of parts) {
    if (part.type === 'text' && typeof (part as { text?: unknown }).text === 'string') {
      total += (part as { text: string }).text.length;
    }
  }
  return total;
}

function hasNonEmptyText(parts: readonly ChatUIMessagePart[]): boolean {
  for (const part of parts) {
    if (part.type === 'text' && typeof (part as { text?: unknown }).text === 'string') {
      if ((part as { text: string }).text.trim().length > 0) return true;
    }
  }
  return false;
}

export async function processChatMessage(
  deps: ProcessChatMessageDeps,
  request: ProcessChatMessageRequest,
): Promise<Result<ProcessChatMessageOutcome>> {
  if (request.userParts.length === 0) return err('Message is empty');
  if (!hasNonEmptyText(request.userParts)) return err('Message is empty');
  if (totalTextLength(request.userParts) > MAX_TOTAL_TEXT_LENGTH) {
    return err(`Message is too long (max ${MAX_TOTAL_TEXT_LENGTH} characters)`);
  }

  const trip = await deps.tripRepository.findById(request.tripId);
  if (!trip) return err(`Trip not found: ${request.tripId}`);

  const membership = await deps.organizationRepository.findMembership(
    trip.organizationId,
    request.userId,
  );
  if (!membership) return err('Forbidden');

  const thread = await deps.chatMessageRepository.findOrCreateThread(
    request.tripId,
    request.userId,
  );

  await deps.chatMessageRepository.appendMessage({
    threadId: thread.id,
    role: 'user',
    parts: request.userParts,
  });

  const history = await deps.chatMessageRepository.listMessages(thread.id);

  const outcome = await deps.chatAssistant.streamReply({
    tripId: request.tripId,
    history,
    onFinish: async (assistantParts) => {
      if (assistantParts.length === 0) return;
      await deps.chatMessageRepository.appendMessage({
        threadId: thread.id,
        role: 'assistant',
        parts: assistantParts,
      });
    },
  });
  if (!outcome.ok) return err(outcome.error);

  return ok({ thread, response: outcome.response });
}
