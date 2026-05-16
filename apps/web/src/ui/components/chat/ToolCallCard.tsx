'use client';

/**
 * Renders a tool invocation inside the trip assistant drawer.
 *
 * The chat tools (Slice 2) execute server-side and may return one of:
 * - `{ ok: true, summary, undo? }` — auto-executed mutation
 * - `{ requiresConfirmation: true, summary }` — risky mutation needs approval
 * - `{ error }` — validation or guard failure
 * - read-only tool result objects
 *
 * The card branches on these shapes and exposes inline buttons that send
 * follow-up chat messages: "Confirmed."/"Cancelled." for confirmation,
 * and a structured "Restore the deleted spend: …" message for undo. The
 * server-side system prompt understands these directives and re-calls
 * the right tool with `confirmed: true`.
 */

import { useEffect, useRef } from 'react';

type ToolPart = {
  readonly type: string;
  readonly state?: string;
  readonly toolCallId?: string;
  readonly output?: unknown;
};

type ToolOutput = {
  readonly ok?: boolean;
  readonly requiresConfirmation?: boolean;
  readonly summary?: string;
  readonly error?: string;
  readonly undo?: {
    readonly kind: string;
    readonly destinationId?: string;
    readonly amountPence?: number;
    readonly category?: string;
    readonly description?: string | null;
    readonly spentAt?: string;
  };
};

type Props = {
  readonly part: ToolPart;
  readonly sendMessage: (message: { readonly text: string }) => void;
  readonly disabled: boolean;
};

function toolDisplayName(type: string): string {
  return type.startsWith('tool-') ? type.slice('tool-'.length) : type;
}

function isToolOutput(value: unknown): value is ToolOutput {
  return typeof value === 'object' && value !== null;
}

function buildRestoreMessage(undo: NonNullable<ToolOutput['undo']>): string {
  const fields: string[] = [];
  if (undo.destinationId) fields.push(`destinationId=${undo.destinationId}`);
  if (typeof undo.amountPence === 'number') fields.push(`amountPence=${undo.amountPence}`);
  if (undo.category) fields.push(`category=${undo.category}`);
  if (undo.spentAt) fields.push(`spentAt=${undo.spentAt}`);
  if (undo.description) fields.push(`description=${JSON.stringify(undo.description)}`);
  return `Restore the deleted spend: ${fields.join(', ')}`;
}

export function ToolCallCard({ part, sendMessage, disabled }: Props) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const output = isToolOutput(part.output) ? part.output : null;
  const requiresConfirmation = output?.requiresConfirmation === true;

  useEffect(() => {
    if (requiresConfirmation && confirmRef.current) {
      confirmRef.current.focus();
    }
  }, [requiresConfirmation]);

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (!requiresConfirmation || disabled) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      sendMessage({ text: 'Cancelled.' });
    }
  };

  // While the tool call is in-flight (no output yet), show a quiet
  // placeholder. Auto-executed tools complete server-side before this
  // component sees them, so this state is rare.
  if (part.state !== 'output-available' || output === null) {
    return (
      <div
        className="my-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
        data-testid={`tool-call-${toolDisplayName(part.type)}-pending`}
      >
        Calling {toolDisplayName(part.type)}…
      </div>
    );
  }

  if (typeof output.error === 'string') {
    return (
      <div
        className="my-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
        role="alert"
        data-testid={`tool-call-${toolDisplayName(part.type)}-error`}
      >
        {output.error}
      </div>
    );
  }

  if (requiresConfirmation) {
    return (
      // biome-ignore lint/a11y/useSemanticElements: <fieldset> would imply a form context; this is a chat-message group of action buttons.
      <div
        className="my-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
        role="group"
        aria-label="Confirmation required"
        onKeyDown={handleKeyDown}
        data-testid={`tool-call-${toolDisplayName(part.type)}-confirm`}
      >
        <p className="mb-2">{output.summary ?? 'This change requires confirmation.'}</p>
        <div className="flex gap-2">
          <button
            type="button"
            ref={confirmRef}
            disabled={disabled}
            onClick={() => sendMessage({ text: 'Confirmed.' })}
            className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            data-testid="tool-call-confirm-button"
          >
            Confirm
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => sendMessage({ text: 'Cancelled.' })}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            data-testid="tool-call-cancel-button"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Auto-executed success path — show the summary and (optionally) an Undo
  // button if the tool result includes structured undo metadata.
  if (output.ok === true) {
    return (
      <div
        className="my-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"
        data-testid={`tool-call-${toolDisplayName(part.type)}-ok`}
      >
        <p>{output.summary ?? 'Done.'}</p>
        {output.undo && output.undo.kind === 'record_spend' ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (output.undo) sendMessage({ text: buildRestoreMessage(output.undo) });
            }}
            className="mt-2 rounded-md border border-emerald-400 bg-white px-3 py-1 text-xs font-medium text-emerald-900 disabled:opacity-50 dark:border-emerald-700 dark:bg-zinc-900 dark:text-emerald-200"
            data-testid="tool-call-undo-button"
          >
            Undo
          </button>
        ) : null}
      </div>
    );
  }

  // Read-only tool with structured payload — render nothing here; the
  // model surfaces the result in its natural-language reply instead.
  return null;
}
