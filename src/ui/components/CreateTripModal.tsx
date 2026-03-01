'use client';

import { useState } from 'react';
import { CreateTripForm } from './CreateTripForm';

export function CreateTripButton() {
  const [open, setOpen] = useState(false);

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
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-xl bg-white dark:bg-zinc-900 p-6 shadow-xl">
            <h2 className="mb-5 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              New trip
            </h2>
            <CreateTripForm onCancel={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
