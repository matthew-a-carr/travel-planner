import Link from 'next/link';
import type { ReactNode } from 'react';
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
    return 'shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900';
  }
  return 'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100';
}

export function AuthenticatedAppHeader({
  activeNav,
  organizations,
  activeOrganizationId,
  userImage,
  userName,
  utilityLeadingSlot,
  utilityTrailingSlot,
}: {
  activeNav: 'trips' | 'settings';
  organizations: OrganizationOption[];
  activeOrganizationId: string;
  userImage: string | null | undefined;
  userName: string | null | undefined;
  utilityLeadingSlot?: ReactNode;
  utilityTrailingSlot?: ReactNode;
}) {
  return (
    <header
      data-testid="app-header"
      className="sticky top-0 z-40 border-b border-zinc-200/80 bg-zinc-50/95 backdrop-blur supports-[backdrop-filter]:bg-zinc-50/80 dark:border-zinc-800/80 dark:bg-zinc-950/95 dark:supports-[backdrop-filter]:bg-zinc-950/80"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:gap-4">
          <Link
            href="/"
            className="inline-flex w-fit items-center text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100"
          >
            Travel Planner
          </Link>

          <div
            data-testid="app-header-section-row"
            className="order-3 border-t border-zinc-200/80 pt-3 dark:border-zinc-800/80 md:order-none md:col-span-2 md:row-start-2"
          >
            <nav aria-label="Primary" className="flex items-center gap-2 overflow-x-auto">
              <Link
                href="/"
                aria-current={activeNav === 'trips' ? 'page' : undefined}
                className={navLinkClasses(activeNav === 'trips')}
              >
                Trips
              </Link>
              <Link
                href="/settings/organization"
                aria-current={activeNav === 'settings' ? 'page' : undefined}
                className={navLinkClasses(activeNav === 'settings')}
              >
                Settings
              </Link>
            </nav>
          </div>

          <div
            data-testid="app-header-utility-row"
            className="order-2 flex min-w-0 flex-wrap items-center gap-2 md:order-none md:row-start-1 md:justify-self-end"
          >
            <div className="min-w-0 basis-full md:w-[22rem] md:flex-none">
              <OrganizationSwitcher
                organizations={organizations}
                activeOrganizationId={activeOrganizationId}
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              {utilityLeadingSlot}
              {utilityTrailingSlot}
              <UserAvatar image={userImage} name={userName} />
              <SignOutButton />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
