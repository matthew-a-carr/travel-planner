type Props = {
  readonly narrative: string;
  readonly bullets: readonly string[];
};

/**
 * Server-rendered passive AI panel above the budget alerts banner.
 * Hidden entirely when the narrative is empty so the no-op fallback and
 * AI failures both degrade silently. See ADR 043.
 */
export function TripNarrativePanel({ narrative, bullets }: Props) {
  const trimmed = narrative.trim();
  if (trimmed.length === 0) return null;

  return (
    <section
      aria-labelledby="trip-narrative-heading"
      data-testid="trip-narrative-panel"
      className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id="trip-narrative-heading"
          className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
        >
          What's the headline?
        </h2>
        <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          AI summary
        </span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">{trimmed}</p>

      {bullets.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2">
              <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-500" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
