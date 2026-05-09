import type { ChatAssistantService } from '@/application/ports/chat-assistant';
import type { ChatMessageRepository } from '@/application/ports/chat-message-repository';
import type { ChatThread } from '@/domain/chat/types';
import type { OrganizationRepository } from '@/domain/organization/organization-repository';
import type { TripRepository } from '@/domain/trip/trip-repository';
import type { Result } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';

const MAX_MESSAGE_LENGTH = 4_000;

export type ProcessChatMessageRequest = {
  readonly tripId: string;
  readonly userId: string;
  readonly userMessage: string;
};

export type ProcessChatMessageOutcome = {
  readonly thread: ChatThread;
  /**
   * Async iterable of assistant text chunks. Once fully consumed, the
   * assistant message has been persisted to the thread. The caller is
   * responsible for streaming these chunks to the HTTP response.
   */
  readonly replyStream: AsyncIterable<string>;
};

export type ProcessChatMessageDeps = {
  readonly tripRepository: TripRepository;
  readonly organizationRepository: OrganizationRepository;
  readonly chatMessageRepository: ChatMessageRepository;
  readonly chatAssistant: ChatAssistantService;
};

export async function processChatMessage(
  deps: ProcessChatMessageDeps,
  request: ProcessChatMessageRequest,
): Promise<Result<ProcessChatMessageOutcome>> {
  const content = request.userMessage.trim();
  if (content.length === 0) return err('Message is empty');
  if (content.length > MAX_MESSAGE_LENGTH) {
    return err(`Message is too long (max ${MAX_MESSAGE_LENGTH} characters)`);
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
    content,
  });

  const history = await deps.chatMessageRepository.listMessages(thread.id);

  const outcome = await deps.chatAssistant.streamReply({ history });
  if (!outcome.ok) return err(outcome.error);

  const replyStream = persistOnComplete(outcome.textStream, deps.chatMessageRepository, thread.id);

  return ok({ thread, replyStream });
}

/**
 * Consumes the assistant's text stream while accumulating the full reply.
 * On normal completion, persists the assistant message. On consumer abort
 * (caller broke the iteration) or stream error, persists what was received
 * so the user doesn't lose partial output. Re-raises any source error
 * after persistence.
 *
 * Tracks text inline rather than relying on the adapter's `fullText`
 * Promise, because that Promise may never resolve if the consumer aborts
 * mid-stream.
 */
async function* persistOnComplete(
  textStream: AsyncIterable<string>,
  repo: ChatMessageRepository,
  threadId: string,
): AsyncIterable<string> {
  let buffered = '';
  let streamError: unknown = null;
  try {
    for await (const chunk of textStream) {
      buffered += chunk;
      yield chunk;
    }
  } catch (cause) {
    streamError = cause;
  } finally {
    if (buffered.length > 0) {
      await repo.appendMessage({ threadId, role: 'assistant', content: buffered });
    }
  }
  if (streamError !== null) throw streamError;
}
