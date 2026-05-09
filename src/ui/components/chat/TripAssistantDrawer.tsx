'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type LoadedMessage = {
  readonly id: string;
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
};

type DrawerState =
  | { readonly status: 'closed' }
  | { readonly status: 'loading'; readonly tripId: string }
  | {
      readonly status: 'ready';
      readonly tripId: string;
      readonly messages: readonly LoadedMessage[];
      readonly streaming: boolean;
      readonly error: string | null;
    };

type Props = {
  readonly tripId: string;
};

export function TripAssistantDrawer({ tripId }: Props) {
  const [drawer, setDrawer] = useState<DrawerState>({ status: 'closed' });
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const open = useCallback(async () => {
    setDrawer({ status: 'loading', tripId });
    try {
      const res = await fetch(`/api/trips/${tripId}/chat`, { method: 'GET' });
      if (!res.ok) {
        setDrawer({
          status: 'ready',
          tripId,
          messages: [],
          streaming: false,
          error: `Failed to load chat (${res.status})`,
        });
        return;
      }
      const data = (await res.json()) as { messages: LoadedMessage[] };
      setDrawer({
        status: 'ready',
        tripId,
        messages: data.messages,
        streaming: false,
        error: null,
      });
    } catch (cause) {
      setDrawer({
        status: 'ready',
        tripId,
        messages: [],
        streaming: false,
        error: cause instanceof Error ? cause.message : 'Failed to load chat',
      });
    }
  }, [tripId]);

  const close = useCallback(() => {
    setDrawer({ status: 'closed' });
  }, []);

  const send = useCallback(async () => {
    if (drawer.status !== 'ready' || drawer.streaming) return;
    const message = draft.trim();
    if (message.length === 0) return;

    const userMsgId = `local-user-${Date.now()}`;
    const assistantMsgId = `local-assistant-${Date.now()}`;
    setDrawer({
      ...drawer,
      messages: [
        ...drawer.messages,
        { id: userMsgId, role: 'user', content: message },
        { id: assistantMsgId, role: 'assistant', content: '' },
      ],
      streaming: true,
      error: null,
    });
    setDraft('');

    try {
      const res = await fetch(`/api/trips/${tripId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (!res.ok || !res.body) {
        const error = await safeReadError(res);
        setDrawer((prev) =>
          prev.status === 'ready'
            ? {
                ...prev,
                messages: prev.messages.filter((m) => m.id !== assistantMsgId),
                streaming: false,
                error,
              }
            : prev,
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffered = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffered += decoder.decode(value, { stream: true });
        setDrawer((prev) =>
          prev.status === 'ready'
            ? {
                ...prev,
                messages: prev.messages.map((m) =>
                  m.id === assistantMsgId ? { ...m, content: buffered } : m,
                ),
              }
            : prev,
        );
      }
      buffered += decoder.decode();
      setDrawer((prev) =>
        prev.status === 'ready'
          ? {
              ...prev,
              messages: prev.messages.map((m) =>
                m.id === assistantMsgId ? { ...m, content: buffered } : m,
              ),
              streaming: false,
            }
          : prev,
      );
    } catch (cause) {
      setDrawer((prev) =>
        prev.status === 'ready'
          ? {
              ...prev,
              streaming: false,
              error: cause instanceof Error ? cause.message : 'Network error',
            }
          : prev,
      );
    }
  }, [draft, drawer, tripId]);

  const lastMessageContent =
    drawer.status === 'ready' ? (drawer.messages.at(-1)?.content ?? '') : '';
  const messageCount = drawer.status === 'ready' ? drawer.messages.length : 0;

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll-on-update — scrollRef itself is a stable ref, the trigger is the message contents.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messageCount, lastMessageContent]);

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

      {drawer.status !== 'closed' && (
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

            <div
              ref={scrollRef}
              className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm"
              data-testid="assistant-message-list"
            >
              {drawer.status === 'loading' && (
                <p className="text-zinc-500 dark:text-zinc-400">Loading…</p>
              )}
              {drawer.status === 'ready' && drawer.messages.length === 0 && (
                <p className="text-zinc-500 dark:text-zinc-400">
                  Ask anything about this trip — destinations, budget, pace. (Read-only for now;
                  edits arrive in the next slice.)
                </p>
              )}
              {drawer.status === 'ready' &&
                drawer.messages.map((m) => (
                  <div
                    key={m.id}
                    className={
                      m.role === 'user'
                        ? 'ml-8 rounded-lg bg-zinc-900 px-3 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900'
                        : 'mr-8 rounded-lg bg-zinc-100 px-3 py-2 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                    }
                    data-testid={`assistant-message-${m.role}`}
                  >
                    {m.content || (drawer.streaming ? '…' : '')}
                  </div>
                ))}
              {drawer.status === 'ready' && drawer.error && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {drawer.error}
                </p>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
              className="flex items-end gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800"
            >
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="Ask the assistant…"
                rows={2}
                disabled={drawer.status !== 'ready' || drawer.streaming}
                className="flex-1 resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-zinc-100"
                aria-label="Message"
              />
              <button
                type="submit"
                disabled={
                  drawer.status !== 'ready' || drawer.streaming || draft.trim().length === 0
                }
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                Send
              </button>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}

async function safeReadError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}
