import Link from 'next/link';
import type { Alpha3, VisaAssessment } from '@/domain/visa/types';
import { buildVisaRows, type VisaRowSeverity } from './visa-panel-view';

const SEVERITY_STYLE: Record<VisaRowSeverity, string> = {
  ok: 'bg-green-50 text-green-800 ring-green-200 dark:bg-green-900/30 dark:text-green-100 dark:ring-green-800',
  info: 'bg-zinc-50 text-zinc-700 ring-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-200 dark:ring-zinc-700',
  warning:
    'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:ring-amber-800',
  danger:
    'bg-red-50 text-red-800 ring-red-200 dark:bg-red-900/30 dark:text-red-100 dark:ring-red-800',
};

type Props = {
  readonly assessment: VisaAssessment;
  readonly nameByAlpha3: ReadonlyMap<Alpha3, string>;
  readonly hasPassports: boolean;
};

export function VisasPanel({ assessment, nameByAlpha3, hasPassports }: Props) {
  const rows = buildVisaRows(assessment, nameByAlpha3);

  return (
    <section
      aria-labelledby="visas-heading"
      className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
    >
      <h2
        id="visas-heading"
        className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-100"
      >
        Visas
      </h2>

      {!hasPassports ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Add your passport in{' '}
          <Link href="/settings/profile" className="font-medium underline">
            Settings → Profile
          </Link>{' '}
          to see personalised visa checks for this trip.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Add dates to your destinations to check visa requirements.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.key}
              className={`rounded-lg px-3 py-2 text-sm ring-1 ${SEVERITY_STYLE[row.severity]}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{row.name}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                  {row.statusLabel}
                </span>
              </div>
              {(row.categoryLabel || row.staySummary) && (
                <p className="mt-1 text-xs opacity-80">
                  {[row.categoryLabel, row.staySummary].filter(Boolean).join(' · ')}
                </p>
              )}
              {row.messages.map((message) => (
                <p key={message} className="mt-1 leading-snug">
                  {message}
                </p>
              ))}
              {row.otherRequirements.length > 0 && (
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs opacity-80">
                  {row.otherRequirements.map((req) => (
                    <li key={req}>{req}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        Based on your{' '}
        <Link href="/settings/profile" className="underline">
          saved passports
        </Link>
        . Visa policies change — always confirm with the official source before you travel.
      </p>
    </section>
  );
}
