import Link from 'next/link';

function navClass(isActive: boolean): string {
  if (isActive) {
    return 'rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900';
  }
  return 'rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100';
}

export function SettingsNav({ active }: { active: 'organization' | 'access' }) {
  return (
    <nav aria-label="Settings sections" className="mb-5 flex flex-wrap items-center gap-2">
      <Link href="/settings/organization" className={navClass(active === 'organization')}>
        Organization
      </Link>
      <Link href="/settings/access" className={navClass(active === 'access')}>
        Access
      </Link>
    </nav>
  );
}
