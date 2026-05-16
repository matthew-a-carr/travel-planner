'use client';

import { useState } from 'react';

type Alert = {
  destinationName: string;
  type: string;
  message: string;
  severity: 'warning' | 'danger';
};

type Props = {
  alerts: Alert[];
};

export function BudgetAlertBanner({ alerts }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || alerts.length === 0) return null;

  const hasDanger = alerts.some((a) => a.severity === 'danger');

  return (
    <div
      role="alert"
      className={`relative rounded-xl border p-4 shadow-sm ${
        hasDanger
          ? 'border-red-200 bg-red-50 dark:border-red-400/30 dark:bg-red-950/30'
          : 'border-amber-200 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-950/30'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <h3
            className={`text-sm font-semibold ${
              hasDanger ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'
            }`}
          >
            Budget alerts
          </h3>
          <ul className="space-y-1">
            {alerts.map((alert) => (
              <li
                key={`${alert.destinationName}-${alert.type}-${alert.message}`}
                className={`text-xs ${
                  alert.severity === 'danger'
                    ? 'text-red-700 dark:text-red-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                <span className="font-medium">{alert.destinationName}:</span> {alert.message}
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss budget alerts"
          className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
            hasDanger
              ? 'text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/50'
              : 'text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/50'
          }`}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
