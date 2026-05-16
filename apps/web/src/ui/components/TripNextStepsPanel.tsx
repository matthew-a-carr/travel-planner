type Props = {
  hasDestinations: boolean;
  hasFixedCosts: boolean;
};

export function TripNextStepsPanel({ hasDestinations, hasFixedCosts }: Props) {
  return (
    <section
      aria-labelledby="trip-next-steps-heading"
      className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 shadow-sm"
    >
      <h2
        id="trip-next-steps-heading"
        className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
      >
        What next?
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Your trip is ready. Add a destination or a fixed cost to start shaping the budget.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        {!hasDestinations && (
          <a
            href="#destinations"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Add your first destination
          </a>
        )}
        {!hasFixedCosts && (
          <a
            href="#fixed-costs"
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Add a fixed cost
          </a>
        )}
      </div>
    </section>
  );
}
