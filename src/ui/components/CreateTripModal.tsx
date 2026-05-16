'use client';

import { useState } from 'react';
import { CreateTripForm } from './CreateTripForm';
import { CreateTripFromPlanForm } from './CreateTripFromPlanForm';

type Mode = 'manual' | 'plan';

export function CreateTripButton() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('manual');

  const close = () => {
    setOpen(false);
    setMode('manual');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Create trip
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close modal"
            className="absolute inset-0 bg-black/50"
            onClick={close}
          />
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              New trip
            </h2>
            <div className="mb-5 flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
              <button
                type="button"
                onClick={() => setMode('manual')}
                aria-pressed={mode === 'manual'}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  mode === 'manual'
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                }`}
              >
                Manual
              </button>
              <button
                type="button"
                onClick={() => setMode('plan')}
                aria-pressed={mode === 'plan'}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  mode === 'plan'
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                }`}
                data-testid="create-trip-plan-tab"
              >
                Plan with AI
              </button>
            </div>

            {mode === 'manual' ? (
              <CreateTripForm onCancel={close} />
            ) : (
              <CreateTripFromPlanForm onCancel={close} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
