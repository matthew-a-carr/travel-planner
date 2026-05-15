import type { TimelineFinding } from '@/domain/timeline/types';

const SEVERITY_LABEL: Record<TimelineFinding['severity'], string> = {
  info: 'Info',
  warning: 'Warning',
  danger: 'Action needed',
};

const SEVERITY_STYLE: Record<TimelineFinding['severity'], string> = {
  info: 'bg-zinc-50 text-zinc-700 ring-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-200 dark:ring-zinc-700',
  warning:
    'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:ring-amber-800',
  danger:
    'bg-red-50 text-red-800 ring-red-200 dark:bg-red-900/30 dark:text-red-100 dark:ring-red-800',
};

const KIND_LABEL: Record<TimelineFinding['kind'], string> = {
  gap: 'Gap',
  overlap: 'Overlap',
  'budget-low': 'Budget low',
  'budget-high': 'Budget high',
  seasonality: 'Seasonality',
  'transport-missing': 'Transport',
  'visa-required': 'Visa',
  'event-clash': 'Event clash',
  'peak-pricing': 'Peak pricing',
};

type Props = {
  findings: readonly TimelineFinding[];
  aiAvailable: boolean;
};

export function TimelineInsightsPanel({ findings, aiAvailable }: Props) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Insights</h2>
        {!aiAvailable && (
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            AI offline
          </span>
        )}
      </div>

      {findings.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No issues detected. Add or edit destinations to get fresh insights.
        </p>
      ) : (
        <ul className="space-y-2">
          {findings.map((f) => (
            <li
              key={`${f.stopId ?? '_'}-${f.kind}`}
              className={`rounded-lg ring-1 px-3 py-2 text-sm ${SEVERITY_STYLE[f.severity]}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                  {SEVERITY_LABEL[f.severity]} · {KIND_LABEL[f.kind]}
                </span>
              </div>
              <p className="mt-1 leading-snug">{f.message}</p>
              {f.suggestion && <p className="mt-1 text-xs opacity-80">{f.suggestion}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
