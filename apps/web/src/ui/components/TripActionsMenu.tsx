'use client';

import { type ReactNode, useState } from 'react';

/**
 * Overflow menu for the trip header. Hosts the infrequent / destructive
 * actions (move, delete) behind a single "More" control so the header
 * surfaces only the common actions inline. Children render stacked inside
 * the dropdown panel; an invisible backdrop closes it on outside click.
 */
export function TripActionsMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="More trip actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-xl leading-none text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      >
        <span aria-hidden>⋯</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-1 w-60 space-y-2 rounded-xl border border-zinc-200 bg-white p-3 text-left shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {children}
          </div>
        </>
      )}
    </div>
  );
}
