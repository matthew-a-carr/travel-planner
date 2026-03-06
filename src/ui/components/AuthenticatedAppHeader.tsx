import Link from 'next/link';
import { OrganizationSwitcher } from '@/ui/components/OrganizationSwitcher';
import { SignOutButton } from '@/ui/components/SignOutButton';
import { UserAvatar } from '@/ui/components/UserAvatar';

type OrganizationOption = {
  readonly id: string;
  readonly name: string;
  readonly role: 'owner' | 'member';
};

function navLinkClasses(isActive: boolean) {
  if (isActive) {
    return 'rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900';
  }
  return 'rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100';
}

export function AuthenticatedAppHeader({
  activeNav,
  organizations,
  activeOrganizationId,
  userImage,
  userName,
}: {
  activeNav: 'trips' | 'settings';
  organizations: OrganizationOption[];
  activeOrganizationId: string;
  userImage: string | null | undefined;
  userName: string | null | undefined;
}) {
  return (
    <header className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Travel Planner
          </h1>
          <nav aria-label="Primary" className="flex items-center gap-1">
            <Link href="/" className={navLinkClasses(activeNav === 'trips')}>
              Trips
            </Link>
            <Link
              href="/settings/organization"
              className={navLinkClasses(activeNav === 'settings')}
            >
              Settings
            </Link>
          </nav>
        </div>

        <div className="flex w-full items-center gap-3 sm:w-auto">
          <div className="min-w-0 flex-1 sm:w-72 sm:flex-none">
            <OrganizationSwitcher
              organizations={organizations}
              activeOrganizationId={activeOrganizationId}
            />
          </div>
          <div className="flex items-center gap-2">
            <UserAvatar image={userImage} name={userName} />
            <SignOutButton />
          </div>
        </div>
      </div>
    </header>
  );
}
