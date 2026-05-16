'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatChatStreamError } from '@/domain/chat/format-chat-stream-error';
import type { SuggestedPrompt } from '@/domain/chat/suggested-prompts';
import { ToolCallCard } from './ToolCallCard';

type LoadedMessage = {
  readonly id: string;
  readonly role: UIMessage['role'];
  readonly parts: UIMessage['parts'];
};

type DrawerStatus = 'closed' | 'opening' | 'open' | 'failed';

type Props = {
  readonly tripId: string;
  readonly suggestedPrompts: readonly SuggestedPrompt[];
};

/**
 * Per-trip conversational assistant. Hydrates persisted messages on open,
 * then delegates streaming to `@ai-sdk/react`'s `useChat`. Tool invocations
 * (Slice 2 write tools) render via `ToolCallCard` with explicit
 * Confirm / Cancel / Undo buttons. The empty-thread copy advertises the
 * full mutation surface — read-only is a degenerate case of the same UX.
 */
export function TripAssistantDrawer({ tripId, suggestedPrompts }: Props) {
  const [drawerStatus, setDrawerStatus] = useState<DrawerStatus>('closed');
  const [hydration, setHydration] = useState<{
    readonly initialMessages: readonly LoadedMessage[];
    readonly hydratedTripId: string;
  } | null>(null);
  const [hydrationError, setHydrationError] = useState<string | null>(null);

  const open = useCallback(async () => {
    setDrawerStatus('opening');
    setHydrationError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/chat`, { method: 'GET' });
      if (!res.ok) {
        setHydrationError(`Failed to load chat (${res.status})`);
        setDrawerStatus('failed');
        return;
      }
      const data = (await res.json()) as { messages: LoadedMessage[] };
      setHydration({ initialMessages: data.messages, hydratedTripId: tripId });
      setDrawerStatus('open');
    } catch (cause) {
      setHydrationError(cause instanceof Error ? cause.message : 'Failed to load chat');
      setDrawerStatus('failed');
    }
  }, [tripId]);

  const close = useCallback(() => setDrawerStatus('closed'), []);

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        aria-label="Open trip assistant"
        data-testid="open-assistant-drawer"
      >
        Assistant
      </button>

      {drawerStatus !== 'closed' && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close assistant"
            className="absolute inset-0 bg-black/40"
            onClick={close}
          />
          <aside
            className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl dark:bg-zinc-900"
            role="dialog"
            aria-label="Trip assistant"
          >
            <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Trip assistant
              </h2>
              <button
                type="button"
                onClick={close}
                className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                aria-label="Close"
              >
                ×
              </button>
            </header>

            {drawerStatus === 'opening' && (
              <p className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
            )}
            {drawerStatus === 'failed' && (
              <p
                className="px-4 py-3 text-sm text-red-600 dark:text-red-400"
                role="alert"
                data-testid="assistant-hydration-error"
              >
                {hydrationError ?? 'Failed to load chat'}
              </p>
            )}
            {drawerStatus === 'open' && hydration?.hydratedTripId === tripId && (
              <DrawerBody
                tripId={tripId}
                initialMessages={hydration.initialMessages}
                suggestedPrompts={suggestedPrompts}
              />
            )}
          </aside>
        </div>
      )}
    </>
  );
}

function DrawerBody({
  tripId,
  initialMessages,
  suggestedPrompts,
}: {
  readonly tripId: string;
  readonly initialMessages: readonly LoadedMessage[];
  readonly suggestedPrompts: readonly SuggestedPrompt[];
}) {
  const { messages, sendMessage, status, error } = useChat({
    id: tripId,
    messages: initialMessages.map((m) => ({
      id: m.id,
      role: m.role,
      parts: m.parts,
    })) as UIMessage[],
    transport: new DefaultChatTransport({ api: `/api/trips/${tripId}/chat` }),
  });

  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const streaming = status === 'streaming' || status === 'submitted';
  const errored = status === 'error';
  const errorMessage = errored ? formatChatStreamError(error) : null;

  const messageCount = messages.length;
  const lastMessageSignature = messages
    .at(-1)
    ?.parts.map((p) => ('text' in p ? (p as { text: string }).text : p.type))
    .join('|');

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll-on-update — scrollRef is stable, the trigger is the message contents.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messageCount, lastMessageSignature]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (text.length === 0 || streaming) return;
    sendMessage({ text });
    setDraft('');
  };

  return (
    <>
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm"
        data-testid="assistant-message-list"
      >
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-zinc-500 dark:text-zinc-400">
              Ask about this trip or tell me to make changes — e.g. "I spent £8 on lunch in Hanoi"
              or "add £200 visas on 1 April". I'll confirm anything risky before acting.
            </p>
            {suggestedPrompts.length > 0 && (
              <div className="flex flex-wrap gap-2" data-testid="assistant-suggested-prompts">
                {suggestedPrompts.map((suggestion) => (
                  <button
                    key={suggestion.label}
                    type="button"
                    onClick={() => {
                      setDraft(suggestion.prompt);
                      textareaRef.current?.focus();
                    }}
                    className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {messages.map((message, messageIndex) => {
          const isLastAssistant =
            message.role === 'assistant' && messageIndex === messages.length - 1;
          return (
            <div key={message.id} data-testid={`assistant-message-${message.role}`}>
              {message.parts.map((part, partIndex) => {
                if (part.type === 'text') {
                  const text = (part as { text: string }).text;
                  return (
                    <div
                      // biome-ignore lint/suspicious/noArrayIndexKey: parts are positionally stable within a message turn
                      key={`text-${partIndex}`}
                      className={
                        message.role === 'user'
                          ? 'ml-8 rounded-lg bg-zinc-900 px-3 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900'
                          : 'mr-8 rounded-lg bg-zinc-100 px-3 py-2 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                      }
                      aria-live={isLastAssistant && streaming ? 'polite' : undefined}
                    >
                      {text || (streaming && isLastAssistant ? '…' : '')}
                    </div>
                  );
                }
                if (part.type.startsWith('tool-')) {
                  return (
                    <ToolCallCard
                      // biome-ignore lint/suspicious/noArrayIndexKey: parts are positionally stable within a message turn
                      key={`tool-${partIndex}`}
                      part={part as Parameters<typeof ToolCallCard>[0]['part']}
                      sendMessage={sendMessage}
                      disabled={streaming}
                    />
                  );
                }
                return null;
              })}
            </div>
          );
        })}
        {errored && errorMessage && (
          <p
            className="text-sm text-red-600 dark:text-red-400"
            role="alert"
            data-testid="assistant-stream-error"
          >
            {errorMessage}
          </p>
        )}
      </div>

      <form
        onSubmit={submit}
        className="flex items-end gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800"
      >
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              const text = draft.trim();
              if (text.length === 0 || streaming) return;
              sendMessage({ text });
              setDraft('');
            }
          }}
          placeholder="Ask the assistant…"
          rows={2}
          disabled={streaming}
          className="flex-1 resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-zinc-100"
          aria-label="Message"
        />
        <button
          type="submit"
          disabled={streaming || draft.trim().length === 0}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Send
        </button>
      </form>
    </>
  );
}
