import { destinationDays } from '@/domain/destination/destination';
import type { Destination, TripFixedCost } from '@/domain/trip/types';
import { formatMoney } from '@/domain/trip/types';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const COMFORT_LABELS: Record<string, string> = {
  budget: 'Budget',
  mid: 'Mid-range',
  luxury: 'Luxury',
};

const COMFORT_DOT: Record<string, string> = {
  budget: 'bg-emerald-500',
  mid: 'bg-blue-500',
  luxury: 'bg-purple-500',
};

const COMFORT_CHIP: Record<string, string> = {
  budget: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  mid: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  luxury: 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300',
};

const CATEGORY_DIAMOND: Record<string, string> = {
  transport: 'bg-amber-600',
  accommodation: 'bg-sky-600',
  visas: 'bg-rose-600',
  insurance: 'bg-zinc-500',
  bills: 'bg-zinc-500',
  subscriptions: 'bg-zinc-500',
  other: 'bg-zinc-400',
};

type DatedDestination = Destination & { startDate: Date; endDate: Date };

type TimelineItem =
  | { kind: 'destination'; date: Date; gapNights: number; dest: DatedDestination }
  | { kind: 'cost'; date: Date; cost: TripFixedCost };

type Props = {
  destinations: readonly Destination[];
  fixedCosts: readonly TripFixedCost[];
};

export function TripTimeline({ destinations, fixedCosts }: Props) {
  const datedDestinations = destinations.filter(
    (d): d is DatedDestination => d.startDate !== null && d.endDate !== null,
  );
  const undatedDestinations = destinations.filter((d) => !d.startDate || !d.endDate);

  if (datedDestinations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-600">
        <p className="text-zinc-500 dark:text-zinc-400">No dated destinations yet.</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          Paste an itinerary above, or add a destination with dates to start the timeline.
        </p>
      </div>
    );
  }

  const sortedDestinations = [...datedDestinations].sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime(),
  );
  const start = sortedDestinations[0].startDate;
  const end = sortedDestinations.reduce(
    (latest, d) => (d.endDate > latest ? d.endDate : latest),
    sortedDestinations[0].endDate,
  );
  const totalNights = Math.max(1, Math.round((end.getTime() - start.getTime()) / MS_PER_DAY));

  // Only surface fixed costs that fall within (or just around) the dated span,
  // so the timeline reads as an itinerary rather than a dump of every cost.
  const datedFixedCosts = fixedCosts
    .filter(
      (f) =>
        f.date.getTime() >= start.getTime() - 7 * MS_PER_DAY &&
        f.date.getTime() <= end.getTime() + 7 * MS_PER_DAY,
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // Merge destinations and dated costs into one chronological stream.
  const items: TimelineItem[] = [
    ...sortedDestinations.map((dest, index): TimelineItem => {
      const previous = sortedDestinations[index - 1];
      const gapNights = previous
        ? Math.round((dest.startDate.getTime() - previous.endDate.getTime()) / MS_PER_DAY)
        : 0;
      return { kind: 'destination', date: dest.startDate, gapNights, dest };
    }),
    ...datedFixedCosts.map((cost): TimelineItem => ({ kind: 'cost', date: cost.date, cost })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Timeline</h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {formatRange(start, end)} · {totalNights} {totalNights === 1 ? 'night' : 'nights'}
        </span>
      </div>

      <ol className="relative">
        {/* Continuous rail behind the nodes */}
        <span
          aria-hidden
          className="absolute bottom-3 left-[5px] top-3 w-px bg-zinc-200 dark:bg-zinc-700"
        />

        {items.map((item) =>
          item.kind === 'destination' ? (
            <DestinationRow key={`dest-${item.dest.id}`} item={item} />
          ) : (
            <CostRow key={`cost-${item.cost.id}`} cost={item.cost} />
          ),
        )}
      </ol>

      {undatedDestinations.length > 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-zinc-200 p-3 dark:border-zinc-700">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Undated
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {undatedDestinations.map((d) => (
              <li
                key={d.id}
                className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                {d.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DestinationRow({ item }: { item: Extract<TimelineItem, { kind: 'destination' }> }) {
  const { dest, gapNights } = item;
  const nights = destinationDays(dest) ?? 0;
  const location = [dest.city, dest.country].filter(Boolean).join(', ');
  const comfort = COMFORT_LABELS[dest.comfortLevel] ?? dest.comfortLevel;

  return (
    <li>
      {gapNights > 0 && (
        <div className="flex items-center gap-3 pl-6 text-xs text-zinc-400 dark:text-zinc-500">
          <span className="leading-6">↕ {gapNights}-night gap</span>
        </div>
      )}
      <div className="relative flex gap-4 pb-6">
        <span className="relative z-10 mt-1.5 flex w-3 justify-center">
          <span
            className={`h-3 w-3 rounded-full ${COMFORT_DOT[dest.comfortLevel] ?? 'bg-zinc-400'} ring-4 ring-white dark:ring-zinc-900`}
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="flex flex-wrap items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
              <span className="truncate">{dest.name}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${COMFORT_CHIP[dest.comfortLevel] ?? ''}`}
              >
                {comfort}
              </span>
            </h3>
            <span className="shrink-0 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {formatMoney(dest.estimatedBudget)}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            {formatRange(dest.startDate, dest.endDate)} · {nights}{' '}
            {nights === 1 ? 'night' : 'nights'}
          </p>
          {location && (
            <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{location}</p>
          )}
        </div>
      </div>
    </li>
  );
}

function CostRow({ cost }: { cost: TripFixedCost }) {
  return (
    <li className="relative flex gap-4 pb-6">
      <span className="relative z-10 mt-1.5 flex w-3 justify-center">
        <span
          className={`h-2.5 w-2.5 rotate-45 ${CATEGORY_DIAMOND[cost.category] ?? CATEGORY_DIAMOND.other} ring-4 ring-white dark:ring-zinc-900`}
        />
      </span>
      <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 text-zinc-600 dark:text-zinc-300">
          <span className="truncate">{cost.label}</span>
          <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">
            {formatDay(cost.date)}
          </span>
        </span>
        <span className="shrink-0 text-zinc-500 dark:text-zinc-400">
          {formatMoney(cost.amount)}
        </span>
      </div>
    </li>
  );
}

function formatDay(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "Fri 13 Feb – Wed 18 Feb 2026" — year shown once, on the end date. */
function formatRange(start: Date, end: Date): string {
  return `${formatDay(start)} – ${end.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`;
}
