'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setActiveOrganizationAction } from '@/app/organizations/actions';

type OrganizationOption = {
  readonly id: string;
  readonly name: string;
  readonly role: 'owner' | 'member';
};

export function OrganizationSwitcher({
  organizations,
  activeOrganizationId,
}: {
  organizations: OrganizationOption[];
  activeOrganizationId: string;
}) {
  const [isSwitching, startSwitching] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-1">
      <label htmlFor="active-organization" className="sr-only">
        Active organization
      </label>
      <select
        id="active-organization"
        name="organizationId"
        value={activeOrganizationId}
        disabled={isSwitching}
        onChange={(event) => {
          const selectedOrganizationId = event.target.value;
          startSwitching(async () => {
            await setActiveOrganizationAction(selectedOrganizationId);
            router.refresh();
          });
        }}
        className="block w-full min-w-0 truncate rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
      >
        {organizations.map((organization) => (
          <option key={organization.id} value={organization.id}>
            {organization.name} ({organization.role})
          </option>
        ))}
      </select>
    </div>
  );
}
