import type { Destination, TripFixedCost } from '@/domain/trip/types';
import { formatMoney } from '@/domain/trip/types';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const COMFORT_COLOURS: Record<string, string> = {
  budget: 'bg-emerald-500',
  mid: 'bg-blue-500',
  luxury: 'bg-purple-500',
};

const CATEGORY_COLOURS: Record<string, string> = {
  transport: 'bg-amber-600',
  accommodation: 'bg-sky-600',
  visas: 'bg-rose-600',
  insurance: 'bg-zinc-600',
  bills: 'bg-zinc-600',
  subscriptions: 'bg-zinc-600',
  other: 'bg-zinc-500',
};

type Props = {
  destinations: readonly Destination[];
  fixedCosts: readonly TripFixedCost[];
};

export function TimelineGantt({ destinations, fixedCosts }: Props) {
  const datedDestinations = destinations.filter(
    (d): d is Destination & { startDate: Date; endDate: Date } =>
      d.startDate !== null && d.endDate !== null,
  );
  const undatedDestinations = destinations.filter((d) => !d.startDate || !d.endDate);

  if (datedDestinations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-600 p-8 text-center">
        <p className="text-zinc-500 dark:text-zinc-400">No dated destinations yet.</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          Paste an itinerary above, or add a destination with dates to start the timeline.
        </p>
      </div>
    );
  }

  const sorted = [...datedDestinations].sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime(),
  );
  const start = sorted[0].startDate;
  const end = sorted.reduce(
    (latest, d) => (d.endDate > latest ? d.endDate : latest),
    sorted[0].endDate,
  );
  const totalMs = Math.max(MS_PER_DAY, end.getTime() - start.getTime());

  const datedFixedCosts = fixedCosts.filter(
    (f) =>
      f.date.getTime() >= start.getTime() - 7 * MS_PER_DAY &&
      f.date.getTime() <= end.getTime() + 7 * MS_PER_DAY,
  );

  const monthMarkers = buildMonthMarkers(start, end);

  function pct(date: Date): number {
    return ((date.getTime() - start.getTime()) / totalMs) * 100;
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Timeline</h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} –{' '}
          {end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>

      <div className="relative">
        {/* Month markers */}
        <div className="relative h-5">
          {monthMarkers.map((marker) => (
            <div
              key={marker.date.toISOString()}
              className="absolute top-0 -translate-x-1/2 text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500"
              style={{ left: `${pct(marker.date)}%` }}
            >
              {marker.label}
            </div>
          ))}
        </div>

        {/* Background tick lines */}
        <div className="relative h-2 border-t border-zinc-200 dark:border-zinc-700">
          {monthMarkers.map((marker) => (
            <div
              key={marker.date.toISOString()}
              className="absolute -top-px h-2 w-px bg-zinc-300 dark:bg-zinc-600"
              style={{ left: `${pct(marker.date)}%` }}
            />
          ))}
        </div>

        {/* Fixed-cost pins above the bars */}
        {datedFixedCosts.length > 0 && (
          <div className="relative mt-3 h-6">
            {datedFixedCosts.map((fc) => {
              const left = Math.max(0, Math.min(100, pct(fc.date)));
              const colour = CATEGORY_COLOURS[fc.category] ?? CATEGORY_COLOURS.other;
              return (
                <div
                  key={fc.id}
                  className="group absolute top-1 -translate-x-1/2"
                  style={{ left: `${left}%` }}
                >
                  <span
                    role="img"
                    aria-label={`${fc.label} (${fc.category})`}
                    className={`block h-3 w-3 rotate-45 ${colour} ring-2 ring-white dark:ring-zinc-900`}
                  />
                  <span className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100">
                    {fc.label} · {formatMoney(fc.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Destination bars — one row per destination */}
        <ul className="mt-4 space-y-2">
          {sorted.map((dest) => {
            const left = Math.max(0, pct(dest.startDate));
            const width = Math.max(1, pct(dest.endDate) - pct(dest.startDate));
            const colour = COMFORT_COLOURS[dest.comfortLevel] ?? 'bg-zinc-500';
            return (
              <li key={dest.id} className="relative h-7">
                <div className="absolute inset-y-0 left-0 right-0 rounded bg-zinc-50 dark:bg-zinc-800" />
                <div
                  className={`absolute inset-y-0.5 rounded ${colour} text-[11px] font-medium text-white shadow-sm`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${dest.name} · ${formatMoney(dest.estimatedBudget)}`}
                >
                  <span className="block truncate px-2 py-1">{dest.name}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {undatedDestinations.length > 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700 p-3">
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

function buildMonthMarkers(start: Date, end: Date): { date: Date; label: string }[] {
  const markers: { date: Date; label: string }[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endTime = end.getTime();
  while (cursor.getTime() <= endTime) {
    markers.push({
      date: new Date(cursor),
      label: cursor.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return markers;
}
