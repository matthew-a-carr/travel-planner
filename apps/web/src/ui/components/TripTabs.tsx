import Link from 'next/link';

type Props = {
  tripId: string;
  active: 'overview' | 'timeline';
};

export function TripTabs({ tripId, active }: Props) {
  const tabs = [
    { id: 'overview' as const, label: 'Overview', href: `/trips/${tripId}` },
    { id: 'timeline' as const, label: 'Timeline', href: `/trips/${tripId}/timeline` },
  ];

  return (
    <nav aria-label="Trip sections" className="border-b border-zinc-200 dark:border-zinc-700">
      <ul className="-mb-px flex gap-6">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <li key={tab.id}>
              <Link
                href={tab.href}
                aria-current={isActive ? 'page' : undefined}
                className={`block border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100'
                    : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200'
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
