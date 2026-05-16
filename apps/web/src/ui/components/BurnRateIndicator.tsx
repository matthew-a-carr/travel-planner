import type { Currency } from '@/domain/trip/types';
import { formatMoney } from '@/domain/trip/types';

type Props = {
  dailyPacePence: number;
  targetPacePence: number;
  paceRatio: number;
  projectedExhaustionDate: string | null;
  currency: Currency;
};

export function BurnRateIndicator({
  dailyPacePence,
  targetPacePence,
  paceRatio,
  projectedExhaustionDate,
  currency,
}: Props) {
  if (targetPacePence === 0) return null;

  const isOver = paceRatio > 1;
  const percentDiff = Math.abs(Math.round((paceRatio - 1) * 100));

  const paceLabel =
    dailyPacePence === 0
      ? 'No spend yet'
      : `${formatMoney({ amountPence: dailyPacePence, currency })}/day`;

  const targetLabel = `${formatMoney({ amountPence: targetPacePence, currency })}/day`;

  return (
    <div className="border-t border-zinc-100 dark:border-zinc-800 px-5 py-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="text-zinc-500 dark:text-zinc-400">
          Pace: <span className="font-medium text-zinc-700 dark:text-zinc-200">{paceLabel}</span>
        </span>
        <span className="text-zinc-500 dark:text-zinc-400">
          Target:{' '}
          <span className="font-medium text-zinc-700 dark:text-zinc-200">{targetLabel}</span>
        </span>
        {dailyPacePence > 0 && (
          <span
            className={`font-medium ${
              isOver ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'
            }`}
          >
            {isOver
              ? `${percentDiff}% over`
              : percentDiff === 0
                ? 'On pace'
                : `${percentDiff}% under`}
          </span>
        )}
        {projectedExhaustionDate && (
          <span className="text-red-600 dark:text-red-400 font-medium">
            Runs out{' '}
            {new Date(projectedExhaustionDate).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
            })}
          </span>
        )}
      </div>
    </div>
  );
}
