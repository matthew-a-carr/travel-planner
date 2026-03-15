'use client';

import type { CostConfidence } from '@/domain/country-reference/types';

const BADGE_STYLES: Record<CostConfidence, string> = {
  high: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  low: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
};

const LABELS: Record<CostConfidence, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const TOOLTIPS: Record<CostConfidence, string> = {
  high: 'City-specific data from curated research',
  medium: 'City-specific estimate from statistical model',
  low: 'Country-level average (no city data available)',
};

export function CostConfidenceBadge({ confidence }: { confidence: CostConfidence }) {
  return (
    <span
      role="status"
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${BADGE_STYLES[confidence]}`}
      title={TOOLTIPS[confidence]}
      aria-label={`Estimate confidence: ${LABELS[confidence]}. ${TOOLTIPS[confidence]}`}
    >
      {LABELS[confidence]}
    </span>
  );
}
