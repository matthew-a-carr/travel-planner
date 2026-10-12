'use client';

import type { UIMessage } from 'ai';
import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';
import type { SuggestedPrompt } from '@/domain/chat/suggested-prompts';

const DrawerBody = dynamic(() => import('./DrawerBody').then((module) => module.DrawerBody), {
  ssr: false,
  loading: () => <p className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>,
});

export type LoadedMessage = {
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
